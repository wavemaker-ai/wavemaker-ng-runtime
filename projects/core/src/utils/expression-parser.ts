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
    Parser,
    PrefixNot,
    PropertyRead,
    PropertyWrite,
    Unary
} from '@angular/compiler';
import {get} from "lodash-es";

const isDef = v => v !== void 0;
const ifDef = (v, d) => v === void 0 ? d : v;
const plus = (a, b) => void 0 === a ? b : void 0 === b ? a : a + b;
const minus = (a, b) => ifDef(a, 0) - ifDef(b, 0);
const noop = () => {};

export type ParseExprResult = (data?: any, locals?: any) => any;

// CRITICAL FIX: Add size limits to prevent unbounded cache growth
// These caches can grow to thousands of entries in large, long-running SPAs
const MAX_EXPR_CACHE_SIZE = 500;
const MAX_EVENT_CACHE_SIZE = 300;
const MAX_PIPE_CACHE_SIZE = 50;

const exprFnCache = new Map();
const eventFnCache = new Map();
const purePipes = new Map();

// OPTIMIZATION: Performance monitoring - track cache hit rates
interface CacheStats {
    hits: number;
    misses: number;
    accessFrequency: Map<string, number>; // Track frequency of each entry
    lastAccessTime: Map<string, number>;  // Track recency of access
}

const exprCacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    accessFrequency: new Map(),
    lastAccessTime: new Map()
};

const eventCacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    accessFrequency: new Map(),
    lastAccessTime: new Map()
};

// OPTIMIZATION: Cache warming - frequently used expressions to pre-cache
const cacheWarmupList: string[] = [];
const MAX_WARMUP_SIZE = 50;

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

    processPropertyWrite() {
        const ast = this.cAst;
        const stmts = this.cStmts;
        let receiver, lhs;
        if (ast.receiver instanceof ImplicitReceiver) {
            lhs = `_ctx.${ast.name}`;
        } else {
            receiver = this.build(ast.receiver, stmts);
            lhs = `${receiver}${receiver.length ? '.' : ''}${ast.name}`;
        }

        const rhs = this.build(ast.value, stmts);
        stmts.push(`${lhs}=${rhs}`);
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
        } else if (ast instanceof PropertyWrite) {
            return this.processPropertyWrite();
        } else if (ast instanceof KeyedRead) {
            return this.processKeyedRead();
        } else if (ast instanceof PrefixNot) {
            return this.processPrefixNot();
        } else if (ast instanceof Unary) {
            return this.processUnary();
        } else if (ast instanceof Binary) {
            return this.processBinary();
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

const nullPipe = () => {
    return {
        transform: noop
    };
};

let _cspEnabled;
const isCSPEnabled = () => {
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

    // OPTIMIZATION: Track cache access for performance monitoring
    let fn = exprFnCache.get(expr);
    
    if (fn) {
        // Cache hit - update statistics
        exprCacheStats.hits++;
        const currentFreq = exprCacheStats.accessFrequency.get(expr) || 0;
        exprCacheStats.accessFrequency.set(expr, currentFreq + 1);
        exprCacheStats.lastAccessTime.set(expr, Date.now());
        return fn;
    }
    
    // Cache miss - update statistics
    exprCacheStats.misses++;

    let boundFn;
    if (!defOnly) {
        boundFn = getFnForBindExpr(expr);
    }

    // fallback to generate function in runtime. This will break if CSP is enabled
    if (!boundFn) {
        // If CSP enabled, function def not found from the generated fn expressions for the page.
        // Handle bind expressions used internally inside WM components. e.g. wmAnchor used inside nav.comp.html
        if (isCSPEnabled()) {
            boundFn = function(ctx, locals) {
                // handle internal bindings for wm widgets used inside a component
                let _ctx = Object.assign({}, locals);
                Object.setPrototypeOf(_ctx, ctx);
                return get(_ctx, expr);
            };
        } else {
            const parser = new Parser(new Lexer);
            const ast = parser.parseBinding(expr, '',0);

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
                            pipeInstance = nullPipe;
                        } else {
                            if (pipeInfo.pure) {
                                hasPurePipe = true;
                                pipeInstance = purePipes.get(pipeName);
                            }

                            if (!pipeInstance) {
                                pipeInstance = pipeProvider.getInstance(pipeName);
                            }

                            if (pipeInfo.pure) {
                                // CRITICAL FIX: Implement cache size limit for pure pipes
                                if (purePipes.size >= MAX_PIPE_CACHE_SIZE) {
                                    const firstKey = purePipes.keys().next().value;
                                    purePipes.delete(firstKey);
                                }
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

    // OPTIMIZATION: Progressive cache eviction based on access patterns
    // Evict least recently and least frequently used entries
    if (exprFnCache.size >= MAX_EXPR_CACHE_SIZE) {
        evictLeastUsedFromExprCache();
    }
    
    exprFnCache.set(expr, boundFn);
    
    // Track new entry
    exprCacheStats.accessFrequency.set(expr, 1);
    exprCacheStats.lastAccessTime.set(expr, Date.now());
    
    // Add to warmup list if frequently used
    if (cacheWarmupList.length < MAX_WARMUP_SIZE) {
        cacheWarmupList.push(expr);
    }

    return boundFn;
}

/**
 * OPTIMIZATION: Progressive eviction based on access frequency and recency
 * Evicts entries with lowest score: (frequency * weight) + (recency * weight)
 * This keeps frequently accessed expressions longer even if not recently used
 */
function evictLeastUsedFromExprCache() {
    if (exprFnCache.size === 0) return;
    
    const FREQUENCY_WEIGHT = 0.7; // Weight for access frequency
    const RECENCY_WEIGHT = 0.3;   // Weight for recency
    
    const now = Date.now();
    const ONE_HOUR = 3600000; // Normalize recency to hours
    
    let minScore = Infinity;
    let keyToEvict = null;
    
    // Calculate score for each cache entry
    exprFnCache.forEach((value, key) => {
        const frequency = exprCacheStats.accessFrequency.get(key) || 0;
        const lastAccess = exprCacheStats.lastAccessTime.get(key) || now;
        const recency = Math.max(0, now - lastAccess) / ONE_HOUR;
        
        // Lower is worse - we want to evict entries with lowest scores
        // Normalize: higher frequency = better, lower recency = better
        const frequencyScore = frequency * FREQUENCY_WEIGHT;
        const recencyScore = Math.max(0, 1 - recency) * RECENCY_WEIGHT; // Invert recency
        const totalScore = frequencyScore + recencyScore;
        
        if (totalScore < minScore) {
            minScore = totalScore;
            keyToEvict = key;
        }
    });
    
    if (keyToEvict) {
        exprFnCache.delete(keyToEvict);
        exprCacheStats.accessFrequency.delete(keyToEvict);
        exprCacheStats.lastAccessTime.delete(keyToEvict);
        console.warn(`Expression cache limit reached (${MAX_EXPR_CACHE_SIZE}). Evicted least used: ${keyToEvict}`);
    } else {
        // Fallback to simple LRU if no scores calculated
        const firstKey = exprFnCache.keys().next().value;
        exprFnCache.delete(firstKey);
        exprCacheStats.accessFrequency.delete(firstKey);
        exprCacheStats.lastAccessTime.delete(firstKey);
        console.warn(`Expression cache limit reached (${MAX_EXPR_CACHE_SIZE}). Evicted: ${firstKey}`);
    }
}

function simpleFunctionEvaluator(expr, ctx, locals) {
    let _ctx = Object.assign({}, locals);
    Object.setPrototypeOf(_ctx, ctx);

    let parts = expr.split('(');
    let fnName = parts[0];
    let computedFn = get(ctx, fnName);

    if (computedFn) {
        let args = parts[1].replace(')', '');
        args = args.split(',');
        let computedArgs = [];
        args.forEach((arg)=> {
            arg = arg && arg.trim();
            computedArgs.push(get(_ctx, arg));
        });
        return computedFn.bind(_ctx)(...computedArgs);
    }
}

export function $parseEvent(expr, defOnly?): ParseExprResult {
    if (typeof (expr) !== 'string') {
        return noop;
    }

    expr = expr.trim();

    if (!expr.length) {
        return noop;
    }

    // OPTIMIZATION: Track cache access for performance monitoring
    let fn = eventFnCache.get(expr);
    
    if (fn) {
        // Cache hit - update statistics
        eventCacheStats.hits++;
        const currentFreq = eventCacheStats.accessFrequency.get(expr) || 0;
        eventCacheStats.accessFrequency.set(expr, currentFreq + 1);
        eventCacheStats.lastAccessTime.set(expr, Date.now());
        return fn;
    }
    
    // Cache miss - update statistics
    eventCacheStats.misses++;

    if (!defOnly) {
        fn = getFnForEventExpr(expr);
    }

    // fallback to generate function in runtime. This will break if CSP is enabled
    if(!fn) {
        if (isCSPEnabled()) {
            fn = simpleFunctionEvaluator.bind(undefined, expr);
        } else {
            const parser = new Parser(new Lexer);
            const ast = parser.parseAction(expr, '', 0);

            if (ast.errors.length) {
                return noop;
            }
            const astCompiler = new ASTCompiler(ast.ast, ExpressionType.Action);
            fn = astCompiler.compile(defOnly);
        }
    }

    // OPTIMIZATION: Progressive cache eviction based on access patterns
    if (eventFnCache.size >= MAX_EVENT_CACHE_SIZE) {
        evictLeastUsedFromEventCache();
    }
    
    eventFnCache.set(expr, fn);
    
    // Track new entry
    eventCacheStats.accessFrequency.set(expr, 1);
    eventCacheStats.lastAccessTime.set(expr, Date.now());
    
    return fn;
}

/**
 * OPTIMIZATION: Progressive eviction for event cache
 */
function evictLeastUsedFromEventCache() {
    if (eventFnCache.size === 0) return;
    
    const FREQUENCY_WEIGHT = 0.7;
    const RECENCY_WEIGHT = 0.3;
    const now = Date.now();
    const ONE_HOUR = 3600000;
    
    let minScore = Infinity;
    let keyToEvict = null;
    
    eventFnCache.forEach((value, key) => {
        const frequency = eventCacheStats.accessFrequency.get(key) || 0;
        const lastAccess = eventCacheStats.lastAccessTime.get(key) || now;
        const recency = Math.max(0, now - lastAccess) / ONE_HOUR;
        
        const frequencyScore = frequency * FREQUENCY_WEIGHT;
        const recencyScore = Math.max(0, 1 - recency) * RECENCY_WEIGHT;
        const totalScore = frequencyScore + recencyScore;
        
        if (totalScore < minScore) {
            minScore = totalScore;
            keyToEvict = key;
        }
    });
    
    if (keyToEvict) {
        eventFnCache.delete(keyToEvict);
        eventCacheStats.accessFrequency.delete(keyToEvict);
        eventCacheStats.lastAccessTime.delete(keyToEvict);
        console.warn(`Event cache limit reached (${MAX_EVENT_CACHE_SIZE}). Evicted least used: ${keyToEvict}`);
    } else {
        const firstKey = eventFnCache.keys().next().value;
        eventFnCache.delete(firstKey);
        eventCacheStats.accessFrequency.delete(firstKey);
        eventCacheStats.lastAccessTime.delete(firstKey);
        console.warn(`Event cache limit reached (${MAX_EVENT_CACHE_SIZE}). Evicted: ${firstKey}`);
    }
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
                pipeInstance = nullPipe;
            } else {
                if (pipeInfo.pure) {
                    hasPurePipe = true;
                    pipeInstance = purePipes.get(pipeName);
                }

                if (!pipeInstance) {
                    pipeInstance = pipeProvider.getInstance(pipeName);
                }

                if (pipeInfo.pure) {
                    // CRITICAL FIX: Implement cache size limit for pure pipes
                    if (purePipes.size >= MAX_PIPE_CACHE_SIZE) {
                        const firstKey = purePipes.keys().next().value;
                        purePipes.delete(firstKey);
                    }
                    purePipes.set(pipeName, pipeInstance);
                }
            }
            pipeArgs.push(pipeInstance);
        }

        pipeArgs.unshift(hasPurePipe ? new Map() : undefined);
        fn = fn.bind(undefined, ...pipeArgs);
    } else {
        if (exprType === ExpressionType.Binding) {
            fn = fn.bind(undefined, undefined);
        }
    }

    return fn;
}

export const getFnForBindExpr = (expr) => {
    return fnExecutor(expr, ExpressionType.Binding);
}

export const getFnForEventExpr = (expr) => {
    return fnExecutor(expr, ExpressionType.Action);
}

/**
 * CRITICAL FIX: Utility functions to manage expression parser caches
 * These caches can grow unbounded in long-running SPAs
 */

/**
 * Clear all expression parser caches
 * Call this during major navigation events or when memory pressure is detected
 */
export const clearExpressionCaches = () => {
    const exprCount = exprFnCache.size;
    const eventCount = eventFnCache.size;
    const pipeCount = purePipes.size;
    const fnCount = fnNameMap.size;
    
    exprFnCache.clear();
    eventFnCache.clear();
    purePipes.clear();
    fnNameMap.clear();
    
    console.log(`Cleared expression caches: ${exprCount} expressions, ${eventCount} events, ${pipeCount} pipes, ${fnCount} registered functions`);
}

/**
 * Get current cache sizes for monitoring
 */
export const getExpressionCacheSizes = () => {
    return {
        exprFnCache: exprFnCache.size,
        eventFnCache: eventFnCache.size,
        purePipes: purePipes.size,
        fnNameMap: fnNameMap.size,
        total: exprFnCache.size + eventFnCache.size + purePipes.size + fnNameMap.size
    };
}

/**
 * OPTIMIZATION: Get cache hit rate statistics for performance monitoring
 */
export const getCacheHitRates = () => {
    const exprTotal = exprCacheStats.hits + exprCacheStats.misses;
    const eventTotal = eventCacheStats.hits + eventCacheStats.misses;
    
    return {
        expression: {
            hits: exprCacheStats.hits,
            misses: exprCacheStats.misses,
            total: exprTotal,
            hitRate: exprTotal > 0 ? (exprCacheStats.hits / exprTotal * 100).toFixed(2) + '%' : '0%',
            topExpressions: Array.from(exprCacheStats.accessFrequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([expr, freq]) => ({ expression: expr, frequency: freq }))
        },
        event: {
            hits: eventCacheStats.hits,
            misses: eventCacheStats.misses,
            total: eventTotal,
            hitRate: eventTotal > 0 ? (eventCacheStats.hits / eventTotal * 100).toFixed(2) + '%' : '0%',
            topEvents: Array.from(eventCacheStats.accessFrequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([expr, freq]) => ({ expression: expr, frequency: freq }))
        }
    };
};

/**
 * OPTIMIZATION: Reset cache statistics
 */
export const resetCacheStats = () => {
    exprCacheStats.hits = 0;
    exprCacheStats.misses = 0;
    exprCacheStats.accessFrequency.clear();
    exprCacheStats.lastAccessTime.clear();
    
    eventCacheStats.hits = 0;
    eventCacheStats.misses = 0;
    eventCacheStats.accessFrequency.clear();
    eventCacheStats.lastAccessTime.clear();
};

/**
 * OPTIMIZATION: Warm up cache with frequently used expressions
 * Call this during app initialization or after identifying hot expressions
 * @param expressions Array of expression strings to pre-cache
 */
export const warmupExpressionCache = (expressions: string[]) => {
    if (!Array.isArray(expressions)) {
        console.warn('warmupExpressionCache: expressions must be an array');
        return;
    }
    
    let warmed = 0;
    expressions.forEach(expr => {
        if (typeof expr === 'string' && expr.trim().length > 0) {
            try {
                // Parse and cache the expression
                $parseExpr(expr.trim());
                warmed++;
            } catch (e) {
                console.warn(`Failed to warmup expression: ${expr}`, e);
            }
        }
    });
    
    console.log(`Cache warmup: ${warmed} expressions cached`);
    return warmed;
};

/**
 * OPTIMIZATION: Get recommended expressions for cache warming
 * Returns most frequently used expressions from current usage patterns
 */
export const getRecommendedWarmupExpressions = (limit: number = 20): string[] => {
    const allFreqs = Array.from(exprCacheStats.accessFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    
    return allFreqs.map(([expr]) => expr);
};

/**
 * Expose cache size getters and performance monitoring for debugging
 */
if (typeof window !== 'undefined') {
    (window as any).getExpressionCacheSizes = getExpressionCacheSizes;
    (window as any).clearExpressionCaches = clearExpressionCaches;
    (window as any).getCacheHitRates = getCacheHitRates;
    (window as any).resetCacheStats = resetCacheStats;
    (window as any).warmupExpressionCache = warmupExpressionCache;
    (window as any).getRecommendedWarmupExpressions = getRecommendedWarmupExpressions;
}
