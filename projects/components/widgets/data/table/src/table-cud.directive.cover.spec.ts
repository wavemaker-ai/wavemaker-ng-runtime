import { AbstractDialogService, App, DataSource } from '@wm/core';
import { TableCUDDirective } from './table-cud.directive';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $appDigest: jest.fn(),
    $invokeWatchers: jest.fn(),
    extractCurrentItemExpr: jest.fn(() => 'Variables.v.dataSet[$i].items'),
}));

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    refreshDataSource: jest.fn(() => Promise.resolve()),
}));

import { extractCurrentItemExpr } from '@wm/core';
import { refreshDataSource } from '@wm/components/base';

const Op = DataSource.Operation;

/** builds a data source whose execute() answers capability questions from a flags map */
const makeDataSource = (flags: Partial<Record<keyof typeof Op, boolean>> = {}, extra: any = {}) => ({
    category: 'wm.LiveVariable',
    pagination: undefined as any,
    execute: jest.fn((op: any) => {
        const name = Object.keys(Op).find((k) => (Op as any)[k] === op);
        return name ? (flags as any)[name] : undefined;
    }),
    ...extra,
});

const makeTable = (overrides: any = {}) => ({
    name: 'tbl',
    binddataset: 'Variables.v.dataSet',
    datasource: makeDataSource(),
    gridOptions: {
        isNavTypeScrollOrOndemand: jest.fn(() => false),
        setIsDataUpdatedByUser: jest.fn(),
        beforeRowUpdate: jest.fn(),
    },
    dataNavigator: {
        isDisableNext: false,
        dataSize: 4,
        pageCount: 1,
        dn: { currentPage: 1 },
        calculatePagingValues: jest.fn(),
        navigatePage: jest.fn((index: any, e: any, skip: any, cb: Function) => cb && cb()),
    },
    isNavigationEnabled: jest.fn(() => true),
    getNavigationTargetBySortInfo: jest.fn(() => 'last'),
    getFilterFields: jest.fn(() => ({})),
    invokeEventCallback: jest.fn(),
    toggleMessage: jest.fn(),
    callDataGridMethod: jest.fn(),
    selectItem: jest.fn(),
    initiateSelectItem: jest.fn(),
    datagridElement: { find: jest.fn(() => ({ length: 0 })) },
    widget: { $attrs: { get: jest.fn() } },
    $element: { parents: jest.fn(() => []) },
    selectedItems: [],
    dataset: [],
    __fullData: [],
    sortInfo: null,
    editmode: '',
    errormessage: '',
    insertmessage: 'inserted',
    updatemessage: 'updated',
    deletemessage: 'deleted',
    ...overrides,
});

describe('TableCUDDirective - cover branches', () => {
    let table: any;
    let dialog: any;
    let app: any;
    let directive: any;
    const flushPromises = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    const create = (overrides: any = {}) => {
        table = makeTable(overrides);
        dialog = { showAppConfirmDialog: jest.fn(), closeAppConfirmDialog: jest.fn() };
        app = { appLocale: { MESSAGE_DELETE_RECORD: 'Remove it?' }, notify: jest.fn() };
        directive = new TableCUDDirective(table, dialog as AbstractDialogService, app as App);
        // the directive replaces these on the table, keep spies for the tests that assert on them
        table.initiateSelectItem = jest.fn();
        table.updateVariable = jest.fn();
        return directive;
    };


    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        create();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const apiAware = (execute: (op: any) => any, extra: any = {}) =>
        makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, { execute: jest.fn(execute), ...extra });

    it('does not select the item when navigation is off for non static variables', () => {
        table.isNavigationEnabled.mockReturnValue(false);
        directive.initiateSelectItem('last', { id: 1 }, true, false);
        expect(table.dataNavigator.navigatePage).toHaveBeenCalled();
        expect(table.selectItem).not.toHaveBeenCalled();
        expect(table.callDataGridMethod).not.toHaveBeenCalled();
    });

    describe('insertRecord', () => {
        const options = (extra: any = {}) => ({ row: { id: 1 }, event: undefined, success: jest.fn(), error: jest.fn(), callBack: jest.fn(), ...extra });

        it('stays quiet about response errors when an error handler exists', async () => {
            table.onError = jest.fn();
            table.datasource = apiAware((op) => (op === Op.INSERT_RECORD ? Promise.resolve({ error: 'dup' }) : true));
            const opts = options();
            directive.insertRecord(opts);
            await flushPromises();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $data: 'dup' }));
            expect(table.toggleMessage).not.toHaveBeenCalled();
            expect(opts.error).toHaveBeenCalled();
        });

        it('does not select the new row for api aware variables without crud support', async () => {
            table.datasource = makeDataSource({ IS_API_AWARE: true, SUPPORTS_CRUD: false }, {
                category: 'wm.CrudVariable',
                execute: jest.fn((op: any) => (op === Op.INSERT_RECORD ? Promise.resolve({ id: 5 }) : op === Op.IS_API_AWARE)),
            });
            const opts = options();
            directive.insertRecord(opts);
            await flushPromises();
            expect(table.initiateSelectItem).not.toHaveBeenCalled();
            expect(opts.success).toHaveBeenCalledWith({ id: 5 });
        });

        it('shows the raw error when no error message is configured', async () => {
            table.errormessage = '';
            table.datasource = apiAware((op) => (op === Op.INSERT_RECORD ? Promise.reject('boom') : true));
            directive.insertRecord(options());
            await flushPromises();
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'boom');
        });
    });

    describe('updateRecord', () => {
        const options = (extra: any = {}) => ({ row: { id: 1 }, prevData: { id: 1 }, event: undefined, success: jest.fn(), error: jest.fn(), callBack: jest.fn(), ...extra });

        it('stays quiet about response errors when an error handler exists', async () => {
            table.onError = jest.fn();
            table.datasource = apiAware((op) => (op === Op.UPDATE_RECORD ? Promise.resolve({ error: 'bad' }) : true));
            const opts = options();
            directive.updateRecord(opts);
            await flushPromises();
            expect(table.toggleMessage).not.toHaveBeenCalled();
            expect(opts.error).toHaveBeenCalled();
        });

        it('leaves the success message to the rowupdate handler', async () => {
            table.onRowupdate = jest.fn();
            table.datasource = apiAware((op) => (op === Op.UPDATE_RECORD ? Promise.resolve({ id: 1 }) : true));
            directive.updateRecord(options());
            await flushPromises();
            expect(table.toggleMessage).not.toHaveBeenCalledWith(true, 'success', 'updated');
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowupdate', expect.objectContaining({ $data: { id: 1 } }));
        });

        it('does not select the row for api aware variables without crud support', async () => {
            table.datasource = makeDataSource({ IS_API_AWARE: true }, {
                category: 'wm.CrudVariable',
                execute: jest.fn((op: any) => (op === Op.UPDATE_RECORD ? Promise.resolve({ id: 1 }) : op === Op.IS_API_AWARE)),
            });
            directive.updateRecord(options());
            await flushPromises();
            expect(table.initiateSelectItem).not.toHaveBeenCalled();
        });

        it('shows the raw error on failure without a custom message and stays quiet with a handler', async () => {
            table.errormessage = '';
            table.datasource = apiAware((op) => (op === Op.UPDATE_RECORD ? Promise.reject('down') : true));
            directive.updateRecord(options());
            await flushPromises();
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'down');

            table.toggleMessage.mockClear();
            table.onError = jest.fn();
            directive.updateRecord(options());
            await flushPromises();
            expect(table.toggleMessage).not.toHaveBeenCalled();
        });
    });

    describe('deleteFn', () => {
        const options = (extra: any = {}) => ({ row: { id: 1 }, evt: { type: 'click' }, callBack: jest.fn(), cancelRowDeleteCallback: jest.fn(), ...extra });

        it('handles crud variables that have no pagination information', async () => {
            table.datasource = apiAware((op) => (op === Op.DELETE_RECORD ? Promise.resolve({}) : true), { category: 'wm.CrudVariable', pagination: undefined });
            directive.deleteFn(options());
            await flushPromises();
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.LIST_RECORDS, { skipToggleState: true, operation: 'list', page: undefined });
        });

        it('stays quiet about delete failures when an error handler exists', async () => {
            table.onError = jest.fn();
            table.datasource = apiAware((op) => (op === Op.DELETE_RECORD ? Promise.reject('nope') : true));
            directive.deleteFn(options());
            await flushPromises();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $operation: 'delete', $data: 'nope' }));
            expect(table.toggleMessage).not.toHaveBeenCalled();
        });
    });
});
