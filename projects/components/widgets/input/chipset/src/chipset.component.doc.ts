import { Input } from '@angular/core';

/**
 * The wmChipset component defines the chipset (chip selection group) widget.
 */

export class Chipset {
    /**
     * Class of the widget. The visual style of the chips (e.g. outlined vs elevated) is controlled
     * through the widget's Variant setting in Studio, which resolves to a class here at design time.
     */
    @Input() class: string = 'chipset-outlined';
    /**
     * This property sets the dataValue to be returned by the chipset widget when the list is populated using the dataSet property. <br>
     */
    @Input() datafield: string;
    /**
     * This property accepts the options to create the chipset widget.
     * These options can be array of values, array of objects, object containing key-value pairs. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() dataset: Array<any> | Object = 'Option 1, Option 2, Option 3';
    /**
     * This property defines the initial selected value(s) of the chipset widget. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() datavalue: any;
    /**
     * This property is used to disable individual chips, driven from the bound data. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() disableitem: boolean;
    /**
     * This property will be used to disable the chipset widget.
     * If the disabled property is true (checked), the widget becomes display-only. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() disabled: boolean;
    /**
     * This is an advanced property that gives more control over what is displayed as the label for a chip.
     * A Display Expression uses a JavaScript expression to format exactly what is shown <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() displayexpression: string;
    /**
     * This property sets the displayValue to show in the chipset widget when the list is populated using the dataSet property. <br>
     */
    @Input() displayfield: string;
    /**
     * This property sets the field name whose value should be used as an avatar image on the leading edge of each chip.
     * When the resolved value is empty, the chip renders with no leading visual. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() displayimagesrc: string;
    /**
     * Allows to group the dataset based on this field. <br>
     */
    @Input() groupby: string;
    /**
     * This property sets the field name whose value should be used as the css class name for a font icon shown
     * on the leading edge of each chip. Ignored when displayimagesrc resolves to a value for that chip. <br>
     */
    @Input() iconclass: string;
    /**
     * This property sets the field name whose value should be used as an icon/svg url shown on the leading edge
     * of each chip. Ignored when displayimagesrc resolves to a value for that chip. <br>
     */
    @Input() iconurl: string;
    /**
     * This property allows user to select a pre-defined list class name from the view-list drop down on the right.
     */
    @Input() itemsperrow: string = 'xs-1 sm-1 md-1 lg-1';
    /**
     * Name of the chipset widget.
     */
    @Input() name: string;
    /**
     * Allows to display the data in asc or desc order based on this property <br>
     */
    @Input() orderby: string;
    /**
     * This property will be used to make the chipset widget non-editable. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() readonly: boolean;
    /**
     * This property will be used to validate the state of the chipset widget when used inside a form widget. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() required: boolean;
    /**
     * This property controls whether the chipset behaves as a single-select (radiogroup) or
     * multi-select (checkbox-group) widget. <br>
     * <p><em>Allowed Values: </em><code>single, multiple</code></p>
     */
    @Input() selectionmode: string = 'single';
    /**
     * This property will be used to show/hide the chipset widget. <br>
     * <p><em>Bindable: </em><code>true</code></p>
     */
    @Input() show: boolean = true;
    /**
     * This property specifies the tab order of the chipset widget.
     */
    @Input() tabindex: number = 0;
    /**
     * If set to true, use the keys of the dataset object as chipset options. <br>
     */
    @Input() usekeys: boolean;

    /**
     * Callback function which will be triggered before the selection changes. Returning false cancels the change.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     * @param newVal  value that would result if the change is allowed
     * @param oldVal  datavalue before the change
     */
    onBeforechange($event: MouseEvent, widget: any, newVal: any, oldVal: any) {}
    /**
     * Callback function which will be triggered when the widget is clicked or when datavalue has changed.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     * @param newVal  datavalue of the chipset widget
     * @param oldVal  previously selected datavalue of the chipset widget
     */
    onChange($event: MouseEvent, widget: any, newVal: any, oldVal: any) {}
    /**
     * Callback function which will be triggered when a chip is selected.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     * @param $item   the dataset item corresponding to the selected chip
     */
    onSelect($event: MouseEvent, widget: any, $item: any) {}
    /**
     * Callback function which will be triggered when a chip is deselected.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     * @param $item   the dataset item corresponding to the deselected chip
     */
    onDeselect($event: MouseEvent, widget: any, $item: any) {}
    /**
     * Callback function which will be triggered when the mouse enters the widget.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     */
    onMouseenter($event: MouseEvent, widget: any) {}
    /**
     * Callback function which will be triggered when the mouse leaves the widget.
     * @param $event  DOM event on which call back is triggered
     * @param widget  Instance of the chipset widget
     */
    onMouseleave($event: MouseEvent, widget: any) {}
}
