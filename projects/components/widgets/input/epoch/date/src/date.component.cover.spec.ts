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
class DateCoverHostComponent {
    @ViewChild(DateComponent, { static: true }) wmComponent: DateComponent;
}

const moduleDef = {
    declarations: [DateCoverHostComponent],
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

describe('DateComponent - remaining branches', () => {
    let fixture: ComponentFixture<DateCoverHostComponent>;
    let cmp: any;
    const key = (k: string, value: string): any => ({ key: k, target: { value }, stopPropagation: jest.fn(), preventDefault: jest.fn() });

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, DateCoverHostComponent);
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

    it('returns empty strings for display and native display values when there is no date', () => {
        cmp.bsDataValue = undefined;
        cmp.showdateformatasplaceholder = true;
        cmp.imask = { maskRef: {} };
        cmp.maskDateInputFormat = 'dd/MM/yyyy';
        expect(cmp.displayValue).toBe('');
        expect(cmp.nativeDisplayValue).toBe('');
    });

    it('clears the date when the datavalue is set to an empty value', () => {
        cmp.bsDataValue = new Date(2024, 2, 5);
        cmp.datavalue = '';
        expect(cmp.bsDataValue).toBeUndefined();
        expect(cmp.isCurrentDate).toBe(false);
    });

    it('resolves the CURRENT_DATE keyword in the configured time zone', () => {
        jest.useFakeTimers();
        jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
        cmp.datavalue = 'CURRENT_DATE';
        expect(cmp.isCurrentDate).toBe(true);
        jest.advanceTimersByTime(60);
        expect(cmp.bsDataValue).toBeTruthy();
        expect(new Date(cmp.bsDataValue).getFullYear()).toBe(new Date().getFullYear());
    });

    it('drops the stored date when an empty value is set through setDataValue', () => {
        jest.spyOn(cmp, 'minDateMaxDateValidationOnInput').mockImplementation(() => undefined);
        jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
        cmp.dateNotInRange = false;
        cmp.bsDataValue = new Date(2024, 2, 5);
        cmp.setDataValue(undefined);
        expect(cmp.bsDataValue).toBeUndefined();
        expect(cmp.invokeOnChange).toHaveBeenCalledWith('', {}, true);
    });

    describe('date picker popup in a time zone', () => {
        beforeEach(() => {
            document.body.insertAdjacentHTML('beforeend', `<div class="bs-datepicker-container"><button>x</button></div><div class="${cmp.dateContainerCls}"></div>`);
        });

        afterEach(() => {
            document.body.querySelectorAll(`.bs-datepicker-container, .${cmp.dateContainerCls}`).forEach((e) => e.remove());
        });

        it('uses the current date in the zone as active date and keeps the value when today is already selected', () => {
            jest.spyOn(cmp, 'timeZone', 'get').mockReturnValue('Asia/Kolkata');
            const today = document.createElement('button');
            jest.spyOn(document, 'querySelector').mockReturnValue(today);
            cmp.bsDataValue = undefined;
            cmp.onDatePickerOpen();
            expect(cmp.activeDate).toBeTruthy();
            const selected = new Date();
            cmp.bsDataValue = selected;
            const zoneToday = new Date(cmp.activeDate);
            // make "today in zone" resolve to the already selected day so no update happens
            jest.spyOn(Date.prototype, 'toDateString').mockReturnValue(zoneToday.toDateString());
            today.click();
            expect(cmp.bsDataValue).toBe(selected);
        });
    });

    describe('keyboard and mask', () => {
        beforeEach(() => {
            jest.spyOn(cmp, 'hideDatepickerDropdown').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'toggleDpDropdown').mockImplementation(() => undefined);
        });

        it('accepts a numeric timestamp entry that equals the formatted timestamp', () => {
            cmp.datepattern = 'timestamp';
            cmp._dateOptions.dateInputFormat = 'timestamp';
            const ev = key('Enter', '12345');
            cmp.onDisplayKeydown(ev);
            expect(cmp.invalidDateTimeFormat).not.toBe(true);
            expect(cmp.invokeOnChange).not.toHaveBeenCalled();
            expect(cmp.toggleDpDropdown).toHaveBeenCalledWith(ev);
        });

        it('does not build a mask for the timestamp pattern', () => {
            cmp.datepattern = 'timestamp';
            const update = jest.spyOn(cmp, 'updateIMask').mockImplementation(() => undefined);
            cmp.maskDateInputFormat = 'untouched';
            cmp.onPropertyChange('showdateformatasplaceholder', true);
            expect(cmp.showdateformatasplaceholder).toBe(true);
            expect(cmp.maskDateInputFormat).toBe('untouched');
            expect(update).not.toHaveBeenCalled();
        });

        it('pads single day and month letters in the mask format', () => {
            cmp._dateOptions.dateInputFormat = 'd/M/yyyy';
            jest.spyOn(cmp, 'updateIMask').mockImplementation(() => undefined);
            cmp.onPropertyChange('showdateformatasplaceholder', true);
            expect(cmp.maskDateInputFormat).toBe('dd/MM/yyyy');
        });
    });
});
