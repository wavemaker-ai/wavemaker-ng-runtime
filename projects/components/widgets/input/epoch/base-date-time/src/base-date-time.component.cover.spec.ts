import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, isMobile: jest.fn((...a: any[]) => actual.isMobile(...a)) };
});
import * as wmCore from '@wm/core';

@Component({
    standalone: false,
    template: '<div wmDate name="coverDate" datepattern="yyyy-MM-dd" ngModel></div>',
})
class CoverDateWrapperComponent {
    @ViewChild(DateComponent, { static: true }) wmComponent: DateComponent;
}

class MockIMaskDirective {
    destroyMask() {}
}

class EmptyI18nService extends MockAbstractI18nService {
    public getLocalizedMessage(val: any) {
        return '';
    }
}

const coverApp = { ...mockApp, subscribe: () => () => undefined };

const moduleDef = (i18n: any = MockAbstractI18nService): ITestModuleDef => ({
    declarations: [CoverDateWrapperComponent],
    imports: [BrowserAnimationsModule, FormsModule, BsDatepickerModule, IMaskModule, DateComponent],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: coverApp },
        { provide: SecurityService, useValue: SecurityService },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: i18n },
        { provide: IMaskDirective, useClass: MockIMaskDirective },
        { provide: BsDatepickerDirective, useClass: BsDatepickerDirective },
    ],
    teardown: { destroyAfterEach: false },
});

describe('BaseDateTimeComponent - coverage gaps', () => {
    let fixture: ComponentFixture<CoverDateWrapperComponent>;
    let comp: any;

    const build = (i18n?: any) => {
        TestBed.resetTestingModule();
        fixture = compileTestComponent(moduleDef(i18n), CoverDateWrapperComponent);
        comp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        comp.activeDate = new Date(2020, 5, 15);
    };
    const key = (k: string, extra: any = {}) => $.Event('keydown', { key: k, ...extra });

    beforeEach(() => build());

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (wmCore.isMobile as jest.Mock).mockClear();
        document.body.innerHTML = '';
    });

    describe('construction and property changes', () => {
        it('evaluates the custom-picker flag on mobile', () => {
            (wmCore.isMobile as jest.Mock).mockReturnValue(true);
            build();
            expect(comp.loadNativeDateInput).toBe(!comp.showcustompicker);
            comp.showcustompicker = true;
            comp.onPropertyChange('showcustompicker', true);
            expect(comp.loadNativeDateInput).toBe(false);
            (wmCore.isMobile as jest.Mock).mockImplementation(jest.requireActual('@wm/core').isMobile);
        });

        it('falls back to default AM/PM labels and raw label keys when i18n has no message', () => {
            build(EmptyI18nService);
            expect(comp.am).toBe('AM');
            expect(comp.pm).toBe('PM');
            comp.onPropertyChange('todaybuttonlabel', 'Now');
            comp.onPropertyChange('clearbuttonlabel', 'Wipe');
            expect(comp._dateOptions.todayButtonLabel).toBe('Now');
            expect(comp._dateOptions.clearButtonLabel).toBe('Wipe');
        });

        it('uses timepattern for format validation when datepattern is absent', () => {
            comp.datepattern = undefined;
            comp.timepattern = 'HH:mm';
            const d = new Date(2020, 0, 1, 10, 30);
            expect(comp.formatValidation(d, '10:30')).toBe(true);
        });

        it('opens the modal with today when no value is passed', () => {
            jest.useFakeTimers();
            comp.datetimepickerComponent = { show: jest.fn() };
            jest.spyOn(comp, 'addDatepickerMouseEvents').mockImplementation(() => undefined);
            jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            comp.showDatePickerModal(undefined);
            expect(comp.datetimepickerComponent.show).toHaveBeenCalled();
            expect(comp.activeDate instanceof Date).toBe(true);
            expect(Math.abs(comp.activeDate.getTime() - Date.now())).toBeLessThan(5000);
            jest.advanceTimersByTime(600);
            expect(comp.setActiveDateFocus).toHaveBeenCalledWith(comp.activeDate, true);
        });

        it('ngOnDestroy tolerates a missing locale subscription', () => {
            comp.cancelLocaleChangeSubscription = undefined;
            comp.dateOnShowSubscription = undefined;
            expect(() => comp.ngOnDestroy()).not.toThrow();
        });

        it('updateFormat ignores unknown patterns', () => {
            comp.showseconds = 'keep';
            comp.updateFormat('other');
            expect(comp.showseconds).toBe('keep');
        });
    });

    describe('picker navigation helpers', () => {
        it('goToOtherMonthOryear does nothing for an unknown period', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="next"></button></div>';
            const days = jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            const months = jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            const years = jest.spyOn(comp, 'loadYears').mockImplementation(() => undefined);
            comp.goToOtherMonthOryear('next', 'other');
            expect(days).not.toHaveBeenCalled();
            expect(months).not.toHaveBeenCalled();
            expect(years).not.toHaveBeenCalled();
        });

        it('does not mark a non-selected day as aria-selected', () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<table><tr><td id="td"><span id="d">15</span></td></tr></table>';
            comp.setActiveDateFocus(new Date(2020, 5, 15), true);
            jest.advanceTimersByTime(50);
            expect($('#d').attr('aria-label')).toBeTruthy();
            expect($('#td').attr('aria-selected')).toBeUndefined();
            expect($('#d').attr('tabindex')).toBe('0');
        });

        it('does nothing in setFocusForMonthOrDay / setFocusForCurrentMonthOryear when no table is rendered', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">x</button></div><div class="bs-datepicker-body"></div>';
            const spies = ['loadDays', 'loadMonths', 'loadYears', 'setActiveDateFocus', 'setActiveMonthFocus', 'setActiveYearFocus']
                .map(n => jest.spyOn(comp, n).mockImplementation(() => undefined));
            comp.setFocusForMonthOrDay();
            comp.setFocusForCurrentMonthOryear();
            spies.forEach(s => expect(s).not.toHaveBeenCalled());
        });

        it('setActiveMonthFocus does not navigate when the year is unchanged on keyboard use', () => {
            jest.useFakeTimers();
            const go = jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveMonthFocus(new Date(2020, 7, 1));
            expect(go).not.toHaveBeenCalled();
            jest.advanceTimersByTime(5);
            expect(comp.activeDate.getMonth()).toBe(7);
        });

        it('setActiveYearFocus skips page navigation for mouse events', () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<div class="bs-datepicker-body"><table class="years"><tr><td><span>2016</span></td><td><span>2020</span></td></tr></table></div>';
            const go = jest.spyOn(comp, 'goToOtherMonthOryear').mockImplementation(() => undefined);
            comp.setActiveYearFocus(new Date(2030, 0, 1), true);
            expect(go).not.toHaveBeenCalled();
            comp.setActiveYearFocus(new Date(2030, 0, 1));
            expect(go).toHaveBeenCalledWith('next', 'year');
        });
    });

    describe('keyboard handlers', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="current">x</button></div><div class="bs-datepicker-body"></div>';
        });

        it('ignores unrelated keys in the month table', () => {
            const focus = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForMonths();
            $('.bs-datepicker-body').trigger(key('a'));
            expect(focus).not.toHaveBeenCalled();
        });

        it('ignores unrelated keys in the year table and handles Ctrl+ArrowDown', () => {
            const month = jest.spyOn(comp, 'setActiveMonthFocus').mockImplementation(() => undefined);
            const year = jest.spyOn(comp, 'setActiveYearFocus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'loadMonths').mockImplementation(() => undefined);
            comp.addKeyBoardEventsForYears();
            $('.bs-datepicker-body').trigger(key('a'));
            expect(year).not.toHaveBeenCalled();
            expect(month).not.toHaveBeenCalled();
            $('.bs-datepicker-body').trigger(key('ArrowDown', { ctrlKey: true }));
            expect(month).toHaveBeenCalledWith(comp.activeDate);
        });

        it('only closes the date container on Escape', () => {
            const container = document.createElement('div');
            container.className = 'dc';
            document.body.appendChild(container);
            jest.spyOn(comp, 'loadDays').mockImplementation(() => undefined);
            jest.spyOn(comp, 'setActiveDateFocus').mockImplementation(() => undefined);
            const scope: any = { dateContainerCls: 'dc', hideDatepickerDropdown: jest.fn(), nativeElement: document.createElement('div') };
            scope.nativeElement.innerHTML = '<input class="display-input">';
            comp.addDatepickerKeyboardEvents(scope, true);
            container.onkeydown({ key: 'a' } as any);
            expect(scope.hideDatepickerDropdown).not.toHaveBeenCalled();
            container.onkeydown({ key: 'Escape' } as any);
            expect(scope.hideDatepickerDropdown).toHaveBeenCalledTimes(1);
        });
    });

    describe('mouse events', () => {
        it('ignores synthetic clicks on previous/next/current/action buttons', () => {
            document.body.innerHTML = '<div class="bs-datepicker-head"><button class="previous"><span></span></button><button class="current">x</button><button class="next"><span></span></button></div><div class="bs-datepicker-body"><div class="bs-datepicker-action-buttons"></div></div>';
            comp.next = comp.prev = { fullMonth: 'June', date: new Date(2020, 5, 1) };
            const forDate = jest.spyOn(comp, 'setFocusForDate').mockImplementation(() => undefined);
            const cur = jest.spyOn(comp, 'setFocusForCurrentMonthOryear').mockImplementation(() => undefined);
            const act = jest.spyOn(comp, 'setFocusForMonthOrDay').mockImplementation(() => undefined);
            comp.addDatepickerMouseEvents();
            $('.previous').trigger('click');
            $('.next').trigger('click');
            $('.current').trigger('click');
            $('.bs-datepicker-action-buttons').trigger('click');
            expect(forDate).not.toHaveBeenCalled();
            expect(cur).not.toHaveBeenCalled();
            expect(act).not.toHaveBeenCalled();
            expect(comp.clicked).toBe(true);
        });
    });

    describe('native input focus/blur', () => {
        it('blur without a mobile input does nothing', () => {
            comp.nativeElement.querySelector('.mobile-input')?.remove();
            expect(() => comp.onDateTimeInputBlur()).not.toThrow();
        });

        it('focus does not click the input when not triggered by the user', () => {
            comp.loadNativeDateInput = true;
            comp._triggeredByUser = false;
            const input = document.createElement('input');
            input.className = 'mobile-input';
            comp.nativeElement.appendChild(input);
            const click = jest.spyOn(input, 'click');
            comp.onDateTimeInputFocus();
            expect(click).not.toHaveBeenCalled();
            comp._triggeredByUser = true;
            comp.onDateTimeInputFocus();
            expect(click).toHaveBeenCalled();
        });
    });

    describe('time picker events', () => {
        let scope: any;
        const mount = () => {
            document.body.innerHTML = `<div id="tp">
                <div class="g1"><input class="bs-timepicker-field"></div>
                <div class="g2"><input class="bs-timepicker-field"></div>
                <div class="g3"><button class="btn-default"></button></div>
                <div class="g4"><input class="bs-timepicker-field"></div>
                <a href="#"><span class="bs-chevron-up"></span></a>
                <a href="#" id="plain"><span></span></a>
                <p id="other"></p></div>`;
            comp.addEventsOnTimePicker($('#tp'));
        };
        beforeEach(() => {
            scope = {
                hideTimepickerDropdown: jest.fn(), setIsTimeOpen: jest.fn(),
                mintime: undefined, maxtime: undefined, bsTimeValue: undefined,
                datePipe: comp.datePipe, displayValue: ''
            };
            comp.elementScope = scope;
            jest.spyOn(comp, 'focus').mockImplementation(() => undefined);
            jest.spyOn(comp, 'timeFormatValidation').mockImplementation(() => undefined);
            mount();
        });

        it('ignores unrelated keys on the first/last/middle fields', () => {
            $('.g1 input').trigger(key('a'));
            $('.g4 input').trigger(key('a'));
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
            $('body').append('<div id="tp2"><div></div><div class="g5"><input class="bs-timepicker-field"></div></div>');
            comp.addEventsOnTimePicker($('#tp2'));
            $('.g5 input').trigger(key('a'));
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
            $('.g5 input').trigger(key('Tab'));
            expect(scope.setIsTimeOpen).toHaveBeenCalledWith(false);
            scope.setIsTimeOpen.mockClear();
            $('.g2 input').trigger(key('a'));
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
            $('.g2 input').trigger(key('Enter'));
            expect(scope.setIsTimeOpen).toHaveBeenCalledWith(false);
        });

        it('leaves the bound time unchanged for non arrow keys when min and max are set', () => {
            scope.mintime = 'a';
            scope.maxtime = 'b';
            scope.minTime = new Date(2020, 0, 1);
            scope.maxTime = new Date(2020, 0, 2);
            $('.g1 input').trigger(key('a'));
            expect(scope.bsTimeValue).toBeUndefined();
            $('.g1 input').trigger(key('ArrowUp'));
            expect(scope.bsTimeValue).toBe(scope.minTime);
        });

        it('handles keys on the default button and on other targets', () => {
            $('.g3 button').trigger(key('a'));
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
            $('.g3 button').trigger(key('Tab'));
            expect(scope.setIsTimeOpen).toHaveBeenCalledWith(false);
            scope.setIsTimeOpen.mockClear();
            $('#other').trigger(key('Tab'));
            expect(scope.setIsTimeOpen).not.toHaveBeenCalled();
        });

        it('only resets the bound time on chevron clicks when min and max are set and value invalid', () => {
            $('#plain').trigger('click'); // no min/max
            scope.mintime = 'a';
            scope.maxtime = 'b';
            scope.minTime = new Date(2020, 0, 1);
            $('#plain').trigger('click'); // neither chevron
            expect(scope.bsTimeValue).toBeUndefined();
            $('a').first().trigger('click');
            expect(scope.bsTimeValue).toBe(scope.minTime);
        });
    });

    describe('moment module resolution', () => {
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
                const mod = require('./base-date-time.component');
                expect(mod.BaseDateTimeComponent).toBeDefined();
            });
            jest.dontMock('moment');
        });
    });
});
