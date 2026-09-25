import { Component, ViewChild } from "@angular/core";
import { SliderComponent } from "./slider.component";
import { FormsModule, NgModel } from "@angular/forms";

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    switchClass: jest.fn()
}));

import { App, AppDefaults, switchClass } from "@wm/core";
import { ToDatePipe } from "@wm/components/base";
import { DatePipe } from "@angular/common";
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from "../../../../base/src/test/common-widget.specs";
import { compileTestComponent, mockApp } from "projects/components/base/src/test/util/component-test-util";
import { ComponentFixture, fakeAsync, tick } from "@angular/core/testing";

const markup = `<div wmSlider name="slider1" hint="slider" tabindex="1">`;

@Component({
    standalone: false,
    template: markup
})

class SliderWrapperComponent {
    @ViewChild(SliderComponent, /* TODO: add static flag */ { static: true }) wmComponent: SliderComponent
}

const testModuleDef: ITestModuleDef = {
    imports: [FormsModule, SliderComponent],
    declarations: [SliderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults }
    ]
};

const componentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-slider',
    widgetSelector: '[wmSlider]',
    testModuleDef: testModuleDef,
    testComponent: SliderWrapperComponent,
    inputElementSelector: 'input.range-input'
};

const TestBase: ComponentTestBase = new ComponentTestBase(componentDef);
TestBase.verifyPropsInitialization();
TestBase.verifyCommonProperties();
TestBase.verifyStyles();
TestBase.verifyAccessibility();

describe('SliderComponent', () => {
    let wrapperComponent: SliderWrapperComponent;
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderWrapperComponent>

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, SliderWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        component = wrapperComponent.wmComponent;
        component.ngModel = { valid: true } as NgModel;
    });

    it('should create the SliderComponent', () => {
        expect(wrapperComponent).toBeTruthy();
    });
    it('should call invokeOnChange with correct parameters', () => {
        const datavalue = 'test value';
        component.datavalue = datavalue;
        const invokeOnChangeSpy = jest.spyOn(component, 'invokeOnChange');
        component.handleChange(true);
        expect(invokeOnChangeSpy).toHaveBeenCalledWith(
            datavalue,
            { type: 'change' },
            true
        );
    });
    describe('handleEvent', () => {
        let node: HTMLElement;
        let callback: jest.Mock;
        let locals: any;

        beforeEach(() => {
            node = document.createElement('div');
            callback = jest.fn();
            locals = {};
            jest.spyOn(Object.getPrototypeOf(component), 'handleEvent');
        });

        afterEach(() => {
            jest.clearAllMocks(); // Clear all mock calls after each test
        });

        it('should call super.handleEvent for events other than "change" and "blur"', () => {
            component['handleEvent'](node, 'focus', callback, locals);
            expect(Object.getPrototypeOf(component).handleEvent).toHaveBeenCalledWith(node, 'focus', callback, locals);
        });

        it('should not call super.handleEvent for "change"/"blur" (handled directly by the template)', () => {
            // The outer spy is on SliderComponent.prototype itself (the override), which always
            // records the direct call we make below - it can't tell us whether *that* implementation
            // went on to call super. Spy one level up, on the real super.handleEvent, instead.
            const superHandleEventSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(component)), 'handleEvent');
            component['handleEvent'](node, 'change', callback, locals);
            component['handleEvent'](node, 'blur', callback, locals);
            expect(superHandleEventSpy).not.toHaveBeenCalled();
        });
    });

    describe('updateSliderValue', () => {
        it('should set the --end CSS custom property based on the current value within range', () => {
            component.minvalue = 0;
            component.maxvalue = 100;
            component.datavalue = 25;
            const slider = document.createElement('div');
            slider.className = 'slider-control';
            component.nativeElement.appendChild(slider);
            component.updateSliderValue();
            expect(slider.style.getPropertyValue('--end')).toEqual('75%');
        });

        it('should clamp the percentage to the 0-100 range', () => {
            component.minvalue = 0;
            component.maxvalue = 100;
            component.datavalue = 1000;
            const slider = document.createElement('div');
            slider.className = 'slider-control';
            component.nativeElement.appendChild(slider);
            component.updateSliderValue();
            expect(slider.style.getPropertyValue('--end')).toEqual('0%');
        });

        it('should do nothing when the slider-control element is not present', () => {
            expect(() => component.updateSliderValue()).not.toThrow();
        });
    });

    describe('onPropertyChange', () => {
        it('should ignore tabindex changes', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(component)), 'onPropertyChange');
            component.onPropertyChange('tabindex', '2', '1');
            expect(superSpy).not.toHaveBeenCalled();
        });

        it('should re-render markers when showmarkers is enabled and a marker-related prop changes', () => {
            component.showmarkers = true;
            const renderSpy = jest.spyOn(component as any, 'renderMarkers').mockImplementation(() => undefined);
            component.onPropertyChange('step', 2, 1);
            expect(renderSpy).toHaveBeenCalled();
        });

        it('should not render markers when showmarkers is disabled', () => {
            component.showmarkers = false;
            const renderSpy = jest.spyOn(component as any, 'renderMarkers').mockImplementation(() => undefined);
            component.onPropertyChange('minvalue', 0, 10);
            expect(renderSpy).not.toHaveBeenCalled();
        });

        it('should switch the range-label-position host class', () => {
            component.onPropertyChange('rangelabelposition', 'bottom', 'top');
            expect(switchClass).toHaveBeenCalledWith(component.nativeElement, 'range-label-bottom', 'range-label-top');
        });

        it('should default datavalue to 50 when cleared to an empty value', () => {
            component.datavalue = undefined;
            component.onPropertyChange('datavalue', '', null);
            expect(component.datavalue).toEqual(50);
        });

        it('should keep the previous datavalue when cleared and no default is set', () => {
            component.datavalue = 30;
            component.onPropertyChange('datavalue', null, 30);
            expect(component.datavalue).toEqual(30);
        });

        it('should pass through a real datavalue update unchanged', () => {
            component.onPropertyChange('datavalue', 42, 10);
            expect(component.datavalue).toEqual(42);
        });
    });

    describe('renderMarkers', () => {
        it('should build one marker item per tick between minvalue and maxvalue', () => {
            component.minvalue = 0;
            component.maxvalue = 10;
            component.step = 5;
            component.markerlabeltext = undefined;
            (component as any).renderMarkers();
            expect(component.markerItems.length).toBeGreaterThan(0);
            expect(component.markerItems[0]).toEqual(expect.objectContaining({ position: 'up' }));
        });

        it('should produce no markers when step is not positive', () => {
            component.step = 0;
            (component as any).renderMarkers();
            expect(component.markerItems).toEqual([]);
        });

        it('should size the tick count using (maxvalue - minvalue) when minvalue is non-zero', () => {
            // Regression test: tickCount used to be computed as `maxvalue||100-minvalue||0`, which
            // (due to operator precedence) evaluates to `maxvalue || (100 - minvalue) || 0` and silently
            // ignores minvalue whenever maxvalue is truthy. Fixed to `(maxvalue||100) - (minvalue||0)`.
            component.minvalue = 20;
            component.maxvalue = 100;
            component.step = 10;
            (component as any).renderMarkers();
            expect(component.markerItems.length).toEqual(9);
        });

        it('should default maxvalue to 100 while computing tick count when maxvalue is not set', () => {
            component.minvalue = 0;
            component.maxvalue = undefined;
            component.step = 25;
            (component as any).renderMarkers();
            expect(component.markerItems.length).toEqual(5);
        });

        it('should use plain array items as marker labels when markerlabeltext is a list of primitives', () => {
            component.minvalue = 0;
            component.maxvalue = 10;
            component.step = 5;
            component.markerlabeltext = 'Low,Mid,High';
            (component as any).renderMarkers();
            expect(component.markerItems.map((m: any) => m.label)).toEqual(['Low', 'Mid', 'High']);
            expect(component.markerItems.every((m: any) => m.position === 'up')).toBe(true);
        });

        it('should use title/position from marker item objects when provided', () => {
            component.minvalue = 0;
            component.maxvalue = 10;
            component.step = 5;
            component.markerlabeltext = [
                { title: 'Start', position: 'down' },
                { title: 'Middle', position: 'up' },
                { title: 'End', position: 'down' }
            ];
            (component as any).renderMarkers();
            expect(component.markerItems[0]).toEqual(expect.objectContaining({ label: 'Start', position: 'down' }));
            expect(component.markerItems[1]).toEqual(expect.objectContaining({ label: 'Middle', position: 'up' }));
        });

        it('should fall back to the raw item and "up" position when title/position are absent on object items', () => {
            component.minvalue = 0;
            component.maxvalue = 10;
            component.step = 5;
            component.markerlabeltext = [{}, {}, {}];
            (component as any).renderMarkers();
            expect(component.markerItems[0].position).toEqual('up');
            expect(component.markerItems[0].label).toEqual(component.markerlabeltext[0]);
        });

        it('should use dataValue from a label map when present', () => {
            component.minvalue = 0;
            component.maxvalue = 10;
            component.step = 5;
            component.markerlabeltext = { 0: { dataValue: 'Zero' }, 1: { dataValue: 'One' }, 2: { dataValue: 'Two' } };
            (component as any).renderMarkers();
            expect(component.markerItems.map((m: any) => m.label)).toEqual(['Zero', 'One', 'Two']);
            expect(component.markerItems.every((m: any) => m.position === 'up')).toBe(true);
        });
    });

    describe('ngAfterViewInit', () => {
        it('should schedule a marker render when showmarkers is enabled', fakeAsync(() => {
            component.showmarkers = true;
            const renderSpy = jest.spyOn(component as any, 'renderMarkers').mockImplementation(() => undefined);
            component.ngAfterViewInit();
            tick(40);
            expect(renderSpy).toHaveBeenCalled();
        }));

        it('should schedule a slider-value update when a datavalue is present', fakeAsync(() => {
            component.datavalue = 20;
            const updateSpy = jest.spyOn(component, 'updateSliderValue').mockImplementation(() => undefined);
            component.ngAfterViewInit();
            tick();
            expect(updateSpy).toHaveBeenCalled();
        }));
    });

    describe('decrementButtonClick', () => {
        const createEvent = () => ({ preventDefault: jest.fn(), stopPropagation: jest.fn() }) as any;

        it('should do nothing while disabled', () => {
            component.disabled = true;
            component.datavalue = 50;
            component.decrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(50);
        });

        it('should decrement by the configured step', () => {
            component.disabled = false;
            component.minvalue = 0;
            component.step = 5;
            component.datavalue = 20;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.decrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(15);
            expect(handleChangeSpy).toHaveBeenCalled();
        });

        it('should not go at or below the minimum value', () => {
            component.disabled = false;
            component.minvalue = 10;
            component.step = 5;
            component.datavalue = 12;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.decrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(12);
            expect(handleChangeSpy).not.toHaveBeenCalled();
        });

        it('should fall back to a step of 1 when step is not set', () => {
            component.disabled = false;
            component.minvalue = 0;
            component.step = undefined;
            component.datavalue = 20;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.decrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(19);
            expect(handleChangeSpy).toHaveBeenCalled();
        });

        it('should fall back to a datavalue of 50 when datavalue is not set', () => {
            component.disabled = false;
            component.minvalue = 0;
            component.step = 5;
            component.datavalue = undefined;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.decrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(45);
            expect(handleChangeSpy).toHaveBeenCalled();
        });
    });

    describe('incrementButtonClick', () => {
        const createEvent = () => ({ preventDefault: jest.fn(), stopPropagation: jest.fn() }) as any;

        it('should do nothing while disabled', () => {
            component.disabled = true;
            component.datavalue = 50;
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(50);
        });

        it('should increment by the configured step', () => {
            component.disabled = false;
            component.maxvalue = 100;
            component.step = 5;
            component.datavalue = 20;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(25);
            expect(handleChangeSpy).toHaveBeenCalled();
        });

        it('should not go at or above the maximum value', () => {
            component.disabled = false;
            component.maxvalue = 20;
            component.step = 5;
            component.datavalue = 18;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(18);
            expect(handleChangeSpy).not.toHaveBeenCalled();
        });

        it('should fall back to a step of 1 when step is not set', () => {
            component.disabled = false;
            component.maxvalue = 100;
            component.step = undefined;
            component.datavalue = 20;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(21);
            expect(handleChangeSpy).toHaveBeenCalled();
        });

        it('should fall back to a maxvalue of 100 when maxvalue is not set', () => {
            component.disabled = false;
            component.maxvalue = undefined;
            component.step = 5;
            component.datavalue = 20;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(25);
            expect(handleChangeSpy).toHaveBeenCalled();
        });

        it('should fall back to a datavalue of 50 when datavalue is not set', () => {
            component.disabled = false;
            component.maxvalue = 100;
            component.step = 5;
            component.datavalue = undefined;
            const handleChangeSpy = jest.spyOn(component, 'handleChange').mockImplementation(() => undefined);
            component.incrementButtonClick(createEvent());
            expect(component.datavalue).toEqual(55);
            expect(handleChangeSpy).toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('should clear the ngModel reference and empty the marker items', () => {
            component.markerItems = [{ label: '1' }];
            component.ngOnDestroy();
            expect(component.ngModel).toBeNull();
            expect(component.markerItems).toEqual([]);
        });
    });
});