import {
    Binary,
    BindingPipe,
    Call,
    Chain,
    Conditional,
    ImplicitReceiver,
    KeyedRead,
    Lexer,
    LiteralArray,
    LiteralMap,
    LiteralPrimitive,
    ParseLocation,
    ParseSourceFile,
    ParseSourceSpan,
    Parser,
    PrefixNot,
    PropertyRead,
    Unary,
    ParenthesizedExpression,
    NonNullAssert,
    RegularExpressionLiteral,
    SafeCall,
    SafeKeyedRead,
    SafePropertyRead,
    SpreadElement,
    TaggedTemplateLiteral,
    TemplateLiteral,
    ThisReceiver,
    TypeofExpression,
    VoidExpression
} from '@angular/compiler';

const isDef = v => v !== void 0;
const ifDef = (v, d) => v === void 0 ? d : v;
const plus = (a, b) => void 0 === a ? b : void 0 === b ? a : a + b;
const minus = (a, b) => ifDef(a, 0) - ifDef(b, 0);
const noop = () => {};

// Helper to create ParseSourceSpan for Angular 20 compatibility
const createParseSourceSpan = (content: string): ParseSourceSpan => {
    const sourceFile = new ParseSourceFile(content, '');
    const start = new ParseLocation(sourceFile, 0, 0, 0);
    const end = new ParseLocation(sourceFile, content.length, 0, content.length);
    return new ParseSourceSpan(start, end);
};

export type ParseExprResult = (data?: any, locals?: any) => any;

const exprFnCache = new Map();
const eventFnCache = new Map();
const purePipes = new Map();

const primitiveEquals = (a, b) => {
    if (typeof a === 'object' || typeof b === 'object') {
        return false;
    }
    if (a !== a && b !== b) { // NaN case
        return true;
    }
    return a === b;
};

const detectChanges = (ov, nv) => {
    const len = nv.length;
    let hasChange = len > 10;
    switch (len) {
        case 10:
            hasChange = !primitiveEquals(ov[9], nv[9]);
            if (hasChange) {
                break;
            }
        case 9:
            hasChange = !primitiveEquals(ov[8], nv[8]);
            if (hasChange) {
                break;
            }
        case 8:
            hasChange = !primitiveEquals(ov[7], nv[7]);
            if (hasChange) {
                break;
            }
        case 7:
            hasChange = !primitiveEquals(ov[6], nv[6]);
            if (hasChange) {
                break;
            }
        case 6:
            hasChange = !primitiveEquals(ov[5], nv[5]);
            if (hasChange) {
                break;
            }
        case 5:
            hasChange = !primitiveEquals(ov[4], nv[4]);
            if (hasChange) {
                break;
            }
        case 4:
            hasChange = !primitiveEquals(ov[3], nv[3]);
            if (hasChange) {
                break;
            }
        case 3:
            hasChange = !primitiveEquals(ov[2], nv[2]);
            if (hasChange) {
                break;
            }
        case 2:
            hasChange = !primitiveEquals(ov[1], nv[1]);
            if (hasChange) {
                break;
            }
        case 1:
            hasChange = !primitiveEquals(ov[0], nv[0]);
            if (hasChange) {
                break;
            }
    }
    return hasChange;
};

const getPurePipeVal = (pipe, cache, identifier, ...args) => {
    let lastResult = cache.get(identifier);
    let result;
    if (lastResult) {
        const isModified = detectChanges(lastResult.args, args);
        if (!isModified) {
            return lastResult.result;
        }
    }
    result = pipe.transform(...args);
    lastResult = {args, result};
    cache.set(identifier, lastResult);
    return result;
};

const STR_ESCAPE_REGEX = /[^ a-zA-Z0-9]/g;

const stringEscapeFn = str => {
    return '\\u' + ('0000' + str.charCodeAt(0).toString(16)).slice(-4);
};

class ASTCompiler {
    ast; // ast to be compiled
    declarations; // variable names
    stmts; // function body statements
    pipes; // used pipes
    vIdx; // variable name index
    cAst; // current AST node in the process
    cStmts;
    pipeNameVsIsPureMap;
    exprType: ExpressionType;

    constructor(ast, exprType, pipeNameVsIsPureMap?) {
        this.ast = ast;
        this.declarations = [];
        this.stmts = [];
        this.pipes = [];
        this.vIdx = 0;
        this.exprType = exprType;
        this.pipeNameVsIsPureMap = pipeNameVsIsPureMap;
    }

    createVar() {
        const v = `v${this.vIdx++}`;
        this.declarations.push(v);
        return v;
    }

    processImplicitReceiver() {
        return 'ctx';
    }

    processLiteralPrimitive() {
        const ast = this.cAst;
        return typeof (ast.value) === 'string' ? `"${ast.value.replace(/"/g, '\"').replace(STR_ESCAPE_REGEX, stringEscapeFn)}"` : ast.value;
    }

    processLiteralArray() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const v = this.createVar();
        const s = [];
        for (const item of ast.expressions) {
            s.push(this.build(item, stmts));
        }
        stmts.push(`${v}=[${s.join(',')}]`);
        return v;
    }

    processLiteralMap() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const v = this.createVar();
        const _values = [];
        for (const _value of ast.values) {
            _values.push(this.build(_value, stmts));
        }
        stmts.push(`${v}={${ast.keys.map((k, i) => `'${k.key}':${_values[i]}`)}}`);
        return v;
    }

    processPropertyRead() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const r = this.build(ast.receiver, stmts);
        const v = this.createVar();
        stmts.push(`${v}=${r}&&${r}.${ast.name}`);
        return v;
    }

    processKeyedRead() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const k = this.build(ast.key, stmts);
        const o = this.build(ast.receiver, stmts);
        const v = this.createVar();
        stmts.push(`${v}=${o}&&${o}[${k}]`);
        return v;
    }

    processPrefixNot() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const r = this.build(ast.expression, stmts);
        stmts.push(`${r}=!${r}`);
        return r;
    }

    handleBinaryPlus_Minus() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const l = this.build(ast.left, stmts);
        const r = this.build(ast.right, stmts);
        const v = this.createVar();
        const m = ast.operation === '+' ? '_plus' : '_minus';
        stmts.push(`${v}=${m}(${l},${r})`);
        return v;
    }

    handleBinaryAND_OR() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const _s1 = [];
        const _sl = [];
        const _sr = [];
        const l = this.build(ast.left, _sl);
        const r = this.build(ast.right, _sr);

        const v = this.createVar();

        if (ast.operation === '&&') {
            _s1.push(
                _sl.join(';'),
                `;${v}=false`,
                `;if(${l}){`,
                _sr.join(';'),
                `;${v}=${r};`,
                `}`
            );
        } else {
            _s1.push(
                _sl.join(';'),
                `;${v}=${l}`,
                `;if(!${l}){`,
                _sr.join(';'),
                `;${v}=${r};`,
                `}`
            );
        }
        stmts.push(_s1.join(''));
        return v;
    }

    handleBinaryDefault() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const l = this.build(ast.left, stmts);
        const r = this.build(ast.right, stmts);
        const v = this.createVar();
        stmts.push(`${v}=${l}${ast.operation}${r}`);
        return v;
    }

    processBinary() {
        const ast = this.cAst;
        const op = ast.operation;
        if (op === '+' || op === '-') {
            return this.handleBinaryPlus_Minus();
        }
        if (op === '&&' || op === '||') {
            return this.handleBinaryAND_OR();
        }

        return this.handleBinaryDefault();
    }

    processUnary() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const e = this.build(ast.expr, stmts);
        const v = this.createVar();
        stmts.push(`${v}=${ast.operator}${e}`);
        return v;
    }

    processParenthesizedExpression() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        return  this.build(ast.expression, stmts);
    }

    processConditional() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const condition = this.build(ast.condition, stmts);
        const v = this.createVar();
        const _s1 = [];
        const _s2 = [];
        const _s3 = [];
        const trueExp = this.build(ast.trueExp, _s2);
        const falseExp = this.build(ast.falseExp, _s3);

        _s1.push(
            `if(${condition}){`,
            _s2.join(';'),
            `;${v}=${trueExp};`,
            `}else{`,
            _s3.join(';'),
            `;${v}=${falseExp};`,
            `}`
        );

        stmts.push(_s1.join(' '));
        return v;
    }

    processMethodCall() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const _args = [];
        for (const arg of ast.args) {
            _args.push(this.build(arg, stmts));
        }
        const fn = this.build(ast.receiver, stmts);
        const v = this.createVar();
        const isImplicitReceiver = ast.receiver instanceof ImplicitReceiver || (ast.receiver instanceof PropertyRead && ast.receiver?.receiver instanceof ImplicitReceiver);
        const context = stmts[stmts.length - 1].split('&&')[0].split('=')[1];
        stmts.push(`${v}= ${fn}&&${fn}${isImplicitReceiver ? '.bind(_ctx)' : `.bind(${context})`}(${_args.join(',')})`);
        return v;
    }

    processChain() {
        const ast = this.cAst;
        return ast.expressions.map(e => this.build(e)).join(';');
    }

    processPipe() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        const t = this.createVar();
        const _args = [];
        const _s1 = [];
        const _s2 = [];
        const exp = this.build(ast.exp, stmts);
        for (const arg of ast.args) {
            _args.push(this.build(arg, _s2));
        }

        const p = `_p${this.pipes.length}`;
        this.pipes.push([ast.name, p]);

        _args.unshift(exp);

        _s1.push(
            _s2.length ? _s2.join(';') + ';' : '',
            this.pipeNameVsIsPureMap.get(ast.name) ? `${t}=getPPVal(${p},_ppc,"${p}",${_args})` : `${t}=${p}.transform(${_args})`
        );

        stmts.push(_s1.join(''));
        return t;
    }

    build(ast, cStmts?) {
        this.cAst = ast;
        this.cStmts = cStmts || this.stmts;

        if (ast instanceof ImplicitReceiver) {
            return this.processImplicitReceiver();
        } else if (ast instanceof LiteralPrimitive) {
            return this.processLiteralPrimitive();
        } else if (ast instanceof LiteralArray) {
            return this.processLiteralArray();
        } else if (ast instanceof LiteralMap) {
            return this.processLiteralMap();
        } else if (ast instanceof PropertyRead) {
            return this.processPropertyRead();
        // } else if (ast instanceof PropertyWrite) {
        //     return this.processPropertyWrite();  // PropertyWrite removed in Angular 20
        } else if (ast instanceof KeyedRead) {
            return this.processKeyedRead();
        } else if (ast instanceof PrefixNot) {
            return this.processPrefixNot();
        } else if (ast instanceof Unary) {
            return this.processUnary();
        } else if (ast instanceof Binary) {
            return this.processBinary();
        } else if (ast instanceof ParenthesizedExpression) {
            return this.processParenthesizedExpression();
        } else if (ast instanceof Conditional) {
            return this.processConditional();
        } else if (ast instanceof Call) {
            return this.processMethodCall();
        } else if (ast instanceof Chain) {
            return this.processChain();
        } else if (ast instanceof BindingPipe) {
            return this.processPipe();
        }
    }

    extendCtxWithLocals() {
        const v1 = this.createVar();
        this.stmts.push(
            `${v1}=Object.assign({}, locals)`,
            `Object.setPrototypeOf(${v1}, _ctx)`,
            `ctx=${v1}`
        );
    }

    fnBody() {
        this.declarations.push('ctx');
        return '"use strict";\nvar ' + this.declarations.join(',') + ';\n' + this.stmts.join(';');
    }

    fnArgs() {
        const args = ['_plus', '_minus', '_isDef'];

        if (this.exprType === ExpressionType.Binding) {
            args.push('getPPVal', '_ppc');
            for (const [, pipeVar] of this.pipes) {
                args.push(pipeVar);
            }
        }

        args.push('_ctx', 'locals');

        return args.join(',');
    }

    addReturnStmt(result) {
        // if (this.exprType === ExpressionType.Binding) {
            this.stmts.push(`return ${result};`);
        // }
    }

    cleanup() {
        this.ast = this.cAst = this.stmts = this.cStmts = this.declarations = this.pipes = this.pipeNameVsIsPureMap = undefined;
    }

    compile(defOnly?) {
        this.extendCtxWithLocals();
        this.addReturnStmt(this.build(this.ast));
        if (defOnly) {
            return {fnBody: this.fnBody(), fnArgs: this.fnArgs(), pipes: this.pipes};
        }
        const fn = new Function(this.fnArgs(), this.fnBody());
        let boundFn;
        if (this.exprType === ExpressionType.Binding) {
            boundFn = fn.bind(undefined, plus, minus, isDef, getPurePipeVal);
            boundFn.usedPipes = this.pipes.slice(0); // clone
        } else {
            boundFn = fn.bind(undefined, plus, minus, isDef);
        }

        this.cleanup();
        return boundFn;
    }
}

// ==================== CSP-safe AST interpreter ====================
//
// Evaluates the parsed expression AST directly, instead of generating JS source and running it
// through `new Function` like ASTCompiler does. Used when a Content-Security-Policy blocks eval
// (no 'unsafe-eval') and the expression was not pre-compiled by codegen, e.g. expressions that
// only exist at runtime (tree node actions, table rowngclass/col-ng-class, menu item actions).
//
// Semantics deliberately mirror the code ASTCompiler generates, so that an expression gives the
// same result with and without CSP: `+`/`-` tolerate undefined operands, `a && b` yields `false`
// (not `a`) for a falsy `a`, `a.b` yields `a` itself for a falsy `a`, method calls on the implicit
// receiver run with `this` set to the original context, and a chain returns its first value.

const BLOCKED_MEMBERS = new Set(['constructor', '__proto__', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);

// Expressions must not reach the Function constructor, prototypes or eval: that would let a
// runtime expression run arbitrary code, which is exactly what CSP is there to prevent.
const checkMember = (key, forWrite?: boolean) => {
    const name = typeof key === 'symbol' ? key : String(key);
    if (BLOCKED_MEMBERS.has(name as string) || (forWrite && name === 'prototype')) {
        throw new Error(`Access to '${String(name)}' is not allowed in expressions`);
    }
    return name;
};

const assertCallable = (fn) => {
    if (typeof fn !== 'function') {
        throw new TypeError(`${fn} is not a function`);
    }
    if (fn === Function || fn === globalThis.eval) {
        throw new Error('Calling Function or eval is not allowed in expressions');
    }
};

// Plain JS binary operators. `+`, `-`, `&&`, `||`, `??` and assignments are handled separately.
/* eslint-disable eqeqeq */
const BINARY_OPS: Record<string, (l, r) => any> = {
    '==': (l, r) => l == r,
    '!=': (l, r) => l != r,
    '===': (l, r) => l === r,
    '!==': (l, r) => l !== r,
    '<': (l, r) => l < r,
    '>': (l, r) => l > r,
    '<=': (l, r) => l <= r,
    '>=': (l, r) => l >= r,
    '*': (l, r) => l * r,
    '/': (l, r) => l / r,
    '%': (l, r) => l % r,
    '**': (l, r) => l ** r,
    'in': (l, r) => l in r
};
/* eslint-enable eqeqeq */

const COMPOUND_ASSIGN_OPS: Record<string, (l, r) => any> = {
    '+=': (l, r) => l + r,
    '-=': (l, r) => l - r,
    '*=': (l, r) => l * r,
    '/=': (l, r) => l / r,
    '%=': (l, r) => l % r,
    '**=': (l, r) => l ** r
};

interface PipeState {
    cache: Map<any, any>; // pure pipe results, keyed by the pipe AST node
    instances: Map<any, any>; // pipe instances, keyed by the pipe AST node
    isPure: Map<string, boolean>;
}

interface EvalState {
    ctx: any; // the context the expression runs against
    locals: any;
    scope: any; // locals layered over ctx; what identifiers resolve against
    pipes: PipeState;
}

const isImplicit = ast => ast instanceof ImplicitReceiver || ast instanceof ThisReceiver;

const getPipeInstance = (ast: BindingPipe, pipes: PipeState) => {
    let instance = pipes.instances.get(ast);
    if (instance) {
        return instance;
    }
    const pipeInfo = pipeProvider.meta(ast.name);
    if (!pipeInfo) {
        instance = nullPipe();
    } else if (pipeInfo.pure) {
        instance = purePipes.get(ast.name) || pipeProvider.getInstance(ast.name);
        purePipes.set(ast.name, instance);
    } else {
        instance = pipeProvider.getInstance(ast.name);
    }
    pipes.instances.set(ast, instance);
    return instance;
};

// Resolves the function a Call / TaggedTemplateLiteral invokes, and the `this` to invoke it with.
const resolveCallee = (ast, s: EvalState): { fn: any, thisArg: any, skip?: boolean } => {
    if (ast instanceof PropertyRead || ast instanceof SafePropertyRead) {
        const obj = evaluate(ast.receiver, s);
        if (ast instanceof SafePropertyRead && obj == null) {
            return { fn: undefined, thisArg: undefined, skip: true };
        }
        return {
            fn: obj && obj[checkMember(ast.name)],
            thisArg: isImplicit(ast.receiver) ? s.ctx : obj
        };
    }
    if (ast instanceof KeyedRead || ast instanceof SafeKeyedRead) {
        const key = evaluate(ast.key, s);
        const obj = evaluate(ast.receiver, s);
        if (ast instanceof SafeKeyedRead && obj == null) {
            return { fn: undefined, thisArg: undefined, skip: true };
        }
        return { fn: obj && obj[checkMember(key)], thisArg: obj };
    }
    return { fn: evaluate(ast, s), thisArg: isImplicit(ast) ? s.ctx : undefined };
};

// The object an assignment to a bare identifier (`x = 1`) writes to: the locals when the name is a
// local (e.g. `item`), otherwise the context. Never the merged scope, which is a throwaway copy.
const implicitWriteTarget = (name, s: EvalState) => {
    return s.locals && Object.prototype.hasOwnProperty.call(s.locals, name) ? s.locals : s.ctx;
};

const evaluateAssignment = (ast: Binary, s: EvalState) => {
    const target = ast.left;
    let obj;
    let key;
    if (target instanceof PropertyRead) {
        key = target.name;
        obj = isImplicit(target.receiver) ? implicitWriteTarget(key, s) : evaluate(target.receiver, s);
    } else if (target instanceof KeyedRead) {
        key = evaluate(target.key, s);
        obj = isImplicit(target.receiver) ? implicitWriteTarget(key, s) : evaluate(target.receiver, s);
    } else {
        throw new Error('Invalid assignment target in expression');
    }
    key = checkMember(key, true);
    if (obj == null) {
        throw new TypeError(`Cannot set properties of ${obj} (setting '${String(key)}')`);
    }

    const op = ast.operation;
    if (op === '=') {
        return (obj[key] = evaluate(ast.right, s));
    }
    const current = obj[key];
    switch (op) {
        case '&&=':
            return current ? (obj[key] = evaluate(ast.right, s)) : current;
        case '||=':
            return current ? current : (obj[key] = evaluate(ast.right, s));
        case '??=':
            return current != null ? current : (obj[key] = evaluate(ast.right, s));
    }
    const apply = COMPOUND_ASSIGN_OPS[op];
    if (!apply) {
        throw new Error(`Unsupported assignment operator '${op}' in expression`);
    }
    return (obj[key] = apply(current, evaluate(ast.right, s)));
};

const evaluateBinary = (ast: Binary, s: EvalState) => {
    const op = ast.operation;
    if (Binary.isAssignmentOperation(op)) {
        return evaluateAssignment(ast, s);
    }
    if (op === '&&') {
        // same as the generated code: yields `false`, not the left value, when the left side is falsy
        return evaluate(ast.left, s) ? evaluate(ast.right, s) : false;
    }
    if (op === '||') {
        return evaluate(ast.left, s) || evaluate(ast.right, s);
    }
    if (op === '??') {
        return evaluate(ast.left, s) ?? evaluate(ast.right, s);
    }
    const l = evaluate(ast.left, s);
    const r = evaluate(ast.right, s);
    if (op === '+') {
        return plus(l, r);
    }
    if (op === '-') {
        return minus(l, r);
    }
    const apply = BINARY_OPS[op];
    if (!apply) {
        throw new Error(`Unsupported operator '${op}' in expression`);
    }
    return apply(l, r);
};

const evaluateCall = (ast: Call | SafeCall, s: EvalState) => {
    const args = ast.args.map(arg => evaluate(arg, s));
    const { fn, thisArg, skip } = resolveCallee(ast.receiver, s);
    if (skip || (ast instanceof SafeCall && fn == null)) {
        return undefined;
    }
    if (!fn) {
        return fn;
    }
    assertCallable(fn);
    return fn.apply(thisArg, args);
};

const evaluateTemplate = (ast: TemplateLiteral, s: EvalState) => {
    let result = ast.elements[0].text;
    for (let i = 0; i < ast.expressions.length; i++) {
        result += String(evaluate(ast.expressions[i], s)) + ast.elements[i + 1].text;
    }
    return result;
};

const evaluateTaggedTemplate = (ast: TaggedTemplateLiteral, s: EvalState) => {
    const { fn, thisArg } = resolveCallee(ast.tag, s);
    assertCallable(fn);
    const strings: any = ast.template.elements.map(e => e.text);
    strings.raw = strings.slice();
    const values = ast.template.expressions.map(e => evaluate(e, s));
    return fn.apply(thisArg, [Object.freeze(strings), ...values]);
};

const evaluatePipe = (ast: BindingPipe, s: EvalState) => {
    const value = evaluate(ast.exp, s);
    const args = ast.args.map(arg => evaluate(arg, s));
    const pipe = getPipeInstance(ast, s.pipes);
    if (s.pipes.isPure.get(ast.name)) {
        return getPurePipeVal(pipe, s.pipes.cache, ast, value, ...args);
    }
    return pipe.transform(value, ...args);
};

function evaluate(ast, s: EvalState) {
    if (isImplicit(ast)) {
        return s.scope;
    }
    if (ast instanceof LiteralPrimitive) {
        return ast.value;
    }
    if (ast instanceof PropertyRead) {
        const r = evaluate(ast.receiver, s);
        return r && r[checkMember(ast.name)];
    }
    if (ast instanceof SafePropertyRead) {
        const r = evaluate(ast.receiver, s);
        return r == null ? undefined : r[checkMember(ast.name)];
    }
    if (ast instanceof KeyedRead) {
        const k = evaluate(ast.key, s);
        const o = evaluate(ast.receiver, s);
        return o && o[checkMember(k)];
    }
    if (ast instanceof SafeKeyedRead) {
        const k = evaluate(ast.key, s);
        const o = evaluate(ast.receiver, s);
        return o == null ? undefined : o[checkMember(k)];
    }
    if (ast instanceof Call || ast instanceof SafeCall) {
        return evaluateCall(ast, s);
    }
    if (ast instanceof PrefixNot) {
        return !evaluate(ast.expression, s);
    }
    // Unary extends Binary, so it has to be checked first
    if (ast instanceof Unary) {
        const v = evaluate(ast.expr, s);
        return ast.operator === '-' ? -v : +v;
    }
    if (ast instanceof Binary) {
        return evaluateBinary(ast, s);
    }
    if (ast instanceof Conditional) {
        return evaluate(ast.condition, s) ? evaluate(ast.trueExp, s) : evaluate(ast.falseExp, s);
    }
    if (ast instanceof ParenthesizedExpression || ast instanceof NonNullAssert) {
        return evaluate(ast.expression, s);
    }
    if (ast instanceof LiteralArray) {
        const result = [];
        for (const item of ast.expressions) {
            if (item instanceof SpreadElement) {
                result.push(...evaluate(item.expression, s));
            } else {
                result.push(evaluate(item, s));
            }
        }
        return result;
    }
    if (ast instanceof LiteralMap) {
        const result = {};
        ast.keys.forEach((k, i) => {
            const value = evaluate(ast.values[i], s);
            if (k.kind === 'spread') {
                Object.assign(result, value);
            } else {
                result[checkMember(k.key, true)] = value;
            }
        });
        return result;
    }
    if (ast instanceof BindingPipe) {
        return evaluatePipe(ast, s);
    }
    if (ast instanceof Chain) {
        // same as the generated code: every statement runs, the first one's value is returned
        const results = ast.expressions.map(e => evaluate(e, s));
        return results[0];
    }
    if (ast instanceof TemplateLiteral) {
        return evaluateTemplate(ast, s);
    }
    if (ast instanceof TaggedTemplateLiteral) {
        return evaluateTaggedTemplate(ast, s);
    }
    if (ast instanceof TypeofExpression) {
        return typeof evaluate(ast.expression, s);
    }
    if (ast instanceof VoidExpression) {
        evaluate(ast.expression, s);
        return undefined;
    }
    if (ast instanceof RegularExpressionLiteral) {
        return new RegExp(ast.body, ast.flags ?? undefined);
    }
    throw new Error(`Unsupported expression syntax: ${ast?.constructor?.name}`);
}

/**
 * Builds an evaluator for the expression that interprets its AST on every call, without eval.
 * Returns noop for an expression with syntax errors, like the compiled path does.
 */
const interpretExpr = (expr: string, exprType: ExpressionType) => {
    const parser = new Parser(new Lexer);
    const span = createParseSourceSpan(expr);
    const parsed = exprType === ExpressionType.Binding ? parser.parseBinding(expr, span, 0) : parser.parseAction(expr, span, 0);
    if (parsed.errors.length) {
        return noop;
    }
    const ast = parsed.ast;
    const pipes: PipeState = {
        cache: new Map(),
        instances: new Map(),
        isPure: exprType === ExpressionType.Binding ? pipeProvider.getPipeNameVsIsPureMap() : new Map()
    };
    return (ctx?, locals?) => {
        const scope = Object.assign({}, locals);
        Object.setPrototypeOf(scope, ctx);
        return evaluate(ast, { ctx, locals, scope, pipes });
    };
};

const nullPipe = () => {
    return {
        transform: noop
    };
};

let _cspEnabled;
// whether a Content-Security-Policy blocks eval / new Function (detected once)
export const isCSPEnabled = () => {
    if(typeof _cspEnabled !== 'undefined') {
        return _cspEnabled;
    }
    try {
        new Function();
        _cspEnabled = false;
    } catch(e) {
        _cspEnabled = true;
    }
    return _cspEnabled;
};

let pipeProvider;

export function setPipeProvider(_pipeProvider) {
    pipeProvider = _pipeProvider;
}

enum ExpressionType {
    Binding,
    Action
}

export function $parseExpr(expr: string, defOnly?: boolean): ParseExprResult {

    if (!pipeProvider) {
        return noop;
    }

    if (typeof (expr) !== 'string') {
        return noop;
    }

    expr = expr.trim();

    if (expr.endsWith(';')) {
        expr = expr.slice(0, -1); // remove the trailing semicolon
    }

    if (!expr.length) {
        return noop;
    }

    let fn = exprFnCache.get(expr);

    if (fn) {
        return fn;
    }

    let boundFn;
    if (!defOnly) {
        boundFn = getFnForBindExpr(expr);
    }

    // not pre-compiled by codegen: build the function at runtime
    if (!boundFn) {
        // CSP blocks `new Function`, so interpret the expression instead of compiling it.
        // e.g. bindings of WM widgets used inside a component (wmAnchor in nav.comp.html) or runtime-only expressions.
        // defOnly asks for the generated source (used by codegen), which needs no eval, so it still uses the compiler.
        if (!defOnly && isCSPEnabled()) {
            boundFn = interpretExpr(expr, ExpressionType.Binding);
        } else {
            const parser = new Parser(new Lexer);
            const ast = parser.parseBinding(expr, createParseSourceSpan(expr), 0);

            if (ast.errors.length) {
                fn = noop;
                boundFn = fn;
            } else {
                const pipeNameVsIsPureMap = pipeProvider.getPipeNameVsIsPureMap();
                const astCompiler = new ASTCompiler(ast.ast, ExpressionType.Binding, pipeNameVsIsPureMap);
                fn = astCompiler.compile(defOnly);
                if (defOnly) {
                    return fn;
                }

                if (fn.usedPipes.length) {
                    const pipeArgs = [];
                    let hasPurePipe = false;
                    for (const [pipeName] of fn.usedPipes) {
                        const pipeInfo = pipeProvider.meta(pipeName);
                        let pipeInstance;
                        if (!pipeInfo) {
                            pipeInstance = nullPipe();
                        } else {
                            if (pipeInfo.pure) {
                                hasPurePipe = true;
                                pipeInstance = purePipes.get(pipeName);
                            }

                            if (!pipeInstance) {
                                pipeInstance = pipeProvider.getInstance(pipeName);
                            }

                            if (pipeInfo.pure) {
                                purePipes.set(pipeName, pipeInstance);
                            }
                        }
                        pipeArgs.push(pipeInstance);
                    }

                    pipeArgs.unshift(hasPurePipe ? new Map() : undefined);
                    boundFn = fn.bind(undefined, ...pipeArgs);
                } else {
                    boundFn = fn.bind(undefined, undefined);
                }
            }
        }
    }

    exprFnCache.set(expr, boundFn);

    return boundFn;
}

export function $parseEvent(expr, defOnly?): ParseExprResult {
    if (typeof (expr) !== 'string') {
        return noop;
    }

    expr = expr.trim();

    if (!expr.length) {
        return noop;
    }

    let fn = eventFnCache.get(expr);

    if (fn) {
        return fn;
    }

    if (!defOnly) {
        fn = getFnForEventExpr(expr);
    }

    // not pre-compiled by codegen: build the function at runtime
    if(!fn) {
        // CSP blocks `new Function`, so interpret the action instead of compiling it
        if (!defOnly && isCSPEnabled()) {
            fn = interpretExpr(expr, ExpressionType.Action);
        } else {
            const parser = new Parser(new Lexer);
            const ast = parser.parseAction(expr, createParseSourceSpan(expr), 0);

            if (ast.errors.length) {
                return noop;
            }
            const astCompiler = new ASTCompiler(ast.ast, ExpressionType.Action);
            fn = astCompiler.compile(defOnly);
        }
    }

    eventFnCache.set(expr, fn);
    return fn;
}

const fnNameMap = new Map();

export const registerFnByExpr = (expr, fn, usedPipes?) => {
    fn.usedPipes = usedPipes || [];
    fnNameMap.set(expr, fn);
}

export const getFnByExpr = (expr) => fnNameMap.get(expr)

const fnExecutor = (expr, exprType) => {
    let fn = getFnByExpr(expr);
    if (!fn) {
        return;
    }
    const usedPipes = fn.usedPipes || [];

    if(exprType === ExpressionType.Binding) {
        fn = fn.bind(undefined, plus, minus, isDef, getPurePipeVal);
    } else {
        fn = fn.bind(undefined, plus, minus, isDef);
    }

    if (usedPipes.length) {
        const pipeArgs = [];
        let hasPurePipe = false;
        for (const [pipeName] of usedPipes) {
            const pipeInfo = pipeProvider.meta(pipeName);
            let pipeInstance;
            if (!pipeInfo) {
                pipeInstance = nullPipe();
            } else {
                if (pipeInfo.pure) {
                    hasPurePipe = true;
                    pipeInstance = purePipes.get(pipeName);
                }

                if (!pipeInstance) {
                    pipeInstance = pipeProvider.getInstance(pipeName);
                }

                if (pipeInfo.pure) {
                    purePipes.set(pipeName, pipeInstance);
                }
            }
            pipeArgs.push(pipeInstance);
        }

        pipeArgs.unshift(hasPurePipe ? new Map() : undefined);
        fn = fn.bind(undefined, ...pipeArgs);
    } else 
        if (exprType === ExpressionType.Binding) {
            fn = fn.bind(undefined, undefined);
        }
    

    return fn;
}

export const getFnForBindExpr = (expr) => {
    return fnExecutor(expr, ExpressionType.Binding);
}

export const getFnForEventExpr = (expr) => {
    return fnExecutor(expr, ExpressionType.Action);
}
