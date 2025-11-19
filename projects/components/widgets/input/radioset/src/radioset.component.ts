import { CommonModule } from '@angular/common';
import {Component, Inject, Injector, Optional} from '@angular/core';
import { NG_VALUE_ACCESSOR, NG_VALIDATORS } from '@angular/forms';

import {setListClass} from '@wm/core';

import { provideAsWidgetRef, styler, provideAs, TextContentDirective, ItemTemplateDirective, PartialContainerDirective, PartialParamHandlerDirective } from '@wm/components/base';
import { DatasetAwareFormComponent } from '@wm/components/input/dataset-aware-form';
import { registerProps } from './radioset.props';
import { includes} from "lodash-es";

declare const $;

const DEFAULT_CLS = 'app-radioset list-group inline';
const WIDGET_CONFIG = {widgetType: 'wm-radioset', hostClass: DEFAULT_CLS};

@Component({
  standalone: true,
  imports: [CommonModule, TextContentDirective, ItemTemplateDirective, PartialParamHandlerDirective, PartialContainerDirective],
    selector: '[wmRadioset]',
    exportAs: 'wmRadioset',
    templateUrl: './radioset.component.html',
    providers: [
        provideAs(RadiosetComponent, NG_VALUE_ACCESSOR, true),
        provideAs(RadiosetComponent, NG_VALIDATORS, true),
        provideAsWidgetRef(RadiosetComponent)
    ]
})
export class RadiosetComponent extends DatasetAwareFormComponent {
    static initializeProps = registerProps();

    // Explicit declarations for TypeScript - these properties are inherited from base classes
    declare public readonly nativeElement: HTMLElement;
    declare protected viewParent: any;
    // datavalue and modelByKey are inherited as accessors from DatasetAwareFormComponent, not as instance properties
    declare public invokeOnChange: (value: any, $event?: Event | any, valid?: boolean) => void;
    declare public invokeOnTouched: ($event?: Event) => void;
    declare public multiple: boolean;
    declare protected eventManager: any;
    declare public readonly: boolean;
    declare public groupby: string;

    public layout = '';
    public disabled: boolean;
    public itemsperrow: string;
    private itemsPerRowClass: string;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this as any);
        this.multiple = false;
    }

    triggerInvokeOnChange(key, $event) {
        this.modelByKey = key;

        if(this.viewParent.containerWidget && this.viewParent.containerWidget.updateDataValue)
            this.viewParent.containerWidget.updateDataValue(this.datavalue);

        this.invokeOnTouched();
        // invoke on datavalue change.
        this.invokeOnChange(this.datavalue, $event || {}, true);
    }

    /**
     * On click of the option, update the datavalue
     */
    onRadioLabelClick($event, key) {
        // PERFORMANCE FIX: Use native check instead of jQuery
        if ($event.target.tagName !== 'INPUT') {
            return;
        }

        this.triggerInvokeOnChange(key, $event);
    }

    // change and blur events are added from the template
    protected handleEvent(node: HTMLElement, eventName: string, callback: Function, locals: any) {
        if (eventName === 'click') {
            return this.eventManager.addEventListener(
                node,
                eventName,
                e => {
                    // PERFORMANCE FIX: Use native tagName check instead of jQuery
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                        return;
                    }
                    locals.$event = e;
                    return callback();
                }
            );
        } else if (!includes(['change'], eventName)) {
            return super.handleEvent(node, eventName, callback, locals);
        }
        return () => {}
    }

    onPropertyChange(key, nv, ov?) {
        if (key === 'tabindex') {
            return;
        }
        if (key === 'itemsperrow') {
            setListClass(this);
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }
}
