import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {Component, ElementRef, Inject, Injector, Optional, ViewChild} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import {generateGUId, noop} from '@wm/core';
import { getOrderedDataset, provideAs, provideAsWidgetRef, styler, TextContentDirective } from '@wm/components/base';
import { DatasetAwareFormComponent } from '@wm/components/input/dataset-aware-form';

import { registerProps } from './rating.props';
import {find, isEmpty, isUndefined, slice, toString} from "lodash-es";

const DEFAULT_CLS = 'app-ratings';
const WIDGET_CONFIG = {widgetType: 'wm-rating', hostClass: DEFAULT_CLS};

const MAX_RATING = 10;
const DEFAULT_RATING = 5;

@Component({
  standalone: true,
  imports: [CommonModule, TextContentDirective, FormsModule],
    selector: '[wmRating]',
    templateUrl: './rating.component.html',
    providers: [
        provideAs(RatingComponent, NG_VALUE_ACCESSOR, true),
        provideAsWidgetRef(RatingComponent)
    ]
})
export class RatingComponent extends DatasetAwareFormComponent {
    static initializeProps = registerProps();

    public caption: string;
    public showcaptions: boolean;
    public maxvalue;

    private _selectedRatingValue;
    public ratingsWidth;
    public ratingItems;
    private _id;

    public iconsize: string;
    public iconcolor: string;
    public onFocus: any;
    private touchEnabled:boolean;
    public activeiconclass: string = '';
    public inactiveiconclass: string = '';
    @ViewChild('ratingInput', /* TODO: add static flag */ { read: ElementRef }) ratingEl: ElementRef;

    get selectedRatingValue() {
        return this._selectedRatingValue;
    }

    set selectedRatingValue(val) {
        this._selectedRatingValue = val;
        this.calculateRatingsWidth();
    }

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        this._id = generateGUId();
        // Access inherited nativeElement from BaseComponent and pass this as any for type compatibility
        styler((this as any).nativeElement, this as any);

        // prepare the rating options on dataset ready.
        // Access inherited dataset$ from DatasetAwareFormComponent
        const datasetSubscription = (this as any).dataset$.subscribe(() => {
            this.prepareRatingDataset();
        });
        // Access inherited registerDestroyListener from BaseComponent
        (this as any).registerDestroyListener(() => datasetSubscription.unsubscribe());

        // listen to changes in datavalue.
        // Access inherited datavalue$ and datavalue from DatasetAwareFormComponent
        const datavalueSubscription = (this as any).datavalue$.subscribe(() => this.onDatavalueChange((this as any).datavalue));
        // Access inherited registerDestroyListener from BaseComponent
        (this as any).registerDestroyListener(() => datavalueSubscription.unsubscribe());
    }

    // Change event is registered from the template, Prevent the framework from registering one more event
    protected handleEvent(node: HTMLElement, eventName: string, eventCallback: Function, locals: any) {
        if (eventName !== 'change' && eventName !== 'blur') {
            return super.handleEvent(this.ratingEl.nativeElement, eventName, eventCallback, locals);
        }
        return () => {}
    }

    // This function returns the rating widget dataset containing the index, value and label
    private prepareRatingDataset() {
        // Access inherited datasetItems from DatasetAwareFormComponent
        if (!(this as any).datasetItems.length) {
            this.ratingItems = [];
            this.caption = '';
        }

        let ratingItems = [];
        // Access inherited datasetItems from DatasetAwareFormComponent
        let data = (this as any).datasetItems;
        const maxvalue = parseInt(this.maxvalue || (this as any).datasetItems.length, 10);
        const maxValue = (maxvalue > MAX_RATING ? MAX_RATING : maxvalue) || DEFAULT_RATING;

        /**
         * 1. If datasetItems.length is more than maxValue (i.e. 10 ratings) then just extract maxValue of items from datasetItems.
         * 2. If datasetItems are not available then prepare ratings value depending on maxvalue. eg: 1,2,3 .. upto maxvalue
         * 3. If maxvalue / i value is more than datasetItems length, prepare default rating items for i values more than datasetItems.length
         */
        if (data.length && data.length > maxValue) {
            data = slice(data, 0, maxValue);
        }

        for (let i = maxValue; i > 0; i--) {
            if (!data.length) {
                ratingItems.push({key: i, value: i, index: i, label: i});
            } else {
                if (i > data.length) {
                    ratingItems.push({key: i, value: i, index: i, label: i});
                } else {
                    data = getOrderedDataset(data, 'index:desc');
                    ratingItems = ratingItems.concat(data);
                    break;
                }
            }
        }

        this.ratingItems = ratingItems;
        if (!data.length) { // constructs default datasetItems when there is no dataset binding.
            // Access inherited datasetItems from DatasetAwareFormComponent
            (this as any).datasetItems = ratingItems;
        }
        // Access inherited datavalue from DatasetAwareFormComponent
        this.onDatavalueChange((this as any).datavalue);
    }

    onRatingClick($event, rate) {
        // Access inherited modelByKey from DatasetAwareFormComponent
        (this as any).modelByKey = rate.key;
        this.selectedRatingValue = rate.index;

        // support if the caption is binded in the old projects for backward compatibility
        if (!this.showcaptions) {
            this.caption = rate.label;
        }

        // Access inherited invokeOnTouched from BaseFormCustomComponent
        (this as any).invokeOnTouched();
        // invoke on datavalue change.
        // Access inherited invokeOnChange and datavalue from base classes
        (this as any).invokeOnChange((this as any).datavalue, $event || {}, true);
    }

    // Update the selected flag on datasetItems and assign the ratingValue.
    /**
     * On datavalue change, update the caption, selectedRatingValue.
     * 1. if datasetItems contain the selected item (check the selected flag on item), find the index of selected item.
     * 2. if not, just check if the datavalue is provided as the index on the item.
     *
     * @param dataVal datavalue
     */
    onDatavalueChange(dataVal) {
        // Access inherited datasetItems from DatasetAwareFormComponent
        if (!isEmpty((this as any).datasetItems)) {
            let selectedItem = find((this as any).datasetItems, {'selected': true});

            if (!selectedItem && !isUndefined(dataVal)) {
                // Access inherited datasetItems from DatasetAwareFormComponent
                selectedItem = find((this as any).datasetItems, function (item) {
                    return toString(item.index) === dataVal;
                });
                if (selectedItem) {
                    selectedItem.selected = true;
                }
            }

            if (!selectedItem) {
                // reset the  model if there is no item found.
                // Access inherited modelByKey from DatasetAwareFormComponent
                (this as any).modelByKey = undefined;
                this.caption = '';
            }

            this.selectedRatingValue = selectedItem ? selectedItem.index : 0;
            if (selectedItem) {
                this.caption = selectedItem.label;
            }
        } else {
            this.selectedRatingValue = 0;
        }
        if (this.readonly) {
            // when dataset is not given but datavalue is provided which is integer
            if (!this.selectedRatingValue && !isNaN(dataVal)) {
                this.selectedRatingValue = (parseFloat(dataVal) <= this.maxvalue) ? dataVal : this.maxvalue;
            }
            this.ratingsWidth = this.calculateRatingsWidth(dataVal);
        }
    }

    calculateRatingsWidth(dataVal?: any) {
        const selectedRating = parseFloat(this.selectedRatingValue),
            starWidth = 0.925,
            // Access inherited datasetItems from DatasetAwareFormComponent
            maxValue = parseInt(this.maxvalue || (this as any).datasetItems.length, 10) || DEFAULT_RATING;

        // Access inherited datavalue from DatasetAwareFormComponent
        dataVal = dataVal || (this as any).datavalue;
        if (dataVal === undefined || dataVal === '' || dataVal === null) {
            this.caption = '';
            return 0;
        }
        if (selectedRating <= maxValue && selectedRating >= 0) {
            return selectedRating * starWidth + 'em';
        }
        if (selectedRating > maxValue) {
            return maxValue * starWidth + 'em';
        }
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'readonly') {
            if (nv) {
                this.ratingsWidth = this.calculateRatingsWidth();
            }
        } else if (key === 'maxvalue') {
            /** Storing the datavalue in temp variable and assiging back to datavalue
             * after default datalist is prepared to trigger Dataset Aware class select cycle
             * as the datavalue property change is triggering first rather than maxvalue
             * in the rating widget is used inside a datatable
             */
            // Access inherited datavalue from DatasetAwareFormComponent
            let tempDataValue = (this as any).datavalue;
            this.prepareRatingDataset();
            // reset all the items.
            this.resetDatasetItems();
            if (!isUndefined(tempDataValue)) {
                // Access inherited datavalue from DatasetAwareFormComponent
                (this as any).datavalue = tempDataValue;
            }
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    /* Detect touch enabled devices & update hover styles*/
    onTouchStart($event) {
        this.touchEnabled = true;
        this.onTouchStart = noop;
    }
    onMouseleave() {
        this.caption = this.displayValue as string;
    }

    onMouseOver($event, rate) {
        this.caption = rate.label;
        !this.touchEnabled && !$event.target.classList.contains('rating-label-hover') && $event.target.classList.add('rating-label-hover');
    }
}
