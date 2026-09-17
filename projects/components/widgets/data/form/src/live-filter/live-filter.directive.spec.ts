import { fakeAsync, tick } from '@angular/core/testing';
import { LiveFilterDirective } from './live-filter.directive';
import { DataSource, FormWidgetType, DataType } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    applyFilterOnField: jest.fn(),
    fetchDistinctValues: jest.fn(),
    getDistinctValuesForField: jest.fn(),
    isDataSetWidget: jest.fn()
}));

import { applyFilterOnField, fetchDistinctValues, getDistinctValuesForField, isDataSetWidget } from '@wm/components/base';

const createMockElement = () => {
    const chain: any = {
        val: jest.fn().mockReturnValue(''),
        first: jest.fn(),
        last: jest.fn()
    };
    chain.first.mockReturnValue(chain);
    chain.last.mockReturnValue(chain);
    return { find: jest.fn().mockReturnValue(chain) };
};

const createMockField = (overrides = {}) => ({
    field: 'firstname',
    name: 'firstname',
    widgettype: FormWidgetType.TEXT,
    type: DataType.STRING,
    value: undefined,
    minValue: undefined,
    maxValue: undefined,
    readonly: false,
    show: true,
    resetDisplayInput: jest.fn(),
    ...overrides
});

const createMockForm = () => ({
    formFields: [createMockField()],
    datasource: { execute: jest.fn().mockReturnValue(Promise.resolve({ data: {}, pagination: {} })) },
    enableemptyfilter: '',
    appLocale: { LABEL_NO_VALUE: '(empty)' },
    autoupdate: false,
    $element: createMockElement(),
    resetFormState: jest.fn(),
    invokeEventCallback: jest.fn(),
    toggleMessage: jest.fn(),
    onResultCb: jest.fn(),
    pagesize: 20,
    pagination: null,
    result: null,
    filterWidgets: {}
});

const createDirective = (form: any) => new LiveFilterDirective(form);

describe('LiveFilterDirective', () => {
    let form: any;

    beforeEach(() => {
        jest.clearAllMocks();
        form = createMockForm();
    });

    describe('constructor', () => {
        it('should rebind the filter-related methods onto the form', () => {
            const originalFilterFn = form.filter;
            const directive = createDirective(form);
            expect(directive).toBeTruthy();
            expect(form.clearFilter).toBeInstanceOf(Function);
            expect(form.applyFilter).toBeInstanceOf(Function);
            expect(form.filter).not.toBe(originalFilterFn);
            expect(form.execute).toBeInstanceOf(Function);
        });
    });

    describe('execute', () => {
        it('should delegate LIST_RECORDS/DOWNLOAD to applyFilter', () => {
            const directive = createDirective(form);
            const applySpy = jest.spyOn(directive, 'applyFilter').mockReturnValue('applied' as any);
            expect(directive.execute(DataSource.Operation.LIST_RECORDS, { page: 2 })).toEqual('applied');
            expect(applySpy).toHaveBeenCalledWith({ page: 2 });
        });

        it('should return the stored options for GET_OPTIONS', () => {
            const directive = createDirective(form);
            (directive as any)._options = { page: 3 };
            expect(directive.execute(DataSource.Operation.GET_OPTIONS, {})).toEqual({ page: 3 });
        });

        it('should return an empty object for GET_OPTIONS when nothing was stored yet', () => {
            const directive = createDirective(form);
            expect(directive.execute(DataSource.Operation.GET_OPTIONS, {})).toEqual({});
        });

        it('should return form.pagination for GET_PAGING_OPTIONS', () => {
            form.pagination = { total: 10 };
            const directive = createDirective(form);
            expect(directive.execute(DataSource.Operation.GET_PAGING_OPTIONS, {})).toEqual({ total: 10 });
        });

        it('should return an empty object when there is no datasource', () => {
            form.datasource = null;
            const directive = createDirective(form);
            expect(directive.execute(DataSource.Operation.GET_ENTITY_NAME, {})).toEqual({});
        });

        it('should fetch distinct values for FETCH_DISTINCT_VALUES', () => {
            const directive = createDirective(form);
            directive.execute(DataSource.Operation.FETCH_DISTINCT_VALUES, {});
            expect(fetchDistinctValues).toHaveBeenCalled();
        });

        it('should delegate any other operation to the datasource', () => {
            const directive = createDirective(form);
            directive.execute(DataSource.Operation.GET_ENTITY_NAME, { a: 1 });
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.GET_ENTITY_NAME, { a: 1 });
        });
    });

    describe('onFieldDefaultValueChange', () => {
        it('should set minValue/value and trigger filterOnDefault', () => {
            const directive = createDirective(form);
            const spy = jest.spyOn(directive, 'filterOnDefault').mockImplementation(() => undefined);
            const field = createMockField();
            directive.onFieldDefaultValueChange(field, 'x');
            expect(field.minValue).toEqual('x');
            expect(field.value).toEqual('x');
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('onFieldValueChange', () => {
        it('should apply the field filter', () => {
            const directive = createDirective(form);
            const field = createMockField();
            directive.onFieldValueChange(field, 'v');
            expect(applyFilterOnField).toHaveBeenCalled();
        });

        it('should trigger the debounced filter when autoupdate is enabled and the value is defined', () => {
            form.autoupdate = true;
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.onFieldValueChange(createMockField(), 'v');
            expect(filterSpy).toHaveBeenCalled();
        });

        it('should not trigger the debounced filter when autoupdate is disabled', () => {
            form.autoupdate = false;
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.onFieldValueChange(createMockField(), 'v');
            expect(filterSpy).not.toHaveBeenCalled();
        });
    });

    describe('onMaxDefaultValueChange', () => {
        it('should call filterOnDefault asynchronously', fakeAsync(() => {
            const directive = createDirective(form);
            const spy = jest.spyOn(directive, 'filterOnDefault').mockImplementation(() => undefined);
            directive.onMaxDefaultValueChange();
            expect(spy).not.toHaveBeenCalled();
            tick();
            expect(spy).toHaveBeenCalled();
        }));
    });

    describe('onDataSourceChange', () => {
        it('should do nothing without a datasource', () => {
            form.datasource = null;
            const directive = createDirective(form);
            directive.onDataSourceChange();
            expect(isDataSetWidget).not.toHaveBeenCalled();
        });

        it('should refresh dataset-bound fields and re-filter', fakeAsync(() => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.onDataSourceChange();
            expect(getDistinctValuesForField).toHaveBeenCalled();
            expect(applyFilterOnField).toHaveBeenCalled();
            expect(filterSpy).toHaveBeenCalled();
        }));

        it('should skip fields that are not dataset widgets', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(false);
            const directive = createDirective(form);
            directive.onDataSourceChange();
            expect(getDistinctValuesForField).not.toHaveBeenCalled();
        });
    });

    describe('clearFilter', () => {
        it('should reset form state and skip readonly/hidden fields', fakeAsync(() => {
            const field = createMockField({ readonly: true, value: 'x' });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.clearFilter();
            expect(form.resetFormState).toHaveBeenCalled();
            expect(field.value).toEqual('x');
            tick();
        }));

        it('should clear a range field via minValue/maxValue', fakeAsync(() => {
            const field = createMockField({ 'is-range': true, minValue: 1, maxValue: 10 });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.clearFilter();
            expect(field.minValue).toEqual('');
            expect(field.maxValue).toEqual('');
            tick();
        }));

        it('should clear a plain field value and reset its display', fakeAsync(() => {
            const field = createMockField({ value: 'x' });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.clearFilter();
            expect(field.value).toEqual('');
            expect(field.resetDisplayInput).toHaveBeenCalled();
            tick();
        }));

        it('should clear the input value for autocomplete/typeahead fields via the DOM', fakeAsync(() => {
            const field = createMockField({ widgettype: FormWidgetType.AUTOCOMPLETE });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.clearFilter();
            expect(form.$element.find).toHaveBeenCalled();
            tick();
        }));

        it('should trigger the debounced filter after clearing', fakeAsync(() => {
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.clearFilter();
            expect(filterSpy).not.toHaveBeenCalled();
            tick();
            expect(filterSpy).toHaveBeenCalled();
        }));
    });

    describe('submitForm', () => {
        it('should invoke filter', () => {
            const directive = createDirective(form);
            const spy = jest.spyOn(directive, 'filter').mockImplementation(() => undefined as any);
            directive.submitForm();
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('applyFilter', () => {
        it('should default to page 1 and the stored orderBy when no options are given', () => {
            const directive = createDirective(form);
            directive.orderBy = 'name asc';
            const filterSpy = jest.spyOn(directive, 'filter').mockImplementation(() => undefined as any);
            directive.applyFilter(undefined);
            expect(filterSpy).toHaveBeenCalledWith({ page: 1, orderBy: 'name asc' });
        });

        it('should unwrap options.data when present', () => {
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive, 'filter').mockImplementation(() => undefined as any);
            directive.applyFilter({ data: { page: 2, orderBy: 'age desc' } });
            expect(filterSpy).toHaveBeenCalledWith({ page: 2, orderBy: 'age desc' });
        });
    });

    describe('filter', () => {
        it('should do nothing without a datasource', () => {
            form.datasource = null;
            const directive = createDirective(form);
            expect(directive.filter()).toBeUndefined();
        });

        it('should abort silently when the beforeservicecall handler returns false', () => {
            form.invokeEventCallback.mockReturnValue(false);
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).not.toHaveBeenCalled();
        });

        it('should surface an error message when the beforeservicecall handler returns an error', () => {
            form.invokeEventCallback.mockReturnValue({ error: 'blocked' });
            const directive = createDirective(form);
            directive.filter();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'blocked', 'error', 'ERROR');
            expect(form.datasource.execute).not.toHaveBeenCalled();
        });

        it('should silently abort when the beforeservicecall handler throws "Abort"', () => {
            form.invokeEventCallback.mockImplementation(() => { throw new Error('Abort'); });
            const directive = createDirective(form);
            expect(() => directive.filter()).not.toThrow();
        });

        it('should request an export when exportType is provided', () => {
            form.datasource.execute.mockReturnValue('export-result');
            const directive = createDirective(form);
            const result = directive.filter({ exportType: 'csv', fileName: 'out.csv' });
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.DOWNLOAD, expect.objectContaining({
                data: expect.objectContaining({ exportType: 'csv', fileName: 'out.csv' })
            }));
            expect(result).toEqual('export-result');
        });

        it('should list records and report success when the response has no error', async () => {
            form.datasource.execute.mockReturnValue(Promise.resolve({ data: { rows: [] }, pagination: { total: 0 } }));
            const directive = createDirective(form);
            directive.filter();
            await new Promise(process.nextTick);
            expect(form.result).toEqual({ rows: [] });
            expect(form.onResultCb).toHaveBeenCalledWith({ rows: [] }, true);
        });

        it('should report a service error when the response payload has an error', async () => {
            form.datasource.execute.mockReturnValue(Promise.resolve({ data: { error: 'bad request' } }));
            const directive = createDirective(form);
            directive.filter();
            await new Promise(process.nextTick);
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'bad request', 'error', 'ERROR');
            expect(form.onResultCb).toHaveBeenCalledWith({ error: 'bad request' }, false);
        });

        it('should report a rejected list-records call', async () => {
            form.datasource.execute.mockReturnValue(Promise.reject('network error'));
            const directive = createDirective(form);
            directive.filter();
            await new Promise(process.nextTick);
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'network error', 'error', 'ERROR');
            expect(form.onResultCb).toHaveBeenCalledWith('network error', false);
        });

        it('should build a range filter when min/max values are present', () => {
            const field = createMockField({ 'is-range': true, field: 'age', type: DataType.INTEGER, minValue: 5, maxValue: 10 });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter({});
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ age: expect.objectContaining({ value: [5, 10] }) })
            }));
        });

        it('should apply the SELECT empty-key match mode branch', () => {
            const field = createMockField({ widgettype: FormWidgetType.SELECT, value: 'EMPTY_NULL_FILTER', field: 'status', type: DataType.STRING });
            form.formFields = [field];
            form.enableemptyfilter = 'null,empty';
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalled();
        });

        it('should parse boolean values for CHECKBOX/TOGGLE fields', () => {
            const field = createMockField({ widgettype: FormWidgetType.CHECKBOX, value: 'true', field: 'active', type: DataType.BOOLEAN });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ active: expect.objectContaining({ value: true }) })
            }));
        });

        it('should only include CHECKBOXSET/CHIPS values when non-empty', () => {
            const field = createMockField({ widgettype: FormWidgetType.CHIPS, value: [], field: 'tags', type: DataType.STRING });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            const call = form.datasource.execute.mock.calls[0][1];
            expect(call.filterFields.tags).toBeUndefined();
        });

        it('should include CHECKBOXSET/CHIPS values when non-empty', () => {
            const field = createMockField({ widgettype: FormWidgetType.CHIPS, value: ['a', 'b'], field: 'tags', type: DataType.STRING });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ tags: expect.objectContaining({ value: ['a', 'b'] }) })
            }));
        });

        it('should read autocomplete/typeahead field values from the DOM when $element is present', () => {
            const $el = form.$element;
            ($el.find as jest.Mock).mockReturnValue({
                val: jest.fn().mockReturnValue('typed-query'),
                first: jest.fn().mockReturnThis(),
                last: jest.fn().mockReturnThis()
            });
            const field = createMockField({ widgettype: FormWidgetType.AUTOCOMPLETE, field: 'city', value: undefined });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ city: expect.objectContaining({ value: 'typed-query' }) })
            }));
        });

        it('should read autocomplete range field min/max values from the DOM when $element is present', () => {
            const $el = form.$element;
            const chain: any = { val: jest.fn().mockReturnValueOnce('5').mockReturnValueOnce('10') };
            chain.first = jest.fn().mockReturnValue({ val: () => '5' });
            chain.last = jest.fn().mockReturnValue({ val: () => '10' });
            ($el.find as jest.Mock).mockReturnValue(chain);
            const field = createMockField({ widgettype: FormWidgetType.TYPEAHEAD, field: 'age', 'is-range': true, minValue: undefined, maxValue: undefined, type: DataType.INTEGER });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ age: expect.objectContaining({ value: ['5', '10'] }) })
            }));
        });

        it('should append the lookup-field for related fields', () => {
            const field = createMockField({ 'is-related': true, 'lookup-field': 'name', field: 'country', value: 'India', type: DataType.STRING });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ 'country.name': expect.anything() })
            }));
        });

        it('should apply the SELECT non-empty-key branch using the plain field value', () => {
            const field = createMockField({ widgettype: FormWidgetType.SELECT, value: 'active', field: 'status', type: DataType.STRING });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ status: expect.objectContaining({ value: 'active' }) })
            }));
        });

        it('should parse boolean values for a SELECT/RADIOSET field of type BOOLEAN', () => {
            const field = createMockField({ widgettype: FormWidgetType.RADIOSET, value: 'true', field: 'isActive', type: DataType.BOOLEAN });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ isActive: expect.objectContaining({ value: true }) })
            }));
        });

        it('should not set a boolean value for SELECT/RADIOSET when the value is empty', () => {
            const field = createMockField({ widgettype: FormWidgetType.SELECT, value: '', field: 'isActive', type: DataType.BOOLEAN });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            const call = form.datasource.execute.mock.calls[0][1];
            expect(call.filterFields.isActive).toBeUndefined();
        });

        it('should set a string match mode from the datasource when the field is a STRING type', () => {
            const field = createMockField({ field: 'firstname', value: 'Ram', type: DataType.STRING });
            form.formFields = [field];
            form.datasource.execute.mockImplementation((operation: any) =>
                operation === DataSource.Operation.GET_MATCH_MODE
                    ? 'anywhereignorecase'
                    : Promise.resolve({ data: {}, pagination: {} }));
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.GET_MATCH_MODE);
        });

        it('should prefer the field-level matchmode over the datasource default', () => {
            const field = createMockField({ field: 'firstname', value: 'Ram', type: DataType.STRING, matchmode: 'exact' });
            form.formFields = [field];
            const directive = createDirective(form);
            directive.filter();
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({
                filterFields: expect.objectContaining({ firstname: expect.objectContaining({ matchMode: 'exact' }) })
            }));
        });
    });

    describe('filterOnDefault', () => {
        it('should trigger the debounced filter when a default value is present', () => {
            form.formFields = [createMockField({ value: 'x' })];
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.filterOnDefault();
            expect(filterSpy).toHaveBeenCalled();
        });

        it('should not trigger the filter when no field has a default value', () => {
            form.formFields = [createMockField()];
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive as any, '_filter');
            directive.filterOnDefault();
            expect(filterSpy).not.toHaveBeenCalled();
        });
    });

    describe('_filter (debounced)', () => {
        it('should invoke the underlying filter once the real debounce delay elapses', (done) => {
            form.autoupdate = true;
            const directive = createDirective(form);
            const filterSpy = jest.spyOn(directive, 'filter').mockImplementation(() => undefined as any);
            directive.onFieldValueChange(createMockField(), 'v');
            setTimeout(() => {
                expect(filterSpy).toHaveBeenCalledWith(undefined);
                done();
            }, 300);
        });
    });

    describe('registerFormWidget', () => {
        it('should register the widget under its key/name on the form', () => {
            const directive = createDirective(form);
            const widget = { key: 'age' };
            directive.registerFormWidget(widget);
            expect(form.filterWidgets.age).toBe(widget);
        });
    });

    describe('ngOnDestroy', () => {
        it('should cancel the debounced filter and clear references', () => {
            const directive = createDirective(form);
            const cancelFn = jest.fn();
            (directive as any)._filter = Object.assign(jest.fn(), { cancel: cancelFn });
            directive.ngOnDestroy();
            expect(cancelFn).toHaveBeenCalled();
            expect((directive as any).form).toBeNull();
            expect((directive as any)._options).toBeNull();
            expect(directive.orderBy).toBeNull();
        });
    });
});
