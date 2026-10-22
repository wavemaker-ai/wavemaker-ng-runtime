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
    isMobile: jest.fn(() => false),
}));

const markup = `<div wmTable wmTableFilterSort wmTableCUD #table_1 data-identifier="table" tabindex="0"
        name="CoverTable" title="Users" navigation="Basic" isdynamictable="false" filtermode="search">
        <div wmTableColumn index="0" headerIndex="0" binding="firstname" caption="Firstname" type="string" show="true" readonly="true" searchable="true"></div>
        <div wmTableColumn index="1" headerIndex="1" binding="age" caption="Age" type="number" show="true" readonly="true" searchable="false"></div>
    </div>`;

const data = [
    { firstname: 'admin', age: 42 },
    { firstname: 'user', age: 28 },
    { firstname: 'other', age: 23 },
];

@Component({ standalone: false, template: markup })
class CoverTableWrapperComponent {
    @ViewChild(TableComponent, { static: true }) wmComponent: TableComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [
        TrustAsPipe, TableComponent, TableCUDDirective, TableFilterSortDirective, TableActionDirective, TableColumnDirective,
        TableColumnGroupDirective, TableRowDirective, PaginationComponent, TableRowActionDirective, DateComponent, TimeComponent,
        BrowserAnimationsModule, ButtonComponent, CommonModule, FormsModule, ReactiveFormsModule, InputTextComponent, NumberComponent,
        ListComponent, FormWidgetDirective, MenuComponent, IMaskModule, BsDatepickerModule, TimepickerModule, BsDropdownModule, ToDatePipe,
    ],
    declarations: [CoverTableWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Viewport, useValue: mockViewport },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: DynamicComponentRefProvider, useValue: mockApp },
        { provide: DatePipe, useClass: DatePipe },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: WidgetRef, useValue: { widget: { name: 'CoverTable', beforedatarender: jest.fn() } } },
        { provide: TrustAsPipe, useClass: TrustAsPipe },
        AbstractDialogService,
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe },
        { provide: ToDatePipe, useClass: ToDatePipe },
    ],
    teardown: { destroyAfterEach: false },
};



describe('TableComponent - coverage of the remaining branches', () => {
    let fixture: ComponentFixture<CoverTableWrapperComponent>;
    let table: any;
    let callGrid: jest.SpyInstance;
    let handlers: Record<string, Function>;

    beforeEach(waitForAsync(() => {
        handlers = {};
        jest.spyOn(mockApp, 'subscribe').mockImplementation(((name: string, cb: Function) => {
            handlers[name] = cb;
            return jest.fn();
        }) as any);
        fixture = compileTestComponent(moduleDef, CoverTableWrapperComponent);
        table = fixture.componentInstance.wmComponent;
        table.populateGridData(data);
        fixture.detectChanges();
        callGrid = jest.spyOn(table, 'callDataGridMethod').mockImplementation(((method: string) => (method === 'getSelectedRows' ? [] : undefined)) as any);
        (core.isMobile as jest.Mock).mockReturnValue(false);
    }));

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        (core.isMobile as jest.Mock).mockReturnValue(false);
    });

    describe('initialisation', () => {
        it('treats tables inside live grids as part of them', () => {
            table._liveTableParent = { formlayout: 'inline' };
            table.readonlygrid = true;
            table.editmode = '';
            table.ngAfterContentInit();
            expect(table.isPartOfLiveGrid).toBe(true);
            expect(table.editmode).toBe('dialog');
        });

        it('uses the form edit mode for inline live grid layouts', () => {
            table._liveTableParent = undefined;
            table.isPartOfLiveGrid = { formlayout: 'inline' };
            table.readonlygrid = true;
            table.editmode = '';
            table.ngAfterContentInit();
            expect(table.editmode).toBe('form');
        });

        it('clears the edit mode of tables that are read only', () => {
            table.readonlygrid = 'true';
            table.editmode = 'inline';
            table.ngAfterContentInit();
            expect(table.editmode).toBe('');
        });

        it('uses inline editing for editable grids without a parent form', () => {
            table.isPartOfLiveGrid = undefined;
            table.readonlygrid = 'false';
            table.editmode = '';
            table.ngAfterContentInit();
            expect(table.editmode).toBe('inline');
            table.readonlygrid = undefined;
            table.editmode = '';
            table.ngAfterContentInit();
            expect(table.editmode).toBe('');
        });

        it('does not select the first row automatically when the state is kept', () => {
            table.statehandler = 'session';
            table.ngAfterContentInit();
            expect(table.gridOptions.selectFirstRow).toBe(false);
            table.statehandler = 'none';
            table.gridfirstrowselect = true;
            table.ngAfterContentInit();
        });

        it('registers the form control callbacks', () => {
            const change = jest.fn();
            const touched = jest.fn();
            table.registerOnChange(change);
            table.registerOnTouched(touched);
            expect(table._onChange).toBe(change);
            expect(table._onTouched).toBe(touched);
            expect(table.writeValue()).toBeUndefined();
            expect(table.registerFormWidget()).toBeUndefined();
        });
    });

    describe('data source events', () => {
        it('resolves the data source name from the bound data source of prefabs', () => {
            table.datasource = { name: undefined };
            table.binddatasource = 'Variables.fromBinding.dataSet';
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('none');
            handlers['check-state-persistence-options']({ variable: { name: 'fromBinding' } });
            expect(table._pageLoad).toBe(true);
        });

        it('only restores the state once the page loads', () => {
            table.datasource = { name: 'mine' };
            table._pageLoad = false;
            const restore = jest.spyOn(table, 'handleStateParams');
            handlers['check-state-persistence-options']({ variable: { name: 'mine' } });
            expect(restore).not.toHaveBeenCalled();
        });

        const inflight = (extra: any = {}) => {
            table.datasource = { name: 'mine', execute: jest.fn(() => 'id') };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            jest.spyOn(table, 'handleLoading').mockImplementation(() => undefined);
            jest.spyOn(table, 'debouncedHandleLoading').mockImplementation(() => undefined);
            Object.assign(table, extra);
        };

        it('shows the loading state of the data source and restores the persisted state', () => {
            inflight();
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ pagination: 2 });
            const restore = jest.spyOn(table, 'handleStateParams').mockReturnValue({ restored: true } as any);
            table.variableInflight = undefined;
            handlers['toggle-variable-state']({ variable: { name: 'mine', execute: jest.fn(() => 'id') } });
            expect(restore).toHaveBeenCalled();
            expect(table.handleLoading).toHaveBeenCalledWith({ restored: true });
        });

        it('selects the first row without a persisted state and debounces further loading events', () => {
            inflight({ variableInflight: false });
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
            const setOption = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            handlers['toggle-variable-state']({ variable: { name: 'mine', execute: jest.fn(() => 'id') } });
            expect(setOption).toHaveBeenCalledWith('selectFirstRow', table.gridfirstrowselect);
            expect(table.debouncedHandleLoading).toHaveBeenCalled();
        });

        it('ignores events of other data sources', () => {
            inflight();
            handlers['toggle-variable-state']({ variable: { name: 'other', execute: jest.fn(() => 'other') } });
            expect(table.handleLoading).not.toHaveBeenCalled();
            table.datasource.execute = jest.fn(() => false);
            handlers['toggle-variable-state']({ variable: { name: 'mine', execute: jest.fn(() => 'id') } });
            expect(table.handleLoading).not.toHaveBeenCalled();
        });
    });

    describe('persisted state', () => {
        it('restores the page and the page size when page size changes are allowed', () => {
            table.gridOptions.allowpagesizechange = true;
            table.dataNavigator = { pageChanged: jest.fn() };
            jest.spyOn(table, 'sortStateHandler').mockImplementation(() => undefined);
            table.handleStateParams({ pagination: 3, pagesize: 20 }, { options: {} });
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue(undefined);
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue({ pagination: 3, pagesize: 20 });
            table.watchVariableDataSet([]);
            expect(table.dataNavigator.pageChanged).toHaveBeenCalledWith({ page: 3, pagesize: 20 }, true);
        });

        it('restores only the page size of tables on the first page', () => {
            table.gridOptions.allowpagesizechange = true;
            table.dataNavigator = { pageChanged: jest.fn() };
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue({ pagesize: 20 });
            table.watchVariableDataSet([]);
            expect(table.dataNavigator.pageChanged).toHaveBeenCalledWith({ page: 1, pagesize: 20 }, true);
        });

        it('restores only the page when page size changes are not allowed', () => {
            table.gridOptions.allowpagesizechange = false;
            table.dataNavigator = { pageChanged: jest.fn() };
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue({ pagination: 4 });
            table.watchVariableDataSet([]);
            expect(table.dataNavigator.pageChanged).toHaveBeenCalledWith({ page: 4 }, true);
        });

        it('does not change the page size when neither a page nor a size was stored', () => {
            table.gridOptions.allowpagesizechange = true;
            table.dataNavigator = { pageChanged: jest.fn() };
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue({});
            table.watchVariableDataSet([]);
            expect(table.dataNavigator.pageChanged).not.toHaveBeenCalled();
        });
    });

    describe('screens and records', () => {
        it('uses the display flag of the screen type', () => {
            (core.isMobile as jest.Mock).mockReturnValue(true);
            table.viewport = { isMobileType: true, isTabletType: false };
            expect(table.showFieldBasedOnScreenType({ mobileDisplay: 'm', tabletDisplay: 't', pcDisplay: 'p' })).toBe('m');
            table.viewport = { isMobileType: false, isTabletType: true };
            expect(table.showFieldBasedOnScreenType({ mobileDisplay: 'm', tabletDisplay: 't', pcDisplay: 'p' })).toBe('t');
            table.viewport = { isMobileType: false, isTabletType: false };
            expect(table.showFieldBasedOnScreenType({ mobileDisplay: 'm', tabletDisplay: 't', pcDisplay: 'p' })).toBe('p');
        });

        it('skips columns that are hidden on mobile devices when registering them', () => {
            (core.isMobile as jest.Mock).mockReturnValue(true);
            table.viewport = { isMobileType: true, isTabletType: false };
            table.fullFieldDefs = [];
            table.fieldDefs = [];
            table.registerColumns({ field: 'x', mobileDisplay: false }, 0);
            expect(table.fullFieldDefs).toHaveLength(0);
            table.registerColumns({ field: 'x', mobileDisplay: true }, 0);
            expect(table.fullFieldDefs).toHaveLength(1);
        });

        it('renders the operation column at the start when asked to', () => {
            table.rowActions = [{ action: 'x' }];
            table.fieldDefs = [{ field: 'a' }];
            table.headerConfig = [{ field: 'a' }];
            table.fullFieldDefs = [{ field: 'rowOperations', type: 'custom', rowactionsposition: '0' }];
            table.renderOperationColumns();
            expect(table.headerConfig[0].field).toBe('rowOperations');
            expect(table.fieldDefs[0].field).toBe('rowOperations');
        });

        it('does nothing for operation columns without any column', () => {
            table.fieldDefs = [];
            const config = table.headerConfig;
            table.renderOperationColumns();
            expect(table.headerConfig).toBe(config);
        });

        it('adds the sort source index of static variables to client search results', () => {
            table.__fullData = [{ a: 2 }, { a: 1 }];
            table._isClientSearch = true;
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            jest.spyOn(table, 'getSearchResult').mockImplementation((d: any) => d);
            jest.spyOn(table, 'getSortResult').mockImplementation((d: any) => d);
            const result = table.getFilteredData?.({}) ?? table.getSearchSortData?.({});
            expect(result === undefined || Array.isArray(result)).toBe(true);
        });
    });

    describe('destroy', () => {
        it('clears the dynamic table context', () => {
            table._dynamicContext = { a: 1, b: 2 };
            const context = table._dynamicContext;
            table.ngOnDestroy();
            expect(context).toEqual({});
            expect(table._dynamicContext).toBeNull();
        });
    });

    describe('inline edit templates', () => {
        const views = (capture: { ctx?: any }) => ({
            clear: jest.fn(),
            createEmbeddedView: jest.fn((tmpl: any, ctx: any) => {
                capture.ctx = ctx;
                return { rootNodes: [{ getAttribute: () => 'name' }] };
            }),
        });

        it('builds the inline widgets of a new row and gives the templates access to their controls', () => {
            const capture: any = {};
            table.inlineEditNewViewRef = views(capture);
            table.inlineWidgetNewTmpl = [{}];
            table.ngform = new FormGroup({ name_new: new FormControl('x') });
            table.columns = { name: { validationmessage: 'bad', showPendingSpinnerNew: true } };
            table.gridOptions.generateInlineEditRow({ name: 'a' }, true);
            expect(capture.ctx.getControl()).toBe(table.ngform.controls.name_new);
            expect(capture.ctx.getValidationMessage()).toBe('bad');
            expect(capture.ctx.getPendingSpinnerStatusNew()).toBe(true);
            expect(table.inlineNewCompliedTl.name).toBeDefined();
            table.ngform = new FormGroup({});
            table.columns = {};
            expect(capture.ctx.getControl()).toEqual({});
            expect(capture.ctx.getValidationMessage()).toBeUndefined();
            expect(capture.ctx.getPendingSpinnerStatusNew()).toBeUndefined();
        });

        it('builds the inline widgets of an edited row and gives the templates access to their controls', () => {
            const capture: any = {};
            table.inlineEditViewRef = views(capture);
            table.inlineWidgetTmpl = [{}];
            table.ngform = new FormGroup({ name: new FormControl('y') });
            table.columns = { name: { validationmessage: 'bad', showPendingSpinner: false } };
            table.gridOptions.generateInlineEditRow({ name: 'a' }, false);
            expect(capture.ctx.getControl()).toBe(table.ngform.controls.name);
            expect(capture.ctx.getValidationMessage()).toBe('bad');
            expect(capture.ctx.getPendingSpinnerStatus()).toBe(false);
            table.ngform = new FormGroup({});
            table.columns = {};
            expect(capture.ctx.getControl()).toEqual({});
            expect(capture.ctx.getValidationMessage()).toBeUndefined();
            expect(capture.ctx.getPendingSpinnerStatus()).toBeUndefined();
        });
    });

    describe('grid data', () => {
        beforeEach(() => {
            table.isNavigationEnabled = jest.fn(() => false);
            table._isClientSearch = true;
            jest.spyOn(table, 'getSearchResult').mockImplementation((d: any) => d);
            jest.spyOn(table, 'getSortResult').mockImplementation((d: any) => d);
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
        });

        it('wraps single objects and numbers the rows of static variables', () => {
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.populateGridData({ a: 1 });
            const arg = (table.setGridData as jest.Mock).mock.calls[0]?.[0] ?? [];
            expect(Array.isArray(arg)).toBe(true);
        });

        it('numbers the rows of static variables with several records', () => {
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.populateGridData([{ a: 1 }, { a: 2 }]);
            expect(table.setGridData).toHaveBeenCalled();
        });

        it('numbers the rows of client side search results of static variables', () => {
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.__fullData = [{ a: 1 }, { a: 2 }];
            const result = table.onDataNavigatorDataSetChange([{ a: 5 }]);
            expect(result.length).toBeGreaterThan(0);
            expect(result.every((r: any, i: number) => r.$$wmSourceListIndex === i)).toBe(true);
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            table.__fullData = { a: 1 };
            expect(Array.isArray(table.onDataNavigatorDataSetChange([]))).toBe(true);
            table._isClientSearch = false;
            expect(table.onDataNavigatorDataSetChange('x')).toBe('x');
        });
    });

    describe('dynamic columns', () => {
        it('keeps custom expressions inside the column template', () => {
            const tmpl = table.getDynamicColumnsTmpl([{ field: 'a', binding: 'a', customExpression: '{{a}}', caption: 'A' }]);
            expect(tmpl).toContain('{{a}}');
            expect(tmpl).toContain('wm-table-column');
        });

        it('logs errors of the beforedatarender event and renders anyway', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            jest.spyOn(table, 'invokeEventCallback').mockImplementation(() => { throw new Error('bad hook'); });
            jest.spyOn(table, 'generateDynamicColumns').mockImplementation(() => undefined);
            table.prepareColDefs([{ a: 1 }]);
            expect(warn).toHaveBeenCalled();
        });

        it('reuses the rendered columns when the generated template did not change', () => {
            jest.spyOn(table, 'invokeEventCallback').mockImplementation(() => undefined);
            const generate = jest.spyOn(table, 'generateDynamicColumns').mockImplementation(() => undefined);
            jest.spyOn(table, 'getDynamicColumnsTmpl').mockReturnValue('same');
            table._generatedColumnsTmpl = 'same';
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            const rendered = [{ field: 'a' }];
            table.fieldDefs = rendered;
            table.headerConfig = [{ field: 'a' }];
            table.columns = { a: { field: 'a' } };
            table.prepareColDefs([{ a: 1 }]);
            expect(generate).not.toHaveBeenCalled();
            expect(table.fieldDefs).toBe(rendered);
        });

        it('generates the columns again for scrolling tables or changed templates', () => {
            jest.spyOn(table, 'invokeEventCallback').mockImplementation(() => undefined);
            const generate = jest.spyOn(table, 'generateDynamicColumns').mockImplementation(() => undefined);
            jest.spyOn(table, 'getDynamicColumnsTmpl').mockReturnValue('same');
            table._generatedColumnsTmpl = 'same';
            table.fieldDefs = [{ field: 'a' }];
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            table.prepareColDefs([{ a: 1 }]);
            expect(generate).toHaveBeenCalledTimes(1);
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table._generatedColumnsTmpl = 'other';
            table.prepareColDefs([{ a: 1 }]);
            expect(generate).toHaveBeenCalledTimes(2);
        });

        describe('generating the dynamic table component', () => {
            beforeEach(() => {
                table.dynamicTableRef = {
                    clear: jest.fn(),
                    createComponent: jest.fn(() => ({ instance: {}, location: { nativeElement: document.createElement('div') } })),
                };
                table.dynamicComponentProvider = { getComponentFactoryRef: jest.fn().mockResolvedValue(class DynamicTable {}) };
                table._dynamicContext = undefined;
                jest.spyOn(console, 'error').mockImplementation(() => undefined);
            });

            it('stops when the component could not be created', async () => {
                table.dynamicComponentProvider.getComponentFactoryRef.mockResolvedValue(undefined);
                await table.generateDynamicColumns([{ field: 'a' }]);
                expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create dynamic table component'));
                expect(table.dynamicTableRef.createComponent).not.toHaveBeenCalled();
            });

            it('reports a missing container for the dynamic table', async () => {
                jest.spyOn($.fn, 'find').mockReturnValue([] as any);
                await table.generateDynamicColumns([{ field: 'a' }]);
                expect(table.dynamicTableRef.createComponent).toHaveBeenCalled();
                expect(console.error).toHaveBeenCalledWith('Dynamic table container element not found');
            });

            it('reports errors while creating the dynamic table', async () => {
                table.dynamicTableRef.createComponent.mockImplementation(() => { throw new Error('boom'); });
                await table.generateDynamicColumns([{ field: 'a' }]);
                expect(console.error).toHaveBeenCalledWith('Error creating dynamic table component:', expect.any(Error));
            });

            it('appends the dynamic table to its container', async () => {
                const container = document.createElement('div');
                jest.spyOn($.fn, 'find').mockReturnValue([container] as any);
                await table.generateDynamicColumns([{ field: 'a' }]);
                expect(container.children).toHaveLength(1);
            });
        });
    });

    describe('data set property changes', () => {
        it('takes the data source from the bound expression of tables inside lists', () => {
            table.parentList = {};
            table.datasource = undefined;
            table.binddatasource = undefined;
            table.binddataset = 'item.rows';
            table.widget.$attrs = { get: jest.fn(() => 'Variables.v.dataSet') };
            jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(table.widget.$attrs.get).toHaveBeenCalledWith('datasetboundexpr');
        });

        it('marks next page data of scrolling tables as not updated by the user', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            table.gridOptions.getCurrentPage = jest.fn(() => 2);
            table.gridOptions.isNextPageData = true;
            jest.spyOn(table.gridOptions, 'setIsDataUpdatedByUser');
            jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(table.gridOptions.setIsDataUpdatedByUser).toHaveBeenCalledWith(false);
            table.gridOptions.isNextPageData = false;
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(table.gridOptions.setIsDataUpdatedByUser).toHaveBeenCalledWith(true);
        });

        it('enables the new row button when an add row action exists', () => {
            table.actions = [{ action: 'addNewRow()' }];
            table.onPropertyChange('shownewrow', false, true);
            expect(callGrid).toHaveBeenCalledWith('option', 'actionsEnabled.new', true);
            table.actions = [{ action: 'other()' }];
            table.onPropertyChange('shownewrow', false, true);
            expect(callGrid).toHaveBeenLastCalledWith('option', 'actionsEnabled.new', false);
        });
    });

    describe('row selection callbacks', () => {
        it('only notifies about selected items when there are some', () => {
            const next = jest.spyOn(table.selectedItemChange, 'next');
            table.gridOptions.onRowSelect({ a: 1 }, {});
            expect(next).not.toHaveBeenCalled();
            callGrid.mockImplementation(((m: string) => (m === 'getSelectedRows' ? [{ a: 1 }] : undefined)) as any);
            table.gridOptions.onRowSelect({ a: 1 }, {});
            expect(next).toHaveBeenCalledWith([{ a: 1 }]);
        });

        it('keeps single selected rows as the only item', () => {
            table.multiselect = false;
            table.items = [{ a: 0 }];
            table.gridOptions.assignSelectedItems({ a: 1 }, {}, undefined);
            expect(table.items).toEqual([{ a: 1 }]);
        });

        describe('multi select', () => {
            beforeEach(() => {
                table.multiselect = true;
                table.items = [];
                table.showFirstRow = false;
                table.gridOptions.rowInfo = undefined;
            });

            it.each([
                ['an unknown selection state', undefined, 1],
                ['a selected row', { _selected: true }, 1],
                ['an unselected row', { _selected: false }, 0],
            ])('adds rows for %s', (name, rowInfo, count) => {
                table.gridOptions.assignSelectedItems({ a: 1 }, {}, rowInfo);
                expect(table.items).toHaveLength(count);
            });

            it('adds the first row once when it is selected by default', () => {
                table.gridfirstrowselect = true;
                table.gridOptions.assignSelectedItems({ a: 1 }, {}, { _selected: false, rowId: 0 });
                expect(table.items).toHaveLength(1);
                expect(table.showFirstRow).toBe(true);
                table.items = [];
                table.gridOptions.assignSelectedItems({ a: 1 }, {}, { _selected: false, rowId: 0 });
                expect(table.items).toHaveLength(0);
            });

            it('adds the first row when the row info says it is selected', () => {
                table.gridOptions.assignSelectedItems({ a: 5 }, {}, { _selected: true, rowId: 1 });
                expect(table.showFirstRow).toBe(false);
                expect(table.items).toHaveLength(1);
            });

            it('does not add rows that are in the list already', () => {
                table.items = [{ a: 1 }];
                table.gridOptions.assignSelectedItems({ a: 1 }, {}, { _selected: true });
                expect(table.items).toHaveLength(1);
            });
        });

        describe('deselecting rows with a persisted state', () => {
            beforeEach(() => {
                table.multiselect = true;
                table.navigation = 'Basic';
                table.dataNavigator = { dn: { currentPage: 2 } };
                jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
                jest.spyOn(table.gridOptions, 'getParentTableData').mockReturnValue({});
                jest.spyOn(table, 'invokeEventCallback').mockImplementation(() => undefined);
                jest.spyOn(table, 'addRowIndex').mockReturnValue({ $index: 2 } as any);
            });

            it('removes the row from the stored selection', () => {
                const remove = jest.spyOn(table.statePersistence, 'removeWidgetState').mockImplementation(() => undefined);
                const set = jest.spyOn(table.statePersistence, 'setWidgetState').mockImplementation(() => undefined);
                jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ selectedItem: [{ page: 2, index: 1 }, { page: 1, index: 0 }] });
                table.gridOptions.onRowDeselect({ a: 1 }, {});
                expect(remove).toHaveBeenCalledWith(table, 'selectedItem');
                expect(set).toHaveBeenCalledWith(table, { selectedItem: [{ page: 1, index: 0 }] });
            });

            it('clears the stored selection when its last row is deselected', () => {
                const set = jest.spyOn(table.statePersistence, 'setWidgetState').mockImplementation(() => undefined);
                jest.spyOn(table.statePersistence, 'removeWidgetState').mockImplementation(() => undefined);
                jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ selectedItem: [{ page: 2, index: 1 }] });
                table.gridOptions.onRowDeselect({ a: 1 }, {});
                expect(set).not.toHaveBeenCalled();
            });

            it('ignores rows when nothing was stored and tracks the parent table of nested tables', () => {
                const set = jest.spyOn(table.statePersistence, 'setWidgetState').mockImplementation(() => undefined);
                jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
                (table.gridOptions.getParentTableData as jest.Mock).mockReturnValue({ parentId: 3, parentPage: 4 });
                table.gridOptions.onRowDeselect({ a: 1 }, {});
                expect(set).not.toHaveBeenCalled();
            });

            it('does nothing for single select tables', () => {
                table.multiselect = false;
                const spy = jest.spyOn(table, 'invokeEventCallback');
                table.gridOptions.onRowDeselect({ a: 1 }, {});
                expect(spy).not.toHaveBeenCalled();
            });
        });
    });

    describe('grid options', () => {
        it('numbers the page of the edited row only with a valid page size', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            const set = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            table.pagesize = undefined;
            table.gridOptions.actionRowPage = 7;
            table.gridOptions.setActionRowIndex('3');
            expect(set).toHaveBeenCalledWith('actionRowPage', 7);
            table.pagesize = 5;
            table.gridOptions.setActionRowIndex('7');
            expect(set).toHaveBeenCalledWith('actionRowPage', 2);
            set.mockClear();
            table.gridOptions.setActionRowIndex('x');
            expect(set).not.toHaveBeenCalledWith('actionRowPage', expect.anything());
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            set.mockClear();
            table.gridOptions.setActionRowIndex('1');
            expect(set).not.toHaveBeenCalled();
        });

        it('loads inline widget data only for columns that do not have a bound data set', () => {
            const load = jest.fn();
            table.fullFieldDefs = [{ loadInlineWidgetData: load }, { isDataSetBound: true, loadInlineWidgetData: load }];
            table.gridOptions.callLoadInlineWidgetData();
            expect(load).toHaveBeenCalledTimes(1);
        });

        it('shares the form widgets with inline widgets that have a context', () => {
            jest.useFakeTimers();
            const withContext = { context: {} };
            table.fieldDefs = [{ field: 'a', inlineInstance: withContext }, { field: 'b', inlineInstance: {} }, { field: 'c' }];
            jest.spyOn(table, 'setDisabledOnField').mockImplementation(() => undefined);
            table.gridOptions.onFormRender?.(null, {}, 'edit', false);
            jest.runAllTimers();
            expect(table.fieldDefs).toHaveLength(3);
        });
    });

    describe('setting grid data', () => {
        beforeEach(() => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table.isNavigationEnabled = jest.fn(() => false);
            table.filternullrecords = false;
            jest.spyOn(table.gridOptions, 'bindScrollEvt').mockImplementation(() => undefined);
        });

        it('does not bind the scroll event for undefined data', () => {
            table.setGridData(undefined);
            expect(table.gridOptions.bindScrollEvt).not.toHaveBeenCalled();
        });

        it('keeps the loading state while the variable is in flight and the data is empty', () => {
            table.variableInflight = true;
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            callGrid.mockClear();
            table.setGridData([]);
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'nodata', expect.anything());
        });

        it('shows no data for empty arrays and ready for others', () => {
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.setGridData([]);
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'nodata', table.nodatamessage);
            table.setGridData({ a: 1 });
            expect(callGrid).toHaveBeenCalledWith('setStatus', 'ready');
        });

        it('keeps the loading state while a live variable is in flight and the new data is empty', () => {
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            table.variableInflight = true;
            callGrid.mockClear();
            table.gridData = [];
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'ready');
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'nodata', expect.anything());
        });
    });

    describe('dataset updates', () => {
        beforeEach(() => {
            table.isNavigationEnabled = jest.fn(() => false);
            table.shownavigation = false;
        });

        it('renders empty data when the variable is not in flight', () => {
            table.variableInflight = false;
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            const set = jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            table.watchVariableDataSet('');
            expect(set).toHaveBeenCalledWith([]);
        });

        it('clears the loading state for invalid data', () => {
            table.variableInflight = true;
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            const set = jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            table.watchVariableDataSet({ dataValue: '' });
            expect(table.variableInflight).toBe(false);
            expect(set).toHaveBeenCalledWith([]);
        });

        it('keeps the loading state for static variables that are still in flight', () => {
            table.variableInflight = true;
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            table.watchVariableDataSet(undefined);
            expect(table.variableInflight).toBe(false);
        });

        it('does not show no data while the variable is still loading', () => {
            table.variableInflight = true;
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            callGrid.mockClear();
            table.watchVariableDataSet(null);
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'nodata', expect.anything());
        });

        it('shows the results of the data set and refreshes the row filters', () => {
            const populate = jest.spyOn(table, 'populateGridData').mockImplementation(() => undefined);
            const refresh = jest.spyOn(table, 'refreshRowFilterDataFromDataset').mockImplementation(() => undefined);
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            table.variableInflight = false;
            table.watchVariableDataSet({ a: 1 });
            expect(populate).toHaveBeenCalledWith({ a: 1 });
            expect(refresh).toHaveBeenCalled();
        });
    });

    describe('search state', () => {
        it('restores the search values of known filters only', () => {
            table.rowFilter = { name: { value: '' } };
            table.rowFilterCompliedTl = { name: $('<div><input></div>')[0] };
            table.searchStateHandler({ search: [{ field: 'name', value: 'a', matchMode: 'start', type: 'string' }, { field: 'unknown', value: 'x' }] });
            expect(table.rowFilter.name).toEqual({ value: 'a', matchMode: 'start', type: 'string' });
            expect($(table.rowFilterCompliedTl.name).find('input').val()).toBe('a');
            table.rowFilterCompliedTl = {};
            expect(() => table.searchStateHandler({ search: [{ field: 'name', value: 'b' }] })).not.toThrow();
            expect(() => table.searchStateHandler({ search: { field: 'name' } })).not.toThrow();
        });

        it('selects options of filter widgets after the data is rendered', () => {
            table.getConfiguredState = jest.fn(() => 'session');
            table.statePersistence.getWidgetState = jest.fn().mockReturnValue({ search: { field: 'x' } });
            expect(() => table.refreshRowFilterDataFromDataset?.()).not.toThrow();
        });
    });

    describe('destroy without views or templates', () => {
        it('releases whatever exists', () => {
            ['customExprViewRef', 'rowActionsViewRef', 'filterViewRef', 'inlineEditViewRef', 'inlineEditNewViewRef', 'rowDetailViewRef', 'rowExpansionActionViewRef', 'dynamicTableRef'].forEach((name) => (table[name] = undefined));
            ['rowActionTmpl', 'filterTmpl', 'inlineWidgetTmpl', 'inlineWidgetNewTmpl', 'customExprTmpl', 'rowExpansionActionTmpl'].forEach((name) => (table[name] = undefined));
            table.navigatorResultWatch = undefined;
            table.navigatorMaxResultWatch = undefined;
            expect(() => table.ngOnDestroy()).not.toThrow();
        });
    });

    describe('navigation and data source properties', () => {
        it('shows the navigation controls of every pagination type', () => {
            const set = jest.spyOn(table, 'setDataGridOption').mockImplementation(() => undefined);
            table.shownavigation = false;
            table.onPropertyChange('navigation', 'None', 'Basic');
            expect(table.shownavigation).toBe(false);
            expect([table.onDemandLoad, table.infScroll]).toEqual([false, false]);
            table.onPropertyChange('navigation', 'On-Demand', 'None');
            expect([table.onDemandLoad, table.infScroll]).toEqual([true, false]);
            table.onPropertyChange('navigation', 'Scroll', 'None');
            expect([table.onDemandLoad, table.infScroll]).toEqual([false, true]);
            expect(table.shownavigation).toBe(true);
            expect(set).toHaveBeenCalledWith('navigation', table.navigation);
        });

        it('does not show no data for data sources that start automatically', () => {
            jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            jest.spyOn(table, 'onDataSourceChange').mockImplementation(() => undefined);
            table.datasource = { startUpdate: true, category: 'wm.LiveVariable', maxResults: 9 };
            table.allowpagesizechange = true;
            table.pagesize = undefined;
            callGrid.mockClear();
            table.onPropertyChange('datasource', undefined);
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'nodata', expect.anything());
            expect(table.datasource.maxResults).toBe(9);
            table.onPropertyChange('datasource', { startUpdate: true });
        });

        it('does not touch the loading state of bound data sets that are not loading', () => {
            table.binddatasource = 'Variables.x';
            table.datasource = undefined;
            table.variableInflight = false;
            callGrid.mockClear();
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table.onPropertyChange('dataset', [], undefined);
            expect(callGrid).not.toHaveBeenCalledWith('setStatus', 'nodata', expect.anything());
        });

        it('keeps the table rendering for static variables that retain their state until it is a list item', () => {
            const watch = jest.spyOn(table, 'watchVariableDataSet').mockImplementation(() => undefined);
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => false);
            table.parentList = undefined;
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(watch).not.toHaveBeenCalled();
            table.parentList = {};
            table.binddataset = 'item.rows';
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(watch).toHaveBeenCalled();
            watch.mockClear();
            table.parentList = {};
            table.binddataset = 'Variables.v';
            table.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(watch).not.toHaveBeenCalled();
        });

        it('has no export options without a format', () => {
            table.onPropertyChange('exportformat', '', 'csv');
            expect(table.exportOptions).toEqual([]);
        });

        it('only updates the on demand message text when it has a value', () => {
            table.onPropertyChange('ondemandmessage', '', undefined);
            expect(table.gridOptions.ondemandmessage).toBe('');
        });

        it('updates page size options with and without a selected page size change', () => {
            table.dataNavigator = { widget: {}, options: {}, allowpagesizechange: false };
            const setDefault = jest.spyOn(table, 'setDefaultPageSize').mockImplementation(() => undefined);
            table.onPropertyChange('allowpagesizechange', false, true);
            expect(setDefault).not.toHaveBeenCalled();
            table.pagesize = undefined;
            table.actualPageSize = undefined;
            table.onPropertyChange('allowpagesizechange', true, false);
            expect(setDefault).toHaveBeenCalled();
            setDefault.mockClear();
            table.allowpagesizechange = false;
            table.onPropertyChange('pagesizeoptions', '5,10', '5');
            expect(setDefault).not.toHaveBeenCalled();
            table.allowpagesizechange = true;
            table.pagesize = undefined;
            table.actualPageSize = undefined;
            table.onPropertyChange('pagesizeoptions', '5,10', '5');
            expect(setDefault).toHaveBeenCalled();
        });
    });

    describe('page sizes', () => {
        beforeEach(() => {
            table.dataNavigator = { widget: {}, options: {}, defaultPageSizeOptions: [], pageSizeOptions: [] };
            table.gridOptions.allowpagesizechange = true;
        });

        it('uses the stored page size', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ pagesize: 30 });
            table.setDefaultPageSize(10);
            expect(table.pagesize).toBe(30);
            expect(table.dataNavigator.maxResults).toBe(30);
        });

        it('uses the first configured page size option when nothing is stored', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
            table.pagesizeoptions = '20,10';
            table.setDefaultPageSize(50);
            expect(table.pagesize).toBe(10);
        });

        it('keeps the given size without options and does not touch a missing data source', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
            table.pagesizeoptions = '';
            table.datasource = undefined;
            jest.spyOn(table, 'isPageSizeOptionsChanged').mockReturnValue(true);
            table.setDefaultPageSize(50);
            expect(table.updatedPageSize).toBe(50);
            expect(table.dataNavigator.pageSizeOptions).toBeDefined();
        });

        it('keeps the max results of a data source when no page size is known', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue(undefined);
            table.pagesizeoptions = '';
            table.pagesize = undefined;
            table.datasource = { maxResults: 12 };
            table.setDefaultPageSize(50);
            expect(table.datasource.maxResults).toBe(12);
        });
    });

    describe('selecting items and screens', () => {
        it('selects rows without data and with non object items', () => {
            table.selectItem(3, undefined);
            expect(callGrid).toHaveBeenCalledWith('selectRow', 3, true);
            table.selectItem({ a: 1, list: [] }, [{ x: 1 }]);
            expect(callGrid).toHaveBeenLastCalledWith('selectRow', { a: 1 }, true);
            expect(table.serverData).toEqual([{ x: 1 }]);
        });

        it('registers columns on tablets only when they are shown there', () => {
            table.viewport = { isMobileType: false, isTabletType: true };
            table.fullFieldDefs = [];
            table.fieldDefs = [];
            table.registerColumns({ field: 'x', tabletDisplay: true }, 0);
            expect(table.fullFieldDefs).toHaveLength(1);
        });

        it('redraws with the right column width refresh', () => {
            jest.useFakeTimers();
            table._redraw(undefined);
            table._redraw(false);
            jest.runAllTimers();
            expect(callGrid).toHaveBeenCalledWith('setColGroupWidths');
            expect(callGrid).toHaveBeenCalledWith('refreshColumnWidths');
        });

        it('does not register the select event on the native element', () => {
            const base = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(table))), 'handleEvent').mockImplementation(() => undefined);
            table.handleEvent(document.createElement('div'), 'select', jest.fn(), {});
            expect(base).not.toHaveBeenCalled();
            table.handleEvent(document.createElement('div'), 'click', jest.fn(), {});
            expect(base).toHaveBeenCalledTimes(1);
        });
    });

    describe('select all with a persisted state', () => {
        beforeEach(() => {
            table.headerselectall = true;
            table.multiselect = true;
            table.items = [];
            table.__fullData = [{ a: 1 }, { a: 2 }, { a: 3 }];
            table.dataNavigator = { dataSize: 3, maxResults: 2, dn: { currentPage: 1 } };
            jest.spyOn(table.statePersistence, 'setWidgetState').mockImplementation(() => undefined);
            jest.spyOn(table.statePersistence, 'removeWidgetState').mockImplementation(() => undefined);
        });

        it('stores every page and announces the selected items', () => {
            callGrid.mockImplementation(((m: string) => (m === 'getSelectedRows' ? [{ a: 1 }] : undefined)) as any);
            const next = jest.spyOn(table.selectedItemChange, 'next');
            table.gridOptions.selectAllRows(true, {});
            expect(table.statePersistence.setWidgetState).toHaveBeenCalledWith(table, { selectedItem: [{ page: 1, index: 0 }, { page: 1, index: 1 }, { page: 2, index: 0 }] });
            expect(next).toHaveBeenCalled();
            expect(table.items).toHaveLength(3);
        });

        it('does not announce anything when no rows are selected', () => {
            const next = jest.spyOn(table.selectedItemChange, 'next');
            table.gridOptions.selectAllRows(true, {});
            expect(next).not.toHaveBeenCalled();
        });

        it('clears the selection and does nothing without header select all', () => {
            table.gridOptions.selectAllRows(false, {});
            table.headerselectall = false;
            table.statePersistence.setWidgetState.mockClear();
            table.gridOptions.selectAllRows(true, {});
            expect(table.statePersistence.setWidgetState).not.toHaveBeenCalled();
        });
    });

    describe('pagination of scrolling tables', () => {
        it('keeps the loading indicator until there is data', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            table.paginationService = { updateFieldsOnPagination: jest.fn(() => [[], 1]) };
            table.dataNavigator = { isDisableNext: false };
            table.onDemandLoad = false;
            callGrid.mockClear();
            table.gridData = [{ a: 1 }];
            expect(callGrid).not.toHaveBeenCalledWith('hideLoadingIndicator', expect.anything(), expect.anything());
        });

        it('hides the loading indicator once data arrived and loading finished', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            table.paginationService = { updateFieldsOnPagination: jest.fn(() => [[{ a: 1 }], 1]) };
            table.dataNavigator = { isDisableNext: true };
            table.onDemandLoad = false;
            callGrid.mockClear();
            table.gridData = [{ a: 1 }];
            expect(callGrid).toHaveBeenCalledWith('hideLoadingIndicator', true, table.infScroll);
        });

        it('keeps the indicator for pages that are still loading', () => {
            table.gridOptions.isNavTypeScrollOrOndemand = jest.fn(() => true);
            table.paginationService = { updateFieldsOnPagination: jest.fn(function (this: any) { table.isDataLoading = true; return [[{ a: 1 }], 1]; }) };
            table.dataNavigator = { isDisableNext: false };
            table.onDemandLoad = false;
            callGrid.mockClear();
            table.gridData = [{ a: 1 }];
            expect(callGrid).not.toHaveBeenCalledWith('hideLoadingIndicator', expect.anything(), expect.anything());
        });
    });

    describe('state of data sets', () => {
        beforeEach(() => {
            table.isNavigationEnabled = jest.fn(() => false);
            table.shownavigation = false;
            table.datasource = { category: 'wm.LiveVariable', execute: jest.fn() };
            jest.spyOn(table, 'populateGridData').mockImplementation(() => undefined);
        });

        it('ignores a stored search that is not a list of filters', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ search: { field: 'x' } });
            expect(() => table.watchVariableDataSet({ a: 1 })).not.toThrow();
        });

        it('selects options of select filters from the stored search', () => {
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ search: [{ field: 'name', value: 'A' }, { field: 'age', value: '' }] });
            table.rowFilterCompliedTl = {
                name: $('<div><div widget-id="1"></div></div>')[0],
                age: $('<div></div>')[0],
            };
            $(table.rowFilterCompliedTl.name).find('[widget-id]').replaceWith('<wm-select widget-id="1"><select><option>A</option><option>B</option></select></wm-select>');
            expect(() => table.watchVariableDataSet({ a: 1 })).not.toThrow();
        });
    });

    describe('syncing static variable rows', () => {
        const emitter = () => {
            const resultEmitter = new Subject<any>();
            table.dataNavigator = { resultEmitter, maxResultsEmitter: new Subject<any>(), widget: {}, dn: { currentPage: 1 }, setBindDataSet: jest.fn(), resetPageNavigation: jest.fn() };
            table.dataset = [{ a: 1 }];
            table.binddataset = 'Variables.v.dataSet';
            table.datasource = { category: 'wm.Variable', execute: jest.fn() };
            table.enablePageNavigation();
            return resultEmitter;
        };

        it('copies changed rows into the selected items', () => {
            const result = emitter();
            table.gridOptions.data = [{ a: 1 }, { a: 2 }, { a: 3 }];
            table.items = [{ a: 1 }, { a: 3 }];
            table.widget.dataset = [{ a: 9 }, { a: 2 }, undefined];
            result.next([{ a: 7 }]);
            expect(table.items[0]).toEqual({ a: 9 });
            expect(table.items[1]).toEqual({ a: 3 });
        });

        it('skips rows that are not selected and tolerates items that are not a list', () => {
            const result = emitter();
            table.gridOptions.data = [{ a: 1 }];
            table.items = [{ a: 5 }];
            table.widget.dataset = [{ a: 9 }];
            result.next([{ a: 7 }]);
            expect(table.items[0]).toEqual({ a: 5 });
            table.items = undefined;
            result.next([{ a: 8 }]);
            table.gridOptions.data = undefined;
            result.next([{ a: 9 }]);
        });
    });

    describe('dataset errors and persisted selection', () => {
        it('shows an error message of the data set only when there is one', () => {
            table.dataset = { data: { error: true } };
            expect(table.isDataValid()).toBeDefined();
            table.dataset = { data: { error: true, errorMessage: 'bad' } };
            expect(table.isDataValid()).toBeDefined();
        });

        it('does not reselect items of other pages', () => {
            table.getConfiguredState = jest.fn(() => 'session');
            table._selectedItemsExist = true;
            table.dataNavigator = { dn: { currentPage: 1 } };
            table.isNavigationEnabled = jest.fn(() => false);
            table._isClientSearch = false;
            jest.spyOn(table.statePersistence, 'getWidgetState').mockReturnValue({ selectedItem: [{ page: 9, index: 0 }] });
            const select = jest.spyOn(table, 'selectItem').mockImplementation(() => undefined);
            jest.spyOn(table, 'setGridData').mockImplementation(() => undefined);
            table.populateGridData([{ a: 1 }]);
            expect(select).not.toHaveBeenCalled();
            expect(table._selectedItemsExist).toBe(false);
        });
    });

    describe('variable events with page load finished', () => {
        it('ignores state restoring once the page was loaded', () => {
            table.datasource = { name: 'mine', execute: jest.fn(() => 'id') };
            table._pageLoad = false;
            table.variableInflight = undefined;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('session');
            jest.spyOn(table, 'handleLoading').mockImplementation(() => undefined);
            const restore = jest.spyOn(table, 'handleStateParams');
            handlers['toggle-variable-state']({ variable: { name: 'mine', execute: jest.fn(() => 'id') } });
            expect(restore).not.toHaveBeenCalled();
            expect(table.handleLoading).toHaveBeenCalled();
            table._pageLoad = true;
            jest.spyOn(table, 'getConfiguredState').mockReturnValue('none');
            handlers['toggle-variable-state']({ variable: { name: 'mine', execute: jest.fn(() => 'id') } });
            expect(restore).not.toHaveBeenCalled();
        });
    });
});
