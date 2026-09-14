import { CommonModule } from '@angular/common';
import {Component, HostListener, Inject, Injector, OnDestroy, Optional} from '@angular/core';
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

export class CheckboxsetComponent extends DatasetAwareFormComponent implements OnDestroy {
    static initializeProps = registerProps();

    public layout = '';
    public collapsible: boolean;

    protected match: string;
    protected dateformat: string;

    public disabled: boolean;
    public itemsperrow: string;
    private itemsPerRowClass: string;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this);
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
        if (!$($event.target).is('input')) {
            return;
        }

        // Previously this re-derived the full checked set via a live DOM query
        // (`querySelectorAll('input:checked')`) on every single click — cost scales with total
        // checkbox count on the page, since it has to walk every rendered <input>. The click
        // event's target already tells us exactly which item just toggled and to what state;
        // every other item's `.selected` flag is already correct (DatasetAwareFormComponent's
        // `modelByKey` setter resets and re-marks it from the full keys array on every change),
        // so the same result — checked keys, in the same order the widget itself renders them —
        // can be derived from data already held in memory, with no DOM query at all.
        //
        // Render order (and therefore the required output order, since selectByKey's
        // datavalue-building loop preserves the order of the keys array it's given) differs
        // between modes: the default template iterates `datasetItems` directly, while groupby
        // mode iterates `groupedData` (each group's own `.data` array), which `orderby` can
        // reorder relative to `datasetItems`. Deriving from whichever array the template itself
        // renders from keeps this correct in both modes by construction, instead of assuming one
        // order.
        const isChecked = ($event.target as HTMLInputElement).checked;
        const orderedItems: any[] = this.groupby
            ? (this.groupedData || []).flatMap((group: any) => group.data)
            : this.datasetItems;

        const keys = [];
        forEach(orderedItems, (item: any) => {
            if (item.key === key ? isChecked : item.selected) {
                keys.push(item.key);
            }
        });

        this.triggerInvokeOnChange(keys, $event);
    }

    private eventListeners: Map<HTMLElement, Function> = new Map();

    // change and blur events are added from the template
    protected handleEvent(node: HTMLElement, eventName: string, callback: Function, locals: any) {
        if (eventName === 'click') {
            const handler = (e) => {
                if (!$(e.target).is('input')) {
                    return;
                }
                locals.$event = e;
                return callback();
            };
            
            const deregister = this.eventManager.addEventListener(node, eventName, handler);
            this.eventListeners.set(node, deregister);
        } else if (!includes(['change'], eventName)) {
            super.handleEvent(node, eventName, callback, locals);
        }
    }

    @HostListener('keydown.enter', ['$event'])
    onKeyDown($event: KeyboardEvent) {
        $event.preventDefault();
        ($event.target as HTMLElement).click();
    }

    onPropertyChange(key, nv, ov?) {

        if (key === 'tabindex') {
            return;
        }
        if (key === 'required') {
            this._onChange(this.datavalue);
            return;
        }else if(key === 'layout'){
            this.handleLayout(nv)
        }
        if (key === 'itemsperrow') {
            setListClass(this);
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }
    handleLayout(layout: string) {
        const direction = layout === 'vertical' ? 'column' : 'row';
        this.$element.css({
            display: 'flex',
            flexDirection: direction
        });
    }


    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove all event listeners
        if (this.eventListeners && this.eventListeners.size > 0) {
            this.eventListeners.forEach((deregister) => {
                if (deregister && typeof deregister === 'function') {
                    deregister();
                }
            });
            this.eventListeners.clear();
            this.eventListeners = null;
        }

        super.ngOnDestroy();
    }
}
