import { $parseEvent, $parseExpr, getFnForBindExpr, getFnForEventExpr, registerFnByExpr, setPipeProvider } from './expression-parser';

describe('expression-parser - cover branches', () => {
    beforeAll(() => {
        setPipeProvider({
            getPipeNameVsIsPureMap: () => new Map(),
            meta: () => undefined,
            getInstance: () => ({ transform: (v: any) => v })
        } as any);
    });

    it('hands the isDef helper to registered event functions', () => {
        registerFnByExpr('cover-isdef', (_plus: any, _minus: any, isDef: any) => [isDef(undefined), isDef(0), isDef(null)]);
        expect((getFnForEventExpr('cover-isdef') as any)()).toEqual([false, true, true]);
    });

    it('binds registered functions without pipe information', () => {
        const fn: any = jest.fn((...args: any[]) => args.length);
        registerFnByExpr('cover-nopipes', fn);
        fn.usedPipes = undefined;
        const bound: any = getFnForBindExpr('cover-nopipes');
        bound();
        expect(fn).toHaveBeenCalledTimes(1);
        // plus, minus, isDef, getPurePipeVal and the placeholder for the pipe cache
        expect(fn.mock.calls[0].length).toBe(5);
    });

    it('returns only the function definition when definitions were requested', () => {
        const def: any = $parseEvent('coverDefOnly()', true);
        expect(def.fnArgs).toContain('_ctx');
        expect(def.fnBody).toContain('coverDefOnly');
    });

    it.each(['a?.b', 'a!', 'typeof a', '`x${a}`', 'a?.b()'])('parses the less common syntax %s without throwing', (expr) => {
        expect(() => $parseExpr(expr)).not.toThrow();
    });
});
