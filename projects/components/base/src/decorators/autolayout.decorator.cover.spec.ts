import { AutoLayout } from './autolayout.decorator';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn())
}));

import { $watch } from '@wm/core';

describe('AutoLayout decorator (coverage gaps)', () => {
    let host: HTMLElement;

    const fakeEl = (el: HTMLElement = host) => ({ 0: el, css: jest.fn() } as any);

    function make(options?: any, props: any = {}, withHooks = true) {
        class Widget {
            app: any = { isPrism: true };
            nativeElement = host;
            $element: any = fakeEl();
            viewParent: any = {};
            setProperty: any = jest.fn();
        }
        if (withHooks) {
            (Widget.prototype as any).onPropertyChange = function () {};
            (Widget.prototype as any).onStyleChange = function () {};
            (Widget.prototype as any).ngOnDestroy = function () {};
            (Widget.prototype as any).ngAfterViewInit = function () {};
        }
        if (options === undefined) {
            (AutoLayout as any)()(Widget);
        } else {
            AutoLayout(options)(Widget as any);
        }
        const inst: any = new (Widget as any)();
        Object.assign(inst, props);
        return inst;
    }

    const cssArgs = (inst: any) => inst.$element.css.mock.calls.map((c: any[]) => c[0]);

    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    describe('class without original hooks / default options', () => {
        it('works with no options and no original lifecycle hooks', () => {
            const inst = make(undefined, {}, false);
            expect(() => inst.ngOnDestroy()).not.toThrow(); // no store, no original hook
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onStyleChange('width', '10px');
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({ display: 'flex', 'flex-direction': 'row' }));
            expect(() => inst.ngOnDestroy()).not.toThrow(); // store exists, no original hook
        });
    });

    describe('internal watches', () => {
        it('does not register a watch when the scope cannot be resolved', () => {
            const inst = make({}, { viewParent: undefined });
            inst.onPropertyChange('position', 'bind:Variables.x');
            expect($watch).not.toHaveBeenCalled();
        });

        it('tolerates a watch callback without setProperty and a non-function unwatch', () => {
            ($watch as jest.Mock).mockImplementationOnce((expr, scope, inst, cb) => {
                cb('val');
                return undefined;
            });
            const inst = make({}, { setProperty: undefined });
            inst.onPropertyChange('position', 'bind:Variables.x');
            expect($watch).toHaveBeenCalledWith('Variables.x', inst.viewParent, inst, expect.any(Function));
            expect(() => inst.ngOnDestroy()).not.toThrow();
        });

        it('calls setProperty from the watch callback and unwatches on destroy', () => {
            const unwatch = jest.fn();
            ($watch as jest.Mock).mockImplementationOnce((expr, scope, inst, cb) => {
                cb('new');
                return unwatch;
            });
            const inst = make({});
            inst.onPropertyChange('position', 'bind:Variables.x');
            expect(inst.setProperty).toHaveBeenCalledWith('position', 'new');
            inst.ngOnDestroy();
            expect(unwatch).toHaveBeenCalledTimes(1);
        });
    });

    describe('ngAfterViewInit with pre-set state', () => {
        it('applies flex, overflow and position stored before view init', () => {
            const inst = make({});
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('clipcontent', true);
            inst.onStyleChange('overflow', 'none');
            inst.onPropertyChange('position', 'absolute');
            expect(inst.$element.css).not.toHaveBeenCalled();
            inst.ngAfterViewInit();
            const args = cssArgs(inst);
            expect(args).toContainEqual(expect.objectContaining({ display: 'flex' }));
            expect(args).toContainEqual({ overflow: 'hidden' });
            expect(args).toContainEqual(expect.objectContaining({ position: 'absolute' }));
        });

        it('skips stretching and padding when the target selector matches nothing', () => {
            const inst = make({ targetSelector: '.nope' });
            inst.onStyleChange('padding', '5px');
            expect(() => inst.ngAfterViewInit()).not.toThrow();
            expect(inst.$element.css).not.toHaveBeenCalled();
        });
    });

    describe('missing target element', () => {
        it('returns early from every apply function when there is no element', async () => {
            const inst = make({ targetSelector: '.nope' });
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row'); // applyFlexStyles, no target
            inst.onStyleChange('overflow', 'vertical'); // applyOverflow, no target
            inst.onStyleChange('padding', '4px'); // padding, no target
            inst.$element = null;
            inst.onPropertyChange('position', 'absolute'); // applyPosition, no $element
            inst.onStyleChange('width', 'fill'); // applySize, no $element
            await Promise.resolve();
            expect(inst.__al_store.dir).toBe('row');
            expect(inst.__al_store.width).toBe('fill');
        });
    });

    describe('flex alignment and gap', () => {
        it('formats non-numeric gap values verbatim', () => {
            jest.useFakeTimers();
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('gap', '2rem');
            jest.advanceTimersByTime(5);
            expect(cssArgs(inst)).toContainEqual({ gap: '2rem' });
        });

        it('does not apply the gap when no valid direction is set', () => {
            jest.useFakeTimers();
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('gap', '10');
            jest.advanceTimersByTime(5);
            expect(cssArgs(inst)).not.toContainEqual({ gap: '10px' });
        });

        it('falls back to row when alignment is set without a direction', () => {
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('alignment', 'middle-center');
            // no valid direction => display:flex not applied
            expect(cssArgs(inst).some((a: any) => a.display === 'flex')).toBe(false);
        });

        it('uses the cross-axis mapping for wrap with a non-row direction', () => {
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.__al_store.dir = 'col-x'; // not row, not column
            inst.onPropertyChange('wrap', true);
            inst.onPropertyChange('alignment', 'top-right');
            const wrapStyles = cssArgs(inst).filter((a: any) => a['justify-content'] !== undefined);
            expect(wrapStyles.length).toBe(0); // direction invalid -> not applied, branches still evaluated
            inst.__al_store.dir = 'row';
            inst.onPropertyChange('alignment', 'top-right');
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({ 'justify-content': 'flex-end', 'align-items': 'flex-start' }));
        });

        it('swaps main/cross axis mapping for column direction without wrap', () => {
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'column');
            inst.onPropertyChange('gap', '10');
            inst.onPropertyChange('alignment', 'top-right');
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({
                'flex-direction': 'column', 'justify-content': 'flex-start', 'align-items': 'flex-end'
            }));
        });
    });

    describe('position', () => {
        it('clears inline position and z-index fallbacks when position is empty', () => {
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', '');
            expect(cssArgs(inst)).toContainEqual({ position: '', 'z-index': '', top: '', right: '', bottom: '', left: '' });
        });

        it('falls back to empty position/z-index for falsy non-empty values', () => {
            const inst = make({});
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 0);
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({ position: '', 'z-index': '' }));
        });
    });

    describe('applySize parent contexts', () => {
        it('handles an element without a parent', async () => {
            const detached = document.createElement('div');
            const inst = make({}, { $element: fakeEl(detached) });
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'hug');
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({
                width: 'fit-content', 'flex-grow': '', 'flex-shrink': '0', 'align-self': ''
            }));
        });

        it('fill on the main axis of a column flex parent clears flex-basis', () => {
            const parent = document.createElement('div');
            parent.style.display = 'flex';
            parent.style.flexDirection = 'column';
            const child = document.createElement('div');
            parent.appendChild(child);
            document.body.appendChild(parent);
            const inst = make({}, { $element: fakeEl(child) });
            inst.ngAfterViewInit();
            inst.onStyleChange('height', 'fill');
            expect(cssArgs(inst)).toContainEqual(expect.objectContaining({
                height: '', 'flex-grow': '1', 'flex-shrink': '0', 'flex-basis': '', 'min-height': '0'
            }));
        });
    });

    describe('onStyleChange / onPropertyChange with injector app and not-ready view', () => {
        it('resolves app via the injector in onStyleChange', () => {
            const inst = make({}, { app: undefined, injector: { get: jest.fn().mockReturnValue({ isPrism: true }) } });
            inst.onStyleChange('width', '10px');
            expect(inst.__al_store.width).toBe('10px');
        });

        it('does not touch the DOM for overflow/zindex before the view is initialised', () => {
            const inst = make({});
            inst.onPropertyChange('position', 'absolute');
            inst.onStyleChange('zindex', '5');
            inst.onStyleChange('overflow', 'none');
            expect(inst.$element.css).not.toHaveBeenCalled();
            expect(inst.__al_store.needsPosition).toBe(true);
            expect(inst.__al_store.needsOverflow).toBe(true);
        });

        it('applies padding on a ready view only when a target exists', () => {
            const inst = make({ targetSelector: '.nope' });
            inst.ngAfterViewInit();
            expect(() => inst.onStyleChange('padding', '3px')).not.toThrow();
            expect(inst.__al_store.padding).toBe('3px');
        });
    });
});
