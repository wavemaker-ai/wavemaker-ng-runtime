import { $parseEvent, $parseExpr, setPipeProvider } from './expression-parser';

describe('expression-parser (more)', () => {
    beforeAll(() => {
        setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map(),
            meta: () => undefined,
            getInstance: () => ({ transform: (v: any) => v })
        } as any);
    });

    it('escapes non alphanumeric characters in string literals and preserves their value', () => {
        const fn: any = $parseExpr(`'a-b.c"e' + x`);
        expect(fn({ x: '!' })).toBe('a-b.c"e!');
    });

    it('keeps spaces and alphanumerics in string literals unescaped', () => {
        expect(($parseExpr(`'hello World 1'`) as any)({})).toBe('hello World 1');
    });

    it('handles unicode and newline characters in literals', () => {
        expect(($parseExpr(`'é\\n'`) as any)({})).toBe('é\n');
    });

    it('$parseEvent returns the cached compiled function for the same expression', () => {
        const first = $parseEvent('cachedAction()');
        const second = $parseEvent('  cachedAction()  ');
        expect(second).toBe(first);
        const ctx = { cachedAction: jest.fn() };
        (second as any)(ctx);
        expect(ctx.cachedAction).toHaveBeenCalledTimes(1);
    });

    it('$parseEvent returns the same noop for non-string / empty expressions', () => {
        const a = $parseEvent(undefined as any);
        const b = $parseEvent('   ');
        expect(a).toBe(b);
        expect((a as any)({})).toBeUndefined();
    });
});
