import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IMaskModule } from 'angular-imask';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AbstractDialogService, AbstractI18nService, App, AppDefaults, DataSource, DynamicComponentRefProvider, Viewport } from '@wm/core';
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
        name="MoreTable" title="Users" navigation="Basic" isdynamictable="false" filtermode="search">
        <div wmTableColumn index="0" headerIndex="0" binding="firstname" caption="Firstname" type="string" show="true" readonly="true" searchable="true"></div>
        <div wmTableColumn index="1" headerIndex="1" binding="age" caption="Age" type="number" show="true" readonly="true" searchable="false"></div>
    </div>`;

const data = [
    { firstname: 'admin', age: 42 },
    { firstname: 'user', age: 28 },
    { firstname: 'other', age: 23 },
];

@Component({ standalone: false, template: markup })
class MoreTableWrapperComponent {
    @ViewChild(TableComponent, { static: true }) wmComponent: TableComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [
        TrustAsPipe, TableComponent, TableCUDDirective, TableFilterSortDirective, TableActionDirective, TableColumnDirective,
        TableColumnGroupDirective, TableRowDirective, PaginationComponent, TableRowActionDirective, DateComponent, TimeComponent,
        BrowserAnimationsModule, ButtonComponent, CommonModule, FormsModule, ReactiveFormsModule, InputTextComponent, NumberComponent,
        ListComponent, FormWidgetDirective, MenuComponent, IMaskModule, BsDatepickerModule, TimepickerModule, BsDropdownModule, ToDatePipe,
    ],
    declarations: [MoreTableWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Viewport, useValue: mockViewport },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: DynamicComponentRefProvider, useValue: mockApp },
        { provide: DatePipe, useClass: DatePipe },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: WidgetRef, useValue: { widget: { name: 'MoreTable', beforedatarender: jest.fn() } } },
        { provide: TrustAsPipe, useClass: TrustAsPipe },
        AbstractDialogService,
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe },
        { provide: ToDatePipe, useClass: ToDatePipe },
    ],
    teardown: { destroyAfterEach: false },
};


describe('TableComponent - additional behaviour', () => {
    let fixture: ComponentFixture<MoreTableWrapperComponent>;
    let table: any;
    let callGrid: jest.SpyInstance;
    let handlers: Record<string, Function>;

    beforeEach(waitForAsync(() => {
        handlers = {};
        jest.spyOn(mockApp, 'subscribe').mockImplementation(((name: string, cb: Function) => {
            handlers[name] = cb;
            return jest.fn();
        }) as any);
        fixture = compileTestComponent(moduleDef, MoreTableWrapperComponent);
        table = fixture.componentInstance.wmComponent;
        table.populateGridData(data);
        fixture.detectChanges();
        callGrid = jest.spyOn(table, 'callDataGridMethod').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('rows and forms', () => {
        it('adds the row position to rows of the grid data and leaves others alone', () => {
            table.gridOptions.data = [{ a: 1 }, { a: 2 }];
            table.gridData = table.gridOptions.data;
            const second = table.addRowIndex(table.gridOptions.data[1]);
            expect(second).toMatchObject({ a: 2, $index: 2, $isFirst: false, $isLast: true });
            const first = table.addRowIndex(table.gridOptions.data[0]);
            expect(first).toMatchObject({ $index: 1, $isFirst: true, $isLast: false });
            const stranger = { a: 9 };
            expect(table.addRowIndex(stranger)).toBe(stranger);
        });

        it('treats rows without values as empty', () => {
            expect(table.isEmptyRecord({ a: null, b: undefined, c: '' })).toBe(true);
            expect(table.isEmptyRecord({ a: 0 })).toBe(false);
            expect(table.isEmptyRecord({ a: 'x' })).toBe(false);
        });

        it('clears the form controls of the edited row or the new row and keeps filters', () => {
            const make = (value: string) => {
                const control = new FormControl(value, Validators.required);
                return control;
            };
            table.ngform = new FormGroup({ a: make('1'), a_new: make('2'), a_filter: make('3') });
            table.clearForm();
            expect(table.ngform.get('a').value).toBe('');
            expect(table.ngform.get('a').validator).toBeNull();
            expect(table.ngform.get('a_new').value).toBe('2');
            expect(table.ngform.get('a_filter').value).toBe('3');
            table.clearForm(true);
            expect(table.ngform.get('a_new').value).toBe('');
            expect(table.ngform.get('a_filter').value).toBe('3');
        });

        it('resets a control to untouched and pristine', () => {
            const control = new FormControl('x');
            control.markAsTouched();
            control.markAsDirty();
            table.resetFormControl(control);
            expect(control.touched).toBe(false);
            expect(control.pristine).toBe(true);
        });

        it('disables assigned primary keys for existing rows only', () => {
            const colDef: any = { 'primary-key': true, generator: 'assigned', widget: {} };
            table.setDisabledOnField('edit', colDef, 'widget');
            expect(colDef.widget.disabled).toBe(true);
            const fresh: any = { 'primary-key': true, generator: 'assigned', widget: {} };
            table.setDisabledOnField('new', fresh, 'widget');
            expect(fresh.widget.disabled).toBeUndefined();
            const related: any = { 'primary-key': true, generator: 'assigned', 'related-entity-name': 'x', widget: {} };
            table.setDisabledOnField('edit', related, 'widget');
            expect(related.widget.disabled).toBeUndefined();
        });

        it('expands and collapses rows through the grid', () => {
            table.expandRow(2);
            table.collapseRow(2);
            expect(callGrid).toHaveBeenCalledWith('expandRow', 2);
            expect(callGrid).toHaveBeenCalledWith('collapseRow', 2);
        });

        it('shows messages only when there is something to show', () => {
            const notify = jest.spyOn(table.app, 'notifyApp').mockImplementation(() => undefined);
            table.toggleMessage(true, 'success', 'saved', 'Header');
            expect(notify).toHaveBeenCalledWith('saved', 'success', 'Header');
            notify.mockClear();
            table.toggleMessage(true, 'success', '');
            table.toggleMessage(false, 'success', 'saved');
            expect(notify).not.toHaveBeenCalled();
        });

        it('adds the context shortcuts', () => {
            const context: any = {};
            const add = jest.spyOn(table, 'addNewRow').mockImplementation(() => undefined);
            const del = jest.spyOn(table, 'deleteRow').mockImplementation(() => undefined);
            const edit = jest.spyOn(table, 'editRow').mockImplementation(() => undefined);
            table.addEventsToContext(context);
            context.addNewRow();
            context.deleteRow();
            context.editRow();
            expect([add, del, edit].every((spy) => spy.mock.calls.length === 1)).toBe(true);
        });
    });

    describe('data source operations', () => {
        it('answers capability questions itself and forwards the rest', () => {
            table.datasource = { execute: jest.fn(() => 'forwarded') };
            expect(table.execute(DataSource.Operation.IS_API_AWARE, {})).toBe(false);
            expect(table.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(false);
            expect(table.execute(DataSource.Operation.SUPPORTS_SERVER_FILTER, {})).toBe(false);
            expect(table.execute(DataSource.Operation.LIST_RECORDS, { a: 1 })).toBe('forwarded');
            expect(table.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, { a: 1 });
            table.datasource = undefined;
            expect(table.execute(DataSource.Operation.LIST_RECORDS, {})).toEqual({});
        });

        it('builds the sort expression from the paging options of pageable sources', () => {
            table.datasource = {
                execute: jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : { sort: { orders: [{ property: 'name', direction: 'ASC' }] } })),
            };
            expect(typeof table.getSortExpr()).toBe('string');
            table.datasource = { execute: jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : {})) };
            expect(table.getSortExpr()).toBe('');
            table.datasource = { execute: jest.fn(() => false) };
            expect(table.getSortExpr()).toBe('');
        });

        it('marks dataset updates and filter criteria changes', () => {
            const setLast = jest.spyOn(table.gridOptions, 'setLastActionPerformed');
            const setPage = jest.spyOn(table.gridOptions, 'setCurrentPage').mockImplementation(() => undefined);
            const updated = jest.spyOn(table.gridOptions, 'setIsDatasetUpdated');
            table.setLastActionToDatasetUpdate();
            expect(setLast).toHaveBeenCalledWith(table.gridOptions.ACTIONS.DATASET_UPDATE);
            expect(setPage).toHaveBeenCalledWith(1);
            expect(updated).toHaveBeenCalledWith(true);
        });

        it('only treats changed filter rules as a new filter criteria', () => {
            const toFilter = jest.spyOn(table, 'setLastActionToFilterCriteria').mockImplementation(() => undefined);
            table.datasource = { filterExpressions: { rules: [{ target: 'a', value: 1 }] } };
            jest.spyOn(table, 'compareFilterExpressions').mockReturnValue(true);
            table.checkIfVarFiltersApplied();
            expect(toFilter).not.toHaveBeenCalled();
            (table.compareFilterExpressions as jest.Mock).mockReturnValue(false);
            table.checkIfVarFiltersApplied();
            expect(toFilter).toHaveBeenCalledTimes(1);
            table.datasource = { dataBinding: { a: 1 } };
            table.checkIfVarFiltersApplied();
            expect(toFilter).toHaveBeenCalledTimes(2);
            table.datasource = {};
            table.checkIfVarFiltersApplied();
            expect(toFilter).toHaveBeenCalledTimes(2);
        });
    });

    describe('property changes', () => {
        it('ignores changes after the component was destroyed', () => {
            table.isDestroyed = true;
            const spy = jest.spyOn(table, 'watchVariableDataSet');
            table.onPropertyChange('datasource', {});
            expect(spy).not.toHaveBeenCalled();
            table.isDestroyed = false;
        });

        it('shows no data when the data source does not start automatically', () => {
            jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            jest.spyOn(table, 'onDataSourceChange').mockImplementation(() => undefined);
            table.datasource = { startUpdate: false, category: 'wm.LiveVariable' };
            table.allowpagesizechange = true;
            table.pagesize = 7;
            table.onPropertyChange('datasource', table.datasource);
            expect(table.variableInflight).toBe(false);
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'nodata', table.nodatamessage);
            expect(table.datasource.maxResults).toBe(7);
            expect(table.headerselectall).toBe(false);
        });

        it('stops loading when the data source of a bound dataset is not available yet', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table.binddatasource = 'Variables.x';
            table.datasource = undefined;
            table.variableInflight = true;
            table.onPropertyChange('dataset', [], undefined);
            expect(table.variableInflight).toBe(false);
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'nodata', table.nodatamessage);
        });

        it('maps the advanced navigation of older projects to classic', () => {
            table.onPropertyChange('navigation', 'Advanced', 'Basic');
            expect(table.navigation).toBe('Classic');
        });
    });

    describe('application events', () => {
        it('ignores state persistence options of other variables', () => {
            table.datasource = { name: 'mine' };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            handlers['check-state-persistence-options']({ variable: { name: 'other' } });
            expect(table._pageLoad).toBe(true);
        });

        it('falls back to selecting the first row when nothing was persisted', () => {
            table.datasource = { name: 'mine' };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
            const setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            handlers['check-state-persistence-options']({ variable: { name: 'mine' } });
            expect(table._pageLoad).toBe(false);
            expect(setOption).toHaveBeenCalledWith('selectFirstRow', table.gridfirstrowselect);
        });

        it('restores the persisted state when there is one', () => {
            table.datasource = { name: 'mine' };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ pagination: 2 });
            const restore = jest.spyOn(table, 'handleStateParams').mockReturnValue({} as any);
            handlers['check-state-persistence-options']({ variable: { name: 'mine' } });
            expect(restore).toHaveBeenCalledWith({ pagination: 2 }, expect.anything());
        });

        it('wires a dependent table to selection changes', () => {
            handlers['setup-cud-listener']('another');
            expect(table._isDependent).toBeFalsy();
            handlers['setup-cud-listener']('MoreTable');
            expect(table._isDependent).toBe(true);
            const first = table.selectedItemChangeSubscription;
            const unsubscribe = jest.spyOn(first, 'unsubscribe');
            handlers['setup-cud-listener']('MoreTable');
            expect(unsubscribe).toHaveBeenCalled();
        });
    });

    describe('document clicks', () => {
        const click = (target: Element) => table._documentClickBind({ target });

        it('saves the editing row for clicks outside the table', () => {
            const outside = document.createElement('div');
            document.body.appendChild(outside);
            click(outside);
            expect(callGrid).toHaveBeenCalledWith('saveRow');
            outside.remove();
        });

        it('ignores clicks inside the table, in dropdowns, dialogs, toasts and date pickers', () => {
            callGrid.mockClear();
            click(table.$element[0]);
            ['dropdown-menu', 'uib-typeahead-match', 'modal-dialog', 'toast'].forEach((cls) => {
                const el = document.createElement('div');
                el.className = cls;
                const inner = document.createElement('span');
                el.appendChild(inner);
                document.body.appendChild(el);
                click(inner);
                el.remove();
            });
            const day = document.createElement('span');
            day.setAttribute('bsdatepickerdaydecorator', '');
            document.body.appendChild(day);
            click(day);
            day.remove();
            expect(callGrid).not.toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        it('unsubscribes the navigator watches and clears the dynamic context', () => {
            const a = { unsubscribe: jest.fn() };
            const b = { unsubscribe: jest.fn() };
            table.navigatorResultWatch = a;
            table.navigatorMaxResultWatch = b;
            table._dynamicContext = { x: 1 };
            table.ngOnDestroy();
            expect(a.unsubscribe).toHaveBeenCalled();
            expect(b.unsubscribe).toHaveBeenCalled();
            expect(table.navigatorResultWatch).toBeNull();
            expect(table._dynamicContext).toBeNull();
        });
    });

    describe('export', () => {
        const fieldDef = (extra: any) => ({ show: true, displayName: 'Name', field: 'name', ...extra });

        it('exports the visible columns with the current filter and sort', () => {
            table.fieldDefs = [fieldDef({}), fieldDef({ field: 'rowOperations', displayName: 'Ops' }), fieldDef({ field: 'hidden', show: false }), fieldDef({ field: 'age', displayName: 'Age', exportexpression: 'age * 2' })];
            table.sortInfo = { field: 'name', direction: 'asc' };
            table.exportdatasize = 50;
            jest.spyOn(table, 'getFilterFields').mockReturnValue({ name: { value: 'a' } });
            const invoke = jest.spyOn(table, 'invokeEventCallback').mockReturnValue(undefined);
            table.datasource = { execute: jest.fn() };
            table.export({ label: 'CSV' });
            const [, request] = table.datasource.execute.mock.calls[0];
            expect(table.datasource.execute.mock.calls[0][0]).toBe(DataSource.Operation.DOWNLOAD);
            expect(request.data).toMatchObject({ exportType: 'CSV', orderBy: 'name asc', exportSize: 50, logicalOp: 'AND', matchMode: 'anywhereignorecase' });
            expect(Object.keys(request.data.columns)).toEqual(['name', 'age']);
            expect(request.data.columns.name).toEqual({ header: 'Name', field: 'name' });
            expect(request.data.columns.age).toEqual({ header: 'Age', expression: 'age * 2' });
            expect(request.data.fields).toHaveLength(2);
            expect(invoke).toHaveBeenCalledWith('beforeexport', expect.anything());
        });

        it('exports unsorted data and respects beforeexport', () => {
            table.fieldDefs = [fieldDef({})];
            table.sortInfo = {};
            jest.spyOn(table, 'getFilterFields').mockReturnValue({});
            table.datasource = { execute: jest.fn() };
            jest.spyOn(table, 'invokeEventCallback').mockReturnValue(false);
            table.export({ label: 'CSV' });
            expect(table.datasource.execute).not.toHaveBeenCalled();
            (table.invokeEventCallback as jest.Mock).mockReturnValue(undefined);
            table.export({ label: 'XLSX' });
            expect(table.datasource.execute.mock.calls[0][1].data.orderBy).toBe('');
        });
    });

    describe('columns', () => {
        const column = (extra: any = {}) => ({ field: 'x', pcDisplay: true, tabletDisplay: true, mobileDisplay: true, ...extra });

        beforeEach(() => {
            table.fieldDefs = [];
            table.fullFieldDefs = [];
            table.primaryKey = [];
            table.rowFilter = {};
            table.viewport = { isMobileType: false, isTabletType: false };
        });

        it('skips columns that are not displayed on the current screen type', () => {
            table.registerColumns(column({ pcDisplay: false }), 0);
            expect(table.fullFieldDefs).toHaveLength(0);
            table.viewport = { isMobileType: false, isTabletType: true };
            table.registerColumns(column({ tabletDisplay: false }), 0);
            expect(table.fullFieldDefs).toHaveLength(0);
        });

        it('registers displayed columns and remembers primary keys and filters', () => {
            const col = column({ 'primary-key': true });
            table.registerColumns(col, 0);
            expect(table.fieldDefs[0]).toBe(col);
            expect(table.fullFieldDefs).toContain(col);
            expect(table.primaryKey).toEqual(['x']);
            expect(table.rowFilter.x).toEqual({ value: undefined });
        });

        it('forwards upload events to the column', () => {
            const invoke = jest.fn();
            table.columns = { file: { invokeEventCallback: invoke, _oldUploadVal: 'old' } };
            const $event = { target: { files: ['f'] } };
            table.triggerUploadEvent($event, 'change', 'file', { id: 1 });
            expect(invoke).toHaveBeenCalledWith('change', { $event, row: { id: 1 }, newVal: ['f'], oldVal: 'old' });
            expect(table.columns.file._oldUploadVal).toEqual(['f']);
            table.triggerUploadEvent($event, 'click', 'file', { id: 1 });
            expect(invoke).toHaveBeenLastCalledWith('click', { $event, row: { id: 1 } });
            invoke.mockClear();
            table.triggerUploadEvent($event, 'click', 'missing', {});
            expect(invoke).not.toHaveBeenCalled();
        });

        it('sanitises the page size options', () => {
            const fallback = table.sanitizeCommaSeparatedIntegers(undefined);
            expect(table.sanitizeCommaSeparatedIntegers(null)).toBe(fallback);
            expect(table.sanitizeCommaSeparatedIntegers('')).toBe(fallback);
            expect(table.sanitizeCommaSeparatedIntegers(5)).toBe(fallback);
            expect(table.sanitizeCommaSeparatedIntegers('[5, 10, 20]')).toBe('5,10,20');
            expect(table.sanitizeCommaSeparatedIntegers('5, 10, x, 5, -15')).toBe('5,10,15');
            expect(table.sanitizeCommaSeparatedIntegers(['5', '15'])).toBe('5,15');
            expect(table.sanitizeCommaSeparatedIntegers('[broken]')).toBe(fallback);
            expect(table.sanitizeCommaSeparatedIntegers('x, y')).toBe(fallback);
        });

        it('normalises the page size options into a sorted number list', () => {
            expect(table.getNormalizedPageSizeOptionsArray('20, 5, 10')).toEqual([5, 10, 20]);
        });
    });

    describe('page navigation', () => {
        it('shows the paginated results of the navigator in the table', () => {
            const resultEmitter = new Subject<any>();
            table.dataNavigator = { resultEmitter, maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [{ a: 1 }];
            table.binddataset = 'Variables.v.dataSet';
            table.enablePageNavigation();
            expect(table.dataNavigatorWatched).toBe(true);
            resultEmitter.next([{ a: 2 }]);
            expect(table.widget.dataset).toEqual([{ a: 2 }]);
            resultEmitter.next({ a: 3 });
            expect(table.widget.dataset).toEqual({ a: 3 });
            resultEmitter.next('text');
            expect(table.widget.dataset).toBe('text');
            resultEmitter.next(undefined);
            expect(table.widget.dataset).toBeUndefined();
        });

        it('refreshes the data set manually when the result equals the data set', () => {
            const resultEmitter = new Subject<any>();
            table.dataNavigator = { resultEmitter, maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [{ a: 1 }];
            table.binddataset = 'Variables.v.dataSet';
            const watch = jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            table.enablePageNavigation();
            resultEmitter.next([{ a: 1 }]);
            expect(watch).toHaveBeenCalledWith([{ a: 1 }]);
        });

        it('keeps static variable rows in sync with the results', () => {
            const resultEmitter = new Subject<any>();
            table.dataNavigator = { resultEmitter, maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [{ a: 1 }];
            table.binddataset = 'Variables.v.dataSet';
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.gridOptions.data = [{ a: 1 }];
            table.items = [{ a: 1 }];
            table.widget.dataset = [{ a: 9 }];
            table.enablePageNavigation();
            resultEmitter.next([{ a: 5 }]);
            expect(table.items[0]).toEqual({ a: 9 });
        });

        it('replaces its previous subscription and does nothing without a navigator', () => {
            const first = new Subject<any>();
            table.dataNavigator = { resultEmitter: first, maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [];
            table.binddataset = 'x';
            table.enablePageNavigation();
            const previous = table.navigatorResultWatch;
            const unsubscribe = jest.spyOn(previous, 'unsubscribe');
            table.enablePageNavigation();
            expect(unsubscribe).toHaveBeenCalled();
            table.dataNavigator = undefined;
            table.dataNavigatorWatched = false;
            table.enablePageNavigation();
            expect(table.dataNavigatorWatched).toBe(false);
            expect(() => table.resetPageNavigation()).not.toThrow();
        });

        it('binds the data set to the navigator with the page size', () => {
            table.dataNavigator = { resultEmitter: new Subject<any>(), maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [{ a: 1 }];
            table.binddataset = 'Variables.v.dataSet';
            table.pagesize = 12;
            table.enablePageNavigation();
            expect(table.dataNavigator.widget.maxResults).toBe(12);
            expect(table.dataNavigator.options).toEqual({ maxResults: 12 });
            expect(table.dataNavigator.setBindDataSet).toHaveBeenCalled();
            table.dataNavigator.maxResultsEmitter.next(30);
            expect(table.pagesize).toBe(30);
            table.resetPageNavigation();
            expect(table.dataNavigator.resetPageNavigation).toHaveBeenCalled();
        });
    });
});
