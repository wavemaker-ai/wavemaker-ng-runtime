import { EMPTY } from 'rxjs';
import { DataSource, FormWidgetType } from '@wm/core';
import {
    applyFilterOnField,
    fetchDistinctValues,
    fetchRelatedFieldData,
    getDistinctFieldProperties,
    getDistinctValues,
    getDistinctValuesForField,
    performDataOperation,
} from './data-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    debounce: (fn: any) => fn,
    processFilterExpBindNode: jest.fn(() => EMPTY),
}));

describe('data-utils - cover', () => {
    afterEach(() => jest.restoreAllMocks());

    describe('performDataOperation on api aware crud variables', () => {
        const run = (operationType: string) => {
            const execute = jest.fn((op: any) => {
                if (op === DataSource.Operation.SUPPORTS_CRUD) { return false; }
                if (op === DataSource.Operation.IS_API_AWARE) { return true; }
                return Promise.resolve('ok');
            });
            return performDataOperation({ execute, category: 'wm.CrudVariable' }, { a: 1 }, { operationType }).then(() => execute);
        };

        it('maps the operation type to the crud operation name', async () => {
            let execute: any = await run('update');
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.INVOKE, { skipNotification: true, operation: 'update', inputFields: { a: 1 } });
            execute = await run('delete');
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.INVOKE, expect.objectContaining({ operation: 'delete' }));
            execute = await run('insert');
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.INVOKE, expect.objectContaining({ operation: 'create' }));
        });
    });

    describe('fetchRelatedFieldData for non search widgets', () => {
        it('fetches the related table data with the order and filter of the field', () => {
            const execute = jest.fn((op: any) => {
                if (op === DataSource.Operation.GET_RELATED_PRIMARY_KEYS) { return ['id']; }
                return Promise.resolve({ data: [{ id: 1 }] });
            });
            const field: any = {
                widgettype: 'select', orderby: 'name:desc', filterexpressions: { r: 1 }, limit: 5,
                viewParent: {}, showPendingSpinner: true, displayfield: undefined,
            };
            fetchRelatedFieldData({ execute }, field, { relatedField: 'dept', datafield: 'All Fields', widget: 'widgettype' });
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.GET_RELATED_TABLE_DATA, {
                relatedField: 'dept', pagesize: 5, orderBy: 'name desc', filterFields: {}, filterExpr: field.filterexpressions,
            });
            return Promise.resolve().then(() => Promise.resolve()).then(() => {
                expect(field.dataset).toEqual([{ id: 1 }]);
                expect(field.displayfield).toBe('id');
                expect(field.showPendingSpinner).toBe(false);
            });
        });

        it('defaults the order, filter and display field when nothing is configured', async () => {
            const execute = jest.fn((op: any) => {
                if (op === DataSource.Operation.GET_RELATED_PRIMARY_KEYS) { return []; }
                return Promise.resolve({ data: [] });
            });
            const field: any = { widgettype: 'select', viewParent: {} };
            fetchRelatedFieldData({ execute }, field, { relatedField: 'dept', datafield: 'All Fields', widget: 'widgettype' });
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.GET_RELATED_TABLE_DATA, expect.objectContaining({ orderBy: '', filterExpr: {} }));
            await Promise.resolve();
            await Promise.resolve();
            expect(field.dataset).toEqual([]);
            expect(field.displayfield).toBeUndefined();
        });

        it('does nothing without a data source', () => {
            expect(fetchRelatedFieldData(undefined, {}, { widget: 'w' })).toBeUndefined();
        });
    });

    describe('getDistinctFieldProperties', () => {
        it('parses string filter expressions of related fields', () => {
            const props = getDistinctFieldProperties({ execute: jest.fn() }, {
                'is-related': true, 'lookup-type': 'Dept', 'lookup-field': 'a.b', filterexpressions: '{"x":1}',
            });
            expect(props).toEqual({ tableName: 'Dept', distinctField: 'a.b', aliasColumn: 'a$b', filterExpr: { x: 1 } });
        });

        it('keeps object filter expressions and defaults to an empty one', () => {
            const obj = { x: 1 };
            expect(getDistinctFieldProperties({ execute: jest.fn() }, { 'is-related': true, 'lookup-field': 'a', filterexpressions: obj }).filterExpr).toBe(obj);
            expect(getDistinctFieldProperties({ execute: jest.fn() }, { 'is-related': true, 'lookup-field': 'a' }).filterExpr).toEqual({});
        });

        it('falls back to the key of the field', () => {
            const props = getDistinctFieldProperties({ execute: jest.fn(() => 'T') }, { key: 'k' });
            expect(props).toEqual({ tableName: 'T', distinctField: 'k', aliasColumn: 'k' });
        });
    });

    describe('getDistinctValues', () => {
        it('loads distinct values of bound filter widgets only for the filterwidget property', async () => {
            const execute = jest.fn((op: any) => (op === DataSource.Operation.GET_ENTITY_NAME ? 'E' : Promise.resolve({ data: [1] })));
            const field: any = { filterwidget: 'select', isDataSetBound: true, field: 'f' };
            const res: any = await getDistinctValues({ execute }, field, 'filterwidget');
            expect(res).toEqual({ field, data: [1], aliasColumn: 'f' });
            let settled = false;
            getDistinctValues({ execute }, { ...field, widgettype: 'select' }, 'widgettype').then(() => (settled = true));
            await Promise.resolve();
            expect(settled).toBe(false);
        });
    });

    describe('getDistinctValuesForField', () => {
        it('falls back to the default label keys when the column is unknown', () => {
            const execute = jest.fn(() => 'T');
            const field: any = { widgettype: FormWidgetType.AUTOCOMPLETE };
            getDistinctValuesForField({ execute }, field, { widget: 'widgettype' });
            expect(field.datafield).toBe('key');
            expect(field.searchkey).toBe('key');
            expect(field.displaylabel).toBe('value');
            expect(field.displayfield).toBe('value');
        });
    });

    describe('applyFilterOnField', () => {
        it('uses the key of the filtering field and the default options', async () => {
            const execute = jest.fn().mockResolvedValue({ data: [{ c: 'A' }] });
            const dependent: any = { key: 'c', 'filter-on': 'dept', widgettype: 'select' };
            applyFilterOnField({ execute }, { key: 'dept' }, [dependent], 'x');
            await Promise.resolve();
            await Promise.resolve();
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS, expect.objectContaining({
                fields: 'c',
                filterFields: { dept: { value: 'x', matchMode: expect.anything() } },
            }));
            expect(dependent.dataset).toEqual([{ key: 'A', value: 'A' }]);
        });

        it('skips the first load when there is no value', () => {
            const execute = jest.fn();
            const dependent: any = { field: 'c', 'filter-on': 'dept', widgettype: 'select' };
            applyFilterOnField({ execute }, { field: 'dept' }, [dependent], '', { isFirst: true });
            applyFilterOnField({ execute }, { field: 'dept' }, [dependent], undefined, { isFirst: true });
            expect(execute).not.toHaveBeenCalled();
            applyFilterOnField({ execute: execute.mockResolvedValue({ data: [] }) }, { field: 'dept' }, [dependent], 'v', { isFirst: true });
            expect(execute).toHaveBeenCalledTimes(1);
        });

        it('uses the lookup field of object values', () => {
            const execute = jest.fn().mockResolvedValue({ data: [] });
            const dependent: any = { field: 'c', 'filter-on': 'dept', widgettype: 'select' };
            applyFilterOnField({ execute }, { field: 'dept', 'lookup-field': 'id' }, [dependent], { id: 7, name: 'n' }, { widget: 'widgettype' });
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS, expect.objectContaining({
                filterFields: { dept: { value: 7, matchMode: expect.anything() } },
            }));
        });
    });

    it('fetchDistinctValues keeps working for fields keyed by key', () => {
        const execute = jest.fn(() => 'T');
        const fields: any[] = [{ key: 'k', widgettype: FormWidgetType.CHIPS }];
        fetchDistinctValues({ execute }, fields, { widget: 'widgettype' });
        expect(fields[0].dataoptions.distinctField).toBe('k');
    });
});
