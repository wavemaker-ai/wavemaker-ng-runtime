import { CompilerFacadeImpl, JitEvaluator, outputAst as o } from '@angular/compiler';

import { isCSPEnabled } from './expression-parser';

/*
 * CSP-safe JIT compilation.
 *
 * Some widgets build markup at runtime and compile it into a component with Angular's JIT compiler,
 * e.g. a table whose columns come from the data (DynamicComponentRefProviderService). Angular's JIT
 * compiler turns a component into an output AST, prints it as JavaScript and runs it with
 * `new Function` (JitEvaluator), which a Content-Security-Policy without 'unsafe-eval' blocks.
 *
 * InterpretingJitEvaluator runs the same output AST by walking it, building real JS closures for the
 * template / factory functions Angular calls. No source text is ever evaluated, so it works under a
 * strict CSP and Trusted Types. It is only installed when eval is blocked, as walking the AST is slower
 * than running compiled code.
 */

// Returned through a chain of property reads / calls when an optional link (`a?.b`) hits null or
// undefined, so that the rest of the chain is skipped, like JS optional chaining.
const SHORT_CIRCUIT = Symbol('short-circuit');

class Scope {
    private readonly vars = new Map<string, any>();

    // hasThis: whether this scope is the body of a `function`, which has its own `this`
    constructor(private readonly parent: Scope | null, private readonly hasThis = false, private readonly thisArg?: any) {}

    declare(name: string, value: any) {
        this.vars.set(name, value);
    }

    private owner(name: string): Scope | null {
        let scope: Scope | null = this;
        while (scope) {
            if (scope.vars.has(name)) {
                return scope;
            }
            scope = scope.parent;
        }
        return null;
    }

    get(name: string) {
        const owner = this.owner(name);
        if (owner) {
            return owner.vars.get(name);
        }
        if (name in globalThis) {
            return globalThis[name];
        }
        throw new ReferenceError(`${name} is not defined`);
    }

    set(name: string, value: any) {
        const owner = this.owner(name);
        if (!owner) {
            throw new ReferenceError(`${name} is not defined`);
        }
        owner.vars.set(name, value);
        return value;
    }

    getThis() {
        let scope: Scope | null = this;
        while (scope && !scope.hasThis) {
            scope = scope.parent;
        }
        return scope?.thisArg;
    }
}

class ReturnValue {
    constructor(readonly value: any) {}
}

const binaryOps: Record<number, (l, r) => any> = {
    /* eslint-disable eqeqeq */
    [o.BinaryOperator.Equals]: (l, r) => l == r,
    [o.BinaryOperator.NotEquals]: (l, r) => l != r,
    /* eslint-enable eqeqeq */
    [o.BinaryOperator.Identical]: (l, r) => l === r,
    [o.BinaryOperator.NotIdentical]: (l, r) => l !== r,
    [o.BinaryOperator.Minus]: (l, r) => l - r,
    [o.BinaryOperator.Plus]: (l, r) => l + r,
    [o.BinaryOperator.Divide]: (l, r) => l / r,
    [o.BinaryOperator.Multiply]: (l, r) => l * r,
    [o.BinaryOperator.Modulo]: (l, r) => l % r,
    [o.BinaryOperator.BitwiseOr]: (l, r) => l | r,
    [o.BinaryOperator.BitwiseAnd]: (l, r) => l & r,
    [o.BinaryOperator.Lower]: (l, r) => l < r,
    [o.BinaryOperator.LowerEquals]: (l, r) => l <= r,
    [o.BinaryOperator.Bigger]: (l, r) => l > r,
    [o.BinaryOperator.BiggerEquals]: (l, r) => l >= r,
    [o.BinaryOperator.Exponentiation]: (l, r) => l ** r,
    [o.BinaryOperator.In]: (l, r) => l in r,
    [o.BinaryOperator.InstanceOf]: (l, r) => l instanceof r
};

// compound assignment operator -> the binary operator it applies
const compoundAssignOps: Record<number, number> = {
    [o.BinaryOperator.AdditionAssignment]: o.BinaryOperator.Plus,
    [o.BinaryOperator.SubtractionAssignment]: o.BinaryOperator.Minus,
    [o.BinaryOperator.MultiplicationAssignment]: o.BinaryOperator.Multiply,
    [o.BinaryOperator.DivisionAssignment]: o.BinaryOperator.Divide,
    [o.BinaryOperator.RemainderAssignment]: o.BinaryOperator.Modulo,
    [o.BinaryOperator.ExponentiationAssignment]: o.BinaryOperator.Exponentiation
};

// equivalent of the `makeTemplateObject` polyfill JitEmitterVisitor uses for tagged templates
const makeTemplateObject = (cooked: string[], raw: string[]) => {
    Object.defineProperty(cooked, 'raw', { value: raw });
    return Object.freeze(cooked);
};

const isChainLink = (ast: o.Expression) => ast instanceof o.ReadPropExpr || ast instanceof o.ReadKeyExpr || ast instanceof o.InvokeFunctionExpr;

/**
 * Evaluates Angular's output AST (the statements JitEvaluator would print and eval).
 * `context` of every visit method is the current Scope.
 */
class OutputAstInterpreter implements o.ExpressionVisitor, o.StatementVisitor {
    constructor(private readonly refResolver: { resolveExternalReference(ref: o.ExternalReference): unknown }) {}

    // ---------- helpers ----------

    // Evaluates an expression, ending any optional chain it is the outermost link of.
    evaluate(ast: o.Expression, scope: Scope) {
        const value = ast.visitExpression(this, scope);
        return value === SHORT_CIRCUIT ? undefined : value;
    }

    // Evaluates the receiver of a chain link, passing a short-circuit through to the outer links.
    private evaluateLink(ast: o.Expression, scope: Scope) {
        return isChainLink(ast) ? ast.visitExpression(this, scope) : this.evaluate(ast, scope);
    }

    private evaluateList(list: o.Expression[], scope: Scope) {
        const result = [];
        for (const item of list) {
            if (item instanceof o.SpreadElementExpr) {
                result.push(...this.evaluate(item.expression, scope));
            } else {
                result.push(this.evaluate(item, scope));
            }
        }
        return result;
    }

    // Runs statements in the given scope; returns a ReturnValue when a return statement is hit.
    executeStatements(statements: o.Statement[], scope: Scope): ReturnValue | undefined {
        // function declarations are hoisted, like in JS
        for (const stmt of statements) {
            if (stmt instanceof o.DeclareFunctionStmt) {
                scope.declare(stmt.name, this.createFunction(stmt.params, stmt.statements, scope, stmt.name));
            }
        }
        for (const stmt of statements) {
            if (stmt instanceof o.DeclareFunctionStmt) {
                continue;
            }
            const result = stmt.visitStatement(this, scope);
            if (result instanceof ReturnValue) {
                return result;
            }
        }
        return undefined;
    }

    private bindParams(params: o.FnParam[], args: any[], scope: Scope) {
        params.forEach((param, i) => scope.declare(param.name, args[i]));
    }

    // A `function` (own `this`); declares its own name inside, like a named function expression.
    private createFunction(params: o.FnParam[], statements: o.Statement[], definingScope: Scope, name?: string | null) {
        const interpreter = this;
        const fn = function (this: any, ...args: any[]) {
            const scope = new Scope(definingScope, true, this);
            if (name) {
                scope.declare(name, fn);
            }
            interpreter.bindParams(params, args, scope);
            const result = interpreter.executeStatements(statements, scope);
            return result ? result.value : undefined;
        };
        return fn;
    }

    // Resolves what a call invokes and the `this` to invoke it with; undefined fn + skip for `a?.b()` on null.
    private resolveCallee(fnAst: o.Expression, scope: Scope): { fn: any, thisArg: any, skip: boolean } {
        if (fnAst instanceof o.ReadPropExpr || fnAst instanceof o.ReadKeyExpr) {
            const receiver = this.evaluateLink(fnAst.receiver, scope);
            if (receiver === SHORT_CIRCUIT || (fnAst.isOptional && receiver == null)) {
                return { fn: undefined, thisArg: undefined, skip: true };
            }
            const key = fnAst instanceof o.ReadPropExpr ? fnAst.name : this.evaluate(fnAst.index, scope);
            return { fn: receiver[key], thisArg: receiver, skip: false };
        }
        const fn = this.evaluateLink(fnAst, scope);
        return { fn: fn === SHORT_CIRCUIT ? undefined : fn, thisArg: undefined, skip: fn === SHORT_CIRCUIT };
    }

    private assign(target: o.Expression, scope: Scope, computeValue: (current: () => any) => any) {
        if (target instanceof o.ReadVarExpr) {
            return scope.set(target.name, computeValue(() => scope.get(target.name)));
        }
        if (target instanceof o.ReadPropExpr || target instanceof o.ReadKeyExpr) {
            const receiver = this.evaluate(target.receiver, scope);
            const key = target instanceof o.ReadPropExpr ? target.name : this.evaluate(target.index, scope);
            return (receiver[key] = computeValue(() => receiver[key]));
        }
        throw new Error(`Invalid assignment target: ${target.constructor.name}`);
    }

    // ---------- statements ----------

    visitDeclareVarStmt(stmt: o.DeclareVarStmt, scope: Scope) {
        scope.declare(stmt.name, stmt.value ? this.evaluate(stmt.value, scope) : undefined);
    }

    visitDeclareFunctionStmt(stmt: o.DeclareFunctionStmt, scope: Scope) {
        // hoisted in executeStatements
        scope.declare(stmt.name, this.createFunction(stmt.params, stmt.statements, scope, stmt.name));
    }

    visitExpressionStmt(stmt: o.ExpressionStatement, scope: Scope) {
        this.evaluate(stmt.expr, scope);
    }

    visitReturnStmt(stmt: o.ReturnStatement, scope: Scope) {
        return new ReturnValue(this.evaluate(stmt.value, scope));
    }

    visitIfStmt(stmt: o.IfStmt, scope: Scope) {
        const branch = this.evaluate(stmt.condition, scope) ? stmt.trueCase : stmt.falseCase;
        if (branch && branch.length) {
            return this.executeStatements(branch, new Scope(scope)); // block scope
        }
    }

    // ---------- expressions ----------

    visitReadVarExpr(ast: o.ReadVarExpr, scope: Scope) {
        return ast.name === 'this' ? scope.getThis() : scope.get(ast.name);
    }

    visitInvokeFunctionExpr(ast: o.InvokeFunctionExpr, scope: Scope) {
        const { fn, thisArg, skip } = this.resolveCallee(ast.fn, scope);
        if (skip || (ast.isOptional && fn == null)) {
            return SHORT_CIRCUIT;
        }
        return fn.apply(thisArg, this.evaluateList(ast.args, scope));
    }

    visitTaggedTemplateLiteralExpr(ast: o.TaggedTemplateLiteralExpr, scope: Scope) {
        const { fn, thisArg } = this.resolveCallee(ast.tag, scope);
        const strings = makeTemplateObject(ast.template.elements.map(e => e.text), ast.template.elements.map(e => e.rawText));
        return fn.call(thisArg, strings, ...ast.template.expressions.map(e => this.evaluate(e, scope)));
    }

    visitTemplateLiteralExpr(ast: o.TemplateLiteralExpr, scope: Scope) {
        let result = '';
        for (let i = 0; i < ast.elements.length; i++) {
            result += ast.elements[i].text;
            if (i < ast.expressions.length) {
                result += String(this.evaluate(ast.expressions[i], scope));
            }
        }
        return result;
    }

    visitTemplateLiteralElementExpr(ast: o.TemplateLiteralElementExpr) {
        return ast.text;
    }

    visitInstantiateExpr(ast: o.InstantiateExpr, scope: Scope) {
        const Ctor = this.evaluate(ast.classExpr, scope);
        return new Ctor(...this.evaluateList(ast.args, scope));
    }

    visitLiteralExpr(ast: o.LiteralExpr) {
        return ast.value;
    }

    visitLocalizedString(ast: o.LocalizedString, scope: Scope) {
        const parts = [ast.serializeI18nHead()];
        for (let i = 1; i < ast.messageParts.length; i++) {
            parts.push(ast.serializeI18nTemplatePart(i));
        }
        const strings = makeTemplateObject(parts.map(p => p.cooked), parts.map(p => p.raw));
        return globalThis['$localize'](strings, ...ast.expressions.map(e => this.evaluate(e, scope)));
    }

    visitExternalExpr(ast: o.ExternalExpr) {
        return this.refResolver.resolveExternalReference(ast.value);
    }

    visitConditionalExpr(ast: o.ConditionalExpr, scope: Scope) {
        if (this.evaluate(ast.condition, scope)) {
            return this.evaluate(ast.trueCase, scope);
        }
        return ast.falseCase ? this.evaluate(ast.falseCase, scope) : undefined;
    }

    visitDynamicImportExpr(): never {
        throw new Error('Dynamic import() is not supported by the CSP-safe JIT compiler');
    }

    visitNotExpr(ast: o.NotExpr, scope: Scope) {
        return !this.evaluate(ast.condition, scope);
    }

    visitFunctionExpr(ast: o.FunctionExpr, scope: Scope) {
        return this.createFunction(ast.params, ast.statements, scope, ast.name);
    }

    visitArrowFunctionExpr(ast: o.ArrowFunctionExpr, definingScope: Scope) {
        const interpreter = this;
        // no own `this`: `this` resolves to the one of the enclosing function
        return (...args: any[]) => {
            const scope = new Scope(definingScope);
            interpreter.bindParams(ast.params, args, scope);
            if (Array.isArray(ast.body)) {
                const result = interpreter.executeStatements(ast.body, scope);
                return result ? result.value : undefined;
            }
            return interpreter.evaluate(ast.body, scope);
        };
    }

    visitUnaryOperatorExpr(ast: o.UnaryOperatorExpr, scope: Scope) {
        const value = this.evaluate(ast.expr, scope);
        switch (ast.operator) {
            case o.UnaryOperator.Minus:
                return -value;
            case o.UnaryOperator.Plus:
                return +value;
        }
        throw new Error(`Unknown unary operator ${ast.operator}`);
    }

    visitBinaryOperatorExpr(ast: o.BinaryOperatorExpr, scope: Scope) {
        const op = ast.operator;
        switch (op) {
            case o.BinaryOperator.And:
                return this.evaluate(ast.lhs, scope) && this.evaluate(ast.rhs, scope);
            case o.BinaryOperator.Or:
                return this.evaluate(ast.lhs, scope) || this.evaluate(ast.rhs, scope);
            case o.BinaryOperator.NullishCoalesce:
                return this.evaluate(ast.lhs, scope) ?? this.evaluate(ast.rhs, scope);
            case o.BinaryOperator.Assign:
                return this.assign(ast.lhs, scope, () => this.evaluate(ast.rhs, scope));
            case o.BinaryOperator.AndAssignment:
                return this.assign(ast.lhs, scope, current => current() && this.evaluate(ast.rhs, scope));
            case o.BinaryOperator.OrAssignment:
                return this.assign(ast.lhs, scope, current => current() || this.evaluate(ast.rhs, scope));
            case o.BinaryOperator.NullishCoalesceAssignment:
                return this.assign(ast.lhs, scope, current => current() ?? this.evaluate(ast.rhs, scope));
        }
        if (op in compoundAssignOps) {
            const apply = binaryOps[compoundAssignOps[op]];
            return this.assign(ast.lhs, scope, current => apply(current(), this.evaluate(ast.rhs, scope)));
        }
        const apply = binaryOps[op];
        if (!apply) {
            throw new Error(`Unknown binary operator ${op}`);
        }
        return apply(this.evaluate(ast.lhs, scope), this.evaluate(ast.rhs, scope));
    }

    visitReadPropExpr(ast: o.ReadPropExpr, scope: Scope) {
        const receiver = this.evaluateLink(ast.receiver, scope);
        if (receiver === SHORT_CIRCUIT || (ast.isOptional && receiver == null)) {
            return SHORT_CIRCUIT;
        }
        return receiver[ast.name];
    }

    visitReadKeyExpr(ast: o.ReadKeyExpr, scope: Scope) {
        const receiver = this.evaluateLink(ast.receiver, scope);
        if (receiver === SHORT_CIRCUIT || (ast.isOptional && receiver == null)) {
            return SHORT_CIRCUIT;
        }
        return receiver[this.evaluate(ast.index, scope)];
    }

    visitLiteralArrayExpr(ast: o.LiteralArrayExpr, scope: Scope) {
        return this.evaluateList(ast.entries, scope);
    }

    visitLiteralMapExpr(ast: o.LiteralMapExpr, scope: Scope) {
        const result = {};
        for (const entry of ast.entries) {
            if (entry instanceof o.LiteralMapSpreadAssignment) {
                Object.assign(result, this.evaluate(entry.expression, scope));
            } else {
                result[entry.key] = this.evaluate(entry.value, scope);
            }
        }
        return result;
    }

    visitCommaExpr(ast: o.CommaExpr, scope: Scope) {
        let value;
        for (const part of ast.parts) {
            value = this.evaluate(part, scope);
        }
        return value;
    }

    visitWrappedNodeExpr(ast: o.WrappedNodeExpr<any>) {
        // holds a runtime value, e.g. a reference to a component class
        return ast.node;
    }

    visitTypeofExpr(ast: o.TypeofExpr, scope: Scope) {
        return typeof this.evaluate(ast.expr, scope);
    }

    visitVoidExpr(ast: o.VoidExpr, scope: Scope) {
        this.evaluate(ast.expr, scope);
        return undefined;
    }

    visitParenthesizedExpr(ast: o.ParenthesizedExpr, scope: Scope) {
        // parentheses end an optional chain: `(a?.b).c`
        return this.evaluate(ast.expr, scope);
    }

    visitRegularExpressionLiteral(ast: o.RegularExpressionLiteralExpr) {
        return new RegExp(ast.body, ast.flags ?? undefined);
    }

    visitSpreadElementExpr(): never {
        throw new Error('Spread element outside of an array literal or call arguments');
    }
}

/**
 * A JitEvaluator that interprets the statements instead of evaluating them as JavaScript source.
 * Returns the exported variables (e.g. `$def`, the compiled component definition), like JitEvaluator.
 */
export class InterpretingJitEvaluator extends JitEvaluator {
    override evaluateStatements(sourceUrl: string, statements: o.Statement[], refResolver: any, createSourceMaps: boolean): Record<string, any> {
        const interpreter = new OutputAstInterpreter(refResolver);
        const scope = new Scope(null);
        interpreter.executeStatements(statements, scope);

        const exported = {};
        for (const stmt of statements) {
            if ((stmt instanceof o.DeclareVarStmt || stmt instanceof o.DeclareFunctionStmt) && stmt.hasModifier(o.StmtModifier.Exported)) {
                exported[stmt.name] = scope.get(stmt.name);
            }
        }
        return exported;
    }
}

let installed = false;

/**
 * Makes Angular's JIT compiler (used for components created from markup at runtime) CSP-safe, by
 * replacing its evaluator with InterpretingJitEvaluator. Does nothing when eval is allowed, unless forced.
 * Call before creating a component from runtime markup. Returns whether the CSP-safe compiler is in use.
 */
export const installCspSafeJitCompiler = (force?: boolean): boolean => {
    if (installed) {
        return true;
    }
    if (!force && !isCSPEnabled()) {
        return false;
    }
    const ng = globalThis['ng'] = globalThis['ng'] || {};
    ng.ɵcompilerFacade = new CompilerFacadeImpl(new InterpretingJitEvaluator());
    installed = true;
    return true;
};
