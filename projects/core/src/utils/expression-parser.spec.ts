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
