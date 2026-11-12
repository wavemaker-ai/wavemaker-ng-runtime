/**
 * The CSP-safe interpreter must give the same results as the compiled (`new Function`) path, so
 * that an app behaves the same with and without a Content-Security-Policy.
 *
 * Two isolated copies of the module are loaded: `compiled` detects no CSP and compiles expressions,
 * `interpreted` detects CSP (the Function constructor throws during its one-time detection probe)
 * and interprets them. Every case runs through both.
 */
describe('expression-parser - CSP interpreter', () => {
    let compiled: any;
    let interpreted: any;
    let transformCalls: number;

    const pipeMeta = new Map([['upper', true], ['suffix', false]]);
    const pipeProvider = {
        getPipeNameVsIsPureMap: () => pipeMeta,
        meta: (name: string) => (pipeMeta.has(name) ? { pure: pipeMeta.get(name) } : undefined),
        getInstance: (name: string) => ({
            transform: (v: any, ...args: any[]) => {
                transformCalls++;
                return name === 'upper' ? String(v).toUpperCase() : `${v}${args.join('')}`;
            }
        })
    };

    beforeAll(() => {
        jest.isolateModules(() => {
            compiled = require('./expression-parser');
        });
        jest.isolateModules(() => {
            interpreted = require('./expression-parser');
        });
        compiled.setPipeProvider(pipeProvider);
        interpreted.setPipeProvider(pipeProvider);

        // CSP detection runs once per module copy and is cached: warm up `compiled` normally,
        // then make `interpreted` see a blocked Function constructor.
        compiled.$parseExpr('warmUp')({});
        const originalFunction = (global as any).Function;
        (global as any).Function = function () {
            throw new EvalError('CSP blocks Function constructor');
        };
        try {
            interpreted.$parseExpr('warmUp')({});
        } finally {
            (global as any).Function = originalFunction;
        }
    });

    beforeEach(() => {
        transformCalls = 0;
    });

    const makeCtx = () => ({
        a: 5, b: 2, zero: 0, empty: '', nil: null, flag: true, off: false,
        name: 'wm', list: ['x', 'y', 'z'], key: 'k', obj: { k: 'v', inner: { deep: 1 } },
        user: { name: 'ctx-user', tag: 'user-tag', greet(p: string) { return `${p} ${this.name}`; } },
        tag: 'ctx-tag',
        whoAmI() { return this.tag; },
        add: (x: number, y: number) => x + y,
        echo: (...args: any[]) => args
    });

    const bindingCases: Array<[string, any?]> = [
        ['a'], ['obj.k'], ['obj.inner.deep'], ['obj.missing.deep'], ['missing'],
        ['nil.x'], ['zero.x'], ['empty.length'],
        ['list[1]'], ['obj[key]'], ['obj["k"]'], ['list[zero]'],
        ['"str"'], ["'it\\'s'"], ['"a\\"b"'], ['10'], ['true'], ['null'], ['undefined'],
        ['[1, a, "x"]'], ['{x: a, y: "y", z: obj.k}'], ['{a}'],
        ['a + b'], ['a + missing'], ['missing + b'], ['name + a'], ['a - b'], ['a - missing'], ['missing - b'],
        ['a * b'], ['a / b'], ['a % b'], ['a ** b'],
        ['a > b'], ['a < b'], ['a >= 5'], ['a <= 4'], ['a == "5"'], ['a === 5'], ['a != "5"'], ['a !== 5'],
        ['flag && name'], ['off && name'], ['zero && name'], ['empty && name'], ['nil && name'],
        ['flag || name'], ['off || name'], ['zero || "fallback"'],
        ['nil ?? "dflt"'], ['zero ?? "dflt"'],
        ['!flag'], ['!!name'], ['!missing'], ['-a'], ['+"3"'], ['-(a + b)'],
        ['(a + b) * 2'], ['a > 3 ? "big" : "small"'], ['off ? 1 : nil ? 2 : 3'],
        ['add(a, b)'], ['add(a, missing)'], ['echo()'], ['echo(1, "x", list)'],
        ['user.greet("hi")'], ['whoAmI()'], ['missingFn(a)'], ['obj["missingFn"]'],
        ['name | upper'], ['name | suffix:"-":a'], ['(name | upper) + "!"'], ['obj.k | upper'],
        ['item'], ['item.name'], ['add(item.n, a)'], ['$index + 1'], ['tag'], ['whoAmI()']
    ];

    const locals = { item: { name: 'local-item', n: 10 }, $index: 3, tag: 'local-tag' };

    describe.each(bindingCases)('binding %s', (expr) => {
        it('matches the compiled result (no locals)', () => {
            const expected = compiled.$parseExpr(expr)(makeCtx());
            expect(interpreted.$parseExpr(expr)(makeCtx())).toEqual(expected);
        });
        it('matches the compiled result (with locals)', () => {
            const expected = compiled.$parseExpr(expr)(makeCtx(), { ...locals });
            expect(interpreted.$parseExpr(expr)(makeCtx(), { ...locals })).toEqual(expected);
        });
    });

    const eventCases = [
        'whoAmI()', 'user.greet(name)', 'add(a, b)', 'echo(item, $index)', 'missingFn()',
        'record(1); record(2)', 'record(a); record(item.n); record($index)', 'flag && record("yes")', 'off || record("no")',
        'a > 3 ? record("big") : record("small")', 'obj.inner.deep'
    ];

    describe.each(eventCases)('event %s', (expr) => {
        it('matches the compiled result and side effects', () => {
            const run = (parser: any) => {
                const calls: any[] = [];
                const ctx: any = Object.assign(makeCtx(), { record(v: any) { calls.push([v, this === ctx]); return v; } });
                const result = parser.$parseEvent(expr)(ctx, { ...locals });
                return { result, calls };
            };
            expect(run(interpreted)).toEqual(run(compiled));
        });
    });

    it('calls methods on the implicit receiver with the original context, not the locals copy', () => {
        const ctx: any = { tag: 'ctx', set(v: any) { this.saved = v; } };
        interpreted.$parseEvent('set(item)')(ctx, { item: 7 });
        expect(ctx.saved).toBe(7);
    });

    it('returns a no-op for expressions with syntax errors', () => {
        expect(interpreted.$parseExpr('a +* b')({ a: 1 })).toBeUndefined();
        expect(interpreted.$parseEvent('foo(')({})).toBeUndefined();
    });

    it('caches the evaluator per expression', () => {
        expect(interpreted.$parseExpr('a + b + 1')).toBe(interpreted.$parseExpr('a + b + 1'));
    });

    it('still returns compiled source for defOnly (codegen), which needs no eval', () => {
        const def = interpreted.$parseExpr('x1 + y1', true);
        expect(typeof def.fnBody).toBe('string');
        expect(typeof def.fnArgs).toBe('string');
    });

    it('prefers a function pre-registered by codegen over interpreting', () => {
        interpreted.registerFnByExpr('preCompiledInCsp', function (_p: any, _m: any, _d: any, _g: any, _ppc: any, ctx: any) {
            return ctx.v * 10;
        });
        expect(interpreted.$parseExpr('preCompiledInCsp')({ v: 4 })).toBe(40);
    });

    describe('pipes', () => {
        it('caches a pure pipe result while its arguments are unchanged', () => {
            const fn = interpreted.$parseExpr('pureRoot | upper');
            fn({ pureRoot: 'a' });
            fn({ pureRoot: 'a' });
            expect(transformCalls).toBe(1);
            fn({ pureRoot: 'b' });
            expect(transformCalls).toBe(2);
        });
        it('re-runs an impure pipe every time', () => {
            const fn = interpreted.$parseExpr('impureRoot | suffix');
            fn({ impureRoot: 'a' });
            fn({ impureRoot: 'a' });
            expect(transformCalls).toBe(2);
        });
        it('treats an unregistered pipe as a no-op transform', () => {
            expect(interpreted.$parseExpr('name | notAPipe')({ name: 'wm' })).toBeUndefined();
        });
    });

    describe('syntax the compiler does not support', () => {
        it('evaluates safe navigation', () => {
            expect(interpreted.$parseExpr('nil?.x')({ nil: null })).toBeUndefined();
            expect(interpreted.$parseExpr('obj?.k')({ obj: { k: 1 } })).toBe(1);
            expect(interpreted.$parseExpr('nil?.[0]')({ nil: null })).toBeUndefined();
            expect(interpreted.$parseExpr('nil?.f()')({ nil: null })).toBeUndefined();
            expect(interpreted.$parseExpr('obj.f?.()')({ obj: {} })).toBeUndefined();
            expect(interpreted.$parseExpr('obj?.get(1)')({ obj: { v: 2, get(x: number) { return x + this.v; } } })).toBe(3);
        });
        it('evaluates template literals', () => {
            expect(interpreted.$parseExpr('`hi ${name}, ${a + 1}`')({ name: 'wm', a: 1 })).toBe('hi wm, 2');
            expect(interpreted.$parseExpr('tag`a${x}b`')({ x: 1, tag: (s: string[], v: any) => s.join('|') + v })).toBe('a|b1');
        });
        it('evaluates the `in` operator (the compiler emits `v0inv1` for it)', () => {
            expect(interpreted.$parseExpr('"k" in obj')({ obj: { k: 1 } })).toBe(true);
            expect(interpreted.$parseExpr('"x" in obj')({ obj: { k: 1 } })).toBe(false);
        });
        it('evaluates typeof, void, non-null assertion, `this`, spreads and regex literals', () => {
            expect(interpreted.$parseExpr('typeof a')({ a: 1 })).toBe('number');
            expect(interpreted.$parseExpr('void a')({ a: 1 })).toBeUndefined();
            expect(interpreted.$parseExpr('a!')({ a: 1 })).toBe(1);
            expect(interpreted.$parseExpr('this.a')({ a: 1 })).toBe(1);
            expect(interpreted.$parseExpr('[...list, 3]')({ list: [1, 2] })).toEqual([1, 2, 3]);
            expect(interpreted.$parseExpr('{...obj, b: 2}')({ obj: { a: 1 } })).toEqual({ a: 1, b: 2 });
            expect(interpreted.$parseExpr('/^w+m$/i.test(name)')({ name: 'WWM' })).toBe(true);
        });
    });

    describe('assignments in actions', () => {
        it('assigns to a context property', () => {
            const ctx: any = { x: 1 };
            interpreted.$parseEvent('x = 5')(ctx);
            expect(ctx.x).toBe(5);
        });
        it('assigns to nested and keyed properties', () => {
            const ctx: any = { obj: { list: [0, 0] }, i: 1 };
            interpreted.$parseEvent('obj.name = "wm"; obj.list[i] = 9')(ctx);
            expect(ctx.obj).toEqual({ name: 'wm', list: [0, 9] });
        });
        it('assigns to a local when the name is a local, otherwise to the context', () => {
            const ctx: any = {};
            const loc: any = { item: 1 };
            interpreted.$parseEvent('item = 2; other = 3')(ctx, loc);
            expect(loc.item).toBe(2);
            expect(ctx.other).toBe(3);
            expect(ctx.item).toBeUndefined();
        });
        it('supports compound and logical assignments', () => {
            const ctx: any = { n: 2, s: 'a', u: undefined, t: 'keep', f: 0 };
            interpreted.$parseEvent('n += 3; n *= 2; s += "b"; u ??= "set"; t ||= "no"; f ||= 7')(ctx);
            expect(ctx).toEqual({ n: 10, s: 'ab', u: 'set', t: 'keep', f: 7 });
        });
        it('throws when assigning to a property of null/undefined', () => {
            expect(() => interpreted.$parseEvent('missing.x = 1')({})).toThrow(TypeError);
        });
    });

    describe('sandboxing', () => {
        it('blocks reaching the Function constructor through `constructor`', () => {
            expect(() => interpreted.$parseExpr('name.constructor')({ name: 'wm' })).toThrow(/not allowed/);
            expect(() => interpreted.$parseExpr('fn.constructor("return 1")()')({ fn: () => 1 })).toThrow(/not allowed/);
            expect(() => interpreted.$parseExpr('obj["const" + "ructor"]')({ obj: {} })).toThrow(/not allowed/);
        });
        it('blocks prototype access and pollution', () => {
            expect(() => interpreted.$parseExpr('obj.__proto__')({ obj: {} })).toThrow(/not allowed/);
            expect(() => interpreted.$parseEvent('obj.__proto__.polluted = 1')({ obj: {} })).toThrow(/not allowed/);
            expect(() => interpreted.$parseEvent('Ctor.prototype = 1')({ Ctor: function () {} })).toThrow(/not allowed/);
            expect(() => interpreted.$parseExpr('{"__proto__": 1}')({})).toThrow(/not allowed/);
            expect(({} as any).polluted).toBeUndefined();
        });
        it('blocks calling Function or eval even when they are reachable from the context', () => {
            expect(() => interpreted.$parseExpr('F("return 1")')({ F: Function })).toThrow(/not allowed/);
            expect(() => interpreted.$parseExpr('win.eval("1")')({ win: globalThis })).toThrow(/not allowed/);
        });
        it('throws a TypeError when calling a non-function, like the compiled code', () => {
            expect(() => interpreted.$parseExpr('a()')({ a: 1 })).toThrow(TypeError);
        });
    });
});
