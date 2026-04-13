import {
    convertDataToObject,
    IWidgetConfig,
    provideAs,
    provideAsWidgetRef,
    styler,
    TextContentDirective
} from "@wm/components/base";
import {FormsModule, NG_VALUE_ACCESSOR, NgModel} from '@angular/forms';
import {Component, Inject, Injector, OnDestroy, Optional, ViewChild} from '@angular/core';
import {BaseFormCustomComponent} from '@wm/components/input/base-form-custom';

import {registerProps} from './slider.props';
import {App, isDefined, switchClass} from "@wm/core";
import { CommonModule } from "@angular/common";


const DEFAULT_CLS = 'app-slider slider';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-slider',
    hostClass: DEFAULT_CLS
};
const RANGE_LABEL_POSITION: {[key: string]: string} = {
  top: 'range-label-top',
  side: 'range-label-side',
  bottom: 'range-label-bottom',
};
@Component({
    standalone: true,
    imports: [TextContentDirective, FormsModule, CommonModule],
    selector: '[wmSlider]',
    templateUrl: './slider.component.html',
    providers: [
        provideAs(SliderComponent, NG_VALUE_ACCESSOR, true),
        provideAsWidgetRef(SliderComponent)
    ]
})
export class SliderComponent extends BaseFormCustomComponent implements OnDestroy {
    static initializeProps = registerProps();

    public minvalue: number;
    public maxvalue: number;
    public disabled: boolean;
    public step: number;
    public shortcutkey: string;
    public tabindex: any;
    public name: string;
    public readonly: boolean;
    public hint: string;
    public arialabel: string;
    public markerlabeltext: string
    public showmarkers: boolean;
    public showicons: boolean;
    public starticon: string;
    public endicon:string;
    public isPrism: boolean = false;

    @ViewChild(NgModel) ngModel: NgModel;
    public markerItems: any[];

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any, public app?: App) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this);
        this.isPrism = this.app.isPrism;
    }

    // change and blur events are added from the template
    protected handleEvent(node: HTMLElement, eventName: string, callback: Function, locals: any) {
        if (eventName !== 'change' && eventName !== 'blur') {
            super.handleEvent(node, eventName, callback, locals);
        }
    }

    public handleChange(newVal?: boolean) {
        this.updateSliderValue();
        this.invokeOnChange(this.datavalue, {type: 'change'}, this.ngModel.valid);
    }

    updateSliderValue() {
        const sliderValue = 100 - ((((Number(this.datavalue) || 0) - (this.minvalue || 0)) / ((this.maxvalue || 100) - (this.minvalue || 0))) * 100);
        const slider = this.nativeElement.querySelector('.slider-control') as HTMLElement;
        if (slider) {
            const safePercent = Math.min(100, Math.max(0, sliderValue));
            slider.style.setProperty('--end', `${safePercent}%`);
        }
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'tabindex') {
            return;
        }
        else if(key === 'showmarkers'||key === 'markerlabeltext' || key === 'minvalue'||key === 'maxvalue'||key === 'step') {
            if(this.showmarkers) {
                this.renderMarkers();
            }
        } else if(key === 'rangelabelposition'){
             switchClass(this.nativeElement, RANGE_LABEL_POSITION[nv], RANGE_LABEL_POSITION[ov]);
        }else if(key === 'datavalue'){
             this.datavalue = (nv === "" || nv === null) ? (this.datavalue ?? 50) : nv
             this.updateSliderValue()
        }
        super.onPropertyChange(key, nv, ov);
    }
    private renderMarkers() {
        const sliderTrack = this.nativeElement.querySelector('.range-input') as HTMLElement;
        const trackWidth = sliderTrack?.offsetWidth-9|| 0;
        const tickCount = this.step > 0 ? Math.floor((this.maxvalue||100 - this.minvalue||0) / this.step) + 1 : 0;
        const labels = convertDataToObject(this.markerlabeltext);
        this.markerItems = [];
        for (let i = 0; i < tickCount; i++) {
            const left = ((trackWidth / (tickCount - 1)) * i);
            const label = labels?.[i]?.dataValue ?? (Array.isArray(labels) ? (typeof labels[i] === 'object' && labels[i]?.title ? labels[i].title : labels[i]) : `${i}`);
            const position = Array.isArray(labels) && typeof labels[i] === 'object' && labels[i]?.position ? labels[i].position : 'up';
            this.markerItems.push({ label, position, left });
        }
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();
        if(this.showmarkers) {
            setTimeout(() => {this.renderMarkers();}, 40);
        }
        if(this.datavalue){
          setTimeout(() => {this.updateSliderValue();});
        }
    }

    decrementButtonClick(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.disabled) {
            return;
        }

        const step = Number(this.step) || 1;
        const min = Number(this.minvalue) || 0;

        let value = Number(this.datavalue ?? 50);
        value = value - step;
        if (value <= min) {
            return;
        }
        if (!isNaN(min)) {
            value = Math.max(value, min);
        }

        this.datavalue = value;
        this.handleChange()
    }


    incrementButtonClick(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.disabled) {
            return;
        }

        const step = Number(this.step) || 1;
        const max = Number(this.maxvalue) || 100;

        let value = Number(this.datavalue ?? 50);
        value = value + step;
        if (value >= max)  return;

        if (!isNaN(max)) {
            value = Math.min(value, max);
        }

        this.datavalue = value;
        this.handleChange()
    }


    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild reference
        this.ngModel = null;

        // MEMORY LEAK FIX: Clear marker items array
        if (this.markerItems) {
            this.markerItems = [];
        }

        // Call parent ngOnDestroy
        super.ngOnDestroy();
    }
}
