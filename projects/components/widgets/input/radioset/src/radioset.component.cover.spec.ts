import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AbstractI18nService, App, AppDefaults, PartialRefProvider } from '@wm/core';
import { ToDatePipe } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { RadiosetComponent } from './radioset.component';

describe('RadiosetComponent - cover', () => {
    let fixture: ComponentFixture<RadiosetComponent>;
    let component: any;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FormsModule, ReactiveFormsModule, RadiosetComponent],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: DatePipe, useClass: DatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                PartialRefProvider,
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(RadiosetComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => jest.restoreAllMocks());

    describe('triggerInvokeOnChange', () => {
        it('updates the container widget datavalue and notifies the change', () => {
            const updateDataValue = jest.fn();
            component.viewParent = { containerWidget: { updateDataValue } };
            const change = jest.spyOn(component, 'invokeOnChange').mockImplementation(() => undefined);
            const touched = jest.spyOn(component, 'invokeOnTouched').mockImplementation(() => undefined);
            component.datasetItems = [{ key: 'a', value: 'a', label: 'A' }];
            component.triggerInvokeOnChange('a', undefined);
            expect(updateDataValue).toHaveBeenCalledWith(component.datavalue);
            expect(touched).toHaveBeenCalledTimes(1);
            expect(change).toHaveBeenCalledWith(component.datavalue, {}, true);
        });

        it('forwards the supplied event', () => {
            const change = jest.spyOn(component, 'invokeOnChange').mockImplementation(() => undefined);
            const evt = { type: 'click' };
            component.triggerInvokeOnChange('a', evt);
            expect(change).toHaveBeenCalledWith(component.datavalue, evt, true);
        });
    });

    describe('click handling', () => {
        it('only invokes the callback for clicks on the input', () => {
            const deregister = jest.fn();
            const add = jest.spyOn(component.eventManager, 'addEventListener').mockReturnValue(deregister);
            const callback = jest.fn(() => 'done');
            const locals: any = {};
            const node = document.createElement('div');
            component.handleEvent(node, 'click', callback, locals);
            const handler = add.mock.calls[0][2] as any;

            const span = document.createElement('span');
            expect(handler({ target: span })).toBeUndefined();
            expect(callback).not.toHaveBeenCalled();

            const input = document.createElement('input');
            const evt = { target: input };
            expect(handler(evt)).toBe('done');
            expect(locals.$event).toBe(evt);

            component.ngOnDestroy();
            expect(deregister).toHaveBeenCalledTimes(1);
            expect(component.eventListeners).toBeNull();
        });

        it('ignores change events and delegates other events', () => {
            const add = jest.spyOn(component.eventManager, 'addEventListener').mockReturnValue(jest.fn());
            component.handleEvent(document.createElement('div'), 'change', jest.fn(), {});
            expect(add).not.toHaveBeenCalled();
        });

        it('only reacts to radio inputs in onRadioLabelClick', () => {
            const trigger = jest.spyOn(component, 'triggerInvokeOnChange').mockImplementation(() => undefined);
            component.onRadioLabelClick({ target: document.createElement('span') }, 'k');
            expect(trigger).not.toHaveBeenCalled();
            const evt = { target: document.createElement('input') };
            component.onRadioLabelClick(evt, 'k');
            expect(trigger).toHaveBeenCalledWith('k', evt);
        });
    });

    describe('onPropertyChange', () => {
        it('ignores tabindex', () => {
            const spy = jest.spyOn(Object.getPrototypeOf(RadiosetComponent.prototype), 'onPropertyChange');
            component.onPropertyChange('tabindex', 1);
            expect(spy).not.toHaveBeenCalled();
        });

        it('lays the options out vertically or horizontally', () => {
            component.onPropertyChange('layout', 'vertical');
            expect(component.$element.css('flex-direction')).toBe('column');
            expect(component.$element.css('display')).toBe('flex');
            component.onPropertyChange('layout', 'horizontal');
            expect(component.$element.css('flex-direction')).toBe('row');
        });
    });

    it('destroys cleanly without registered listeners', () => {
        component.eventListeners = new Map();
        expect(() => component.ngOnDestroy()).not.toThrow();
        expect(component.eventListeners).toBeInstanceOf(Map);
    });

    it('skips listeners that are not functions on destroy', () => {
        const fn = jest.fn();
        component.eventListeners = new Map<any, any>([[document.createElement('a'), null], [document.createElement('b'), fn]]);
        component.ngOnDestroy();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(component.eventListeners).toBeNull();
    });
});
