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
    getFormattedDate: jest.fn((...a: any[]) => jest.requireActual('@wm/core').getFormattedDate(...a)),
    addEventListenerOnElement: jest.fn(() => jest.fn()),
    adjustContainerPosition: jest.fn(),
}));

import { addEventListenerOnElement, getFormattedDate } from '@wm/core';

@Component({
    standalone: false,
    template: `<div wmDateTime name="dt" outputformat="yyyy-MM-ddTHH:mm:ss" datepattern="yyyy-MM-dd HH:mm:ss" ngModel></div>`,
})
class CoverHostComponent {
    @ViewChild(DatetimeComponent, { static: true }) wmComponent: DatetimeComponent;
}

const moduleDef = {
    declarations: [CoverHostComponent],
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

describe('DatetimeComponent - coverage gaps', () => {
    let fixture: ComponentFixture<CoverHostComponent>;
    let cmp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, CoverHostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.datepattern = 'yyyy-MM-dd HH:mm:ss';
        cmp.showdropdownon = 'default';
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        fixture.destroy();
        document.body.innerHTML = '';
    });

    it('returns an empty native display value when there is no model', () => {
        cmp.proxyModel = undefined;
        expect(cmp.nativeDisplayValue).toBe('');
    });

    it('hides the timepicker without a listener or floating-caption parent', () => {
        cmp.deregisterTimepickeEventListener = undefined;
        const toggle = jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
        const notify = jest.spyOn(cmp.app, 'notify');
        cmp.hideTimepickerDropdown();
        expect(toggle).toHaveBeenCalledWith(false);
        expect(notify).not.toHaveBeenCalledWith('captionPositionAnimate', expect.anything());
    });

    describe('onTimepickerOpen', () => {
        beforeEach(() => {
            cmp.bsDatePickerDirective = { hide: jest.fn() };
            jest.spyOn(cmp, 'focusTimePickerPopover').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'bindTimePickerKeyboardEvents').mockImplementation(() => undefined);
            cmp.bsDropdown = { _dropdown: {} };
            cmp.bsTimeValue = new Date();
        });

        it('keeps the time value when the date is valid', () => {
            cmp.dateNotInRange = false;
            cmp.invalidDateTimeFormat = false;
            const v = cmp.bsTimeValue;
            cmp.onTimepickerOpen();
            expect(cmp.bsTimeValue).toBe(v);
            expect(cmp.bsDatePickerDirective.hide).toHaveBeenCalled();
        });

        it('clears the time value when the format is invalid', () => {
            cmp.dateNotInRange = false;
            cmp.invalidDateTimeFormat = true;
            cmp.onTimepickerOpen();
            expect(cmp.bsTimeValue).toBeNull();
        });
    });

    describe('onModelUpdate clearing', () => {
        beforeEach(() => {
            jest.spyOn(cmp, '_debouncedOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'minDateMaxDateValidationOnInput').mockImplementation(() => undefined);
        });

        it('resets to start of day when the minutes field is blank', () => {
            cmp.bsDateValue = new Date(2024, 2, 5, 10, 20);
            cmp.bsTimePicker = { hours: '1', minutes: '', seconds: '1' };
            cmp.onModelUpdate(undefined);
            expect(cmp.bsDateValue.getHours()).toBe(0);
        });

        it('resets to start of day when the seconds field is blank', () => {
            cmp.bsDateValue = new Date(2024, 2, 5, 10, 20);
            cmp.bsTimePicker = { hours: '1', minutes: '1', seconds: '' };
            cmp.onModelUpdate(undefined);
            expect(cmp.bsDateValue.getHours()).toBe(0);
        });

        it('clears everything when all time fields are filled', () => {
            cmp.bsDateValue = new Date(2024, 2, 5, 10, 20);
            cmp.bsTimePicker = { hours: '1', minutes: '1', seconds: '1' };
            cmp.onModelUpdate(undefined);
            expect(cmp.bsDateValue).toBeUndefined();
        });
    });

    it('computes the time pattern when the date pattern has no minutes', () => {
        cmp.datepattern = 'yyyy-MM-dd h';
        expect(cmp.getTimePattern()).toBe('');
    });

    it('does not open the timepicker on hideDatepickerDropdown without a date value', () => {
        cmp.bsDatePickerDirective = { hide: jest.fn() };
        const toggle = jest.spyOn(cmp, 'toggleTimePicker').mockImplementation(() => undefined);
        cmp.bsDateValue = undefined;
        cmp.hideDatepickerDropdown();
        expect(toggle).not.toHaveBeenCalled();
    });

    describe('onDisplayKeydown', () => {
        const evt = (value: string, k = 'Enter') => ({
            target: { value }, key: k, stopPropagation: jest.fn(), preventDefault: jest.fn()
        });

        beforeEach(() => {
            cmp.bsDatePickerDirective = { hide: jest.fn() };
            jest.spyOn(cmp, 'toggleDpDropdown').mockImplementation(() => undefined);
        });

        it('uses the output format for native inputs', () => {
            cmp.loadNativeDateInput = true;
            const e = evt('2024-03-05T10:20:30');
            cmp.onDisplayKeydown(e);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
            expect(cmp.toggleDpDropdown).toHaveBeenCalledTimes(1);
        });

        it('does not flag a matching numeric timestamp as invalid', () => {
            const change = jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            cmp.datepattern = 'timestamp';
            cmp.invalidDateTimeFormat = true;
            const actual = jest.requireActual('@wm/core').getFormattedDate;
            (getFormattedDate as jest.Mock).mockReturnValue(1709634030000);
            try {
                cmp.onDisplayKeydown(evt('1709634030000'));
            } finally {
                (getFormattedDate as jest.Mock).mockImplementation(actual);
            }
            expect(change).not.toHaveBeenCalled();
            expect(cmp.toggleDpDropdown).toHaveBeenCalledTimes(1);
        });
    });

    it('validates native input without an event using the output format', () => {
        cmp.loadNativeDateInput = true;
        const fv = jest.spyOn(cmp, 'formatValidation').mockReturnValue(false);
        cmp.isValid(undefined);
        expect(fv).toHaveBeenCalledTimes(1);
    });

    it('falls back to the global moment when the module has no default export', () => {
        const realMoment = jest.requireActual('moment');
        (window as any).moment = realMoment;
        jest.isolateModules(() => {
            jest.doMock('moment', () => {
                const fn: any = (...a: any[]) => realMoment(...a);
                Object.assign(fn, realMoment);
                fn.__esModule = true;
                fn.default = undefined;
                return fn;
            });
            const mod = require('./date-time.component');
            expect(mod.DatetimeComponent).toBeDefined();
        });
        jest.dontMock('moment');
    });
});
