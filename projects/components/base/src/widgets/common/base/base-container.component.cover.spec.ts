import { ElementRef, Injector, QueryList } from '@angular/core';
import { App } from '@wm/core';
import { BaseContainerComponent } from './base-container.component';
import { StylableComponent } from './stylable.component';
import { mockApp } from '../../../test/util/component-test-util';

class TestContainer extends BaseContainerComponent {
    constructor(inj: Injector) {
        super(inj, { widgetType: 'wm-form-field-datetime' } as any, undefined);
    }
}

describe('BaseContainerComponent - cover', () => {
    let component: any;

    beforeEach(() => {
        const el = document.createElement('div');
        const inj: any = {
            get: jest.fn((token) => (token === ElementRef ? { nativeElement: el } : token === App ? mockApp : null)),
            _lView: [null, null, null, null, null, null, null, null, { index: 0 }],
            _tNode: { attrs: [] },
        };
        component = new TestContainer(inj);
        jest.spyOn(StylableComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const widgetWith = (redrawable: boolean, extra: any = {}) => {
        const nativeElement = document.createElement('div');
        if (redrawable) {
            nativeElement.setAttribute('redrawable', '');
        }
        return { nativeElement, ...extra };
    };

    describe('updateRedrawableComponents', () => {
        it('collects redrawable widgets once, including nested ones', () => {
            const nested = widgetWith(true);
            const parent = widgetWith(true, { Widgets: { nested } });
            const plain = widgetWith(false);
            component.reDrawableComponents = { _results: [] };
            component.updateRedrawableComponents({ parent, plain, none: undefined });
            component.updateRedrawableComponents({ parent });
            expect(component.reDrawableComponents._results).toEqual([parent, nested]);
        });
    });

    describe('redrawChildren', () => {
        it('redraws every redrawable component after a delay', () => {
            jest.useFakeTimers();
            const redraw = jest.fn();
            const w = widgetWith(true);
            component.content = {};
            component.Widgets = { w };
            const existing = { redraw };
            const results: any[] = [existing];
            component.reDrawableComponents = { _results: results, forEach: (cb) => results.forEach(cb) };
            component.redrawChildren();
            expect(results).toContain(w);
            results[results.indexOf(w)] = { redraw: jest.fn() };
            jest.advanceTimersByTime(100);
            expect(redraw).toHaveBeenCalledTimes(1);
            expect(results[1].redraw).toHaveBeenCalledTimes(1);
        });

        it('does nothing when there are no redrawable components', () => {
            jest.useFakeTimers();
            component.content = undefined;
            component.reDrawableComponents = undefined;
            component.redrawChildren();
            expect(() => jest.advanceTimersByTime(100)).not.toThrow();
        });
    });

    describe('onPropertyChange', () => {
        it('only redraws the children when the container is shown', () => {
            jest.spyOn(StylableComponent.prototype as any, 'onPropertyChange').mockImplementation(() => undefined);
            const redraw = jest.spyOn(component, 'redrawChildren').mockImplementation(() => undefined);
            component.onPropertyChange('show', false);
            component.onPropertyChange('class', true);
            expect(redraw).not.toHaveBeenCalled();
            component.onPropertyChange('show', true);
            expect(redraw).toHaveBeenCalledTimes(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('releases the redrawable components, widgets and content', () => {
            const reset = jest.fn();
            const results = [{}, {}];
            component.reDrawableComponents = { _results: results, reset };
            component.Widgets = { a: {}, b: {} };
            const widgets = component.Widgets;
            component.content = {};
            component.ngOnDestroy();
            expect(results).toHaveLength(0);
            expect(reset).toHaveBeenCalledWith([]);
            expect(Object.keys(widgets)).toHaveLength(0);
            expect(component.Widgets).toBeNull();
            expect(component.content).toBeNull();
            expect(StylableComponent.prototype.ngOnDestroy).toHaveBeenCalled();
        });

        it('copes with missing collections', () => {
            component.reDrawableComponents = { reset: jest.fn() };
            component.Widgets = undefined;
            expect(() => component.ngOnDestroy()).not.toThrow();
            component.reDrawableComponents = undefined;
            expect(() => component.ngOnDestroy()).not.toThrow();
        });
    });
});
