import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PaginationComponent} from './pagination.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    adjustVerticalPosition: jest.fn()
}));

import {App, AppConstants, DataSource, adjustVerticalPosition} from '@wm/core';
import {mockApp} from 'projects/components/base/src/test/util/component-test-util';
import {WidgetRef} from '@wm/components/base';
import {NO_ERRORS_SCHEMA} from '@angular/compiler';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {EventEmitter} from '@angular/core';

describe('PaginationComponent', () => {
    let component: PaginationComponent;
    let fixture: ComponentFixture<PaginationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent, FormsModule, ReactiveFormsModule],
            providers: [
                { provide: App, useValue: mockApp },
                {
                    provide: WidgetRef,
                    useValue: {
                        widget: {},
                        parent: {
                            statePersistence: {
                                computeMode: jest.fn(),
                                removeWidgetState: jest.fn(),
                                setWidgetState: jest.fn()
                            }
                        }
                    }
                }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PaginationComponent);
        component = fixture.componentInstance;

        component.dn = { currentPage: 1 };
        component.navigation = 'Basic';
        component.navcontrols = 'Basic';
        component.maxResults = 10;
        component.dataSize = 100;

        // Set up the nativeElement mock
        (component as any).nativeElement = document.createElement('div');

        // Mock parent and its methods
        component.parent = {
            statePersistence: {
                computeMode: jest.fn(),
                removeWidgetState: jest.fn(),
                setWidgetState: jest.fn()
            },
            invokeEventCallback: jest.fn(),
            getActualPageSize: jest.fn().mockReturnValue(5),
            widgetType: 'wm-table',
        } as any;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
        expect(component.dn.currentPage).toBe(1);
        expect(component.pageCount).toBe(0);
        expect(component.isDisableNext).toBe(true);
        expect(component.isDisablePrevious).toBe(true);
        expect(component.isDisableFirst).toBe(true);
        expect(component.isDisableLast).toBe(true);
    });

    it('should update navigation size correctly', () => {
        component.navcontrols = 'Basic';
        component.navigationsize = 'small';
        (component as any).updateNavSize();
        expect(component.navigationClass).toBe('pagination-sm');

        component.navcontrols = 'Classic';
        component.navigationsize = 'large';
        (component as any).updateNavSize();
        expect(component.navigationClass).toBe('pagination-lg');
    });

    it('should reset page navigation', () => {
        component.resetPageNavigation();
        expect(component.pageCount).toBe(0);
        expect(component.dn.currentPage).toBe(1);
        expect(component.dataSize).toBe(0);
    });

    it('should calculate paging values correctly', () => {
        component.dataSize = 100;
        component.maxResults = 10;
        component.calculatePagingValues();
        expect(component.pageCount).toBe(10);
    });

    it('should set default paging values', () => {
        component.setDefaultPagingValues(100, 10, 2);
        expect(component.maxResults).toBe(10);
        expect(component.dataSize).toBe(100);
        expect(component.dn.currentPage).toBe(2);
        expect(component.pageCount).toBe(10);
    });

    it('should check if it is the first page', () => {
        component.dn.currentPage = 1;
        expect(component.isFirstPage()).toBe(true);
        component.dn.currentPage = 2;
        expect(component.isFirstPage()).toBe(false);
    });

    it('should check if it is the last page', () => {
        component.dn.currentPage = 10;
        component.pageCount = 10;
        expect(component.isLastPage()).toBe(true);
        component.dn.currentPage = 9;
        expect(component.isLastPage()).toBe(false);
    });

    it('should go to the last page', () => {
        component.dn.currentPage = 5;
        component.pageCount = 10;
        jest.spyOn(component, 'goToPage');
        component.goToLastPage(false, null, null);
        expect(component.dn.currentPage).toBe(10);
        expect(component.goToPage).toHaveBeenCalled();
    });

    it('should go to the first page', () => {
        component.dn.currentPage = 5;
        jest.spyOn(component, 'goToPage');
        component.goToFirstPage(false, null, null);
        expect(component.dn.currentPage).toBe(1);
        expect(component.goToPage).toHaveBeenCalled();
    });

    it('should emit result', () => {
        jest.spyOn(component.resultEmitter, 'emit');
        component.setResult([1, 2, 3]);
        expect(component.result).toEqual([1, 2, 3]);
        expect(component.resultEmitter.emit).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should go to page', () => {
        component.dn.currentPage = 2;
        component.maxResults = 10;
        component.parent.statePersistence.computeMode.mockReturnValue('none');
        component.goToPage();
        expect(component.firstRow).toBe(10);
        expect(component.parent.statePersistence.computeMode).toHaveBeenCalled();
    });

    describe('checkDataSize', () => {
        beforeEach(() => {
            component.showrecordcount = true;
            component.isDisableLast = false;
            component.isDisableCount = false;
            component.isDisableNext = false;
            component.prevshowrecordcount = undefined;
        });

        it('should handle dataSize of -1', () => {
            component.checkDataSize(-1);
            expect(component.prevshowrecordcount).toBe(true);
            expect(component.isDisableLast).toBe(true);
            expect(component.isDisableCount).toBe(true);
            expect(component.showrecordcount).toBe(false);
        });

        it('should handle dataSize of INT_MAX_VALUE', () => {
            component.checkDataSize(AppConstants.INT_MAX_VALUE);
            expect(component.prevshowrecordcount).toBe(true);
            expect(component.isDisableLast).toBe(true);
            expect(component.isDisableCount).toBe(true);
            expect(component.showrecordcount).toBe(false);
        });

        it('should disable next button when numberOfElements < size', () => {
            component.checkDataSize(-1, 5, 10);
            expect(component.isDisableNext).toBe(true);
        });

        it('should not disable next button when numberOfElements >= size', () => {
            component.checkDataSize(-1, 10, 10);
            expect(component.isDisableNext).toBe(false);
        });

        it('should handle normal dataSize', () => {
            component.checkDataSize(100);
            expect(component.isDisableCount).toBe(false);
            expect(component.showrecordcount).toBe(true);
        });
    });

    describe('setPagingValues', () => {
        it('should set paging values for datasource with paging', () => {
            component.binddataset = true;
            component.datasource = {
                execute: jest.fn().mockReturnValue({
                    totalElements: 100,
                    size: 10,
                    number: 0,
                    numberOfElements: 10,
                    sort: [{ field: 'name', direction: 'asc' }]
                }),
                _options: {
                    filterFields: { name: 'John' },
                    logicalOp: 'AND',
                    orderBy: 'name ASC'
                }
            };
            component['isDataSourceHasPaging'] = jest.fn().mockReturnValue(true);
            component['setDefaultPagingValues'] = jest.fn();
            component['disableNavigation'] = jest.fn();
            component['checkDataSize'] = jest.fn();
            component['setResult'] = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();

            component['setPagingValues']([{ id: 1, name: 'John' }]);

            expect(component.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.GET_PAGING_OPTIONS);
            expect(component['setDefaultPagingValues']).toHaveBeenCalledWith(100, 10, 1);
            expect(component['disableNavigation']).toHaveBeenCalled();
            expect(component['checkDataSize']).toHaveBeenCalledWith(100, 10, 10);
            expect(component['setResult']).toHaveBeenCalledWith([{ id: 1, name: 'John' }]);
            expect(component.filterFields).toEqual({ name: 'John' });
            expect(component.logicalOp).toBe('AND');
            expect(component.sortOptions).toBe('name ASC');
        });

        it('should set non-pageable data when datasource does not have paging', () => {
            component.binddataset = true;
            component['isDataSourceHasPaging'] = jest.fn().mockReturnValue(false);
            component['setNonPageableData'] = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();

            component['setPagingValues']([{ id: 1, name: 'John' }]);

            expect(component['setNonPageableData']).toHaveBeenCalledWith([{ id: 1, name: 'John' }]);
        });

        it('should reset page navigation when newVal is falsy', () => {
            component.binddataset = true;
            component['setResult'] = jest.fn();
            component['resetPageNavigation'] = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();

            component['setPagingValues'](null);

            expect(component['setResult']).toHaveBeenCalledWith(null);
            expect(component['resetPageNavigation']).toHaveBeenCalled();
        });

        it('should set non-pageable data when binddataset is false', () => {
            component.binddataset = false;
            component['setNonPageableData'] = jest.fn();

            component['setPagingValues']([{ id: 1, name: 'John' }]);

            expect(component['setNonPageableData']).toHaveBeenCalledWith([{ id: 1, name: 'John' }]);
        });

        it('should cap endIndex to totalElements on the last page instead of overshooting it', () => {
            // 541 total records, page size 5, last page (109) has only 1 record but the
            // backend-reported numberOfElements is (incorrectly) still the full page size.
            component.binddataset = true;
            component.dn.currentPage = 109;
            component.datasource = {
                execute: jest.fn().mockReturnValue({
                    totalElements: 541,
                    size: 5,
                    number: 108,
                    numberOfElements: 5
                }),
                _options: {}
            };
            component['isDataSourceHasPaging'] = jest.fn().mockReturnValue(true);
            component['setResult'] = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();

            component['setPagingValues']([{ id: 541 }]);

            expect(component.rowSummary).toEqual({
                startIndex: 541,
                endIndex: 541,
                totalRecords: 541
            });
        });

        it('should not cap endIndex when the page is fully populated', () => {
            component.binddataset = true;
            component.dn.currentPage = 2;
            component.datasource = {
                execute: jest.fn().mockReturnValue({
                    totalElements: 541,
                    size: 5,
                    number: 1,
                    numberOfElements: 5
                }),
                _options: {}
            };
            component['isDataSourceHasPaging'] = jest.fn().mockReturnValue(true);
            component['setResult'] = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();

            component['setPagingValues']([{ id: 6 }]);

            expect(component.rowSummary).toEqual({
                startIndex: 6,
                endIndex: 10,
                totalRecords: 541
            });
        });
    });

    describe('goToPage', () => {
        beforeEach(() => {
            component.dn = { currentPage: 1 };
            component.maxResults = 10;
            component.statehandler = 'url';
            component['getPageData'] = jest.fn();
            jest.spyOn(component, 'isFirstPage');
            jest.spyOn(component, 'isFirstPage').mockReturnValue(false);
            component.parent.statePersistence.computeMode.mockReturnValue('url');
            component['unsupportedStatePersistenceTypes'] = ['Advanced', 'Classic'];

            // Mock any FormControl dependencies before calling detectChanges
            // This is needed if the template has any form controls
            component.resultEmitter = new EventEmitter();
            component.maxResultsEmitter = new EventEmitter();

            // Skip fixture.detectChanges() here to avoid the form error
            // We'll test specific methods directly instead
        });

        it('should set firstRow correctly', () => {
            component.dn.currentPage = 3;
            component.maxResults = 10;
            component.goToPage();
            expect(component.firstRow).toBe(20);
        });

        it('should call getPageData', () => {
            const event = { page: 2 };
            const callback = jest.fn();
            component.goToPage(event, callback);
            expect(component['getPageData']).toHaveBeenCalledWith(event, callback);
        });

        it('should not perform state persistence operations when mode is none', () => {
            component.parent.statePersistence.computeMode.mockReturnValue('none');
            component.goToPage();
            expect(component.parent.statePersistence.removeWidgetState).not.toHaveBeenCalled();
            expect(component.parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
        });

        it('should set _selectedItemsExist to true for table and list widgets', () => {
            component.parent.statePersistence.computeMode.mockReturnValue('url');
            component.parent.widgetType = 'wm-list';
            component.goToPage();
            expect(component.parent._selectedItemsExist).toBe(true);
        });

        it('should not log warning for unsupported navigation type if widget is not wm-list or wm-table', () => {
            jest.spyOn(component, 'isFirstPage').mockReturnValue(false);
            component.parent.statePersistence.computeMode.mockReturnValue('url');
            component.parent.navigation = 'Advanced';
            component.parent.widgetType = 'other-widget';
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
            component.goToPage();
            expect(component.parent.statePersistence.setWidgetState).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });
    });

    describe('PaginationComponent - getPageData', () => {
        let mockDataSource: jest.Mocked<any>;

        beforeEach(() => {
            mockDataSource = { execute: jest.fn() } as any;
            component.datasource = mockDataSource;
            component.dn = { currentPage: 1 };
            component.maxResults = 10;
            component.parent = {
                statePersistence: {
                    computeMode: jest.fn(),
                    removeWidgetState: jest.fn(),
                    setWidgetState: jest.fn()
                },
                invokeEventCallback: jest.fn(),
                getActualPageSize: jest.fn().mockReturnValue(5),
                gridOptions: { lastActionPerformed: '' },
                actionRowPage: 1
            } as any;
        });

        it('should fetch data from datasource when isDataSourceHasPaging is true', async () => {
            const mockResponse = { data: [{ id: 1 }, { id: 2 }] };
            mockDataSource.execute.mockResolvedValue(mockResponse);
            jest.spyOn(component, 'isDataSourceHasPaging').mockReturnValue(true);
            jest.spyOn(component, 'onPageDataReady').mockImplementation();

            await component.getPageData({}, jest.fn());

            expect(mockDataSource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, {
                'page': 1,
                'size': 10,
                'filterFields': component.filterFields,
                'orderBy': component.sortOptions,
                'logicalOp': component.logicalOp,
                'matchMode': 'anywhereignorecase'
            });
            expect(component.onPageDataReady).toHaveBeenCalledWith({}, mockResponse.data, expect.any(Function));
        });

        it('should cap rowSummary.endIndex to totalElements on the last page of server-side pagination', async () => {
            // Last page (109) of 541 records with page size 5: only 1 record on the page,
            // but the backend-reported numberOfElements is (incorrectly) still the full page size.
            const mockResponse = { data: [{ id: 541 }] };
            mockDataSource.execute.mockResolvedValue(mockResponse);
            jest.spyOn(component, 'isDataSourceHasPaging').mockReturnValue(true);
            jest.spyOn(component, 'onPageDataReady').mockImplementation();
            component.dn.currentPage = 109;
            component.maxResults = 5;
            component.pagination = { numberOfElements: 5, totalElements: 541 } as any;

            await component.getPageData({}, jest.fn());

            expect(component.rowSummary).toEqual({
                startIndex: 541,
                endIndex: 541,
                totalRecords: 541
            });
        });

        it('should handle error when datasource execution fails', async () => {
            const mockError = 'Test error';
            mockDataSource.execute.mockRejectedValue(mockError);
            jest.spyOn(component, 'isDataSourceHasPaging').mockReturnValue(true);
            jest.spyOn(console, 'error').mockImplementation();

            component.getPageData({}, jest.fn());

            expect(mockDataSource.execute).toHaveBeenCalled();
        });

        it('should use local data when isDataSourceHasPaging is false', () => {
            const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
            jest.spyOn(component, 'isDataSourceHasPaging').mockReturnValue(false);
            jest.spyOn(component, 'isEditNotInCurrentPage').mockReturnValue(false);
            jest.spyOn(component, 'setResult').mockImplementation();
            jest.spyOn(component, 'onPageDataReady').mockImplementation();
            component.__fullData = mockData;

            component.getPageData({}, jest.fn());

            expect(component.setResult).toHaveBeenCalledWith(mockData.slice(0, 10));
            expect(component.onPageDataReady).toHaveBeenCalledWith({}, mockData.slice(0, 10), expect.any(Function));
        });

        it('should handle edit not in current page', () => {
            const mockData = Array(20).fill(null).map((_, i) => ({ id: i + 1 }));
            jest.spyOn(component, 'isDataSourceHasPaging').mockReturnValue(false);
            jest.spyOn(component, 'isEditNotInCurrentPage').mockReturnValue(true);
            jest.spyOn(component, 'setResult').mockImplementation();
            jest.spyOn(component, 'onPageDataReady').mockImplementation();
            component.__fullData = mockData;
            component.parent.actionRowPage = 2;

            component.getPageData({}, jest.fn());

            expect(component.setResult).toHaveBeenCalledWith(mockData.slice(10, 20));
            expect(component.onPageDataReady).toHaveBeenCalledWith({}, mockData.slice(10, 20), expect.any(Function));
        });
    });

    describe('validateCurrentPage', () => {
        beforeEach(() => {
            component.dn = { currentPage: 1 };
            component.pageCount = 10;
        });

        it('should return true for valid input', () => {
            expect(component.validateCurrentPage({})).toBe(true);
        });

        it('should return false and set currentPage to 1 when input is 0', () => {
            component.dn.currentPage = 0;
            expect(component.validateCurrentPage({})).toBe(false);
            expect(component.dn.currentPage).toBe(1);
        });

        it('should return false and set currentPage to pageCount when input exceeds pageCount', () => {
            component.dn.currentPage = 15;
            expect(component.validateCurrentPage({})).toBe(false);
            expect(component.dn.currentPage).toBe(10);
        });

        it('should return false for NaN input', () => {
            component.dn.currentPage = NaN;
            expect(component.validateCurrentPage({})).toBe(false);
        });

        it('should return false for null input', () => {
            component.dn.currentPage = null;
            expect(component.validateCurrentPage({})).toBe(false);
        });

        it('should not modify currentPage for valid input', () => {
            component.dn.currentPage = 5;
            expect(component.validateCurrentPage({})).toBe(true);
            expect(component.dn.currentPage).toBe(5);
        });
    });


    describe('onModelChange', () => {
        beforeEach(() => {
            jest.spyOn(component, 'validateCurrentPage');
            jest.spyOn(component, 'goToPage');
        });

        it('should call validateCurrentPage and goToPage for valid input', () => {
            (component.validateCurrentPage as jest.Mock).mockReturnValue(true);
            component.onModelChange(5);
            expect(component.validateCurrentPage).toHaveBeenCalledWith(5);
            expect(component.goToPage).toHaveBeenCalledWith(5);
        });

        it('should not call goToPage for invalid input', () => {
            (component.validateCurrentPage as jest.Mock).mockReturnValue(false);
            component.onModelChange(0);
            expect(component.validateCurrentPage).toHaveBeenCalledWith(0);
            expect(component.goToPage).not.toHaveBeenCalled();
        });
    });

    describe('onKeyDown', () => {
        let mockEvent: { target: any; code: any; };
        let mockTargetEle: { addClass: any; removeClass: any; };

        beforeEach(() => {
            mockTargetEle = {
                addClass: jest.fn(),
                removeClass: jest.fn()
            };
            mockEvent = {
                target: {
                    closest: jest.fn().mockReturnValue(mockTargetEle)
                },
                code: ''
            };
            (global as any).$ = jest.fn().mockReturnValue({ closest: mockEvent.target.closest });
        });

        it('should add ng-invalid class and return false for KeyE', () => {
            mockEvent.code = 'KeyE';
            const result = component.onKeyDown(mockEvent);
            expect(mockTargetEle.addClass).toHaveBeenCalledWith('ng-invalid');
            expect(result).toBe(false);
        });

        it('should remove ng-invalid class and return true for non-KeyE', () => {
            mockEvent.code = 'Enter';
            const result = component.onKeyDown(mockEvent);
            expect(mockTargetEle.removeClass).toHaveBeenCalledWith('ng-invalid');
            expect(result).toBe(true);
        });
    });

    describe('pageChanged', () => {
        beforeEach(() => {
            (component as any)._debouncedPageChanged = jest.fn();
        });

        it('should call _debouncedPageChanged with the event', () => {
            const mockEvent = { page: 2 };
            component.pageChanged(mockEvent);
            expect((component as any)._debouncedPageChanged).toHaveBeenCalledWith(mockEvent);
        });
    });

    describe('navigatePage', () => {
        beforeEach(() => {
            component.parent = {
                isDataLoading: false,
                infScroll: false,
                variableInflight: false,
                callDataGridMethod: jest.fn(),
                widgetType: '',
                gridOptions: {
                    isNavTypeScrollOrOndemand: jest.fn(),
                    setLastActionPerformed: jest.fn(),
                    setIsDatasetUpdated: jest.fn(),
                    ACTIONS: { DEFAULT: 'default' }
                },
                getActualPageSize: jest.fn().mockReturnValue(5)
            } as any;
            component.dn = { currentPage: 1 };
            component.datasource = { pagination: {} } as any;
            component.invokeEventCallback = jest.fn();
            component.goToFirstPage = jest.fn();
            component.goToLastPage = jest.fn();
            component.goToPage = jest.fn();
            component.isFirstPage = jest.fn();
            component.isLastPage = jest.fn();
            component.validateCurrentPage = jest.fn().mockReturnValue(true);
        });

        it('should set isDataLoading to true when defined and not disabled', () => {
            component.isDisableNext = false;
            component.navigatePage('next', {}, false, null);
            expect(component.parent.isDataLoading).toBe(true);
        });
        it('should reset last action performed for wm-table', () => {
            component.parent.widgetType = 'wm-table';
            component.parent.gridOptions.isNavTypeScrollOrOndemand.mockReturnValue(true);
            component.navigatePage('next', {}, false, null);
            expect(component.parent.gridOptions.setLastActionPerformed).toHaveBeenCalledWith('default');
            expect(component.parent.gridOptions.setIsDatasetUpdated).toHaveBeenCalledWith(false);
        });

        it('should invoke paginationchange event callback', () => {
            component.navigatePage('next', {}, false, null);
            expect(component.invokeEventCallback).toHaveBeenCalledWith('paginationchange', { $event: undefined, $index: 1 });
        });

        it('should go to first page', () => {
            component.navigatePage('first', {}, true, null);
            expect(component.goToFirstPage).toHaveBeenCalledWith(true, {}, null);
        });

        it('should go to last page', () => {
            component.navigatePage('last', {}, true, null);
            expect(component.goToLastPage).toHaveBeenCalledWith(true, {}, null);
        });

        it('should decrement page when going prev', () => {
            component.dn.currentPage = 2;
            component.navigatePage('prev', {}, false, null);
            expect(component.dn.currentPage).toBe(1);
        });

        it('should increment page when going next', () => {
            component.navigatePage('next', {}, false, null);
            expect(component.dn.currentPage).toBe(2);
        });

        it('should handle server-side pagination for prev', () => {
            component.pagination = { next: true };
            component.navigatePage('prev', {}, false, null);
            expect(component.datasource.pagination.isNext).toBe(false);
            expect(component.datasource.pagination.isPrev).toBe(true);
        });

        it('should handle server-side pagination for next', () => {
            component.pagination = { next: true };
            component.navigatePage('next', {}, false, null);
            expect(component.datasource.pagination.isNext).toBe(true);
            expect(component.datasource.pagination.isPrev).toBe(false);
        });

        it('should call goToPage after navigation', () => {
            component.navigatePage('next', {}, false, null);
            expect(component.goToPage).toHaveBeenCalledWith({}, null);
        });
    });

    describe('setBindDataSet', () => {
        it('should set dataset and call _debouncedApplyDataset when only dataset is provided', () => {
            const mockDataset = [{ id: 1 }, { id: 2 }];
            (component as any)._debouncedApplyDataset = jest.fn();

            component.setBindDataSet('', null, null, mockDataset);

            expect(component.dataset).toBe(mockDataset);
            expect((component as any)._debouncedApplyDataset).toHaveBeenCalled();
        });
        it('should set datasource when datasetBoundExpr is false', (done) => {
            const mockParent = {};
            const mockDataSource = { someData: 'data' };
            const mockWatch = jest.fn();
            (global as any).$watch = mockWatch;

            component.setBindDataSet('someDataset', mockParent, mockDataSource);

            setTimeout(() => {
                expect(component.binddataset).toBe('someDataset');
                expect(component.datasource).toBe(mockDataSource);
                done();
            });
        });
    });

    describe('onPropertyChange', () => {
        it('should handle dataset change with parent onDataNavigatorDataSetChange', () => {
            const mockData = [{ id: 1 }, { id: 2 }];
            component.parent = {
                onDataNavigatorDataSetChange: jest.fn().mockReturnValue(mockData),
                widgetType: 'wm-table',
                getActualPageSize: jest.fn().mockReturnValue(5)
            };
            component.setResult = jest.fn();
            (component as any).setPagingValues = jest.fn();
            component.isEditNotInCurrentPage = jest.fn().mockReturnValue(false);

            component.onPropertyChange('dataset', mockData, null);

            expect(component.parent.onDataNavigatorDataSetChange).toHaveBeenCalledWith(mockData);
            expect(component.parent._triggeredByUser).toBe(false);
            expect((component as any).setPagingValues).toHaveBeenCalledWith(mockData);
        });

        it('should handle dataset change without parent onDataNavigatorDataSetChange', () => {
            const mockData = [{ id: 1 }, { id: 2 }];
            component.parent = { widgetType: 'other', getActualPageSize: jest.fn().mockReturnValue(5) };
            component.setResult = jest.fn();
            (component as any).setPagingValues = jest.fn();
            component.isEditNotInCurrentPage = jest.fn().mockReturnValue(false);
            component.onPropertyChange('dataset', mockData, null);
            expect((component as any).setPagingValues).toHaveBeenCalledWith(mockData);
        });

        it('should call setResult when isEditNotInCurrentPage returns true', () => {
            const mockData = [{ id: 1 }, { id: 2 }];
            component.parent = {getActualPageSize: jest.fn().mockReturnValue(5)};
            component.setResult = jest.fn();
            (component as any).setPagingValues = jest.fn();
            component.isEditNotInCurrentPage = jest.fn().mockReturnValue(true);

            component.onPropertyChange('dataset', mockData, null);

            expect(component.setResult).toHaveBeenCalledWith(mockData);
            expect((component as any).setPagingValues).not.toHaveBeenCalled();
        });

        it('should handle navigation change to "Advanced"', () => {
            (component as any).updateNavSize = jest.fn();

            component.onPropertyChange('navigation', 'Advanced', 'Basic');

            expect(component.navigation).toBe('Classic');
            expect(component.navcontrols).toBe('Advanced');
            expect((component as any).updateNavSize).toHaveBeenCalled();
        });

        it('should handle navigation change to other values', () => {
            (component as any).updateNavSize = jest.fn();
            component.onPropertyChange('navigation', 'Basic', 'Advanced');
            expect(component.navigation).toBe('Basic');
            expect((component as any).updateNavSize).toHaveBeenCalled();
        });

        it('should handle navigationsize change', () => {
            (component as any).updateNavSize = jest.fn();

            component.onPropertyChange('navigationsize', 'large', 'small');

            expect((component as any).updateNavSize).toHaveBeenCalled();
        });

        it('should handle maxResults change', () => {
            component.dataset = [{ id: 1 }, { id: 2 }];
            (component as any).setPagingValues = jest.fn();

            component.onPropertyChange('maxResults', 10, 5);

            expect((component as any).setPagingValues).toHaveBeenCalledWith(component.dataset);
        });

        it('should call super.onPropertyChange for other properties', () => {
            const superOnPropertyChange = jest.spyOn(Object.getPrototypeOf(PaginationComponent.prototype), 'onPropertyChange');

            component.onPropertyChange('someOtherProperty', 'newValue', 'oldValue');

            expect(superOnPropertyChange).toHaveBeenCalledWith('someOtherProperty', 'newValue', 'oldValue');
        });
    });

    describe('_setAriaForBasicNavigation', () => {
        let links: HTMLAnchorElement[];
        let mockElement: HTMLElement;

        beforeEach(() => {
            // Create a mock element structure instead of using fixture.nativeElement
            mockElement = document.createElement('div');
            mockElement.innerHTML = `
            <a href="#"><span data-isacitvepage="true"></span></a>
            <a href="#"><span data-isdisabled="true"></span></a>
            <a href="#"><span></span></a>
          `;

            // Mock the nativeElement property on the component
            (component as any).nativeElement = mockElement;

            // No need for fixture.detectChanges() since we're not updating the actual component template
        });

        it('should set href attribute for all links', () => {
            component['_setAriaForBasicNavigation']();
            const links = mockElement.getElementsByTagName('a');
            Array.from(links).forEach((link: HTMLAnchorElement) => {
                expect(link.getAttribute('href')).toBe('javascript:void(0);');
            });
        });

        it('should set aria-current attribute for active page', () => {
            component['_setAriaForBasicNavigation']();
            const activeLink = mockElement.querySelector('a span[data-isacitvepage="true"]').parentElement;
            expect(activeLink.getAttribute('aria-current')).toBe('true');
        });

        it('should set aria-disabled attribute for disabled link', () => {
            component['_setAriaForBasicNavigation']();
            const disabledLink = mockElement.querySelector('a span[data-isdisabled="true"]').parentElement;
            expect(disabledLink.getAttribute('aria-disabled')).toBe('true');
        });

        it('should remove aria-disabled attribute for enabled link', () => {
            component['_setAriaForBasicNavigation']();
            const enabledLink = mockElement.querySelector('a span:not([data-isdisabled])').parentElement;
            expect(enabledLink.getAttribute('aria-disabled')).toBe(null);
        });
    });

    describe('pageChanged (real debounced handler)', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // the debounce helper schedules through the un-patched zone timers, so route them to the jest fake timers
            (window as any).__zone_symbol__setTimeout = (fn: any, wait: number) => setTimeout(fn, wait);
            (window as any).__zone_symbol__clearTimeout = (id: any) => clearTimeout(id);
            component.dn = { currentPage: 1 };
            component.maxResults = 10;
            component.goToPage = jest.fn();
            component['_setAriaForBasicNavigation'] = jest.fn();
            jest.spyOn(component.maxResultsEmitter, 'emit');
            component.parent = {
                ...component.parent,
                invokeEventCallback: jest.fn()
            };
        });

        afterEach(() => {
            jest.useRealTimers();
            delete (window as any).__zone_symbol__setTimeout;
            delete (window as any).__zone_symbol__clearTimeout;
        });

        it('does nothing until the debounce time has elapsed', () => {
            component.pageChanged({ page: 2, itemsPerPage: 10 });
            jest.advanceTimersByTime(249);
            expect(component.goToPage).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
            expect(component.goToPage).toHaveBeenCalledTimes(1);
        });

        it('should not update currentPage if neither the page nor the page size changed', () => {
            component.pageChanged({ page: 1, itemsPerPage: 10 });
            jest.advanceTimersByTime(250);
            expect(component.dn.currentPage).toBe(1);
            expect(component.parent.invokeEventCallback).not.toHaveBeenCalled();
            expect(component.goToPage).not.toHaveBeenCalled();
            expect(component.maxResultsEmitter.emit).not.toHaveBeenCalled();
        });

        it('should update the page, notify the parent and go to the page when the page changes', () => {
            component.pageChanged({ page: 2, itemsPerPage: 10 });
            jest.advanceTimersByTime(250);
            expect(component.dn.currentPage).toBe(2);
            expect(component.parent.invokeEventCallback).toHaveBeenCalledWith('paginationchange', { $event: undefined, $index: 2 });
            expect(component.goToPage).toHaveBeenCalledTimes(1);
        });

        it('should also react when only the page size changes', () => {
            component.pageChanged({ page: 1, pagesize: 25 });
            jest.advanceTimersByTime(250);
            expect(component.maxResults).toBe(25);
            expect(component.maxResultsEmitter.emit).toHaveBeenCalledWith(25);
            expect(component.goToPage).toHaveBeenCalledTimes(1);
        });

        it('should only act on the latest event when several arrive within the debounce time', () => {
            component.pageChanged({ page: 2, itemsPerPage: 10 });
            jest.advanceTimersByTime(100);
            component.pageChanged({ page: 3, itemsPerPage: 10 });
            jest.advanceTimersByTime(250);
            expect(component.dn.currentPage).toBe(3);
            expect(component.goToPage).toHaveBeenCalledTimes(1);
        });

        it('should not call _setAriaForBasicNavigation if navigation is not Basic', () => {
            component.navigation = 'Advanced';
            component.pageChanged({ page: 2, itemsPerPage: 10 });
            jest.advanceTimersByTime(250);
            expect(component['_setAriaForBasicNavigation']).not.toHaveBeenCalled();
        });

        it('should call _setAriaForBasicNavigation when navigation is Basic', () => {
            component.navigation = 'Basic';
            component.pageChanged({ page: 2, itemsPerPage: 10 });
            jest.advanceTimersByTime(250);
            expect(component['_setAriaForBasicNavigation']).toHaveBeenCalledTimes(1);
        });
    });

    describe('setNonPageableData', () => {
        beforeEach(() => {
            component.setDefaultPagingValues = jest.fn();
            component.disableNavigation = jest.fn();
            component.setResult = jest.fn();
            component.dn = { currentPage: 2 };
            component.maxResults = 10;
        });

        it('should handle non-array input', () => {
            const input = { key: 'value' };
            component.setNonPageableData(input);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(1, 1, 2);
            expect(component.setResult).toHaveBeenCalledWith(input);
        });

        it('should handle empty input', () => {
            component.setNonPageableData({});
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(0, 0, 2);
            expect(component.setResult).toHaveBeenCalledWith({});
        });

        it('should use maxResults from options if available', () => {
            component.options = { maxResults: 20 };
            component.setNonPageableData([1, 2, 3, 4, 5]);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(5, 20, 2);
        });

        it('should set currentPage to 1 for API-aware datasource', () => {
            component.datasource = {
                execute: jest.fn().mockReturnValue(true)
            };
            component.setNonPageableData([1, 2, 3, 4, 5]);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(5, 5, 1);
        });

        it('should set currentPage to 1 for specific table conditions', () => {
            component.parent = {
                widgetType: 'wm-table',
                gridOptions: {
                    isNavTypeScrollOrOndemand: jest.fn().mockReturnValue(true),
                    lastActionPerformed: 'DATASET_UPDATE',
                    ACTIONS: { DATASET_UPDATE: 'DATASET_UPDATE' }
                },
                getActualPageSize: jest.fn().mockReturnValue(5)
            };
            component.setNonPageableData([1, 2, 3, 4, 5]);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(5, 5, 2);
        });

        it('should slice array result based on currentPage and maxResults', () => {
            const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            component.dn.currentPage = 2;
            component.maxResults = 5;
            component.setNonPageableData(input);
            expect(component.setResult).toHaveBeenCalledWith([6, 7, 8, 9, 10]);
        });
    });

    describe('setNonPageableData', () => {
        beforeEach(() => {
            component.setDefaultPagingValues = jest.fn();
            component.disableNavigation = jest.fn();
            component.setResult = jest.fn();
            component.dn = { currentPage: 2 };
            component.maxResults = 10;
        });

        it('should handle non-array input', () => {
            const input = { key: 'value' };
            component.setNonPageableData(input);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(1, 1, 2);
            expect(component.setResult).toHaveBeenCalledWith(input);
        });

        it('should handle empty input', () => {
            component.setNonPageableData({});
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(0, 0, 2);
            expect(component.setResult).toHaveBeenCalledWith({});
        });

        it('should use maxResults from options if available', () => {
            component.options = { maxResults: 20 };
            component.setNonPageableData([1, 2, 3, 4, 5]);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(5, 20, 2);
        });

        it('should set currentPage to 1 for API-aware datasource', () => {
            component.datasource = {
                execute: jest.fn().mockReturnValue(true)
            };
            component.setNonPageableData([1, 2, 3, 4, 5]);
            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(5, 5, 1);
        });

        it('should slice array result based on currentPage and maxResults', () => {
            const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            component.dn.currentPage = 2;
            component.maxResults = 5;
            component.setNonPageableData(input);
            expect(component.setResult).toHaveBeenCalledWith([6, 7, 8, 9, 10]);
        });

        it('should use setDefaultPagingValues when dataSize or maxResults is truthy', () => {
            component.options = { maxResults: 1 };
            component.setNonPageableData([]);

            expect(component.setDefaultPagingValues).toHaveBeenCalledWith(0, 1, 2);
            expect(component.disableNavigation).toHaveBeenCalled();
            expect(component.setResult).toHaveBeenCalledWith([]);
        });
    });

    describe('onOpenChange', () => {
        let mockFocus: jest.Mock;
        let mockEq: jest.Mock;

        beforeEach(() => {
            mockFocus = jest.fn();
            mockEq = jest.fn().mockReturnValue({ focus: mockFocus });
            (global as any).$ = jest.fn().mockReturnValue({ eq: mockEq });
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should focus the currently selected page size option, not the first one', () => {
            component.pageSizeOptions = [5, 10, 20, 50, 100];
            component.maxResults = 20;

            component.onOpenChange(true);

            expect(component.focusedIndex).toBe(2);
            jest.runAllTimers();
            expect(mockEq).toHaveBeenCalledWith(2);
            expect(mockFocus).toHaveBeenCalled();
        });

        it('should default to the first option when maxResults does not match any pageSizeOptions', () => {
            component.pageSizeOptions = [5, 10, 20];
            component.maxResults = 999;

            component.onOpenChange(true);

            expect(component.focusedIndex).toBe(0);
        });

        it('should not update focusedIndex when the dropdown is closed', () => {
            component.pageSizeOptions = [5, 10, 20];
            component.maxResults = 20;
            component.focusedIndex = 3;

            component.onOpenChange(false);

            expect(component.focusedIndex).toBe(3);
        });
    });

    describe('normalizeToNumberArray', () => {
        it('should return an empty array for falsy input', () => {
            expect(component.normalizeToNumberArray(null)).toEqual([]);
            expect(component.normalizeToNumberArray(undefined)).toEqual([]);
            expect(component.normalizeToNumberArray('')).toEqual([]);
        });

        it('should sort and coerce a real array of mixed types', () => {
            expect(component.normalizeToNumberArray([30, '10', 20])).toEqual([10, 20, 30]);
        });

        it('should parse a JSON array string', () => {
            expect(component.normalizeToNumberArray('[30,10,20]')).toEqual([10, 20, 30]);
        });

        it('should fall back to an empty array for malformed JSON-looking input', () => {
            // Must both start with "[" and end with "]" to hit the JSON.parse/catch branch.
            expect(component.normalizeToNumberArray('[30,10,]')).toEqual([]);
        });

        it('should parse a comma-separated string', () => {
            expect(component.normalizeToNumberArray('30,10,20')).toEqual([10, 20, 30]);
        });

        it('should drop non-numeric entries', () => {
            expect(component.normalizeToNumberArray('10,abc,20')).toEqual([10, 20]);
        });

        it('should return an empty array for unsupported input types', () => {
            expect(component.normalizeToNumberArray(42)).toEqual([]);
        });
    });

    describe('getPageDetails', () => {
        it('should build the row summary when all indices are defined', () => {
            component.getPageDetails(1, 10, 100);
            expect(component.rowSummary).toEqual({ startIndex: 1, endIndex: 10, totalRecords: 100 });
        });

        it('should reset the row summary when any index is missing', () => {
            component.getPageDetails(undefined, 10, 100);
            expect(component.rowSummary).toEqual({});
        });
    });

    describe('invokeSetRecord', () => {
        it('should delegate to the parent invokeEventCallback when a parent is present', () => {
            component.dn.currentPage = 2;
            component.maxResults = 10;
            component.dataSize = 100;
            component.pageCount = 10;
            component.invokeSetRecord({ type: 'click' }, { id: 1 });
            expect(component.parent.invokeEventCallback).toHaveBeenCalledWith('setrecord', expect.objectContaining({
                $index: 2,
                $data: { id: 1 },
                data: { id: 1 },
                pageInfo: { currentPage: 2, size: 10, totalElements: 100, totalPages: 10 }
            }));
        });

        it('should invoke its own event callback when there is no parent', () => {
            component.parent = null;
            const invokeSpy = jest.spyOn(component, 'invokeEventCallback').mockImplementation(() => undefined as any);
            component.invokeSetRecord({ type: 'click' }, { id: 1 });
            expect(invokeSpy).toHaveBeenCalledWith('setrecord', expect.objectContaining({ $data: { id: 1 } }));
        });
    });

    describe('setDataSource', () => {
        it('should store the given datasource', () => {
            const ds = { execute: jest.fn() };
            component.setDataSource(ds);
            expect(component.datasource).toBe(ds);
        });
    });

    describe('onDropdownKeydown', () => {
        beforeEach(() => {
            component.pageSizeOptions = [10, 20, 30];
            component.focusedIndex = 1;
            (component as any).bsDropdown = { hide: jest.fn() };
            jest.spyOn(component, 'onPageSizeChange').mockImplementation(() => undefined);
            jest.spyOn(component, 'closeDropdown').mockImplementation(() => undefined);
        });

        it('should move focus to the next item on ArrowDown', () => {
            const event = { key: 'ArrowDown', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.focusedIndex).toEqual(2);
        });

        it('should wrap to the first item on ArrowDown past the last option', () => {
            const event = { key: 'ArrowDown', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 2);
            expect(component.focusedIndex).toEqual(0);
        });

        it('should move focus to the previous item on ArrowUp', () => {
            const event = { key: 'ArrowUp', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.focusedIndex).toEqual(0);
        });

        it('should wrap to the last item on ArrowUp before the first option', () => {
            const event = { key: 'ArrowUp', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 0);
            expect(component.focusedIndex).toEqual(2);
        });

        it('should treat Shift+Tab like ArrowUp', () => {
            const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.focusedIndex).toEqual(0);
        });

        it('should treat Tab like ArrowDown', () => {
            const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.focusedIndex).toEqual(2);
        });

        it('should select the focused option and close the dropdown on Enter', () => {
            const event = { key: 'Enter', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.onPageSizeChange).toHaveBeenCalledWith(event, 20);
            expect(component.closeDropdown).toHaveBeenCalled();
        });

        it('should close the dropdown on Escape', () => {
            const event = { key: 'Escape', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(component.closeDropdown).toHaveBeenCalledTimes(1);
        });

        it('should ignore any other key', () => {
            const event = { key: 'a', preventDefault: jest.fn() };
            component.onDropdownKeydown(event, 1);
            expect(event.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('closeDropdown', () => {
        it('should hide the dropdown and return focus to the toggle button', () => {
            const hide = jest.fn();
            const focus = jest.fn();
            (component as any).bsDropdown = { hide };
            jest.spyOn(global, '$' as any).mockReturnValue({ focus });
            component.closeDropdown();
            expect(hide).toHaveBeenCalledTimes(1);
            expect(focus).toHaveBeenCalledTimes(1);
        });
    });

    describe('onPageSizeChange', () => {
        beforeEach(() => {
            component.maxResults = 10;
            component.parent.statePersistence.getWidgetState = jest.fn().mockReturnValue({});
            jest.spyOn(component, 'navigatePage').mockImplementation(() => undefined as any);
            jest.spyOn(component, 'calculatePagingValues').mockImplementation(() => undefined);
        });

        it('should update maxResults and notify listeners', () => {
            component.onPageSizeChange({} as any, '20');
            expect(component.maxResults).toEqual(20);
            expect(component.navigatePage).toHaveBeenCalledWith('first', {}, true);
            expect(component.calculatePagingValues).toHaveBeenCalled();
        });

        it('should push the new page size onto the datasource when it supports paging', () => {
            component.datasource = { maxResults: 0 };
            jest.spyOn(component as any, 'isDataSourceHasPaging').mockReturnValue(true);
            component.onPageSizeChange({} as any, '25');
            expect((component.datasource as any).maxResults).toEqual(25);
        });

        it('should persist updated selected-item state when one is present', () => {
            component.parent.statePersistence.getWidgetState = jest.fn().mockReturnValue({
                selectedItem: [{ page: 1, index: 0 }]
            });
            component.onPageSizeChange({} as any, '5');
            expect(component.parent.statePersistence.setWidgetState).toHaveBeenCalledWith(
                component.parent,
                expect.objectContaining({ selectedItem: expect.any(Array) })
            );
        });

        it('should stop propagation and close the dropdown when triggered from within a popover', () => {
            const popover = document.createElement('div');
            popover.className = 'popover';
            (component as any).nativeElement = document.createElement('span');
            popover.appendChild((component as any).nativeElement);
            document.body.appendChild(popover);
            (component as any).bsDropdown = { hide: jest.fn() };
            const event = { stopPropagation: jest.fn() };
            component.onPageSizeChange(event as any, '15');
            expect(event.stopPropagation).toHaveBeenCalledTimes(1);
            expect((component as any).bsDropdown.hide).toHaveBeenCalledTimes(1);
            document.body.removeChild(popover);
        });
    });

    describe('onDropDownShown / onDropdownScroll / onDropdownHidden', () => {
        it('should do nothing when the event carries no element', () => {
            expect(() => component.onDropDownShown({})).not.toThrow();
        });

        it('should register a scroll handler that delegates to onDropdownScroll', () => {
            const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
            const container = document.createElement('div');
            document.body.appendChild(container);
            (component as any).bsDropdown = { _dropdown: {} };
            component.onDropDownShown({ _element: { nativeElement: container } });
            expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
            document.body.removeChild(container);
        });

        it('onDropdownScroll should be a safe no-op', () => {
            expect(() => component.onDropdownScroll()).not.toThrow();
        });

        it('onDropdownHidden should remove the registered scroll handler', () => {
            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            const handler = () => undefined;
            (component as any).dropdownScrollHandler = handler;
            component.onDropdownHidden();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', handler, true);
            expect((component as any).dropdownScrollHandler).toBeUndefined();
        });

        it('onDropdownHidden should do nothing when there is no handler registered', () => {
            (component as any).dropdownScrollHandler = undefined;
            expect(() => component.onDropdownHidden()).not.toThrow();
        });
    });

    describe('ngAfterViewInit', () => {
        it('should stop propagation on native clicks within the widget', () => {
            component.ngAfterViewInit();
            const event = { stopPropagation: jest.fn() };
            (component as any).nativeElement.onclick(event);
            expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('should clear timers, listeners and references without throwing', () => {
            const handler = () => undefined;
            (component as any).dropdownScrollHandler = handler;
            (component as any)._initTimeoutId = setTimeout(() => undefined, 1000);
            component.pageSizeOptions = [10, 20];
            component.defaultPageSizeOptions = [10, 20];
            expect(() => component.ngOnDestroy()).not.toThrow();
            expect(component.datasource).toBeNull();
            expect(component.parent).toBeNull();
            expect(component.pageSizeOptions).toEqual([]);
        });
    });

});
