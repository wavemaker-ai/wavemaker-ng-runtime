import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { IMaskModule } from 'angular-imask';
import { AbstractI18nService, App } from '@wm/core';
import { BaseComponent, StylableComponent } from '@wm/components/base';
import { ITestModuleDef } from 'projects/components/base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ToDatePipe } from 'projects/components/base/src/pipes/custom-pipes';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { CalendarComponent } from './calendar.component';

@Component({
    standalone: false,
    template: '<div wmCalendar name="extraCalendar" view="month" selectionmode="single" calendartype="agenda" width="500px" height="500px"></div>',
})
class ExtraCalendarWrapperComponent {
    @ViewChild(CalendarComponent, { static: true }) wmComponent: CalendarComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [ExtraCalendarWrapperComponent],
    imports: [FormsModule, BsDatepickerModule, IMaskModule, CalendarComponent],
    providers: [
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: App, useValue: mockApp },
        { provide: DatePipe, useClass: DatePipe },
        { provide: BaseComponent, useClass: BaseComponent },
        { provide: StylableComponent, useClass: StylableComponent },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
    ],
};

describe('CalendarComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraCalendarWrapperComponent>;
    let cal: any;
    let full: any;

    const fakeFullCalendar = () => ({
        gotoDate: jest.fn(),
        select: jest.fn(),
        unselect: jest.fn(),
        nextYear: jest.fn(),
        prevYear: jest.fn(),
        getDate: jest.fn().mockReturnValue(new Date(2020, 5, 15)),
        render: jest.fn(),
        setOption: jest.fn(),
        changeView: jest.fn(),
        addEventSource: jest.fn(),
        addEvent: jest.fn(),
        getEvents: jest.fn().mockReturnValue([]),
        getEventById: jest.fn(),
        batchRendering: jest.fn((fn: () => void) => fn()),
    });

    beforeEach(waitForAsync(() => {
        (window as any).FullCalendar = {
            Calendar: class {
                constructor(public el: any, public options: any) {}
                render() {}
                setOption() {}
                changeView() {}
            },
            __wm_locale_initialized: false,
            dayGridPlugin: {},
        };
        fixture = compileTestComponent(moduleDef, ExtraCalendarWrapperComponent);
        cal = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        full = fakeFullCalendar();
        cal.$fullCalendar = full;
        jest.spyOn(cal, 'invokeEventCallback').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('navigation', () => {
        it('selects a single default date and goes to it', () => {
            cal.datavalue = new Date(2020, 5, 10);
            cal.selectDate();
            expect(full.gotoDate).toHaveBeenCalled();
            const [start, end] = full.select.mock.calls[0];
            expect(new Date(start).getDate()).toBe(10);
            expect(new Date(end).getDate()).toBe(11);
        });

        it('selects the range of a start and end object', () => {
            cal.datavalue = { start: '2020-06-10', end: '2020-06-14' };
            cal.selectDate();
            const [start, end] = full.select.mock.calls[0];
            expect(new Date(end).getDate() - new Date(start).getDate()).toBe(4);
        });

        it('moves to the default date and across years', () => {
            cal.datavalue = new Date(2021, 1, 1);
            cal.gotoDate();
            expect(full.gotoDate).toHaveBeenCalled();
            cal.gotoNextYear();
            cal.gotoPrevYear();
            expect(full.nextYear).toHaveBeenCalled();
            expect(full.prevYear).toHaveBeenCalled();
        });

        it('moves to a later and an earlier month', () => {
            cal.gotoMonth(9);
            expect(new Date(full.gotoDate.mock.calls[0][0]).getMonth()).toBe(8);
            cal.gotoMonth(2);
            expect(new Date(full.gotoDate.mock.calls[1][0]).getMonth()).toBe(1);
        });

        it('moves one month ahead and back', () => {
            cal.gotoNextMonth();
            cal.gotoPrevMonth();
            expect(new Date(full.gotoDate.mock.calls[0][0]).getMonth()).toBe(6);
            expect(new Date(full.gotoDate.mock.calls[1][0]).getMonth()).toBe(4);
        });

        it('re-renders and unselects', () => {
            cal.rerenderEvents();
            cal.unselect();
            expect(full.render).toHaveBeenCalled();
            expect(full.unselect).toHaveBeenCalled();
        });
    });

    describe('events and selection', () => {
        const eventOf = (extended: any = {}, extra: any = {}) => ({ extendedProps: extended, title: 't', ...extra });

        it('collects the events that lie within the selected dates', () => {
            cal.dataset = [
                { start: '2020-06-10', end: '2020-06-11' },
                { start: '2020-06-20' },
                { title: 'no start' },
            ];
            const result = cal.setSelectedData(new Date(2020, 5, 9), new Date(2020, 5, 13));
            expect(result).toEqual([{ start: '2020-06-10', end: '2020-06-11' }]);
        });

        it('reads the data of a wrapped dataset and falls back to the start key', () => {
            cal.dataset = { data: [{ start: '2020-06-10' }] };
            cal.eventstart = undefined;
            expect(cal.setSelectedData(new Date(2020, 5, 10), new Date(2020, 5, 12))).toHaveLength(1);
            cal.dataset = undefined;
            expect(cal.setSelectedData(new Date(), new Date())).toBeUndefined();
        });

        it('uses custom start and end keys', () => {
            cal.dataset = [{ from: '2020-06-10', to: '2020-06-10' }];
            cal.eventstart = 'from';
            cal.eventend = 'to';
            expect(cal.setSelectedData(new Date(2020, 5, 10), new Date(2020, 5, 12))).toHaveLength(1);
        });

        it('raises the select event with the selected data', () => {
            cal.dataset = [{ start: '2020-06-10' }];
            cal.select({ start: new Date(2020, 5, 10), end: new Date(2020, 5, 11), view: 'v' });
            expect(cal.selecteddates.start).toEqual(new Date(2020, 5, 10));
            expect(cal.invokeEventCallback).toHaveBeenCalledWith('select', expect.objectContaining({ $view: 'v', $data: [{ start: '2020-06-10' }] }));
        });

        it('keeps plain events and unwraps event metadata', () => {
            const plain = eventOf();
            expect(cal.convertEventObj(plain)).toBe(plain);
            const metadata = { extra: 1 };
            const wrapped = eventOf({ _eventMetadata: metadata });
            expect(cal.convertEventObj(wrapped)).toBe(metadata);
            expect(Object.getPrototypeOf(metadata)).toBe(wrapped);
        });

        it('merges the extended properties into old and new event data', () => {
            const event: any = eventOf({ custom: 'x' });
            expect(cal.convertEventObjForOldAndNewData(event).custom).toBe('x');
        });

        it('raises drop and resize events with converted data', () => {
            const info = { event: eventOf({ a: 1 }), oldEvent: eventOf({ b: 2 }), jsEvent: 'js', delta: 'd', revert: 'r', view: 'v' };
            cal.eventDrop(info);
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('eventdrop', expect.objectContaining({ $event: 'js', $delta: 'd', $revertFunc: 'r' }));
            cal.eventResize(info);
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('eventresize', expect.objectContaining({ $view: 'v' }));
        });

        it('remembers a clone of the event when a change starts', () => {
            const event = { a: { b: 1 } };
            cal.onEventChangeStart(event);
            expect(cal.oldData).toEqual(event);
            expect(cal.oldData).not.toBe(event);
        });

        it('raises the click and date click events', () => {
            cal.eventClick({ event: eventOf(), jsEvent: 'js', view: 'v' });
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('eventclick', { $event: 'js', $data: expect.anything(), $view: 'v' });
            cal.dateClick({ date: new Date(2020, 5, 10) });
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('dateclick', { $dateInfo: new Date(2020, 5, 10).valueOf() });
        });

        it('raises the render events and styles list tables', () => {
            const table = document.createElement('div');
            table.className = 'fc-list-table';
            cal.nativeElement.appendChild(table);
            cal.calendartype = 'list';
            cal.eventDidMount({ event: eventOf(), el: 'el', view: 'v' });
            expect(table.classList.contains('table')).toBe(true);
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('eventrender', expect.objectContaining({ $event: 'el' }));

            table.classList.remove('table');
            cal.viewDidMount('view');
            expect(table.classList.contains('table')).toBe(true);
            expect(cal.invokeEventCallback).toHaveBeenLastCalledWith('viewrender', { $view: 'view' });
        });

        it('does not style the table for other calendar types', () => {
            const table = document.createElement('div');
            table.className = 'fc-list-table';
            cal.nativeElement.appendChild(table);
            cal.calendartype = 'basic';
            cal.viewDidMount('v');
            cal.eventDidMount({ event: eventOf(), el: 'el', view: 'v' });
            expect(table.classList.contains('table')).toBe(false);
        });

        it('stores the visible date range', () => {
            cal.datesSet({ start: new Date(2020, 5, 1), end: new Date(2020, 6, 1) });
            expect(cal.currentview).toEqual({ start: '2020-06-01', end: '2020-07-01' });
        });
    });

    describe('configuration', () => {
        it('exposes the default date, options and library', () => {
            cal.datavalue = undefined;
            expect(cal.getDefaultDate()).toBeUndefined();
            cal.datavalue = '2020-06-10';
            expect(cal.getDefaultDate()).toEqual(new Date('2020-06-10'));
            expect(cal.getDefaultOptions()).toBe(cal.calendarOptions);
            expect(cal.getLib()).toBe('fullcalendar');
        });

        it.each([
            ['month', 'agenda', 'dayGridMonth'],
            ['month', 'list', 'listMonth'],
            ['week', 'basic', 'dayGridWeek'],
            ['week', 'list', 'listWeek'],
            ['week', 'agenda', 'timeGridWeek'],
            ['day', 'basic', 'dayGridDay'],
            ['day', 'list', 'listDay'],
            ['day', 'agenda', 'timeGridDay'],
            ['year', 'list', 'listYear'],
            ['year', 'agenda', ''],
            ['other', 'agenda', 'fallback'],
        ])('maps view %s of a %s calendar to %s', (view, type, expected) => {
            cal.view = view;
            cal.calendartype = type;
            expect(cal.getViewType('fallback')).toBe(expected);
        });

        it('builds the header toolbar from the controls', () => {
            cal.controls = 'navigation, today, year, month, week, day';
            cal.calendartype = 'list';
            cal.updateCalendarHeaderOptions();
            expect(cal.calendarOptions.calendar.headerToolbar.start).toBe('prev next today');
            expect(cal.calendarOptions.calendar.headerToolbar.end).toBe('listYear listMonth listWeek listDay');

            cal.calendartype = 'basic';
            cal.updateCalendarHeaderOptions();
            expect(cal.calendarOptions.calendar.headerToolbar.end).toBe('dayGridMonth dayGridWeek dayGridDay');

            cal.calendartype = 'agenda';
            cal.controls = 'month, week';
            cal.updateCalendarHeaderOptions();
            expect(cal.calendarOptions.calendar.headerToolbar.start).toBe('');
            expect(cal.calendarOptions.calendar.headerToolbar.end).toBe('dayGridMonth timeGridWeek');
        });

        it('keeps the header untouched without controls', () => {
            const before = { ...cal.calendarOptions.calendar.headerToolbar };
            cal.controls = '';
            cal.updateCalendarHeaderOptions();
            expect(cal.calendarOptions.calendar.headerToolbar).toEqual(before);
        });

        it('localizes the button texts', () => {
            cal.appLocale = { LABEL_CALENDAR_YEAR: 'Jahr', LABEL_CALENDAR_TODAY: 'Heute' };
            cal.setLocale();
            expect(cal.calendarOptions.calendar.buttonText.year).toBe('Jahr');
            expect(cal.calendarOptions.calendar.buttonText.listYear).toBe('Jahr');
            expect(cal.calendarOptions.calendar.buttonText.today).toBe('Heute');
            expect(cal.calendarOptions.calendar.buttonText.month).toBeTruthy();
        });

        it('overrides the calendar options', () => {
            cal.overrideDefaults({ a: 1, b: 2 });
            expect(full.setOption).toHaveBeenCalledWith('a', 1);
            expect(full.setOption).toHaveBeenCalledWith('b', 2);
            full.setOption.mockClear();
            cal.overrideDefaults('nope');
            expect(full.setOption).not.toHaveBeenCalled();
        });
    });

    describe('updates', () => {
        it('queues changes until the calendar exists', () => {
            cal.$fullCalendar = undefined;
            cal.changesStack = [];
            cal.updateCalendarOptions('option', 'height', 100);
            expect(cal.changesStack).toEqual([{ operationType: 'option', argumentKey: 'height', argumentValue: 100 }]);
        });

        it('applies render, option and view changes immediately', () => {
            cal.view = 'month';
            cal.calendartype = 'agenda';
            cal.updateCalendarOptions('render');
            cal.updateCalendarOptions('option', 'height', 300);
            cal.updateCalendarOptions('changeView', 'x');
            expect(full.render).toHaveBeenCalled();
            expect(full.setOption).toHaveBeenCalledWith('height', 300);
            expect(full.changeView).toHaveBeenCalledWith('dayGridMonth');
        });

        it('redraws the calendar and switches to the configured view', () => {
            cal.view = 'week';
            cal.calendartype = 'agenda';
            cal.redraw();
            expect(full.render).toHaveBeenCalled();
            expect(full.changeView).toHaveBeenCalledWith('timeGridWeek');
            cal.view = undefined;
            cal.redraw();
            expect(full.changeView).toHaveBeenLastCalledWith('dayGridMonth');
        });

        it('replaces all events on the calendar', () => {
            const remove = jest.fn();
            full.getEvents.mockReturnValue([{ id: '1' }, { id: '2' }]);
            full.getEventById.mockReturnValue({ remove });
            cal.dataSetEvents = { events: [{ title: 'a' }, { title: 'b' }] };
            cal.renderEventDataSet();
            expect(remove).toHaveBeenCalledTimes(2);
            expect(full.addEvent).toHaveBeenCalledTimes(2);
        });

        it('selects a date and raises select and event click when the date picker value changes', () => {
            const select = jest.fn();
            const eventClick = jest.fn();
            cal.calendarOptions.calendar.select = select;
            cal.calendarOptions.calendar.eventClick = eventClick;
            const key = '2020/06/10';
            cal.eventData = { [key]: { title: 'event' } };
            cal.onValueChange(new Date(2020, 5, 10));
            expect(select).toHaveBeenCalled();
            expect(eventClick).toHaveBeenCalledWith({ title: 'event' }, {}, cal);
            expect(cal.selecteddata).toEqual({ title: 'event' });

            eventClick.mockClear();
            cal.eventData = {};
            cal.onValueChange(new Date(2020, 5, 11));
            expect(eventClick).not.toHaveBeenCalled();
        });

        it('integrates google calendars', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            cal.addEventSource({});
            cal.addEventSource({ source: 'google', googleCalendarId: 'id' });
            expect(warn).toHaveBeenCalledTimes(2);
            expect(full.addEventSource).not.toHaveBeenCalled();

            cal.addEventSource({ source: 'google', googleCalendarApiKey: 'key', googleCalendarId: 'id' });
            expect(full.setOption).toHaveBeenCalledWith('googleCalendarApiKey', 'key');
            expect(full.addEventSource).toHaveBeenCalledWith({ googleCalendarId: 'id' });
        });

        it('ignores other event sources', () => {
            cal.addEventSource({ source: 'other' });
            expect(full.addEventSource).not.toHaveBeenCalled();
        });

        it('cancels the locale subscription on destroy', () => {
            const cancel = jest.fn();
            cal.cancelLocaleChangeSubscription = cancel;
            cal.ngOnDestroy();
            expect(cancel).toHaveBeenCalled();
        });
    });

    describe('property changes', () => {
        it('enables selection and constrains single selection to one day', () => {
            cal.onPropertyChange('selectionmode', 'single');
            expect(cal.calendarOptions.calendar.selectable).toBe(true);
            expect(cal.calendarOptions.calendar.selectConstraint).toEqual({ startTime: '00:00', endTime: '24:00' });
            expect(full.setOption).toHaveBeenCalledWith('selectConstraint', { startTime: '00:00', endTime: '24:00' });
        });

        it('allows free selection for multiple mode and none disables selection', () => {
            cal.onPropertyChange('selectionmode', 'multiple');
            expect(full.setOption).toHaveBeenCalledWith('selectConstraint', {});
            cal.onPropertyChange('selectionmode', 'none');
            expect(cal.calendarOptions.calendar.selectable).toBe(false);
        });

        it('updates the default view', () => {
            cal.calendartype = 'list';
            cal.onPropertyChange('view', 'month');
            expect(cal.calendarOptions.calendar.defaultView).toBe('listMonth');
            cal.calendartype = 'basic';
            cal.onPropertyChange('view', 'week');
            expect(cal.calendarOptions.calendar.defaultView).toBe('basicWeek');
            cal.calendartype = 'agenda';
            cal.onPropertyChange('view', 'month');
            expect(cal.calendarOptions.calendar.defaultView).toBe('month');
        });

        it('rebuilds the header for calendar type and controls changes', () => {
            const update = jest.spyOn(cal, 'updateCalendarHeaderOptions').mockImplementation(() => undefined);
            cal.onPropertyChange('calendartype', undefined);
            expect(cal.calendartype).toBe('dayGrid');
            cal.onPropertyChange('controls', 'month');
            expect(update).toHaveBeenCalledTimes(2);
        });

        it('maps a new dataset to calendar events', () => {
            const render = jest.spyOn(cal, 'renderEventDataSet').mockImplementation(() => undefined);
            cal.eventtitle = undefined;
            cal.onPropertyChange('dataset', [{ title: 'A', start: '2020-06-10', allday: true }, { title: 'B', end: '2020-06-12' }, { title: 'C' }, { title: 'D', start: '2020-06-13', url: '' }]);
            const events = cal.dataSetEvents.events;
            expect(events.map((e: any) => e.title)).toEqual(['A', 'B', 'D']);
            expect(events[0].allDay).toBe(true);
            expect(events[1].start).toBe('2020-06-12');
            expect(events[2].url).toBeUndefined();
            expect(events[0]._eventMetadata.title).toBe('A');
            expect(render).toHaveBeenCalled();
        });

        it('maps dataset fields through the configured keys', () => {
            jest.spyOn(cal, 'renderEventDataSet').mockImplementation(() => undefined);
            cal.eventstart = 'begin';
            cal.eventend = 'finish';
            cal.eventclass = 'cls';
            cal.onPropertyChange('dataset', [{ title: 'A', begin: '2020-06-10', finish: '2020-06-11', cls: 'red' }]);
            expect(cal.dataSetEvents.events[0]).toEqual(expect.objectContaining({ start: '2020-06-10', end: '2020-06-11', className: 'red' }));
            cal.eventstart = cal.eventend = cal.eventclass = undefined;
        });

        it('refreshes the view when the calendar is shown', () => {
            cal.view = 'day';
            cal.calendartype = 'basic';
            cal.onPropertyChange('show', true);
            expect(full.changeView).toHaveBeenCalledWith('dayGridDay');
        });
    });

    describe('height', () => {
        it('computes pixel heights and the event limit', () => {
            expect(cal.calculateHeight('600px')).toBe(600);
            expect(cal.calendarOptions.calendar.views.month.eventLimit).toBe(4);
            expect(cal.calculateHeight(undefined)).toBe(650);
        });

        it('resolves percentage heights against the parent', () => {
            const parent = document.createElement('div');
            parent.style.height = '400px';
            parent.appendChild(cal.nativeElement);
            document.body.appendChild(parent);
            expect(cal.calculateHeight('50%')).toBe(200);
            parent.style.height = '50%';
            jest.spyOn($.fn, 'height').mockReturnValue(800 as any);
            expect(cal.calculateHeight('25%')).toBe(200);
            parent.remove();
        });

        it('updates the calendar when the height style changes', () => {
            jest.spyOn(cal, 'calculateHeight').mockReturnValue(321);
            const update = jest.spyOn(cal, 'updateCalendarOptions').mockImplementation(() => undefined);
            cal.onStyleChange('height', '321px');
            expect(cal.calendarOptions.calendar.height).toBe(321);
            expect(update).toHaveBeenCalledWith('option', 'height', 321);
        });
    });
});
