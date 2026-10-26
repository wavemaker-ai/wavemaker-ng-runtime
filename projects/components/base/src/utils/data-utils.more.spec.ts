import { DataSource, FormWidgetType } from '@wm/core';
import {
    applyFilterOnField,
    fetchDistinctValues,
    fetchRelatedFieldData,
    Live_Operations,
    performDataOperation,
    transformData
} from './data-utils';

describe('data-utils - more', () => {
    afterEach(() => jest.restoreAllMocks());

    describe('performDataOperation', () => {
        it('rejects with the response when a CRUD operation reports an error', async () => {
            const response = { error: 'boom' };
            const dataSource = {
                execute: jest.fn((op: any) => (op === DataSource.Operation.SUPPORTS_CRUD ? true : Promise.resolve(response))),
            };
            await expect(performDataOperation(dataSource, {}, { operationType: Live_Operations.DELETE })).rejects.toBe(response);
            expect(dataSource.execute).toHaveBeenCalledWith(DataSource.Operation.DELETE_RECORD, {});
        });
    });

    describe('fetchRelatedFieldData for search widgets', () => {
        it('configures the data options instead of fetching the table data', () => {
            const execute = jest.fn().mockReturnValue(['id']);
            const field: any = { widgettype: FormWidgetType.AUTOCOMPLETE, showPendingSpinner: true, filterexpressions: { a: 1 } };

            fetchRelatedFieldData({ execute }, field, { relatedField: 'dept', datafield: 'name', widget: 'widgettype' });

            expect(field.dataoptions).toEqual({ relatedField: 'dept', filterExpr: { a: 1 } });
            expect(field.datasource).toEqual({ execute });
            expect(field._primaryKey).toBe('id');
            expect(field.compareby).toBe('id');
            expect(field.searchkey).toBe('name');
            expect(field.displaylabel).toBe('name');
            expect(field.displayfield).toBe('name');
            expect(field.showPendingSpinner).toBe(false);
            expect(execute).not.toHaveBeenCalledWith(DataSource.Operation.GET_RELATED_TABLE_DATA, expect.anything());
        });

        it('keeps existing search key and label, and defaults the filter expressions', () => {
            const execute = jest.fn().mockReturnValue([]);
            const field: any = { widgettype: FormWidgetType.CHIPS, searchkey: 'sk', displaylabel: 'dl' };

            fetchRelatedFieldData({ execute }, field, { relatedField: 'dept', datafield: 'All Fields', widget: 'widgettype' });

            expect(field.dataoptions.filterExpr).toEqual({});
            expect(field.searchkey).toBe('sk');
            expect(field.displayfield).toBe('dl');
            expect(field._primaryKey).toBeUndefined();
        });
    });

    describe('fetchDistinctValues', () => {
        it('does nothing for an empty list of fields', () => {
            const execute = jest.fn();
            fetchDistinctValues({ execute }, [], { widget: 'widgettype' });
            expect(execute).not.toHaveBeenCalled();
        });

        it('prepares every search field with the properties of its distinct column', () => {
            const execute = jest.fn().mockReturnValue('EMP');
            const dataSource = { execute };
            const fields: any[] = [
                { field: 'name', widgettype: FormWidgetType.TYPEAHEAD },
                { field: 'city', widgettype: FormWidgetType.CHIPS },
            ];

            fetchDistinctValues(dataSource, fields, { widget: 'widgettype' });

            expect(fields[0].datasource).toBe(dataSource);
            expect(fields[0].dataoptions).toEqual({ tableName: 'EMP', distinctField: 'name', aliasColumn: 'name' });
            expect(fields[1].dataoptions.distinctField).toBe('city');
            expect(fields[1].searchkey).toBe('city');
        });
    });

    describe('applyFilterOnField', () => {
        it('clears the filter fields when the filtering field has no value', async () => {
            const execute = jest.fn().mockResolvedValue({ data: [{ city: 'A' }, { city: '' }, { city: 'B' }] });
            const dependent: any = { field: 'city', 'filter-on': 'dept', widgettype: 'select', limit: 20 };

            applyFilterOnField({ execute }, { field: 'dept' }, [dependent], undefined, { widget: 'widgettype' });
            await Promise.resolve();
            await Promise.resolve();

            expect(execute).toHaveBeenCalledWith(DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS, {
                fields: 'city', filterFields: {}, pagesize: 20,
            });
            expect(dependent.dataset).toEqual([{ key: 'A', value: 'A' }, { key: 'B', value: 'B' }]);
            expect(dependent.datafield).toBe('key');
        });
    });

    describe('transformData', () => {
        it('nests a string result under the keys of the variable path', () => {
            expect(transformData('hello', 'var.a')).toEqual([{ a: 'hello' }]);
            expect(transformData('hello', 'var.a.b')).toEqual([{ a: { b: 'hello' } }]);
        });
    });
});
