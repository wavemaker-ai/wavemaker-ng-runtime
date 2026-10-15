jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(),
}));

import { $watch } from '@wm/core';
import { LazyLoadDirective } from './lazy-load.directive';

const createDirective = (opts: { lView?: any[]; app?: any; explicitContext?: any } = {}) => {
    const lView: any[] = opts.lView ?? new Array(16).fill(undefined);
    const app = opts.app ?? { name: 'mockApp' };
    const inj: any = { get: jest.fn().mockReturnValue(app), _lView: lView };
    const templateRef: any = {};
    const viewContainer: any = { createEmbeddedView: jest.fn().mockReturnValue({}) };
    const directive = new LazyLoadDirective(inj, templateRef, viewContainer, opts.explicitContext);
    return { directive, inj, app, templateRef, viewContainer };
};

describe('LazyLoadDirective', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should fall back to the injected App when the lView has no parent view', () => {
            const { directive, app } = createDirective();
            expect((directive as any).viewParent).toBe(app);
        });

        it('should use the parent scope derived from the lView when present', () => {
            const parentScope = { id: 'parent-scope' };
            const grandParentLView: any[] = [];
            grandParentLView[8] = parentScope;
            const lView: any[] = new Array(16).fill(undefined);
            lView[15] = grandParentLView;
            const { directive, app } = createDirective({ lView });
            expect((directive as any).viewParent).toBe(parentScope);
            expect((directive as any).viewParent).not.toBe(app);
        });

        it('should build the context from the lView local scope and any explicit context', () => {
            const lView: any[] = new Array(16).fill(undefined);
            lView[8] = { a: 1 };
            const { directive } = createDirective({ lView, explicitContext: { b: 2 } });
            expect((directive as any).context).toEqual({ a: 1, b: 2 });
        });

        it('should default to an empty context when there is no lView scope or explicit context', () => {
            const { directive } = createDirective();
            expect((directive as any).context).toEqual({});
        });
    });

    describe('lazyLoad setter', () => {
        it('should register a watch on the expression using the view parent and context', () => {
            const { directive } = createDirective();
            ($watch as jest.Mock).mockReturnValue(jest.fn());
            directive.lazyLoad = 'someExpr';
            expect($watch).toHaveBeenCalledWith(
                'someExpr',
                (directive as any).viewParent,
                (directive as any).context,
                expect.any(Function)
            );
        });

        it('should unsubscribe the previous watcher before registering a new one', () => {
            const { directive } = createDirective();
            const unsub1 = jest.fn();
            const unsub2 = jest.fn();
            ($watch as jest.Mock).mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);
            directive.lazyLoad = 'expr1';
            directive.lazyLoad = 'expr2';
            expect(unsub1).toHaveBeenCalled();
        });

        it('should tolerate the previous watcher unsubscribe function throwing', () => {
            const { directive } = createDirective();
            const throwingUnsub = jest.fn(() => { throw new Error('boom'); });
            ($watch as jest.Mock).mockReturnValueOnce(throwingUnsub).mockReturnValueOnce(jest.fn());
            directive.lazyLoad = 'expr1';
            expect(() => { directive.lazyLoad = 'expr2'; }).not.toThrow();
        });

        it('should create the embedded view and unsubscribe once the watched expression becomes truthy', () => {
            const { directive, templateRef, viewContainer } = createDirective();
            const unsub = jest.fn();
            ($watch as jest.Mock).mockReturnValue(unsub);
            directive.lazyLoad = 'someExpr';
            const listener = ($watch as jest.Mock).mock.calls[0][3];
            listener(true, false);
            expect(viewContainer.createEmbeddedView).toHaveBeenCalledWith(templateRef, (directive as any).context);
            expect(unsub).toHaveBeenCalled();
        });

        it('should not create the embedded view again on a subsequent truthy emission', () => {
            const { directive, viewContainer } = createDirective();
            ($watch as jest.Mock).mockReturnValue(jest.fn());
            directive.lazyLoad = 'someExpr';
            const listener = ($watch as jest.Mock).mock.calls[0][3];
            listener(true, false);
            listener(true, false);
            expect(viewContainer.createEmbeddedView).toHaveBeenCalledTimes(1);
        });

        it('should not create the embedded view for a falsy value', () => {
            const { directive, viewContainer } = createDirective();
            ($watch as jest.Mock).mockReturnValue(jest.fn());
            directive.lazyLoad = 'someExpr';
            const listener = ($watch as jest.Mock).mock.calls[0][3];
            listener(false, undefined);
            expect(viewContainer.createEmbeddedView).not.toHaveBeenCalled();
        });

        it('should tolerate the unsubscribe function throwing after creating the embedded view', () => {
            const { directive } = createDirective();
            const throwingUnsub = jest.fn(() => { throw new Error('boom'); });
            ($watch as jest.Mock).mockReturnValue(throwingUnsub);
            directive.lazyLoad = 'someExpr';
            const listener = ($watch as jest.Mock).mock.calls[0][3];
            expect(() => listener(true, false)).not.toThrow();
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe the active watcher', () => {
            const { directive } = createDirective();
            const unsub = jest.fn();
            ($watch as jest.Mock).mockReturnValue(unsub);
            directive.lazyLoad = 'someExpr';
            directive.ngOnDestroy();
            expect(unsub).toHaveBeenCalled();
        });

        it('should clear and null out the context object', () => {
            const lView: any[] = new Array(16).fill(undefined);
            lView[8] = { a: 1 };
            const { directive } = createDirective({ lView });
            directive.ngOnDestroy();
            expect((directive as any).context).toBeNull();
        });

        it('should null out the embedded view reference', () => {
            const { directive } = createDirective();
            ($watch as jest.Mock).mockReturnValue(jest.fn());
            directive.lazyLoad = 'someExpr';
            const listener = ($watch as jest.Mock).mock.calls[0][3];
            listener(true, false);
            directive.ngOnDestroy();
            expect((directive as any).embeddedView).toBeNull();
        });

        it('should not throw when nothing was ever set up', () => {
            const { directive } = createDirective();
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });

        it('should tolerate the unsubscribe function throwing', () => {
            const { directive } = createDirective();
            ($watch as jest.Mock).mockReturnValue(jest.fn(() => { throw new Error('boom'); }));
            directive.lazyLoad = 'someExpr';
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });
    });
});
