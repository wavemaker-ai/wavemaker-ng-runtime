import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AbstractI18nService, App, AppDefaults, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentFixture } from '@angular/core/testing';
import { IMaskModule } from 'angular-imask';
import { ToDatePipe } from 'projects/components/base/src/pipes/custom-pipes';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../../base/src/test/util/date-test-util';
import { DateComponent } from './date.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    addEventListenerOnElement: jest.fn(() => jest.fn()),
    adjustContainerPosition: jest.fn(),
    adjustContainerRightEdges: jest.fn(),
}));

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    setFocusTrap: jest.fn(() => ({ activate: jest.fn(), deactivate: jest.fn() })),
}));

import { addEventListenerOnElement } from '@wm/core';
import { setFocusTrap } from '@wm/components/base';

@Component({
    standalone: false,
    template: `<div wmDate name="d1" datepattern="yyyy-MM-dd" outputformat="yyyy-MM-dd" ngModel></div>`,
})
class HostComponent {
    @ViewChild(DateComponent, { static: true }) wmComponent: DateComponent;
}

const moduleDef = {
    declarations: [HostComponent],
    imports: [BrowserAnimationsModule, FormsModule, BsDatepickerModule, IMaskModule, DateComponent],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: mockApp },
        { provide: SecurityService, useValue: SecurityService },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: { dateFormat: 'yyyy-MM-dd' } },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
    ],
    teardown: { destroyAfterEach: false },
};

describe('DateComponent - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;
    const input = (value: string): any => ({ target: { value }, stopPropagation: jest.fn(), preventDefault: jest.fn(), type: 'change' });

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.datepattern = 'yyyy-MM-dd';
        cmp.showdropdownon = 'default';
        cmp.bsDatePickerDirective = { toggle: jest.fn(), hide: jest.fn(), isOpen: false, _datepicker: {} };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        fixture.destroy();
    });

    describe('values', () => {
        it('formats the stored date for display, native input and output', () => {
            cmp.bsDataValue = new Date(2024, 2, 5);
            expect(cmp.timestamp).toBe(new Date(2024, 2, 5).getTime());
            expect(cmp.displayValue).toBe('2024-03-05');
            expect(cmp.nativeDisplayValue).toBe('2024-03-05');
            expect(cmp.datavalue).toBe('2024-03-05');
            cmp.bsDataValue = undefined;
            expect(cmp.timestamp).toBeUndefined();
            expect(cmp.datavalue).toBe('');
        });

        it('uses the date format of the mask while the format placeholder is shown', () => {
            cmp.bsDataValue = new Date(2024, 2, 5);
            cmp.showdateformatasplaceholder = true;
            cmp.imask = { maskRef: {} };
            cmp.maskDateInputFormat = 'dd/MM/yyyy';
            expect(cmp.displayValue).toBe('05/03/2024');
            cmp.maskDateInputFormat = undefined;
            expect(cmp.displayValue).toBe('2024-03-05');
        });

        it('falls back to the default input format', () => {
            cmp._dateOptions.dateInputFormat = undefined;
            expect(cmp.dateInputFormat).toBe('yyyy-MM-dd');
        });
    });

    describe('typing a date', () => {
        beforeEach(() => {
            jest.spyOn(cmp, 'minDateMaxDateValidationOnInput').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
        });

        it('skips the change after pressing enter', () => {
            cmp.isEnterPressedOnDateInput = true;
            cmp.onDisplayDateChange(input('2024-03-05'));
            expect(cmp.isEnterPressedOnDateInput).toBe(false);
            expect(cmp.invokeOnChange).not.toHaveBeenCalled();
        });

        it('stores a valid date and raises the change', () => {
            jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.onDisplayDateChange(input('2024-03-05'));
            expect(cmp.datavalue).toBe('2024-03-05');
            expect(cmp.invokeOnChange).toHaveBeenCalledWith('2024-03-05', {}, true);
        });

        it('clears the value for empty input and treats the format placeholder as empty', () => {
            cmp.bsDataValue = new Date(2024, 2, 5);
            cmp.onDisplayDateChange(input(''));
            expect(cmp.datavalue).toBe('');
            expect(cmp.invokeOnChange).toHaveBeenCalled();
            cmp.bsDataValue = new Date(2024, 2, 5);
            cmp.showdateformatasplaceholder = true;
            cmp.maskDateInputFormatPlaceholder = 'dd/mm/yyyy';
            cmp.onDisplayDateChange(input('dd/mm/yyyy'));
            expect(cmp.datavalue).toBe('');
        });

        it('stops on invalid formats', () => {
            jest.spyOn(cmp, 'formatValidation').mockReturnValue(false);
            cmp.onDisplayDateChange(input('bad'));
            expect(cmp.invokeOnChange).not.toHaveBeenCalled();
        });

        it('does not store dates that are out of range', () => {
            jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.dateNotInRange = true;
            cmp.bsDataValue = undefined;
            cmp.onDisplayDateChange(input('2024-03-05'));
            expect(cmp.bsDataValue).toBeUndefined();
        });
    });

    describe('date picker popup', () => {
        beforeEach(() => {
            document.body.insertAdjacentHTML('beforeend', `<div class="bs-datepicker-container"><button>x</button></div><div class="${cmp.dateContainerCls}"></div>`);
        });

        afterEach(() => {
            document.body.querySelectorAll(`.bs-datepicker-container, .${cmp.dateContainerCls}`).forEach((e) => e.remove());
        });

        it('prepares the popup with the selected or the current date', () => {
            cmp.bsDataValue = new Date(2020, 0, 1);
            cmp.onDatePickerOpen();
            expect(cmp.isOpen).toBe(true);
            expect(cmp.activeDate).toBe(cmp.bsDataValue);
            expect(setFocusTrap).toHaveBeenCalled();
            cmp.bsDataValue = undefined;
            cmp.onDatePickerOpen();
            expect(cmp.activeDate).toBeInstanceOf(Date);
        });

        it('resets the picker value for invalid dates and tolerates a failing focus trap', () => {
            (setFocusTrap as jest.Mock).mockReturnValueOnce({ activate: () => { throw new Error('no tabbable'); }, deactivate: jest.fn() });
            cmp.dateNotInRange = true;
            cmp.bsDatePickerDirective._bsValue = 'x';
            expect(() => cmp.onDatePickerOpen()).not.toThrow();
            expect(cmp.bsDatePickerDirective._bsValue).toBeNull();
        });

        it('lets the today button of a time zone date select the date in that zone', () => {
            jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
            const today = document.createElement('button');
            jest.spyOn(document, 'querySelector').mockReturnValue(today);
            cmp.bsDataValue = new Date(2000, 0, 1);
            cmp.onDatePickerOpen();
            today.click();
            expect(cmp.bsDataValue.getFullYear()).toBeGreaterThan(2000);
        });
    });

    describe('dropdown and keyboard', () => {
        it('opens the dropdown and reports clicks', () => {
            const callback = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            const ev: any = { type: 'click', target: document.createElement('button'), stopPropagation: jest.fn() };
            cmp.toggleDpDropdown(ev);
            expect(callback).toHaveBeenCalledWith('click', { $event: ev });
            expect(cmp.bsDatePickerDirective.toggle).toHaveBeenCalledTimes(1);
        });

        it('does not toggle for clicks inside the input when only the button opens the dropdown', () => {
            cmp.showdropdownon = 'button';
            const ev: any = { type: 'focus', target: document.createElement('input'), stopPropagation: jest.fn() };
            cmp.toggleDpDropdown(ev);
            expect(ev.stopPropagation).toHaveBeenCalled();
            expect(cmp.bsDatePickerDirective.toggle).not.toHaveBeenCalled();
        });

        it('focuses the native input on mobile', () => {
            const focus = jest.spyOn(cmp, 'onDateTimeInputFocus').mockImplementation(() => undefined);
            cmp.loadNativeDateInput = true;
            cmp.toggleDpDropdown({ type: 'x', target: null });
            expect(focus).toHaveBeenCalled();
            cmp.toggleDpDropdown({ type: 'x', target: null }, true);
            expect(focus).toHaveBeenCalledTimes(1);
        });

        it('registers a click listener after the picker opened', () => {
            jest.useFakeTimers();
            cmp.addBodyClickListener(true);
            jest.advanceTimersByTime(400);
            (addEventListenerOnElement as jest.Mock).mock.calls[0][5]();
            expect(cmp.isOpen).toBe(false);
            (addEventListenerOnElement as jest.Mock).mockClear();
            cmp.addBodyClickListener(false);
            jest.advanceTimersByTime(400);
            expect(addEventListenerOnElement).not.toHaveBeenCalled();
        });

    });

    describe('typing in the display input', () => {
        const key = (k: string, value: string): any => ({ key: k, target: { value }, stopPropagation: jest.fn(), preventDefault: jest.fn() });

        beforeEach(() => {
            jest.spyOn(cmp, 'hideDatepickerDropdown').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'toggleDpDropdown').mockImplementation(() => undefined);
        });

        it('hides the picker when typing is not allowed to open it or for other keys', () => {
            cmp.showdropdownon = 'button';
            cmp.onDisplayKeydown(key('Enter', '2024-03-05'));
            cmp.showdropdownon = 'default';
            cmp.onDisplayKeydown(key('a', 'x'));
            expect(cmp.hideDatepickerDropdown).toHaveBeenCalledTimes(2);
        });

        it('accepts a valid entry on enter', () => {
            const ev = key('Enter', '2024-03-05');
            cmp.onDisplayKeydown(ev);
            expect(cmp.invalidDateTimeFormat).toBe(false);
            expect(cmp.isEnterPressedOnDateInput).toBe(true);
            expect(cmp.toggleDpDropdown).toHaveBeenCalledWith(ev);
        });

        it('clears the picker for an empty entry and for the format placeholder', () => {
            cmp.onDisplayKeydown(key('Enter', ''));
            expect(cmp.bsDatePickerDirective.bsValue).toBe('');
            cmp.showdateformatasplaceholder = true;
            cmp.maskDateInputFormatPlaceholder = 'dd/mm/yyyy';
            cmp.onDisplayKeydown(key('Enter', 'dd/mm/yyyy'));
            expect(cmp.bsDatePickerDirective.bsValue).toBe('');
        });

        it('flags entries that do not match the pattern', () => {
            cmp.onDisplayKeydown(key('Enter', '2024-13-45'));
            expect(cmp.invalidDateTimeFormat).toBe(true);
            expect(cmp.invokeOnChange).toHaveBeenCalled();
        });

        it('validates timestamps numerically', () => {
            cmp.datepattern = 'timestamp';
            cmp.onDisplayKeydown(key('Enter', '12345'));
            expect(cmp.toggleDpDropdown).toHaveBeenCalled();
        });
    });

    describe('blur and destroy', () => {
        it('raises blur unless the current date button receives the focus', () => {
            const touched = jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            const callback = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.onInputBlur({ relatedTarget: document.createElement('div') });
            expect(touched).toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith('blur', expect.anything());
            touched.mockClear();
            const today = document.createElement('div');
            today.className = 'current-date';
            cmp.onInputBlur({ relatedTarget: today });
            expect(touched).not.toHaveBeenCalled();
        });

        it('deactivates the focus trap and clears the key listener on destroy', () => {
            const trap = { deactivate: jest.fn() };
            const remove = jest.fn();
            cmp.focusTrap = trap;
            cmp.removeKeyupListener = remove;
            cmp.ngOnDestroy();
            expect(trap.deactivate).toHaveBeenCalled();
            expect(remove).toHaveBeenCalled();
            expect(cmp.focusTrap).toBeNull();
            expect(cmp.removeKeyupListener).toBeNull();
        });
    });
});
