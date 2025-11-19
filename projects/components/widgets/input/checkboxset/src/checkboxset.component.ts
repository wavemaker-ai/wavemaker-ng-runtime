import { CommonModule } from '@angular/common';
import {Component, HostListener, Inject, Injector, Optional} from '@angular/core';
import { NG_VALUE_ACCESSOR, NG_VALIDATORS } from '@angular/forms';

import {setListClass} from '@wm/core';
import { ItemTemplateDirective, IWidgetConfig, PartialContainerDirective, PartialParamHandlerDirective, provideAs, provideAsWidgetRef, styler, TextContentDirective } from '@wm/components/base';
import { DatasetAwareFormComponent } from '@wm/components/input/dataset-aware-form';

import { registerProps } from './checkboxset.props';
import {forEach, includes} from "lodash-es";

declare const $;

const DEFAULT_CLS = 'app-checkboxset list-group inline';
const WIDGET_CONFIG: IWidgetConfig = {widgetType: 'wm-checkboxset', hostClass: DEFAULT_CLS};

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, ItemTemplateDirective, PartialParamHandlerDirective, PartialContainerDirective],
    selector: '[wmCheckboxset]',
    exportAs: 'wmCheckboxset',
    templateUrl: 'checkboxset.component.html',
    providers: [
        provideAs(CheckboxsetComponent, NG_VALUE_ACCESSOR, true),
        provideAs(CheckboxsetComponent, NG_VALIDATORS, true),
        provideAsWidgetRef(CheckboxsetComponent)
    ]
})

export class CheckboxsetComponent extends DatasetAwareFormComponent {
    static initializeProps = registerProps();

    // Explicit declarations for TypeScript - these properties are inherited from base classes
    declare public readonly nativeElement: HTMLElement;
    declare protected viewParent: any;
    // datavalue is an accessor (getter/setter) in DatasetAwareFormComponent, not a property - do not redeclare
    declare public invokeOnChange: (value: any, $event?: Event | any, valid?: boolean) => void;
    declare public invokeOnTouched: ($event?: Event) => void;
    // modelByKey is an accessor (getter/setter) in DatasetAwareFormComponent, not a property - do not redeclare
    declare public multiple: boolean;
    declare protected eventManager: any;
    declare public readonly: boolean;
    declare public groupby: string;

    public layout = '';
    public collapsible: boolean;

    protected match: string;
    protected dateformat: string;

    public disabled: boolean;
    public itemsperrow: string;
    private itemsPerRowClass: string;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        // Access inherited nativeElement from BaseComponent and pass this as any for type compatibility
        styler((this as any).nativeElement, this as any);
        this.multiple = true;
    }

    triggerInvokeOnChange(keys, $event) {
        this.modelByKey = keys;

        if(this.viewParent.containerWidget && this.viewParent.containerWidget.updateDataValue)
            this.viewParent.containerWidget.updateDataValue(this.datavalue);

        this.invokeOnTouched();
        // invoke on datavalue change.
        this.invokeOnChange(this.datavalue, $event || {}, true);
    }

    onCheckboxLabelClick($event, key) {
        // PERFORMANCE FIX: Use native check instead of jQuery
        if ($event.target.tagName !== 'INPUT') {
            return;
        }

        // PERFORMANCE FIX: Use native querySelectorAll and Array.from instead of forEach
        // Avoid creating unnecessary jQuery objects and reduce overhead
        const inputElements = this.nativeElement.querySelectorAll('input:checked');
        const keys = [];
        // Convert NodeList to array for iteration
        Array.from(inputElements).forEach(($el: HTMLInputElement) => {
            keys.push($el.value);
        });

        this.triggerInvokeOnChange(keys, $event);
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
        return () => {};
    }

    @HostListener('keydown.enter', ['$event', '"ENTER"'])
    onKeyDown($event) {
        $event.preventDefault();
        const target = $event?.target as HTMLElement;
        if (target && typeof target.click === 'function') {
            target.click();
        }
    }

    onPropertyChange(key, nv, ov?) {

        if (key === 'tabindex') {
            return;
        }
        if (key === 'required') {
            // Access inherited _onChange from base class
            (this as any)._onChange(this.datavalue);
            return;
        }
        if (key === 'itemsperrow') {
            setListClass(this);
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }
}
