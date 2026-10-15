import { DatePipe } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ToDatePipe } from '@wm/components/base';
import { App, AppDefaults, AbstractI18nService } from '@wm/core';
import { ITestModuleDef } from 'projects/components/base/src/test/common-widget.specs';
import { mockApp, compileTestComponent } from 'projects/components/base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { CheckboxsetComponent } from './checkboxset.component';

@Component({
    standalone: false,
    template: `<div wmCheckboxset name="coverCheckboxset" tabindex="1"></div>`
})
class CoverCheckboxsetWrapper {
    @ViewChild(CheckboxsetComponent, { static: true }) wmComponent: CheckboxsetComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, CheckboxsetComponent],
    declarations: [CoverCheckboxsetWrapper],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};

describe('CheckboxsetComponent - cover branches', () => {
    let fixture: ComponentFixture<CoverCheckboxsetWrapper>;
    let cmp: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CoverCheckboxsetWrapper);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    describe('triggerInvokeOnChange', () => {
        it('updates the container widget and passes an empty event when none is given', () => {
            const updateDataValue = jest.fn();
            cmp.viewParent = { containerWidget: { updateDataValue } };
            const invoke = jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            cmp.triggerInvokeOnChange([], undefined);
            expect(updateDataValue).toHaveBeenCalledWith(cmp.datavalue);
            expect(invoke).toHaveBeenCalledWith(cmp.datavalue, {}, true);
        });
        it('works when the container widget has no updateDataValue', () => {
            cmp.viewParent = { containerWidget: {} };
            const invoke = jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            const ev = { type: 'click' };
            cmp.triggerInvokeOnChange([], ev);
            expect(invoke).toHaveBeenCalledWith(cmp.datavalue, ev, true);
        });
    });

    it('does not register a listener for change events', () => {
        const add = jest.spyOn(cmp.eventManager, 'addEventListener');
        cmp.handleEvent(document.createElement('div'), 'change', jest.fn(), {});
        expect(add).not.toHaveBeenCalled();
        expect(cmp.eventListeners.size).toBe(0);
    });

    describe('layout', () => {
        it('applies the layout on property change', () => {
            cmp.onPropertyChange('layout', 'vertical');
            expect(cmp.$element.css('flex-direction')).toBe('column');
            expect(cmp.$element.css('display')).toBe('flex');
        });
        it('lays out horizontally for other values', () => {
            cmp.handleLayout('horizontal');
            expect(cmp.$element.css('flex-direction')).toBe('row');
        });
    });

    describe('ngOnDestroy', () => {
        it('only calls registered deregister functions', () => {
            const dereg = jest.fn();
            cmp.eventListeners.set(document.createElement('div'), dereg);
            cmp.eventListeners.set(document.createElement('span'), undefined);
            cmp.ngOnDestroy();
            expect(dereg).toHaveBeenCalledTimes(1);
            expect(cmp.eventListeners).toBeNull();
        });
    });
});
