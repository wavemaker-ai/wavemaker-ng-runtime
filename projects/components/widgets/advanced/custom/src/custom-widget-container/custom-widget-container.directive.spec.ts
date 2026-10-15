import { Component, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AbstractI18nService, App, AppDefaults, PartialRefProvider } from '@wm/core';
import { ToDatePipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { CustomWidgetContainerDirective } from './custom-widget-container.directive';

@Component({
    standalone: false,
    template: `
        <div wmWidgetContainer widgetname="spec" name="cw1">
            <div class="wrapper"><div class="inner" name="inner"></div></div>
        </div>`
})
class HostComponent {
    @ViewChild(CustomWidgetContainerDirective, { static: true }) wmComponent: CustomWidgetContainerDirective;
}

describe('CustomWidgetContainerDirective', () => {
    let fixture: ComponentFixture<HostComponent>;
    let widget: any;
    let inner: any;
    let innerWidget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [FormsModule, ReactiveFormsModule, CustomWidgetContainerDirective],
            declarations: [HostComponent],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: DatePipe, useClass: DatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                PartialRefProvider
            ]
        }, HostComponent);
        widget = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        inner = widget.nativeElement.querySelector('.inner');
        innerWidget = { viewParent: { datavalue: 'inner-value' } };
        inner.widget = innerWidget;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    describe('construction', () => {
        it('derives the widget type and name from the markup', () => {
            expect(widget.widgetType).toBe('wm-custom-spec');
            expect(widget.name).toBe('cw1');
            expect(widget._isCustom).toBe(true);
        });

        it('only syncs known prop- properties into the props bag', () => {
            widget.props = { a: 1 };
            widget.notifyPropertyChange('plain', 5, 1);
            widget.notifyPropertyChange('prop-missing', 5, 1);
            widget.notifyPropertyChange('prop-a', 1, 1);
            expect(widget.props).toEqual({ a: 1 });
            widget.notifyPropertyChange('prop-a', 2, 1);
            expect(widget.props).toEqual({ a: 2 });
            expect(widget.props.missing).toBeUndefined();
        });
    });

    describe('datavalue', () => {
        it('reads from the inner widget and syncs the form control', () => {
            const sync = jest.spyOn(widget, 'updateDataValue').mockImplementation(() => {});
            expect(widget.datavalue).toBe('inner-value');
            expect(sync).toHaveBeenCalledWith('inner-value');
        });

        it('writes to the inner widget', () => {
            widget.datavalue = 'new';
            expect(innerWidget.viewParent.datavalue).toBe('new');
        });

        it('is undefined / ignored when there is no content', () => {
            widget.nativeElement.innerHTML = '';
            expect(widget.datavalue).toBeUndefined();
            expect(() => { widget.datavalue = 'x'; }).not.toThrow();
        });
    });

    describe('setBaseWidgetName', () => {
        it('camel-cases the base widget type', () => {
            widget.setBaseWidgetName('wm-checkbox-set');
            expect((widget as any).baseWidgetName).toBe('wmCheckboxSet');
        });
    });

    describe('setProps', () => {
        const config = (extra: any = {}) => ({
            widgetType: 'wm-checkboxset',
            properties: { title: { type: 'string', value: 'T' }, flag: { type: 'boolean', value: true }, count: { type: 'number', value: 3 }, dyn: { type: 'list', value: 'bind:Variables.x' } },
            ...extra
        });

        let n = 0;
        beforeEach(() => {
            // each test registers props for its own widget type
            widget.widgetType = `wm-custom-spec-${++n}`;
        });

        it('resolves the base widget, applies classes and registers the declared properties once', () => {
            const resolve = jest.fn();
            const baseEl = document.createElement('span');
            baseEl.setAttribute('name', 'checkboxset');
            (baseEl as any).widget = { base: 1 };
            inner.appendChild(baseEl);
            const emitted = jest.fn();
            widget.configSubject.subscribe(emitted);
            const propsReady = jest.fn();
            widget.propsReady = propsReady;

            widget.setProps(config({ customClasses: 'extra-cls' }), resolve);

            expect(widget.config.widgetType).toBe('wm-checkboxset');
            expect(emitted).toHaveBeenCalled();
            expect(widget.baseWidget).toEqual({ base: 1 });
            expect(widget.asAttr).toBe(false);
            expect(widget.props).toEqual({ title: 'T', flag: true, count: 3, dyn: 'bind:Variables.x' });
            expect(propsReady).toHaveBeenCalledWith(resolve);

            // second widget of the same type reuses the registered props
            const second = new (CustomWidgetContainerDirective as any)(
                (widget as any).inj, { nativeElement: document.createElement('div') }, 'spec', undefined);
            second.nativeElement.innerHTML = '<div><div></div></div>';
            second.widgetType = widget.widgetType;
            second.propsReady = jest.fn();
            second.setProps(config(), resolve);
            expect(second.props).toEqual(expect.objectContaining({ title: 'T' }));
        });

        it('uses projectPropsOn for the base widget and detects the "as" attribute', () => {
            inner.setAttribute('as', 'wm-checkboxset');
            widget.propsReady = jest.fn();
            widget.setProps(config({ projectPropsOn: 'radioset' }), jest.fn());
            expect((widget as any).baseWidgetName).toBe('radioset');
            expect(widget.asAttr).toBe(true);
            expect(widget.baseWidget).toBeUndefined();
        });

        it('stops early when the config has no properties', () => {
            widget.propsReady = jest.fn();
            widget.setProps({ widgetType: 'wm-label' }, jest.fn());
            expect(widget.propsReady).not.toHaveBeenCalled();
        });
    });

    describe('updateDataValue', () => {
        it('does nothing without a form control or when the value is unchanged', () => {
            expect(() => widget.updateDataValue('x')).not.toThrow();
            const same = new FormControl('same');
            jest.spyOn(widget, 'formControl', 'get').mockReturnValue({ control: same });
            const set = jest.spyOn(same, 'setValue');
            widget.updateDataValue('same');
            expect(set).not.toHaveBeenCalled();
        });

        it('updates the control and signals validation errors', () => {
            const control = new FormControl('old', () => ({ bad: true }));
            jest.spyOn(widget, 'formControl', 'get').mockReturnValue({ control });
            const err = jest.fn();
            widget.onErroSubject.subscribe(err);
            widget.updateDataValue('new');
            expect(control.value).toBe('new');
            expect(err).toHaveBeenCalled();
        });

        it('does not signal an error for valid values', () => {
            const control = new FormControl('old');
            jest.spyOn(widget, 'formControl', 'get').mockReturnValue({ control });
            const err = jest.fn();
            widget.onErroSubject.subscribe(err);
            widget.updateDataValue('new');
            expect(err).not.toHaveBeenCalled();
        });
    });

    describe('updateData', () => {
        it('sets plain properties on the widget and the inner view parent', () => {
            widget.asAttr = false;
            widget.updateData('base-caption', 'Hello');
            expect(widget.caption).toBe('Hello');
            expect(innerWidget.viewParent.caption).toBe('Hello');
        });

        it('updates the form control when the datavalue changes', () => {
            widget.asAttr = false;
            const sync = jest.spyOn(widget, 'updateDataValue').mockImplementation(() => {});
            jest.spyOn(widget, 'formControl', 'get').mockReturnValue({});
            widget.updateData('base-datavalue', 'v');
            expect(sync).toHaveBeenCalledWith('v');
            sync.mockClear();
            widget.updateData('base-other', 'v');
            expect(sync).not.toHaveBeenCalled();
        });

        it('sets properties on the base widget when the widget is declared with an "as" attribute', () => {
            const initDatasetItems = jest.fn();
            widget.asAttr = true;
            (widget as any).baseWidgetName = 'wmRadioset';
            widget.wmRadioset = { initDatasetItems };
            innerWidget.viewParent.wmRadioset = {};
            widget.updateData('base-dataset', [1]);
            expect(widget.wmRadioset.dataset).toEqual([1]);
            expect(innerWidget.viewParent.wmRadioset.dataset).toEqual([1]);
            expect(initDatasetItems).toHaveBeenCalled();
        });
    });

    it('applies the name when the ready state is signalled', () => {
        const spy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(widget)), 'onPropertyChange');
        widget.readyState.next(undefined);
        expect(spy).toHaveBeenCalledWith('name', widget.name);
    });
});
