import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BsModalService } from 'ngx-bootstrap/modal';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { DateTimePickerComponent, TimePickerComponent } from './date-time-picker.component';

describe('DateTimePickerComponent coverage', () => {
    let component: any;
    let fixture: ComponentFixture<DateTimePickerComponent>;
    let modalService: any;

    const setup = (app: any = mockApp) => {
        modalService = { show: jest.fn().mockReturnValue({ id: 'm1' }), hide: jest.fn() };
        TestBed.configureTestingModule({
            imports: [DateTimePickerComponent],
            providers: [
                { provide: BsModalService, useValue: modalService },
                { provide: App, useValue: app }
            ]
        });
        fixture = TestBed.createComponent(DateTimePickerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('falls back to an empty locale when the app has none', () => {
        setup({ appLocale: undefined });
        expect(component.appLocale).toEqual({});
    });

    it('value setter defaults to the current date when given an empty value', () => {
        setup();
        const before = Date.now();
        component.value = null;
        expect(component._value).toBeInstanceOf(Date);
        expect(component.changedValue).toBe(component._value);
        expect(component._value.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('excludedDaysToDisable stores the days on the config returned by the getter', () => {
        setup();
        component.bsDatepickerConfig = {} as any;
        component.excludedDaysToDisable = [0, 6];
        expect(component.bsDatepickerConfig.daysDisabled).toEqual([0, 6]);
    });

    it('openDatePicker and openTimePicker toggle the visible section', () => {
        setup();
        component.openTimePicker();
        expect(component.isTimeOpen).toBe(true);
        expect(component.isDateOpen).toBe(false);
        component.openDatePicker();
        expect(component.isTimeOpen).toBe(false);
        expect(component.isDateOpen).toBe(true);
    });

    it('displayFormat ignores empty formats and getter returns undefined without one', () => {
        setup();
        component.displayFormat = '';
        expect(component._displayFormat).toBeUndefined();
        expect(component.displayFormat).toBeUndefined();
        component.displayFormat = 'yyyy-dd a';
        expect(component.displayFormat).toBe('YYYY-DD A');
    });

    it('triggerChange does not emit when there is nothing changed', () => {
        setup();
        const emit = jest.spyOn(component.change, 'emit');
        component.changedValue = undefined;
        component.triggerChange();
        expect(emit).not.toHaveBeenCalled();
        const d = new Date(2024, 1, 1);
        component.changedValue = d;
        component.triggerChange();
        expect(emit).toHaveBeenCalledWith(d);
    });

    it('hightlightToday only decorates the span whose text is exactly today', () => {
        setup();
        const toDay = new Date().getDate().toString();
        document.body.innerHTML = `<modal-container><div class="date-picker-modal">
            <span id="exact">${toDay}</span><span id="partial">${toDay}9</span></div></modal-container>`;
        component.hightlightToday();
        expect(document.getElementById('exact').classList.contains('current-date')).toBe(true);
        expect(document.getElementById('partial').classList.contains('current-date')).toBe(false);
    });

    it('show() wires click handlers after the delay: inner clicks are swallowed, outer clicks cancel', () => {
        setup();
        jest.useFakeTimers();
        document.body.innerHTML = `<modal-container><div class="date-picker-modal"><div class="app-datetime-picker"><span id="in"></span></div></div></modal-container>`;
        const cancel = jest.spyOn(component, 'onCancelClick').mockImplementation(() => undefined);
        component.show();
        expect(modalService.show).toHaveBeenCalled();
        jest.advanceTimersByTime(500);
        document.getElementById('in').click();
        expect(cancel).not.toHaveBeenCalled();
        (document.querySelector('.date-picker-modal') as HTMLElement).click();
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    describe('TimePickerComponent', () => {
        let tp: any;

        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [TimePickerComponent] });
            tp = TestBed.createComponent(TimePickerComponent).componentInstance;
        });

        it('ignores unknown units but still emits the current value', () => {
            const emit = jest.spyOn(tp.change, 'emit');
            const before = tp.value;
            tp.set({ index: 0, value: 3 }, 'UNKNOWN');
            expect(tp.value).toBe(before);
            expect(emit).toHaveBeenCalledWith(before);
        });

        it('onDateUpdate is a harmless no-op', () => {
            const before = tp.value;
            expect(tp.onDateUpdate(new Date())).toBeUndefined();
            expect(tp.value).toBe(before);
        });
    });
});
