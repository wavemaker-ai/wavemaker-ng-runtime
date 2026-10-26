import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { App, AppDefaults, DataSource, FormWidgetType } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { TableColumnDirective } from './table-column.directive';
import { TableComponent } from '../table.component';
import {
    applyFilterOnField,
    fetchRelatedFieldData,
    getDistinctFieldProperties,
    getDistinctValues,
    getDistinctValuesForField,
    isDataSetWidget,
} from '@wm/components/base';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    isDataSetWidget: jest.fn(),
    fetchRelatedFieldData: jest.fn(),
    getDistinctValuesForField: jest.fn(),
    getDistinctValues: jest.fn(),
    getDistinctFieldProperties: jest.fn(() => ({ props: true })),
    applyFilterOnField: jest.fn(),
}));

@Component({
    standalone: false,
    template: '<div wmTableColumn></div>',
})
class HostComponent {}

describe('TableColumnDirective - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let directive: any;
    let table: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        table = {
            redraw: jest.fn(),
            registerColumns: jest.fn(),
            headerConfig: [],
            filtermode: 'multicolumn',
            registerFormField: jest.fn(),
            editmode: 'inline',
            callDataGridMethod: jest.fn(),
            ngform: {
                addControl: jest.fn(),
                markAsUntouched: jest.fn(),
                touched: false,
                controls: { testField: new FormControl(), _new_testField: new FormControl() },
            },
            fb: new FormBuilder(),
            rowFilter: { testField: { value: '' } },
            fieldDefs: [],
            dataset: [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }],
            binddataset: 'Variables.x.dataSet',
            datasource: { execute: jest.fn(() => false) },
        };
        await TestBed.configureTestingModule({
            declarations: [HostComponent],
            imports: [ReactiveFormsModule, TableColumnDirective],
            providers: [
                { provide: TableComponent, useValue: table },
                { provide: AppDefaults, useValue: { dateFormat: 'yyyy-MM-dd', timeFormat: 'HH:mm:ss', dateTimeFormat: 'yyyy-MM-dd HH:mm:ss' } },
                { provide: App, useValue: mockApp },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        directive = fixture.debugElement.children[0].injector.get(TableColumnDirective);
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('dataoptions and datasource accessors', () => {
        it('stores and returns them', () => {
            directive.dataoptions = { a: 1 };
            directive.datasource = { b: 2 };
            expect(directive.dataoptions).toEqual({ a: 1 });
            expect(directive.datasource).toEqual({ b: 2 });
        });
    });

    describe('validators', () => {
        let fv: any;
        let fvNew: any;

        beforeEach(() => {
            fv = { setValidators: jest.fn(), setUpValidators: jest.fn(), setAsyncValidators: jest.fn(), observeOn: jest.fn(), setCustomValidationMessage: jest.fn(), validate: jest.fn() };
            fvNew = { ...fv, setValidators: jest.fn(), setUpValidators: jest.fn(), setAsyncValidators: jest.fn(), observeOn: jest.fn(), validate: jest.fn() };
            directive.fieldValidations = fv;
            directive.fieldValidations_new = fvNew;
            directive.binding = 'testField';
        });

        it('applies sync, async and observed validators when the control exists', () => {
            directive.syncValidators = [{ s: 1 }];
            directive.asyncValidators = [{ a: 1 }];
            directive.observeOnFields = ['x'];
            directive.applyValidations();
            expect(fv.setValidators).toHaveBeenCalledWith([{ s: 1 }]);
            expect(fv.setUpValidators).toHaveBeenCalled();
            expect(fv.setAsyncValidators).toHaveBeenCalledWith([{ a: 1 }]);
            expect(fv.observeOn).toHaveBeenCalledWith(['x'], 'columns');
        });

        it('applies only the default validators when none are configured', () => {
            directive.syncValidators = [];
            directive.asyncValidators = [];
            directive.observeOnFields = [];
            directive.applyValidations();
            expect(fv.setValidators).not.toHaveBeenCalled();
            expect(fv.setAsyncValidators).not.toHaveBeenCalled();
            expect(fv.observeOn).not.toHaveBeenCalled();
        });

        it('skips applying validators without a form control', () => {
            jest.spyOn(directive, 'getFormControl').mockReturnValue(undefined);
            directive.applyValidations();
            expect(fv.setUpValidators).not.toHaveBeenCalled();
        });

        it('clears the validators of the inline control and marks the form untouched', () => {
            const control = { clearValidators: jest.fn(), clearAsyncValidators: jest.fn(), updateValueAndValidity: jest.fn() };
            jest.spyOn(directive, 'getFormControl').mockReturnValue(control);
            directive.removeValidations();
            expect(table.ngform.markAsUntouched).toHaveBeenCalled();
            expect(control.clearValidators).toHaveBeenCalled();
            expect(control.clearAsyncValidators).toHaveBeenCalled();
            expect(control.updateValueAndValidity).toHaveBeenCalled();
        });

        it('only marks the form untouched when the control is missing', () => {
            jest.spyOn(directive, 'getFormControl').mockReturnValue(undefined);
            directive.removeValidations();
            expect(table.ngform.markAsUntouched).toHaveBeenCalled();
        });

        it('guards validation removal after destroy or without a form', () => {
            directive.isDestroyed = true;
            directive.removeValidations();
            directive.removeNewRowValidations();
            directive.applyNewRowValidations();
            expect(table.ngform.markAsUntouched).not.toHaveBeenCalled();
            directive.isDestroyed = false;
            table.ngform = null;
            directive.removeValidations();
            directive.applyNewRowValidations();
            directive.removeNewRowValidations();
        });

        it('applies the validators of the new row control', () => {
            jest.spyOn(directive, '_checkNewEditableRowControl').mockReturnValue(true);
            directive.syncValidators = [{ s: 1 }];
            directive.asyncValidators = [{ a: 1 }];
            directive.observeOnFields = ['x'];
            directive.applyNewRowValidations();
            expect(fvNew.setValidators).toHaveBeenCalled();
            expect(fvNew.setUpValidators).toHaveBeenCalled();
            expect(fvNew.setAsyncValidators).toHaveBeenCalled();
            expect(fvNew.observeOn).toHaveBeenCalledWith(['x'], 'columns');
        });

        it('skips new row validators without a new row control', () => {
            jest.spyOn(directive, '_checkNewEditableRowControl').mockReturnValue(false);
            directive.applyNewRowValidations();
            directive.removeNewRowValidations();
            expect(fvNew.setUpValidators).not.toHaveBeenCalled();
            expect(table.ngform.markAsUntouched).toHaveBeenCalled();
        });

        it('clears the validators of the new row control', () => {
            const control = { clearValidators: jest.fn(), clearAsyncValidators: jest.fn(), updateValueAndValidity: jest.fn() };
            jest.spyOn(directive, '_checkNewEditableRowControl').mockReturnValue(true);
            const get = jest.spyOn(directive, 'getFormControl').mockReturnValue(control);
            directive.removeNewRowValidations();
            expect(get).toHaveBeenCalledWith('_new');
            expect(control.clearValidators).toHaveBeenCalled();
            get.mockReturnValue(undefined);
            directive.removeNewRowValidations();
        });

        it('sets up the validators of both rows', () => {
            jest.spyOn(directive, '_checkNewEditableRowControl').mockReturnValue(true);
            directive.setUpValidators();
            expect(fv.setUpValidators).toHaveBeenCalled();
            expect(fvNew.setUpValidators).toHaveBeenCalled();
        });

        it('stores cloned validators and observed fields', () => {
            const list = [{ x: 1 }];
            directive.setValidators(list);
            directive.setAsyncValidators(list);
            directive.observeOn(['a']);
            expect(directive.syncValidators).toEqual(list);
            expect(directive.syncValidators).not.toBe(list);
            expect(directive.asyncValidators).toEqual(list);
            expect(directive.observeOnFields).toEqual(['a']);
        });

        it('notifies the dependent fields of changes', () => {
            const dependent = { fieldValidations: { validate: jest.fn() }, fieldValidations_new: { validate: jest.fn() } };
            directive.notifyForFields = [dependent];
            directive._isNewEditableRow = true;
            directive.notifyChanges('_new');
            expect(dependent.fieldValidations_new.validate).toHaveBeenCalled();
            directive.notifyChanges();
            expect(dependent.fieldValidations.validate).toHaveBeenCalled();
        });

        it('shows the pending spinner according to the status', () => {
            directive.onStatusChange('PENDING', 'inlineInstance');
            expect(directive.showPendingSpinner).toBe(true);
            directive.onStatusChange('VALID', 'inlineInstance');
            expect(directive.showPendingSpinner).toBe(false);
            directive.onStatusChange('PENDING', 'inlineInstanceNew');
            expect(directive.showPendingSpinnerNew).toBe(true);
        });
    });

    describe('form controls and values', () => {
        it('resets the row filter and clears autocomplete queries', () => {
            const control = new FormControl('abc');
            directive.filterControl = control;
            directive.filterwidget = FormWidgetType.AUTOCOMPLETE;
            directive.filterInstance = { query: 'q', queryModel: 'm' };
            directive.resetFilter();
            expect(control.value).toBe('');
            expect(directive.filterInstance).toMatchObject({ query: '', queryModel: '' });
        });

        it('resets safely without a control or autocomplete', () => {
            directive.filterControl = null;
            directive.filterwidget = 'text';
            expect(() => directive.resetFilter()).not.toThrow();
        });

        it('stores the filter value and cascades it to dependent widgets', () => {
            directive.field = 'testField';
            directive.onFilterValueChange('v');
            expect(table.rowFilter.testField.value).toBe('v');
            expect(applyFilterOnField).toHaveBeenCalledWith(table.datasource, directive.widget, table.fieldDefs, 'v', { widget: 'filterwidget' });
        });

        it.each([[null], [undefined]])('does not cascade the empty value %s', (val) => {
            directive.field = 'testField';
            directive.onFilterValueChange(val);
            expect(applyFilterOnField).not.toHaveBeenCalled();
        });

        it('does not cascade after destroy or without a datasource', () => {
            directive.field = 'testField';
            table.datasource = undefined;
            directive.onFilterValueChange('v');
            directive.isDestroyed = true;
            directive.onFilterValueChange('w');
            expect(applyFilterOnField).not.toHaveBeenCalled();
        });

        it('reads the data value of the active control', () => {
            directive.activeControlType = 'inlineInstance';
            directive.inlineInstance = { datavalue: 7 };
            expect(directive.datavalue).toBe(7);
            expect(directive.value).toBe(7);
        });

        it('writes the data value to the active form control except for uploads', () => {
            const control = new FormControl('');
            jest.spyOn(directive, 'getFormControl').mockReturnValue(control);
            directive.activeControlType = 'inlineInstanceNew';
            directive.value = 'x';
            expect(directive.getFormControl).toHaveBeenCalledWith('_new');
            expect(control.value).toBe('x');
            directive.editWidgetType = FormWidgetType.UPLOAD;
            directive.datavalue = 'y';
            expect(control.value).toBe('x');
        });

        it('ignores data value writes without a control', () => {
            jest.spyOn(directive, 'getFormControl').mockReturnValue(undefined);
            expect(() => { directive.datavalue = 1; }).not.toThrow();
        });

        it('adds and gets controls with a suffix', () => {
            directive.binding = 'testField';
            directive.addFormControl('_new');
            expect(table.ngform.addControl).toHaveBeenCalledWith('testField_new', expect.anything());
            table.ngform.controls.testField_new = new FormControl();
            expect(directive.getFormControl('_new')).toBe(table.ngform.controls.testField_new);
            expect(directive.getFormControl()).toBe(table.ngform.controls.testField);
        });
    });

    describe('onValueChange', () => {
        beforeEach(() => {
            directive.fieldValidations = { setCustomValidationMessage: jest.fn() };
            directive.fieldValidations_new = { setCustomValidationMessage: jest.fn() };
            jest.spyOn(directive, 'notifyChanges').mockImplementation(() => undefined);
        });

        it('cascades the value and does nothing else while the form is untouched', () => {
            directive.onValueChange('v', 'inlineInstance');
            expect(applyFilterOnField).toHaveBeenCalledWith(table.datasource, directive.widget, table.fieldDefs, 'v', { widget: 'edit-widget-type' });
            expect(directive.notifyChanges).not.toHaveBeenCalled();
        });

        it('skips cascading null values', () => {
            directive.onValueChange(null, 'inlineInstance');
            expect(applyFilterOnField).not.toHaveBeenCalled();
        });

        it('validates the inline widget once the form is touched', () => {
            table.ngform.touched = true;
            directive.onValueChange('v', 'inlineInstance');
            expect(directive.activeControlType).toBe('inlineInstance');
            expect(directive.notifyChanges).toHaveBeenCalledWith();
            expect(directive.fieldValidations.setCustomValidationMessage).toHaveBeenCalled();
        });

        it('validates the new row widget once the form is touched', () => {
            table.ngform.touched = true;
            directive._isNewEditableRow = true;
            directive.onValueChange('v', 'inlineInstanceNew');
            expect(directive.notifyChanges).toHaveBeenCalledWith('_new');
            expect(directive.fieldValidations_new.setCustomValidationMessage).toHaveBeenCalled();
        });

        it('does nothing for new row widgets of plain rows', () => {
            table.ngform.touched = true;
            directive._isNewEditableRow = false;
            directive.onValueChange('v', 'inlineInstanceNew');
            expect(directive.notifyChanges).not.toHaveBeenCalled();
        });

        it('does nothing after destroy or without a table', () => {
            directive.isDestroyed = true;
            directive.onValueChange('v', 'inlineInstance');
            directive.isDestroyed = false;
            directive.table = null;
            directive.onValueChange('v', 'inlineInstance');
            expect(applyFilterOnField).not.toHaveBeenCalled();
        });
    });

    describe('filter data', () => {
        beforeEach(() => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive._isRowFilter = true;
            directive.filterwidget = 'select';
            directive.bindfilterdataset = undefined;
            directive.field = 'dept.name';
        });

        it('does nothing when filtering is not row based, the widget is not a data set widget or the dataset is bound', () => {
            directive._isRowFilter = false;
            directive.loadFilterData();
            directive._isRowFilter = true;
            (isDataSetWidget as jest.Mock).mockReturnValue(false);
            directive.loadFilterData();
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive.bindfilterdataset = 'bind';
            directive.loadFilterData();
            expect(table.datasource.execute).not.toHaveBeenCalled();
        });

        it('loads distinct values for select widgets and marks related columns', async () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_DISTINCT_API);
            (getDistinctValues as jest.Mock).mockResolvedValue({ data: ['a', 'b'] });
            directive.relatedEntityName = 'Dept';
            directive.filterInstance = {};
            directive.loadFilterData();
            expect(directive.widget['is-related']).toBe(true);
            expect(directive.widget['lookup-type']).toBe('Dept');
            expect(directive.widget['lookup-field']).toBe('name');
            await Promise.resolve();
            await Promise.resolve();
            expect(directive._filterDataSet).toEqual(['a', 'b']);
            expect(directive.filterInstance.dataset).toEqual(['a', 'b']);
        });

        it('hands the distinct data options to autocomplete widgets', () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_DISTINCT_API);
            directive.filterwidget = FormWidgetType.AUTOCOMPLETE;
            directive.filterInstance = {};
            directive.loadFilterData();
            expect(getDistinctFieldProperties).toHaveBeenCalledWith(table.datasource, directive);
            expect(directive.filterInstance.dataoptions).toEqual({ props: true });
            expect(directive.filterInstance.datasource).toBe(table.datasource);
        });

        it('tolerates an autocomplete without an instance', () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_DISTINCT_API);
            directive.filterwidget = FormWidgetType.AUTOCOMPLETE;
            directive.filterInstance = undefined;
            expect(() => directive.loadFilterData()).not.toThrow();
        });

        it('watches the table dataset for data sources without a distinct api', () => {
            const register = jest.spyOn(directive, 'registerDestroyListener').mockImplementation(() => undefined);
            table.datasource.execute.mockReturnValue(false);
            directive.loadFilterData();
            expect(register).toHaveBeenCalled();
        });

        it('only sets the filter dataset on an existing instance', () => {
            directive.filterInstance = undefined;
            directive._filterDataSet = [1];
            expect(() => directive.setFilterWidgetDataSet()).not.toThrow();
            directive.filterInstance = {};
            directive.setFilterWidgetDataSet();
            expect(directive.filterInstance.dataset).toEqual([1]);
        });
    });

    describe('inline widget data', () => {
        beforeEach(() => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive['edit-widget-type'] = 'select';
            directive.binddataset = undefined;
            directive.readonly = false;
            directive.binding = 'dept.id';
        });

        it('fetches related field data for related columns', () => {
            directive['related-entity-name'] = 'Dept';
            directive['primary-key'] = 'id';
            directive.loadInlineWidgetData();
            expect(directive.isDataSetBound).toBe(true);
            expect(directive.showPendingSpinner).toBe(true);
            expect(fetchRelatedFieldData).toHaveBeenCalledWith(table.datasource, directive.widget, { relatedField: 'dept', datafield: 'id', widget: 'edit-widget-type' });
        });

        it('fetches distinct values when the data source supports them', () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_DISTINCT_API);
            directive.loadInlineWidgetData();
            expect(getDistinctValuesForField).toHaveBeenCalled();
        });

        it('does nothing without distinct api support, for bound or readonly widgets', () => {
            directive.loadInlineWidgetData();
            directive.binddataset = 'x';
            directive.loadInlineWidgetData();
            directive.binddataset = undefined;
            directive.readonly = true;
            directive.loadInlineWidgetData();
            expect(getDistinctValuesForField).not.toHaveBeenCalled();
            expect(fetchRelatedFieldData).not.toHaveBeenCalled();
        });

        it('loads the inline data only in quick edit mode after a data source change', () => {
            const filter = jest.spyOn(directive, 'loadFilterData').mockImplementation(() => undefined);
            const inline = jest.spyOn(directive, 'loadInlineWidgetData').mockImplementation(() => undefined);
            directive.onDataSourceChange();
            expect(filter).toHaveBeenCalled();
            expect(inline).not.toHaveBeenCalled();
            table.editmode = 'quickedit';
            directive.onDataSourceChange();
            expect(inline).toHaveBeenCalled();
        });
    });

    describe('filter widget set up', () => {
        const run = (instance: any) => {
            directive.filterInstance = { registerReadyStateListener: (cb: any) => cb(), ...instance };
            directive.setUpFilterWidget();
            return directive.filterInstance;
        };

        beforeEach(() => {
            directive.binding = 'dept.id';
            directive._filterDataSet = ['x'];
        });

        it('configures data set widgets', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive.filterwidget = 'select';
            const instance = run({});
            expect(instance).toMatchObject({ dataset: ['x'], datafield: 'id', displayfield: 'id', placeholder: '' });
        });

        it('prefers the configured fields and configures autocomplete labels', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive.filterwidget = FormWidgetType.AUTOCOMPLETE;
            directive.filterdatafield = 'df';
            directive.filterdisplayfield = 'dd';
            directive.filterdisplaylabel = 'dl';
            directive.filtersearchkey = 'sk';
            directive.filterplaceholder = 'ph';
            const instance = run({});
            expect(instance).toMatchObject({ datafield: 'df', displayfield: 'dd', displaylabel: 'dl', searchkey: 'sk', placeholder: 'ph' });
        });

        it('falls back to the field for autocomplete labels', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive.filterwidget = FormWidgetType.AUTOCOMPLETE;
            directive.filterdisplaylabel = undefined;
            directive.filtersearchkey = undefined;
            const instance = run({});
            expect(instance).toMatchObject({ displaylabel: 'id', searchkey: 'id' });
        });

        it('sets the time pattern of time filters', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(false);
            directive.filterwidget = FormWidgetType.TIME;
            expect(run({}).timepattern).toBe('HH:mm:ss');
            directive.appDefaults = {};
            expect(run({}).timepattern).toBe('hh:mm:ss a');
        });
    });

    describe('inline widget set up', () => {
        it('copies the properties into the inline widget', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            directive['edit-widget-type'] = 'select';
            directive.dataset = [1, 2];
            directive._datasource = { ds: true };
            directive._dataoptions = { opt: true };
            directive.editdatepattern = 'yyyy';
            directive.editWidgetType = 'date';
            directive.inlineInstance = { registerReadyStateListener: (cb: any) => cb() };
            directive.setUpInlineWidget('inlineInstance');
            expect(directive.inlineInstance).toMatchObject({ dataset: [1, 2], datasource: { ds: true }, dataoptions: { opt: true }, datepattern: 'yyyy' });
        });

        it('sets the time pattern for time widgets and skips undefined values or missing widgets', () => {
            directive.editWidgetType = FormWidgetType.TIME;
            directive.inlineInstance = {};
            directive.setInlineWidgetProp('inlineInstance', 'datepattern', 'hh');
            expect(directive.inlineInstance.timepattern).toBe('hh');
            directive.setInlineWidgetProp('inlineInstance', 'foo', undefined);
            expect(directive.inlineInstance).not.toHaveProperty('foo');
            expect(() => directive.setInlineWidgetProp('missing', 'foo', 1)).not.toThrow();
        });

        it('does not copy the dataset of widgets without data set support', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(false);
            directive.inlineInstance = { registerReadyStateListener: (cb: any) => cb() };
            directive.setUpInlineWidget('inlineInstance');
            expect(directive.inlineInstance.dataset).toBeUndefined();
        });
    });

    describe('summary rows', () => {
        beforeEach(() => {
            directive.key = 'col';
        });

        it('sets plain and wrapped summary data', () => {
            directive.setSummaryRowData({ value: 1 });
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setSummaryRowDef', 'col', { value: 1 }, 0);
            directive.setSummaryRowData([{ value: 2 }, { value: 3 }]);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setSummaryRowDef', 'col', { value: 3 }, 1);
        });

        it('resolves promise summary values', async () => {
            directive.setSummaryRowData(Promise.resolve('p'));
            await Promise.resolve();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setSummaryRowDef', 'col', 'p', 0, true);
        });

        it('resolves promise values inside summary objects', async () => {
            const item = { value: Promise.resolve('r') };
            directive.setSummaryRowData([item]);
            await Promise.resolve();
            await Promise.resolve();
            expect(item.value).toBe('r');
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setSummaryRowDef', 'col', item, 0, true);
        });

        it('ignores promise results after the table is gone', async () => {
            const spy = table.callDataGridMethod;
            directive.setSummaryRowData([Promise.resolve('p'), { value: Promise.resolve('q') }]);
            spy.mockClear();
            directive.table = null;
            await Promise.resolve();
            await Promise.resolve();
            expect(spy).not.toHaveBeenCalled();
        });

        it('aggregates the column data', () => {
            directive.binding = 'a';
            expect(directive.aggregate.sum()).toBe(9);
            expect(directive.aggregate.average()).toBe(3);
            expect(directive.aggregate.average(0)).toBe(3);
            expect(directive.aggregate.count()).toBe(3);
            expect(directive.aggregate.minimum()).toBe(1);
            expect(directive.aggregate.maximum()).toBe(5);
            expect(directive.aggregate.percent(18)).toBe(50);
        });

        it('calls bound functions', () => {
            expect(directive.boundFn(() => 5)).toBe(5);
        });
    });

    describe('field definition and properties', () => {
        it('builds the style definition', () => {
            directive.width = '10px';
            directive.backgroundcolor = 'red';
            directive.textcolor = 'blue';
            expect(directive.getStyleDef()).toBe('width: 10px; background-color: red; color: blue;');
            directive.width = undefined;
            directive.backgroundcolor = undefined;
            directive.textcolor = undefined;
            expect(directive.getStyleDef()).toBe('width: ; background-color: ; color: ;');
        });

        it('normalises the field definition values', () => {
            directive.width = 'px';
            directive.type = 'blob';
            directive.searchable = true;
            directive.formatpattern = 'toNumber';
            directive.limit = '5';
            directive.generator = 'identity';
            directive.sortby = undefined;
            directive.populateFieldDef();
            expect(directive.width).toBe('');
            expect(directive.searchable).toBe(false);
            expect(directive.formatpattern).toBe('numberToString');
            expect(directive.limit).toBe(5);
            expect(directive.readonly).toBe(true);
            expect(directive.sortby).toBe('');
        });

        it('derives readonly from related entities', () => {
            directive['related-entity-name'] = 'Dept';
            directive['primary-key'] = undefined;
            directive.populateFieldDef();
            expect(directive.readonly).toBe(true);
            directive['primary-key'] = 'id';
            directive.populateFieldDef();
            expect(directive.readonly).toBe(false);
        });

        it.each([
            ['date', 'dateFormat', 'yyyy-MM-dd'],
            ['time', 'timeFormat', 'HH:mm:ss'],
            ['timestamp', 'dateTimeFormat', 'yyyy-MM-dd HH:mm:ss'],
            ['datetime', 'dateTimeFormat', 'yyyy-MM-dd HH:mm:ss'],
        ])('sets the default pattern of %s columns', (type, _key, expected) => {
            directive.type = type;
            directive.formatpattern = 'toDate';
            directive.datepattern = undefined;
            directive.populateFieldDef();
            expect(directive.datepattern).toBe(expected);
        });

        it('falls back to the default format without app defaults', () => {
            directive.appDefaults = {};
            directive.type = 'date';
            directive.formatpattern = 'toDate';
            directive.datepattern = undefined;
            directive.populateFieldDef();
            expect(directive.datepattern).toBeTruthy();
        });

        it('sets the display name on the grid and redraws for other properties', () => {
            directive.field = 'f';
            directive.setProperty('displayName', 'Name');
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setColumnProp', 'f', 'displayName', 'Name');
            directive.setProperty('width', '5px');
            expect(directive.width).toBe('5px');
            expect(table.redraw).toHaveBeenCalledWith(true);
        });
    });

    describe('onPropertyChange', () => {
        beforeEach(() => {
            directive._propsInitialized = true;
            directive.field = 'f';
        });

        it('ignores changes before the properties are initialised', () => {
            directive._propsInitialized = false;
            directive.onPropertyChange('show', true, false);
            expect(table.redraw).not.toHaveBeenCalled();
        });

        it('registers a new caption with the header config', () => {
            directive.onPropertyChange('caption', 'Cap', '');
            expect(directive.displayName).toBe('Cap');
            expect(table.headerConfig).toBeDefined();
        });

        it('updates the caption of an already registered column', () => {
            table.headerConfig = [{ field: 'f', displayName: 'Old' }];
            directive.onPropertyChange('caption', 'New', 'Old');
            expect(table.headerConfig[0].displayName).toBe('New');
        });

        it('uses the group index for columns inside a group', () => {
            directive.group = { name: 'grp' };
            directive.getAttr = jest.fn().mockReturnValue('1');
            directive.onPropertyChange('caption', 'Cap', '');
            expect(directive.getAttr).toHaveBeenCalledWith('index');
        });

        it('refreshes the default value', () => {
            directive.type = 'string';
            directive.defaultvalue = 'abc';
            directive.onPropertyChange('defaultvalue', 'abc', '');
            expect(directive.defaultvalue).toBeDefined();
        });

        it('redraws and updates the filter visibility on show changes', () => {
            directive.onPropertyChange('show', false, true);
            expect(table.redraw).toHaveBeenCalledWith(false);
            expect(directive.showinfilter).toBe(false);
            directive.nativeElement.setAttribute('showinfilter', 'true');
            directive.onPropertyChange('show', false, true);
            expect(directive.showinfilter).toBe('true');
        });

        it('updates the filter dataset and visibility', () => {
            directive.filterInstance = {};
            directive.onPropertyChange('filterdataset', [1], []);
            expect(directive.filterInstance.dataset).toEqual([1]);
            directive.onPropertyChange('showinfilter', false, true);
            expect(directive.showinfilter).toBe(false);
        });

        it('passes edit date patterns to both inline widgets', () => {
            directive.inlineInstance = {};
            directive.inlineInstanceNew = {};
            directive.onPropertyChange('editdatepattern', 'yy', '');
            expect(directive.inlineInstance.datepattern).toBe('yy');
            expect(directive.inlineInstanceNew.datepattern).toBe('yy');
        });

        it('refreshes the sort header when sortable changes', () => {
            directive.onPropertyChange('sortable', true, false);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('refreshSortHeader');
            directive.table = undefined;
            expect(() => directive.onPropertyChange('sortable', true, false)).not.toThrow();
        });

        it('passes inline widget properties on and ignores unrelated ones', () => {
            directive.inlineInstance = {};
            directive.inlineInstanceNew = {};
            directive.onPropertyChange('placeholder', 'p', '');
            expect(directive.inlineInstance.placeholder).toBe('p');
            directive.onPropertyChange('unrelated', 'p', '');
            expect(directive.inlineInstance).not.toHaveProperty('unrelated');
        });
    });

    describe('destroy', () => {
        it('releases every reference even when cleanup throws', () => {
            const boom = () => { throw new Error('boom'); };
            directive._filterInstances = { reset: boom };
            directive._inlineInstances = { reset: boom };
            directive._inlineInstancesNew = { reset: boom };
            directive.fieldValidations = { destroy: boom };
            directive.fieldValidations_new = { destroy: boom };
            directive.notifyForFields = [1];
            directive.observeOnFields = [1];
            directive.ngOnDestroy();
            expect(directive.filterInstance).toBeNull();
            expect(directive.table).toBeNull();
            expect(directive.fieldValidations).toBeNull();
            expect(directive.fieldValidations_new).toBeNull();
            expect(directive.syncValidators).toEqual([]);
            expect(directive.notifyForFields).toEqual([]);
            expect(directive.observeOnFields).toEqual([]);
        });

        it('clears the query lists', () => {
            const reset = jest.fn();
            directive._filterInstances = { reset };
            directive._inlineInstances = { reset };
            directive._inlineInstancesNew = { reset };
            directive.fieldValidations = { destroy: jest.fn() };
            directive.ngOnDestroy();
            expect(reset).toHaveBeenCalledTimes(3);
        });
    });
});
