import { AutoLayout } from './autolayout.decorator';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn()),
}));

import { $watch } from '@wm/core';

describe('AutoLayout decorator', () => {
    let hostEl: HTMLElement;
    let innerEl: HTMLElement;
    let onDestroySpy: jest.Mock;
    let onPropSpy: jest.Mock;
    let onStyleSpy: jest.Mock;
    let afterViewInitSpy: jest.Mock;

    function createInstance(options: any = {}, app: any = { isPrism: true }) {
        onDestroySpy = jest.fn();
        onPropSpy = jest.fn();
        onStyleSpy = jest.fn();
        afterViewInitSpy = jest.fn();

        class Widget {
            app = app;
            nativeElement = hostEl;
            $element = $(hostEl);
            viewParent = { someScope: true };
            setProperty = jest.fn();
            onPropertyChange(key: string, nv: any, ov?: any) { onPropSpy(key, nv, ov); }
            onStyleChange(key: string, nv: any, ov?: any) { onStyleSpy(key, nv, ov); }
            ngOnDestroy() { onDestroySpy(); }
            ngAfterViewInit() { afterViewInitSpy(); }
        }

        AutoLayout(options)(Widget as any);
        return new (Widget as any)();
    }

    beforeEach(() => {
        hostEl = document.createElement('div');
        innerEl = document.createElement('div');
        innerEl.className = 'inner-target';
        hostEl.appendChild(innerEl);
        document.body.appendChild(hostEl);
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    describe('isAutoLayoutEnabled gate', () => {
        it('should still call the original onPropertyChange but skip layout logic when app is neither prism nor prefab', () => {
            const inst = createInstance({}, {});
            inst.onPropertyChange('direction', 'row');
            expect(onPropSpy).toHaveBeenCalledWith('direction', 'row', undefined);
            expect($(hostEl).css('display')).not.toBe('flex');
        });

        it('should run layout logic when app.isPrism is true', () => {
            const inst = createInstance({}, { isPrism: true });
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            expect($(hostEl).css('display')).toBe('flex');
        });

        it('should run layout logic when app.isPrefabType is true', () => {
            const inst = createInstance({}, { isPrefabType: true });
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            expect($(hostEl).css('display')).toBe('flex');
        });

        it('should resolve the app from the injector when the instance has no direct app property', () => {
            const app = { isPrism: true };
            const inst = createInstance({}, undefined);
            inst.app = undefined;
            inst.injector = { get: jest.fn().mockReturnValue(app) };
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            expect($(hostEl).css('display')).toBe('flex');
        });
    });

    describe('onPropertyChange', () => {
        it('should not apply flex styles until the view is initialized', () => {
            const inst = createInstance();
            inst.onPropertyChange('direction', 'row');
            expect($(hostEl).css('display')).not.toBe('flex');
            expect(inst.__al_store.dir).toBe('row');
            expect(inst.__al_store.needsFlex).toBe(true);
        });

        it('should reset wrap to false when direction changes to column', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('wrap', true);
            expect(inst.__al_store.wrap).toBe(true);
            inst.onPropertyChange('direction', 'column');
            expect(inst.__al_store.wrap).toBe(false);
        });

        it('should apply flex-wrap once both a direction and wrap are set', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('wrap', 'true');
            expect($(hostEl).css('flex-wrap')).toBe('wrap');
        });

        it('should compute alignment styles for a row direction with wrap enabled', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('wrap', 'true');
            inst.onPropertyChange('alignment', 'top-center');
            expect($(hostEl).css('justify-content')).toBe('center');
            expect($(hostEl).css('align-items')).toBe('flex-start');
        });

        it('should compute alignment styles for a row direction without wrap', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('alignment', 'middle-center');
            expect($(hostEl).css('justify-content')).toBe('center');
            expect($(hostEl).css('align-items')).toBe('center');
        });

        it('should use non-directional justify/align when gap is auto and wrap is off', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('gap', 'auto');
            inst.onPropertyChange('alignment', 'top-center');
            expect($(hostEl).css('justify-content')).toBe('center');
            expect($(hostEl).css('align-items')).toBe('flex-start');
        });

        it.each([
            ['auto', 'auto', 'center'],
            ['auto', '10', 'flex-start'],
            ['5', 'auto', 'space-between'],
        ])('should compute align-content for wrap with columngap=%s gap=%s', (cg, gap, expectedAlignContent) => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('wrap', 'true');
            inst.onPropertyChange('columngap', cg);
            inst.onPropertyChange('gap', gap);
            inst.onPropertyChange('alignment', 'top-center');
            expect($(hostEl).css('align-content')).toBe(expectedAlignContent);
        });

        it('should fall back to top-left alignment for an unrecognized alignment value', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('alignment', 'bogus-alignment');
            expect($(hostEl).css('justify-content')).toBe('flex-start');
        });

        it('should apply a pixel gap after the flush timeout when direction and wrap are set', () => {
            jest.useFakeTimers();
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('wrap', 'true');
            inst.onPropertyChange('gap', '10');
            jest.runAllTimers();
            expect($(hostEl).css('row-gap')).toBe('10px');
        });

        it('should apply an unmodified non-numeric gap value', () => {
            jest.useFakeTimers();
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('gap', 'auto');
            jest.runAllTimers();
            expect(inst.__al_store.gap).toBe('auto');
        });

        it('should clear row/column gap when both gap and columngap are cleared to empty string', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('direction', 'row');
            inst.onPropertyChange('gap', '');
            inst.onPropertyChange('columngap', '');
            expect($(hostEl).css('gap')).toBe('');
        });

        it('should set up an internal watch for a bind: expression string', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'bind:someScope.pos');
            expect($watch).toHaveBeenCalledWith('someScope.pos', inst.viewParent, inst, expect.any(Function));
        });

        it('should resolve the watch scope via bindParent when configured', () => {
            const inst = createInstance({ bindParent: 'someScope' });
            inst.someScope = { nested: true };
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'bind:pos');
            expect($watch).toHaveBeenCalledWith('pos', inst.someScope, inst, expect.any(Function));
        });

        it('should not register the same watch key twice', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'bind:someScope.pos');
            inst.onPropertyChange('position', 'bind:someScope.pos');
            expect($watch).toHaveBeenCalledTimes(1);
        });

        it('should invoke setProperty when the watched expression changes', () => {
            (($watch as jest.Mock)).mockImplementation((expr, scope, ctx, cb) => {
                cb('new-value');
                return jest.fn();
            });
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'bind:someScope.pos');
            expect(inst.setProperty).toHaveBeenCalledWith('position', 'new-value');
        });

        it('should visit every bind: item in a toAdd array, deduping by key after the first watch', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('conditionalclass', { toAdd: ['bind:someScope.a', 'plain-class', 'bind:someScope.b'] });
            // setupInternalWatch dedupes by property key, so only the first bind: item registers
            expect($watch).toHaveBeenCalledTimes(1);
            expect($watch).toHaveBeenCalledWith('someScope.a', inst.viewParent, inst, expect.any(Function));
        });

        it('should update the position store and apply position styles', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            expect(inst.__al_store.pos).toBe('absolute');
            expect($(hostEl).css('position')).toBe('absolute');
        });

        it('should update clipcontent and apply overflow styles', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('clipcontent', 'true');
            inst.onStyleChange('overflow', 'vertical');
            expect($(hostEl).css('overflow-y')).toBe('scroll');
        });

        it('should update positionvalue (inset) and apply position styles', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            inst.onPropertyChange('positionvalue', '5px 6px 7px 8px');
            expect($(hostEl).css('top')).toBe('5px');
            expect($(hostEl).css('right')).toBe('6px');
            expect($(hostEl).css('bottom')).toBe('7px');
            expect($(hostEl).css('left')).toBe('8px');
        });

        it('should ignore unrecognized property keys', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            expect(() => inst.onPropertyChange('someUnknownKey', 'value')).not.toThrow();
        });
    });

    describe('onStyleChange', () => {
        it('should apply size styles for width once the view is initialized', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'fill');
            expect(inst.__al_store.width).toBe('fill');
            expect(onStyleSpy).toHaveBeenCalledWith('width', 'fill', undefined);
        });

        it('should not apply size styles before the view is initialized', () => {
            const inst = createInstance();
            inst.onStyleChange('height', 'hug');
            expect(inst.__al_store.height).toBe('hug');
            expect($(hostEl).css('height')).not.toBe('fit-content');
        });

        it('should apply padding to the target element', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('padding', '12px');
            expect($(hostEl).css('padding')).toBe('12px');
        });

        it('should apply overflow styles', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('overflow', 'horizontal');
            expect(inst.__al_store.needsOverflow).toBe(true);
        });

        it('should set up a watch for a bound zindex and apply position when a position exists', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            inst.onStyleChange('zindex', 'bind:someScope.z');
            expect($watch).toHaveBeenCalledWith('someScope.z', inst.viewParent, inst, expect.any(Function));
            expect(inst.__al_store.needsPosition).toBe(true);
        });

        it('should apply a literal zindex value directly', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('zindex', '5');
            expect(inst.__al_store.z).toBe('5');
        });

        it('should set up a watch for a bound backgroundimage', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('backgroundimage', 'bind:someScope.img');
            expect($watch).toHaveBeenCalledWith('someScope.img', inst.viewParent, inst, expect.any(Function));
        });

        it('should ignore a literal (non-bound) backgroundimage', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            expect(() => inst.onStyleChange('backgroundimage', 'some/path.png')).not.toThrow();
            expect($watch).not.toHaveBeenCalled();
        });
    });

    describe('applyOverflow', () => {
        it.each([
            ['vertical', 'hidden', 'scroll'],
            ['horizontal', 'scroll', 'hidden'],
        ])('should apply the right overflow-x/y for "%s" when clip is enabled', (overflowVal, expectedX, expectedY) => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('clipcontent', 'true');
            inst.onStyleChange('overflow', overflowVal);
            expect($(hostEl).css('overflow-x')).toBe(expectedX);
            expect($(hostEl).css('overflow-y')).toBe(expectedY);
        });

        it.each([
            ['both', 'scroll'],
            ['both directions', 'scroll'],
            ['none', 'hidden'],
            ['no scrolling', 'hidden'],
        ])('should apply the shorthand overflow for "%s" when clip is enabled', (overflowVal, expected) => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('clipcontent', 'true');
            inst.onStyleChange('overflow', overflowVal);
            expect($(hostEl).css('overflow')).toBe(expected);
        });

        it('should ignore an unrecognized overflow value even when clip is enabled', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('clipcontent', 'true');
            expect(() => inst.onStyleChange('overflow', 'something-else')).not.toThrow();
        });

        it('should clear overflow entirely when clip is disabled', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('clipcontent', 'false');
            inst.onStyleChange('overflow', 'vertical');
            expect($(hostEl).css('overflow')).toBe('');
        });
    });

    describe('applyPosition', () => {
        it('should clear inline position styles when no position value is set', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            $(hostEl).css({ position: 'absolute', top: '1px' });
            inst.onStyleChange('zindex', '9');
            inst.onPropertyChange('positionvalue', undefined);
            expect($(hostEl).css('position')).toBe('');
        });

        it('should default a sticky position to a "0px auto auto 0px" inset', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'sticky');
            expect($(hostEl).css('top')).toBe('0px');
            expect($(hostEl).css('right')).toBe('');
            expect($(hostEl).css('bottom')).toBe('');
            expect($(hostEl).css('left')).toBe('0px');
        });

        it('should apply a uniform single-value inset to all sides', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            inst.onPropertyChange('positionvalue', '3px');
            expect($(hostEl).css('top')).toBe('3px');
            expect($(hostEl).css('right')).toBe('3px');
            expect($(hostEl).css('bottom')).toBe('3px');
            expect($(hostEl).css('left')).toBe('3px');
        });

        it('should apply a two-value inset as top/bottom and left/right pairs', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            inst.onPropertyChange('positionvalue', '3px 4px');
            expect($(hostEl).css('top')).toBe('3px');
            expect($(hostEl).css('bottom')).toBe('3px');
            expect($(hostEl).css('right')).toBe('4px');
            expect($(hostEl).css('left')).toBe('4px');
        });

        it('should apply a three-value inset (top, left/right, bottom)', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'absolute');
            inst.onPropertyChange('positionvalue', '3px 4px 5px');
            expect($(hostEl).css('top')).toBe('3px');
            expect($(hostEl).css('right')).toBe('4px');
            expect($(hostEl).css('left')).toBe('4px');
            expect($(hostEl).css('bottom')).toBe('5px');
        });
    });

    describe('applySize', () => {
        it('should fill 100% on a non-flex parent', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'fill');
            expect($(hostEl).css('width')).toBe('100%');
        });

        it('should apply fit-content for hug on a non-flex parent', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'hug');
            // jQuery's width cssHook computes a pixel box value on read-back for keyword
            // values, so assert against the raw inline style instead of $(...).css().
            expect(hostEl.style.width).toBe('fit-content');
        });

        it('should reset flex sizing props when set to a fixed value on a non-flex parent', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            $(hostEl).css('flex-grow', '2');
            inst.onStyleChange('width', '150px');
            expect($(hostEl).css('flex-grow')).toBe('');
        });

        it('should grow along the main axis when filling inside a row-direction flex parent', () => {
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'row';
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'fill');
            expect($(hostEl).css('flex-grow')).toBe('1');
            expect($(hostEl).css('flex-basis')).toBe('0px');
        });

        it('should stretch on the cross axis when filling inside a row-direction flex parent for height', () => {
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'row';
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('height', 'fill');
            expect($(hostEl).css('align-self')).toBe('stretch');
        });

        it('should reset flex-basis/shrink/min-width when hugging on the main axis of a flex parent', () => {
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'row';
            const inst = createInstance();
            inst.ngAfterViewInit();
            $(hostEl).css({ 'flex-basis': '50px', 'min-width': '20px' });
            inst.onStyleChange('width', 'hug');
            expect(hostEl.style.width).toBe('fit-content');
            expect($(hostEl).css('flex-basis')).toBe('');
            expect($(hostEl).css('flex-shrink')).toBe('0');
        });

        it('should reset align-self when hugging on the cross axis of a flex parent', () => {
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'row';
            const inst = createInstance();
            inst.ngAfterViewInit();
            $(hostEl).css('align-self', 'stretch');
            inst.onStyleChange('height', 'hug');
            expect($(hostEl).css('align-self')).toBe('');
        });

        it('should not treat an app-page-content parent as a flex context even when it has flex display', () => {
            document.body.style.display = 'flex';
            document.body.className = 'app-page-content';
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onStyleChange('width', 'fill');
            expect($(hostEl).css('width')).toBe('100%');
        });
    });

    describe('ngAfterViewInit', () => {
        it('should call through to the original ngAfterViewInit', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            expect(afterViewInitSpy).toHaveBeenCalledTimes(1);
        });

        it('should mark the store as view-initialized', () => {
            const inst = createInstance();
            inst.ngAfterViewInit();
            expect(inst.__al_store.isViewInitialized).toBe(true);
        });

        it('should make the host a flex column and flex-grow the inner target when targetSelector is configured', () => {
            const inst = createInstance({ targetSelector: '.inner-target' });
            inst.ngAfterViewInit();
            expect($(innerEl).css('width')).toBe('100%');
            expect($(innerEl).css('flex-grow')).toBe('1');
            expect($(hostEl).css('display')).toBe('flex');
            expect($(hostEl).css('flex-direction')).toBe('column');
        });

        it('should apply stored width/height after the microtask flush', async () => {
            const inst = createInstance();
            inst.onStyleChange('width', 'fill');
            inst.ngAfterViewInit();
            await Promise.resolve();
            await Promise.resolve();
            expect($(hostEl).css('width')).toBe('100%');
        });

        it('should apply stored padding immediately', () => {
            const inst = createInstance();
            inst.onStyleChange('padding', '4px');
            inst.ngAfterViewInit();
            expect($(hostEl).css('padding')).toBe('4px');
        });

        it('should do nothing extra when auto layout is not enabled', () => {
            const inst = createInstance({}, {});
            inst.onStyleChange('padding', '4px');
            inst.ngAfterViewInit();
            expect(afterViewInitSpy).toHaveBeenCalledTimes(1);
            expect(inst.__al_store).toBeUndefined();
        });
    });

    describe('ngOnDestroy', () => {
        it('should complete the destroy subject and unregister watches', () => {
            const unwatch = jest.fn();
            (($watch as jest.Mock)).mockReturnValue(unwatch);
            const inst = createInstance();
            inst.ngAfterViewInit();
            inst.onPropertyChange('position', 'bind:someScope.pos');

            inst.ngOnDestroy();

            expect(unwatch).toHaveBeenCalled();
            expect(onDestroySpy).toHaveBeenCalled();
        });

        it('should call through even when the store was never created', () => {
            const inst = createInstance();
            expect(() => inst.ngOnDestroy()).not.toThrow();
            expect(onDestroySpy).toHaveBeenCalled();
        });
    });
});
