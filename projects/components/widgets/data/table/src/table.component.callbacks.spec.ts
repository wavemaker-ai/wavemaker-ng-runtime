import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IMaskModule } from 'angular-imask';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AbstractDialogService, AbstractI18nService, App, AppDefaults, DynamicComponentRefProvider, Viewport } from '@wm/core';
import { WidgetRef } from '@wm/components/base';
import { PaginationComponent } from '@wm/components/data/pagination';
import { ButtonComponent } from '@wm/components/input/button';
import { InputTextComponent } from '@wm/components/input/text';
import { NumberComponent } from '@wm/components/input/number';
import { ListComponent } from '@wm/components/data/list';
import { MenuComponent } from '@wm/components/navigation/menu';
import { FormWidgetDirective } from '@wm/components/data/form';
import { TrustAsPipe } from '../../../../base/src/pipes/trust-as.pipe';
import { ToDatePipe, TrailingZeroDecimalPipe } from '../../../../base/src/pipes/custom-pipes';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { compileTestComponent, mockApp, mockViewport } from 'projects/components/base/src/test/util/component-test-util';
import { TableComponent } from './table.component';
import { TableCUDDirective } from './table-cud.directive';
import { TableFilterSortDirective } from './table-filter.directive';
import { TableActionDirective } from './table-action/table-action.directive';
import { TableColumnDirective } from './table-column/table-column.directive';
import { TableColumnGroupDirective } from './table-column-group/table-column-group.directive';
import { TableRowDirective } from './table-row/table-row.directive';
import { TableRowActionDirective } from './table-row-action/table-row-action.directive';
import { DateComponent } from '../../../input/epoch/date/src/date.component';
import { TimeComponent } from '../../../input/epoch/time/src/time.component';
import * as core from '@wm/core';
import './datatable.js';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    extendProto: jest.fn(),
    $watch: jest.fn(() => jest.fn()),
    $unwatch: jest.fn(),
    $appDigest: jest.fn(),
    muteWatchers: jest.fn(),
    unMuteWatchers: jest.fn(),
}));

const markup = `<div wmTable wmTableFilterSort wmTableCUD #table_1 data-identifier="table" tabindex="0"
        name="CallbackTable" title="Users" navigation="Basic" isdynamictable="false" filtermode="search">
        <div wmTableColumn index="0" headerIndex="0" binding="firstname" caption="Firstname" type="string" show="true" readonly="true" searchable="true"></div>
        <div wmTableColumn index="1" headerIndex="1" binding="age" caption="Age" type="number" show="true" readonly="true" searchable="false"></div>
    </div>`;

const data = [
    { firstname: 'admin', age: 42 },
    { firstname: 'user', age: 28 },
    { firstname: 'other', age: 23 },
];

@Component({ standalone: false, template: markup })
class CallbackTableWrapperComponent {
    @ViewChild(TableComponent, { static: true }) wmComponent: TableComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [
        TrustAsPipe, TableComponent, TableCUDDirective, TableFilterSortDirective, TableActionDirective, TableColumnDirective,
        TableColumnGroupDirective, TableRowDirective, PaginationComponent, TableRowActionDirective, DateComponent, TimeComponent,
        BrowserAnimationsModule, ButtonComponent, CommonModule, FormsModule, ReactiveFormsModule, InputTextComponent, NumberComponent,
        ListComponent, FormWidgetDirective, MenuComponent, IMaskModule, BsDatepickerModule, TimepickerModule, BsDropdownModule, ToDatePipe,
    ],
    declarations: [CallbackTableWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Viewport, useValue: mockViewport },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: DynamicComponentRefProvider, useValue: mockApp },
        { provide: DatePipe, useClass: DatePipe },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: WidgetRef, useValue: { widget: { name: 'CallbackTable', beforedatarender: jest.fn() } } },
        { provide: TrustAsPipe, useClass: TrustAsPipe },
        AbstractDialogService,
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe },
        { provide: ToDatePipe, useClass: ToDatePipe },
    ],
    teardown: { destroyAfterEach: false },
};

describe('TableComponent - grid callbacks', () => {
    let fixture: ComponentFixture<CallbackTableWrapperComponent>;
    let table: any;
    let invoke: jest.SpyInstance;
    let callGrid: jest.SpyInstance;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CallbackTableWrapperComponent);
        table = fixture.componentInstance.wmComponent;
        table.populateGridData(data);
        fixture.detectChanges();
        invoke = jest.spyOn(table, 'invokeEventCallback').mockImplementation(() => undefined);
        callGrid = jest.spyOn(table, 'callDataGridMethod').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.restoreAllMocks();
        (core.$watch as jest.Mock).mockClear();
        (core.$unwatch as jest.Mock).mockClear();
    });

    describe('pagination helpers', () => {
        it('reads and writes the current page through the navigator', () => {
            table.dataNavigator = { dn: { currentPage: 3 } };
            expect(table.gridOptions.getCurrentPage()).toBe(3);
            table.gridOptions.setCurrentPage(5);
            expect(table.dataNavigator.dn.currentPage).toBe(5);
            table.gridOptions.setCurrentPage(undefined);
            expect(table.dataNavigator.dn.currentPage).toBe(1);
        });

        it('defaults the current page to 1 without a navigator', () => {
            table.dataNavigator = undefined;
            expect(table.gridOptions.getCurrentPage()).toBe(1);
        });

        it('exposes data source, page size and page count', () => {
            table.dataNavigator = { pageCount: 7 };
            table.updatedPageSize = 15;
            expect(table.gridOptions.getDataSource()).toBe(table.datasource);
            expect(table.gridOptions.getPageSize()).toBe(table.pagesize);
            expect(table.gridOptions.getUpdatedPageSize()).toBe(15);
            expect(table.gridOptions.getPageCount()).toBe(7);
        });

        it('enables navigation again by resetting the disabled flags', () => {
            table.dataNavigator = { widget: { isDisableNext: true, isDisableLast: true } };
            table.gridOptions.enableNavigation();
            expect(table.dataNavigator.widget.isDisableNext).toBe(false);
            expect(table.dataNavigator.widget.isDisableLast).toBe(false);
            expect(table.gridOptions.mode).toBe('viewless');
        });

        it('recognises scroll and on-demand navigation', () => {
            table.gridOptions.navigation = 'Scroll';
            expect(table.gridOptions.isNavTypeScrollOrOndemand()).toBe(true);
            table.gridOptions.navigation = 'On-Demand';
            expect(table.gridOptions.isNavTypeScrollOrOndemand()).toBe(true);
            table.gridOptions.navigation = 'Basic';
            expect(table.gridOptions.isNavTypeScrollOrOndemand()).toBe(false);
        });
    });

    describe('grid option setters', () => {
        it.each([
            ['setDeletedRowIndex', 'deletedRowIndex', 4],
            ['setIsSearchTrigerred', 'isSearchTrigerred', true],
            ['setIsDatasetUpdated', 'isDatasetUpdated', true],
            ['setIsNextPageData', 'isNextPageData', true],
            ['setIsDataUpdatedByUser', 'isDataUpdatedByUser', true],
        ])('%s writes %s to the data grid', (fn, option, value) => {
            const setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            table.gridOptions[fn](value);
            expect(setOption).toHaveBeenCalledWith(option, value);
        });

        it('remembers the last performed action and falls back to the previous one', () => {
            const setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            table.gridOptions.lastActionPerformed = 'edit';
            table.gridOptions.setLastActionPerformed('delete');
            table.gridOptions.setLastActionPerformed(undefined);
            expect(setOption).toHaveBeenNthCalledWith(1, 'lastActionPerformed', 'delete');
            expect(setOption).toHaveBeenNthCalledWith(2, 'lastActionPerformed', 'edit');
        });
    });

    describe('onDataRender', () => {
        it('raises the datarender event, reselects rows and reports the selection', () => {
            callGrid.mockImplementation((name: string) => (name === 'getSelectedRows' ? [data[0]] : undefined));
            table.gridData = data;
            table.multiselect = false;
            table.infScroll = false;
            table.onDemandLoad = false;
            table.items = [data[1]];
            const next = jest.spyOn(table.selectedItemChange, 'next');

            table.gridOptions.onDataRender();

            expect(invoke).toHaveBeenCalledWith('datarender', { $data: data, data });
            expect(table.items).toEqual([]);
            expect(callGrid).toHaveBeenCalledWith('selectRows', table.items);
            expect(next).toHaveBeenCalledWith([data[0]]);
        });

        it('keeps the items of a multi select table and skips the reselect for scrolling tables', () => {
            callGrid.mockReturnValue([]);
            table.multiselect = true;
            table.infScroll = true;
            table.items = [data[1]];
            table.gridOptions.onDataRender();
            expect(table.items).toEqual([data[1]]);
            expect(callGrid).not.toHaveBeenCalledWith('selectRows', expect.anything());
        });

        it('re-applies the page search filter after rendering', () => {
            callGrid.mockReturnValue([]);
            const handler = jest.spyOn(table, 'searchSortHandler').mockImplementation(() => undefined);
            table._isPageSearch = true;
            table.filterInfo = [{ field: 'firstname' }];
            table.gridOptions.onDataRender();
            expect(handler).toHaveBeenCalledWith(table.filterInfo, undefined, 'search');
        });
    });

    describe('row selection', () => {
        const setupState = () => {
            const state: any = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
            table.statePersistence = {
                getWidgetState: state.get,
                setWidgetState: state.set,
                removeWidgetState: state.remove,
            };
            return state;
        };

        beforeEach(() => {
            jest.spyOn(table, 'addRowIndex').mockImplementation((row: any) => ({ ...row, $index: 2 }));
            table.dataNavigator = { dn: { currentPage: 3 } };
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.navigation = 'Basic';
        });

        it('collects the parent row details of nested tables', () => {
            const outer = document.createElement('div');
            outer.className = 'app-grid app-panel panel';
            outer.setAttribute('currentpage', '4');
            outer.innerHTML = '<table><tbody><tr class="app-datagrid-row" data-row-id="7"></tr><tr><td><span id="inner"></span></td></tr></tbody></table>';
            table.nativeElement = outer.querySelector('#inner');
            expect(table.gridOptions.getParentTableData()).toEqual({ parentId: '7', parentPage: '4' });
        });

        it('defaults the parent page to 1 for tables that are not nested', () => {
            table.nativeElement = document.createElement('div');
            expect(table.gridOptions.getParentTableData()).toEqual({ parentId: undefined, parentPage: 1 });
        });

        it('stores the selected row in the widget state and raises rowselect', () => {
            const state = setupState();
            callGrid.mockReturnValue([data[0]]);
            table.multiselect = false;
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: undefined, parentPage: 1 });

            table.gridOptions.onRowSelect(data[0], { type: 'click' });

            expect(state.set).toHaveBeenCalledWith(table, { selectedItem: [{ page: 3, index: 1 }] });
            expect(invoke).toHaveBeenCalledWith('rowselect', expect.objectContaining({ row: expect.objectContaining({ $index: 2 }) }));
        });

        it('adds the parent row details for rows of nested tables', () => {
            const state = setupState();
            callGrid.mockReturnValue([data[0]]);
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: '9', parentPage: '2' });
            table.gridOptions.onRowSelect(data[0], {});
            expect(state.set).toHaveBeenCalledWith(table, { selectedItem: [{ page: 3, index: 1, parentRowIndex: '9', parentCurrentPage: '2' }] });
        });

        it('appends to the stored selection of a multi select table without duplicating it', () => {
            const state = setupState();
            state.get.mockReturnValue({ selectedItem: [{ page: 1, index: 0 }] });
            callGrid.mockReturnValue([data[0]]);
            table.multiselect = true;
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: undefined });

            table.gridOptions.onRowSelect(data[0], {});
            table.gridOptions.onRowSelect(data[0], {});

            const stored = state.set.mock.calls[state.set.mock.calls.length - 1][1].selectedItem;
            expect(stored).toEqual([{ page: 1, index: 0 }, { page: 3, index: 1 }]);
        });

        it('warns when the pagination type does not support state persistence', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            setupState();
            callGrid.mockReturnValue([data[0]]);
            table.navigation = 'Scroll';
            table.gridOptions.onRowSelect(data[0], {});
            expect(warn).toHaveBeenCalled();
        });

        it('only deselects rows in multi select tables and removes them from the state', () => {
            const state = setupState();
            table.multiselect = false;
            table.gridOptions.onRowDeselect(data[0], {});
            expect(invoke).not.toHaveBeenCalled();

            table.multiselect = true;
            table.items = [data[0], data[1]];
            state.get.mockReturnValue({ selectedItem: [{ page: 3, index: 1 }, { page: 1, index: 5 }] });
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: undefined });
            callGrid.mockReturnValue([data[1]]);

            table.gridOptions.onRowDeselect(data[0], {});

            expect(table.items).toEqual([data[1]]);
            expect(invoke).toHaveBeenCalledWith('rowdeselect', expect.objectContaining({ row: data[0] }));
            expect(state.remove).toHaveBeenCalledWith(table, 'selectedItem');
            expect(state.set).toHaveBeenCalledWith(table, { selectedItem: [{ page: 1, index: 5 }] });
        });

        it('drops the stored selection entirely when the last row is deselected', () => {
            const state = setupState();
            table.multiselect = true;
            table.items = [data[0]];
            state.get.mockReturnValue({ selectedItem: [{ page: 3, index: 1 }] });
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: undefined });
            table.gridOptions.onRowDeselect(data[0], {});
            expect(state.remove).toHaveBeenCalled();
            expect(state.set).not.toHaveBeenCalled();
        });

        it('warns about unsupported pagination types on deselect', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            setupState();
            table.multiselect = true;
            table.navigation = 'On-Demand';
            table.gridOptions.onRowDeselect(data[0], {});
            expect(warn).toHaveBeenCalled();
        });

        it('replaces the items for single select and keeps them for multi select', () => {
            table.multiselect = false;
            table.items = [data[0]];
            table.gridOptions.assignSelectedItems(data[1], {}, {});
            expect(table.items).toEqual([data[1]]);

            table.multiselect = true;
            table.items = [];
            table.gridOptions.assignSelectedItems(data[0], {}, { _selected: true, rowId: 0 });
            table.gridOptions.assignSelectedItems(data[0], {}, { _selected: true });
            table.gridOptions.assignSelectedItems(data[1], {}, { _selected: false });
            expect(table.items).toEqual([data[0]]);
            expect(table.showFirstRow).toBe(true);
        });

        it('raises rowdblclick and the click events', () => {
            table.gridOptions.onRowDblClick(data[0], { type: 'dblclick' });
            expect(invoke).toHaveBeenCalledWith('rowdblclick', expect.objectContaining({ $event: { type: 'dblclick' } }));

            invoke.mockClear();
            table.gridOptions.callOnRowClickEvent(data[0], { type: 'click' });
            expect(invoke).not.toHaveBeenCalled();
            table.gridOptions.callOnRowClickEvent(data[0], { originalEvent: {} });
            expect(invoke).toHaveBeenCalledWith('rowclick', expect.anything());

            invoke.mockClear();
            callGrid.mockReturnValue([data[2]]);
            table.gridOptions.callOnRowDeselectEvent(data[0], {});
            expect(table.items).toEqual([data[2]]);
            expect(invoke).toHaveBeenCalledWith('rowdeselect', expect.objectContaining({ row: data[0] }));
        });
    });

    describe('column events', () => {
        it('tracks the selected columns and raises the events', () => {
            callGrid.mockReturnValue([{ field: 'age' }]);
            table.gridOptions.onColumnSelect({ field: 'age' }, 'e1');
            expect(table.selectedColumns).toEqual([{ field: 'age' }]);
            expect(invoke).toHaveBeenCalledWith('columnselect', { $data: { field: 'age' }, $event: 'e1' });

            table.gridOptions.onColumnDeselect({ field: 'age' }, 'e2');
            expect(invoke).toHaveBeenCalledWith('columndeselect', { $data: { field: 'age' }, $event: 'e2' });

            table.gridOptions.onHeaderClick({ field: 'age' }, 'e3');
            expect(invoke).toHaveBeenCalledWith('headerclick', { $event: 'e3', $data: { field: 'age' }, column: { field: 'age' } });
        });
    });

    describe('selectAllRows', () => {
        beforeEach(() => {
            table.__fullData = [{ id: 1 }, { id: 2 }, { id: 3 }];
            table.dataNavigator = { dataSize: 3, maxResults: 2 };
            table.statePersistence = { setWidgetState: jest.fn() };
        });

        it('does nothing unless header select all and multi select are on', () => {
            table.headerselectall = false;
            table.multiselect = true;
            table.gridOptions.selectAllRows(true, {});
            expect(table.statePersistence.setWidgetState).not.toHaveBeenCalled();
        });

        it('selects every row across the pages and raises rowselect for each', () => {
            table.headerselectall = true;
            table.multiselect = true;
            callGrid.mockReturnValue([{ id: 1 }]);
            table.gridOptions.selectAllRows(true, 'evt');
            expect(table.items).toEqual(table.__fullData);
            expect(table.statePersistence.setWidgetState).toHaveBeenCalledWith(table, {
                selectedItem: [{ page: 1, index: 0 }, { page: 1, index: 1 }, { page: 2, index: 0 }],
            });
            expect(invoke).toHaveBeenCalledTimes(3);
            expect(invoke).toHaveBeenCalledWith('rowselect', expect.objectContaining({ $event: 'evt' }));
        });

        it('clears the selection and raises rowdeselect for each row', () => {
            table.headerselectall = true;
            table.multiselect = true;
            table.gridOptions.selectAllRows(false, 'evt');
            expect(table.items).toEqual([]);
            expect(table.selectedItems).toEqual([]);
            expect(table.statePersistence.setWidgetState).toHaveBeenCalledWith(table, { selectedItem: null });
            expect(invoke).toHaveBeenCalledTimes(3);
            expect(invoke).toHaveBeenCalledWith('rowdeselect', expect.anything());
        });
    });

    describe('record operations', () => {
        it('delegates delete, insert and update to the table', () => {
            const del = jest.spyOn(table, 'deleteRecord').mockImplementation(() => undefined);
            const ins = jest.spyOn(table, 'insertRecord').mockImplementation(() => undefined);
            const upd = jest.spyOn(table, 'updateRecord').mockImplementation(() => undefined);
            const cancel = jest.fn();
            const callBack = jest.fn();

            table.gridOptions.onRowDelete(data[0], cancel, 'evt', callBack, { rowindex: 1 });
            expect(del).toHaveBeenCalledWith({ rowindex: 1, row: data[0], cancelRowDeleteCallback: cancel, evt: 'evt', callBack });

            table.gridOptions.onRowInsert(data[0], 'evt', callBack, { a: 1 });
            expect(ins).toHaveBeenCalledWith({ a: 1, row: data[0], event: 'evt', callBack });

            table.prevData = { firstname: 'old' };
            table.gridOptions.afterRowUpdate(data[0], 'evt', callBack, {});
            expect(core.muteWatchers).toHaveBeenCalled();
            expect(upd).toHaveBeenCalledWith({ row: data[0], prevData: { firstname: 'old' }, event: 'evt', callBack });
        });

        it('passes the row index as previous data for static variable data sources', () => {
            const upd = jest.spyOn(table, 'updateRecord').mockImplementation(() => undefined);
            table.datasource = { category: 'wm.Variable' };
            table.gridOptions.afterRowUpdate(data[0], 'evt', jest.fn(), { rowindex: 2 });
            expect((upd.mock.calls[0] as any[])[0].prevData).toBe(2);
        });

        it('un-mutes the watchers shortly after an update', () => {
            jest.useFakeTimers();
            jest.spyOn(table, 'updateRecord').mockImplementation(() => undefined);
            table.gridOptions.afterRowUpdate(data[0], 'evt', jest.fn(), {});
            jest.advanceTimersByTime(20);
            expect(core.unMuteWatchers).toHaveBeenCalled();
            jest.useRealTimers();
        });

        it('keeps a copy of the row before it is updated and informs a parent live table', () => {
            const updateRow = jest.fn();
            table._liveTableParent = { updateRow };
            table.gridOptions.beforeRowUpdate(data[0], 'edit');
            expect(updateRow).toHaveBeenCalledWith(data[0], 'edit');
            expect(table.prevData).toEqual(data[0]);
            expect(table.prevData).not.toBe(data[0]);
        });

        it('raises the before events and returns their result', () => {
            invoke.mockReturnValue(false);
            expect(table.gridOptions.onBeforeRowUpdate(data[0], 'e', { o: 1 })).toBe(false);
            expect(invoke).toHaveBeenCalledWith('beforerowupdate', { $event: 'e', $data: data[0], row: data[0], options: { o: 1 } });
            expect(table.gridOptions.onBeforeRowInsert(data[0], 'e', { o: 1 })).toBe(false);
            expect(invoke).toHaveBeenCalledWith('beforerowinsert', { $event: 'e', $data: data[0], row: data[0], options: { o: 1 } });
            jest.spyOn(table, 'addRowIndex').mockReturnValue({ idx: 1 });
            expect(table.gridOptions.onBeforeRowDelete(data[0], 'e', { o: 1 })).toBe(false);
            expect(invoke).toHaveBeenCalledWith('beforerowdelete', { $event: 'e', row: { idx: 1 }, options: { o: 1 } });
            expect(table.gridOptions.onBeforeFormRender(data[0], 'e', 'new')).toBe(false);
            expect(invoke).toHaveBeenCalledWith('beforeformrender', { $event: 'e', row: data[0], $operation: 'new' });
        });

        it('collects the form widgets and raises formrender once the form is ready', () => {
            jest.useFakeTimers();
            const widget = { context: {} as any };
            const setDisabled = jest.spyOn(table, 'setDisabledOnField').mockImplementation(() => undefined);
            table.fieldDefs = [{ field: 'firstname', inlineInstance: widget }, { field: 'age' }, { field: 'x', inlineInstanceNew: widget }];

            table.gridOptions.onFormRender({}, 'evt', 'edit', false);
            jest.advanceTimersByTime(300);
            expect(Object.keys(table.formWidgets)).toEqual(['firstname']);
            expect(widget.context.formWidgets).toBe(table.formWidgets);
            expect(setDisabled).toHaveBeenCalledWith('edit', table.fieldDefs[0], 'inlineInstance');
            expect(invoke).toHaveBeenCalledWith('formrender', { $event: 'evt', formWidgets: table.formWidgets, $operation: 'edit' });

            table.gridOptions.onFormRender({}, 'evt', 'new', true);
            jest.advanceTimersByTime(300);
            expect(Object.keys(table.formWidgets)).toEqual(['x']);
            jest.useRealTimers();
        });
    });

    describe('class watchers', () => {
        beforeEach(() => {
            jest.spyOn(table, 'getClonedRowObject').mockImplementation((row: any) => ({ ...row }));
            jest.spyOn(table, 'registerDestroyListener').mockImplementation(() => undefined);
            table.widgetId = 'wid';
            (core.$watch as jest.Mock).mockClear();
            (core.$unwatch as jest.Mock).mockClear();
        });

        it('does not watch row classes without a rowngclass', () => {
            table.rowngclass = undefined;
            table.gridOptions.registerRowNgClassWatcher(data[0], 0);
            expect(core.$watch).not.toHaveBeenCalled();
        });

        it('watches the row class expression and applies the evaluated classes', () => {
            table.rowngclass = "{'active': row.age > 30}";
            table.gridOptions.registerRowNgClassWatcher(data[0], 2);
            expect(core.$unwatch).toHaveBeenCalledWith('wid_rowNgClass_2');
            const call = (core.$watch as jest.Mock).mock.calls[0];
            expect(call[0]).toBe(table.rowngclass);
            call[3]({ active: true }, { old: true });
            expect(callGrid).toHaveBeenCalledWith('applyRowNgClass', { toAdd: ['active'], toRemove: ['old'] }, 2);
        });

        it('only watches columns that define col-ng-class', () => {
            table.gridOptions.registerColNgClassWatcher(data[0], {}, 0, 0, false);
            expect(core.$watch).not.toHaveBeenCalled();

            table.gridOptions.registerColNgClassWatcher(data[0], { 'col-ng-class': 'cls' }, 1, 2, false);
            table.gridOptions.registerColNgClassWatcher(data[0], { 'col-ng-class': 'cls' }, 1, 2, true);
            expect((core.$unwatch as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['wid_colNgClass_1_2', 'wid_summaryRow_colNgClass_1_2']);
            (core.$watch as jest.Mock).mock.calls[0][3]('a', undefined);
            expect(callGrid).toHaveBeenCalledWith('applyColNgClass', { toAdd: ['a'], toRemove: [] }, 1, 2);
        });

        it('keeps the collapse and expand titles in sync with their expression', () => {
            const element = document.createElement('div');
            element.setAttribute('expandtitle.bind', 'x');
            table.gridOptions.registerCollapseOrExpandTitleWatch('row.firstname', data[0], 1, 'expandtitle', element);
            (core.$watch as jest.Mock).mock.calls[0][3]('Open', undefined);
            expect(element.hasAttribute('expandtitle.bind')).toBe(false);
            expect(element.getAttribute('expandtitle')).toBe('Open');
            expect(element.getAttribute('title')).toBe('Open');

            const other = document.createElement('div');
            table.gridOptions.registerCollapseOrExpandTitleWatch('row.firstname', data[0], 1, 'collapsetitle', other);
            (core.$watch as jest.Mock).mock.calls[1][3]('Close', undefined);
            expect(other.getAttribute('collapsetitle')).toBe('Close');
            expect(other.hasAttribute('title')).toBe(false);
        });
    });

    describe('templates and widgets', () => {
        it('clears the custom expression caches', () => {
            table.customExprViewRef = { clear: jest.fn() };
            table.customExprCompiledTl = { a: 1 };
            table.customExprCompiledSummaryTl = { b: 1 };
            table.gridOptions.clearCustomExpression();
            expect(table.customExprViewRef.clear).toHaveBeenCalled();
            expect(table.customExprCompiledTl).toEqual({});
            expect(table.customExprCompiledSummaryTl).toEqual({});
        });

        it('clears the row detail caches', () => {
            table.rowDetailViewRef = { clear: jest.fn() };
            table.rowDefMap = { a: 1 };
            table.rowDefInstances = { a: 1 };
            table.gridOptions.clearRowDetailExpression();
            expect(table.rowDetailViewRef.clear).toHaveBeenCalled();
            expect(table.rowDefMap).toEqual({});
            expect(table.rowDefInstances).toEqual({});
        });

        it('returns the compiled custom expression of a cell or an empty string', () => {
            table.customExprCompiledTl = { firstname0: 'cell' };
            table.customExprCompiledSummaryTl = { firstname0: 'summary' };
            expect(table.gridOptions.getCustomExpression('firstname', 0)).toBe('cell');
            expect(table.gridOptions.getCustomExpression('firstname', 0, true)).toBe('summary');
            expect(table.gridOptions.getCustomExpression('missing', 0)).toBe('');
        });

        it('compiles custom expression templates for every column', () => {
            jest.spyOn(table, 'getClonedRowObject').mockImplementation((row: any) => ({ ...row }));
            jest.spyOn(table, 'addEventsToContext').mockImplementation(() => undefined);
            const root = document.createElement('div');
            root.setAttribute('data-col-identifier', 'firstname');
            const create: jest.Mock = jest.fn((..._args: any[]) => ({ rootNodes: [root] }));
            table.customExprViewRef = { createEmbeddedView: create };
            table.columns = { firstname: { caption: 'Firstname' } };
            table.customExprTmpl = [{ id: 1 }, undefined];
            table.customExprCompiledTl = {};
            table.customExprCompiledSummaryTl = {};

            table.gridOptions.generateCustomExpressions(data[0], 3);
            table.gridOptions.generateCustomExpressions(data[0], 4, true);

            expect(table.customExprCompiledTl.firstname3).toBe(root);
            expect(table.customExprCompiledSummaryTl.firstname4).toBe(root);
            expect((create.mock.calls[0] as any[])[1].colDef).toEqual({ caption: 'Firstname' });
        });

        it('compiles the templates of dynamic tables from the field definitions', () => {
            jest.spyOn(table, 'getClonedRowObject').mockImplementation((row: any) => ({ ...row }));
            jest.spyOn(table, 'addEventsToContext').mockImplementation(() => undefined);
            const root = document.createElement('div');
            root.setAttribute('data-col-identifier', 'age');
            table.customExprViewRef = { createEmbeddedView: jest.fn(() => ({ rootNodes: [root] })) };
            table.columns = { age: {} };
            table.isdynamictable = true;
            table.fieldDefs = [{ customExprTmpl: { id: 1 } }, {}];
            table.customExprCompiledTl = {};
            table.gridOptions.generateCustomExpressions(data[0], 0);
            expect(table.customExprCompiledTl.age0).toBe(root);
        });

        it('generates and returns the row expansion cell', () => {
            jest.spyOn(table, 'getClonedRowObject').mockImplementation((row: any) => ({ ...row }));
            const nodes = [document.createElement('span')];
            table.rowExpansionActionViewRef = { createEmbeddedView: jest.fn(() => ({ rootNodes: nodes })) };
            table.rowExpansionActionTmpl = [{ id: 1 }];
            table.rowExpansionActionTl = {};
            table.gridOptions.generateRowExpansionCell(data[0], 2);
            expect(table.gridOptions.getRowExpansionAction(2)).toBe(nodes);
        });

        it('reads and writes inline form values through the form controls', () => {
            table.ngform = { controls: { firstname: { value: 'a', setValue: jest.fn() }, firstname_new: { setValue: jest.fn() } } };
            table.inlineCompliedTl = { firstname: 'inline' };
            table.inlineNewCompliedTl = { firstname: 'inline-new' };

            expect(table.gridOptions.getInlineEditWidget('firstname', 'v', false)).toBe('inline');
            expect(table.ngform.controls.firstname.setValue).toHaveBeenCalledWith('v');
            expect(table.gridOptions.getInlineEditWidget('firstname', 'w', true)).toBe('inline-new');
            expect(table.ngform.controls.firstname_new.setValue).toHaveBeenCalledWith('w');
            expect(table.gridOptions.getFieldValue('firstname')).toBe('a');
            expect(table.gridOptions.getFieldValue('missing')).toBeUndefined();
            expect(() => table.gridOptions.setFieldValue('missing', 1)).not.toThrow();
        });

        it('marks the control of a field as touched', () => {
            const markAsTouched = jest.fn();
            table.ngform = { controls: { firstname: { markAsTouched } } };
            table.gridOptions.setTouched('firstname');
            table.gridOptions.setTouched('missing');
            expect(markAsTouched).toHaveBeenCalledTimes(1);
        });

        it('exposes the filter widgets generated per column', () => {
            table.rowFilterCompliedTl = { firstname: 'filter' };
            expect(table.gridOptions.getFilterWidget('firstname')).toBe('filter');
        });

        it('generates the filter row from the filter templates', () => {
            const root = document.createElement('div');
            root.setAttribute('data-col-identifier', 'firstname');
            const create: jest.Mock = jest.fn((..._args: any[]) => ({ rootNodes: [root] }));
            table.filterViewRef = { clear: jest.fn(), createEmbeddedView: create };
            table.filterTmpl = [{ id: 1 }];
            table.emptyMatchModes = ['empty'];
            table.rowFilter = { firstname: { matchMode: 'empty' }, age: { matchMode: 'equals' } };

            table.gridOptions.generateFilterRow();

            expect(table.rowFilterCompliedTl.firstname).toBe(root);
            const context = (create.mock.calls[0] as any[])[1];
            expect(context.isDisabled('firstname')).toBe(true);
            expect(context.isDisabled('age')).toBe(false);
            expect(context.isDisabled('unknown')).toBe(false);
        });

        it('redraws the inline and filter widgets of every column', () => {
            const redraw = jest.fn();
            table.fieldDefs = [{ inlineInstance: { redraw }, inlineInstanceNew: { redraw }, filterInstance: { redraw } }, {}];
            table.gridOptions.redrawWidgets();
            expect(redraw).toHaveBeenCalledTimes(3);
        });
    });

    describe('row detail expansion', () => {
        const context = (overrides: any = {}) => {
            jest.spyOn(table, 'getClonedRowObject').mockImplementation((row: any) => ({ ...row }));
            const rowInstance = { invokeEventCallback: jest.fn() };
            const rootNode = document.createElement('div');
            table.rowInstance = rowInstance;
            table.rowDef = { content: 'detail', ...overrides };
            table.rowDefMap = {};
            table.rowDefInstances = {};
            table.rowDetailViewRef = { createEmbeddedView: jest.fn(() => ({ rootNodes: [rootNode] })) };
            table.rowExpansionTmpl = { id: 'tmpl' };
            const $target = $('<div></div>');
            const $overlay = $('<div style="display:none"></div>');
            return { rowInstance, rootNode, $target, $overlay, callback: jest.fn() };
        };

        it('stops when the beforerowexpand event returns false', () => {
            const ctx = context();
            ctx.rowInstance.invokeEventCallback.mockReturnValue(false);
            table.gridOptions.generateRowDetailView('e', data[0], 1, ctx.$target, ctx.$overlay, ctx.callback);
            expect(ctx.callback).not.toHaveBeenCalled();
        });

        it('stops when the row has no detail content', () => {
            const ctx = context({ content: '' });
            table.gridOptions.generateRowDetailView('e', data[0], 1, ctx.$target, ctx.$overlay, ctx.callback);
            expect(ctx.callback).not.toHaveBeenCalled();
        });

        it('renders the detail view once and completes through containerLoad', () => {
            jest.useFakeTimers();
            const ctx = context();
            table.gridOptions.generateRowDetailView('e', data[0], 1, ctx.$target, ctx.$overlay, ctx.callback);

            expect(ctx.callback).toHaveBeenCalled();
            expect(ctx.$target[0].contains(ctx.rootNode)).toBe(true);
            const templateContext = table.rowDetailViewRef.createEmbeddedView.mock.calls[0][1];
            expect(templateContext.item).toEqual(data[0]);
            templateContext.containerLoad({ name: 'detailWidget' });
            jest.advanceTimersByTime(600);
            expect(table.rowDefInstances[1]).toEqual({ name: 'detailWidget' });
            expect(ctx.rowInstance.invokeEventCallback).toHaveBeenCalledWith('rowexpand', expect.objectContaining({ $data: { name: 'detailWidget' } }));
            jest.useRealTimers();
        });

        it('re-uses an already rendered detail view', () => {
            const ctx = context();
            table.rowDefMap[1] = { content: 'detail' };
            table.rowDefInstances[1] = { name: 'cached' };
            table.gridOptions.generateRowDetailView('e', data[0], 1, ctx.$target, ctx.$overlay, ctx.callback);
            expect(table.rowDetailViewRef.createEmbeddedView).not.toHaveBeenCalled();
            expect(ctx.rowInstance.invokeEventCallback).toHaveBeenCalledWith('rowexpand', expect.objectContaining({ $data: { name: 'cached' } }));
        });

        it('raises the collapse events with the rendered detail', () => {
            const rowInstance = { invokeEventCallback: jest.fn().mockReturnValue(true) };
            table.rowInstance = rowInstance;
            table.rowDefInstances = { 4: 'detail' };
            expect(table.gridOptions.onBeforeRowCollapse('e', data[0], 4)).toBe(true);
            expect(rowInstance.invokeEventCallback).toHaveBeenCalledWith('beforerowcollapse', { $event: 'e', row: data[0], $data: 'detail' });
            table.gridOptions.onRowCollapse('e', data[0]);
            expect(rowInstance.invokeEventCallback).toHaveBeenCalledWith('rowcollapse', { $event: 'e', row: data[0] });
        });
    });

    describe('state and misc callbacks', () => {
        it('tracks the grid state and edit mode', () => {
            table.gridOptions.setGridState('loading');
            expect(table.isLoading).toBe(true);
            table.gridOptions.setGridState('idle');
            expect(table.isLoading).toBe(false);
            table.gridOptions.setGridEditMode(true);
            expect(table.isGridEditMode).toBe(true);
            expect(core.$appDigest).toHaveBeenCalled();
        });

        it('computes the page of the action row for scrolling tables only', () => {
            const setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            table.gridOptions.navigation = 'Basic';
            table.gridOptions.setActionRowIndex('12');
            expect(setOption).not.toHaveBeenCalled();

            table.gridOptions.navigation = 'Scroll';
            table.pagesize = 5;
            table.gridOptions.setActionRowIndex('12');
            expect(table.actionRowIndex).toBe(12);
            expect(table.actionRowPage).toBe(3);
            expect(setOption).toHaveBeenCalledWith('actionRowIndex', 12);
            expect(setOption).toHaveBeenCalledWith('actionRowPage', 3);

            setOption.mockClear();
            table.gridOptions.setActionRowIndex('abc');
            expect(setOption).toHaveBeenCalledTimes(1);
        });

        it('clears the action row variables only for scrolling tables with no deleted row', () => {
            const clear = jest.spyOn(table, 'clearActionRowVars').mockImplementation(() => undefined);
            table.isRowDeleted = true;
            table.infScroll = true;
            table.gridOptions.clearActionRowIndex();
            expect(clear).not.toHaveBeenCalled();

            table.isRowDeleted = false;
            table.gridOptions.clearActionRowIndex();
            expect(clear).toHaveBeenCalledTimes(1);

            table.infScroll = false;
            table.onDemandLoad = false;
            table.gridOptions.clearActionRowIndex();
            expect(clear).toHaveBeenCalledTimes(1);
        });

        it('shows an info message when an edit changed nothing', () => {
            const toggle = jest.spyOn(table, 'toggleMessage').mockImplementation(() => undefined);
            table.gridOptions.noChangesDetected();
            expect(toggle).toHaveBeenCalledWith(true, 'info', table.appLocale.MESSAGE_NO_CHANGES, '');
        });

        it('runs callbacks later and inside the zone', () => {
            jest.useFakeTimers();
            const fn = jest.fn();
            table.gridOptions.timeoutCall(fn, 50);
            expect(fn).not.toHaveBeenCalled();
            jest.advanceTimersByTime(60);
            expect(fn).toHaveBeenCalledTimes(1);
            jest.useRealTimers();

            const zoneFn = jest.fn();
            table.gridOptions.runInNgZone(zoneFn);
            expect(zoneFn).toHaveBeenCalled();
            table.gridOptions.safeApply();
            expect(core.$appDigest).toHaveBeenCalled();
        });

        it('adds the load more button and navigates on demand', () => {
            const navigatePage = jest.fn();
            table.dataNavigator = { navigatePage };
            table.gridOptions.mode = '';
            table.gridOptions.addLoadMoreBtn();
            const args = callGrid.mock.calls[0];
            expect(args[0]).toBe('addLoadMoreBtn');
            const handler = args[3];

            handler('evt');
            expect(navigatePage).toHaveBeenCalledWith('next', 'evt');
            expect(table.isDataLoading).toBe(true);

            table.gridOptions.mode = 'viewless';
            handler('evt2');
            expect(navigatePage).toHaveBeenCalledWith('first', 'evt2', true);
            expect(table.gridOptions.mode).toBe('');
        });

        it('binds the scroll event only for infinite scrolling tables that have data', () => {
            jest.useFakeTimers();
            const bind = jest.spyOn(table.paginationService, 'bindScrollEvt').mockImplementation(() => undefined);
            table._gridData = [];
            table.infScroll = true;
            table.gridOptions.bindScrollEvt();
            jest.runAllTimers();
            expect(bind).not.toHaveBeenCalled();

            table._gridData = [{}];
            table.gridOptions.bindScrollEvt();
            jest.runAllTimers();
            expect(bind).toHaveBeenCalledWith(table, 'tbody', expect.any(Number));
            jest.useRealTimers();
        });
    });

    describe('gridData setter', () => {
        let setOption: jest.SpyInstance;

        beforeEach(() => {
            setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            callGrid.mockImplementation((name: string) => (name === 'getOptions' ? { colDefs: [{ field: 'firstname' }] } : undefined));
            table.variableInflight = false;
            table.isdynamictable = false;
            table.gridOptions.navigation = 'Basic';
            jest.spyOn(table, 'isNavigationEnabled').mockReturnValue(false);
        });

        it('ignores empty data while a variable call is in flight', () => {
            table.variableInflight = true;
            table.gridData = [];
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', expect.anything(), expect.anything());
            expect(setOption).not.toHaveBeenCalled();
        });

        it('shows the no data message for an empty dataset', () => {
            table.nodatamessage = 'Nothing here';
            table.gridData = [];
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'nodata', 'Nothing here');
            expect(table.variableInflight).toBe(false);
        });

        it('marks the grid ready and renders the data with the before render event', () => {
            table.gridData = data;
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'ready');
            expect(invoke).toHaveBeenCalledWith('beforedatarender', expect.objectContaining({ data }));
            expect(setOption).toHaveBeenCalledWith('data', data);
            expect(table.gridData).toBe(data);
        });

        it('keeps rendering when the beforedatarender handler throws', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            invoke.mockImplementation(() => { throw new Error('boom'); });
            table.gridData = data;
            expect(warn).toHaveBeenCalled();
            expect(setOption).toHaveBeenCalledWith('data', data);
        });

        it('skips the before render event for dynamic tables', () => {
            table.isdynamictable = true;
            table.gridData = data;
            expect(invoke).not.toHaveBeenCalledWith('beforedatarender', expect.anything());
        });

        it('stops when the grid has no options yet', () => {
            callGrid.mockReturnValue(undefined);
            table.gridData = data;
            expect(setOption).not.toHaveBeenCalledWith('data', expect.anything());
        });

        it('copies the column definitions to the grid when it has none', () => {
            callGrid.mockImplementation((name: string) => (name === 'getOptions' ? { colDefs: [] } : undefined));
            table.fieldDefs = [{ field: 'firstname' }];
            table.gridData = data;
            expect(setOption).toHaveBeenCalledWith('colDefs', [{ field: 'firstname' }]);
        });

        it('sets the serial number start for paginated tables', () => {
            (table.isNavigationEnabled as jest.Mock).mockReturnValue(true);
            table.dataNavigator = { dn: { currentPage: 3 }, maxResults: 10 };
            table.gridData = data;
            expect(setOption).toHaveBeenCalledWith('startRowIndex', 21);
        });

        describe('scroll and on-demand pagination', () => {
            beforeEach(() => {
                table.gridOptions.navigation = 'On-Demand';
                table.dataNavigator = { dn: { currentPage: 2 }, maxResults: 3, isDisableNext: false };
                jest.spyOn(table.paginationService, 'updateFieldsOnPagination').mockReturnValue([[...data, ...data], 2]);
                table.onDemandLoad = true;
            });

            it('merges the next page and adds the load more button once', () => {
                const addBtn = jest.spyOn(table.gridOptions, 'addLoadMoreBtn').mockImplementation(() => undefined);
                table.gridData = data;
                expect(table.currentPage).toBe(2);
                expect(table.gridData.length).toBe(6);
                expect(setOption).toHaveBeenCalledWith('isLastPage', false);
                expect(addBtn).toHaveBeenCalled();
            });

            it('hides the loading indicator when the last page was loaded', () => {
                table.dataNavigator.isDisableNext = true;
                table.gridData = data;
                expect(setOption).toHaveBeenCalledWith('isLastPage', true);
                expect(callGrid).toHaveBeenCalledWith('hideLoadingIndicator', true, table.infScroll);
            });

            it('hides the indicator when no data is loading', () => {
                table.onDemandLoad = false;
                table.isDataLoading = false;
                table.gridData = data;
                expect(callGrid).toHaveBeenCalledWith('hideLoadingIndicator', false, table.infScroll);
            });

            it('replaces the edited row of an earlier page', () => {
                table.gridOptions.lastActionPerformed = table.gridOptions.ACTIONS.EDIT;
                table.actionRowIndex = 1;
                table.pagesize = 3;
                const edited = [{ firstname: 'a', age: 1 }, { firstname: 'EDITED', age: 2 }, { firstname: 'c', age: 3 }];
                table.gridData = edited;
                expect(table._gridData[1]).toEqual({ firstname: 'EDITED', age: 2 });
            });
        });
    });

    describe('watchVariableDataSet', () => {
        beforeEach(() => {
            jest.spyOn(table, 'isDataValid').mockReturnValue(true);
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            jest.spyOn(table, 'populateGridData').mockImplementation(() => undefined);
            jest.spyOn(table, 'refreshRowFilterDataFromDataset').mockImplementation(() => undefined);
            jest.spyOn(table, 'enablePageNavigation').mockImplementation(() => undefined);
            jest.spyOn(table, 'resetPageNavigation').mockImplementation(() => undefined);
            jest.spyOn(table, 'checkFiltersApplied').mockImplementation(() => undefined);
            jest.spyOn(table, 'getSortExpr').mockReturnValue('');
            jest.spyOn(table, 'isNavigationEnabled').mockReturnValue(false);
            table.statePersistence = { getWidgetState: jest.fn().mockReturnValue(undefined), computeMode: jest.fn().mockReturnValue('none') };
            table.variableInflight = false;
            table.shownavigation = false;
            table.dataNavigatorWatched = true;
        });

        it('does nothing once destroyed', () => {
            table.isDestroyed = true;
            table.watchVariableDataSet(data);
            expect(table.populateGridData).not.toHaveBeenCalled();
            table.isDestroyed = false;
        });

        it('clears the loading state when the data is invalid', () => {
            (table.isDataValid as jest.Mock).mockReturnValue(false);
            table.variableInflight = true;
            table.watchVariableDataSet(data);
            expect(table.variableInflight).toBe(false);
            expect(table.setGridData).toHaveBeenCalledWith([]);
        });

        it('leaves invalid data alone when nothing is loading', () => {
            (table.isDataValid as jest.Mock).mockReturnValue(false);
            table.watchVariableDataSet(data);
            expect(table.setGridData).not.toHaveBeenCalled();
        });

        it('enables the page navigation first when it is not watched yet', () => {
            table.shownavigation = true;
            table.dataNavigatorWatched = false;
            table.watchVariableDataSet(data);
            expect(table.enablePageNavigation).toHaveBeenCalled();
            expect(table.populateGridData).not.toHaveBeenCalled();
        });

        it('resets the navigation and shows no data for an empty dataset', () => {
            table.nodatamessage = 'None';
            table.variableInflight = true;
            table.watchVariableDataSet(undefined);
            expect(table.resetPageNavigation).toHaveBeenCalled();
            expect(table.variableInflight).toBe(false);
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'nodata', 'None');
            expect(table.setGridData).toHaveBeenCalledWith([]);
        });

        it('treats static variables as finished loading', () => {
            table.datasource = { category: 'wm.Variable' };
            table.variableInflight = true;
            table.watchVariableDataSet(null);
            expect(table.variableInflight).toBe(false);
        });

        it('clears the loading state for data that is not an object', () => {
            table.variableInflight = true;
            table.watchVariableDataSet('plain text');
            expect(table.variableInflight).toBe(false);
            expect(table.setGridData).toHaveBeenCalledWith([]);
        });

        it('renders an empty grid for empty results when not loading', () => {
            table.watchVariableDataSet({ dataValue: '' });
            expect(table.setGridData).toHaveBeenCalledWith([]);
        });

        it('populates the grid and refreshes the row filters', () => {
            table.watchVariableDataSet(data);
            expect(table.populateGridData).toHaveBeenCalledWith(data);
            expect(table.refreshRowFilterDataFromDataset).toHaveBeenCalled();
            expect(table.checkFiltersApplied).toHaveBeenCalled();
        });

        it('restores select options of a stored row filter search', () => {
            const select = document.createElement('div');
            select.innerHTML = '<wm-select widget-id="s"><select><option>A</option><option>B</option></select></wm-select>';
            table.rowFilterCompliedTl = { firstname: select };
            (table.statePersistence.getWidgetState as jest.Mock).mockReturnValue({ search: [{ field: 'firstname', value: 'B' }, { field: 'other', value: 'x' }] });
            table.watchVariableDataSet(data);
            const options = select.querySelectorAll('option');
            expect((options[1] as HTMLOptionElement).selected).toBe(true);
        });
    });

    describe('small helpers', () => {
        it('keeps defined header items and filters their nested columns', () => {
            const item = { columns: [{ a: 1 }, { columns: [{ b: 2 }] }] } as any;
            expect(table.filterEmptyValues(item)).toBe(true);
            expect(item.columns.length).toBe(2);
            expect(item.columns[1].columns).toEqual([{ b: 2 }]);
            expect(table.filterEmptyValues({ a: 1 })).toBe(true);
        });

        it('falls back to a page size of 5', () => {
            table.actualPageSize = undefined;
            expect(table.getActualPageSize()).toBe(5);
            table.actualPageSize = 20;
            expect(table.getActualPageSize()).toBe(20);
        });

        it('raises enterkeypress only for the enter key', () => {
            table.onKeyPress({ which: 13 });
            expect(invoke).toHaveBeenCalledWith('enterkeypress', expect.objectContaining({ $event: { which: 13 } }));
            invoke.mockClear();
            table.onKeyPress({ which: 65 });
            expect(invoke).not.toHaveBeenCalled();
        });

        it('exposes the selected item as an object, array or empty object', () => {
            table.items = [];
            table.multiselect = false;
            expect(table.selecteditem).toEqual({});
            table.items = [data[0], data[1]];
            expect(table.selecteditem).toEqual(data[0]);
            expect(table.selecteditem).not.toBe(data[0]);
            table.multiselect = true;
            expect(table.selecteditem).toEqual([data[0], data[1]]);
        });

        it('selects rows when the selected item is assigned', () => {
            table.items = [data[0]];
            table.selecteditem = [data[1]];
            expect(table.items).toEqual([]);
            expect(callGrid).toHaveBeenCalledWith('selectRows', [data[1]]);
        });

        it('marks the sort direction icon from the stored state', () => {
            const grid = document.createElement('div');
            grid.innerHTML = '<table><thead><tr><th data-col-field="age"><span class="sort-icon"></span></th></tr></thead></table>';
            table.datagridElement = $(grid);
            table.sortStateHandler({ sort: { field: 'age', direction: 'asc' } });
            expect(grid.querySelector('.sort-icon')!.classList.contains('asc')).toBe(true);
            table.sortStateHandler({ sort: { field: 'age', direction: 'desc' } });
            expect(grid.querySelector('.sort-icon')!.classList.contains('desc')).toBe(true);
            table.sortStateHandler({ sort: { field: 'missing', direction: 'asc' } });
        });
    });

    describe('page size options', () => {
        it.each([
            [undefined, '5,10,20,50,100'],
            [null, '5,10,20,50,100'],
            ['', '5,10,20,50,100'],
            [42, '5,10,20,50,100'],
            ['10, 5, 10, abc, -20', '10,5,20'],
            [[5, '10', 'x', 5], '5,10'],
            ['[1,2,3]', '1,2,3'],
            ['[broken', '5,10,20,50,100'],
            ['x,y', '5,10,20,50,100'],
        ])('sanitizes %p to %p', (input, expected) => {
            expect(table.sanitizeCommaSeparatedIntegers(input)).toBe(expected);
        });

        it('returns the sorted numeric page size options', () => {
            expect(table.getNormalizedPageSizeOptionsArray('50,10,20')).toEqual([10, 20, 50]);
            expect(table.getNormalizedPageSizeOptionsArray(undefined)).toEqual([5, 10, 20, 50, 100]);
        });

        it('detects a change of the page size options', () => {
            table.prevPagesizeoptions = '5,10';
            table.pagesizeoptions = '5,10';
            expect(table.isPageSizeOptionsChanged()).toBe(false);
            table.pagesizeoptions = '5,20';
            expect(table.isPageSizeOptionsChanged()).toBe(true);
        });

        describe('setDefaultPageSize', () => {
            beforeEach(() => {
                table.dataNavigator = { widget: {}, pageSizeOptions: [], defaultPageSizeOptions: [] };
                table.statePersistence = { getWidgetState: jest.fn().mockReturnValue(undefined) };
                table.datasource = { maxResults: 3 };
            });

            it('applies the size to the navigator and the data source', () => {
                table.gridOptions.allowpagesizechange = false;
                table.pagesize = 7;
                table.setDefaultPageSize(10);
                expect(table.dataNavigator.options).toEqual({ maxResults: 10 });
                expect(table.dataNavigator.widget.maxResults).toBe(10);
                expect(table.dataNavigator.maxResults).toBe(10);
                expect(table.datasource.maxResults).toBe(7);
            });

            it('uses the size stored in the widget state when page size change is allowed', () => {
                table.gridOptions.allowpagesizechange = true;
                table.pagesizeoptions = '10,20';
                table.prevPagesizeoptions = '10,20';
                (table.statePersistence.getWidgetState as jest.Mock).mockReturnValue({ pagesize: 20 });
                table.setDefaultPageSize(5);
                expect(table.pagesize).toBe(20);
                expect(table.updatedPageSize).toBe(20);
            });

            it('falls back to the first configured option', () => {
                table.gridOptions.allowpagesizechange = true;
                table.pagesizeoptions = '20,10';
                table.prevPagesizeoptions = '20,10';
                table.setDefaultPageSize(5);
                expect(table.pagesize).toBe(10);
                expect(table.dataNavigator.pageSizeOptions).toEqual([]);
            });
        });

        describe('selectPageSize', () => {
            beforeEach(() => {
                table.dataNavigator = { pageSizeOptions: [5, 10, 20], onPageSizeChange: jest.fn() };
            });

            it('ignores the call when page size change is not allowed and no size is given', () => {
                table.allowpagesizechange = false;
                table.selectPageSize(undefined as any);
                expect(table.dataNavigator.onPageSizeChange).not.toHaveBeenCalled();
            });

            it('passes valid sizes through', () => {
                table.allowpagesizechange = true;
                table.selectPageSize(10);
                expect(table.dataNavigator.onPageSizeChange).toHaveBeenCalledWith(undefined, 10);
            });

            it('falls back to the first option for sizes outside or between the options', () => {
                table.allowpagesizechange = true;
                table.selectPageSize(2);
                table.selectPageSize(50);
                table.selectPageSize(7);
                expect(table.dataNavigator.onPageSizeChange.mock.calls.map((c: any[]) => c[1])).toEqual([5, 5, 5]);
            });
        });
    });

    describe('onPropertyChange', () => {
        let setOption: jest.SpyInstance;

        beforeEach(() => {
            setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
        });

        it.each([
            ['showheader', 'showHeader'],
            ['enablesort', 'enableSort'],
            ['enablecolumnselection', 'enableColumnSelection'],
            ['isrowselectable', 'isrowselectable'],
            ['multiselect', 'multiselect'],
            ['radioselect', 'showRadioColumn'],
        ])('%s updates the %s grid option', (key, option) => {
            table.onPropertyChange(key, true, false);
            expect(setOption).toHaveBeenCalledWith(option, true);
        });

        it.each([
            'multiselecttitle', 'multiselectarialabel', 'radioselecttitle', 'radioselectarialabel', 'viewlessmessage',
        ])('%s updates both the grid and its options', (key) => {
            table.onPropertyChange(key, 'value', '');
            expect(setOption).toHaveBeenCalledWith(key, 'value');
            expect(table.gridOptions[key]).toBe('value');
        });

        it('raises show and hide events', () => {
            table.onPropertyChange('show', true, false);
            expect(invoke).toHaveBeenCalledWith('show');
            table.onPropertyChange('show', false, true);
            expect(invoke).toHaveBeenCalledWith('hide');
        });

        it('applies the page size options from a changed property', () => {
            const setDefault = jest.spyOn(table, 'setDefaultPageSize').mockImplementation(() => undefined);
            table.dataNavigator = { pageSizeOptions: [10, 20], onPageSizeChange: jest.fn() };
            table.allowpagesizechange = true;
            table.pagesize = 10;
            table.onPropertyChange('pagesizeoptions', '20, 10', '5,10');
            expect(table.prevPagesizeoptions).toBe('5,10');
            expect(table.gridOptions.pagesizeoptions).toBe('20,10');
            expect(table.pagesizeoptions).toBe('20,10');
            expect(setDefault).toHaveBeenCalledWith(10);

            setDefault.mockClear();
            table.allowpagesizechange = false;
            table.onPropertyChange('pagesizeoptions', '20', '5');
            expect(setDefault).not.toHaveBeenCalled();
        });

        it('enables page size change together with the sanitized options', () => {
            const setDefault = jest.spyOn(table, 'setDefaultPageSize').mockImplementation(() => undefined);
            table.dataNavigator = {};
            table.pagesizeoptions = '5,5,10';
            table.pagesize = 5;
            table.onPropertyChange('allowpagesizechange', true, false);
            expect(table.gridOptions.allowpagesizechange).toBe(true);
            expect(table.dataNavigator.allowpagesizechange).toBe(true);
            expect(table.pagesizeoptions).toBe('5,10');
            expect(setDefault).toHaveBeenCalled();

            setDefault.mockClear();
            table.onPropertyChange('allowpagesizechange', false, true);
            expect(setDefault).not.toHaveBeenCalled();
        });
    });

    describe('data source helpers', () => {
        it('informs the columns about a data source change', () => {
            const changed = jest.fn();
            table.fieldDefs = [{ onDataSourceChange: changed }, {}];
            table.onDataSourceChange();
            expect(changed).toHaveBeenCalledTimes(1);
        });

        it('reloads the filter data of columns only for multi column filtering', () => {
            const load = jest.fn();
            table.fieldDefs = [{ loadFilterData: load }, {}];
            table.filtermode = 'search';
            table.refreshRowFilterDataFromDataset();
            expect(load).not.toHaveBeenCalled();
            table.filtermode = 'multicolumn';
            table.refreshRowFilterDataFromDataset();
            expect(load).toHaveBeenCalledTimes(1);
        });
    });

    describe('populateGridData state restoration', () => {
        beforeEach(() => {
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            jest.spyOn(table, 'selectItem').mockImplementation(() => undefined);
            table.dataNavigator = { dn: { currentPage: 2 } };
            table._selectedItemsExist = true;
            jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({ parentId: undefined });
        });

        const withState = (selectedItem: any[]) => {
            table.statePersistence = { getWidgetState: jest.fn().mockReturnValue({ selectedItem }) };
        };

        it('re-selects the stored rows of the current page', () => {
            withState([{ page: 2, index: 0 }, { page: 2, index: 2 }, { page: 1, index: 1 }]);
            jest.spyOn(table, 'selecteditem', 'get').mockReturnValue([] as any);
            table.populateGridData(data);
            expect(table.selectItem).toHaveBeenCalledWith(0, undefined);
            expect(table.selectItem).toHaveBeenCalledWith(2, undefined);
            expect(table._selectedItemsExist).toBe(false);
        });

        it('only selects rows whose parent matches for nested tables', () => {
            withState([{ page: 2, index: 0, parentRowIndex: '5', parentCurrentPage: '1' }, { page: 2, index: 1, parentRowIndex: '9', parentCurrentPage: '1' }]);
            (table.gridOptions.getParentTableData as jest.Mock).mockReturnValue({ parentId: '5', parentPage: '1' });
            jest.spyOn(table, 'selecteditem', 'get').mockReturnValue([] as any);
            table.populateGridData(data);
            expect(table.selectItem).toHaveBeenCalledTimes(1);
            expect(table.selectItem).toHaveBeenCalledWith(0, undefined);
        });

        it('assigns the selected item for single select tables', () => {
            withState([{ page: 2, index: 1 }]);
            jest.spyOn(table, 'selecteditem', 'get').mockReturnValue({} as any);
            const setSelected = jest.spyOn(table, 'selecteditem', 'set').mockImplementation(() => undefined);
            table.populateGridData(data);
            expect(setSelected).toHaveBeenCalledWith([1]);
        });

        it('does nothing without stored selections', () => {
            table.statePersistence = { getWidgetState: jest.fn().mockReturnValue({}) };
            table.populateGridData(data);
            expect(table.selectItem).not.toHaveBeenCalled();
        });

        it('builds the dynamic columns from the data of a dynamic table', () => {
            table.isdynamictable = true;
            const create = jest.spyOn(table, 'createGridColumns').mockImplementation(() => undefined);
            table.populateGridData(data);
            expect(create).toHaveBeenCalled();
            expect(table.setGridData).not.toHaveBeenCalled();
        });
    });
});
