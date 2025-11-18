import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, Injector, Input, OnDestroy, Output, TemplateRef, ViewChild } from '@angular/core';
import { BsDatepickerConfig, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { App } from '@wm/core';
import {filter} from "lodash-es";
import { PickerGroupComponent, PickerComponent } from "@wm/components/input/epoch/picker";
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';

declare const $;
import * as momentLib  from 'moment';
// Typings for moment don't declare a `default` export in this setup.
// Use the namespace import directly and fall back to global if needed.
const moment: any = (momentLib as any) || (window as any)['moment'];

@Component({
    standalone: true,
    imports: [CommonModule, BsDatepickerModule, BsDropdownModule],
    selector: 'wm-datetimepicker',
    template: `
    <ng-template #datetimepickerTemplate>
      <div class="app-datetime-picker">
        <div class="modal-body">
          <div class="mobile-datetime-picker-options">
    
          </div>
          @if (mode === 'DATE_TIME' || mode === 'DATE') {
            <bs-datepicker-inline
              [bsConfig]="bsDatepickerConfig"
              [datesDisabled]="excludedDatesToDisable"
              bsDatepicker
              [bsValue]="changedValue"
              (bsValueChange)="onDateUpdate($event)"
              >
            </bs-datepicker-inline>
          }
          @if (mode === 'DATE_TIME' || mode === 'TIME') {
            <wm-timepicker
              [value]="changedValue"
              [min]="minTime"
              [max]="maxTime"
              (change)="onTimeUpdate($event)"
            ></wm-timepicker>
          }
          <span class="text-primary date-picker-value">
            {{getDateLabel()}}
          </span>
        </div>
        <div class="modal-footer">
          @if (mode === 'DATE_TIME' || mode === 'DATE') {
            <button
              class="btn btn-secondary today-btn"
            (click)="setToday()">{{appLocale.LABEL_TODAY_DATE || "Today" }}</button>
          }
          @if (mode === 'DATE_TIME' || mode === 'TIME') {
            <button
              class="btn btn-primary pull-right ok-btn"
            (click)="onOkClick()">{{appLocale.LABEL_OK || "Ok" }}</button>
          }
          <button
            class="btn btn-secondary pull-right clear-btn"
          (click)="clear()">{{appLocale.LABEL_CLEAR_DATE || "Clear" }}</button>
        </div>
      </div>
    </ng-template>
    `
})
export class DateTimePickerComponent implements AfterViewInit, OnDestroy {

    private isDateOpen = true;

    private isTimeOpen = false;

    private appLocale: any;

    @ViewChild('datetimepickerTemplate' , { static: true }) datetimepickerTemplate: TemplateRef<any>;

    @Input()
    private mode: 'DATE' | 'TIME' | 'DATE_TIME' = 'DATE_TIME';

    @Input()
    private placement: 'MODAL' | 'INLINE' = 'MODAL';

    @Input("config")
    private _bsDatepickerConfig: BsDatepickerConfig;

    @Input()
    private minTime: Date;

    @Input()
    private maxTime: Date;

    @Input()
    private _displayFormat: string;

    @Output() change = new EventEmitter<Date>();

    private _value = new Date();

    private changedValue = null;

    private modalRef: BsModalRef;

    @Input()
    private excludedDatesToDisable;

    private pickerClickHandler: ((event: Event) => void) | null = null;
    private modalClickHandler: (() => void) | null = null;
    private pickerElement?: HTMLElement;
    private modalElement?: HTMLElement;

    constructor(
        protected inj: Injector,
        private bsModalService: BsModalService) {
        this.appLocale = inj.get(App).appLocale || {};
    }

    @Input()
    set value(d: Date) {
        d = d || new Date();
        this._value = d;
        this.changedValue = d;
    }


    @Input("config")
    set bsDatepickerConfig(config: BsDatepickerConfig) {
        this._bsDatepickerConfig = config;
        this._bsDatepickerConfig.showClearButton = false;
        this._bsDatepickerConfig.showTodayButton = false;
    }

    @Input()
    set excludedDaysToDisable(v: number[]) {
        this._bsDatepickerConfig.daysDisabled = v;
    }

    get bsDatepickerConfig() {
        return this._bsDatepickerConfig;
    }

    @Input()
    set displayFormat(format: string) {
        if (format) {
            this._displayFormat = format.replace(/y/g, "Y").replace(/d/g, "D").replace("a", "A");
        }
    }

    validateSelectedDate() {
        if (!this.changedValue) {
            return true;
        }
        const cd = moment(this.changedValue);
        const minDate = this._bsDatepickerConfig?.minDate;
        const maxDate = this._bsDatepickerConfig?.maxDate;
        if (minDate
            && ((this.mode === 'DATE'
                    && moment(minDate).startOf('day').toDate() > this.changedValue)
                || (this.mode !== 'DATE'
                    && minDate > this.changedValue))) {
            return false;
        }
        if (maxDate
            && ((this.mode === 'DATE'
                    && moment(maxDate).endOf('day').toDate() < this.changedValue)
                || (this.mode !== 'DATE'
                    && maxDate < this.changedValue))) {
            return false;
        }
        if (this._bsDatepickerConfig?.daysDisabled?.indexOf(cd.day()) >= 0) {
            return false;
        }
        const cdSt = cd.startOf('day').toDate().getTime();
        if (this.excludedDatesToDisable?.find(d => d.getTime() === cdSt)) {
            return false;
        }
        return true;
    }

    get displayFormat() {
        if (this._displayFormat) {
            return this._displayFormat;
        }
    }
    /**
     * This method is used to highlight the current date
     */
    private hightlightToday() {
        const toDay = new Date().getDate().toString();
        filter($(`body > modal-container .date-picker-modal span:contains(${toDay})`)
            .not('.is-other-month,.current-date'), (obj) => {
            if ($(obj).text() === toDay) {
                $(obj).addClass('current-date text-info');
            }
        });
    }

    private hideOnClick() {
        const pickerSelector = 'body>modal-container .date-picker-modal .app-datetime-picker';
        const modalSelector = 'body>modal-container .date-picker-modal';
        const hasDollar = typeof $ === 'function';
        const pickerResult = hasDollar ? $(pickerSelector) : null;
        const modalResult = hasDollar ? $(modalSelector) : null;
        const supportsOnOff = !!(pickerResult && typeof pickerResult.off === 'function' && typeof pickerResult.on === 'function');
        const supportsClick = !!(pickerResult && typeof pickerResult.click === 'function' && modalResult && typeof modalResult.click === 'function');

        if (!this.pickerClickHandler) {
            this.pickerClickHandler = ($event: Event) => $event.stopPropagation();
        }
        if (!this.modalClickHandler) {
            this.modalClickHandler = () => this.onCancelClick();
        }

        if (supportsOnOff) {
            (pickerResult as any).off('click').on('click', this.pickerClickHandler);
            (modalResult as any).off('click').on('click', this.modalClickHandler);
            this.pickerElement = undefined;
            this.modalElement = undefined;
            return;
        }

        if (supportsClick) {
            (pickerResult as any).click(this.pickerClickHandler);
            (modalResult as any).click(this.modalClickHandler);
            this.pickerElement = undefined;
            this.modalElement = undefined;
            return;
        } else {
            this.removeNativeClickHandlers();
            this.pickerElement = document.querySelector('body>modal-container .date-picker-modal .app-datetime-picker') as HTMLElement;
            if (this.pickerElement && this.pickerClickHandler) {
                this.pickerElement.addEventListener('click', this.pickerClickHandler);
            }
            this.modalElement = document.querySelector('body>modal-container .date-picker-modal') as HTMLElement;
            if (this.modalElement && this.modalClickHandler) {
                this.modalElement.addEventListener('click', this.modalClickHandler);
            }
        }
    }

    getDateLabel() {
        return moment(this.changedValue).format(this.displayFormat);
    }

    openDatePicker() {
        this.isTimeOpen = false;
        this.isDateOpen = true;
    }

    openTimePicker() {
        this.isTimeOpen = true;
        this.isDateOpen = false;
    }

    public onDateUpdate(newVal) {
        const oldVal = this.changedValue;
         if (this.mode === 'DATE') {
            newVal.setHours(0);
            newVal.setMinutes(0);
            newVal.setSeconds(0);
            newVal.setMilliseconds(0);
        } else if (oldVal && newVal) {
            newVal.setHours(oldVal.getHours());
            newVal.setMinutes(oldVal.getMinutes());
            newVal.setSeconds(oldVal.getSeconds());
            newVal.setMilliseconds(oldVal.getMilliseconds());
        }
        this.changedValue = newVal;
        if (this.mode === 'DATE'
            && oldVal !== newVal
            && this.validateSelectedDate()) {
            this.onOkClick();
        }
    }

    public onTimeUpdate(newVal) {
        this.changedValue = newVal;
    }

    show() {
        this.reset();
        this.modalRef = this.bsModalService.show(this.datetimepickerTemplate, {
            animated: true,
            backdrop: 'static',
            class: 'date-picker-modal modal-dialog-centered'
        });
        setTimeout(() => { this.hideOnClick()}, 500);
    }

    clear() {
        this.changedValue = null;
        this.triggerChange();
        this.hideModal();
    }

    setToday() {
        const today = moment().startOf('day').toDate();
        this.onDateUpdate(today);
    }

    reset() {
        this.changedValue = this._value;
    }

    hideModal() {
        if (this.modalRef?.id) {
            this.bsModalService.hide(this.modalRef.id);
        }
    }

    onCancelClick() {
        this.changedValue = this._value;
        this.hideModal();
    }

    onOkClick() {
        if (this.validateSelectedDate()) {
            this.triggerChange();
        }
        this.hideModal();
    }

    triggerChange() {
        if (this.value !== this.changedValue) {
            this.change.emit(this.changedValue);
        }
    }

    ngAfterViewInit(): void {

    }

    private removeNativeClickHandlers() {
        if (this.pickerElement && this.pickerClickHandler) {
            this.pickerElement.removeEventListener('click', this.pickerClickHandler);
        }
        if (this.modalElement && this.modalClickHandler) {
            this.modalElement.removeEventListener('click', this.modalClickHandler);
        }
        this.pickerElement = undefined;
        this.modalElement = undefined;
    }

    ngOnDestroy(): void {
        // CRITICAL FIX: Hide modal and clean up event listeners
        this.hideModal();
        
        // CRITICAL FIX: Remove jQuery click handlers that may have been added
        // hideOnClick() adds click handlers that need to be removed
        const pickerSelector = 'body>modal-container .date-picker-modal .app-datetime-picker';
        const modalSelector = 'body>modal-container .date-picker-modal';
        const hasDollar = typeof $ === 'function';
        const pickerResult = hasDollar ? $(pickerSelector) : null;
        const modalResult = hasDollar ? $(modalSelector) : null;
        if (pickerResult && typeof pickerResult.off === 'function') {
            pickerResult.off('click');
        }
        if (modalResult && typeof modalResult.off === 'function') {
            modalResult.off('click');
        } else {
            this.removeNativeClickHandlers();
        }

        this.pickerClickHandler = null;
        this.modalClickHandler = null;
    }

}


@Component({
    selector: 'wm-timepicker',
    standalone: true,
    template: `
        <wm-pickergroup>
            <wm-picker
                [options]="options.hour"
                [selectedValue]="hour"
                (change)="set($event, 'HOUR')"></wm-picker>
            <span class="app-time-separator">:</span>
            <wm-picker
                [options]="options.minute"
                [selectedValue]="minute"
                (change)="set($event, 'MINUTE')"></wm-picker>
            <span class="app-time-separator">:</span>
            <wm-picker
                [options]="options.minute"
                [selectedValue]="second"
                (change)="set($event, 'SECOND')"></wm-picker>
        </wm-pickergroup>
    `,
    imports: [PickerGroupComponent, PickerComponent]
})
export class TimePickerComponent implements AfterViewInit {

    options = {
        hour: [],
        minute: [],
        second: [],
        meridian: ['AM', 'PM']
    };

    @Input()
    private value = new Date();

    @Input()
    private min: Date = null;

    @Input()
    private max: Date = null;

    @Output() change = new EventEmitter<Date>();

    constructor(
        protected inj: Injector) {
        this.options.hour = this.populateNumbers(0, 23);
        this.options.minute = this.populateNumbers(0, 59);
        this.options.second = this.populateNumbers(0, 59);
    }

    private populateNumbers(start: number, to: number) {
        const arr = [];
        for(let i = start; i <= to; i++) {
            arr.push({
                label: (i < 10 ? '0' : '') + i,
                value: i
            })
        }
        return arr;
    }

    set({index, value}, unit: 'HOUR' | 'MINUTE' | 'SECOND' | 'MERIDIAN') {
        if (unit === 'HOUR') {
            this.value = moment(this.value).hour(parseInt(value)).toDate();
        } else if (unit === 'MINUTE') {
            this.value = moment(this.value).minute(parseInt(value)).toDate();
        } else if (unit === 'SECOND') {
            this.value = moment(this.value).second(parseInt(value)).toDate();
        } else if (unit === 'MERIDIAN') {
            this.value = moment(this.value).minute(value).toDate();
        }
        if (this.min && this.value < this.min) {
            this.value = this.min;
        }
        if (this.max && this.value > this.max) {
            this.value = this.max;
        }
        this.change.emit(this.value);
    }

    get hour() {
        return moment(this.value).hour();
    }

    get minute() {
        return moment(this.value).minute();
    }

    get second() {
        return moment(this.value).second();
    }

    get meridian() {
        return 'AM';
    }

    public onDateUpdate(newVal) {
        debugger;
    }

    ngAfterViewInit(): void {

    }

}
