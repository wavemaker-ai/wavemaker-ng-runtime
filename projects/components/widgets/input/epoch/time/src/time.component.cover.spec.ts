import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AbstractI18nService, App, AppDefaults, UserDefinedExecutionContext } from '@wm/core';
import { TimeComponent } from './time.component';
import { ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../../base/src/test/util/date-test-util';
import { ToDatePipe } from '../../../../../base/src/pipes/custom-pipes';

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, getFormattedDate: jest.fn(actual.getFormattedDate) };
});
import { getFormattedDate } from '@wm/core';

@Component({
    standalone: false,
    template: `<div wmTime name="time1" outputformat="HH:mm:ss" timepattern="HH:mm:ss" ngModel></div>`
})
class HostComponent {
    @ViewChild(TimeComponent, { static: true }) wmComponent: TimeComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [HostComponent],
    imports: [BrowserAnimationsModule, TimeComponent, FormsModule, TimepickerModule, BsDropdownModule],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};

describe('TimeComponent coverage', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;
    const at = (h: number, m = 0, s = 0) => new Date(2024, 0, 1, h, m, s);

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
        jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (getFormattedDate as jest.Mock).mockClear();
        fixture.destroy();
    });

    describe('native input mode', () => {
        beforeEach(() => {
            cmp.loadNativeDateInput = true;
            cmp.outputformat = 'HH:mm:ss';
        });

        it('datavalue setter parses using the output format', () => {
            cmp.datavalue = '10:15:20';
            expect(cmp.bsTimeValue).toBeInstanceOf(Date);
            expect(cmp.bsTimeValue.getHours()).toBe(10);
            expect(cmp.bsTimeValue.getMinutes()).toBe(15);
        });

        it('mintime and maxtime are parsed using the output format', () => {
            cmp.onPropertyChange('mintime', '08:00:00');
            cmp.onPropertyChange('maxtime', '17:00:00');
            expect(cmp.minTime.getHours()).toBe(8);
            expect(cmp.maxTime.getHours()).toBe(17);
        });

        it('display time change parses using the output format', () => {
            const onTimeChange = jest.spyOn(cmp, 'onTimeChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.onDisplayTimeChange({ target: { value: '09:05:00' } });
            const arg = onTimeChange.mock.calls[0][0] as Date;
            expect(arg.getHours()).toBe(9);
            expect(arg.getMinutes()).toBe(5);
        });

        it('isValid without an event validates the typed input using the output format', () => {
            const validate = jest.spyOn(cmp, 'formatValidation').mockReturnValue(false);
            $(cmp.nativeElement).find('input').first().val('11:22:33');
            cmp.isValid(null);
            expect(validate).toHaveBeenCalledTimes(1);
            expect((validate.mock.calls[0][0] as Date).getHours()).toBe(11);
        });

        it('picker values use the output format when limits exist', () => {
            cmp.bsTimePicker = { min: () => new Date(2000, 0, 1), max: () => new Date(2100, 0, 1), hours: '10', minutes: 0, seconds: undefined, showMeridian: () => false };
            cmp.onTimeChange(undefined);
            expect(cmp.timeNotInRange).toBe(false);
            expect(cmp.bsTimeValue.getHours()).toBe(10);
            expect(cmp.bsTimeValue.getMinutes()).toBe(0);
        });
    });

    it('nativeDisplayValue is empty when no time is selected', () => {
        cmp.bsTimeValue = undefined;
        expect(cmp.nativeDisplayValue).toBe('');
    });

    it('setValidateType keeps the type when the value is within the limits', () => {
        cmp.timeNotInRange = true;
        cmp.validateType = 'none';
        cmp.setValidateType(5, 10, 7);
        expect(cmp.validateType).toBe('none');
    });

    it('toggleDropdown does not raise a click callback for non-click events', () => {
        const cb = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
        cmp.status.isopen = false;
        cmp.toggleDropdown({ type: 'keydown' });
        expect(cb).not.toHaveBeenCalled();
        expect(cmp.status.isopen).toBe(true);
    });

    it('preventTpClose does not notify when the widget is not in a floating caption composite', () => {
        const notify = jest.spyOn(cmp.app, 'notify').mockImplementation(() => undefined);
        const ev = { stopImmediatePropagation: jest.fn() };
        cmp.preventTpClose(ev);
        expect(ev.stopImmediatePropagation).toHaveBeenCalledTimes(1);
        expect(notify).not.toHaveBeenCalled();
    });

    describe('onTimeChange', () => {
        it('native picker event with non-native widget parses without a pattern', () => {
            cmp.loadNativeDateInput = false;
            cmp.minTime = undefined;
            cmp.maxTime = undefined;
            cmp.onTimeChange({ target: { value: '10:30:00' } }, true);
            expect(cmp.bsTimeValue).toBeInstanceOf(Date);
        });

        it('does nothing with the time when no value and no picker limits are available', () => {
            cmp.bsTimeValue = at(9);
            cmp.bsTimePicker = undefined;
            cmp.onTimeChange(undefined);
            expect(cmp.bsTimeValue).toEqual(at(9));
            expect(cmp.invokeOnChange).toHaveBeenCalledWith(cmp.datavalue, {}, true);
        });

        it('uses the picker time when it is within limits and the format is valid', () => {
            cmp.invalidDateTimeFormat = false;
            cmp.bsTimePicker = { min: () => new Date(2000, 0, 1), max: () => new Date(2100, 0, 1), hours: '10', minutes: 5, seconds: 7, showMeridian: () => true };
            cmp.onTimeChange(undefined);
            expect(cmp.timeNotInRange).toBe(false);
            expect(cmp.bsTimeValue).toBeInstanceOf(Date);
        });

        it('reverts to the previous value and refreshes the input when the format is invalid', () => {
            jest.useFakeTimers();
            const prev = at(6);
            jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue(prev);
            cmp.invalidDateTimeFormat = true;
            cmp.bsTimePicker = { min: () => new Date(2000, 0, 1), max: () => new Date(2100, 0, 1), hours: '10', minutes: 5, seconds: 7, showMeridian: () => false };
            (getFormattedDate as jest.Mock).mockReturnValue(null);
            cmp.onTimeChange(undefined);
            (getFormattedDate as jest.Mock).mockReturnValue('');
            jest.runAllTimers();
            expect($(cmp.nativeElement).find('.display-input').val() || '').toBe('');
        });

        it('refreshes the display input with an empty string when the formatted value is empty', () => {
            (getFormattedDate as jest.Mock).mockReturnValue(null);
            jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue('');
            const val = jest.spyOn($.fn, 'val');
            cmp.timeNotInRange = false;
            cmp.minTime = undefined;
            cmp.maxTime = undefined;
            cmp.bsTimePicker = undefined;
            cmp.onTimeChange(undefined);
            expect(val).toHaveBeenCalledWith('');
        });
    });

    it('falls back to window.moment when the moment module has no default export', () => {
        let loaded: any;
        const realMoment: any = jest.requireActual('moment');
        const realFn = realMoment.default || realMoment;
        (window as any).moment = realFn;
        jest.isolateModules(() => {
            jest.doMock('moment', () => {
                const noDefault: any = Object.assign((...args: any[]) => realFn(...args), realFn, { __esModule: true });
                noDefault.default = undefined;
                return noDefault;
            });
            loaded = require('./time.component');
        });
        jest.dontMock('moment');
        expect(loaded.TimeComponent).toBeDefined();
        delete (window as any).moment;
    });
});
