import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR, NgModel } from '@angular/forms';
import {Component, ElementRef, Inject, Injector, OnDestroy, Optional, ViewChild, ChangeDetectionStrategy} from '@angular/core';

import {IWidgetConfig, provideAs, provideAsWidgetRef} from '@wm/components/base';
import {registerProps} from './input-calendar.props';
import {BaseInput} from '../base-input/base-input';

const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-input-calendar',
    hostClass: 'app-input-wrapper'
};

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
    selector: 'wm-input[type="date"], wm-input[type="datetime-local"], wm-input[type="month"], wm-input[type="time"], wm-input[type="week"]',
    templateUrl: './input-calendar.component.html',
    providers: [
        provideAs(InputCalendarComponent, NG_VALUE_ACCESSOR, true),
        provideAs(InputCalendarComponent, NG_VALIDATORS, true),
        provideAsWidgetRef(InputCalendarComponent)
    ]
})
export class InputCalendarComponent extends BaseInput implements OnDestroy {
    static readonly initializeProps = registerProps();

    public required: boolean;
    public disabled: boolean;
    public type: string;
    public name: string;
    public readonly: string;
    public conditionalclass: any;
    public conditionalstyle: any;
    public minvalue: any;
    public maxvalue: any;
    public step: number;
    public tabindex: any;
    public placeholder: any;
    public shortcutkey: string;
    public autofocus: boolean;
    public autocomplete: any;
    public hint: string;
    public arialabel: string;

    @ViewChild('input',{static: true}) inputEl: ElementRef;
    @ViewChild(NgModel) ngModel: NgModel;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild references
        this.inputEl = null;
        this.ngModel = null;

        // Call parent ngOnDestroy
        super.ngOnDestroy();
    }
}
