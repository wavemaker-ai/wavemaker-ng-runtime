import {
    $parseExpr,
    $parseEvent,
    setPipeProvider,
    registerFnByExpr,
    getFnByExpr,
    getFnForBindExpr,
    getFnForEventExpr
} from './expression-parser';

describe('expression-parser', () => {

    describe('before a pipeProvider is registered', () => {
        it('$parseExpr returns a no-op function', () => {
            const fn = $parseExpr('foo');
            expect(fn({ foo: 'bar' })).toBeUndefined();
        });
    });

    describe('with a pipeProvider registered', () => {
        const pipeMeta = new Map([
            ['uppercase', true],
            ['logCalls', false]
        ]);

        beforeAll(() => {
            setPipeProvider({
                getPipeNameVsIsPureMap: () => pipeMeta,
                meta: (name: string) => (pipeMeta.has(name) ? { pure: pipeMeta.get(name) } : undefined),
                getInstance: (name: string) => {
                    if (name === 'uppercase') {
                        return { transform: (v: any) => String(v).toUpperCase() };
                    }
                    return { transform: (v: any) => v };
                }
            });
        });

        describe('$parseExpr - input validation', () => {
            it('returns a no-op for a non-string expression', () => {
                expect($parseExpr(42 as any)({})).toBeUndefined();
            });
            it('returns a no-op for an empty/whitespace expression', () => {
                expect($parseExpr('   ')({})).toBeUndefined();
            });
        });

        describe('$parseExpr - property access', () => {
            it('reads a simple property from the context', () => {
                expect($parseExpr('name')({ name: 'wm' })).toBe('wm');
            });
            it('reads a nested property, short-circuiting on a missing parent', () => {
                expect($parseExpr('address.city')({ address: { city: 'NYC' } })).toBe('NYC');
                expect($parseExpr('address.city')({})).toBeUndefined();
            });
            it('reads a keyed (array/bracket) property', () => {
                expect($parseExpr('list[1]')({ list: ['a', 'b', 'c'] })).toBe('b');
                expect($parseExpr("obj['key']")({ obj: { key: 'value' } })).toBe('value');
            });
            it('strips a trailing semicolon before evaluating', () => {
                expect($parseExpr('name;')({ name: 'wm' })).toBe('wm');
            });
            it('caches the compiled function for repeated calls with the same expression', () => {
                const fn1 = $parseExpr('name');
                const fn2 = $parseExpr('name');
                expect(fn1).toBe(fn2);
            });
        });

        describe('$parseExpr - literals', () => {
            it('evaluates a literal array expression', () => {
                expect($parseExpr('[1, 2, a]')({ a: 3 })).toEqual([1, 2, 3]);
            });
            it('evaluates a literal map expression', () => {
                expect($parseExpr('{x: a, y: 2}')({ a: 1 })).toEqual({ x: 1, y: 2 });
            });
            it('evaluates a literal string with special characters escaped', () => {
                expect($parseExpr('"hello world"')({})).toBe('hello world');
            });
        });

        describe('$parseExpr - operators', () => {
            it('adds two numeric properties', () => {
                expect($parseExpr('a + b')({ a: 2, b: 3 })).toBe(5);
            });
            it('treats + as concatenation-or-passthrough when one side is undefined', () => {
                expect($parseExpr('a + b')({ a: 2 })).toBe(2);
                expect($parseExpr('a + b')({ b: 3 })).toBe(3);
            });
            it('subtracts, defaulting missing operands to 0', () => {
                expect($parseExpr('a - b')({ a: 5, b: 2 })).toBe(3);
                expect($parseExpr('a - b')({ a: 5 })).toBe(5);
            });
            it('evaluates a default binary comparison operator', () => {
                expect($parseExpr('a > b')({ a: 5, b: 2 })).toBe(true);
                expect($parseExpr('a === b')({ a: 5, b: 5 })).toBe(true);
            });
            it('short-circuits a logical AND expression', () => {
                expect($parseExpr('a && b')({ a: true, b: 'yes' })).toBe('yes');
                expect($parseExpr('a && b')({ a: false, b: 'yes' })).toBe(false);
            });
            it('short-circuits a logical OR expression', () => {
                expect($parseExpr('a || b')({ a: 'first', b: 'second' })).toBe('first');
                expect($parseExpr('a || b')({ a: false, b: 'second' })).toBe('second');
            });
            it('evaluates a unary minus expression', () => {
                expect($parseExpr('-a')({ a: 5 })).toBe(-5);
            });
            it('evaluates a logical negation (prefix not) expression', () => {
                expect($parseExpr('!a')({ a: false })).toBe(true);
                expect($parseExpr('!a')({ a: true })).toBe(false);
            });
            it('evaluates a parenthesized expression', () => {
                expect($parseExpr('(a + b) * 2')({ a: 1, b: 2 })).toBe(6);
            });
            it('evaluates a conditional (ternary) expression', () => {
                expect($parseExpr('a > 5 ? "big" : "small"')({ a: 10 })).toBe('big');
                expect($parseExpr('a > 5 ? "big" : "small"')({ a: 1 })).toBe('small');
            });
        });

        describe('$parseExpr - method calls', () => {
            it('calls a method on the implicit context receiver', () => {
                const ctx = { greet: (name: string) => `hi ${name}` };
                expect($parseExpr('greet("wm")')(ctx)).toBe('hi wm');
            });
            it('calls a method on a nested property receiver, bound to that receiver', () => {
                const ctx = {
                    util: {
                        prefix: 'x-',
                        withPrefix(v: string) { return this.prefix + v; }
                    }
                };
                expect($parseExpr('util.withPrefix("a")')(ctx)).toBe('x-a');
            });
        });

        describe('$parseExpr - pipes', () => {
            it('applies a pure pipe to the expression result', () => {
                expect($parseExpr('name | uppercase')({ name: 'wm' })).toBe('WM');
            });
            it('falls back to a null pipe (no-op transform) for an unregistered pipe name', () => {
                expect($parseExpr('name | missingPipe')({ name: 'wm' })).toBeUndefined();
            });
        });

        describe('$parseExpr - defOnly mode', () => {
            it('returns a definition object with fnBody/fnArgs/pipes instead of a bound function', () => {
                const def: any = $parseExpr('x1 + y1', true);
                expect(typeof def.fnBody).toBe('string');
                expect(typeof def.fnArgs).toBe('string');
                expect(Array.isArray(def.pipes)).toBe(true);
            });
        });

        describe('$parseEvent', () => {
            it('returns a no-op for a non-string or empty expression', () => {
                expect($parseEvent(1 as any)({})).toBeUndefined();
                expect($parseEvent('')({})).toBeUndefined();
            });

            it('invokes a method call action against the context', () => {
                const ctx = { calls: [] as any[], onClick: (v: any) => ctx.calls.push(v) };
                $parseEvent('onClick(1)')(ctx);
                expect(ctx.calls).toEqual([1]);
            });

            it('evaluates a chain of statements in order', () => {
                const ctx = { calls: [] as any[], a: (v: any) => ctx.calls.push('a' + v), b: (v: any) => ctx.calls.push('b' + v) };
                $parseEvent('a(1); b(2)')(ctx);
                expect(ctx.calls).toEqual(['a1', 'b2']);
            });
        });

        describe('registerFnByExpr / getFnByExpr / getFnForBindExpr / getFnForEventExpr', () => {
            it('defaults usedPipes to an empty array when not provided', () => {
                const fn: any = () => {};
                registerFnByExpr('storedExpr', fn);
                expect(getFnByExpr('storedExpr')).toBe(fn);
                expect(fn.usedPipes).toEqual([]);
            });

            it('$parseExpr uses a pre-registered binding function instead of compiling one', () => {
                const rawFn = function (_plus: any, _minus: any, _isDef: any, _getPPVal: any, _ppc: any, _ctx: any) {
                    return _ctx.value + 1;
                };
                registerFnByExpr('preRegisteredBindingExpr', rawFn);
                const fn = $parseExpr('preRegisteredBindingExpr');
                expect(fn({ value: 41 })).toBe(42);
            });

            it('$parseEvent uses a pre-registered action function instead of compiling one', () => {
                const rawFn = function (_plus: any, _minus: any, _isDef: any, _ctx: any) {
                    _ctx.invoked = true;
                };
                registerFnByExpr('preRegisteredEventExpr', rawFn);
                const ctx: any = {};
                $parseEvent('preRegisteredEventExpr')(ctx);
                expect(ctx.invoked).toBe(true);
            });

            it('getFnForBindExpr/getFnForEventExpr return undefined for an unregistered expression', () => {
                expect(getFnForBindExpr('neverRegistered')).toBeUndefined();
                expect(getFnForEventExpr('neverRegistered')).toBeUndefined();
            });
        });
    });
});

describe('expression-parser - pure pipe caching', () => {
    let transformCalls: number;

    beforeAll(() => {
        setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map([['countPure', true], ['countImpure', false]]),
            meta: (name: string) => (name === 'countPure' ? { pure: true } : name === 'countImpure' ? { pure: false } : undefined),
            getInstance: () => ({
                transform: (...args: any[]) => {
                    transformCalls++;
                    return args.join('|');
                }
            })
        });
    });

    beforeEach(() => {
        transformCalls = 0;
    });

    // `<root> | countPure:a1:a2...` has (argCount + 1) pipe arguments in total.
    // $parseExpr caches the compiled function (and its pure pipe cache) per expression,
    // so every test uses its own root variable name to start from an empty cache.
    const argNames = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'];
    let uid = 0;
    const setup = (count: number) => {
        const root = `root${++uid}`;
        const expr = `${root} | countPure${argNames.slice(0, count).map((n) => ':' + n).join('')}`;
        const buildCtx = (overrides: any = {}) => {
            const ctx: any = { [root]: 'v' };
            argNames.slice(0, count).forEach((n, i) => (ctx[n] = i));
            return Object.assign(ctx, overrides);
        };
        return { fn: $parseExpr(expr), root, buildCtx };
    };

    for (let extra = 0; extra <= 9; extra++) {
        const total = extra + 1;

        it(`re-uses the cached result for ${total} pipe argument(s) while they are unchanged`, () => {
            const { fn, buildCtx } = setup(extra);
            fn(buildCtx());
            fn(buildCtx());
            expect(transformCalls).toBe(1);
        });

        it(`re-runs the pipe for ${total} pipe argument(s) when the first one changes`, () => {
            const { fn, root, buildCtx } = setup(extra);
            fn(buildCtx());
            fn(buildCtx({ [root]: 'changed' }));
            expect(transformCalls).toBe(2);
        });

        if (extra > 0) {
            it(`re-runs the pipe for ${total} pipe argument(s) when the last one changes`, () => {
                const { fn, buildCtx } = setup(extra);
                fn(buildCtx());
                fn(buildCtx({ [argNames[extra - 1]]: 'changed' }));
                expect(transformCalls).toBe(2);
            });
        }
    }

    it('always re-runs the pipe when it has more than 10 arguments', () => {
        const expr = 'v | countPure:a1:a2:a3:a4:a5:a6:a7:a8:a9:a10:a11';
        const fn = $parseExpr(expr);
        const ctx = { v: 1, a1: 1, a2: 1, a3: 1, a4: 1, a5: 1, a6: 1, a7: 1, a8: 1, a9: 1, a10: 1, a11: 1 };
        fn(ctx);
        fn(ctx);
        expect(transformCalls).toBe(2);
    });

    it('treats NaN as unchanged but object arguments as always changed', () => {
        const nanFn = $parseExpr('nanVal | countPure');
        nanFn({ nanVal: NaN });
        nanFn({ nanVal: NaN });
        expect(transformCalls).toBe(1);

        transformCalls = 0;
        const objFn = $parseExpr('objVal | countPure');
        const obj = { a: 1 };
        objFn({ objVal: obj });
        objFn({ objVal: obj });
        expect(transformCalls).toBe(2);
    });

    it('never caches an impure pipe', () => {
        const fn = $parseExpr('v | countImpure');
        fn({ v: 1 });
        fn({ v: 1 });
        expect(transformCalls).toBe(2);
    });
});

describe('expression-parser - invalid expressions', () => {
    beforeAll(() => {
        setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map(),
            meta: () => undefined,
            getInstance: () => ({ transform: (v: any) => v })
        });
    });

    it('$parseExpr returns a no-op for an expression with syntax errors', () => {
        expect($parseExpr('a +* b')({ a: 1, b: 2 })).toBeUndefined();
    });

    it('$parseEvent returns a no-op for an action with syntax errors', () => {
        const ctx = { called: false };
        expect($parseEvent('foo(')(ctx)).toBeUndefined();
        expect(ctx.called).toBe(false);
    });
});

describe('expression-parser - registered functions with pipes', () => {
    beforeAll(() => {
        setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map(),
            meta: (name: string) => {
                if (name === 'regPure') {
                    return { pure: true };
                }
                if (name === 'regImpure') {
                    return { pure: false };
                }
                return undefined;
            },
            getInstance: (name: string) => ({ transform: (v: any) => `${name}:${v}` })
        });
    });

    it('binds pure, impure and unknown pipes into a registered binding function', () => {
        const raw = function (_plus: any, _minus: any, _isDef: any, _getPPVal: any, _ppc: any, pure: any, impure: any, unknown: any, ctx: any) {
            return [_ppc instanceof Map, pure.transform(ctx.v), impure.transform(ctx.v), unknown.transform(ctx.v)];
        };
        registerFnByExpr('regBind', raw, [['regPure', '_p0'], ['regImpure', '_p1'], ['regMissing', '_p2']]);

        const result = getFnForBindExpr('regBind')({ v: 1 });

        expect(result[0]).toBe(true);
        expect(result[1]).toBe('regPure:1');
        expect(result[2]).toBe('regImpure:1');
        expect(result[3]).toBeUndefined();
    });

    it('does not create a pure pipe cache map when only impure pipes are used', () => {
        const raw = function (_plus: any, _minus: any, _isDef: any, _getPPVal: any, _ppc: any, impure: any, ctx: any) {
            return [_ppc, impure.transform(ctx.v)];
        };
        registerFnByExpr('regBindImpure', raw, [['regImpure', '_p0']]);
        expect(getFnForBindExpr('regBindImpure')({ v: 2 })).toEqual([undefined, 'regImpure:2']);
    });

    it('binds pipes into a registered action function without the pure pipe helper', () => {
        const raw = function (_plus: any, _minus: any, _isDef: any, _ppc: any, pure: any, ctx: any) {
            ctx.out = pure.transform(ctx.v);
        };
        registerFnByExpr('regAction', raw, [['regPure', '_p0']]);
        const ctx: any = { v: 3 };
        getFnForEventExpr('regAction')(ctx);
        expect(ctx.out).toBe('regPure:3');
    });

    it('re-uses the same pure pipe instance across registered functions', () => {
        const seen: any[] = [];
        const raw = function (_plus: any, _minus: any, _isDef: any, _getPPVal: any, _ppc: any, pure: any) {
            seen.push(pure);
        };
        registerFnByExpr('regShare1', raw, [['regPure', '_p0']]);
        registerFnByExpr('regShare2', raw, [['regPure', '_p0']]);
        getFnForBindExpr('regShare1')({});
        getFnForBindExpr('regShare2')({});
        expect(seen[0]).toBe(seen[1]);
    });
});

describe('expression-parser - CSP enabled', () => {
    let parser: any;
    const originalFunction = (global as any).Function;

    beforeAll(() => {
        jest.isolateModules(() => {
            parser = require('./expression-parser');
        });
        parser.setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map(),
            meta: () => undefined,
            getInstance: () => ({ transform: (v: any) => v })
        });
        // simulate a Content-Security-Policy that blocks `new Function()`
        (global as any).Function = function () {
            throw new Error('CSP blocks Function constructor');
        };
    });

    afterAll(() => {
        (global as any).Function = originalFunction;
    });

    it('evaluates bind expressions through lodash get, using locals before the context', () => {
        const fn = parser.$parseExpr('user.name');
        expect(fn({ user: { name: 'ctx' } })).toBe('ctx');
        expect(fn({ user: { name: 'ctx' } }, { user: { name: 'local' } })).toBe('local');
    });

    it('evaluates a simple function call event with arguments resolved from the context', () => {
        const received: any[] = [];
        const ctx = {
            handler(...args: any[]) {
                received.push(args);
            },
            a: 1,
            b: 2
        };
        parser.$parseEvent('handler(a, b)')(ctx);
        expect(received).toEqual([[1, 2]]);
    });

    it('resolves event arguments from locals and binds the function to the merged context', () => {
        const ctx: any = {
            tag: 'ctx',
            handler(arg: any) {
                return `${this.tag}:${arg}`;
            }
        };
        expect(parser.$parseEvent('handler(item)')(ctx, { item: 'x', tag: 'local' })).toBe('local:x');
    });

    it('does nothing when the called function does not exist on the context', () => {
        expect(parser.$parseEvent('missing(a)')({ a: 1 })).toBeUndefined();
    });
});
