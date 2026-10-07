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

describe('TableCUDDirective - additional behaviour', () => {
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

    it('binds its operations onto the table', () => {
        const fresh = makeTable();
        new TableCUDDirective(fresh, dialog, app);
        ['initiateSelectItem', 'updateVariable', 'updateRecord', 'deleteRecord', 'insertRecord', 'editRow', 'addNewRow', 'addRow', 'deleteRow', 'onRecordDelete', 'hideEditRow', 'saveRow', 'cancelRow'].forEach((name) => {
            expect(typeof (fresh as any)[name]).toBe('function');
        });
    });

    describe('initiateSelectItem', () => {
        it('shows a newly inserted row without navigating for scrolling pagination', () => {
            table.gridOptions.isNavTypeScrollOrOndemand.mockReturnValue(true);
            table.isNewRowInserted = true;
            directive.initiateSelectItem('last', {}, false, false);
            expect(table.isNewRowInserted).toBe(false);
            expect(table.dataNavigator.navigatePage).not.toHaveBeenCalled();
        });

        it('stays on the current page when pagination is off and does not grow the size for static variables', () => {
            table.isNavigationEnabled.mockReturnValue(false);
            directive.initiateSelectItem('last', { id: 1 }, true, true);
            expect(table.dataNavigator.dataSize).toBe(4);
            expect(table.dataNavigator.navigatePage).toHaveBeenCalledWith('current', null, true, expect.any(Function));
        });

        it('selects the item after navigating and sets the active row in quick edit mode', () => {
            const callBack = jest.fn();
            table.editmode = 'quickedit';
            directive.initiateSelectItem('last', { id: 1 }, false, false, callBack);
            expect(table.dataNavigator.dataSize).toBe(5);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setActiveRow', { id: 1 });
            jest.advanceTimersByTime(300);
            expect(table.selectItem).toHaveBeenCalledWith({ id: 1 }, table.dataset);
            expect(callBack).toHaveBeenCalled();
        });

        it('does not select or activate rows when selection is skipped', () => {
            table.editmode = 'quickedit';
            directive.initiateSelectItem('current', { id: 1 }, true, false);
            jest.advanceTimersByTime(300);
            expect(table.selectItem).not.toHaveBeenCalled();
            expect(table.callDataGridMethod).not.toHaveBeenCalledWith('setActiveRow', expect.anything());
        });
    });

    describe('updateVariable', () => {
        it('does nothing without a data source', () => {
            table.datasource = undefined;
            expect(() => directive.updateVariable({})).not.toThrow();
        });

        it('refreshes the data source when pagination is not enabled', async () => {
            table.isNavigationEnabled.mockReturnValue(false);
            table.sortInfo = { field: 'name', direction: 'asc' };
            const callBack = jest.fn();
            directive.updateVariable({ id: 1 }, callBack);
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.FETCH_DISTINCT_VALUES);
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 1, orderBy: 'name asc', matchMode: 'anywhereignorecase' }));
            await flushPromises();
            jest.advanceTimersByTime(300);
            expect(callBack).toHaveBeenCalled();
        });

        it('sends an empty order for unsorted tables and skips refresh with pagination', () => {
            table.isNavigationEnabled.mockReturnValue(false);
            directive.updateVariable({});
            expect((refreshDataSource as jest.Mock).mock.calls[0][1].orderBy).toBe('');
            (refreshDataSource as jest.Mock).mockClear();
            table.isNavigationEnabled.mockReturnValue(true);
            directive.updateVariable({});
            expect(refreshDataSource).not.toHaveBeenCalled();
        });
    });

    describe('generatePath', () => {
        it('strips the variable prefix and finds the index of indexed data sets', () => {
            expect(directive.generatePath('Variables.v.dataSet[2].details')).toEqual({ path: 'details', index: 2 });
            expect(directive.generatePath('Variables.v.dataSet')).toEqual({ path: '', index: undefined });
        });

        it('derives the path from the bound expression of list items', () => {
            table.widget.$attrs.get.mockReturnValue('Widgets.list.currentItem.items');
            table.$element.parents.mockReturnValue([$('<div listitemindex="3"></div>')[0], $('<div listitemindex="1"></div>')[0]]);
            const result = directive.generatePath('item.details');
            expect(extractCurrentItemExpr).toHaveBeenCalledWith('Widgets.list.currentItem.items', table);
            expect(result.index).toBe(1);
            expect(result.path).toBe('items');
        });

        it('keeps non widget expressions as they are', () => {
            table.widget.$attrs.get.mockReturnValue('Variables.v.dataSet[$i].items');
            table.$element.parents.mockReturnValue([]);
            const result = directive.generatePath('item.details');
            expect(extractCurrentItemExpr).not.toHaveBeenCalled();
            expect(result.index).toBeUndefined();
        });
    });

    describe('insertRecord', () => {
        const options = (extra: any = {}) => ({ row: { id: 1 }, event: undefined, success: jest.fn(), error: jest.fn(), callBack: jest.fn(), ...extra });

        it('does nothing without a data source', () => {
            table.datasource = undefined;
            expect(() => directive.insertRecord(options())).not.toThrow();
        });

        it('adds the item to variables that are not api aware', () => {
            table.datasource = makeDataSource({});
            const opts = options();
            directive.insertRecord(opts);
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.ADD_ITEM, { item: opts.row, path: '', parentIndex: undefined });
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'success', 'inserted');
            expect(table.initiateSelectItem).toHaveBeenCalled();
            expect(opts.success).toHaveBeenCalledWith(opts.row);
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowinsert', expect.objectContaining({ row: opts.row }));
        });

        it('inserts through the data source and reloads crud variables', async () => {
            const insert = jest.fn().mockResolvedValue({ id: 9 });
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                category: 'wm.CrudVariable',
                pagination: { number: 1 },
                execute: jest.fn((op: any) => {
                    if (op === Op.INSERT_RECORD) { return insert(); }
                    return op === Op.SUPPORTS_CRUD || op === Op.IS_API_AWARE;
                }),
            });
            const opts = options({ event: { target: $('<tr><td></td></tr>').find('td')[0] } });
            table.gridOptions.isNavTypeScrollOrOndemand.mockReturnValue(true);
            directive.insertRecord(opts);
            await flushPromises();
            expect(table.isNewRowInserted).toBe(true);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('hideRowEditMode', expect.anything());
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.LIST_RECORDS, { skipToggleState: true, operation: 'list', page: 2 });
            expect(table.initiateSelectItem).toHaveBeenCalledWith('last', { id: 9 }, undefined, false, opts.callBack);
            expect(table.updateVariable).not.toBeUndefined();
        });

        it('reports server errors returned in the response', async () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.INSERT_RECORD ? Promise.resolve({ error: 'dup' }) : true)),
            });
            const opts = options();
            directive.insertRecord(opts);
            await flushPromises();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $operation: 'new', $data: 'dup' }));
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'dup');
            expect(opts.error).toHaveBeenCalled();
        });

        it('reports request failures', async () => {
            table.errormessage = 'custom failure';
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.INSERT_RECORD ? Promise.reject('boom') : true)),
            });
            const opts = options();
            directive.insertRecord(opts);
            await flushPromises();
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'custom failure');
            expect(opts.error).toHaveBeenCalledWith('boom');
            expect(opts.callBack).toHaveBeenCalledWith(undefined, true);
        });

        it('stays quiet when an error handler exists', async () => {
            table.onError = jest.fn();
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.INSERT_RECORD ? Promise.reject('boom') : true)),
            });
            directive.insertRecord(options());
            await flushPromises();
            expect(table.toggleMessage).not.toHaveBeenCalled();
        });

        it('only raises the rowinsert event for api aware sources without crud support', () => {
            table.datasource = makeDataSource({ IS_API_AWARE: true });
            const opts = options();
            directive.insertRecord(opts);
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowinsert', { $event: undefined, row: opts.row });
        });
    });

    describe('updateRecord', () => {
        const options = (extra: any = {}) => ({ row: { id: 1, $$wmSourceListIndex: 3 }, prevData: { id: 1 }, event: undefined, success: jest.fn(), error: jest.fn(), callBack: jest.fn(), ...extra });

        it('does nothing without a data source', () => {
            table.datasource = undefined;
            expect(() => directive.updateRecord(options())).not.toThrow();
        });

        it('replaces the item of variables that are not api aware', () => {
            table.datasource = makeDataSource({}, { category: 'wm.Variable' });
            const opts = options();
            directive.updateRecord(opts);
            expect(opts.row).not.toHaveProperty('$$wmSourceListIndex');
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.SET_ITEM, expect.objectContaining({ prevItem: opts.prevData, item: opts.row }));
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'success', 'updated');
            expect(opts.success).toHaveBeenCalled();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowupdate', expect.objectContaining({ row: opts.row }));
        });

        it('updates through the data source and reloads crud variables', async () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                category: 'wm.CrudVariable',
                pagination: { number: 0 },
                execute: jest.fn((op: any) => (op === Op.UPDATE_RECORD ? Promise.resolve({ id: 1 }) : op === Op.SUPPORTS_CRUD || op === Op.IS_API_AWARE)),
            });
            const opts = options({ event: { target: $('<tr><td></td></tr>').find('td')[0] } });
            directive.updateRecord(opts);
            await flushPromises();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('hideRowEditMode', expect.anything());
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.LIST_RECORDS, { skipToggleState: true, operation: 'list', page: 1 });
            expect(table.initiateSelectItem).toHaveBeenCalledWith('current', { id: 1 }, undefined, false, opts.callBack);
        });

        it('reports errors in the response and request failures', async () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.UPDATE_RECORD ? Promise.resolve({ error: 'bad' }) : true)),
            });
            const opts = options();
            directive.updateRecord(opts);
            await flushPromises();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $operation: 'edit', $data: 'bad' }));
            expect(opts.error).toHaveBeenCalled();

            table.toggleMessage.mockClear();
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.UPDATE_RECORD ? Promise.reject('down') : true)),
            });
            const opts2 = options();
            directive.updateRecord(opts2);
            await flushPromises();
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'down');
            expect(opts2.callBack).toHaveBeenCalledWith(undefined, true);
        });

        it('only raises rowupdate for api aware sources without crud support', () => {
            table.datasource = makeDataSource({ IS_API_AWARE: true });
            const opts = options();
            directive.updateRecord(opts);
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowupdate', { $event: undefined, row: opts.row });
        });

        it('selects the updated item for plain variables', () => {
            table.datasource = makeDataSource({}, { category: 'wm.Variable' });
            directive.updateRecord(options());
            expect(table.initiateSelectItem).toHaveBeenCalledWith('current', expect.anything(), undefined, true, expect.any(Function));
        });
    });

    describe('delete', () => {
        const options = (extra: any = {}) => ({ row: { id: 1 }, evt: { type: 'click' }, callBack: jest.fn(), cancelRowDeleteCallback: jest.fn(), ...extra });

        it('deletes without confirmation when none is configured', () => {
            table.datasource = makeDataSource({});
            const opts = options();
            directive.deleteRecord(opts);
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.REMOVE_ITEM, expect.objectContaining({ item: opts.row }));
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'success', 'deleted');
            expect(opts.cancelRowDeleteCallback).toHaveBeenCalled();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowdelete', expect.anything());
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowdeleted', expect.anything());
        });

        it('removes the row by index for wm variables', () => {
            table.datasource = makeDataSource({}, { category: 'wm.Variable' });
            directive.deleteRecord(options({ rowindex: 4 }));
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.REMOVE_ITEM, expect.objectContaining({ item: 4 }));
            const row: any = { id: 1, $$wmSourceListIndex: 2 };
            directive.deleteRecord(options({ row }));
            expect(row).not.toHaveProperty('$$wmSourceListIndex');
        });

        it('asks for confirmation and deletes on ok', () => {
            table.confirmdelete = 'Sure?';
            table.deleteoktext = 'Yes';
            table.deletecanceltext = 'No';
            table.datasource = makeDataSource({});
            const opts = options();
            directive.deleteRecord(opts);
            const config = dialog.showAppConfirmDialog.mock.calls[0][0];
            expect(config).toMatchObject({ title: 'Remove it?', message: 'Sure?', oktext: 'Yes', canceltext: 'No' });
            expect(table.datasource.execute).not.toHaveBeenCalled();
            config.onOk();
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.REMOVE_ITEM, expect.anything());
            expect(dialog.closeAppConfirmDialog).toHaveBeenCalled();
        });

        it('cancels, escapes and focuses the cancel button', () => {
            table.confirmdelete = 'Sure?';
            const opts = options();
            directive.deleteRecord(opts);
            const config = dialog.showAppConfirmDialog.mock.calls[0][0];
            config.onCancel();
            expect(opts.cancelRowDeleteCallback).toHaveBeenCalledTimes(1);
            expect(dialog.closeAppConfirmDialog).toHaveBeenCalled();
            config.onEscape();
            expect(opts.cancelRowDeleteCallback).toHaveBeenCalledTimes(2);
            expect(() => config.onOpen()).not.toThrow();
        });

        it('falls back to the default dialog title', () => {
            app.appLocale = {};
            table.confirmdelete = 'Sure?';
            directive.deleteRecord(options());
            expect(dialog.showAppConfirmDialog.mock.calls[0][0].title).toBe('Delete Record');
        });

        it('does nothing without a data source', () => {
            table.datasource = undefined;
            expect(() => directive.deleteFn(options())).not.toThrow();
        });

        it('marks the row as deleted for on demand and infinite scroll tables', () => {
            table.datasource = makeDataSource({});
            table.onDemandLoad = true;
            directive.deleteFn(options());
            expect(table.isRowDeleted).toBe(true);
        });

        it('deletes through the data source, updating the pagination for crud variables', async () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                category: 'wm.CrudVariable',
                pagination: { last: true, numberOfElements: 1, number: 2 },
                execute: jest.fn((op: any) => (op === Op.DELETE_RECORD ? Promise.resolve({}) : op === Op.SUPPORTS_CRUD || op === Op.IS_API_AWARE)),
            });
            const opts = options();
            directive.deleteFn(opts);
            await flushPromises();
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.DELETE_RECORD, expect.objectContaining({ row: opts.row }));
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.LIST_RECORDS, { skipToggleState: true, operation: 'list', page: 2 });
            expect(table.dataNavigator.dataSize).toBe(3);
        });

        it('uses the next page number when the last page still has several records', async () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                category: 'wm.CrudVariable',
                pagination: { last: false, numberOfElements: 5, number: 2 },
                execute: jest.fn((op: any) => (op === Op.DELETE_RECORD ? Promise.resolve({}) : op === Op.SUPPORTS_CRUD || op === Op.IS_API_AWARE)),
            });
            directive.deleteFn(options());
            await flushPromises();
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.LIST_RECORDS, expect.objectContaining({ page: 3 }));
        });

        it('shows the server error without removing the row', () => {
            directive.deleteSuccessHandler({ id: 1 }, { error: 'locked' }, undefined, jest.fn());
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'locked');
            expect(table.dataNavigator.dataSize).toBe(4);
            table.toggleMessage.mockClear();
            table.onError = jest.fn();
            directive.deleteSuccessHandler({ id: 1 }, { error: 'locked' });
            expect(table.toggleMessage).not.toHaveBeenCalled();
        });

        it('updates the variable after a successful delete when crud is supported', () => {
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true });
            table.onRowdelete = jest.fn();
            const spy = jest.spyOn(directive, 'updateVariable').mockImplementation(() => undefined);
            directive.deleteSuccessHandler({ id: 1 }, undefined, undefined, jest.fn());
            expect(spy).toHaveBeenCalledWith({ id: 1 }, expect.any(Function));
            expect(table.toggleMessage).not.toHaveBeenCalled();
        });

        it('reports delete failures and resets the deleted flag', async () => {
            table.isRowDeleted = true;
            table.datasource = makeDataSource({ SUPPORTS_CRUD: true, IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.DELETE_RECORD ? Promise.reject('nope') : true)),
            });
            const opts = options();
            directive.deleteFn(opts);
            await flushPromises();
            expect(table.isRowDeleted).toBe(false);
            expect(opts.callBack).toHaveBeenCalledWith(undefined, true);
            expect(table.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $operation: 'delete', $data: 'nope' }));
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'nope');
        });

        it('only raises rowdelete for api aware sources without crud support', () => {
            table.datasource = makeDataSource({ IS_API_AWARE: true });
            const opts = options();
            directive.deleteFn(opts);
            expect(table.invokeEventCallback).toHaveBeenCalledWith('rowdelete', { $event: opts.evt, row: opts.row });
            expect(opts.cancelRowDeleteCallback).toHaveBeenCalled();
        });

        it('treats dependent tables like crud sources', () => {
            table._isDependent = true;
            table.datasource = makeDataSource({ IS_API_AWARE: true }, {
                execute: jest.fn((op: any) => (op === Op.DELETE_RECORD ? Promise.resolve({}) : op === Op.IS_API_AWARE)),
            });
            directive.deleteFn(options());
            expect(table.datasource.execute).toHaveBeenCalledWith(Op.DELETE_RECORD, expect.anything());
        });
    });

    describe('onRecordDelete', () => {
        it('moves to the previous page when the current page became empty', () => {
            table.dataNavigator.pageCount = 1;
            table.dataNavigator.dn.currentPage = 2;
            const callBack = jest.fn();
            directive.onRecordDelete(callBack);
            expect(table.dataNavigator.navigatePage).toHaveBeenCalledWith('prev', null, true, expect.any(Function));
            jest.runAllTimers();
            expect(callBack).toHaveBeenCalled();
        });

        it('refreshes the current page otherwise and survives a missing navigator', () => {
            directive.onRecordDelete();
            expect(table.dataNavigator.navigatePage).toHaveBeenCalledWith(undefined, null, true, expect.any(Function));
            table.dataNavigator = undefined;
            expect(() => directive.onRecordDelete()).not.toThrow();
        });
    });

    describe('row operations', () => {
        it('toggles the edit mode of the clicked row', () => {
            const evt = { target: document.createElement('td') };
            directive.editRow(evt);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('toggleEditRow', evt, { selectRow: true, action: 'edit' });
            expect(table._triggeredByUser).toBe(true);
            expect(table.gridOptions.setIsDataUpdatedByUser).toHaveBeenCalledWith(false);
        });

        it('lets dependent tables update through the page', () => {
            table._isDependent = true;
            table.selecteditem = { id: 1 };
            directive.editRow();
            expect(app.notify).toHaveBeenCalledWith('wm-event', expect.objectContaining({ eventName: 'update', widgetName: 'tbl', row: { id: 1 } }));
        });

        it('hands the selected row to the form for form and dialog modes', () => {
            table.editmode = 'form';
            table.selectedItems = [{ id: 5 }];
            directive.editRow();
            expect(table.gridOptions.beforeRowUpdate).toHaveBeenCalledWith({ id: 5 });
            directive.editRow({ id: 6 });
            expect(table.gridOptions.beforeRowUpdate).toHaveBeenCalledWith({ id: 6 });
        });

        it('edits the active row once the selection has updated', () => {
            const row = { length: 1 };
            table.datagridElement.find.mockReturnValue(row);
            directive.editRow();
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('toggleEditRow', undefined, { $row: row, action: 'edit' });
            table.callDataGridMethod.mockClear();
            table.datagridElement.find.mockReturnValue({ length: 0 });
            directive.editRow();
            jest.runAllTimers();
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
        });

        it('adds a new row unless the grid is already being edited', () => {
            directive.addNewRow();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('addNewRow');
            expect(table._triggeredByUser).toBe(true);
            table.callDataGridMethod.mockClear();
            table.isGridEditMode = true;
            directive.addNewRow();
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
        });

        it('informs the live table parent or the page about new rows', () => {
            table._liveTableParent = { addNewRow: jest.fn() };
            directive.addNewRow();
            expect(table._liveTableParent.addNewRow).toHaveBeenCalled();
            table._liveTableParent = null;
            table._isDependent = true;
            directive.addNewRow();
            expect(app.notify).toHaveBeenCalledWith('wm-event', expect.objectContaining({ eventName: 'insert' }));
        });

        it('deletes the clicked row through the grid or the selected item', () => {
            const evt = { target: document.createElement('td') };
            directive.deleteRow(evt);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('deleteRowAndUpdateSelectAll', evt);
            const spy = jest.spyOn(directive, 'deleteRecord').mockImplementation(() => undefined);
            table.selectedItems = [{ id: 3 }];
            directive.deleteRow();
            jest.runAllTimers();
            expect(spy).toHaveBeenCalledWith({ row: { id: 3 } });
            directive.deleteRow({ id: 4 });
            jest.runAllTimers();
            expect(spy).toHaveBeenCalledWith({ row: { id: 4 } });
        });

        it('hides, saves and cancels editing rows', () => {
            const row = { length: 1 };
            table.datagridElement.find.mockReturnValue(row);
            directive.hideEditRow();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('hideRowEditMode', row);
            directive.cancelRow();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('cancelEdit', row);
            directive.saveRow();
            expect(table.callDataGridMethod).toHaveBeenCalledWith('saveRow');
            table.callDataGridMethod.mockClear();
            table.datagridElement.find.mockReturnValue({ length: 0 });
            directive.hideEditRow();
            directive.cancelRow();
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
        });

        it('releases its references on destroy', () => {
            directive.ngOnDestroy();
            expect(directive.table).toBeNull();
            expect(directive.dialogService).toBeNull();
            expect(directive.app).toBeNull();
        });
    });
});
