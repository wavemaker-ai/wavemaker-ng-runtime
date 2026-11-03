import {AfterViewInit, Inject, Injectable, Injector, OnDestroy, Optional} from '@angular/core';

import {DataSource} from '@wm/core';

import {IWidgetConfig, StylableComponent, WidgetConfig} from '@wm/components/base';
import {get, has, set} from "lodash-es";

@Injectable()
export abstract class BaseFormComponent extends StylableComponent implements AfterViewInit, OnDestroy {

    private dataval;
    private prevDatavalue;
    protected binddatavalue: string;
    private datavaluesource: any;

    protected constructor(
        protected inj: Injector,
        @Inject(WidgetConfig) config: IWidgetConfig,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any,
        initPromise?: Promise<any>
    ) {
        super(inj, config, explicitContext, initPromise);
        this.binddatavalue = this.$element.attr('datavalue.bind');
    }

    set datavalue(datavalue) {
        this.dataval = datavalue;
    }

    get datavalue() {
        return this.dataval;
    }

    /**
     * Responsible for updating the variable bound to the widget's datavalue property.
     * @param value
     */
    updateBoundVariable(value) {
        let binddatavalue = this.binddatavalue;

        // return if the variable bound is not static.
        if (this.datavaluesource?.execute(DataSource.Operation.IS_API_AWARE)) {
            return;
        } else if (this.datavaluesource && !this.datavaluesource.twoWayBinding) {
                return;
        }

        // return if widget is bound.
        if (!binddatavalue || binddatavalue.startsWith('Widgets.') || binddatavalue.startsWith('itemRef.currentItemWidgets')) {
            return;
        }

        binddatavalue = binddatavalue.replace(/\[\$i\]/g, '[0]');
        binddatavalue = binddatavalue.replace(
            /\[(.*?)\]/g,
            (_match, key) => {
                try {
                    // eval is blocked when CSP / Trusted Types is enforced, so resolve a plain property path first
                    let value = get(this.viewParent, key);
                    if (value === undefined) {
                        value = eval(`this.viewParent.${key}`);
                    }
                    if (typeof value === 'string' || typeof value === 'number')
                     return `[${value}]`;
                    else
                     return '[0]'
                } catch {
                    return '[0]'; // fallback if evaluation fails
                }
            }
        );


        // In case of list widget context will be the listItem.
        if (has(this.context, binddatavalue.split('.')[0]) && has(this.context, binddatavalue)) {
            set(this.context, binddatavalue, value);
        }
        // Parent widget must update on custom widget datavalue change for bindings to work
        else if (has(this.viewParent, binddatavalue) && this.viewParent.containerWidget?._isCustom) {
            set(this.viewParent, binddatavalue, value);
        } else if (has(this.viewParent, binddatavalue) && this.datavaluesource?.owner === "Page") {
            set(this.viewParent, binddatavalue, value);
        } else if (has(this.viewParent?.App, binddatavalue) && this.datavaluesource?.owner === "App") {
            set(this.viewParent.App, binddatavalue, value);
        }
    }

    protected invokeOnChange(value, $event?: Event) {
        // invoke the event callback
        if ($event) {
            if (this.datavalue !== this.prevDatavalue) {
                this.updateBoundVariable(value);
                this.invokeEventCallback('change', {
                    $event,
                    newVal: value,
                    oldVal: this.prevDatavalue
                });
            }
        }
        // update the previous value
        this.prevDatavalue = value;
    }

    protected updatePrevDatavalue(val: any) {
        this.prevDatavalue = val;
    }
    protected getPrevDataValue() {
        return this.prevDatavalue;
    }

    private boundKeydownHandler: (event: JQuery.Event) => void;

    ngAfterViewInit() {
        super.ngAfterViewInit();

// [WMS-18892]- stopping event propagation [for ArrowLeft, ArrowUp, ArrowRight, ArrowDown actions]  when form widgets or form is inside list widget
        let parentElemList = $(this.nativeElement).parents();
        if (parentElemList.closest('[wmList]').length) {
            // MEMORY LEAK FIX: Store bound function reference for cleanup
            this.boundKeydownHandler = function($event) {
                if ($event.keyCode === 37 || $event.keyCode === 38 || $event.keyCode === 39 || $event.keyCode === 40) {
                    $event.stopPropagation();
                }
            };
            this.$element.keydown(this.boundKeydownHandler);
        }
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove jQuery event listener
        if (this.boundKeydownHandler) {
            this.$element.off('keydown', this.boundKeydownHandler);
            this.boundKeydownHandler = null;
        }

        // MEMORY LEAK FIX: Clear references
        this.prevDatavalue = null;
        this.datavaluesource = null;
        this.binddatavalue = null;

        super.ngOnDestroy();
    }
}
