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

const setup = async (widgetRefValue: any = { widget: {}, parent: makeParent() }) => {
    await TestBed.configureTestingModule({
        imports: [PaginationComponent, FormsModule, ReactiveFormsModule],
        providers: [
            { provide: App, useValue: mockApp },
            { provide: WidgetRef, useValue: widgetRefValue },
        ],
        schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
};

describe('PaginationComponent - more', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('initialisation from the parent', () => {
        it('copies the page size options of the parent when page size change is allowed', async () => {
            jest.useFakeTimers();
            await setup(makeParent({ allowpagesizechange: true, pagesizeoptions: '10,20,30' }));
            const component: any = TestBed.createComponent(PaginationComponent).componentInstance;
            jest.advanceTimersByTime(1);
            expect(component.allowpagesizechange).toBe(true);
            expect(component.defaultPageSizeOptions).toEqual([10, 20, 30]);
        });

        it('does not read page size options when page size change is not allowed', async () => {
            jest.useFakeTimers();
            await setup(makeParent({ allowpagesizechange: false, pagesizeoptions: '10,20' }));
            const component: any = TestBed.createComponent(PaginationComponent).componentInstance;
            const before = component.defaultPageSizeOptions;
            jest.advanceTimersByTime(1);
            expect(component.allowpagesizechange).toBe(false);
            expect(component.defaultPageSizeOptions).toBe(before);
        });
    });

    describe('with a component instance', () => {
        let fixture: ComponentFixture<PaginationComponent>;
        let component: any;
        let parent: any;

        beforeEach(async () => {
            await setup();
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

        it('uses the selected page size for client side pagination when page size change is allowed', () => {
            component.allowpagesizechange = true;
            component.maxResults = 7;
            component.datasource = { execute: jest.fn().mockReturnValue(false) };
            const setResult = jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            const data = Array.from({ length: 20 }, (_, i) => i);

            component.setNonPageableData(data);

            expect(component.pageCount).toBe(3);
            expect(setResult).toHaveBeenCalledWith(data.slice(0, 7));
        });

        it('falls back to page 1 when a pageable data source returns an empty page', () => {
            component.binddataset = true;
            component.dn.currentPage = 3;
            const pagingOptions = { totalElements: 0, size: 10, number: 0, numberOfElements: 0 };
            component.datasource = {
                dataSet: {},
                _options: {},
                execute: jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : pagingOptions)),
            };
            jest.spyOn(component, 'setResult').mockImplementation(() => undefined);
            jest.spyOn(component, '_setAriaForBasicNavigation').mockImplementation(() => undefined);

            component.setPagingValues([{ id: 1 }]);

            expect(component.dn.currentPage).toBe(1);
            expect(component.pageCount).toBe(1);
        });

        describe('getPageData for an edit on an earlier table page', () => {
            const arrange = (lastActionPerformed: string) => {
                component.parent = makeParent({
                    widgetType: 'wm-table', currentPage: 3, actionRowPage: 1, gridOptions: { lastActionPerformed },
                });
                component.dn.currentPage = 3;
                component.pagination = { numberOfElements: 10, totalElements: 50 };
                const execute = jest.fn((op: any) => (op === DataSource.Operation.IS_PAGEABLE ? true : Promise.resolve({ data: [1] })));
                component.datasource = { execute };
                jest.spyOn(component, 'getPaginationStartIndex').mockReturnValue(1);
                jest.spyOn(component, 'onPageDataReady').mockImplementation(() => undefined);
                return execute;
            };

            it('requests the page where the edit was made', () => {
                const execute = arrange('update');
                component.getPageData('e', undefined);
                expect(execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({ page: 1 }));
            });

            it('keeps the current page after a delete', () => {
                const execute = arrange('delete');
                component.getPageData('e', undefined);
                expect(execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({ page: 3 }));
            });
        });

        describe('dataset changes of a pageable data source', () => {
            beforeEach(() => {
                jest.spyOn(component, 'setPagingValues').mockImplementation(() => undefined);
                component.datasource = {
                    execute: jest.fn().mockReturnValue(true),
                    pagination: { size: 5, totalElements: 20 },
                    dataSet: {},
                };
            });

            it('uses the configured page size options instead of computing them', () => {
                component.defaultPageSizeOptions = [5, 25];
                component.onPropertyChange('dataset', [1, 2], undefined);
                expect(component.pageSizeOptions).toEqual([5, 25]);
                expect(component.pageSizeOptions).not.toBe(component.defaultPageSizeOptions);
            });

            it('remaps the persisted selection when the page size changed and stores it', () => {
                component.defaultPageSizeOptions = [];
                component.maxResults = 10;
                parent.statePersistence.getWidgetState.mockReturnValue({
                    actualpagesize: 5, pagesize: 10, selectedItem: [{ page: 2, index: 1 }],
                });

                component.onPropertyChange('dataset', [1, 2, 3, 4, 5], undefined);

                expect(parent.statePersistence.setWidgetState).toHaveBeenCalledWith(parent, {
                    pagination: 1,
                    pagesize: 10,
                    actualpagesize: 5,
                    selectedItem: [{ page: 2, index: 1 }],
                });
                expect(component.prevPageSize).toBeUndefined();
            });

            it('uses the previous page size to remap a persisted selection', () => {
                component.defaultPageSizeOptions = [];
                component.prevPageSize = 10;
                parent.statePersistence.getWidgetState.mockReturnValue({
                    actualpagesize: 5, pagesize: 20, selectedItem: [{ page: 1, index: 7 }],
                });

                component.onPropertyChange('dataset', [1, 2, 3, 4, 5], undefined);

                const state = parent.statePersistence.setWidgetState.mock.calls[0][1];
                expect(state.selectedItem).toEqual([{ page: 2, index: 2 }]);
            });
        });
    });
});
