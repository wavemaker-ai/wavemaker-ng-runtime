import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/compiler';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { App, DataSource } from '@wm/core';
import { WidgetRef } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { PaginationComponent } from './pagination.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    adjustVerticalPosition: jest.fn(),
    $appDigest: jest.fn(),
    $watch: jest.fn(() => jest.fn()),
}));

import * as core from '@wm/core';

describe('PaginationComponent - extra behaviour', () => {
    let fixture: ComponentFixture<PaginationComponent>;
    let component: any;
    let parent: any;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent, FormsModule, ReactiveFormsModule],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: WidgetRef, useValue: { widget: {}, parent: { statePersistence: { computeMode: jest.fn(), removeWidgetState: jest.fn(), setWidgetState: jest.fn() } } } },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(PaginationComponent);
        component = fixture.componentInstance;
        component.dn = { currentPage: 1 };
        component.navigation = 'Basic';
        component.navcontrols = 'Basic';
        component.maxResults = 10;
        component.dataSize = 100;
        component.pageCount = 10;
        component.nativeElement = document.createElement('div');
        parent = {
            statePersistence: {
                computeMode: jest.fn().mockReturnValue('none'),
                removeWidgetState: jest.fn(),
                setWidgetState: jest.fn(),
                getWidgetState: jest.fn().mockReturnValue(undefined),
            },
            invokeEventCallback: jest.fn(),
            getActualPageSize: jest.fn().mockReturnValue(5),
            widgetType: 'wm-list',
            nativeElement: document.createElement('div'),
        };
        component.parent = parent;
        (core.$watch as jest.Mock).mockClear();
        jest.spyOn(component, 'invokeEventCallback').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('paging values', () => {
        it('computes the page count from the data size and page size', () => {
            component.dataSize = 95;
            component.maxResults = 10;
            component.calculatePagingValues();
            expect(component.pageCount).toBe(10);
            component.dataSize = 5;
            component.calculatePagingValues();
            expect(component.pageCount).toBe(1);
            component.dataSize = -1;
            component.calculatePagingValues();
            expect(component.pageCount).toBe(0);
            component.dn.currentPage = 0;
            component.calculatePagingValues();
            expect(component.dn.currentPage).toBe(1);
        });

        it('resets to a single page when no size is known and emits the page size otherwise', () => {
            const emit = jest.spyOn(component.maxResultsEmitter, 'emit');
            component.setDefaultPagingValues(0, 0, 3);
            expect(component.pageCount).toBe(1);
            expect(component.dn.currentPage).toBe(1);

            component.setDefaultPagingValues(50, 10, 2);
            expect(component.pageCount).toBe(5);
            expect(component.dn.currentPage).toBe(2);
            expect(emit).toHaveBeenLastCalledWith(10);
        });

        it('keeps the current values when only some are given', () => {
            component.setDefaultPagingValues(50, undefined, undefined);
            expect(component.maxResults).toBe(10);
            expect(component.dataSize).toBe(50);
            component.setDefaultPagingValues(undefined, 20, undefined);
            expect(component.maxResults).toBe(20);
            expect(component.dataSize).toBe(50);
        });
    });

    describe('navigation state', () => {
        it('disables first and previous on the first page and next and last on the last page', () => {
            component.pagination = undefined;
            component.dn.currentPage = 1;
            component.pageCount = 5;
            component.disableNavigation();
            expect(component.isDisableFirst).toBe(true);
            expect(component.isDisablePrevious).toBe(true);
            expect(component.isDisableNext).toBe(false);
            expect(component.isDisableCurrent).toBe(false);

            component.dn.currentPage = 5;
            component.disableNavigation();
            expect(component.isDisableNext).toBe(true);
            expect(component.isDisableLast).toBe(true);
            expect(component.isDisableFirst).toBe(false);

            component.pageCount = 1;
            component.dn.currentPage = 1;
            component.disableNavigation();
            expect(component.isDisableCurrent).toBe(true);
        });

        it('follows the prev and next flags of cursor pagination', () => {
            component.pagination = { next: 'n', prev: undefined };
            component.disableNavigation();
            expect(component.isDisablePrevious).toBe(true);
            expect(component.isDisableNext).toBe(false);
            component.pagination = { next: undefined };
            component.pagination = { next: 'x', prev: 'p' };
            component.disableNavigation();
            expect(component.isDisableFirst).toBe(false);
        });

        it('hides the loading indicator of a table when its last page is reached', () => {
            const callGrid = jest.fn();
            component.parent = { ...parent, onDemandLoad: true, widgetType: 'wm-table', infScroll: true, callDataGridMethod: callGrid };
            component.dataset = [1];
            component.pagination = undefined;
            component.dn.currentPage = 5;
            component.pageCount = 5;
            component.disableNavigation();
            expect(callGrid).toHaveBeenCalledWith('hideLoadingIndicator', true, true);
        });

        it('knows the first and last page', () => {
            component.dn.currentPage = 1;
            component.pageCount = 3;
            expect(component.isFirstPage()).toBe(true);
            expect(component.isLastPage()).toBe(false);
            component.dn.currentPage = 3;
            expect(component.isLastPage()).toBe(true);
            component.dn.currentPage = undefined;
            expect(component.isFirstPage()).toBe(true);
        });

        it('asks the data source whether it pages', () => {
            component.datasource = { execute: jest.fn().mockReturnValue(true) };
            expect(component.isDataSourceHasPaging()).toBe(true);
            expect(component.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.IS_PAGEABLE);
            component.datasource = undefined;
            expect(component.isDataSourceHasPaging()).toBeUndefined();
        });
    });

    describe('page navigation', () => {
        let goToPage: jest.SpyInstance;

        beforeEach(() => {
            goToPage = jest.spyOn(component, 'goToPage').mockImplementation(() => undefined);
            component.pageCount = 5;
        });

        it('goes to the first page only when needed or refreshed', () => {
            component.dn.currentPage = 3;
            component.goToFirstPage(false, 'e', undefined);
            expect(component.dn.currentPage).toBe(1);
            expect(goToPage).toHaveBeenCalledTimes(1);
            component.goToFirstPage(false, 'e', undefined);
            expect(goToPage).toHaveBeenCalledTimes(1);
            component.goToFirstPage(true, 'e', undefined);
            expect(goToPage).toHaveBeenCalledTimes(2);
        });

        it('goes to the last page only when needed or refreshed', () => {
            component.dn.currentPage = 1;
            component.goToLastPage(false, 'e', undefined);
            expect(component.dn.currentPage).toBe(5);
            component.goToLastPage(false, 'e', undefined);
            expect(goToPage).toHaveBeenCalledTimes(1);
            component.goToLastPage(true, 'e', undefined);
            expect(goToPage).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['next', 2, 3],
            ['prev', 3, 2],
        ])('moves %s from page %i to page %i', (direction, from, to) => {
            component.dn.currentPage = from;
            component.navigatePage(direction, 'e');
            expect(component.dn.currentPage).toBe(to);
            expect(goToPage).toHaveBeenCalled();
        });

        it('stays put at the boundaries', () => {
            component.dn.currentPage = 1;
            component.navigatePage('prev', 'e');
            component.dn.currentPage = 5;
            component.navigatePage('next', 'e');
            expect(goToPage).not.toHaveBeenCalled();
        });

        it('delegates first and last to the dedicated methods', () => {
            const first = jest.spyOn(component, 'goToFirstPage').mockImplementation(() => undefined);
            const last = jest.spyOn(component, 'goToLastPage').mockImplementation(() => undefined);
            component.navigatePage('first', 'e', true, 'cb');
            component.navigatePage('last', 'e', false, 'cb');
            expect(first).toHaveBeenCalledWith(true, 'e', 'cb');
            expect(last).toHaveBeenCalledWith(false, 'e', 'cb');
        });

        it('does nothing for unknown directions except refreshing the current page', () => {
            component.navigatePage('current', 'e');
            expect(goToPage).toHaveBeenCalled();
        });

        it('tracks the cursor direction of server side pagination', () => {
            component.pagination = { next: 'n', prev: 'p' };
            component.datasource = { pagination: {} };
            component.navigatePage('next', 'e');
            expect(component.datasource.pagination).toEqual({ isNext: true, isPrev: false });
            component.navigatePage('prev', 'e');
            expect(component.datasource.pagination).toEqual({ isNext: false, isPrev: true });
            component.navigatePage('first', 'e');
            expect(component.datasource.pagination).toEqual({ isNext: false, isPrev: false });
        });

        it('shows the loading indicator while navigating in scrolling tables', () => {
            const callGrid = jest.fn();
            const gridOptions = { isNavTypeScrollOrOndemand: () => true, setLastActionPerformed: jest.fn(), setIsDatasetUpdated: jest.fn(), ACTIONS: { DEFAULT: 'default' } };
            component.parent = { ...parent, widgetType: 'wm-table', isDataLoading: false, infScroll: true, loadingdatamsg: 'Loading', callDataGridMethod: callGrid, gridOptions };
            component.isDisableNext = false;
            component.dn.currentPage = 2;
            component.navigatePage('next', 'e');
            expect(component.parent.isDataLoading).toBe(true);
            expect(component.parent.variableInflight).toBe(true);
            expect(callGrid).toHaveBeenCalledWith('showLoadingIndicator', 'Loading', true);
            expect(gridOptions.setLastActionPerformed).toHaveBeenCalledWith('default');
            expect(gridOptions.setIsDatasetUpdated).toHaveBeenCalledWith(false);
        });

        it('validates the typed page number', () => {
            component.dn.currentPage = 0;
            expect(component.validateCurrentPage('e')).toBe(false);
            expect(component.dn.currentPage).toBe(1);
            component.dn.currentPage = 9;
            expect(component.validateCurrentPage('e')).toBe(false);
            expect(component.dn.currentPage).toBe(5);
            component.dn.currentPage = NaN;
            expect(component.validateCurrentPage('e')).toBe(false);
            component.dn.currentPage = 2;
            expect(component.validateCurrentPage('e')).toBe(true);
            expect(component.validateCurrentPage(undefined)).toBe(true);
        });

        it('navigates after a valid page number was typed', () => {
            component.dn.currentPage = 2;
            component.onModelChange('e');
            expect(goToPage).toHaveBeenCalledTimes(1);
            goToPage.mockClear();
            component.dn.currentPage = -1;
            component.onModelChange('e');
            expect(goToPage).toHaveBeenCalledTimes(1);
        });

        it('rejects the exponent key in the page input', () => {
            const target = $('<a><input></a>').find('input');
            const stop = component.onKeyDown({ code: 'KeyE', target: target[0] });
            expect(stop).toBe(false);
            expect(target.closest('a').hasClass('ng-invalid')).toBe(true);
            expect(component.onKeyDown({ code: 'Digit1', target: target[0] })).toBe(true);
            expect(target.closest('a').hasClass('ng-invalid')).toBe(false);
        });
    });

    describe('goToPage and data', () => {
        beforeEach(() => {
            jest.spyOn(component, 'getPageData').mockImplementation(() => undefined);
            component.maxResults = 10;
            component.parent.name = 'p1';
            component.parent.navigation = 'Basic';
        });

        it('removes the stored page when the first page is shown', () => {
            parent.statePersistence.computeMode.mockReturnValue('SESSION');
            component.dn.currentPage = 1;
            component.goToPage('e');
            expect(parent.statePersistence.removeWidgetState).toHaveBeenCalledWith(parent, 'pagination');
            expect(parent._selectedItemsExist).toBe(true);
            expect(parent.nativeElement.getAttribute('currentpage')).toBe('1');
        });

        it('stores the page and the page size', () => {
            parent.statePersistence.computeMode.mockReturnValue('SESSION');
            parent.allowpagesizechange = true;
            component.dn.currentPage = 3;
            component.goToPage('e');
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, { pagination: 3, pagesize: 10 });
            expect(component.firstRow).toBe(20);
        });

        it('warns for navigation types whose state cannot be stored', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            parent.statePersistence.computeMode.mockReturnValue('SESSION');
            parent.navigation = 'Scroll';
            component.dn.currentPage = 3;
            component.goToPage('e');
            expect(warn).toHaveBeenCalled();
            expect(parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
        });

        it('leaves the state alone when persistence is off or for other widgets', () => {
            component.dn.currentPage = 3;
            component.goToPage('e');
            parent.statePersistence.computeMode.mockReturnValue('SESSION');
            parent.widgetType = 'wm-other';
            component.goToPage('e');
            expect(parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
            expect(component.getPageData).toHaveBeenCalledTimes(2);
        });

        it('reports the page data as ready and calls the callback', () => {
            const callback = jest.fn();
            jest.spyOn(component, 'invokeSetRecord').mockImplementation(() => undefined);
            component.onPageDataReady('e', [1], callback);
            expect(component.invokeSetRecord).toHaveBeenCalledWith('e', [1]);
            expect(callback).toHaveBeenCalled();
        });

        it('slices the page of client side data', () => {
            (component.getPageData as jest.Mock).mockRestore();
            const setResult = jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            const details = jest.spyOn(component, 'getPageDetails').mockImplementation(() => undefined);
            jest.spyOn(component, 'onPageDataReady').mockImplementation(() => undefined);
            component.datasource = undefined;
            component.__fullData = Array.from({ length: 25 }, (_, i) => i);
            component.dn.currentPage = 2;
            component.getPageData('e', undefined);
            expect(setResult).toHaveBeenCalledWith([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
            expect(details).toHaveBeenCalledWith(11, 20, 25);
        });

        it('uses the page of an edit that happened on an earlier page of a table', () => {
            (component.getPageData as jest.Mock).mockRestore();
            const setResult = jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            jest.spyOn(component, 'getPageDetails').mockImplementation(() => undefined);
            jest.spyOn(component, 'onPageDataReady').mockImplementation(() => undefined);
            component.parent = { ...parent, widgetType: 'wm-table', currentPage: 3, actionRowPage: 1 };
            component.datasource = undefined;
            component.__fullData = Array.from({ length: 40 }, (_, i) => i);
            component.dn.currentPage = 3;
            expect(component.isEditNotInCurrentPage()).toBe(true);
            component.getPageData('e', undefined);
            expect(setResult).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        it('requests the page from a pageable data source', async () => {
            (component.getPageData as jest.Mock).mockRestore();
            jest.spyOn(component, 'onPageDataReady').mockImplementation(() => undefined);
            jest.spyOn(component, 'getPageDetails').mockImplementation(() => undefined);
            const execute = jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : Promise.resolve({ data: [1, 2] })));
            component.datasource = { execute };
            component.filterFields = { a: 1 };
            component.sortOptions = 'name';
            component.logicalOp = 'AND';
            component.pagination = { numberOfElements: 2, totalElements: 20 };
            component.dn.currentPage = 3;
            jest.spyOn(component, 'getPaginationStartIndex').mockReturnValue(1);
            component.getPageData('e', undefined);
            await Promise.resolve();
            await Promise.resolve();
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, {
                page: 3, size: 10, filterFields: { a: 1 }, orderBy: 'name', logicalOp: 'AND', matchMode: 'anywhereignorecase',
            });
            expect(component.onPageDataReady).toHaveBeenCalledWith('e', [1, 2], undefined);
        });

        it('ignores errors of discarded page requests', async () => {
            (component.getPageData as jest.Mock).mockRestore();
            const execute = jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : Promise.reject(undefined)));
            component.datasource = { execute };
            jest.spyOn(component, 'getPaginationStartIndex').mockReturnValue(1);
            expect(() => component.getPageData('e', undefined)).not.toThrow();
            await Promise.resolve();
            await Promise.resolve();
        });

        it('passes the page information on to the setrecord event', () => {
            component.dataSize = 100;
            component.pageCount = 10;
            component.dn.currentPage = 2;
            component.invokeSetRecord('e', [1]);
            expect(parent.invokeEventCallback).toHaveBeenCalledWith('setrecord', expect.objectContaining({
                $index: 2, pageInfo: { currentPage: 2, size: 10, totalElements: 100, totalPages: 10 },
            }));

            component.parent = undefined;
            component.invokeSetRecord('e', [2]);
            expect(component.invokeEventCallback).toHaveBeenCalledWith('setrecord', expect.objectContaining({ $data: [2] }));
        });
    });

    describe('binding to a dataset', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.spyOn(component, 'registerDestroyListener').mockImplementation(() => undefined);
            component._debouncedApplyDataset = jest.fn();
        });

        it('uses a static dataset directly', () => {
            component.setBindDataSet('item.rows', parent, undefined, [1, 2], undefined, undefined, 'session');
            expect(component.dataset).toEqual([1, 2]);
            expect(component._debouncedApplyDataset).toHaveBeenCalled();
            expect(component.statehandler).toBe('session');
            expect(component.binddataset).toBeUndefined();
        });

        it('watches the bound dataset and the paging options of variables', () => {
            const ds = {};
            component.setBindDataSet('Variables.users.dataSet', parent, ds);
            jest.runAllTimers();
            const calls = (core.$watch as jest.Mock).mock.calls;
            expect(calls[0][0]).toBe('Variables.users.dataSet');
            expect(calls[1][0]).toBe('Variables.users.pagination');
            expect(component.datasource).toBe(ds);

            calls[0][3]([1]);
            expect(component.dataset).toEqual([1]);
            expect(component._debouncedApplyDataset).toHaveBeenCalledTimes(1);
            calls[0][3](undefined);
            expect(component.widget.dataset).toBeUndefined();
            calls[1][3]();
            expect(component._debouncedApplyDataset).toHaveBeenCalledTimes(2);
        });

        it('builds the paging expression for widget and active page variables', () => {
            component.setBindDataSet('Widgets.list1.dataset', parent, {});
            component.setBindDataSet('App.activePage.Variables.users.dataSet', parent, {});
            component.setBindDataSet('item.field', parent, {}, undefined, undefined, 'item.field');
            jest.runAllTimers();
            const names = (core.$watch as jest.Mock).mock.calls.map((c) => c[0]);
            expect(names).toContain('Widgets.list1.pagination');
            expect(names).toContain('App.activePage.Variables.users.pagination');
        });

        it('does not take the data source over for item bound datasets', () => {
            component.datasource = undefined;
            component.setBindDataSet('item.field', parent, { id: 1 }, undefined, undefined, 'item.field');
            expect(component.datasource).toBeUndefined();
        });

        it('switches the data source', () => {
            component.setDataSource('ds');
            expect(component.datasource).toBe('ds');
        });
    });

    describe('page size', () => {
        it('normalizes page size options from lists and strings', () => {
            expect(component.normalizeToNumberArray(undefined)).toEqual([]);
            expect(component.normalizeToNumberArray('10, 20,30')).toEqual([10, 20, 30]);
            expect(component.normalizeToNumberArray([10, '20'])).toEqual([10, 20]);
            expect(component.normalizeToNumberArray('[10,20]')).toEqual([10, 20]);
        });

        it('maps the stored selection to the new page size', () => {
            expect(component.handleStateParamsforNewPageSize([{ page: 2, index: 3 }], 10, 5)).toEqual([{ page: 3, index: 3 }]);
            expect(component.handleStateParamsforNewPageSize([{ page: 1, index: 4 }], 5, 10)).toEqual([{ page: 1, index: 4 }]);
        });

        it('stores the new page size and returns to the first page', () => {
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined);
            component.datasource = { execute: jest.fn().mockReturnValue(true), maxResults: 10 };
            parent.statePersistence.getWidgetState.mockReturnValue({ selectedItem: [{ page: 1, index: 5 }] });
            component.actualPageSize = undefined;
            component.onPageSizeChange({ stopPropagation: jest.fn() }, '5');
            expect(component.maxResults).toBe(5);
            expect(component.datasource.maxResults).toBe(5);
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, {
                pagination: 1, pagesize: 5, actualpagesize: 10, selectedItem: [{ page: 2, index: 0 }],
            });
            expect(component.navigatePage).toHaveBeenCalledWith('first', expect.anything(), true);
        });

        it('stores the page size without selected items', () => {
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined);
            component.actualPageSize = 10;
            component.onPageSizeChange({ stopPropagation: jest.fn() }, 20);
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, { pagination: 1, pagesize: 20, actualpagesize: 10 });
        });

        it('hides the dropdown when the paginator is inside a popover', () => {
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined);
            const popover = document.createElement('div');
            popover.className = 'popover';
            popover.appendChild(component.nativeElement);
            const hide = jest.fn();
            component.bsDropdown = { hide };
            const stopPropagation = jest.fn();
            component.onPageSizeChange({ stopPropagation }, 10);
            expect(stopPropagation).toHaveBeenCalled();
            expect(hide).toHaveBeenCalled();
        });
    });

    describe('dropdown handling', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            component.pageSizeOptions = [5, 10, 20];
            component.focusedIndex = 0;
        });

        const key = (k: string, extra: any = {}) => ({ key: k, preventDefault: jest.fn(), ...extra });

        it.each([
            ['ArrowDown', {}, 0, 1],
            ['ArrowDown', {}, 2, 0],
            ['Tab', {}, 1, 2],
            ['Tab', { shiftKey: true }, 1, 0],
            ['Tab', { shiftKey: true }, 0, 2],
            ['ArrowUp', {}, 1, 0],
            ['ArrowUp', {}, 0, 2],
        ])('%s moves the focus %j from %i to %i', (name, extra, from, to) => {
            const event = key(name, extra);
            component.onDropdownKeydown(event, from);
            expect(component.focusedIndex).toBe(to);
            expect(event.preventDefault).toHaveBeenCalled();
            jest.runAllTimers();
        });

        it('selects the focused option on enter and closes the dropdown', () => {
            const change = jest.spyOn(component, 'onPageSizeChange').mockImplementation(() => undefined);
            const close = jest.spyOn(component, 'closeDropdown').mockImplementation(() => undefined);
            component.focusedIndex = 2;
            component.onDropdownKeydown(key('Enter'), 2);
            expect(change).toHaveBeenCalledWith(expect.anything(), 20);
            expect(close).toHaveBeenCalled();
        });

        it('closes on escape and ignores other keys', () => {
            const close = jest.spyOn(component, 'closeDropdown').mockImplementation(() => undefined);
            component.onDropdownKeydown(key('Escape'), 0);
            expect(close).toHaveBeenCalledTimes(1);
            component.onDropdownKeydown(key('a'), 0);
            expect(close).toHaveBeenCalledTimes(1);
        });

        it('adjusts the position of the dropdown and listens for scrolling while it is open', () => {
            const container = document.createElement('div');
            container.innerHTML = '<ul id="dropdown-basic"></ul>';
            component.bsDropdown = { _dropdown: {} };
            const add = jest.spyOn(window, 'addEventListener');
            const remove = jest.spyOn(window, 'removeEventListener');
            component.onDropDownShown({ _element: { nativeElement: container } });
            expect(add).toHaveBeenCalledWith('scroll', component.dropdownScrollHandler, true);
            expect(() => component.dropdownScrollHandler()).not.toThrow();

            component.onDropdownHidden();
            expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
            expect(component.dropdownScrollHandler).toBeUndefined();
            component.onDropDownShown(undefined);
        });

        describe('adjustMenuVerticalPosition', () => {
            let container: HTMLElement;
            let menu: HTMLElement;
            let raf: jest.SpyInstance;
            let frame: () => void;

            beforeEach(() => {
                container = document.createElement('div');
                container.innerHTML = '<ul id="dropdown-basic" style="position:absolute; top:0px"></ul>';
                document.body.appendChild(container);
                menu = container.querySelector('ul');
                Object.defineProperty(menu, 'offsetHeight', { value: 100, configurable: true });
                menu.getBoundingClientRect = () => ({ top: 770, bottom: 870 } as DOMRect);
                const parentEl = document.createElement('div');
                parentEl.getBoundingClientRect = () => ({ top: 700, bottom: 750, height: 50 } as DOMRect);
                jest.spyOn(component.nativeElement, 'querySelector').mockReturnValue(parentEl);
                Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
                raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => { frame = () => cb(0); return 1; });
            });

            afterEach(() => {
                raf.mockRestore();
                container.remove();
            });

            it('waits until the container is positioned, then moves the menu above the button', () => {
                component.adjustMenuVerticalPosition(container);
                expect(menu.style.top).toBe('0px');
                container.style.transform = 'translate3d(0px, 700px, 0px)'; // positioned by ngx-bootstrap
                frame();
                expect(menu.style.top).toBe('-172px'); // 700 - 2 - 870
            });

            it('leaves the menu alone when there is room below', () => {
                Object.defineProperty(menu, 'offsetHeight', { value: 10, configurable: true });
                container.style.transform = 'translate3d(0px, 700px, 0px)'; // positioned by ngx-bootstrap
                component.adjustMenuVerticalPosition(container);
                expect(menu.style.top).toBe('0px');
            });

            it('stops waiting after 60 frames and positions the menu anyway', () => {
                component.adjustMenuVerticalPosition(container);
                for (let i = 0; i < 60; i++) {
                    frame();
                }
                expect(raf).toHaveBeenCalledTimes(60);
                expect(menu.style.top).toBe('-172px');
            });

            it('never moves the menu above the top of the viewport', () => {
                const nearTop = document.createElement('div');
                nearTop.getBoundingClientRect = () => ({ top: 101, bottom: 151, height: 50 } as DOMRect);
                component.nativeElement.querySelector.mockReturnValue(nearTop);
                Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
                menu.getBoundingClientRect = () => ({ top: 151, bottom: 251 } as DOMRect);
                container.style.transform = 'translate3d(0px, 700px, 0px)'; // positioned by ngx-bootstrap
                component.adjustMenuVerticalPosition(container);
                expect(menu.style.top).toBe('-151px'); // clamped: 101 - 2 - 251 = -152 would put the menu 1px above the viewport
            });
        });
    });

    describe('property changes and lifecycle', () => {
        it('maps the navigation type and size', () => {
            component.onPropertyChange('navigation', 'Advanced', 'Basic');
            expect(component.navigation).toBe('Classic');
            expect(component.navcontrols).toBe('Advanced');
            component.navcontrols = 'Basic';
            component.navigationsize = 'large';
            component.onPropertyChange('navigationsize', 'large', 'small');
            expect(component.navigationClass).toBe('pagination-lg');
        });

        it('aligns the navigation', () => {
            component.onPropertyChange('navigationalign', 'center', 'left');
            expect(component.nativeElement).toBeDefined();
        });

        it('recomputes the paging values when the page size changes', () => {
            const paging = jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.dataset = [1, 2];
            component.onPropertyChange('maxResults', 5, 10);
            expect(paging).toHaveBeenCalledWith([1, 2]);
        });

        it('distributes a new dataset and derives the page size options', () => {
            const paging = jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.parent.widgetType = 'wm-table';
            component.parent._triggeredByUser = true;
            component.datasource = undefined;
            component.defaultPageSizeOptions = [];
            component.onPropertyChange('dataset', [1, 2, 3], undefined);
            expect(component.parent._triggeredByUser).toBe(false);
            expect(component.pageSizeOptions).toEqual([5]);
            expect(paging).toHaveBeenCalledWith([1, 2, 3]);
        });

        it('prefers the configured page size options for a dataset', () => {
            jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.defaultPageSizeOptions = [10, 20];
            component.datasource = undefined;
            component.onPropertyChange('dataset', [1], undefined);
            expect(component.pageSizeOptions).toEqual([10, 20]);
        });

        it('uses the page size of a pageable data source', () => {
            jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.datasource = { execute: jest.fn().mockReturnValue(true), pagination: { size: 5, totalElements: 20 }, dataSet: {} };
            component.defaultPageSizeOptions = [];
            parent.statePersistence.getWidgetState.mockReturnValue({ actualpagesize: 5 });
            component.onPropertyChange('dataset', [1], undefined);
            expect(component.actualPageSize).toBe(5);
            expect(component.pageSizeOptions).toEqual([5, 10, 15, 20]);
        });

        it('only shows the result for datasets on earlier pages of tables', () => {
            const paging = jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            const setResult = jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            jest.spyOn(component, 'isEditNotInCurrentPage').mockReturnValue(true);
            component.datasource = undefined;
            component.defaultPageSizeOptions = [];
            component.onPropertyChange('dataset', [1], undefined);
            expect(setResult).toHaveBeenCalledWith([1]);
            expect(paging).not.toHaveBeenCalled();
        });

        it('lets the parent map the dataset before it is used', () => {
            jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.parent.onDataNavigatorDataSetChange = jest.fn().mockReturnValue([9]);
            component.datasource = undefined;
            component.defaultPageSizeOptions = [];
            component.onPropertyChange('dataset', [1], undefined);
            expect(component.setPagingValues).toHaveBeenCalledWith([9]);
        });

        it('stops event propagation of clicks on the paginator', () => {
            component.ngAfterViewInit();
            const stop = jest.fn();
            component.nativeElement.onclick({ stopPropagation: stop } as any);
            expect(stop).toHaveBeenCalled();
        });

        it('releases everything when destroyed', () => {
            const remove = jest.spyOn(window, 'removeEventListener');
            component.dropdownScrollHandler = jest.fn();
            component._initTimeoutId = setTimeout(() => undefined, 1000);
            component.pageSizeOptions = [1];
            component.defaultPageSizeOptions = [1];
            component.ngOnDestroy();
            expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
            expect(component.parent).toBeNull();
            expect(component.datasource).toBeNull();
            expect(component.pageSizeOptions).toEqual([]);
            expect(component.defaultPageSizeOptions).toEqual([]);
            expect(component.dataset).toBeNull();
        });
    });

    describe('aria attributes', () => {
        it('marks the active and disabled pages of the basic navigation', () => {
            const nav = document.createElement('div');
            nav.innerHTML = `
                <a><span data-isacitvepage="true"></span></a>
                <a><span data-isdisabled="true"></span></a>
                <a aria-disabled="true"><span></span></a>`;
            component.nativeElement = nav;
            component._setAriaForBasicNavigation();
            const links = nav.querySelectorAll('a');
            expect(links[0].getAttribute('aria-current')).toBe('true');
            expect(links[1].getAttribute('aria-disabled')).toBe('true');
            expect(links[2].hasAttribute('aria-disabled')).toBe(false);
            expect(links[0].getAttribute('href')).toContain('javascript');
        });

        it('applies the page change after the debounce time only when it changed', async () => {
            const wait = () => new Promise((resolve) => setTimeout(resolve, 700));
            jest.spyOn(component, 'goToPage').mockImplementation(() => undefined);
            const aria = jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);
            component.dn.currentPage = 1;
            component.pageChanged({ page: 1 });
            await wait();
            expect(component.goToPage).not.toHaveBeenCalled();

            component.pageChanged({ page: 4, pagesize: 5 });
            await wait();
            expect(component.dn.currentPage).toBe(4);
            expect(component.maxResults).toBe(5);
            expect(component.goToPage).toHaveBeenCalled();
            expect(aria).toHaveBeenCalled();
            expect(parent.invokeEventCallback).toHaveBeenCalledWith('paginationchange', { $event: undefined, $index: 4 });
        });
    });
});
