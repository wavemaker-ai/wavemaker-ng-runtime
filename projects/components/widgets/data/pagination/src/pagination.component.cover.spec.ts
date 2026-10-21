import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/compiler';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { App, DataSource, $watch } from '@wm/core';
import { WidgetRef, getOrderByExpr } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { PaginationComponent } from './pagination.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    adjustVerticalPosition: jest.fn(),
    $appDigest: jest.fn(),
    $watch: jest.fn(() => jest.fn()),
}));

const makeParent = (extra: any = {}) => ({
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
    ...extra,
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('PaginationComponent coverage', () => {
    let fixture: ComponentFixture<PaginationComponent>;
    let component: any;
    let parent: any;

    beforeEach(async () => {
        (($watch as unknown) as jest.Mock).mockClear();
        const widgetRef = { widget: {}, parent: makeParent() };
        await TestBed.configureTestingModule({
            imports: [PaginationComponent, FormsModule, ReactiveFormsModule],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: WidgetRef, useValue: widgetRef },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();
        fixture = TestBed.createComponent(PaginationComponent);
        component = fixture.componentInstance;
        component.dn = { currentPage: 1 };
        component.navigation = 'Basic';
        component.navcontrols = 'Basic';
        component.maxResults = 10;
        component.nativeElement = document.createElement('div');
        parent = makeParent();
        component.parent = parent;
        jest.spyOn(component, 'invokeEventCallback').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('debounced callbacks', () => {
        it('applies the dataset to the widget after the debounce delay', async () => {
            component.widget = {};
            component.dataset = [1, 2, 3];
            component._debouncedApplyDataset();
            expect(component.widget.dataset).toBeUndefined();
            await wait(350);
            expect(component.widget.dataset).toEqual([1, 2, 3]);
        });

        it('page change falls back to the component itself when there is no parent, and skips aria for non-basic navigation', async () => {
            component.parent = undefined;
            component.navigation = 'Classic';
            const goToPage = jest.spyOn(component, 'goToPage').mockImplementation(() => undefined);
            const aria = jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);
            component._debouncedPageChanged({ page: 2, pagesize: 10 });
            await wait(350);
            expect(component.invokeEventCallback).toHaveBeenCalledWith('paginationchange', { $event: undefined, $index: 2 });
            expect(goToPage).toHaveBeenCalled();
            expect(aria).not.toHaveBeenCalled();
        });
    });

    describe('getPaginationStartIndex', () => {
        it('uses the configured start index for page type pagination', () => {
            component.datasource = { _paginationConfig: { paginationStartIndex: '0', type: 'page' } };
            expect(component.getPaginationStartIndex()).toBe(0);
        });

        it('defaults to 1 for other pagination types or when not configured', () => {
            component.datasource = { _paginationConfig: { paginationStartIndex: '0', type: 'offset' } };
            expect(component.getPaginationStartIndex()).toBe(1);
            component.datasource = { _paginationConfig: {} };
            expect(component.getPaginationStartIndex()).toBe(1);
            component.datasource = undefined;
            expect(component.getPaginationStartIndex()).toBe(1);
        });
    });

    describe('setNonPageableData page resolution for tables', () => {
        const data = Array.from({ length: 50 }, (_, i) => i);
        const arrange = (gridOptions: any, widgetType = 'wm-table') => {
            component.parent = makeParent({
                widgetType,
                gridOptions: {
                    isNavTypeScrollOrOndemand: () => true,
                    ACTIONS: { DATASET_UPDATE: 'dataset_update' },
                    ...gridOptions,
                },
            });
            component.options = { maxResults: 10 };
            component.dn.currentPage = 3;
            component.datasource = { execute: jest.fn().mockReturnValue(false) };
            jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
        };

        it('resets to page 1 after a dataset update', () => {
            arrange({ lastActionPerformed: 'dataset_update', isNextPageData: true });
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(1);
        });

        it('resets to page 1 when the next page data flag is off', () => {
            arrange({ lastActionPerformed: 'other', isNextPageData: false });
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(1);
        });

        it('keeps the current page when the action was not a dataset update and next page data is expected', () => {
            arrange({ lastActionPerformed: 'other', isNextPageData: true });
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(3);
        });

        it('keeps the current page when the table navigation is not scroll/on-demand', () => {
            arrange({ isNavTypeScrollOrOndemand: () => false });
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(3);
        });

        it('keeps the current page for non table parents', () => {
            arrange({}, 'wm-list');
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(3);
        });

        it('defaults to page 1 when no current page exists', () => {
            arrange({}, 'wm-list');
            component.dn.currentPage = 0;
            component.setNonPageableData(data);
            expect(component.dn.currentPage).toBe(1);
        });
    });

    describe('setPagingValues', () => {
        const arrange = (paging: any, dsExtra: any = {}) => {
            component.binddataset = true;
            component.datasource = {
                dataSet: {},
                _options: {},
                execute: jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : paging)),
                ...dsExtra,
            };
            jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);
        };

        it('copes with missing paging options', () => {
            arrange(undefined);
            component.setPagingValues([{ id: 1 }]);
            expect(component.pagination).toEqual({});
            expect(component.dn.currentPage).toBe(1);
        });

        it('derives the sort expression from the paging sort array', () => {
            const sort = [{ property: 'name', direction: 'ASC' }];
            arrange({ totalElements: 5, size: 5, number: 0, numberOfElements: 5, sort });
            component.setPagingValues([1]);
            expect(component.sortOptions).toBe(getOrderByExpr(sort));
        });

        it('resolves a non numeric page size or element count from the data set', () => {
            arrange({ totalElements: 20, size: 'sizeKey', number: 0, numberOfElements: 'countKey' }, { dataSet: { sizeKey: 7, countKey: 7 } });
            component.setPagingValues([1]);
            expect(component.pagination.size).toBe(7);
            expect(component.pagination.numberOfElements).toBe(7);
            expect(component.maxResults).toBe(7);
        });

        it('does not take the page number from the backend when the start index is not 1', () => {
            arrange({ totalElements: 20, size: 5, number: 2, numberOfElements: 5 });
            jest.spyOn(component, 'getPaginationStartIndex').mockReturnValue(0);
            component.dn.currentPage = 2;
            component.setPagingValues([1]);
            expect(component.dn.currentPage).toBe(2);
        });

        it('falls back to the first page when no current page is known', () => {
            arrange({ totalElements: 20, size: 5, numberOfElements: 5 });
            component.dn.currentPage = 0;
            component.setPagingValues([1]);
            expect(component.dn.currentPage).toBe(1);
        });

        it('ignores string data for a bound non pageable data source', () => {
            component.binddataset = true;
            component.datasource = { execute: jest.fn().mockReturnValue(false) };
            const nonPageable = jest.spyOn(component, 'setNonPageableData').mockImplementation(() => undefined);
            jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);
            component.setPagingValues('plain text');
            expect(nonPageable).not.toHaveBeenCalled();
        });

        it('resets navigation without aria updates for an empty dataset on a non basic navigation', () => {
            component.binddataset = true;
            component.navigation = 'Classic';
            const aria = jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);
            const setResult = jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            component.setPagingValues(null);
            expect(setResult).toHaveBeenCalledWith(null);
            expect(component.pageCount).toBe(0);
            expect(aria).not.toHaveBeenCalled();
        });

        it('does nothing for empty or string data when the dataset is not bound', () => {
            component.binddataset = undefined;
            const nonPageable = jest.spyOn(component, 'setNonPageableData').mockImplementation(() => undefined);
            component.setPagingValues(null);
            component.setPagingValues('text');
            expect(nonPageable).not.toHaveBeenCalled();
            component.setPagingValues([1]);
            expect(nonPageable).toHaveBeenCalledWith([1]);
        });
    });

    describe('goToPage state persistence', () => {
        it('warns for tables whose navigation does not support state retention', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            parent = makeParent({ widgetType: 'wm-table', navigation: 'Scroll', name: 'table1' });
            parent.statePersistence.computeMode.mockReturnValue('url');
            component.parent = parent;
            component.dn.currentPage = 2;
            jest.spyOn(component, 'getPageData').mockImplementation(() => undefined);
            component.goToPage();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('table1'));
            expect(parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
        });
    });

    describe('setBindDataSet', () => {
        it('keeps watching a dataset bound to pageParams even when a static dataset is given', () => {
            jest.useFakeTimers();
            const apply = jest.fn();
            component._debouncedApplyDataset = apply;
            component.setBindDataSet('Variables.pageParams.dataSet', parent, {}, [1]);
            jest.advanceTimersByTime(1);
            expect(apply).not.toHaveBeenCalled();
            expect(component.binddataset).toBe('Variables.pageParams.dataSet');
            expect($watch).toHaveBeenCalled();
        });

        it('does not fail when the debounced applier has been released', () => {
            component._debouncedApplyDataset = null;
            expect(() => component.setBindDataSet('Variables.v.dataSet', parent, {}, [1, 2])).not.toThrow();
            expect(component.dataset).toEqual([1, 2]);
        });

        it('watch callbacks tolerate a released debounced applier', () => {
            jest.useFakeTimers();
            component.setBindDataSet('Variables.v.dataSet', parent, {});
            jest.advanceTimersByTime(1);
            component._debouncedApplyDataset = null;
            const calls = ($watch as unknown as jest.Mock).mock.calls;
            expect(calls.length).toBe(2);
            expect(() => calls[0][3]([1, 2])).not.toThrow();
            expect(component.dataset).toEqual([1, 2]);
            expect(() => calls[1][3]()).not.toThrow();
        });
    });

    describe('dataset property change of a pageable data source', () => {
        beforeEach(() => {
            jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
            component.defaultPageSizeOptions = [];
            component.datasource = {
                execute: jest.fn().mockReturnValue(true),
                pagination: { size: 'sz', totalElements: 20 },
                dataSet: { sz: 5 },
            };
        });

        it('resolves a non numeric page size from the data set', () => {
            component.onPropertyChange('dataset', [1, 2], undefined);
            expect(component.actualPageSize).toBe(5);
            expect(component.pageSizeOptions).toEqual([5, 10, 15, 20]);
        });

        it('falls back to the data length and max results when the page size is unknown', () => {
            component.datasource.pagination = {};
            component.maxResults = 10;
            parent.statePersistence.getWidgetState.mockReturnValue({ pagesize: 10, selectedItem: [{ page: 1, index: 1 }] });
            component.onPropertyChange('dataset', [1, 2, 3], undefined);
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, {
                pagination: 1,
                pagesize: 10,
                actualpagesize: 10,
                selectedItem: [{ page: 1, index: 1 }],
            });
        });

        it('does not store the state when the selection could not be remapped', () => {
            component.maxResults = 10;
            parent.statePersistence.getWidgetState.mockReturnValue({ actualpagesize: 5, pagesize: 10, selectedItem: [{ page: 1, index: 1 }] });
            jest.spyOn(component, 'handleStateParamsforNewPageSize').mockReturnValue(undefined);
            component.onPropertyChange('dataset', [1, 2, 3], undefined);
            expect(parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
            expect(component.prevPageSize).toBe(10);
        });
    });

    describe('onPageSizeChange without a known page size', () => {
        it('stores max results as the actual page size', () => {
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined);
            component.maxResults = undefined;
            component.actualPageSize = undefined;
            component.onPageSizeChange({ stopPropagation: jest.fn() }, 0);
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, { pagination: 1, pagesize: 0, actualpagesize: 0 });
        });

        it('stores max results as the actual page size when remapping selected items', () => {
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined);
            parent.statePersistence.getWidgetState.mockReturnValue({ selectedItem: [{ page: 1, index: 0 }] });
            component.maxResults = undefined;
            component.actualPageSize = undefined;
            jest.spyOn(component, 'handleStateParamsforNewPageSize').mockReturnValue([{ page: 1, index: 0 }]);
            component.onPageSizeChange({ stopPropagation: jest.fn() }, 0);
            expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, {
                pagination: 1, pagesize: 0, actualpagesize: 0, selectedItem: [{ page: 1, index: 0 }],
            });
        });
    });

    describe('ngOnDestroy', () => {
        it('copes with already released emitters and page size options', () => {
            component.resultEmitter = null;
            component.maxResultsEmitter = null;
            component.defaultPageSizeOptions = null;
            component.pageSizeOptions = null;
            expect(() => component.ngOnDestroy()).not.toThrow();
            expect(component.datasource).toBeNull();
        });
    });
});
