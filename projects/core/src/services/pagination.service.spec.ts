import { PaginationService } from './pagination.service';

describe('PaginationService', () => {
    const service = new PaginationService();

    describe('getUniqueRecordsInFieldDef', () => {
        it('should return newVal directly when fieldDefs is empty', () => {
            const result = service.getUniqueRecordsInFieldDef([], [{ id: 1 }]);
            expect(result).toEqual([{ id: 1 }]);
        });

        it('should only append records from newVal that are not already present', () => {
            const fieldDefs = [{ id: 1 }];
            const result = service.getUniqueRecordsInFieldDef(fieldDefs, [{ id: 1 }, { id: 2 }]);
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });
    });

    describe('updateFieldsOnPagination', () => {
        it('should reset fieldDefs and currentPage to 1 on the first page', () => {
            const parent: any = {
                widgetType: 'wm-list',
                fieldDefs: ['old'],
                currentPage: 3,
                pagesize: 10,
                dataNavigator: { isFirstPage: () => true, pageCount: 5, dataSize: 0, dn: { currentPage: 1 } },
            };
            const [fieldDefs, currentPage] = service.updateFieldsOnPagination(parent, ['a', 'b']);
            expect(fieldDefs).toEqual(['a', 'b']);
            expect(currentPage).toBe(1);
        });

        it('should simply append newVal when the pagination-adjustment condition does not apply', () => {
            const parent: any = {
                widgetType: 'wm-list',
                fieldDefs: ['a'],
                currentPage: 5,
                pagesize: 10,
                // fieldDefs.length / pagesize (0.1) > pageCount (0) => elseif is skipped
                dataNavigator: { isFirstPage: () => false, pageCount: 0, dataSize: 0, dn: { currentPage: 5 } },
            };
            const [fieldDefs, currentPage] = service.updateFieldsOnPagination(parent, ['b', 'c']);
            expect(fieldDefs).toEqual(['a', 'b', 'c']);
            expect(currentPage).toBe(5);
        });

        it('should push newVal and advance currentPage when the data navigator page has incremented', () => {
            const parent: any = {
                widgetType: 'wm-list',
                fieldDefs: ['a', 'b'],
                currentPage: 1,
                pagesize: 2,
                dataNavigator: { isFirstPage: () => false, pageCount: 5, dataSize: 10, dn: { currentPage: 2 } },
            };
            const [fieldDefs, currentPage] = service.updateFieldsOnPagination(parent, ['c', 'd']);
            expect(fieldDefs).toEqual(['a', 'b', 'c', 'd']);
            expect(currentPage).toBe(2);
        });

        it('should read currentPage from gridOptions.getCurrentPage() for a wm-table in viewless mode', () => {
            const parent: any = {
                widgetType: 'wm-table',
                gridData: ['a'],
                currentPage: 99,
                pagesize: 10,
                gridOptions: {
                    isNavTypeScrollOrOndemand: () => false,
                    deletedRowIndex: -1,
                    lastActionPerformed: '',
                    ACTIONS: { SEARCH_OR_SORT: 's', FILTER_CRITERIA: 'f', DATASET_UPDATE: 'd', DELETE: 'del', EDIT: 'edit' },
                    showviewlessbutton: true,
                    mode: 'viewless',
                    getCurrentPage: () => 1,
                },
                dataNavigator: { isFirstPage: () => true, pageCount: 5, dataSize: 0, dn: { currentPage: 1 } },
            };
            const [, currentPage] = service.updateFieldsOnPagination(parent, ['b']);
            expect(currentPage).toBe(1);
        });

        it('should splice out the deleted row for a wm-table with a pending deletedRowIndex', () => {
            const gridData = ['a', 'b', 'c'];
            const parent: any = {
                widgetType: 'wm-table',
                gridData,
                currentPage: 1,
                pagesize: 10,
                gridOptions: {
                    isNavTypeScrollOrOndemand: () => true,
                    deletedRowIndex: 1,
                    setDeletedRowIndex: jest.fn(),
                    lastActionPerformed: '',
                    ACTIONS: { SEARCH_OR_SORT: 's', FILTER_CRITERIA: 'f', DATASET_UPDATE: 'd', DELETE: 'del', EDIT: 'edit' },
                    showviewlessbutton: false,
                },
                dataNavigator: { isFirstPage: () => false, pageCount: 0, dataSize: 0, dn: { currentPage: 1 } },
            };
            service.updateFieldsOnPagination(parent, []);
            expect(parent.gridOptions.setDeletedRowIndex).toHaveBeenCalledWith(-1);
            expect(gridData).toEqual(['a', 'c']);
        });
    });
});
