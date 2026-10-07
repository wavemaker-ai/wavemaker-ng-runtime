import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { IMaskModule } from 'angular-imask';
import { AbstractI18nService, App } from '@wm/core';
import { BaseComponent, StylableComponent } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ToDatePipe } from 'projects/components/base/src/pipes/custom-pipes';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { CalendarComponent } from './calendar.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: jest.fn(() => true),
}));

// jest maps every @fullcalendar/* import to the same file, so a single mock serves core, plugins and locales
jest.mock('@fullcalendar/core', () => ({
    __esModule: true,
    default: [],
    Calendar: class { constructor(public el: any, public options: any) {} render() {} setOption() {} changeView() {} }
}));

@Component({
    standalone: false,
    template: '<div wmCalendar name="coverCalendar" selectionmode="single" calendartype="agenda" width="500px" height="500px"></div>',
})
class CoverCalendarHost {
    @ViewChild(CalendarComponent, { static: true }) wmComponent: CalendarComponent;
}

describe('CalendarComponent (cover)', () => {
    let fixture: ComponentFixture<CoverCalendarHost>;
    let cal: any;
    let localeCb: Function;
    const unsubscribe = jest.fn();

    const build = () => {
        const app = { ...mockApp, subscribe: jest.fn((evt: string, cb: Function) => { if (evt === 'locale-changed') { localeCb = cb; } return unsubscribe; }) };
        fixture = compileTestComponent({
            declarations: [CoverCalendarHost],
            imports: [FormsModule, BsDatepickerModule, IMaskModule, CalendarComponent],
            providers: [
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: App, useValue: app },
                { provide: DatePipe, useClass: DatePipe },
                { provide: BaseComponent, useClass: BaseComponent },
                { provide: StylableComponent, useClass: StylableComponent },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
            ],
        } as any, CoverCalendarHost);
        cal = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    };

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        delete (window as any).FullCalendar;
        TestBed.resetTestingModule();
    });

    describe('with the bundled FullCalendar (no global)', () => {
        beforeEach(() => {
            delete (window as any).FullCalendar;
            jest.useFakeTimers();
            build();
        });

        it('creates the calendar with the bundled plugins and locales and uses the default view', () => {
            expect(cal.$fullCalendar).toBeDefined();
            expect(cal.calendarOptions.calendar.plugins.length).toBe(5);
            expect(cal.calendarOptions.calendar.locales).toBeDefined();
            const changeView = jest.spyOn(cal.$fullCalendar, 'changeView').mockImplementation(() => undefined);
            const gv = jest.spyOn(cal, 'getViewType').mockReturnValue('dayGridMonth');
            cal.view = '';
            jest.advanceTimersByTime(60);
            expect(gv).toHaveBeenCalledWith('dayGridMonth');
            expect(changeView).toHaveBeenCalledWith('dayGridMonth');
        });

        it('uses a short long-press delay on mobile', () => {
            expect(cal.calendarOptions.calendar.longPressDelay).toBe(1);
        });
    });

    describe('locale changes and teardown', () => {
        beforeEach(() => {
            (window as any).FullCalendar = { Calendar: class { constructor(public el: any, public options: any) {} render() {} setOption() {} changeView() {} }, __wm_locale_initialized: false };
            build();
        });

        it('re-applies the locale (falling back to en) and redraws when the app locale changes', () => {
            const setLocale = jest.spyOn(cal, 'setLocale').mockImplementation(() => undefined);
            const apply = jest.spyOn(cal, 'applyCalendarOptions').mockImplementation(() => undefined);
            const redraw = jest.spyOn(cal, 'redraw').mockImplementation(() => undefined);
            localeCb({ fullCalendar: 'fr' });
            localeCb({});
            expect(setLocale).toHaveBeenCalledTimes(2);
            expect(apply).toHaveBeenNthCalledWith(1, 'option', 'locale', 'fr');
            expect(apply).toHaveBeenNthCalledWith(2, 'option', 'locale', 'en');
            expect(redraw).toHaveBeenCalledTimes(2);
        });

        it('leaves out month and week buttons when those controls are not enabled', () => {
            cal.controls = 'navigation, today';
            cal.calendartype = 'agenda';
            cal.updateCalendarHeaderOptions();
            const hdr = cal.calendarOptions.calendar.headerToolbar;
            expect(JSON.stringify(hdr)).not.toContain('dayGridMonth');
            expect(JSON.stringify(hdr)).not.toContain('timeGridWeek');
            expect(JSON.stringify(hdr)).toContain('prev next');
        });

        it('keeps the url of events that have one and drops empty urls', () => {
            const out = cal.constructCalendarDataset([{ title: 'a', url: 'http://x' }, { title: 'b', url: '' }]);
            expect(out[0].url).toBe('http://x');
            expect(out[0]._eventMetadata.url).toBe('http://x');
            expect(out[1].url).toBeUndefined();
            expect(out[1]._eventMetadata.url).toBeUndefined();
        });

        it('destroys cleanly with and without a locale subscription', () => {
            unsubscribe.mockClear();
            cal.ngOnDestroy();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
            cal.cancelLocaleChangeSubscription = undefined;
            expect(() => cal.ngOnDestroy()).not.toThrow();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        });
    });
});
