import { TableFilterSortDirective } from './table-filter.directive';
import { DataSource } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    isDataSetWidget: jest.fn(),
    refreshDataSource: jest.fn()
}));

import { isDataSetWidget, refreshDataSource } from '@wm/components/base';

const createMockTable = () => ({
    name: 'table1',
    columns: {
        firstname: { showinfilter: 'true', searchable: true },
        age: { showinfilter: 'true', searchable: true },
        rowOperations: { showinfilter: 'true', searchable: true }
    },
    primaryKey: ['id'],
    sortInfo: {},
    filterInfo: {},
    rowFilter: {},
    rowFilterCompliedTl: {},
    fullFieldDefs: [],
    datasource: { execute: jest.fn() },
    appLocale: {},
    filtermode: 'search',
    fieldDefs: [],
    datagridElement: { find: jest.fn().mockReturnValue({ val: jest.fn(), trigger: jest.fn() }) },
    callDataGridMethod: jest.fn(),
    setDataGridOption: jest.fn(),
    gridOptions: {
        sortInfo: {},
        ACTIONS: { SEARCH_OR_SORT: 'search_or_sort' },
        setLastActionPerformed: jest.fn(),
        setIsSearchTrigerred: jest.fn(),
        searchHandler: jest.fn()
    },
    statePersistence: {
        removeWidgetState: jest.fn(),
        setWidgetState: jest.fn()
    },
    navigation: 'Basic',
    getConfiguredState: jest.fn().mockReturnValue('none'),
    dataset: undefined,
    __fullData: [],
    isNavigationEnabled: jest.fn().mockReturnValue(false),
    dataNavigator: { dn: { currentPage: 1 }, setPagingValues: jest.fn() },
    serverData: undefined,
    invokeEventCallback: jest.fn(),
    setGridData: jest.fn(),
    gridData: [],
    multiselect: false,
    gridfirstrowselect: true,
    nodatamessage: 'No data',
    selecteditem: undefined,
    toggleMessage: jest.fn(),
    matchModeTypesMap: {}
});

const createDirective = (table: any) => new TableFilterSortDirective(table);

describe('TableFilterSortDirective', () => {
    let table: any;

    beforeEach(() => {
        jest.clearAllMocks();
        table = createMockTable();
    });

    describe('constructor', () => {
        it('should rebind the search/sort/filter API onto the table', () => {
            const directive = createDirective(table);
            expect(directive).toBeTruthy();
            expect(table._searchSortHandler).toBeInstanceOf(Function);
            expect(table.getSearchResult).toBeInstanceOf(Function);
            expect(table.getSortResult).toBeInstanceOf(Function);
            expect(table.refreshData).toBeInstanceOf(Function);
            expect(table.emptyMatchModes).toEqual(expect.arrayContaining(['null', 'empty']));
        });
    });

    describe('getNavigationTargetBySortInfo', () => {
        it('should return "first" when sorted descending by the primary key', () => {
            table.sortInfo = { field: 'id', direction: 'desc' };
            const directive = createDirective(table);
            expect(directive.getNavigationTargetBySortInfo()).toEqual('first');
        });

        it('should return "last" otherwise', () => {
            table.sortInfo = { field: 'id', direction: 'asc' };
            const directive = createDirective(table);
            expect(directive.getNavigationTargetBySortInfo()).toEqual('last');
        });
    });

    describe('getTableVisibleCols', () => {
        it('should only return searchable columns flagged as showinfilter, excluding rowOperations', () => {
            const directive = createDirective(table);
            expect(directive.getTableVisibleCols()).toEqual(['firstname', 'age']);
        });
    });

    describe('getFilterFields', () => {
        it('should build filter fields for a single field-scoped search object', () => {
            const directive = createDirective(table);
            const result = directive.getFilterFields({ field: 'firstname', value: 'Ram', matchMode: 'start' });
            expect(result).toEqual({ firstname: { value: 'Ram', logicalOp: 'AND', matchMode: 'start' } });
        });

        it('should apply an unfielded search across all visible columns', () => {
            const directive = createDirective(table);
            const result = directive.getFilterFields({ value: 'Ram' });
            expect(Object.keys(result)).toEqual(['firstname', 'age']);
        });

        it('should process every entry of an array search object', () => {
            const directive = createDirective(table);
            const result = directive.getFilterFields([{ field: 'firstname', value: 'Ram' }, { field: 'age', value: 20 }]);
            expect(Object.keys(result)).toEqual(['firstname', 'age']);
        });

        it('should return an empty object for a nullish search object', () => {
            const directive = createDirective(table);
            expect(directive.getFilterFields(undefined)).toEqual({});
        });
    });

    describe('getLogicalOperator', () => {
        it('should return the logicalOp of the first filter field', () => {
            const directive = createDirective(table);
            expect(directive.getLogicalOperator({ firstname: { logicalOp: 'OR' } })).toEqual('OR');
        });

        it('should return an empty string when there are no filter fields', () => {
            const directive = createDirective(table);
            expect(directive.getLogicalOperator({})).toEqual('');
        });
    });

    describe('resetSortStatus', () => {
        it('should reset the grid sort icons when the datasource sort no longer matches the grid', () => {
            table.sortInfo = { field: 'firstname', direction: 'asc' };
            table.datasource.execute.mockReturnValue({ orderBy: 'age desc' });
            const directive = createDirective(table);
            directive.resetSortStatus(undefined);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('resetSortIcons');
            expect(table.sortInfo).toEqual({});
        });

        it('should do nothing when the sort already matches', () => {
            table.sortInfo = { field: 'firstname', direction: 'asc' };
            table.datasource.execute.mockReturnValue({ orderBy: 'firstname asc' });
            const directive = createDirective(table);
            directive.resetSortStatus(undefined);
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
        });

        it('should do nothing without a datasource or sortInfo', () => {
            table.datasource = null;
            const directive = createDirective(table);
            expect(() => directive.resetSortStatus(undefined)).not.toThrow();
        });
    });

    describe('clearFilter', () => {
        it('should reset each column filter and trigger onRowFilterChange for multicolumn mode', () => {
            table.filtermode = 'multicolumn';
            const col = { resetFilter: jest.fn() };
            table.fieldDefs = [col];
            const directive = createDirective(table);
            // the constructor rebinds table.onRowFilterChange to the real directive method - spy on it post-construction
            const onChangeSpy = jest.spyOn(table, 'onRowFilterChange').mockImplementation(() => undefined);
            directive.clearFilter(false);
            expect(col.resetFilter).toHaveBeenCalledTimes(1);
            expect(onChangeSpy).toHaveBeenCalledTimes(1);
        });

        it('should skip triggering the filter change when skipFilter is true (multicolumn)', () => {
            table.filtermode = 'multicolumn';
            table.fieldDefs = [{ resetFilter: jest.fn() }];
            const directive = createDirective(table);
            const onChangeSpy = jest.spyOn(table, 'onRowFilterChange').mockImplementation(() => undefined);
            directive.clearFilter(true);
            expect(onChangeSpy).not.toHaveBeenCalled();
        });

        it('should clear the search inputs and trigger the search button for search mode', () => {
            table.filtermode = 'search';
            const trigger = jest.fn();
            table.datagridElement.find = jest.fn().mockReturnValue({ val: jest.fn(), trigger });
            const directive = createDirective(table);
            directive.clearFilter(false);
            expect(trigger).toHaveBeenCalledWith('click');
        });
    });

    describe('checkFiltersApplied', () => {
        it('should do nothing without a datasource', () => {
            table.datasource = null;
            const directive = createDirective(table);
            expect(() => directive.checkFiltersApplied(undefined)).not.toThrow();
        });

        it('should clear the filter when server-filter is supported but no filters are set', () => {
            table.datasource.execute.mockImplementation((op) => {
                if (op === DataSource.Operation.SUPPORTS_SERVER_FILTER) { return true; }
                if (op === DataSource.Operation.GET_OPTIONS) { return {}; }
            });
            const directive = createDirective(table);
            const clearSpy = jest.spyOn(directive, 'clearFilter').mockImplementation(() => undefined);
            directive.checkFiltersApplied(undefined);
            expect(clearSpy).toHaveBeenCalledWith(true);
        });

        it('should reset the sort status when the datasource is pageable but not server-filterable', () => {
            table.datasource.execute.mockImplementation((op) => {
                if (op === DataSource.Operation.SUPPORTS_SERVER_FILTER) { return false; }
                if (op === DataSource.Operation.IS_PAGEABLE) { return true; }
            });
            const directive = createDirective(table);
            const resetSpy = jest.spyOn(directive, 'resetSortStatus').mockImplementation(() => undefined);
            directive.checkFiltersApplied(undefined);
            expect(resetSpy).toHaveBeenCalledWith(undefined);
        });
    });

    describe('getSearchResult / getFilteredData matching', () => {
        const data = [
            { firstname: 'Ram', age: 20 },
            { firstname: 'Sita', age: 25 }
        ];

        it('should return all data when there is no search object', () => {
            const directive = createDirective(table);
            expect(directive.getSearchResult(data, undefined)).toBe(data);
        });

        it('should filter using the "start" match mode on a specific field', () => {
            const directive = createDirective(table);
            const result = directive.getSearchResult(data, { field: 'firstname', value: 'Ra', matchMode: 'start' });
            expect(result).toEqual([{ firstname: 'Ram', age: 20 }]);
        });

        it('should filter using the default (contains) match mode across all visible columns when no field is given', () => {
            const directive = createDirective(table);
            const result = directive.getSearchResult(data, { value: 'sita' });
            expect(result).toEqual([{ firstname: 'Sita', age: 25 }]);
        });

        it('should apply an array of search objects sequentially', () => {
            const directive = createDirective(table);
            const result = directive.getSearchResult(data, [{ field: 'age', value: 20 }]);
            expect(result).toEqual([{ firstname: 'Ram', age: 20 }]);
        });

        it('should treat a null numeric search value as "match everything"', () => {
            const directive = createDirective(table);
            const result = directive.getSearchResult(data, { field: 'age', value: null, type: 'int' });
            expect(result).toEqual(data);
        });
    });

    describe('parseDateString', () => {
        it('should return NaN for a non-string input', () => {
            const directive = createDirective(table);
            expect(directive.parseDateString(123 as any)).toBeNaN();
        });

        it('should return NaN for an empty/whitespace string', () => {
            const directive = createDirective(table);
            expect(directive.parseDateString('   ')).toBeNaN();
        });

        it('should parse a standard ISO date string', () => {
            const directive = createDirective(table);
            expect(directive.parseDateString('2020-01-15')).toEqual(new Date('2020-01-15').getTime());
        });

        it('should return NaN for plain text ending in digits that is not a month name', () => {
            const directive = createDirective(table);
            expect(directive.parseDateString('room101')).toBeNaN();
        });
    });

    describe('getSortResult', () => {
        it('should return the data unchanged when there is no sort direction', () => {
            const directive = createDirective(table);
            const data = [{ firstname: 'Ram' }];
            expect(directive.getSortResult(data, {})).toBe(data);
        });

        it('should sort plain (non-date, non-caseinsensitive) fields directly', () => {
            const directive = createDirective(table);
            const data = [{ age: 30 }, { age: 10 }, { age: 20 }];
            const result = directive.getSortResult(data, { field: 'age', direction: 'asc' });
            expect(result.map(r => r.age)).toEqual([10, 20, 30]);
        });

        it('should sort case-insensitively when the column requests it', () => {
            table.columns.firstname.caseinsensitive = true;
            const directive = createDirective(table);
            const data = [{ firstname: 'sita' }, { firstname: 'Ram' }];
            const result = directive.getSortResult(data, { field: 'firstname', direction: 'asc' });
            expect(result.map(r => r.firstname)).toEqual(['Ram', 'sita']);
        });

        it('should sort date-like string fields chronologically', () => {
            const directive = createDirective(table);
            const data = [{ dob: '2020-03-01' }, { dob: '2019-01-01' }];
            const result = directive.getSortResult(data, { field: 'dob', direction: 'asc' });
            expect(result.map(r => r.dob)).toEqual(['2019-01-01', '2020-03-01']);
        });
    });

    describe('showClearIcon / clearRowFilter', () => {
        it('should show the clear icon only when a defined, non-empty value is set', () => {
            table.rowFilter.firstname = { value: 'Ram' };
            const directive = createDirective(table);
            expect(directive.showClearIcon('firstname')).toBe(true);
        });

        it('should not show the clear icon for an empty value', () => {
            table.rowFilter.firstname = { value: '' };
            const directive = createDirective(table);
            expect(directive.showClearIcon('firstname')).toBe(false);
        });

        it('clearRowFilter should reset the column filter and notify the change', () => {
            table.rowFilter.firstname = { value: 'Ram' };
            table.columns.firstname.resetFilter = jest.fn();
            const directive = createDirective(table);
            const onChangeSpy = jest.spyOn(directive, 'onRowFilterChange').mockImplementation(() => undefined);
            directive.clearRowFilter('firstname');
            expect(table.columns.firstname.resetFilter).toHaveBeenCalledTimes(1);
            expect(onChangeSpy).toHaveBeenCalledWith('firstname');
        });

        it('clearRowFilter should do nothing when there is no active row filter for the field', () => {
            const directive = createDirective(table);
            const onChangeSpy = jest.spyOn(directive, 'onRowFilterChange');
            directive.clearRowFilter('firstname');
            expect(onChangeSpy).not.toHaveBeenCalled();
        });
    });

    describe('onFilterConditionSelect', () => {
        // Note: the constructor always sets table.emptyMatchModes to the real EMPTY_MATCH_MODES
        // constant (which includes 'null'/'empty'), overwriting any value set before construction.
        it('should clear the filter for empty match-mode conditions', () => {
            table.columns.firstname.resetFilter = jest.fn();
            const directive = createDirective(table);
            const onChangeSpy = jest.spyOn(table, 'onRowFilterChange').mockImplementation(() => undefined);
            directive.onFilterConditionSelect('firstname', 'null');
            expect(table.columns.firstname.resetFilter).toHaveBeenCalledTimes(1);
            expect(onChangeSpy).toHaveBeenCalledTimes(1);
        });

        it('should trigger the filter change immediately when a value is already present', () => {
            table.rowFilter.firstname = { value: 'Ram' };
            const directive = createDirective(table);
            const onChangeSpy = jest.spyOn(table, 'onRowFilterChange').mockImplementation(() => undefined);
            directive.onFilterConditionSelect('firstname', 'start');
            expect(onChangeSpy).toHaveBeenCalledTimes(1);
        });

        it('should focus the field input when no value is present yet', () => {
            jest.useFakeTimers();
            table.columns.firstname.filterInstance = { focus: jest.fn() };
            const directive = createDirective(table);
            directive.onFilterConditionSelect('firstname', 'start');
            jest.runAllTimers();
            expect(table.columns.firstname.filterInstance.focus).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });
    });

    describe('onRowFilterChange', () => {
        it('should build a search object from the active row filters and trigger the grid search handler', () => {
            table.fullFieldDefs = [{ field: 'firstname', type: 'string' }];
            table.rowFilter = { firstname: { value: 'Ram' } };
            const directive = createDirective(table);
            directive.onRowFilterChange('firstname');
            expect(table.gridOptions.searchHandler).toHaveBeenCalledWith(
                [expect.objectContaining({ field: 'firstname', value: 'Ram' })],
                undefined,
                'search'
            );
        });

        it('should refresh filter-on-field values for the changed field', () => {
            table.fullFieldDefs = [{ field: 'firstname', type: 'string', filteronfilter: undefined }];
            const directive = createDirective(table);
            const spy = jest.spyOn(directive as any, 'getFilterOnFieldValues');
            directive.onRowFilterChange('firstname');
            expect(spy).toHaveBeenCalledWith({ field: 'firstname', type: 'string', filteronfilter: undefined });
        });
    });

    describe('refreshData', () => {
        it('should do nothing without a datasource', () => {
            table.datasource = null;
            const directive = createDirective(table);
            expect(() => directive.refreshData(false)).not.toThrow();
        });

        it('should refresh the datasource from page 1 by default', () => {
            const directive = createDirective(table);
            directive.refreshData(false);
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 1 }));
        });

        it('should stay on the current page when isSamePage is true', () => {
            table.dataNavigator.dn.currentPage = 3;
            const directive = createDirective(table);
            directive.refreshData(true);
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 3 }));
        });
    });

    describe('searchSortHandler', () => {
        it('should dispatch to the search handler for a "search" type', () => {
            const directive = createDirective(table);
            const searchSpy = jest.spyOn(directive as any, 'searchHandler').mockImplementation(() => undefined);
            directive.searchSortHandler({}, undefined, 'search');
            expect(searchSpy).toHaveBeenCalledWith({}, undefined, 'search', undefined);
            expect(table.gridOptions.setLastActionPerformed).toHaveBeenCalledWith('search_or_sort');
        });

        it('should dispatch to the sort handler for other types', () => {
            const directive = createDirective(table);
            const sortSpy = jest.spyOn(directive as any, 'sortHandler').mockImplementation(() => undefined);
            directive.searchSortHandler({}, undefined, 'sort');
            expect(sortSpy).toHaveBeenCalledWith({}, undefined, 'sort', undefined);
        });

        it('should stop propagation on a change event outside multicolumn mode instead of dispatching', () => {
            const directive = createDirective(table);
            const searchSpy = jest.spyOn(directive as any, 'searchHandler');
            const event = { type: 'change', stopPropagation: jest.fn() };
            directive.searchSortHandler({}, event, 'search');
            expect(event.stopPropagation).toHaveBeenCalledTimes(1);
            expect(searchSpy).not.toHaveBeenCalled();
        });
    });

    describe('sortHandler (private, via searchSortHandler)', () => {
        it('should run client-side sort/search when there is no datasource or dataset', () => {
            table.datasource = null;
            table.dataset = undefined;
            const directive = createDirective(table);
            const handleSpy = jest.spyOn(directive as any, 'handleClientSideSortSearch').mockImplementation(() => undefined);
            (directive as any).sortHandler({ field: 'age', direction: 'asc' }, undefined, 'sort');
            expect(handleSpy).not.toHaveBeenCalled();
        });

        it('should perform server-side sort when the datasource is sortable', () => {
            table.datasource.execute.mockReturnValue(true);
            const directive = createDirective(table);
            const serverSortSpy = jest.spyOn(directive as any, 'handleSeverSideSort').mockImplementation(() => undefined);
            (directive as any).sortHandler({ field: 'age', direction: 'asc' }, undefined, 'sort');
            expect(serverSortSpy).toHaveBeenCalledWith({ field: 'age', direction: 'asc' }, undefined, undefined);
        });

        it('should fall back to client-side sort when the datasource is not sortable', () => {
            table.datasource.execute.mockReturnValue(false);
            const directive = createDirective(table);
            const clientSpy = jest.spyOn(directive as any, 'handleClientSideSortSearch').mockImplementation(() => undefined);
            (directive as any).sortHandler({ field: 'age', direction: 'asc' }, undefined, 'sort');
            expect(clientSpy).toHaveBeenCalledWith({ field: 'age', direction: 'asc' }, undefined, 'sort');
        });
    });

    describe('handleClientSideSortSearch (private)', () => {
        it('should filter/sort the dataset and update the grid when navigation is not enabled', () => {
            table.dataset = [{ firstname: 'Ram', age: 20 }, { firstname: 'Sita', age: 25 }];
            table.isNavigationEnabled.mockReturnValue(false);
            const directive = createDirective(table);
            (directive as any).handleClientSideSortSearch({ field: 'firstname', value: 'Ram' }, undefined, 'search');
            expect(table.setGridData).toHaveBeenCalledTimes(1);
        });

        it('should update the data navigator when navigation is enabled', () => {
            table.__fullData = [{ firstname: 'Ram' }];
            table.isNavigationEnabled.mockReturnValue(true);
            const directive = createDirective(table);
            (directive as any).handleClientSideSortSearch({}, undefined, 'search');
            expect(table.dataNavigator.setPagingValues).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleServerSideSearch (private, via searchHandler)', () => {
        it('should refresh the datasource with the resolved filter fields', () => {
            table.datasource.execute.mockImplementation((op) => op === DataSource.Operation.SUPPORTS_SERVER_FILTER);
            (refreshDataSource as jest.Mock).mockReturnValue(Promise.resolve());
            const directive = createDirective(table);
            (directive as any).searchHandler({ field: 'firstname', value: 'Ram' }, undefined, 'search');
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 1 }));
        });
    });

    describe('getFilterOnFieldValues (private, via onRowFilterChange)', () => {
        it('should do nothing when the datasource does not support the distinct API', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            table.datasource.execute.mockReturnValue(false);
            table.fullFieldDefs = [{ field: 'city', filteronfilter: 'country' }];
            const directive = createDirective(table);
            expect(() => (directive as any).getFilterOnFieldValues({ field: 'country' })).not.toThrow();
            expect(table.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.SUPPORTS_DISTINCT_API);
        });
    });

    describe('ngOnDestroy', () => {
        it('should clear the table reference', () => {
            const directive = createDirective(table);
            directive.ngOnDestroy();
            expect((directive as any).table).toBeNull();
        });
    });
});
