jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn()
}));

import { $watch } from '@wm/core';
import { PartialParamDirective, PartialParamHandlerDirective } from './partial-param.directive';

describe('PartialParam directives (cover)', () => {
    let widgetRef: any;
    let handler: PartialParamHandlerDirective;

    beforeEach(() => {
        widgetRef = {
            registerDestroyListener: jest.fn(),
            getViewParent: jest.fn().mockReturnValue('vp'),
            context: { ctx: 1 }
        };
        handler = new PartialParamHandlerDirective(widgetRef);
        ($watch as jest.Mock).mockReset();
    });

    describe('registerParams', () => {
        it('stores a static value and notifies the container', () => {
            const next = jest.spyOn(widgetRef.params$, 'next');
            handler.registerParams('a', 'v', undefined, 'string');
            expect(widgetRef.partialParams.a).toBe('v');
            expect(next).toHaveBeenCalledTimes(1);
            expect($watch).not.toHaveBeenCalled();
        });

        it('watches the bind expression when there is no static value and propagates changes', () => {
            const unwatch = jest.fn();
            let cb: Function;
            ($watch as jest.Mock).mockImplementation((expr, vp, ctx, fn) => { cb = fn; return unwatch; });
            const next = jest.spyOn(widgetRef.params$, 'next');
            handler.registerParams('b', '', 'Variables.x', 'string');
            expect($watch).toHaveBeenCalledWith('Variables.x', 'vp', widgetRef.context, expect.any(Function));
            expect(widgetRef.registerDestroyListener).toHaveBeenCalledWith(unwatch);
            expect(next).not.toHaveBeenCalled();
            cb('new');
            expect(widgetRef.partialParams.b).toBe('new');
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('PartialParamDirective', () => {
        it('registers its name/value/bind/type with the handler on init', () => {
            const provider: any = { registerParams: jest.fn() };
            const d = new PartialParamDirective('x.y', 'string', provider);
            d.name = 'n';
            d.value = 'val';
            d.ngOnInit();
            expect(provider.registerParams).toHaveBeenCalledWith('n', 'val', 'x.y', 'string');
        });
    });

    describe('ngOnDestroy', () => {
        it('completes params$ and clears partialParams and pageParams', () => {
            handler.registerParams('a', 'v', undefined, 'string');
            const params = widgetRef.partialParams;
            const complete = jest.spyOn(widgetRef.params$, 'complete');
            handler.ngOnDestroy();
            expect(complete).toHaveBeenCalled();
            expect(params).toEqual({});
            expect(widgetRef.partialParams).toBeNull();
            expect(widgetRef.pageParams).toBeNull();
        });

        it('skips cleanup of params$ and partialParams when they are absent', () => {
            widgetRef.params$ = null;
            widgetRef.partialParams = null;
            expect(() => handler.ngOnDestroy()).not.toThrow();
            expect(widgetRef.pageParams).toBeNull();
        });
    });
});
