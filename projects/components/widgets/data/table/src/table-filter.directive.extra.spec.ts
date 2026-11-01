import { DataSource } from '@wm/core';
import { TableFilterSortDirective } from './table-filter.directive';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    isDataSetWidget: jest.fn(() => true),
    refreshDataSource: jest.fn(() => Promise.resolve({ data: [{ refreshed: true }] })),
}));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $appDigest: jest.fn(),
    adjustContainerRightEdges: jest.fn(),
}));

import { isDataSetWidget, refreshDataSource } from '@wm/components/base';
import { adjustContainerRightEdges } from '@wm/core';

const createTable = (overrides: any = {}): any => ({
    name: 'table1',
    columns: {
        firstname: { showinfilter: 'true', searchable: true, caseinsensitive: false },
        age: { showinfilter: 'true', searchable: true },
        born: { showinfilter: 'true', searchable: true },
        'address.city': { showinfilter: 'true', searchable: true },
        rowOperations: { showinfilter: 'true', searchable: true },
        hidden: { showinfilter: 'false', searchable: true },
    },
    primaryKey: ['id'],
    sortInfo: {},
    filterInfo: {},
    rowFilter: {},
    rowFilterCompliedTl: {},
    fullFieldDefs: [],
    fieldDefs: [],
    datasource: { execute: jest.fn(), category: 'wm.ServiceVariable' },
    appLocale: {},
    filtermode: 'search',
    datagridElement: $('<div></div>'),
    callDataGridMethod: jest.fn(),
    setDataGridOption: jest.fn(),
    gridOptions: {
        sortInfo: {},
        ACTIONS: { SEARCH_OR_SORT: 'search_or_sort' },
        setLastActionPerformed: jest.fn(),
        setIsSearchTrigerred: jest.fn(),
        searchHandler: jest.fn(),
    },
    statePersistence: { removeWidgetState: jest.fn(), setWidgetState: jest.fn() },
    navigation: 'Basic',
    getConfiguredState: jest.fn().mockReturnValue('none'),
    dataset: [],
    __fullData: [],
    isNavigationEnabled: jest.fn().mockReturnValue(false),
    dataNavigator: { dn: { currentPage: 1 }, setPagingValues: jest.fn() },
    invokeEventCallback: jest.fn(),
    setGridData: jest.fn(),
    gridData: [],
    multiselect: false,
    gridfirstrowselect: true,
    nodatamessage: 'No data',
    toggleMessage: jest.fn(),
    ...overrides,
});

describe('TableFilterSortDirective - additional behaviour', () => {
    let table: any;
    let directive: any;

    beforeEach(() => {
        jest.clearAllMocks();
        table = createTable();
        directive = new TableFilterSortDirective(table);
    });

    describe('getSearchResult', () => {
        const people = [
            { firstname: 'Alice', age: 30, address: { city: 'Paris' } },
            { firstname: 'bob', age: 20, address: { city: 'Rome' } },
            { firstname: '', age: 25, address: { city: 'Oslo' } },
        ];
        const names = (data: any[]) => data.map((d) => d.firstname);

        it('returns everything without a search object or with an empty value', () => {
            expect(directive.getSearchResult(people, undefined)).toBe(people);
            expect(directive.getSearchResult(people, { field: 'firstname', value: '', matchMode: 'contains' })).toBe(people);
            expect(directive.getSearchResult(people, { field: 'age', value: null, type: 'integer' })).toBe(people);
        });

        it.each([
            ['start', 'a', ['Alice']],
            ['end', 'b', ['bob']],
            ['exact', 'bob', ['bob']],
            ['notequals', 'bob', ['Alice', '']],
            ['anywhere', 'li', ['Alice']],
        ])('applies the %s match mode on a field', (matchMode, value, expected) => {
            const result = directive.getSearchResult(people, { field: 'firstname', value, matchMode, type: 'string' });
            expect(names(result)).toEqual(expected);
        });

        it.each([
            ['null', [null], 0],
            ['empty', [''], 1],
            ['isnotempty', ['x'], 2],
            ['nullorempty', [''], 1],
        ])('applies the empty match mode %s', (matchMode, _unused, expectedCount) => {
            const result = directive.getSearchResult(people, { field: 'firstname', value: '', matchMode, type: 'string' });
            expect(result.length).toBe(expectedCount);
        });

        it('keeps records that have a value for isnotnull', () => {
            const result = directive.getSearchResult([{ a: 1 }, { a: null }], { field: 'a', value: '', matchMode: 'isnotnull', type: 'integer' });
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it.each([
            ['lessthan', 25, [20]],
            ['lessthanequal', 25, [20, 25]],
            ['greaterthan', 25, [30]],
            ['greaterthanequal', 25, [25, 30]],
            ['exact', 25, [25]],
        ])('compares numbers with %s', (matchMode, value, expected) => {
            const result = directive.getSearchResult(people, { field: 'age', value, matchMode, type: 'integer' });
            expect(result.map((d: any) => d.age).sort()).toEqual(expected);
        });

        it('treats the default match mode of numbers as equality', () => {
            const result = directive.getSearchResult(people, { field: 'age', value: 20, type: 'integer' });
            expect(result).toHaveLength(1);
        });

        it('searches nested fields', () => {
            const result = directive.getSearchResult(people, { field: 'address.city', value: 'rom', matchMode: 'anywhere', type: 'string' });
            expect(names(result)).toEqual(['bob']);
        });

        it('searches all visible columns when no field is selected, including nested keys', () => {
            const result = directive.getSearchResult(people, { value: 'paris', matchMode: 'anywhere', type: 'string' });
            expect(names(result)).toEqual(['Alice']);
            const byName = directive.getSearchResult(people, { value: 'bob' });
            expect(names(byName)).toEqual(['bob']);
        });

        it('searches datetime values by their time stamp', () => {
            const rows = [{ born: '2020-01-01T00:00:00' }, { born: '2021-01-01T00:00:00' }];
            const result = directive.getSearchResult(rows, { field: 'born', value: '2020-01-01T00:00:00', matchMode: 'exact', type: 'datetime' });
            expect(result).toHaveLength(1);
        });

        it('applies several search objects one after another', () => {
            const result = directive.getSearchResult(people, [
                { field: 'firstname', value: 'a', matchMode: 'anywhere', type: 'string' },
                { field: 'age', value: 30, matchMode: 'exact', type: 'integer' },
            ]);
            expect(names(result)).toEqual(['Alice']);
        });
    });

    describe('filter fields', () => {
        it('builds the filter fields of all visible columns when no field is selected', () => {
            const fields = directive.getFilterFields({ value: 'x', matchMode: 'start' });
            expect(Object.keys(fields)).toEqual(['firstname', 'age', 'born', 'address.city']);
            expect(fields.firstname).toMatchObject({ value: 'x', logicalOp: 'OR', matchMode: 'start' });
        });

        it('builds the filter fields of a selected field', () => {
            const fields = directive.getFilterFields([{ field: 'age', value: 5, matchMode: 'exact' }, { field: 'firstname', value: 'a' }]);
            expect(fields.age).toEqual({ value: 5, logicalOp: 'AND', matchMode: 'exact' });
            expect(fields.firstname).toEqual({ value: 'a', logicalOp: 'AND' });
        });

        it('ignores empty search objects', () => {
            expect(directive.getFilterFields(undefined)).toEqual({});
            expect(directive.getFilterFields({})).toEqual({});
        });
    });

    describe('sorting', () => {
        it('sorts date strings and keeps blanks last', () => {
            const rows = [{ d: '2021-05-01' }, { d: '' }, { d: '2020-01-01' }, { d: null }];
            const result = directive.getSortResult(rows, { field: 'd', direction: 'asc' });
            expect(result.map((r: any) => r.d)).toEqual(['2020-01-01', '2021-05-01', '', null]);
        });

        it('sorts case insensitively when the column asks for it', () => {
            table.columns.firstname.caseinsensitive = true;
            const rows = [{ firstname: 'b' }, { firstname: 'A' }, { firstname: '' }, { firstname: 'c' }];
            const result = directive.getSortResult(rows, { field: 'firstname', direction: 'asc' });
            expect(result.map((r: any) => r.firstname)).toEqual(['A', 'b', 'c', '']);
        });

        it('uses the sort by column of the sort object for case sensitivity', () => {
            table.columns.firstname.caseinsensitive = true;
            const rows = [{ x: 'b' }, { x: 'A' }];
            const result = directive.getSortResult(rows, { field: 'x', sortBy: 'firstname', direction: 'asc' });
            expect(result.map((r: any) => r.x)).toEqual(['A', 'b']);
        });

        it('uses a plain sort otherwise and leaves unsorted objects alone', () => {
            const rows = [{ age: 3 }, { age: 1 }];
            expect(directive.getSortResult(rows, { field: 'age', direction: 'asc' })[0].age).toBe(1);
            expect(directive.getSortResult(rows, {})).toBe(rows);
            expect(directive.getSortResult(rows, undefined)).toBe(rows);
        });

        it('parses date strings and rejects other values', () => {
            expect(directive.parseDateString(5)).toBeNaN();
            expect(directive.parseDateString('   ')).toBeNaN();
            expect(directive.parseDateString('abc123')).toBeNaN();
            expect(directive.parseDateString('2020-01-01')).toBe(Date.parse('2020-01-01'));
            expect(directive.parseDateString('13/05/2020')).toBe(new Date(2020, 4, 13).getTime());
            expect(directive.parseDateString('May 5')).not.toBeNaN();
        });
    });

    describe('single page search of pageable data sources', () => {
        const pageable = () => ({
            execute: jest.fn((op: any) => op === DataSource.Operation.IS_API_AWARE || op === DataSource.Operation.IS_PAGEABLE),
        });

        beforeEach(() => {
            table.datasource = pageable();
            table.gridData = [{ firstname: 'Alice' }, { firstname: 'Bob' }];
            table.datagridElement = $('<table><tbody><tr class="app-datagrid-row"></tr><tr class="app-datagrid-row"></tr></tbody></table>');
        });

        it('shows only the matching rows and selects the first one', () => {
            directive.searchSortHandler({ field: 'firstname', value: 'ali', matchMode: 'anywhere', type: 'string' }, undefined, 'search');
            const rows = table.datagridElement.find('tr.app-datagrid-row');
            expect(rows.eq(0)[0].style.display).not.toBe('none');
            expect(rows.eq(1)[0].style.display).toBe('none');
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setStatus', 'ready');
            expect(table.callDataGridMethod).toHaveBeenCalledWith('selectFirstRow', true, true);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('updateSelectAllCheckboxState');
            expect(table._isPageSearch).toBe(true);
        });

        it('shows the no data message when nothing matches', () => {
            table.selecteditem = { x: 1 };
            directive.searchSortHandler({ field: 'firstname', value: 'zzz', matchMode: 'anywhere', type: 'string' }, undefined, 'search');
            expect(table.callDataGridMethod).toHaveBeenCalledWith('setStatus', 'nodata', 'No data');
            expect(table.selecteditem).toBeUndefined();
        });

        it('does not select the first row for multi select tables', () => {
            table.multiselect = true;
            directive.searchSortHandler({ field: 'firstname', value: 'bob', matchMode: 'anywhere', type: 'string' }, undefined, 'search');
            expect(table.callDataGridMethod).not.toHaveBeenCalledWith('selectFirstRow', true, true);
        });
    });

    describe('search handler', () => {
        it('stops when there is neither a data source nor a dataset', () => {
            table.datasource = undefined;
            table.dataset = undefined;
            directive.searchSortHandler({ field: 'a', value: 'x' }, undefined, 'search');
            expect(table.invokeEventCallback).not.toHaveBeenCalled();
        });

        it('lets beforefilter cancel the search', () => {
            table.invokeEventCallback.mockReturnValue(false);
            directive.searchSortHandler({ field: 'firstname', value: 'x', type: 'string' }, undefined, 'search');
            expect(table.invokeEventCallback).toHaveBeenCalledWith('beforefilter', expect.anything());
            expect(refreshDataSource).not.toHaveBeenCalled();
        });

        it('stores the search in the widget state when persistence is on', () => {
            table.getConfiguredState.mockReturnValue('session');
            directive.searchSortHandler({ field: 'firstname', value: 'x', type: 'string' }, undefined, 'search');
            expect(table.statePersistence.setWidgetState).toHaveBeenCalledWith(table, { search: { field: 'firstname', value: 'x', type: 'string' } });
            expect(table.statePersistence.removeWidgetState).toHaveBeenCalledWith(table, 'pagination');
            expect(table.statePersistence.removeWidgetState).toHaveBeenCalledWith(table, 'selectedItem');
        });

        it('removes the stored search for empty values and keeps the page when restoring state', () => {
            table.getConfiguredState.mockReturnValue('session');
            directive.searchSortHandler({ field: 'firstname', value: '' }, undefined, 'search', true);
            expect(table.statePersistence.removeWidgetState).toHaveBeenCalledWith(table, 'search');
            expect(table.statePersistence.removeWidgetState).not.toHaveBeenCalledWith(table, 'pagination');
        });

        it('warns for pagination types that cannot keep the state', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            table.getConfiguredState.mockReturnValue('session');
            table.navigation = 'Scroll';
            directive.searchSortHandler({ field: 'a', value: 'x' }, undefined, 'search');
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('is not supported for current pagination type'));
            warn.mockRestore();
        });

        it('filters arrays of search objects and keeps only usable ones', () => {
            table.getConfiguredState.mockReturnValue('session');
            table.datasource.execute.mockReturnValue(false);
            directive.searchSortHandler([
                { field: 'firstname', value: 'a', matchMode: 'start', type: 'string' },
                { field: 'age', value: undefined, matchMode: 'exact' },
                { field: '', value: 'free' },
            ], undefined, 'search');
            const stored = table.statePersistence.setWidgetState.mock.calls[0][1].search;
            expect(stored).toHaveLength(2);
        });

        it('passes server side filters to the data source', async () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_SERVER_FILTER);
            table.sortInfo = { field: 'age', direction: 'desc' };
            directive.searchSortHandler({ field: 'firstname', value: 'a', matchMode: 'start', type: 'string' }, undefined, 'search');
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 1, orderBy: 'age desc', condition: 'AND' }));
            await Promise.resolve();
        });

        it('shows an error message when the server side search fails', async () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.SUPPORTS_SERVER_FILTER);
            (refreshDataSource as jest.Mock).mockReturnValueOnce(Promise.reject('x'));
            directive.searchSortHandler({ field: 'firstname', value: 'a', type: 'string' }, undefined, 'search');
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(table.toggleMessage).toHaveBeenCalledWith(true, 'error', 'No data');
        });

        it('searches by the filter of a single object without a field', () => {
            table.datasource.execute.mockReturnValue(false);
            directive.searchSortHandler({ field: '', value: 'free', matchMode: 'anywhere', type: 'string' }, undefined, 'search');
            expect(table.filterInfo).toEqual([expect.objectContaining({ value: 'free' })]);
        });
    });

    describe('sort handler', () => {
        it('sorts on the server for sortable data sources and raises the sort event', async () => {
            table.datasource.execute.mockImplementation((op: any) => op === DataSource.Operation.IS_SORTABLE);
            table.getConfiguredState.mockReturnValue('session');
            directive.searchSortHandler({ field: 'age', direction: 'asc' }, 'evt', 'sort');
            expect(table.statePersistence.setWidgetState).toHaveBeenCalledWith(table, { sort: { direction: 'asc', field: 'age' } });
            expect(table.statePersistence.removeWidgetState).toHaveBeenCalledWith(table, 'pagination');
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ orderBy: 'age asc' }));
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(table.invokeEventCallback).toHaveBeenCalledWith('sort', expect.objectContaining({ $event: 'evt' }));
        });

        it('removes the stored sort for the unsorted state', () => {
            table.getConfiguredState.mockReturnValue('session');
            table.datasource.execute.mockReturnValue(false);
            directive.searchSortHandler({ field: 'age', direction: '' }, undefined, 'sort');
            expect(table.statePersistence.removeWidgetState).toHaveBeenCalledWith(table, 'sort');
        });

        it('does nothing without a data source or dataset', () => {
            table.datasource = undefined;
            table.dataset = undefined;
            directive.searchSortHandler({ field: 'age', direction: 'asc' }, undefined, 'sort');
            expect(table.invokeEventCallback).not.toHaveBeenCalled();
        });

        it('stops propagating change events of search inputs', () => {
            const event: any = { type: 'change', stopPropagation: jest.fn() };
            directive.searchSortHandler({ field: 'a', value: 'x' }, event, 'search');
            expect(event.stopPropagation).toHaveBeenCalledTimes(1);
            table.filtermode = 'multicolumn';
            directive.searchSortHandler({ field: 'a', value: 'x' }, event, 'search');
            expect(table.gridOptions.setLastActionPerformed).toHaveBeenCalledWith('search_or_sort');
        });
    });

    describe('clearing and positioning', () => {
        it('clears the search inputs and triggers the search button', () => {
            const grid = $('<div><input data-element="dgSearchText" value="a"><input data-element="dgFilterValue" value="b"><button class="app-search-button"></button></div>');
            const click = jest.fn();
            grid.find('.app-search-button').on('click', click);
            table.datagridElement = grid;
            table.filtermode = 'search';
            directive.clearFilter();
            expect(grid.find('[data-element="dgSearchText"]').val()).toBe('');
            expect(click).toHaveBeenCalled();
            click.mockClear();
            directive.clearFilter(true);
            expect(click).not.toHaveBeenCalled();
        });

        it('resets the column filters of multi column filtering', () => {
            const resetFilter = jest.fn();
            table.filtermode = 'multicolumn';
            table.fieldDefs = [{ resetFilter }, {}];
            table.onRowFilterChange = jest.fn();
            directive.clearFilter();
            expect(resetFilter).toHaveBeenCalledTimes(1);
            expect(table.onRowFilterChange).toHaveBeenCalledTimes(1);
            table.onRowFilterChange.mockClear();
            directive.clearFilter(true);
            expect(table.onRowFilterChange).not.toHaveBeenCalled();
        });

        it('adjusts the dropdown container of a filter later', () => {
            jest.useFakeTimers();
            directive.adjustContainer('firstname');
            jest.runAllTimers();
            expect(adjustContainerRightEdges).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });
    });

    describe('filter on field values', () => {
        it('reloads the distinct values of dependent filters', async () => {
            const dependent: any = { field: 'city', filteronfilter: 'country', filterwidget: 'select', filterdataset: [] };
            table.fullFieldDefs = [dependent];
            table.rowFilter = { country: { value: 'IN' } };
            table.datasource.execute.mockImplementation((op: any) => {
                if (op === DataSource.Operation.SUPPORTS_DISTINCT_API) { return true; }
                return Promise.resolve({ data: ['Delhi'] });
            });
            directive.getFilterOnFieldValues({ field: 'country' });
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(table.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS, { fields: 'city', filterFields: { country: { value: 'IN' } } });
            expect(dependent.filterdataset).toEqual(['Delhi']);
        });

        it('clears the filter of dependents when the value is empty and updates autocomplete options directly', () => {
            const auto: any = { field: 'city', filteronfilter: 'country', filterwidget: 'autocomplete', filterInstance: { dataoptions: {} } };
            table.fullFieldDefs = [auto];
            table.rowFilter = { country: { value: '' } };
            table.datasource.execute.mockReturnValue(true);
            directive.getFilterOnFieldValues({ field: 'country' });
            expect(auto.filterInstance.dataoptions.filterFields).toEqual({ country: {} });
        });

        it('skips dependents that are not data set widgets or are bound already', () => {
            (isDataSetWidget as jest.Mock).mockReturnValueOnce(false).mockReturnValue(true);
            const a: any = { field: 'a', filteronfilter: 'country', filterwidget: 'text' };
            const b: any = { field: 'b', filteronfilter: 'b', filterwidget: 'select' };
            const c: any = { field: 'c', filteronfilter: 'country', filterwidget: 'select', isFilterDataSetBound: true };
            table.fullFieldDefs = [a, b, c];
            table.datasource.execute.mockReturnValue(true);
            directive.getFilterOnFieldValues({ field: 'country' });
            expect(table.datasource.execute).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the data source has no distinct api', () => {
            table.datasource.execute.mockReturnValue(false);
            table.fullFieldDefs = [{ field: 'city', filteronfilter: 'country', filterwidget: 'select' }];
            directive.getFilterOnFieldValues({ field: 'country' });
            expect(table.datasource.execute).toHaveBeenCalledTimes(1);
        });
    });
});
