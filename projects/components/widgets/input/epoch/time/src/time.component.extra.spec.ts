import { Component, ElementRef, Injector, LOCALE_ID, ViewChild } from '@angular/core';
import { TimeComponent } from './time.component';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
    compileTestComponent,
    getHtmlSelectorElement,
    hasAttributeCheck,
    checkCustomElementClass,
    onClickCheckTaglengthOnBody,
    mockApp
} from '../../../../../base/src/test/util/component-test-util';
import {
    getTimeFieldValue,
    triggerTimerClickonArrowsByIndex,
    outputpatternTest,
    getTimePickerElement,
    localizedValueOnInputTest, MockAbstractI18nService, MockAbstractI18nServiceDe, MockAbstractI18nServiceRO
} from '../../../../../base/src/test/util/date-test-util';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { waitForAsync, ComponentFixture, fakeAsync } from '@angular/core/testing';
import {
    UserDefinedExecutionContext,
    AppDefaults,
    AbstractI18nService,
    App
} from '@wm/core';
import { FormsModule } from '@angular/forms';

import { ToDatePipe } from '../../../../../base/src/pipes/custom-pipes';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de';
import localeRO from '@angular/common/locales/ro';
import { BsLocaleService } from 'ngx-bootstrap/datepicker';
import * as momentLib  from 'moment';
const moment = momentLib.default || window['moment'];
import { By } from '@angular/platform-browser';

const currentTime = moment(new Date()).format('hh:mm:ss');

const markup = `<div wmTime  name="time1" hint="my time" datavalue="${currentTime}" maxtime="${currentTime}" mintime="${currentTime}"
shortcutkey="g" tabindex="0" outputformat="hh:mm:ss"  timepattern="hh:mm:ss" hourstep="1" minutestep="20" required="true" showdropdownon="button"
 change.event="time1Change($event, widget, newVal, oldVal)" focus.event="time1Focus($event, widget)" blur.event="time1Blur($event, widget)"
  click.event="time1Click($event, widget)" mouseenter.event="time1Mouseenter($event, widget)" mouseleave.event="time1Mouseleave($event, widget)"
   tap.event="time1Tap($event, widget)"  class="input-group-lg" color="#9f4343" margin="5px"  autofocus="true" ngModel></div>`;

@Component({
    standalone: false,
    template: markup
})
class TimeWrapperComponent {
    @ViewChild(TimeComponent, /* TODO: add static flag */ { static: true })
    wmComponent: TimeComponent;

    time1Change($event, widget, newVal, oldVal) {
        // console.log('Time Change event triggered!');
    }

    time1Focus($event, widget) {
        // console.log('Time Focus event triggered!');
    }

    time1Blur($event, widget) {
        // console.log('Time Blur event triggered!');
    }

    time1Click($event, widget) {
        // console.log('Time Click event triggered!');
    }

    time1Mouseenter($event, widget) {
        // console.log('mouseenter event triggered!');
    }

    time1Mouseleave($event, widget) {
        // console.log('Time mouseleave event triggered!');
    }

    time1Tap($event, widget) {
        // console.log('Time tap event triggered!');
    }


}

const dateComponentModuleDef: ITestModuleDef = {
    declarations: [TimeWrapperComponent],
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


jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    addEventListenerOnElement: jest.fn(() => jest.fn()),
}));

import { addEventListenerOnElement } from '@wm/core';

describe('TimeComponent - additional behaviour', () => {
    let fixture: ComponentFixture<TimeWrapperComponent>;
    let cmp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(dateComponentModuleDef, TimeWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.timepattern = 'hh:mm:ss a';
        cmp.showdropdownon = 'default';
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        fixture.destroy();
    });

    const at = (h: number, m = 0, s = 0) => new Date(2024, 0, 1, h, m, s);

    describe('min and max time', () => {
        it('stores parsed limits and validates them on property changes', () => {
            const change = jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            cmp.onPropertyChange('mintime', '08:00:00');
            cmp.onPropertyChange('maxtime', '17:00:00');
            expect(cmp.minTime).toBeInstanceOf(Date);
            expect(cmp.maxTime).toBeInstanceOf(Date);
            expect(change).toHaveBeenCalledTimes(2);
        });

        it('keeps the form control pristine when limits change on a pristine control', () => {
            const markAsPristine = jest.fn();
            const formControl = jest.spyOn(cmp, 'formControl', 'get').mockReturnValue({ pristine: true, control: { markAsPristine } } as any);
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            cmp.onPropertyChange('mintime', '08:00:00');
            expect(markAsPristine).toHaveBeenCalledTimes(1);
            markAsPristine.mockClear();
            formControl.mockReturnValue({ pristine: false, control: { markAsPristine } } as any);
            cmp.onPropertyChange('maxtime', '17:00:00');
            expect(markAsPristine).not.toHaveBeenCalled();
        });

        it('ignores tab index changes and forwards others to the base class', () => {
            const base = jest.spyOn(Object.getPrototypeOf(TimeComponent.prototype), 'onPropertyChange').mockImplementation(() => undefined);
            cmp.onPropertyChange('tabindex', 3);
            expect(base).not.toHaveBeenCalled();
            cmp.onPropertyChange('caption', 'x');
            expect(base).toHaveBeenCalledTimes(1);
        });

        it('reports which limit was exceeded', () => {
            cmp.timeNotInRange = true;
            cmp.setValidateType(5, 10, 1);
            expect(cmp.validateType).toBe('mintime');
            cmp.setValidateType(5, 10, 20);
            expect(cmp.validateType).toBe('maxtime');
            cmp.validateType = '';
            cmp.timeNotInRange = false;
            cmp.setValidateType(5, 10, 20);
            expect(cmp.validateType).toBe('');
        });
    });

    describe('time changes', () => {
        beforeEach(() => {
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
        });

        it('stores a time within the limits', () => {
            cmp.minTime = at(8);
            cmp.maxTime = at(17);
            cmp.onTimeChange(at(10));
            expect(cmp.timeNotInRange).toBe(false);
            expect(cmp.bsTimeValue).toEqual(at(10));
            expect(cmp.invokeOnChange).toHaveBeenCalledWith(cmp.datavalue, {}, true);
        });

        it('flags a time outside the limits without storing it', () => {
            cmp.minTime = at(8);
            cmp.maxTime = at(17);
            cmp.bsTimeValue = at(9);
            cmp.onTimeChange(at(20));
            expect(cmp.timeNotInRange).toBe(true);
            expect(cmp.validateType).toBe('maxtime');
            expect(cmp.bsTimeValue).toEqual(at(9));
        });

        it('reads the time from a native picker event', () => {
            cmp.minTime = undefined;
            cmp.maxTime = undefined;
            cmp.loadNativeDateInput = true;
            cmp.outputformat = 'HH:mm:ss';
            cmp.onTimeChange({ target: { value: '10:30:00' } }, true);
            expect(cmp.bsTimeValue).toBeInstanceOf(Date);
        });

        it('uses the picker values when the library returns nothing but limits exist', () => {
            jest.useFakeTimers();
            const min = at(8);
            const max = at(17);
            cmp.bsTimePicker = { min: () => min, max: () => max, hours: '10', minutes: '30', seconds: '0', showMeridian: () => true };
            cmp.onTimeChange(undefined);
            expect(cmp.bsTimePicker.meridian).toBeDefined();
            expect(typeof cmp.timeNotInRange).toBe('boolean');
            jest.runAllTimers();
        });

        it('restores the previous value when the typed time is out of range', () => {
            jest.useFakeTimers();
            cmp.bsTimePicker = { min: () => at(8), max: () => at(17), hours: '23', minutes: '0', seconds: '0', showMeridian: () => false };
            jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue(at(9));
            cmp.onTimeChange(undefined);
            expect(cmp.timeNotInRange).toBe(true);
            expect(cmp.bsTimeValue).toEqual(at(9));
            jest.runAllTimers();
        });

        it('keeps the display in sync when the value did not change', () => {
            cmp.minTime = undefined;
            cmp.maxTime = undefined;
            cmp.bsTimeValue = at(10, 15, 20);
            jest.spyOn(cmp, 'getPrevDataValue').mockImplementation(() => cmp.datavalue);
            cmp.onTimeChange(at(10, 15, 20));
            expect($(cmp.nativeElement).find('.display-input').length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('current time', () => {
        it('ticks every second and stops when cleared', () => {
            jest.useFakeTimers();
            const change = jest.spyOn(cmp, 'onTimeChange').mockImplementation(() => undefined);
            cmp.setTimeInterval();
            cmp.setTimeInterval();
            jest.advanceTimersByTime(2100);
            expect(change).toHaveBeenCalledTimes(2);
            cmp.clearTimeInterval();
            cmp.clearTimeInterval();
            jest.advanceTimersByTime(2100);
            expect(change).toHaveBeenCalledTimes(2);
        });

        it('uses the time zone for the clock', () => {
            jest.useFakeTimers();
            jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
            const change = jest.spyOn(cmp, 'onTimeChange').mockImplementation(() => undefined);
            cmp.setTimeInterval();
            jest.advanceTimersByTime(1100);
            expect(change).toHaveBeenCalledTimes(1);
            cmp.clearTimeInterval();
        });
    });

    describe('dropdown', () => {
        it('registers an outside click listener while the dropdown is open', () => {
            jest.useFakeTimers();
            cmp.addBodyClickListener(true);
            jest.advanceTimersByTime(400);
            (addEventListenerOnElement as jest.Mock).mock.calls[0][5]();
            expect(cmp.status.isopen).toBe(false);
            (addEventListenerOnElement as jest.Mock).mockClear();
            cmp.addBodyClickListener(false);
            jest.advanceTimersByTime(400);
            expect(addEventListenerOnElement).not.toHaveBeenCalled();
        });

        it('closes the dropdown, removes listeners and notifies floating captions', () => {
            const touched = jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            const blur = jest.spyOn(cmp, 'blurDateInput').mockImplementation(() => undefined);
            const notify = jest.spyOn(mockApp, 'notify').mockImplementation(() => undefined);
            const dereg = jest.fn();
            const removeKeys = jest.fn();
            cmp.deregisterEventListener = dereg;
            cmp.removeKeyupListener = removeKeys;
            cmp.status.isopen = true;
            $(cmp.nativeElement).wrap('<div class="app-composite-widget caption-floating"></div>');
            cmp.hideTimepickerDropdown();
            expect(touched).toHaveBeenCalledTimes(1);
            expect(cmp.status.isopen).toBe(false);
            expect(dereg).toHaveBeenCalledTimes(1);
            expect(removeKeys).toHaveBeenCalledTimes(1);
            expect(notify).toHaveBeenCalledWith('captionPositionAnimate', expect.anything());
            expect(blur).toHaveBeenCalledWith(true);
        });

        it('closes the dropdown even when no keyboard listener was ever registered', () => {
            jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'blurDateInput').mockImplementation(() => undefined);
            cmp.removeKeyupListener = undefined;
            expect(() => cmp.hideTimepickerDropdown()).not.toThrow();
        });

        it('only validates the typed format for empty events', () => {
            const format = jest.spyOn(cmp, 'formatValidation').mockReturnValue(true);
            cmp.isValid({});
            expect(format).not.toHaveBeenCalled();
            cmp.isValid(undefined);
            expect(format).toHaveBeenCalledTimes(1);
            format.mockReturnValue(false);
            expect(cmp.isValid(null)).toBeUndefined();
        });

        it('forwards only unmanaged events to the base class', () => {
            const base = jest.spyOn(Object.getPrototypeOf(TimeComponent.prototype), 'handleEvent').mockImplementation(() => undefined);
            cmp.handleEvent(document.createElement('div'), 'blur', jest.fn(), {});
            expect(base).not.toHaveBeenCalled();
            cmp.handleEvent(document.createElement('div'), 'mouseenter', jest.fn(), {});
            expect(base).toHaveBeenCalledTimes(1);
        });

        it('raises blur unless the timepicker field receives the focus', () => {
            const touched = jest.spyOn(cmp, 'invokeOnTouched').mockImplementation(() => undefined);
            const callback = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.onInputBlur({ relatedTarget: document.createElement('div') });
            expect(callback).toHaveBeenCalledWith('blur', expect.anything());
            touched.mockClear();
            const field = document.createElement('input');
            field.className = 'bs-timepicker-field';
            cmp.onInputBlur({ relatedTarget: field });
            expect(touched).not.toHaveBeenCalled();
        });
    });
});
