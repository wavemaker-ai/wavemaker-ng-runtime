import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BsDatepickerDirective, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { IMaskDirective, IMaskModule } from 'angular-imask';
import { AbstractI18nService, App, AppDefaults, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { ToDatePipe } from 'projects/components/base/src/pipes/custom-pipes';
import { ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../../base/src/test/util/date-test-util';
import { DateComponent } from '../../date/src/date.component';
import { getTimepickerConfig } from './base-date-time.component';

@Component({
    standalone: false,
    template: '<div wmDate name="extraDate" datepattern="yyyy-MM-dd" ngModel></div>',
})
class ExtraDateWrapperComponent {
    @ViewChild(DateComponent, { static: true }) wmComponent: DateComponent;
}

class MockIMaskDirective {
    destroyMask() {}
}

const moduleDef: ITestModuleDef = {
    declarations: [ExtraDateWrapperComponent],
    imports: [BrowserAnimationsModule, FormsModule, BsDatepickerModule, IMaskModule, DateComponent],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: mockApp },
        { provide: SecurityService, useValue: SecurityService },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: IMaskDirective, useClass: MockIMaskDirective },
        { provide: BsDatepickerDirective, useClass: BsDatepickerDirective },
    ],
    teardown: { destroyAfterEach: false },
};

describe('BaseDateTimeComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraDateWrapperComponent>;
    let comp: any;
    let onChange: jest.SpyInstance;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, ExtraDateWrapperComponent);
        comp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        onChange = jest.spyOn(comp, 'invokeOnChange').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('getTimepickerConfig', () => {
        it('uses the localized meridians and falls back to AM and PM', () => {
            const localized = getTimepickerConfig({ getLocalizedMessage: (key: string) => (key === 'LABEL_AM' ? 'vorm.' : undefined) });
            expect(localized.meridians).toEqual(['vorm.', 'PM']);
            expect(getTimepickerConfig({ getLocalizedMessage: () => '' }).meridians).toEqual(['AM', 'PM']);
        });
    });

    describe('meridians', () => {
        it('replaces the internal meridians with the display ones for strings only', () => {
            comp.meridians = ['AM', 'PM'];
            comp.am = 'vorm.';
            comp.pm = 'nachm.';
            expect(comp.safeReplaceMeridians('10:00 AM')).toBe('10:00 vorm.');
            expect(comp.safeReplaceMeridians('10:00 PM')).toBe('10:00 nachm.');
            expect(comp.safeReplaceMeridians(5)).toBe(5);
        });

        it('reads the period from the time value', () => {
            comp.elementScope = { bsTimeValue: undefined };
            expect(comp.getPeriod()).toBe('AM');
            comp.elementScope.bsTimeValue = new Date(2020, 0, 1, 15);
            expect(comp.getPeriod()).toBe('PM');
            comp.elementScope.bsTimeValue = new Date(2020, 0, 1, 9);
            expect(comp.getPeriod()).toBe('AM');
        });

        it('moves the hour when the period is switched on a date picker', () => {
            const onModelUpdate = jest.fn();
            comp.elementScope = { bsTimeValue: new Date(2020, 0, 1, 9), widgetType: 'wm-date', onModelUpdate };
            comp.setPeriod('PM');
            expect(onModelUpdate.mock.calls[0][0].getHours()).toBe(21);
            comp.elementScope.bsTimeValue = new Date(2020, 0, 1, 21);
            comp.setPeriod('AM');
            expect(onModelUpdate.mock.calls[1][0].getHours()).toBe(9);
        });

        it('keeps the hour when the period does not change or the value is invalid', () => {
            const onModelUpdate = jest.fn();
            comp.elementScope = { bsTimeValue: new Date(2020, 0, 1, 9), widgetType: 'wm-date', onModelUpdate };
            comp.setPeriod('AM');
            expect(onModelUpdate.mock.calls[0][0].getHours()).toBe(9);
            comp.elementScope.bsTimeValue = 'not a date';
            comp.setPeriod('PM');
            comp.elementScope.bsTimeValue = undefined;
            comp.setPeriod('PM');
            expect(onModelUpdate).toHaveBeenCalledTimes(1);
        });

        it('updates a time widget only inside its allowed range', () => {
            const onTimeChange = jest.fn();
            comp.elementScope = {
                bsTimeValue: new Date(2020, 0, 1, 9), widgetType: 'wm-time', onTimeChange,
                minTime: new Date(2020, 0, 1, 8), maxTime: new Date(2020, 0, 1, 12),
            };
            comp.setPeriod('PM');
            expect(onTimeChange).not.toHaveBeenCalled();
            comp.elementScope.maxTime = new Date(2020, 0, 1, 23);
            comp.setPeriod('PM');
            expect(onTimeChange).toHaveBeenCalledTimes(1);
            comp.elementScope.minTime = undefined;
            comp.setPeriod('PM');
            expect(onTimeChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('validate', () => {
        const control = (value: any) => ({ value } as any);

        it('flags an invalid format, a date out of range and a time out of range', () => {
            comp.invalidDateTimeFormat = true;
            expect(comp.validate(control('x'))).toEqual({ invalidDateTimeFormat: { valid: false } });
            comp.invalidDateTimeFormat = false;
            comp.dateNotInRange = true;
            expect(comp.validate(control('x'))).toEqual({ dateNotInRange: { valid: false } });
            comp.dateNotInRange = false;
            comp.timeNotInRange = true;
            expect(comp.validate(control('x'))).toEqual({ timeNotInRange: { valid: false } });
        });

        it('requires a value when the widget is shown and required', () => {
            comp.invalidDateTimeFormat = comp.dateNotInRange = comp.timeNotInRange = false;
            comp.show = true;
            comp.required = true;
            expect(comp.validate(control(''))).toEqual({ required: true });
            expect(comp.validate(control('2020-01-01'))).toBeNull();
        });

        it('accepts anything otherwise', () => {
            comp.invalidDateTimeFormat = comp.dateNotInRange = comp.timeNotInRange = false;
            comp.required = false;
            expect(comp.validate(control(''))).toBeNull();
        });
    });

    describe('formatValidation', () => {
        beforeEach(() => {
            comp.meridians = ['AM', 'PM'];
            comp.am = 'AM';
            comp.pm = 'PM';
            comp.datepattern = 'yyyy-MM-dd';
        });

        it('accepts input that matches the pattern', () => {
            expect(comp.formatValidation(new Date(2020, 0, 5), '2020-01-05')).toBe(true);
        });

        it('accepts empty input', () => {
            expect(comp.formatValidation(new Date(2020, 0, 5), '  ')).toBe(true);
        });

        it('rejects input in another format', () => {
            expect(comp.formatValidation(new Date(2020, 0, 5), '05/01/2020')).toBe(false);
            expect(comp.invalidDateTimeFormat).toBe(true);
            expect(comp.validateType).toBe('incorrectformat');
            expect(onChange).toHaveBeenCalledWith(comp.datavalue, undefined, false);
        });

        it('validates timestamps numerically', () => {
            comp.datepattern = 'timestamp';
            const date = new Date(2020, 0, 5);
            expect(comp.formatValidation(date, String(date.getTime()))).toBe(true);
            expect(comp.formatValidation(date, '12345')).toBe(false);
            expect(comp.invalidDateTimeFormat).toBe(true);
        });

        it('formats the input of native pickers before comparing', () => {
            expect(comp.formatValidation(new Date(2020, 0, 5), '2020-01-05', true)).toBe(true);
        });
    });

    describe('minDateMaxDateValidationOnInput', () => {
        let showValidation: jest.SpyInstance;

        beforeEach(() => {
            showValidation = jest.spyOn(comp, 'showValidation').mockImplementation(() => undefined);
            comp.datepattern = 'yyyy-MM-dd';
            comp.mindate = undefined;
            comp.maxdate = undefined;
            comp.excludedates = undefined;
            comp.excludedays = undefined;
            comp.dateNotInRange = false;
        });

        it('clears the range flag for valid input in the browser', () => {
            comp.dateNotInRange = true;
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 5));
            expect(comp.dateNotInRange).toBe(false);
            expect(onChange).toHaveBeenCalledWith(comp.datavalue, undefined, false);
        });

        it('leaves the flag of native pickers alone', () => {
            comp.dateNotInRange = true;
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 5), undefined, '', true);
            expect(comp.dateNotInRange).toBe(true);
        });

        it('rejects dates before the minimum', () => {
            comp.mindate = '2020-06-01';
            const event = { target: document.createElement('input') } as any;
            comp.minDateMaxDateValidationOnInput(new Date(2020, 4, 1), event, '2020-05-01');
            expect(comp.dateNotInRange).toBe(true);
            expect(comp.validateType).toBe('mindate');
            expect(showValidation).toHaveBeenCalledWith(event, '2020-05-01', undefined, expect.stringContaining('2020-06-01'));
        });

        it('restores the minimum in native pickers when it is the displayed value', () => {
            comp.mindate = '2020-06-01';
            const input = document.createElement('input');
            comp.minDateMaxDateValidationOnInput(new Date(2020, 4, 1), { target: input } as any, '2020-06-01', true);
            expect(input.value).toBe('2020-06-01');
            expect(comp.dateNotInRange).toBe(false);
        });

        it('rejects dates after the maximum', () => {
            comp.maxdate = '2020-06-01';
            comp.minDateMaxDateValidationOnInput(new Date(2020, 7, 1), {} as any, '2020-08-01');
            expect(comp.validateType).toBe('maxdate');
            expect(comp.dateNotInRange).toBe(true);
            expect(showValidation).toHaveBeenCalledWith({}, '2020-08-01', undefined, expect.stringContaining('2020-06-01'));
        });

        it('restores the maximum in native pickers when it is the displayed value', () => {
            comp.maxdate = '2020-06-01';
            const input = document.createElement('input');
            comp.minDateMaxDateValidationOnInput(new Date(2020, 7, 1), { target: input } as any, '2020-06-01', true);
            expect(input.value).toBe('2020-06-01');
        });

        it('rejects excluded dates given as a list or a comma separated string', () => {
            comp.excludedates = '2020-06-05,2020-06-06';
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 5));
            expect(comp.validateType).toBe('excludedates');
            expect(comp.dateNotInRange).toBe(true);

            comp.dateNotInRange = false;
            comp.excludedates = ['2020-06-06'];
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 6));
            expect(comp.dateNotInRange).toBe(true);
        });

        it('accepts dates that are not excluded', () => {
            comp.excludedates = '2020-06-05';
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 7));
            expect(comp.dateNotInRange).toBe(false);
        });

        it('rejects excluded weekdays', () => {
            comp.excludedays = '0,6';
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 6)); // saturday
            expect(comp.validateType).toBe('excludedays');
            expect(comp.dateNotInRange).toBe(true);

            comp.dateNotInRange = false;
            comp.minDateMaxDateValidationOnInput(new Date(2020, 5, 8)); // monday
            expect(comp.dateNotInRange).toBe(false);
        });

        it('accepts a plain day number for excluded days', () => {
            comp.excludedays = '3';
            comp.minDateMaxDateValidationOnInput(3 as any);
            expect(comp.dateNotInRange).toBe(true);
        });
    });

    describe('input helpers', () => {
        it('compares the dropdown option names', () => {
            expect(comp.isDropDownDisplayEnabledOnInput('default')).toBe(true);
            expect(comp.isDropDownDisplayEnabledOnInput('button')).toBe(false);
            expect(comp.isDataEntryModeEnabledOnInput('default')).toBe(true);
            expect(comp.isDataEntryModeEnabledOnInput('picker')).toBe(false);
        });

        it('clears the display input', () => {
            const input = document.createElement('input');
            input.className = 'display-input';
            input.value = 'abc';
            comp.nativeElement.appendChild(input);
            comp.resetDisplayInput();
            expect(input.value).toBe('');
        });

        it('derives the seconds and meridian flags from the patterns', () => {
            comp.datepattern = 'hh:mm:ss a';
            comp.updateFormat('datepattern');
            expect(comp._dateOptions.dateInputFormat).toBe('hh:mm:ss a');
            expect(comp.showseconds).toBe(true);
            expect(comp.ismeridian).toBe(true);

            comp.timepattern = 'HH:mm';
            comp.updateFormat('timepattern');
            expect(comp.showseconds).toBe(false);
            expect(comp.ismeridian).toBe(false);
        });

        it('toggles the native widget opacity classes', () => {
            const input = document.createElement('input');
            input.className = 'mobile-input';
            comp.nativeElement.appendChild(input);
            const sibling = document.createElement('span');
            comp.nativeElement.appendChild(sibling);

            comp.loadNativeDateInput = false;
            comp.onDateTimeInputFocus(true);
            expect(input.classList.contains('remove-opacity')).toBe(false);

            comp.loadNativeDateInput = true;
            comp.onDateTimeInputFocus(true);
            expect(input.classList.contains('remove-opacity')).toBe(true);
            expect(sibling.classList.contains('add-opacity')).toBe(true);

            comp.onDateTimeInputBlur();
            expect(input.classList.contains('remove-opacity')).toBe(false);
            expect(sibling.classList.contains('add-opacity')).toBe(false);
        });

        it('focuses and clicks the native input when the user triggered the focus', () => {
            const input = document.createElement('input');
            input.className = 'mobile-input';
            const focus = jest.spyOn(input, 'focus');
            const click = jest.spyOn(input, 'click');
            comp.nativeElement.appendChild(input);
            comp.loadNativeDateInput = true;
            comp._triggeredByUser = true;
            comp.onDateTimeInputFocus();
            expect(focus).toHaveBeenCalledTimes(1);
            expect(click).toHaveBeenCalledTimes(1);
        });

        it('blurs the display input when the picker opens', () => {
            jest.useFakeTimers();
            const input = comp.nativeElement.querySelector('.display-input') as HTMLInputElement;
            const blur = jest.spyOn(input, 'blur');
            comp.blurDateInput(false);
            jest.runAllTimers();
            expect(blur).not.toHaveBeenCalled();
            comp.blurDateInput(true);
            jest.runAllTimers();
            expect(blur).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        it('focuses the input of floating caption widgets', () => {
            jest.useFakeTimers();
            const wrapper = document.createElement('div');
            wrapper.className = 'caption-floating';
            document.body.appendChild(wrapper);
            const host = document.createElement('div');
            const input = document.createElement('input');
            input.className = 'app-textbox';
            host.appendChild(input);
            wrapper.appendChild(host);
            comp.nativeElement = host;
            comp.focusOnInputEl();
            jest.advanceTimersByTime(150);
            expect(document.activeElement).toBe(input);
            jest.useRealTimers();
        });
    });

    describe('keyboard navigation of the day picker', () => {
        const press = (key: string, extra: any = {}) => $('.bs-datepicker-body').trigger($.Event('keydown', { key, ...extra }));
        let setDayFocus: jest.SpyInstance;
        let setMonthFocus: jest.SpyInstance;

        beforeEach(() => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="days"></table></div><div class="bs-datepicker-head"><button class="current">June</button></div>';
            comp.activeDate = new Date(2020, 5, 15);
            comp.elementScope = {
                hideDatepickerDropdown: jest.fn(),
                nativeElement: document.createElement('div'),
            };
            comp.elementScope.nativeElement.innerHTML = '<input class="display-input">';
            setDayFocus = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            setMonthFocus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForDays();
        });

        it.each([
            ['ArrowDown', new Date(2020, 5, 22)],
            ['ArrowUp', new Date(2020, 5, 8)],
            ['ArrowLeft', new Date(2020, 5, 14)],
            ['ArrowRight', new Date(2020, 5, 16)],
            ['PageUp', new Date(2020, 4, 15)],
            ['PageDown', new Date(2020, 6, 15)],
        ])('%s moves the focus to the matching date', (key, expected) => {
            press(key);
            expect(setDayFocus).toHaveBeenCalledWith(expected);
        });

        it('switches to the month list with ctrl and arrow up', () => {
            press('ArrowUp', { ctrlKey: true });
            expect(setMonthFocus).toHaveBeenCalledWith(comp.activeDate);
            expect(setDayFocus).not.toHaveBeenCalled();
        });

        it('selects the focused day and closes the picker on enter', () => {
            jest.useFakeTimers();
            const day = document.createElement('span');
            document.body.appendChild(day);
            day.focus();
            const click = jest.spyOn(day, 'click');
            Object.defineProperty(document, 'activeElement', { configurable: true, get: () => day });
            press('Enter');
            expect(click).toHaveBeenCalled();
            expect(comp.elementScope.hideDatepickerDropdown).toHaveBeenCalledTimes(1);
            jest.runAllTimers();
            delete (document as any).activeElement;
            jest.useRealTimers();
        });

        it('ignores enter on a disabled day', () => {
            const day = document.createElement('span');
            day.className = 'disabled';
            document.body.appendChild(day);
            Object.defineProperty(document, 'activeElement', { configurable: true, get: () => day });
            press('Enter');
            expect(comp.elementScope.hideDatepickerDropdown).not.toHaveBeenCalled();
            delete (document as any).activeElement;
        });

        it('highlights the head buttons on focus and removes it on blur', () => {
            const button = $('.bs-datepicker-head button');
            button.trigger('focus');
            expect(button[0].style.backgroundColor).not.toBe('');
            button.trigger('blur');
            expect(button[0].style.backgroundColor).toBe('');
        });
    });

    describe('keyboard navigation of the month and year pickers', () => {
        const press = (key: string, extra: any = {}) => $('.bs-datepicker-body').trigger($.Event('keydown', { key, ...extra }));

        beforeEach(() => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="months"></table></div><div class="bs-datepicker-head"><button class="current">2020</button></div>';
            comp.activeDate = new Date(2020, 5, 15);
        });

        it.each([
            ['ArrowDown', new Date(2020, 8, 15)],
            ['ArrowUp', new Date(2020, 2, 15)],
            ['ArrowLeft', new Date(2020, 4, 15)],
            ['ArrowRight', new Date(2020, 6, 15)],
        ])('months: %s moves the focus', (key, expected) => {
            const focus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForMonths();
            press(key);
            expect(focus).toHaveBeenCalledWith(expected);
        });

        it('months: ctrl and arrow down opens the days of the active month', () => {
            const days = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForMonths();
            press('ArrowDown', { ctrlKey: true });
            expect(days).toHaveBeenCalledWith(new Date(2020, 5, 1));
        });

        it('months: ctrl and arrow up opens the years', () => {
            const years = jest.spyOn(comp, 'setActiveYearFocus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'loadYears').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForMonths();
            press('ArrowUp', { ctrlKey: true });
            expect(years).toHaveBeenCalledWith(comp.activeDate);
        });

        it.each([
            ['ArrowDown', new Date(2024, 5, 15)],
            ['ArrowUp', new Date(2016, 5, 15)],
            ['ArrowLeft', new Date(2019, 5, 15)],
            ['ArrowRight', new Date(2021, 5, 15)],
        ])('years: %s moves the focus', (key, expected) => {
            const focus = jest.spyOn(comp, 'setActiveYearFocus').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForYears();
            press(key);
            expect(focus).toHaveBeenCalledWith(expected);
        });

        it('years: enter selects the year and shows the months', () => {
            const months = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForYears();
            press('Enter');
            expect(months).toHaveBeenCalledWith(comp.activeDate);
        });
    });

    describe('focus helpers', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            comp.activeDate = new Date(2020, 5, 15);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('moves to the previous or next calendar page and reloads the matching table', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="previous"></button><button class="next"></button></div>';
            const loadDays = jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            const loadMonths = jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            const loadYears = jest.spyOn(comp, 'loadYears').mockImplementation(() => undefined);
            const clicked = jest.fn();
            $('.bs-datepicker-head .next').on('click', clicked);

            comp.goToOtherMonthOryear('next', 'days');
            comp.goToOtherMonthOryear('next', 'month');
            comp.goToOtherMonthOryear('next', 'year');

            expect(clicked).toHaveBeenCalledTimes(3);
            expect(loadDays).toHaveBeenCalledTimes(1);
            expect(loadMonths).toHaveBeenCalledTimes(1);
            expect(loadYears).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the navigation button is disabled', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="next" disabled="disabled"></button></div>';
            const loadDays = jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            comp.goToOtherMonthOryear('next', 'days');
            expect(loadDays).not.toHaveBeenCalled();
        });

        it('tracks the next and previous month names', () => {
            comp.setNextData(new Date(2020, 11, 5));
            expect(comp.next.fullMonth).toBe('January');
            expect(comp.next.date.getFullYear()).toBe(2021);
            expect(comp.prev.fullMonth).toBe('November');
        });

        it('knows whether moving to a date wraps around the year boundary', () => {
            comp.activeDate = new Date(2020, 11, 15);
            expect(comp.isOtheryear(new Date(2021, 0, 1))).toBe(true);
            expect(comp.isOtheryear(new Date(2020, 10, 1))).toBe(false);
            comp.activeDate = new Date(2020, 0, 15);
            expect(comp.isOtheryear(new Date(2019, 11, 31))).toBe(true);
            expect(comp.isOtheryear(new Date(2020, 1, 1))).toBe(false);
        });

        it('focuses the active day of the month and marks it', () => {
            document.body.innerHTML = '<div><span bsdatepickerdaydecorator class="selected">15</span><span bsdatepickerdaydecorator class="is-other-month">15</span></div>';
            const day = document.querySelector('span.selected') as HTMLElement;
            jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveDateFocus(new Date(2020, 5, 15), true);
            jest.runAllTimers();
            expect(day.getAttribute('tabindex')).toBe('0');
            expect(day.getAttribute('aria-label')).toContain('June 15');
            expect(comp.clicked).toBe(false);
        });

        it('navigates to another month for keyboard moves across months and years', () => {
            const go = jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveDateFocus(new Date(2020, 4, 31));
            expect(go).toHaveBeenLastCalledWith('previous', 'days');
            comp.setActiveDateFocus(new Date(2020, 6, 1));
            expect(go).toHaveBeenLastCalledWith('next', 'days');
            comp.activeDate = new Date(2020, 11, 15);
            comp.setActiveDateFocus(new Date(2021, 0, 1));
            expect(go).toHaveBeenLastCalledWith('next', 'days');
            comp.activeDate = new Date(2020, 0, 15);
            comp.setActiveDateFocus(new Date(2019, 11, 31));
            expect(go).toHaveBeenLastCalledWith('previous', 'days');
        });

        it('focuses the active month and navigates across years', () => {
            document.body.innerHTML = '<table class="months"><tbody><tr><td><span>June</span></td></tr></tbody></table>';
            const go = jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveMonthFocus(new Date(2019, 5, 15));
            comp.setActiveMonthFocus(new Date(2021, 5, 15));
            expect(go).toHaveBeenNthCalledWith(1, 'previous', 'month');
            expect(go).toHaveBeenNthCalledWith(2, 'next', 'month');
            comp.setActiveMonthFocus(new Date(2021, 5, 15), true);
            expect(go).toHaveBeenCalledTimes(2);
            jest.runAllTimers();
            expect(comp.activeDate.getFullYear()).toBe(2021);
        });

        it('focuses the active year and navigates across year pages', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="years"><tr><td><span>2016</span></td><td><span>2020</span></td><td><span>2023</span></td></tr></table></div>';
            const go = jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveYearFocus(new Date(2010, 5, 15));
            comp.setActiveYearFocus(new Date(2030, 5, 15));
            expect(go).toHaveBeenNthCalledWith(1, 'previous', 'year');
            expect(go).toHaveBeenNthCalledWith(2, 'next', 'year');
            comp.setActiveYearFocus(new Date(2020, 5, 15));
            jest.runAllTimers();
            expect(document.querySelector('span')!.getAttribute('tabindex')).toBe('-1');
            expect(comp.activeDate.getFullYear()).toBe(2020);
        });
    });

    describe('onPropertyChange', () => {
        let validate: jest.SpyInstance;

        beforeEach(() => {
            validate = jest.spyOn(comp, 'minDateMaxDateValidationOnInput').mockImplementation(() => undefined);
        });

        it('ignores tabindex', () => {
            comp.onPropertyChange('tabindex', 3);
            expect(validate).not.toHaveBeenCalled();
        });

        it('keeps the am/pm button flag and re-emits the value for required', () => {
            const emit = jest.spyOn(comp, '_onChange').mockImplementation(() => undefined);
            comp.onPropertyChange('showampmbuttons', false);
            expect(comp.showampmbuttons).toBe(false);
            comp.onPropertyChange('required', true);
            expect(emit).toHaveBeenCalled();
        });

        it.each([
            ['showweeks', 'showWeekNumbers'],
            ['selectfromothermonth', 'selectFromOtherMonth'],
            ['todaybutton', 'showTodayButton'],
            ['clearbutton', 'showClearButton'],
            ['adaptiveposition', 'adaptivePosition'],
        ])('%s maps to the %s picker option', (key, option) => {
            comp.onPropertyChange(key, true);
            expect(comp._dateOptions[option]).toBe(true);
        });

        it('uses the localized label of the today and clear buttons or the value itself', () => {
            jest.spyOn(comp.i18nService, 'getLocalizedMessage').mockImplementation((key: any) => (key === 'LABEL_X' ? 'Localized' : undefined));
            comp.onPropertyChange('todaybuttonlabel', 'LABEL_X');
            expect(comp._dateOptions.todayButtonLabel).toBe('Localized');
            comp.onPropertyChange('clearbuttonlabel', 'Plain');
            expect(comp._dateOptions.clearButtonLabel).toBe('Plain');
        });

        it('updates the view mode and the format', () => {
            comp.viewmode = 'month';
            comp.onPropertyChange('viewmode', 'month');
            expect(comp._dateOptions.minMode).toBe('month');
            const update = jest.spyOn(comp, 'updateFormat').mockImplementation(() => undefined);
            comp.onPropertyChange('datepattern', 'yyyy');
            expect(update).toHaveBeenCalledWith('datepattern');
        });

        it('applies minimum and maximum dates, including the current date keyword', () => {
            comp.onPropertyChange('mindate', '2020-01-01');
            expect(comp._dateOptions.minDate).toEqual(new Date(2020, 0, 1));
            comp.onPropertyChange('maxdate', 'CURRENT_DATE');
            expect(comp.maxdate).toBeInstanceOf(Date);
            expect(comp._dateOptions.maxDate).toBe(comp.maxdate);
            comp.onPropertyChange('mindate', 'CURRENT_DATE');
            expect(comp.mindate).toBeInstanceOf(Date);
            expect(validate).toHaveBeenCalledTimes(3);
        });

        it('collects the excluded days and dates to disable in the picker', () => {
            comp.excludedays = '0,6';
            comp.excludedates = '2020-06-05,2020-06-06';
            comp.onPropertyChange('excludedays', '0,6');
            expect(comp.excludedDaysToDisable).toEqual([0, 6]);
            expect(comp.excludedDatesToDisable.length).toBe(2);
            expect(comp.excludedDatesToDisable[0]).toEqual(new Date(2020, 5, 5));

            comp.excludedates = [new Date(2020, 1, 1)];
            comp.onPropertyChange('excludedates', comp.excludedates);
            expect(comp.excludedDatesToDisable.length).toBe(1);
        });

        it('keeps a pristine control pristine when validations change', () => {
            const markAsPristine = jest.fn();
            Object.defineProperty(comp, 'formControl', { configurable: true, value: { pristine: true, control: { markAsPristine } } });
            comp.onPropertyChange('mindate', '2020-01-01');
            expect(markAsPristine).toHaveBeenCalled();
        });

        it('updates the native input flag for showcustompicker', () => {
            comp.showcustompicker = true;
            comp.onPropertyChange('showcustompicker', true);
            expect(comp.loadNativeDateInput).toBe(false);
        });
    });

    describe('lifecycle', () => {
        it('detaches the modal date time picker', () => {
            const hideModal = jest.fn();
            comp.datetimepickerComponent = { hideModal };
            comp.ngOnDetach();
            expect(hideModal).toHaveBeenCalledTimes(1);
        });

        it('delegates the timezone to the i18n service', () => {
            const setTimezone = jest.fn();
            comp.i18nService.setTimezone = setTimezone;
            comp.setTimezone('en');
            expect(setTimezone).toHaveBeenCalledWith('en', comp);
        });

        it('unsubscribes on destroy', () => {
            const unsubscribe = jest.fn();
            const cancel = jest.fn();
            comp.dateOnShowSubscription = { unsubscribe };
            comp.cancelLocaleChangeSubscription = cancel;
            comp.ngOnDestroy();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
            expect(cancel).toHaveBeenCalledTimes(1);
        });

        it('stretches the mobile input after the view init', () => {
            jest.useFakeTimers();
            const mobile = document.createElement('input');
            mobile.className = 'mobile-input';
            comp.nativeElement.appendChild(mobile);
            comp.dataentrymode = 'picker';
            comp.ngAfterViewInit();
            jest.runAllTimers();
            expect(mobile.style.width).toBe('100%');
            expect(comp.isReadOnly).toBe(true);
        });
    });

    describe('time picker events', () => {
        let scope: any;

        const markup = `
            <div id="tp">
                <div class="fields">
                    <div class="form-group"><input class="bs-timepicker-field" value="10"></div>
                    <div class="form-group"><input class="bs-timepicker-field" value=""></div>
                    <div class="form-group"><input class="bs-timepicker-field" value=""></div>
                </div>
                <a><span class="bs-chevron-up"></span></a>
                <a><span class="bs-chevron-down"></span></a>
                <button class="btn-default"></button>
            </div>`;

        beforeEach(() => {
            document.body.innerHTML = markup;
            scope = {
                hideTimepickerDropdown: jest.fn(),
                setIsTimeOpen: jest.fn(),
                datePipe: undefined as any,
                displayValue: '',
                bsTimeValue: new Date(2020, 0, 1, 10),
            };
            scope.datePipe = comp.datePipe;
            comp.elementScope = scope;
            jest.spyOn(comp, 'focus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'timeFormatValidation').mockImplementation(() => undefined);
            comp.bsTimePicker = { updateMinutes: jest.fn(), updateSeconds: jest.fn() };
            comp.addEventsOnTimePicker($('#tp'));
        });

        const key = (selector: string, k: string, extra: any = {}) => $(selector).trigger($.Event('keydown', { key: k, ...extra }));
        const field = (index: number) => `.bs-timepicker-field:eq(${index})`;

        it('closes the dropdown on escape', () => {
            key(field(0), 'Escape');
            expect(scope.hideTimepickerDropdown).toHaveBeenCalledTimes(1);
            expect(scope.setIsTimeOpen).toHaveBeenCalledWith(false);
        });

        it('returns the focus to the widget from the first field on shift tab and enter', () => {
            key(field(0), 'Tab', { shiftKey: true });
            key(field(0), 'Enter');
            expect(scope.setIsTimeOpen).toHaveBeenCalledTimes(2);
            expect(comp.focus).toHaveBeenCalledTimes(2);
        });

        it('closes from the last field on tab and enter', () => {
            key(field(2), 'Tab');
            key(field(2), 'Enter');
            expect(scope.setIsTimeOpen).toHaveBeenCalledTimes(2);
        });

        it('closes from the middle field on enter only', () => {
            key(field(1), 'ArrowRight');
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
            key(field(1), 'Enter');
            expect(scope.setIsTimeOpen).toHaveBeenCalledWith(false);
        });

        it('keeps the value inside the range when the time is invalid', () => {
            scope.mintime = true;
            scope.maxtime = true;
            scope.minTime = new Date(2020, 0, 1, 8);
            scope.maxTime = new Date(2020, 0, 1, 18);
            scope.bsTimeValue = undefined;
            key(field(1), 'ArrowDown');
            expect(scope.bsTimeValue).toBe(scope.maxTime);
            scope.bsTimeValue = undefined;
            key(field(1), 'ArrowUp');
            expect(scope.bsTimeValue).toBe(scope.minTime);
        });

        it('validates the format when the arrows change a field', () => {
            key(field(1), 'ArrowUp');
            expect(comp.timeFormatValidation).toHaveBeenCalled();
        });

        it('commits the value on tab when the display value matches', () => {
            const display = document.createElement('input');
            display.className = 'display-input';
            comp.nativeElement.appendChild(display);
            scope.datePipe = comp.datePipe;
            comp.timepattern = 'HH';
            comp.datepattern = undefined;
            scope.displayValue = '10';
            key(field(1), 'Tab');
            expect(comp.invalidDateTimeFormat).toBe(false);
            expect(onChange).toHaveBeenCalled();
        });

        it('closes the dropdown from the buttons on tab and escape', () => {
            key('.btn-default', 'Tab');
            key('.btn-default', 'Escape');
            expect(scope.setIsTimeOpen).toHaveBeenCalledTimes(2);
        });

        it('fills the minute and second fields after typing the hour', () => {
            jest.useFakeTimers();
            const hour = $(field(0));
            hour.val('1');
            hour.trigger('keyup');
            jest.advanceTimersByTime(600);
            expect(comp.bsTimePicker.updateMinutes).toHaveBeenCalled();
            expect(comp.bsTimePicker.updateSeconds).toHaveBeenCalled();
        });

        it('updates immediately when the hour has two digits', () => {
            const hour = $(field(0));
            hour.val('10');
            hour.trigger('keyup');
            expect(comp.bsTimePicker.updateMinutes).toHaveBeenCalled();
        });

        it('stops listening to the keyup events on demand', () => {
            comp.removeKeyupListener();
            const hour = $(field(0));
            hour.val('10');
            hour.trigger('keyup');
            expect(comp.bsTimePicker.updateMinutes).not.toHaveBeenCalled();
        });

        it('validates the format and keeps the range when the arrows are clicked', () => {
            scope.mintime = true;
            scope.maxtime = true;
            scope.minTime = new Date(2020, 0, 1, 8);
            scope.maxTime = new Date(2020, 0, 1, 18);
            scope.bsTimeValue = undefined;
            $('#tp a:eq(1)').trigger('click');
            expect(scope.bsTimeValue).toBe(scope.maxTime);
            scope.bsTimeValue = undefined;
            $('#tp a:eq(0)').trigger('click');
            expect(scope.bsTimeValue).toBe(scope.minTime);
            expect(comp.timeFormatValidation).toHaveBeenCalledTimes(2);
        });

        it('marks the time picker popup as focusable and wires its events', () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<bs-dropdown-container><timepicker><div class="form-group"><input class="bs-timepicker-field form-control"></div></timepicker></bs-dropdown-container>';
            const add = jest.spyOn(comp, 'addEventsOnTimePicker').mockImplementation(() => undefined);
            comp.bindTimePickerKeyboardEvents();
            jest.runAllTimers();
            expect(add).toHaveBeenCalled();
            expect($('timepicker').attr('tabindex')).toBe('0');
        });

        it('focuses the hours input of the opened time picker', () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<timepicker><div class="form-group"><input class="form-control"></div></timepicker>';
            const hours = document.querySelector('input') as HTMLInputElement;
            const focus = jest.spyOn(hours, 'focus');
            comp.focusTimePickerPopover({ ngZone: { runOutsideAngular: (fn: () => void) => fn() } });
            jest.advanceTimersByTime(20);
            expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        });
    });

    describe('timeFormatValidation and isValidDate', () => {
        it('accepts valid dates only', () => {
            expect(comp.isValidDate(new Date())).toBe(true);
            expect(comp.isValidDate(new Date('x'))).toBe(false);
            expect(comp.isValidDate('2020-01-01')).toBe(false);
            expect(comp.isValidDate(undefined)).toBeUndefined();
        });

        it('re-validates the typed time and reports the change when it is valid', () => {
            const input = document.createElement('input');
            input.value = '2020-06-05';
            comp.nativeElement.appendChild(input);
            comp.datepattern = 'yyyy-MM-dd';
            comp.meridians = ['AM', 'PM'];
            comp.am = 'AM';
            comp.pm = 'PM';
            jest.spyOn(comp, 'formatValidation').mockReturnValue(true);
            comp.timeFormatValidation();
            expect(comp.invalidDateTimeFormat).toBe(false);
            expect(onChange).toHaveBeenCalledWith(comp.datavalue, undefined, false);
        });

        it('stops when the typed time has the wrong format', () => {
            jest.spyOn(comp, 'formatValidation').mockReturnValue(false);
            comp.timeFormatValidation();
            expect(onChange).not.toHaveBeenCalled();
        });
    });
});
