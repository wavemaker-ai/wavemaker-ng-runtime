import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AbstractI18nService, App, AppDefaults, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { ToDatePipe } from '../../../../../base/src/pipes/custom-pipes';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../../base/src/test/util/date-test-util';
import { DatetimeComponent } from './date-time.component';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    setFocusTrap: jest.fn(() => ({ activate: jest.fn(), deactivate: jest.fn() })),
}));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    addEventListenerOnElement: jest.fn(() => jest.fn()),
    adjustContainerPosition: jest.fn(),
}));

import { addEventListenerOnElement } from '@wm/core';

@Component({
    standalone: false,
    template: `<div wmDateTime name="dt" outputformat="yyyy-MM-ddTHH:mm:ss" datepattern="yyyy-MM-dd HH:mm:ss" ngModel></div>`,
})
class HostComponent {
    @ViewChild(DatetimeComponent, { static: true }) wmComponent: DatetimeComponent;
}

const moduleDef = {
    declarations: [HostComponent],
    imports: [BrowserAnimationsModule, DatetimeComponent, FormsModule, BsDropdownModule, TimepickerModule, BsDatepickerModule],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: mockApp },
        { provide: SecurityService, useValue: SecurityService },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: { dateTimeFormat: 'yyyy-MM-dd HH:mm:ss' } },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
    ],
    teardown: { destroyAfterEach: false },
};

describe('DatetimeComponent - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.datepattern = 'yyyy-MM-dd HH:mm:ss';
        cmp.showdropdownon = 'default';
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        fixture.destroy();
    });

    describe('data value', () => {
        it('stores dates and formats them', () => {
            cmp.datavalue = '2024-03-05T10:20:30';
            expect(cmp.datavalue).toBe('2024-03-05T10:20:30');
            expect(cmp.timestamp).toBe(new Date(2024, 2, 5, 10, 20, 30).getTime());
            expect(cmp.displayValue).toContain('2024-03-05');
            expect(cmp.nativeDisplayValue).toBe('2024-03-05T10:20:30');
            expect(cmp.bsDateValue).toBe(cmp.bsTimeValue);
        });

        it('clears the value and the timer', () => {
            cmp.datavalue = '2024-03-05T10:20:30';
            cmp.datavalue = undefined;
            expect(cmp.timestamp).toBeUndefined();
            expect(cmp.isCurrentDate).toBe(false);
        });

        it('keeps a timer for the current date and returns the marker', () => {
            jest.useFakeTimers();
            const update = jest.spyOn(cmp, 'onModelUpdate').mockImplementation(() => undefined);
            cmp.datavalue = 'CURRENT_DATE';
            cmp.proxyModel = undefined;
            expect(cmp.isCurrentDate).toBe(true);
            expect(cmp.datavalue).toBe('CURRENT_DATE');
            cmp.setTimeInterval();
            jest.advanceTimersByTime(2100);
            expect(update).toHaveBeenCalledTimes(2);
            cmp.datavalue = '2024-01-01T00:00:00';
            expect(cmp.timeinterval).toBeNull();
            expect(cmp.isCurrentDate).toBe(false);
        });

        it('uses the configured time zone for the timer', () => {
            jest.useFakeTimers();
            const update = jest.spyOn(cmp, 'onModelUpdate').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
            cmp.setTimeInterval();
            jest.advanceTimersByTime(1100);
            expect(update).toHaveBeenCalled();
            cmp.clearTimeInterval();
            cmp.clearTimeInterval();
        });

        it('falls back to a default input format', () => {
            cmp._dateOptions.dateInputFormat = undefined;
            expect(cmp.dateInputFormat).toBe('yyyy-MM-ddTHH:mm:ss');
        });
    });

    describe('time pattern', () => {
        it.each([
            ['yyyy-MM-dd HH:mm:ss', 'HH:mm:ss'],
            ['yyyy-MM-dd hh:mm a', 'hh:mm a a'],
            ['yyyy-MM-dd HH:mm', 'HH:mm'],
        ])('derives the time pattern from %s', (pattern, expected) => {
            cmp.datepattern = pattern;
            expect(cmp.getTimePattern().trim()).toBe(expected);
        });

        it('updates the timepicker fields with formatted time', () => {
            const fields = [{ value: '' }, { value: '' }, { value: '' }] as any;
            document.body.innerHTML = '<timepicker><button class="text-center">AM</button></timepicker>';
            cmp.updateTimepickerFields('10:20:30 PM', fields);
            expect(fields.map((f: any) => f.value)).toEqual(['10', '20', '30']);
            expect($('timepicker button.text-center').text()).toBe('PM');
            document.body.innerHTML = '';
        });
    });

    describe('pickers', () => {
        it('opens the time dropdown and registers an outside click listener', () => {
            jest.useFakeTimers();
            const callback = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.loadNativeDateInput = false;
            cmp.toggleTimePicker(true, { type: 'click' });
            expect(cmp.isTimeOpen).toBe(true);
            expect(callback).toHaveBeenCalledWith('click', { $event: { type: 'click' } });
            jest.advanceTimersByTime(400);
            expect(addEventListenerOnElement).toHaveBeenCalled();
            (addEventListenerOnElement as jest.Mock).mock.calls[0][5]();
            expect(cmp.isTimeOpen).toBe(false);
        });

        it('does not listen when closing and delegates to the native input on mobile', () => {
            cmp.toggleTimePicker(false);
            expect(addEventListenerOnElement).not.toHaveBeenCalled();
            const focus = jest.spyOn(cmp, 'onDateTimeInputFocus').mockImplementation(() => undefined);
            cmp.loadNativeDateInput = true;
            cmp.toggleTimePicker(true);
            expect(focus).toHaveBeenCalled();
            cmp.toggleDpDropdown({ type: 'click' });
            expect(focus).toHaveBeenCalledTimes(2);
            cmp.toggleDpDropdown({ type: 'click' }, true);
            expect(focus).toHaveBeenCalledTimes(2);
        });

        it('toggles the date picker and raises click events', () => {
            const directive = { toggle: jest.fn(), hide: jest.fn(), isOpen: false, _bsValue: 'x' };
            cmp.bsDatePickerDirective = directive;
            const callback = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.loadNativeDateInput = false;
            const ev: any = { type: 'click', target: document.createElement('button'), stopPropagation: jest.fn() };
            cmp.toggleDpDropdown(ev);
            expect(callback).toHaveBeenCalledWith('click', { $event: ev });
            expect(directive.toggle).toHaveBeenCalled();
            cmp.dateNotInRange = true;
            cmp.toggleDpDropdown(ev);
            expect(directive._bsValue).toBeNull();
        });

        it('does not toggle for clicks inside the input when the dropdown opens on the button only', () => {
            const directive = { toggle: jest.fn(), hide: jest.fn(), isOpen: false };
            cmp.bsDatePickerDirective = directive;
            cmp.loadNativeDateInput = false;
            cmp.showdropdownon = 'button';
            const ev: any = { type: 'focus', target: document.createElement('input'), stopPropagation: jest.fn() };
            cmp.toggleDpDropdown(ev);
            expect(ev.stopPropagation).toHaveBeenCalled();
            expect(directive.toggle).not.toHaveBeenCalled();
        });

        it('registers a body listener while the date picker is open', () => {
            jest.useFakeTimers();
            const directive = { toggle: jest.fn(), hide: jest.fn(), isOpen: true };
            cmp.bsDatePickerDirective = directive;
            cmp.addBodyClickListener(true);
            jest.advanceTimersByTime(400);
            (addEventListenerOnElement as jest.Mock).mock.calls[0][5]();
            expect(directive.hide).toHaveBeenCalled();
            (addEventListenerOnElement as jest.Mock).mockClear();
            cmp.addBodyClickListener(false);
            jest.advanceTimersByTime(400);
            expect(addEventListenerOnElement).not.toHaveBeenCalled();
        });

        it('hides the date picker, opens the time dropdown and notifies floating captions', () => {
            const directive = { hide: jest.fn() };
            cmp.bsDatePickerDirective = directive;
            cmp.bsDateValue = new Date();
            cmp.focusTrap = { deactivate: jest.fn() };
            const dereg = jest.fn();
            cmp.deregisterDatepickerEventListener = dereg;
            const toggle = jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
            const blur = jest.spyOn(cmp, 'blurDateInput').mockImplementation(() => undefined);
            const notify = jest.spyOn(mockApp, 'notify').mockImplementation(() => undefined);
            $(cmp.nativeElement).wrap('<div class="app-composite-widget caption-floating"></div>');
            cmp.hideDatepickerDropdown();
            expect(directive.hide).toHaveBeenCalled();
            expect(toggle).toHaveBeenCalledWith(true);
            expect(dereg).toHaveBeenCalled();
            expect(notify).toHaveBeenCalledWith('captionPositionAnimate', expect.anything());
            expect(blur).toHaveBeenCalledWith(false);
            expect(cmp.focusTrap.deactivate).toHaveBeenCalled();
        });

        it('hides the time dropdown and notifies floating captions', () => {
            const touched = jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            const toggle = jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
            const notify = jest.spyOn(mockApp, 'notify').mockImplementation(() => undefined);
            const dereg = jest.fn();
            cmp.deregisterTimepickeEventListener = dereg;
            $(cmp.nativeElement).wrap('<div class="app-composite-widget caption-floating"></div>');
            cmp.hideTimepickerDropdown();
            expect(touched).toHaveBeenCalled();
            expect(toggle).toHaveBeenCalledWith(false);
            expect(dereg).toHaveBeenCalled();
            expect(notify).toHaveBeenCalled();
        });

        it('prevents the timepicker from closing while changing values', () => {
            const ev: any = { stopImmediatePropagation: jest.fn() };
            cmp.preventTpClose(ev);
            expect(ev.stopImmediatePropagation).toHaveBeenCalled();
        });
    });

    describe('onDatePickerOpen / onTimepickerOpen', () => {
        it('prepares the date picker popup', () => {
            cmp.bsDatePickerDirective = { _datepicker: {}, hide: jest.fn() };
            jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'addDatepickerKeyboardEvents').mockImplementation(() => undefined);
            document.body.insertAdjacentHTML('beforeend', '<div class="bs-datepicker-container"><button>x</button></div>');
            cmp.bsDateValue = new Date(2020, 0, 1);
            cmp.onDatePickerOpen();
            expect(cmp.isDateOpen).toBe(true);
            expect(cmp.activeDate).toBe(cmp.bsDateValue);
            cmp.bsDateValue = undefined;
            cmp.onDatePickerOpen();
            expect(cmp.activeDate).toBeInstanceOf(Date);
            document.body.querySelectorAll('.bs-datepicker-container').forEach((e) => e.remove());
        });

        it('prepares the timepicker popup and clears the time on invalid dates', () => {
            const hide = jest.fn();
            cmp.bsDatePickerDirective = { hide };
            cmp.bsDropdown = { _dropdown: {} };
            jest.spyOn(cmp, 'focusTimePickerPopover').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'bindTimePickerKeyboardEvents').mockImplementation(() => undefined);
            document.body.insertAdjacentHTML('beforeend', '<div><timepicker></timepicker></div>');
            cmp.dateNotInRange = true;
            cmp.bsTimeValue = new Date();
            cmp.onTimepickerOpen();
            expect(cmp.bsTimeValue).toBeNull();
            expect(hide).toHaveBeenCalled();
            expect(document.querySelector('timepicker').parentElement.classList.contains('app-datetime')).toBe(true);
            document.body.innerHTML = '';
        });
    });

    describe('onModelUpdate', () => {
        beforeEach(() => {
            jest.spyOn(cmp, 'minDateMaxDateValidationOnInput').mockImplementation(() => undefined);
            jest.spyOn(cmp, '_debouncedOnChange').mockImplementation(() => undefined);
            cmp._debouncedOnChange = jest.fn();
        });

        it('stores a new valid value', () => {
            const d = new Date(2024, 0, 2, 3, 4, 5);
            cmp.onModelUpdate(d);
            expect(cmp.proxyModel).toBe(d);
            expect(cmp.bsDateValue).toBe(d);
            expect(cmp.bsTimeValue).toBe(d);
            expect(cmp._debouncedOnChange).toHaveBeenCalled();
        });

        it('stores out of range values without updating the pickers', () => {
            const d = new Date(2024, 0, 2);
            cmp.dateNotInRange = true;
            cmp.onModelUpdate(d);
            expect(cmp.proxyModel).toBe(d);
            expect(cmp.bsDateValue).not.toBe(d);
        });

        it('resets the formatting flag and opens the time picker for date selections', () => {
            const toggle = jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
            cmp.invalidDateTimeFormat = true;
            cmp.isDateOpen = true;
            cmp.onModelUpdate(new Date(2024, 0, 2), 'date');
            expect(cmp.invalidDateTimeFormat).toBe(false);
            expect(toggle).toHaveBeenCalledWith(true);
        });

        it('clears the value when emptied', () => {
            cmp.proxyModel = new Date();
            cmp.bsDateValue = undefined;
            cmp.prevDatavalue = '2020-01-01T00:00:00';
            cmp.onModelUpdate(undefined);
            expect(cmp.proxyModel).toBeUndefined();
            expect(cmp._debouncedOnChange).toHaveBeenCalled();
        });

        it('resets to midnight when a time field was emptied after picking a date', () => {
            cmp.bsDateValue = new Date(2024, 0, 2, 10, 11, 12);
            cmp.bsTimePicker = { hours: '', minutes: '1', seconds: '1' };
            cmp.onModelUpdate(undefined);
            expect(cmp.proxyModel.getHours()).toBe(0);
            expect(cmp.proxyModel.getMinutes()).toBe(0);
        });

        it('applies the time zone to values entered without a date', () => {
            jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
            cmp.bsDateValue = undefined;
            cmp.onModelUpdate(new Date(2024, 0, 2));
            expect(cmp.proxyModel).toBeDefined();
        });
    });

    describe('onDateChange', () => {
        const ev = (value: string): any => ({ target: { value } });

        it('skips the change after pressing enter', () => {
            const update = jest.spyOn(cmp, 'onModelUpdate').mockImplementation(() => undefined);
            cmp.isEnterPressedOnDateInput = true;
            cmp.onDateChange(ev('2024-01-02 03:04:05'));
            expect(update).not.toHaveBeenCalled();
            expect(cmp.isEnterPressedOnDateInput).toBe(false);
        });

        it('updates the model with the parsed value', () => {
            const update = jest.spyOn(cmp, 'onModelUpdate').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.onDateChange(ev(' 2024-01-02 03:04:05 '));
            expect(update).toHaveBeenCalledWith(expect.any(Date));
            update.mockClear();
            cmp.onDateChange(ev(''));
            expect(update).toHaveBeenCalledWith(undefined);
        });

        it('stops on invalid formats and on native date range errors', () => {
            const update = jest.spyOn(cmp, 'onModelUpdate').mockImplementation(() => undefined);
            const format = jest.spyOn(cmp, 'formatValidation').mockReturnValue(false);
            cmp.onDateChange(ev('bad'));
            expect(update).not.toHaveBeenCalled();
            format.mockReturnValue(true);
            jest.spyOn(cmp, 'minDateMaxDateValidationOnInput').mockReturnValue(true);
            cmp.onDateChange(ev('2024-01-02 03:04:05'), true);
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe('display keydown', () => {
        const key = (k: string, value: string): any => ({
            key: k,
            target: { value },
            stopPropagation: jest.fn(),
            preventDefault: jest.fn(),
        });

        beforeEach(() => {
            cmp.bsDatePickerDirective = { toggle: jest.fn(), hide: jest.fn(), isOpen: false };
            jest.spyOn(cmp, 'hideDatepickerDropdown').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'hideTimepickerDropdown').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'toggleDpDropdown').mockImplementation(() => undefined);
        });

        it('hides the dropdowns when the dropdown is not allowed on the input', () => {
            cmp.showdropdownon = 'button';
            cmp.onDisplayKeydown(key('Enter', ''));
            expect(cmp.hideDatepickerDropdown).toHaveBeenCalled();
            expect(cmp.hideTimepickerDropdown).toHaveBeenCalled();
        });

        it('hides the dropdowns for other keys', () => {
            cmp.onDisplayKeydown(key('a', 'x'));
            expect(cmp.hideDatepickerDropdown).toHaveBeenCalled();
        });

        it('accepts a valid typed value on enter', () => {
            const e = key('Enter', '2024-01-02 03:04:05');
            cmp.onDisplayKeydown(e);
            expect(cmp.invalidDateTimeFormat).toBe(false);
            expect(cmp.isEnterPressedOnDateInput).toBe(true);
            expect(cmp.toggleDpDropdown).toHaveBeenCalledWith(e);
        });

        it('flags a value that does not match the pattern', () => {
            cmp.onDisplayKeydown(key('ArrowDown', '2024-13-45 99:99:99'));
            expect(cmp.invalidDateTimeFormat).toBe(true);
            expect(cmp.invokeOnChange).toHaveBeenCalled();
        });

        it('validates timestamps numerically', () => {
            cmp.datepattern = 'timestamp';
            cmp.onDisplayKeydown(key('Enter', '12345'));
            expect(cmp.toggleDpDropdown).toHaveBeenCalled();
        });

        it('clears the picker value for an empty entry', () => {
            cmp.onDisplayKeydown(key('Enter', ''));
            expect(cmp.bsDatePickerDirective.bsValue).toBeUndefined();
        });
    });

    describe('misc handlers', () => {
        it('only validates the format of empty events', () => {
            const format = jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.isValid({});
            expect(format).not.toHaveBeenCalled();
            $(cmp.nativeElement).find('input').first().val('2024-01-02 03:04:05');
            cmp.isValid(undefined);
            expect(format).toHaveBeenCalled();
            format.mockReturnValue(false);
            expect(cmp.isValid(null)).toBeUndefined();
        });

        it('forwards only unmanaged events to the base class', () => {
            const node = document.createElement('div');
            const cb = jest.fn();
            const spy = jest.spyOn(Object.getPrototypeOf(DatetimeComponent.prototype), 'handleEvent').mockImplementation(() => undefined);
            cmp.handleEvent(node, 'blur', cb, {});
            cmp.handleEvent(node, 'change', cb, {});
            expect(spy).not.toHaveBeenCalled();
            cmp.handleEvent(node, 'mouseenter', cb, {});
            expect(spy).toHaveBeenCalledTimes(1);
        });

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
    });
});
