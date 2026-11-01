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

@Component({
    standalone: false,
    template: '<div wmDate name="moreDate" datepattern="yyyy-MM-dd" ngModel></div>',
})
class MoreDateWrapperComponent {
    @ViewChild(DateComponent, { static: true }) wmComponent: DateComponent;
}

class MockIMaskDirective {
    destroyMask() {}
}

const handlers: any = {};
const moreApp = { ...mockApp, subscribe: (name: string, cb: any) => { handlers[name] = cb; return () => undefined; } };

const moduleDef: ITestModuleDef = {
    declarations: [MoreDateWrapperComponent],
    imports: [BrowserAnimationsModule, FormsModule, BsDatepickerModule, IMaskModule, DateComponent],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: moreApp },
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

describe('BaseDateTimeComponent - more behaviour', () => {
    let fixture: ComponentFixture<MoreDateWrapperComponent>;
    let comp: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, MoreDateWrapperComponent);
        comp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        comp.activeDate = new Date(2020, 5, 15);
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        delete (document as any).activeElement;
    });

    it('refreshes the picker locale and button labels on a locale change', () => {
        const pipe = comp.datePipe.datePipe;
        jest.spyOn(comp.i18nService, 'getLocalizedMessage').mockImplementation((k: string) => `msg-${k}`);
        handlers['locale-changed']({ angular: 'fr' });
        expect(pipe.locale).toBe('fr');
        expect(comp._dateOptions.todayButtonLabel).toBe('msg-LABEL_TODAY_DATE');
        expect(comp._dateOptions.clearButtonLabel).toBe('msg-LABEL_CLEAR_DATE');
    });

    describe('setFocusForMonthOrDay', () => {
        it('focuses the month of the displayed year and reloads months when the year differs', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">2022</button></div><div class="bs-datepicker-body"><table class="months"></table></div>';
            const loadMonths = jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.setFocusForMonthOrDay();
            expect(loadMonths).toHaveBeenCalledTimes(1);
            expect(focus).toHaveBeenCalledWith(new Date(2022, 5, 15), true);
        });

        it('does not reload months when the displayed year is the active year', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">2020</button></div><div class="bs-datepicker-body"><table class="months"></table></div>';
            const loadMonths = jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.setFocusForMonthOrDay();
            expect(loadMonths).not.toHaveBeenCalled();
        });

        it('focuses the first day of the displayed month and reloads days when the month differs', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">March</button></div><div class="bs-datepicker-body"><table class="days"></table></div>';
            const loadDays = jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.setFocusForMonthOrDay();
            expect(loadDays).toHaveBeenCalledTimes(1);
            expect(focus).toHaveBeenCalledWith(new Date(2020, 2, 1), true);
        });

        it('does not reload days when the displayed month is the active month', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">June</button></div><div class="bs-datepicker-body"><table class="days"></table></div>';
            const loadDays = jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.setFocusForMonthOrDay();
            expect(loadDays).not.toHaveBeenCalled();
        });
    });

    describe('setFocusForCurrentMonthOryear', () => {
        it('loads and focuses months when the month table is shown', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="months"></table></div>';
            const load = jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.setFocusForCurrentMonthOryear();
            expect(load).toHaveBeenCalledTimes(1);
            expect(focus).toHaveBeenCalledWith(comp.activeDate, true);
        });

        it('loads and focuses years when the year table is shown', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="years"></table></div>';
            const load = jest.spyOn(comp, 'loadYears').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveYearFocus').mockImplementation(() => undefined);
            comp.setFocusForCurrentMonthOryear();
            expect(load).toHaveBeenCalledTimes(1);
            expect(focus).toHaveBeenCalledWith(comp.activeDate, true);
        });
    });

    describe('setFocusForDate', () => {
        it('shifts the year by the count for the month table', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="months"></table></div>';
            jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.setFocusForDate(1);
            expect(focus).toHaveBeenCalledWith(new Date(2021, 0, 15), true);
        });

        it('uses the first year of the page for the year table', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="years"><tr><td><span>2016</span></td></tr></table></div>';
            jest.spyOn(comp, 'loadYears').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveYearFocus').mockImplementation(() => undefined);
            comp.setFocusForDate(-1);
            expect(focus).toHaveBeenCalledWith(new Date(2016, 5, 15), true);
        });

        const daysDom = '<div class="bs-datepicker-head"><button class="current">June</button><button class="current">2020</button></div><div class="bs-datepicker-body"><table class="days"></table></div>';

        it('focuses the first day of the displayed month for the day table', () => {
            document.body.innerHTML = daysDom;
            jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.setFocusForDate(1);
            expect(focus).toHaveBeenCalledWith(new Date(2020, 5, 1), true);
        });

        it('prefers the min date, then the max date, when they fall in the displayed month', () => {
            document.body.innerHTML = daysDom;
            jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            const focus = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.mindate = new Date(2020, 5, 10);
            comp.setFocusForDate(1);
            expect(focus).toHaveBeenLastCalledWith(new Date(2020, 5, 10), true);
            comp.mindate = new Date(2019, 1, 1);
            comp.maxdate = new Date(2020, 5, 25);
            comp.setFocusForDate(1);
            expect(focus).toHaveBeenLastCalledWith(new Date(2020, 5, 25), true);
        });

        it('does nothing when no table is rendered', () => {
            document.body.innerHTML = '<div class="bs-datepicker-body"></div>';
            const focus = jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.setFocusForDate(1);
            expect(focus).not.toHaveBeenCalled();
        });
    });

    describe('delayed loaders', () => {
        beforeEach(() => jest.useFakeTimers());

        it('attaches the month keyboard and mouse events after a tick', () => {
            const kb = jest.spyOn(comp, 'addKeyBoardEventsForMonths').mockImplementation(() => undefined);
            const mouse = jest.spyOn(comp, 'addDatepickerMouseEvents').mockImplementation(() => undefined);
            comp.loadMonths();
            expect(kb).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(kb).toHaveBeenCalledTimes(1);
            expect(mouse).toHaveBeenCalledTimes(1);
        });

        it('attaches the year keyboard and mouse events after a tick', () => {
            const kb = jest.spyOn(comp, 'addKeyBoardEventsForYears').mockImplementation(() => undefined);
            const mouse = jest.spyOn(comp, 'addDatepickerMouseEvents').mockImplementation(() => undefined);
            comp.loadYears();
            jest.runAllTimers();
            expect(kb).toHaveBeenCalledTimes(1);
            expect(mouse).toHaveBeenCalledTimes(1);
        });
    });

    describe('disabled items on enter', () => {
        const press = (key: string) => $('.bs-datepicker-body').trigger($.Event('keydown', { key }));

        it.each(['Months', 'Years'])('ignores enter on a disabled %s cell', (kind) => {
            document.body.innerHTML = '<div class="bs-datepicker-body"></div><ul><li class="disabled"><span id="cell"></span></li></ul>';
            const cell = document.getElementById('cell') as HTMLElement;
            Object.defineProperty(document, 'activeElement', { configurable: true, get: () => cell });
            const click = jest.spyOn(cell, 'click');
            const spy = jest.spyOn(comp, kind === 'Months' ? 'loadDays' : 'loadMonths').mockImplementation(() => undefined);
            comp[`addKeyBoardEventsFor${kind}`]();
            press('Enter');
            expect(click).not.toHaveBeenCalled();
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('previous and next mouse navigation', () => {
        const head = '<div class="bs-datepicker-head"><button class="previous"><span></span></button><button class="current">June</button><button class="next"><span></span></button></div>';

        beforeEach(() => {
            document.body.innerHTML = head + '<div class="bs-datepicker-body"><table class="days"></table></div>';
            comp.setNextData(comp.activeDate);
            jest.spyOn(comp, 'setFocusForDate').mockImplementation(() => undefined);
        });

        it.each(['previous', 'next'])('announces the %s month and removes the announcement when the header is focused', async (dir) => {
            jest.useFakeTimers();
            comp.addDatepickerMouseEvents();
            const evt: any = $.Event('click');
            evt.originalEvent = {} as any;
            $(`.bs-datepicker-head .${dir}`).trigger(evt);
            expect(comp.setFocusForDate).toHaveBeenCalledWith(dir === 'next' ? 1 : -1);
            jest.runAllTimers();
            const h2 = $('.bs-datepicker-head .current h2');
            expect(h2.length).toBe(1);
            expect(h2.text()).toContain(dir === 'next' ? 'Changed to Next Month, July' : 'Changed to Previous Month, May');
            $('.bs-datepicker-head .current').trigger('focus');
            expect($('.bs-datepicker-head .current h2').length).toBe(0);
        });

        it('skips the focus handling for synthetic clicks', () => {
            comp.addDatepickerMouseEvents();
            $('.bs-datepicker-head .next').trigger('click');
            expect(comp.setFocusForDate).not.toHaveBeenCalled();
        });

        it('handles real clicks on the current label and the action buttons', () => {
            const cur = jest.spyOn(comp, 'setFocusForCurrentMonthOryear').mockImplementation(() => undefined);
            const md = jest.spyOn(comp, 'setFocusForMonthOrDay').mockImplementation(() => undefined);
            document.body.innerHTML = head + '<div class="bs-datepicker-body"><div class="bs-datepicker-action-buttons"></div></div>';
            comp.addDatepickerMouseEvents();
            const real = () => { const e: any = $.Event('click'); e.originalEvent = { stopPropagation: () => undefined }; return e; };
            $('.bs-datepicker-head .current').trigger(real());
            $('.bs-datepicker-body .bs-datepicker-action-buttons').trigger(real());
            expect(cur).toHaveBeenCalledTimes(1);
            expect(md).toHaveBeenCalledTimes(1);
        });
    });
});
