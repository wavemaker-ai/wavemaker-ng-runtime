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

import { refreshDataSource } from '@wm/components/base';

const flush = () => new Promise(resolve => setTimeout(resolve));

const createTable = (overrides: any = {}): any => ({
    name: 'table1',
    columns: {
        'address.city': { showinfilter: 'true', searchable: true },
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
    dataNavigator: { dn: { currentPage: 3 }, setPagingValues: jest.fn() },
    invokeEventCallback: jest.fn(),
    setGridData: jest.fn(),
    gridData: [],
    nodatamessage: 'No data',
    toggleMessage: jest.fn(),
    emptyMatchModes: ['null', 'empty'],
    matchModeTypesMap: { string: ['contains'] },
    ...overrides,
});

const executeMap = (map: any) => jest.fn((op: string) => map[op]);

describe('TableFilterSortDirective - remaining branches', () => {
    let table: any;
    let directive: any;

    beforeEach(() => {
        jest.clearAllMocks();
        (refreshDataSource as jest.Mock).mockImplementation(() => Promise.resolve({ data: [{ refreshed: true }] }));
        table = createTable();
        directive = new TableFilterSortDirective(table);
    });

    describe('getSearchResult', () => {
        it('does not push a nested value twice when two keys resolve to the same column', () => {
            const data = [{ address: { city: 'Paris' }, addr: 1 }];
            const hit = directive.getSearchResult(data, { value: 'paris', matchMode: 'anywhere', type: 'string' });
            expect(hit).toHaveLength(1);
            const miss = directive.getSearchResult(data, { value: 'paris paris', matchMode: 'anywhere', type: 'string' });
            expect(miss).toHaveLength(0);
        });

        it('filters datetime values through moment', () => {
            const data = [{ d: '2020-01-01' }, { d: '2021-01-01' }];
            const res = directive.getSearchResult(data, { field: 'd', value: '2020-01-01', matchMode: 'exact', type: 'datetime' });
            expect(res).toEqual([{ d: '2020-01-01' }]);
        });
    });

    describe('getLogicalOperator', () => {
        it('returns an empty operator when the first field has none', () => {
            expect(directive.getLogicalOperator({ x: {} })).toBe('');
            expect(directive.getLogicalOperator({ x: { logicalOp: 'OR' } })).toBe('OR');
            expect(directive.getLogicalOperator({})).toBe('');
        });
    });

    describe('resetSortStatus', () => {
        beforeEach(() => {
            table.sortInfo = { field: 'a', direction: 'asc' };
            table.datasource.execute = jest.fn().mockReturnValue({});
        });

        it('resets the sort when neither the datasource nor the variable has a sort', () => {
            directive.resetSortStatus(undefined);
            expect(table.callDataGridMethod).toHaveBeenCalledWith('resetSortIcons');
            expect(table.sortInfo).toEqual({});
            expect(table.setDataGridOption).toHaveBeenCalledWith('sortInfo', {});
        });

        it('falls back to the variable sort (first of several) when the datasource has none', () => {
            directive.resetSortStatus('a asc,b desc');
            expect(table.callDataGridMethod).not.toHaveBeenCalled();
            expect(table.sortInfo).toEqual({ field: 'a', direction: 'asc' });
        });
    });

    describe('clearFilter', () => {
        it('only resets the filter info for other filter modes', () => {
            table.filtermode = 'none';
            table.filterInfo = { a: 1 };
            const find = jest.spyOn(table.datagridElement, 'find');
            directive.clearFilter();
            expect(table.filterInfo).toEqual({});
            expect(find).not.toHaveBeenCalled();
        });
    });

    describe('checkFiltersApplied', () => {
        const O = DataSource.Operation;

        it('keeps the filter when the server filter has filter fields', () => {
            table.datasource.execute = executeMap({ [O.SUPPORTS_SERVER_FILTER]: true, [O.GET_OPTIONS]: { filterFields: { a: 1 } } });
            const clear = jest.spyOn(directive, 'clearFilter');
            directive.checkFiltersApplied();
            expect(clear).not.toHaveBeenCalled();
        });

        it('does nothing for a datasource that is neither server filterable nor pageable', () => {
            table.datasource.execute = executeMap({});
            const reset = jest.spyOn(directive, 'resetSortStatus');
            directive.checkFiltersApplied();
            expect(reset).not.toHaveBeenCalled();
        });
    });

    describe('getSortResult', () => {
        it('sorts case insensitively and keeps non-string values last', () => {
            table.columns.n = { caseinsensitive: true };
            const data = [{ n: 'b' }, { n: null }, { n: 'A' }];
            const res = directive.getSortResult(data, { field: 'n', direction: 'asc' });
            expect(res.map((r: any) => r.n)).toEqual(['A', 'b', null]);
        });
    });

    describe('handleClientSideSortSearch', () => {
        it('wraps a single object dataset in an array and indexes the rows of variables', () => {
            table.dataset = { a: 1 };
            table.datasource.category = 'wm.Variable';
            directive.handleClientSideSortSearch([], null, 'search');
            expect(table.setGridData).toHaveBeenCalledWith([{ a: 1, $$wmSourceListIndex: 0 }]);
        });

        it('adds the source list index to every row of an array dataset', () => {
            table.dataset = [{ a: 1 }, { a: 2 }];
            table.datasource.category = 'wm.Variable';
            directive.handleClientSideSortSearch([], null, 'search');
            expect(table.serverData.map((r: any) => r.$$wmSourceListIndex)).toEqual([0, 1]);
        });
    });

    describe('handleServerSideSearch', () => {
        it('only records the filter info when there is no datasource', () => {
            table.datasource = null;
            directive.handleServerSideSearch([{ a: 1 }]);
            expect(table.filterInfo).toEqual([{ a: 1 }]);
            expect(refreshDataSource).not.toHaveBeenCalled();
        });
    });

    describe('handleSeverSideSort', () => {
        it('sorts without an order when there is no direction and keeps persisted pagination when triggered by state', async () => {
            table.getConfiguredState.mockReturnValue('local');
            (refreshDataSource as jest.Mock).mockResolvedValue([{ plain: true }]);
            directive.handleSeverSideSort({ field: 'a', direction: '' }, null, true);
            expect(table.statePersistence.removeWidgetState).not.toHaveBeenCalled();
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ orderBy: '', page: 1 }));
            await flush();
            expect(table.invokeEventCallback).toHaveBeenCalledWith('sort', expect.objectContaining({
                $data: expect.objectContaining({ data: [{ plain: true }] })
            }));
        });
    });

    describe('searchHandler', () => {
        it('builds filter fields from array entries that carry a key', () => {
            table.dataset = [{ a: 1 }];
            table.datasource.execute = executeMap({ [DataSource.Operation.SUPPORTS_SERVER_FILTER]: true });
            directive.searchHandler([{ key: 'name', matchMode: 'start', value: 'a', type: 'string' }], null, 'search');
            const opts = (refreshDataSource as jest.Mock).mock.calls[0][1];
            expect(opts.filterFields.name).toEqual({ value: 'a', logicalOp: 'AND', matchMode: 'start' });
        });
    });

    describe('onRowFilterChange', () => {
        it('applies defaults for the changed field and keeps empty match modes of other fields', () => {
            table.fullFieldDefs = [{ field: 'a', type: 'string' }];
            table.matchModeTypesMap = { string: ['contains'] };
            table.rowFilter = { a: { value: 'x' }, b: { value: undefined, matchMode: 'null' }, c: { value: '' } };
            directive.onRowFilterChange('a');
            expect(table.gridOptions.searchHandler).toHaveBeenCalledWith([
                { field: 'a', value: 'x', matchMode: 'contains', type: 'string' },
                { field: 'b', value: undefined, matchMode: 'null', type: undefined },
            ], undefined, 'search');
        });

        it('works when the field is unknown', () => {
            table.rowFilter = { a: { value: 'x', matchMode: 'start', type: 'string' } };
            directive.onRowFilterChange('zzz');
            expect(table.gridOptions.searchHandler).toHaveBeenCalledWith(
                [{ field: 'a', value: 'x', matchMode: 'start', type: 'string' }], undefined, 'search');
        });
    });

    describe('refreshData', () => {
        it('stays on the current page and passes the sort', () => {
            table.sortInfo = { field: 'f', direction: 'desc' };
            directive.refreshData(true);
            expect(refreshDataSource).toHaveBeenCalledWith(table.datasource, expect.objectContaining({ page: 3, orderBy: 'f desc' }));
        });
    });
});

describe('TableFilterSortDirective - moment fallback', () => {
    it('uses window.moment when the moment module has no default export', () => {
        jest.isolateModules(() => {
            (window as any).moment = jest.fn((v: any) => ({ valueOf: () => (v === 'x' ? 42 : v) }));
            jest.doMock('moment', () => ({ __esModule: true }));
            const { TableFilterSortDirective: Isolated } = require('./table-filter.directive');
            const d = new Isolated(createTable());
            const res = d.getSearchResult([{ d: 42 }, { d: 7 }], { field: 'd', value: 'x', matchMode: 'exact', type: 'datetime' });
            expect((window as any).moment).toHaveBeenCalledWith('x');
            expect(res).toEqual([{ d: 42 }]);
            delete (window as any).moment;
        });
    });
});
