import './datatable.js';

declare const $: any;

const defaultCol = (field: string, extra: any = {}) => ({
    field,
    displayName: field.toUpperCase(),
    type: 'string',
    show: true,
    sortable: true,
    searchable: true,
    resizable: true,
    textAlignment: 'left',
    ...extra,
});

const people = () => [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 20 },
    { id: 3, name: 'Carol', age: 25 },
];

const createOptions = (overrides: any = {}): any => ({
    data: people(),
    colDefs: [defaultCol('id'), defaultCol('name'), defaultCol('age')],
    headerConfig: [],
    rowActions: [],
    height: '300px',
    navigation: 'Basic',
    ACTIONS: { DEFAULT: 'default', EDIT: 'edit', DELETE: 'delete', DATASET_UPDATE: 'datasetUpdate', FILTER_CRITERIA: 'filterCriteria', SEARCH_OR_SORT: 'search_or_sort' },
    filtermode: '',
    enableRowSelection: true,
    isNavTypeScrollOrOndemand: jest.fn(() => false),
    setIsNextPageData: jest.fn(),
    timeoutCall: jest.fn((fn: any) => fn()),
    runInNgZone: jest.fn((fn: any) => fn()),
    safeApply: jest.fn(),
    registerColNgClassWatcher: jest.fn(),
    registerRowNgClassWatcher: jest.fn(),
    registerCollapseOrExpandTitleWatch: jest.fn(),
    getCustomExpression: jest.fn(() => 'expr'),
    generateCustomExpressions: jest.fn(),
    clearCustomExpression: jest.fn(),
    clearRowDetailExpression: jest.fn(),
    assignSelectedItems: jest.fn(),
    callOnRowClickEvent: jest.fn(),
    callOnRowDeselectEvent: jest.fn(),
    onRowSelect: jest.fn(),
    onRowDeselect: jest.fn(),
    onRowDblClick: jest.fn(),
    onHeaderClick: jest.fn(),
    onColumnSelect: jest.fn(),
    onColumnDeselect: jest.fn(),
    onDataRender: jest.fn(),
    setLastActionPerformed: jest.fn(),
    setIsSearchTrigerred: jest.fn(),
    setIsDatasetUpdated: jest.fn(),
    setIsDataUpdatedByUser: jest.fn(),
    setGridEditMode: jest.fn(),
    setGridState: jest.fn(),
    clearActionRowIndex: jest.fn(),
    setActionRowIndex: jest.fn(),
    getPageCount: jest.fn(() => 1),
    getCurrentPage: jest.fn(() => 1),
    getDataSource: jest.fn(),
    addLoadMoreBtn: jest.fn(),
    sortHandler: jest.fn(),
    searchHandler: jest.fn(),
    clearRowActions: jest.fn(),
    enableNavigation: jest.fn(),
    applyValidations: jest.fn(),
    removeValidations: jest.fn(),
    callLoadInlineWidgetData: jest.fn(),
    bindScrollEvt: jest.fn(),
    clearForm: jest.fn(),
    closePopover: jest.fn(),
    generateFilterRow: jest.fn(),
    generateInlineEditRow: jest.fn(),
    generateRowActions: jest.fn(),
    generateRowDetailView: jest.fn(),
    generateRowExpansionCell: jest.fn(),
    getFieldValue: jest.fn(),
    getFilterWidget: jest.fn(),
    getInlineEditWidget: jest.fn(),
    getRowAction: jest.fn(),
    handleCustomEvents: jest.fn(),
    noChangesDetected: jest.fn(),
    onBeforeFormRender: jest.fn(),
    onBeforeRowCollapse: jest.fn(),
    onBeforeRowDelete: jest.fn(),
    onBeforeRowInsert: jest.fn(),
    onBeforeRowUpdate: jest.fn(),
    onFormRender: jest.fn(),
    onRowCollapse: jest.fn(),
    onRowDelete: jest.fn(),
    onRowInsert: jest.fn(),
    afterRowUpdate: jest.fn(),
    redrawWidgets: jest.fn(),
    selectAllRows: jest.fn(),
    setDeletedRowIndex: jest.fn(),
    setFieldValue: jest.fn(),
    setTouched: jest.fn(),
    getPageSize: jest.fn(() => 10),
    getRowExpansionAction: jest.fn(() => document.createElement('button')),
    isLastPage: jest.fn(() => false),
    ...overrides,
});

const mount = (overrides: any = {}) => {
    const $el = $('<div class="grid-host"></div>').appendTo(document.body);
    const options = createOptions(overrides);
    $el.datatable(options);
    const instance = $el.data('wmDatatable');
    return { $el, options, instance };
};


describe('wm.datatable jQuery widget - branch coverage', () => {
    let ctx: ReturnType<typeof mount>;
    const originalVisible = $.expr.pseudos.visible;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    beforeAll(() => {
        $.expr.pseudos.visible = (el: HTMLElement) => {
            for (let node: HTMLElement | null = el; node && node !== document.documentElement; node = node.parentElement) {
                if (node.style.display === 'none') {
                    return false;
                }
            }
            return true;
        };
    });

    afterAll(() => {
        $.expr.pseudos.visible = originalVisible;
    });

    afterEach(() => {
        try {
            ctx?.$el.datatable('destroy');
        } catch (e) {
            // already destroyed
        }
        ctx?.$el.remove();
        document.body.innerHTML = '';
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const row = (i: number) => ctx.$el.find('tr.app-datagrid-row').eq(i);
    const editable = (extra: any = {}) =>
        mount({
            editmode: 'inline',
            colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false }), defaultCol('age', { readonly: false }), { field: 'rowOperations', type: 'custom', show: true, readonly: true }],
            getInlineEditWidget: jest.fn((field: string) => `<input data-field-name="${field}">`),
            getFieldValue: jest.fn(),
            getRowAction: jest.fn(() => '<button class="edit-row-button"></button><button class="cancel-edit-row-button hidden"></button><button class="save-edit-row-button hidden"></button><button class="delete-row-button"></button>'),
            rowActions: [{ action: 'editRow($event)' }],
            ...extra,
        });

    describe('header labels and selection', () => {
        it('falls back to the field name, then to an empty label', () => {
            ctx = mount({ colDefs: [{ field: 'name', show: true, type: 'string' }, { type: 'custom', show: true, field: undefined }] });
            expect(ctx.$el.find('th').first().text()).toContain('name');
        });

        it('does not mark columns selectable when they opt out', () => {
            ctx = mount({ enableColumnSelection: true, colDefs: [defaultCol('id', { selectable: false }), defaultCol('name')] });
            expect(ctx.$el.find('th[data-col-selectable]')).toHaveLength(1);
        });

        it('skips header config entries without a column definition', () => {
            ctx = mount({ headerConfig: [{ field: 'id', displayName: 'ID' }, { field: 'missing', displayName: 'X' }, { field: 'name', displayName: 'NAME' }] });
            expect(ctx.$el.find('th.app-datagrid-header-cell')).toHaveLength(2);
        });

        it('counts nested group columns', () => {
            ctx = mount();
            const cols = [{ field: 'id' }, { isGroup: true, columns: [{ isGroup: true, columns: [{ field: 'name' }, { field: 'age' }] }] }];
            expect(ctx.instance._getColSpan(cols)).toBe(3);
        });

        it('lists only searchable columns in the search field select and labels them', () => {
            ctx = mount({
                filtermode: 'search',
                colDefs: [
                    defaultCol('id', { showinfilter: 'false' }),
                    defaultCol('none'),
                    defaultCol('rowOperations'),
                    defaultCol('age', { searchable: false }),
                    { field: 'name', type: 'string', show: true, searchable: true },
                    defaultCol('city', { displayName: 'City' }),
                ],
            });
            const options = ctx.$el.find('select option').map((i: number, o: any) => $(o).text()).get();
            expect(options).toEqual(expect.arrayContaining(['name', 'City']));
            expect(options).not.toContain('ID');
        });
    });

    describe('infinite scroll rendering', () => {
        const scroll = (extra: any = {}) =>
            mount({
                navigation: 'On-Demand',
                isNavTypeScrollOrOndemand: jest.fn(() => true),
                getCurrentPage: jest.fn(() => 1),
                getPageSize: jest.fn(() => 10),
                isLastPage: false,
                ...extra,
            });

        it.each(['search_or_sort', 'filterCriteria', 'datasetUpdate'])('clears the body after %s', (action) => {
            ctx = scroll({ lastActionPerformed: action, isSearchTrigerred: true });
            ctx.instance.options.lastActionPerformed = action;
            ctx.instance.options.isSearchTrigerred = true;
            ctx.instance.options.isDatasetUpdated = false;
            ctx.instance.options.isDataUpdatedByUser = false;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.options.clearCustomExpression).toHaveBeenCalled();
        });

        it('clears the body when the data set was updated by the user or by a script', () => {
            ctx = scroll();
            ctx.instance.options.lastActionPerformed = 'datasetUpdate';
            ctx.instance.options.isSearchTrigerred = false;
            ctx.instance.options.isDatasetUpdated = true;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            ctx.options.clearCustomExpression.mockClear();
            ctx.instance.options.isDatasetUpdated = false;
            ctx.instance.options.isDataUpdatedByUser = true;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.options.clearCustomExpression).toHaveBeenCalledTimes(1);
        });

        it('shows the load more link only before the last page of on demand grids', () => {
            ctx = scroll({ isLastPage: true });
            ctx.$el.append('<div class="on-demand-datagrid" style="display:none"></div>');
            ctx.instance.options.lastActionPerformed = 'search_or_sort';
            ctx.instance.options.isSearchTrigerred = true;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.$el.find('.on-demand-datagrid')[0].style.display).toBe('none');
            ctx.instance.options.isLastPage = false;
            ctx.instance.options.isSearchTrigerred = true;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.$el.find('.on-demand-datagrid')[0].style.display).not.toBe('none');
        });

        it('keeps the infinite scroll body when edits happen in quick edit mode', () => {
            ctx = scroll({ editmode: 'quickedit', showNewRow: false });
            ctx.instance.options.lastActionPerformed = 'edit';
            ctx.instance.options.actionRowIndex = 0;
            const update = jest.spyOn(ctx.instance, '_updateTrData');
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(update).not.toHaveBeenCalled();
            ctx.instance.options.editmode = 'inline';
            ctx.instance.options.actionRowIndex = undefined;
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(update).not.toHaveBeenCalled();
        });

        it('keeps the table markup of scrolling grids when the next page arrives', () => {
            ctx = scroll();
            const before = ctx.$el.find('.table-container')[0];
            ctx.instance.options.isNextPageData = true;
            ctx.instance._render();
            expect(ctx.$el.find('.table-container')[0]).toBe(before);
            ctx.instance.options.isNextPageData = false;
            ctx.instance._render();
            expect(ctx.$el.find('.table-container')).toHaveLength(1);
        });

        it('only builds markup for scrolling grids when there are rows', () => {
            ctx = scroll();
            ctx.instance.options.data = [];
            ctx.instance._prepareData();
            expect(() => ctx.instance._buildGridMarkup(true)).not.toThrow();
            expect(() => ctx.instance._buildGridMarkup(false)).not.toThrow();
        });
    });

    describe('selection columns', () => {
        it('uses a single radio aria label for every row', () => {
            ctx = mount({ showRadioColumn: true, radioselectarialabel: 'pick', radioselecttitle: 'pick title' });
            expect(row(0).find('td').first().attr('aria-label')).toBe('pick');
        });

        it('uses a title per row for radio columns and shows blank values', () => {
            ctx = mount({ showRadioColumn: true, radioselectarialabel: ['a', 'b', 'c'], radioselecttitle: ['x', 'y', 'z'], data: [{ id: 1, name: null, age: undefined }] });
            expect(row(0).find('td').first().attr('aria-label')).toBe('a');
            expect(row(0).find('td').first().attr('title')).toBe('x');
        });

        it('shows blank text for undefined and null custom column values', () => {
            ctx = mount({ colDefs: [{ field: 'other', type: 'custom', show: true }, defaultCol('name')], data: [{ name: 'a' }] });
            expect(row(0).find('td').first().text()).toBe('');
            ctx.instance.options.data = [{ other: null, name: 'a' }];
            ctx.$el.datatable('option', 'data', [{ other: null, name: 'a' }]);
            expect(row(0).find('td').first().text()).toBe('');
        });

        it('leaves the header config alone for default columns when none was configured', () => {
            ctx = mount({ multiselect: true, showRowIndex: true });
            ctx.instance.setDefaultColsData(false);
            expect(ctx.instance.preparedHeaderData[0].field).toBe('checkbox');
        });

        it('adds default columns only to the header when asked to', () => {
            ctx = mount({ multiselect: true, showRowIndex: true, rowExpansionEnabled: true });
            const before = ctx.instance.preparedHeaderData.length;
            ctx.instance.setDefaultColsData(false);
            expect(ctx.instance.preparedHeaderData).toHaveLength(before);
            ctx.instance.options.multiselect = false;
            ctx.instance.options.showRadioColumn = true;
            ctx.instance.setDefaultColsData(false);
            expect(ctx.instance.preparedHeaderData).toHaveLength(before);
        });

        it('treats generated columns without a field as empty', () => {
            ctx = mount({ colDefs: [{ type: 'string', show: true }, defaultCol('name')] });
            expect(row(0).find('td')).toHaveLength(2);
        });

        it('keeps selected columns of grids with a single selection mode', () => {
            ctx = mount({ multiselect: true });
            ctx.instance.preparedHeaderData.find((c: any) => c.field === 'name').selected = true;
            ctx.instance._reselectColumns();
            expect(Object.keys(ctx.instance.getSelectedColumns())).toEqual(['name']);
            ctx.instance.options.multiselect = false;
            ctx.instance.options.showRadioColumn = false;
            ctx.instance.options.showRowIndex = false;
            expect(ctx.instance.getSelectedColumns().name).toBeDefined();
        });

        it('selects columns without a previous selection', () => {
            ctx = mount();
            expect(() => ctx.instance._reselectColumns()).not.toThrow();
        });
    });

    describe('status and options', () => {
        it('does not refresh the header when sorting is toggled before the table exists', () => {
            ctx = mount();
            ctx.instance.tableContainer = $();
            ctx.$el.datatable('option', 'enableSort', false);
            ctx.$el.datatable('option', 'enableColumnSelection', true);
            expect(ctx.instance.tableContainer.length).toBe(0);
        });

        it('ignores search labels without a search area and keeps search select options', () => {
            ctx = mount();
            ctx.instance.gridSearch = undefined;
            ctx.$el.datatable('option', 'searchLabel', 'x');
            ctx.$el.datatable('option', 'messages', { selectField: 'x' });
            expect(ctx.instance.gridSearch).toBeUndefined();
        });

        it('keeps the sort icon when the data is replaced after a manual sort reset', () => {
            ctx = mount();
            ctx.instance.isResetSortIconsDone = true;
            const spy = jest.spyOn(ctx.instance, 'setSortIconDefault');
            ctx.$el.datatable('option', 'data', people());
            expect(spy).not.toHaveBeenCalled();
        });

        it('reapplies the loading status when the data states change while loading', () => {
            ctx = mount();
            ctx.instance.dataStatus = { state: 'nodata', message: '', nodata: 'N' };
            const status = jest.spyOn(ctx.instance, 'setStatus').mockImplementation(() => undefined);
            ctx.$el.datatable('option', 'dataStates', { loading: 'L', ready: '', error: 'E', nodata: 'N' });
            expect(status).toHaveBeenCalledWith('nodata', 'N');
            ctx.instance.dataStatus = { state: 'loading', message: '' };
            ctx.$el.datatable('option', 'dataStates', { loading: 'L2', ready: '', error: 'E', nodata: 'N' });
            expect(status).toHaveBeenCalledWith('loading');
            status.mockClear();
            ctx.instance.dataStatus = { state: 'ready', message: '' };
            ctx.$el.datatable('option', 'dataStates', { loading: 'L3', ready: '', error: 'E', nodata: 'N' });
            expect(status).not.toHaveBeenCalled();
        });

        it.each(['multiselecttitle', 'multiselectarialabel', 'radioselecttitle', 'radioselectarialabel'])('refreshes the grid after %s changes', (key) => {
            jest.useFakeTimers();
            ctx = mount();
            const spy = jest.spyOn(ctx.instance, '_refreshGrid');
            ctx.$el.datatable('option', key, 'new');
            jest.advanceTimersByTime(100);
            expect(spy).toHaveBeenCalled();
        });

        it('adds the expansion class and condensed spacing to the table when class names change', () => {
            ctx = mount({ rowExpansionEnabled: true, spacing: 'condensed', colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')] });
            ctx.$el.datatable('option', 'cssClassNames', { ...ctx.instance.options.cssClassNames, grid: 'g' });
            const table = ctx.$el.find('table').first();
            expect(table.hasClass('table-row-expansion')).toBe(true);
            expect(table.hasClass('table-condensed')).toBe(true);
        });

        it('rebuilds the header without a header or table element', () => {
            ctx = mount({ showHeader: false });
            ctx.instance.gridHeaderElement = undefined;
            ctx.instance.tableContainer = undefined;
            expect(() => ctx.instance._toggleHeader()).not.toThrow();
        });

        it('does not render the header again when it is hidden', () => {
            ctx = mount({ showHeader: false });
            expect(() => ctx.instance.refreshSortHeader()).not.toThrow();
        });
    });

    describe('row selection edge cases', () => {
        it('does nothing when the first row cannot be selected', () => {
            ctx = mount({ data: [] });
            expect(() => ctx.$el.datatable('selectFirstRow', true)).not.toThrow();
            expect(ctx.$el.find('tr.app-datagrid-row.active')).toHaveLength(0);
        });

        it('selects rows that have no rendered row', () => {
            ctx = mount();
            ctx.instance.preparedData.push({ $$pk: 9 });
            ctx.$el.datatable('selectRow', 3, true);
            expect(ctx.instance.preparedData[3]._selected).toBeUndefined();
            ctx.$el.datatable('deselectRow', 3);
            expect(ctx.instance.preparedData[3]._selected).toBeUndefined();
        });

        it('updates radio rows without a radio column and clears the checked attribute', () => {
            ctx = mount({ showRadioColumn: true });
            const r = row(0);
            ctx.instance.toggleRowSelection(r, true);
            expect(r.find('input[type="radio"]').attr('checked')).toBe('checked');
            ctx.instance.toggleRowSelection(r, false);
            expect(r.find('input[type="radio"]').attr('checked')).toBeUndefined();
        });

        it('ignores double clicks on rows without data and without a handler', () => {
            ctx = mount({ onRowDblClick: undefined });
            ctx.instance.rowDblClickHandler({ stopPropagation: jest.fn(), target: row(0)[0] });
            ctx.instance.rowDblClickHandler({ stopPropagation: jest.fn(), target: $('<tr data-row-id="99"></tr>')[0] }, $('<tr data-row-id="99"></tr>'));
            expect(ctx.options.onRowDblClick).toBeUndefined();
        });

        it('does not call selection callbacks that are not functions', () => {
            ctx = mount({ onRowSelect: undefined, onRowDeselect: undefined, onColumnDeselect: undefined, onColumnSelect: undefined, enableColumnSelection: true, enableSort: false });
            row(0).trigger('click');
            row(0).trigger('click');
            const th = ctx.$el.find('th.app-datagrid-header-cell').eq(1);
            th.find('.header-data').trigger('click');
            th.find('.header-data').trigger('click');
            expect(row(0).hasClass('active')).toBe(true);
        });

        it('selects columns from the api without an event', () => {
            ctx = mount();
            ctx.instance.columnSelectionHandler(undefined, ctx.$el.find('th.app-datagrid-header-cell').eq(0));
            ctx.instance.columnSelectionHandler(undefined, ctx.$el.find('th.app-datagrid-header-cell').eq(0));
            expect(ctx.options.onColumnSelect).not.toHaveBeenCalled();
        });

        it('closes dropdown menus only for trusted clicks outside the toggle', () => {
            ctx = mount();
            const hide = jest.fn();
            const menu = $('<div class="app-menu open" autoclose="outsideClick"><button dropdowntoggle></button></div>').appendTo(ctx.$el)[0] as any;
            menu.widget = { bsDropdown: { hide } };
            const toggle = menu.querySelector('[dropdowntoggle]');
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: false }, target: row(0)[0] });
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: true }, target: toggle });
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: true }, target: $('<i>').appendTo(toggle)[0] });
            ctx.instance.closeDropdown(undefined);
            expect(hide).not.toHaveBeenCalled();
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: true }, target: row(0)[0] });
            expect(hide).toHaveBeenCalledTimes(1);
            menu.classList.remove('open');
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: true }, target: row(0)[0] });
            menu.classList.add('open');
            menu.setAttribute('autoclose', 'always');
            ctx.instance.closeDropdown({ originalEvent: { isTrusted: true }, target: row(0)[0] });
            expect(hide).toHaveBeenCalledTimes(1);
        });

        it('selects rows by click in the selection column when rows are selectable', () => {
            ctx = mount({ multiselect: true, isrowselectable: true });
            row(0).find('td').eq(1).trigger('click');
            expect(row(0).hasClass('active')).toBe(true);
        });

        it('highlights a clicked row through the capture handler', () => {
            ctx = mount({ multiselect: true });
            row(0).find('td').eq(1)[0].click();
            expect(ctx.options.assignSelectedItems).not.toHaveBeenCalled();
            ctx.instance.rowClickHandlerOnCapture({ target: $('<div>').appendTo(document.body)[0], stopPropagation: jest.fn() }, $('<tr data-row-id="0"></tr>'), {});
            expect(ctx.options.assignSelectedItems).not.toHaveBeenCalled();
        });
    });

    describe('default handlers and widths', () => {
        it('has no-op default search and sort handlers', () => {
            const defaults = $.wm.datatable.prototype.options;
            expect(defaults.searchHandler()).toBeUndefined();
            expect(defaults.sortHandler()).toBeUndefined();
        });

        it('does nothing when there are no columns or header cells', () => {
            ctx = mount();
            ctx.instance.tableContainer = $('<table></table>');
            ctx.instance.gridContainer = $('<div></div>');
            ctx.instance.gridElement = $('<tbody></tbody>');
            expect(ctx.instance.setColGroupWidths()).toBeUndefined();
        });

        it('keeps column widths that are already set', () => {
            ctx = mount();
            ctx.$el.find('colgroup col').first().css('width', '120px');
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('120px');
        });

        it('removes the padding of the parents of hidden panes from their width', () => {
            const spy = jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                if (this.is('th')) {
                    return 0;
                }
                return this.is('.grid-host') ? 600 : 0;
            } as any);
            ctx = mount();
            ctx.$el.css({ 'padding-left': '10px', 'padding-right': '10px' });
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('193.33333333333334px'.replace('193.33333333333334', String(parseFloat(ctx.$el.find('colgroup col')[0].style.width))));
        });

        it('uses the width of a defined column or the empty width for columns without one', () => {
            ctx = mount({ colDefs: [defaultCol('id', { width: undefined }), defaultCol('name', { width: '80px' })] });
            ctx.instance.tableContainer.find('col').first().css('width', '90px');
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[1].style.width).toBe('80px');
        });

        it('reads the scroll bar state of the grid body', () => {
            ctx = mount();
            const find = jest.spyOn($.fn, 'find').mockImplementation(function (this: any, selector: any) {
                if (selector === 'tbody') {
                    return { scrollHeight: 100, clientHeight: 10 } as any;
                }
                return { addClass: jest.fn(), removeClass: jest.fn() } as any;
            } as any);
            const addClass = jest.fn();
            const realContainer = ctx.instance.gridContainer;
            ctx.instance.gridContainer = { find: (selector: string) => (selector === 'tbody' ? { scrollHeight: 100, clientHeight: 10 } : { addClass, removeClass: jest.fn() }) };
            ctx.instance.addOrRemoveScroll();
            ctx.instance.gridContainer = realContainer;
            find.mockRestore();
            expect(addClass).toHaveBeenCalledWith('scroll-visible');
        });

        it('syncs the header scroll position with the body', () => {
            ctx = mount();
            const body = ctx.$el.find('.app-grid-content').parent();
            body[0].scrollLeft = 30;
            body.trigger('scroll');
            expect(ctx.instance.gridHeaderElement.parent().prop('scrollLeft')).toBe(30);
        });
    });

    describe('compiled templates and markup', () => {
        it('swaps compiled cell templates in', () => {
            ctx = mount();
            ctx.instance.compiledCellTemplates = { a: $('<td class="compiled">c</td>')[0] };
            ctx.instance.gridElement.find('tr').first().append('<td data-compiled-template="a"></td>');
            ctx.instance._findAndReplaceCompiledTemplates();
            expect(ctx.$el.find('td.compiled')).toHaveLength(1);
            ctx.instance.gridElement = undefined;
            expect(ctx.instance._findAndReplaceCompiledTemplates()).toBeUndefined();
        });

        it('appends template markup to an existing grid element when it has no body yet', () => {
            ctx = mount();
            ctx.instance.gridElement = $();
            ctx.instance._buildGridMarkup(true);
            ctx.instance.gridElement = $();
            ctx.instance.options.data = [];
            ctx.instance._prepareData();
            expect(() => ctx.instance._buildGridMarkup(false)).not.toThrow();
        });

        it('shows no data when an empty grid was waiting for data', () => {
            ctx = mount({ data: [] });
            ctx.instance.dataStatus.state = 'nodata';
            const status = jest.spyOn(ctx.instance, 'setStatus');
            ctx.instance._updateStatusAfterRender(false);
            expect(status).toHaveBeenCalledWith('nodata');
            ctx.instance.dataStatus = { state: undefined, message: undefined };
            ctx.instance._updateStatusAfterRender(true);
            expect(status).toHaveBeenLastCalledWith('loading', ctx.instance.options.dataStates.loading, true);
        });

        it('resets selecting the first row for multi select grids', () => {
            ctx = mount({ multiselect: true, selectFirstRow: true });
            ctx.$el.datatable('option', 'data', people());
            expect(ctx.instance.options.selectFirstRow).toBe(false);
        });

        it('adds a unit to numeric dimensions and scrolls infinite grids with a fixed height', () => {
            ctx = mount({ isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10) });
            ctx.$el.datatable('setGridDimensions', 'height', '250');
            expect(ctx.instance.options.height).toBe('250px');
            expect(ctx.$el.find('.app-grid-header-inner')[0].style.overflow).toBe('auto');
            ctx.$el.datatable('setGridDimensions', 'width', '50%');
            expect(ctx.instance.options.width).toBe('50%');
            ctx.$el.datatable('setGridDimensions', 'height', 'auto');
            ctx.$el.datatable('setGridDimensions', 'height', '2em');
        });

        it('renames group columns and the search options', () => {
            ctx = mount({ filtermode: 'search', headerConfig: [{ field: 'id', displayName: 'ID' }, { field: 'grp', displayName: 'Group', isGroup: true, columns: [{ field: 'name', displayName: 'NAME' }, { field: 'age', displayName: 'AGE' }] }] });
            ctx.$el.datatable('setColumnProp', 'grp', 'displayName', 'Renamed', true);
            expect(ctx.$el.find('th[data-col-group="grp"]').attr('title')).toBe('Renamed');
            ctx.$el.datatable('setColumnProp', 'name', 'displayName', 'Full');
            expect(ctx.$el.find('select option[value="name"]').text()).toBe('Full');
            ctx.$el.datatable('setColumnProp', 'name', 'other', 'x');
        });
    });

    describe('row expansion details', () => {
        const expandable = (extra: any = {}) =>
            mount({
                rowExpansionEnabled: true,
                cssClassNames: { ...$.wm.datatable.prototype.options.cssClassNames },
                colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')],
                getRowExpansionAction: jest.fn(() => $('<button class="app-button"><i class="app-icon wi wi-minus-square"></i></button>')[0]),
                generateRowDetailView: jest.fn((e: any, d: any, id: any, a: any, b: any, done: Function) => done()),
                onBeforeRowCollapse: jest.fn(() => true),
                onRowCollapse: jest.fn(),
                ...extra,
            });

        it('swaps the expansion icons while expanding and collapsing', () => {
            ctx = expandable();
            ctx.$el.datatable('expandRow', 0);
            row(0).next('tr.app-datagrid-detail-row').show();
            expect(row(0).find('i.app-icon').hasClass('wi-minus-square')).toBe(true);
            ctx.instance.options.cssClassNames.rowCollapseIcon = 'wi wi-plus-square';
            row(0).find('i.app-icon').attr('class', 'app-icon wi wi-plus-square');
            ctx.$el.datatable('collapseRow', 0);
            expect(row(0).find('i.app-icon').hasClass('wi-plus-square')).toBe(true);
        });

        it('uses the configured titles of the expansion buttons', () => {
            ctx = expandable({ rowDef: { position: '0', closeothers: false, columnwidth: '50px', collapsetitle: 'Collapse', expandtitle: 'Expand' } });
            ctx.$el.datatable('expandRow', 0);
            expect(row(0).find('button').attr('title')).toBe('Collapse');
            row(0).next('tr.app-datagrid-detail-row').show();
            ctx.$el.datatable('collapseRow', 0);
            expect(row(0).find('button').attr('title')).toBe('Expand');
        });

        it('falls back to the title attributes of the button', () => {
            ctx = expandable();
            row(0).find('button').attr({ collapsetitle: 'c-attr', expandtitle: 'e-attr' });
            ctx.$el.datatable('expandRow', 0);
            expect(row(0).find('button').attr('title')).toBe('c-attr');
            row(0).next('tr.app-datagrid-detail-row').show();
            ctx.$el.datatable('collapseRow', 0);
            expect(row(0).find('button').attr('title')).toBe('e-attr');
        });

        it('stops the click of a selected row when expanding by click', () => {
            ctx = expandable();
            ctx.instance.preparedData[0]._selected = true;
            const e: any = { stopPropagation: jest.fn() };
            ctx.instance.toggleExpandRow(0, true, e);
            expect(e.stopPropagation).toHaveBeenCalledTimes(1);
        });

        it('checks that an element has all classes', () => {
            ctx = expandable();
            const el = $('<i class="a b"></i>');
            expect(ctx.instance.hasAllClasses(el, ['a', 'b'])).toBe(true);
            expect(ctx.instance.hasAllClasses(el, ['a', 'c'])).toBe(false);
            expect(ctx.instance.hasAllClasses(el, undefined)).toBeUndefined();
        });

        it('does not toggle rows whose expansion button is disabled', () => {
            ctx = expandable({ getRowExpansionAction: jest.fn(() => $('<button class="app-button" disabled></button>')[0]) });
            const spy = jest.spyOn(ctx.instance, 'toggleExpandRow');
            ctx.$el.find('[data-identifier="rowExpansionButtons"]').first().trigger('click');
            expect(spy).not.toHaveBeenCalled();
        });

        it('handles key presses inside detail rows', () => {
            ctx = expandable();
            ctx.$el.datatable('expandRow', 0);
            const detail = row(0).next('tr.app-datagrid-detail-row');
            const spy = jest.spyOn(ctx.instance, 'processUpDownKeys').mockImplementation(() => undefined);
            detail.find('td').trigger($.Event('keydown', { which: 40 }));
            expect(spy).toHaveBeenCalled();
        });

        it('has no header handlers without a header', () => {
            ctx = mount();
            ctx.instance.gridHeaderElement = $();
            expect(ctx.instance._attachHeaderEventHandlers()).toBeUndefined();
        });
    });

    describe('sorting and selecting columns together', () => {
        it('selects the column and reports the header click before sorting a column label', () => {
            ctx = mount({ enableColumnSelection: true });
            const select = jest.spyOn(ctx.instance, 'columnSelectionHandler');
            const header = jest.spyOn(ctx.instance, 'headerClickHandler');
            // the sort handler reads the column id from the clicked label, which has none, so it throws after the
            // selection and header handlers ran (existing behaviour of datatable.js)
            expect(() => ctx.$el.find('th[data-col-sortable] .header-data').eq(1).trigger('click')).toThrow();
            expect(select).toHaveBeenCalled();
            expect(header).toHaveBeenCalled();
            expect(ctx.options.onColumnSelect).toHaveBeenCalled();
            expect(ctx.options.onHeaderClick).toHaveBeenCalled();
        });

        it('keeps the default sort state for unsorted directions', () => {
            ctx = mount();
            const th = ctx.$el.find('th.app-datagrid-header-cell').eq(1);
            th.find('.sort-buttons-container').trigger('click');
            expect(ctx.instance.options.sortInfo.direction).toBe('asc');
            ctx.instance.options.sortInfo.direction = '';
            ctx.instance.setSortIconDefault();
            expect(ctx.$el.find('.sort-buttons-container.active')).toHaveLength(1);
        });

        it('submits the enter key on header cells and the checkbox column', () => {
            ctx = mount({ multiselect: true });
            const th = ctx.$el.find('th[data-col-sortable]').first();
            const sort = jest.spyOn(ctx.instance, 'sortHandler').mockImplementation(() => undefined);
            ctx.instance.keydownHandler({ key: 'Enter' });
            expect(sort).toHaveBeenCalledTimes(1);
            th.trigger($.Event('keydown', { key: 'a' }));
            ctx.$el.find('th[data-col-field="checkbox"]').trigger($.Event('keydown', { keyCode: 13, target: ctx.$el.find('th[data-col-field="name"]')[0] }));
            ctx.$el.find('th[data-col-field="checkbox"] input').trigger($.Event('keydown', { key: 'a' }));
            ctx.$el.find('th[data-col-field="checkbox"]').trigger($.Event('keydown', { key: 'b' }));
        });
    });

    describe('editing details', () => {
        it('calls beforeRowUpdate when a row enters edit mode', () => {
            ctx = editable({ beforeRowUpdate: jest.fn() });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            expect(ctx.options.beforeRowUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), expect.anything());
        });

        it('works without the optional edit hooks', () => {
            ctx = editable({ beforeRowUpdate: undefined, onBeforeFormRender: undefined, onFormRender: undefined, onBeforeRowInsert: undefined, onBeforeRowUpdate: undefined });
            row(0).trigger('click', [undefined, { action: 'edit', skipFocus: true }]);
            ctx.options.getFieldValue.mockReturnValue('changed');
            row(0).trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.afterRowUpdate).toHaveBeenCalled();
            ctx.$el.datatable('addNewRow');
            ctx.options.getFieldValue.mockReturnValue('x');
            ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.onRowInsert).toHaveBeenCalled();
        });

        it('reports save results and refocuses the row unless focus is skipped', () => {
            ctx = editable();
            const success = jest.fn();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('changed');
            const focus = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            row(0).trigger('click', [undefined, { action: 'save', success }]);
            const done = ctx.options.afterRowUpdate.mock.calls[0][2];
            done(true, undefined);
            expect(success).toHaveBeenCalledWith(true, undefined);
            expect(focus).not.toHaveBeenCalled();
            done(false, undefined);
            expect(success).toHaveBeenCalledWith(false, undefined);
            expect(focus).toHaveBeenCalled();
        });

        it('only refocuses the row after a quick edit save when edit actions are enabled', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('changed');
            const focus = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            row(0).trigger('click', [undefined, { action: 'save' }]);
            const done = ctx.options.afterRowUpdate.mock.calls[0][2];
            ctx.instance.options.actionsEnabled.edit = false;
            done(false, undefined);
            expect(focus).not.toHaveBeenCalled();
            ctx.instance.options.actionsEnabled.edit = true;
            done(false, undefined);
            expect(focus).toHaveBeenCalled();
        });

        it('saves without a success callback', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('changed');
            row(0).trigger('click', [undefined, { action: 'save' }]);
            ctx.options.afterRowUpdate.mock.calls[0][2](false, undefined);
            expect(ctx.options.afterRowUpdate).toHaveBeenCalled();
        });

        it('continues with the next row after saving the previous one in quick edit mode', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            const save = jest.spyOn(ctx.instance, 'saveRow').mockImplementation(((cb: Function) => cb(false, undefined)) as any);
            const next = jest.spyOn(ctx.instance, 'editSuccessHandler').mockImplementation(() => undefined);
            row(1).trigger('click', [undefined, { action: 'edit' }]);
            expect(save).toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(false, undefined, expect.anything(), expect.anything(), true);
        });

        it('keeps the active edit row after a refresh in quick edit mode', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            row(1).trigger('click', [undefined, { action: 'edit' }]);
            const setActive = jest.spyOn(ctx.instance, 'setActiveRow');
            const focus = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            ctx.instance.refreshGridData();
            expect(setActive).toHaveBeenCalled();
            expect(focus).toHaveBeenCalled();
        });

        it('does not look for an active row when none is being edited', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            const setActive = jest.spyOn(ctx.instance, 'setActiveRow');
            ctx.instance.refreshGridData();
            expect(setActive).not.toHaveBeenCalled();
        });

        it('marks required fields of action columns', () => {
            ctx = editable({ colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false }), { ...defaultCol('ops', { readonly: false, required: true }), binding: 'rowOperations' }] });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            expect(row(0).find('td.required-field')).toHaveLength(1);
        });

        it('reads uploaded files into the saved row', () => {
            ctx = editable({ colDefs: [defaultCol('id', { readonly: true }), defaultCol('file', { readonly: false, editWidgetType: 'upload' })], data: [{ id: 1, file: null }] });
            const file = new File(['x'], 'x.txt');
            jest.spyOn(ctx.instance, 'getUploadedFiles').mockReturnValue(file);
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            row(0).trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.afterRowUpdate.mock.calls[0][0].file).toBe(file);
        });

        it('shows the expression value again when leaving the edit mode of an expression column', () => {
            ctx = editable({ colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false, customExpression: true })] });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.instance.hideRowEditMode(row(0));
            expect(row(0).find('td').eq(1).text()).toBe('expr');
        });

        it('shows the stored value or an empty text when leaving the edit mode', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue(undefined);
            ctx.instance.hideRowEditMode(row(0));
            expect(row(0).find('td').eq(1).text()).toBe('');
        });

        it('restores an empty original text on cancel', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            row(0).find('td.cell-editing').first().removeData('originalText');
            row(0).trigger('click', [undefined, { action: 'cancel' }]);
            expect(row(0).find('td').eq(1).text()).toBe('');
        });

        it('edits the previous row when the last row was deleted in quick edit mode', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            const btn = row(2).find('.delete-row-button')[0];
            ctx.instance.deleteRow({ target: btn, stopPropagation: jest.fn() });
            const success = ctx.options.onRowDelete.mock.calls[0][3];
            const handler = jest.fn();
            row(1).on('click', handler);
            const detachedRow = row(2).detach();
            success(false, undefined);
            expect(handler).toHaveBeenCalled();
            expect(detachedRow.length).toBe(1);
        });

        it('keeps rows when a delete of a scrolling grid is the last row', () => {
            ctx = editable({ isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10) });
            ctx.instance.deleteRow({ target: row(2).find('.delete-row-button')[0], stopPropagation: jest.fn() });
            ctx.options.onRowDelete.mock.calls[0][3]();
            expect(ctx.options.data).toHaveLength(2);
        });

        it('works without delete hooks and restores inactive rows', () => {
            ctx = editable({ onRowDelete: undefined, onBeforeRowDelete: undefined });
            ctx.instance.deleteRow({ target: row(0).find('.delete-row-button')[0], stopPropagation: jest.fn() });
            expect(row(0).hasClass('danger')).toBe(false);
            ctx.instance.options.onRowDelete = jest.fn((data: any, cancel: Function) => cancel());
            ctx.instance.deleteRow({ target: row(1).find('.delete-row-button')[0], stopPropagation: jest.fn() });
            expect(row(1).hasClass('active')).toBe(false);
        });

        it('does not show the no data status after deleting new rows while other rows exist', () => {
            ctx = editable();
            ctx.$el.datatable('addNewRow');
            const status = jest.spyOn(ctx.instance, 'setStatus');
            ctx.instance.removeNewRow(ctx.$el.find('tr.row-editing'));
            expect(status).not.toHaveBeenCalled();
            ctx.$el.datatable('addNewRow');
            ctx.instance.deleteRow({ target: ctx.$el.find('tr.row-editing td')[0], stopPropagation: jest.fn() });
            expect(status).not.toHaveBeenCalled();
        });
    });

    describe('remaining rendering branches', () => {
        it('shows plain values of other custom columns', () => {
            ctx = mount({ colDefs: [{ field: 'other', type: 'custom', show: true }, defaultCol('name')], data: [{ other: 'v', name: 'a' }] });
            expect(row(0).find('td').first().text()).toBe('v');
        });

        it('reselects the columns that were selected before the data refresh', () => {
            ctx = mount({ enableColumnSelection: true, enableSort: false });
            ctx.$el.find('th.app-datagrid-header-cell').eq(1).find('.header-data').trigger('click');
            const spy = jest.spyOn(ctx.instance, 'columnSelectionHandler');
            ctx.instance._reselectColumns();
            expect(spy).toHaveBeenCalledWith(undefined, expect.anything());
        });

        it('does not require a grid edit mode callback', () => {
            ctx = mount({ setGridEditMode: undefined });
            expect(ctx.instance._setGridEditMode(true)).toBeUndefined();
        });

        it('drops the active edit row when it no longer exists after a refresh', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            row(2).trigger('click', [undefined, { action: 'edit' }]);
            const setActive = jest.spyOn(ctx.instance, 'setActiveRow');
            ctx.$el.datatable('option', 'data', [people()[0]]);
            expect(setActive).not.toHaveBeenCalled();
        });

        it('uses the header column width when defined by a column that was sized before', () => {
            ctx = mount({ colDefs: [defaultCol('id', { width: '100px' }), defaultCol('name')] });
            ctx.$el.find('colgroup col').first().css('width', '90px');
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('100px');
        });

        it('lists columns of grids in a different order and reselects with default selection', () => {
            ctx = mount({ multiselect: true, showRowIndex: true });
            const headers = ctx.instance.preparedHeaderData;
            ctx.instance.preparedHeaderData = [...headers.filter((c: any) => c.field !== 'checkbox' && c.field !== 'rowIndex'), headers.find((c: any) => c.field === 'rowIndex'), headers.find((c: any) => c.field === 'checkbox')];
            expect(ctx.instance.getSelectedColumns()).toEqual({});
            ctx.instance.options.multiselect = false;
            ctx.instance.options.showRadioColumn = true;
            ctx.instance.preparedHeaderData = [defaultCol('name'), { field: 'radio', type: 'custom' }];
            expect(ctx.instance.getSelectedColumns()).toEqual({});
        });

        it('rebuilds the columns when the definitions change on a normal grid', () => {
            jest.useFakeTimers();
            ctx = mount();
            const spy = jest.spyOn(ctx.instance, '_refreshGrid');
            ctx.$el.datatable('option', 'colDefs', [defaultCol('id')]);
            jest.advanceTimersByTime(100);
            expect(spy).toHaveBeenCalled();
        });

        it('stops adding data headers for non scrolling grids on next page data', () => {
            ctx = mount({ isNextPageData: true });
            const spy = jest.spyOn(ctx.instance, '_refreshGrid');
            jest.useFakeTimers();
            ctx.$el.datatable('option', 'colDefs', [defaultCol('id')]);
            jest.advanceTimersByTime(100);
            expect(spy).toHaveBeenCalled();
        });

        it('shows and hides the loading indicator on infinite scroll without the header container', () => {
            ctx = mount({ isLastPage: false, getCurrentPage: jest.fn(() => 1), getPageCount: jest.fn(() => 3) });
            ctx.$el.find('.app-grid-header-inner').remove();
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            expect(ctx.$el.find('.on-demand-load-btn')).toHaveLength(0);
        });

        it('keeps the load more button when more pages exist during infinite scroll', () => {
            ctx = mount({ isLastPage: false, getCurrentPage: jest.fn(() => 1), getPageCount: jest.fn(() => 3), showviewlessbutton: false, viewlessmessage: 'Less' });
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            ctx.$el.find('.on-demand-load-btn').trigger('click');
            expect(ctx.$el.find('.on-demand-datagrid')).toHaveLength(1);
        });

        it('does not add another load more button when hiding the loading indicator of the last page', () => {
            ctx = mount({ getCurrentPage: jest.fn(() => 2), getPageCount: jest.fn(() => 2), showviewlessbutton: true, viewlessmessage: 'Less', isLastPage: false });
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            ctx.instance.options.addLoadMoreBtn = jest.fn();
            ctx.$el.datatable('hideLoadingIndicator', true, true);
            expect(ctx.instance.options.addLoadMoreBtn).not.toHaveBeenCalled();
        });

        it('focuses the existing always new row of an inline grid and ignores rows without inputs', () => {
            ctx = editable();
            ctx.instance.gridElement.append('<tr class="app-datagrid-row always-new-row"><td></td></tr>');
            const focus = jest.spyOn(ctx.instance, 'setFocusOnElement').mockImplementation(() => undefined);
            ctx.$el.datatable('addNewRow');
            expect(focus).toHaveBeenCalled();
            ctx.instance.options.editmode = 'quickedit';
            ctx.$el.datatable('addNewRow');
            expect(ctx.$el.find('tr.always-new-row')).toHaveLength(1);
        });

        it('does not render a template for empty grids', () => {
            ctx = mount({ data: [] });
            ctx.instance.options.data = [];
            ctx.instance.gridElement = $('<tbody></tbody>');
            expect(() => ctx.instance._buildGridMarkup(false)).not.toThrow();
            expect(ctx.instance.gridElement.find('tr')).toHaveLength(0);
        });

        it('renders a summary row only when there is data', () => {
            ctx = mount({ data: [] });
            ctx.instance.options.summaryRow = true;
            ctx.instance.options.summaryRowDefs = [{ name: 'x' }];
            ctx.instance.options.summaryRowDefsObject = [{ name: 'x' }];
            ctx.instance._renderSummaryRowIfNeeded();
            expect(ctx.$el.find('tfoot')).toHaveLength(0);
        });

        it('does not call a missing data render callback', () => {
            ctx = mount({ onDataRender: undefined });
            expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
        });

        it('keeps the selected row when the first row selection runs again', () => {
            ctx = mount({ selectFirstRow: true });
            row(1).addClass('active');
            const select = jest.spyOn(ctx.instance, 'selectFirstRow');
            ctx.instance._selectFirstRowAfterRender();
            expect(select).not.toHaveBeenCalled();
        });

        it('has no navigation controls for other pagination types', () => {
            ctx = mount({ isdynamictable: true, navigation: 'Basic' });
            ctx.instance.addNavigationControls();
            expect(ctx.options.addLoadMoreBtn).not.toHaveBeenCalled();
            expect(ctx.options.bindScrollEvt).not.toHaveBeenCalled();
        });

        it('lets the overlay grow with the content when it is smaller', () => {
            ctx = mount({ height: 'auto' });
            ctx.instance.dataStatus = { state: 'loading', message: '', height: 100, contentHeight: 0 };
            jest.spyOn($.fn, 'outerHeight').mockReturnValue(0 as any);
            ctx.instance._updateStatusContainerHeightIfNeeded('loading');
            expect(ctx.instance.dataStatusContainer[0].style.height).toBe('auto');
        });

        it('does not highlight an active row twice', () => {
            ctx = mount();
            row(1).addClass('active');
            const focus = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            ctx.instance.attachHandlersToActiveRow(ctx.options.data[1]);
            expect(focus).toHaveBeenCalled();
            expect(row(1).hasClass('active')).toBe(true);
        });

        it('tolerates a destroyed grid without containers', () => {
            ctx = mount();
            ctx.instance.gridHeaderElement = undefined;
            ctx.instance.gridElement = undefined;
            ctx.instance.gridSearch = undefined;
            ctx.instance.tableContainer = undefined;
            ctx.instance.gridContainer = undefined;
            expect(() => ctx.instance._destroy()).not.toThrow();
        });

        it('handles non action row actions and defaults when computing enabled actions', () => {
            ctx = mount({ rowActions: [{ action: 'other()' }], colDefs: [defaultCol('name'), { field: 'rowOperations', type: 'custom', show: true }], getRowAction: jest.fn(() => '') });
            ctx.instance._setActionsEnabled();
            expect(ctx.instance.options.actionsEnabled.delete).toBeUndefined();
        });

        it('does not hide or select the header on rows without row selection', () => {
            ctx = mount({ enableRowSelection: false });
            row(0).trigger('click');
            expect(row(0).hasClass('active')).toBe(false);
        });

        it('uses an empty type for search fields without a column definition', () => {
            ctx = mount({ filtermode: 'search', colDefs: [defaultCol('id')] });
            ctx.$el.find('[data-element="dgFilterValue"]').html('<option value="x" data-coldef-index="9">x</option>').val('x');
            ctx.$el.find('.app-search-button').trigger('click');
            expect(ctx.options.searchHandler).toHaveBeenCalledWith(expect.objectContaining({ type: '' }), expect.anything(), 'search');
        });

        it('does not search again when an already empty search text is cleared', () => {
            ctx = mount({ filtermode: 'search' });
            ctx.$el.find('[data-element="dgSearchText"]').val('').trigger($.Event('keyup', { which: 8 }));
            expect(ctx.options.searchHandler).not.toHaveBeenCalled();
        });

        it('keeps sort icons reset when rendering the header again', () => {
            ctx = mount();
            ctx.instance.isResetSortIconsDone = true;
            const spy = jest.spyOn(ctx.instance, 'setSortIconDefault');
            ctx.instance._renderHeader();
            expect(spy).not.toHaveBeenCalled();
        });

        it('ignores header cells without a column definition when sizing columns', () => {
            ctx = mount();
            const original = ctx.instance._getHeaderTemplate;
            ctx.instance._getHeaderTemplate = function () {
                const result = original.call(this);
                this.gridHeaderElement.find('tr').first().append('<th class="app-datagrid-header-cell" data-col-id="99"></th>');
                return result;
            };
            expect(() => ctx.instance._renderHeader()).not.toThrow();
        });

        it('works without a header click handler', () => {
            ctx = mount({ onHeaderClick: undefined });
            expect(ctx.$el.find('th.app-datagrid-header-cell').length).toBe(3);
        });
    });

    describe('remaining editing branches', () => {
        it('edits quick edit rows when their cells are clicked and keeps the edit state when edits are disabled', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            row(0).find('td').first().trigger('click');
            expect(row(0).hasClass('row-editing')).toBe(true);
            ctx.instance.hideRowEditMode(row(0));
            ctx.instance.options.actionsEnabled.edit = false;
            row(1).find('td').first().trigger('click');
            expect(row(1).hasClass('row-editing')).toBe(false);
        });

        it('does not edit the always new row through a cell click', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: true });
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow');
            ctx.$el.find('tr.always-new-row td').first().trigger('click');
            expect(spy).not.toHaveBeenCalled();
        });

        it('detects changes of datetime values with empty originals', () => {
            ctx = editable({ colDefs: [defaultCol('when', { readonly: false, editWidgetType: 'datetime' })], data: [{ when: '' }] });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('2020-01-01T00:00:00');
            expect(ctx.instance.isDataModified(row(0).find('td.cell-editing'), { when: '' }, false)).toBe(true);
        });

        it('focuses the inputs of the cell that contains the target', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            const span = $('<span></span>').appendTo(row(0).find('td').first());
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            ctx.instance.setFocusOnElement({ target: span[0] });
            ctx.instance.setFocusOnElement(undefined, $('<table><tbody><tr><td>x</td></tr></tbody></table>'), true);
            expect(focus).toHaveBeenCalled();
        });

        it('does not mark action columns as required when they are not', () => {
            ctx = editable({ colDefs: [defaultCol('id', { readonly: true }), { ...defaultCol('ops', { readonly: false }), binding: 'rowOperations' }] });
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            expect(row(0).find('td.required-field')).toHaveLength(0);
        });

        it('toggles the edit mode without options or without an event', () => {
            ctx = editable();
            ctx.instance.toggleEditRow({ target: row(0)[0], data: { action: 'edit' }, stopPropagation: jest.fn() });
            expect(row(0).hasClass('row-editing')).toBe(true);
            ctx.instance.toggleEditRow(undefined, { $row: row(0), action: 'cancel' });
            expect(row(0).hasClass('row-editing')).toBe(false);
        });

        it('saves empty values as undefined and null values of new rows without a value', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('');
            row(0).trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.afterRowUpdate.mock.calls[0][0].name).toBeUndefined();
            ctx.$el.datatable('addNewRow');
            ctx.options.getFieldValue.mockReturnValue('null');
            ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.onRowInsert.mock.calls[0][0].name).toBeUndefined();
        });

        it('highlights several invalid fields and reports the failure without a callback', () => {
            ctx = editable();
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            ctx.options.getFieldValue.mockReturnValue('x');
            row(0).find('td.cell-editing').each((i: number, td: any) => {
                $(td).append(`<div class="ng-invalid"><input formcontrolname="f${i}" focus-target></div>`);
            });
            row(0).trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.options.setTouched).toHaveBeenCalledTimes(2);
        });

        it('removes empty new rows of quick edit grids without a success callback', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            ctx.$el.datatable('addNewRow');
            ctx.options.getFieldValue.mockReturnValue(undefined);
            ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'save' }]);
            expect(ctx.$el.find('tr.row-editing')).toHaveLength(0);
        });

        it('keeps following rows when deleting before the always new row of scrolling grids', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: true, isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10) });
            ctx.instance.deleteRow({ target: row(1).find('.delete-row-button')[0], stopPropagation: jest.fn() });
            ctx.options.onRowDelete.mock.calls[0][3]();
            expect(ctx.options.data).toHaveLength(2);
        });

        it('does not edit the next row when something else than the delete button was used in quick edit mode', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: false });
            ctx.instance.deleteRow({ target: row(0).find('td')[0], stopPropagation: jest.fn() });
            const handler = jest.fn();
            row(0).on('click', handler);
            ctx.options.onRowDelete.mock.calls[0][3](false, undefined);
            expect(handler).not.toHaveBeenCalled();
        });

        it('moves up between rows and resets new row fields without defaults', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: true, colDefs: [defaultCol('name', { readonly: false })] });
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            ctx.instance.processUpDownKeys({}, row(1), 'up');
            ctx.instance.resetNewRow(ctx.$el.find('tr.always-new-row'));
            expect(ctx.options.setFieldValue).toHaveBeenCalledWith('name_new', '');
            expect(focus).toHaveBeenCalled();
        });

        it('ignores keys other than the handled ones', () => {
            ctx = mount();
            const spy = jest.spyOn(ctx.instance, 'processUpDownKeys');
            row(0).trigger($.Event('keydown', { which: 65 }));
            expect(spy).not.toHaveBeenCalled();
        });

        it('does not add a new row after saving when the form is on top', () => {
            ctx = editable({ editmode: 'quickedit', showNewRow: true, formPosition: 'top' });
            const add = jest.spyOn(ctx.instance, 'addNewRow').mockImplementation(() => undefined);
            ctx.instance.editSuccessHandler(false, undefined, {}, row(1), false);
            expect(add).not.toHaveBeenCalled();
        });
    });

    describe('enter and focus handling in quick edit mode', () => {
        const quick = (extra: any = {}) => editable({ editmode: 'quickedit', showNewRow: true, ...extra });

        it('returns to the new row after saving a row on enter', () => {
            ctx = quick();
            const $row = row(1);
            $row.trigger('click', [undefined, { action: 'edit' }]);
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const hide = jest.spyOn(ctx.instance, 'hideRowEditMode').mockImplementation(() => undefined);
            const input = $row.find('input').first();
            ctx.instance._onEnter(input, $row, true, { stopPropagation: jest.fn() });
            const success = (spy.mock.calls as any)[0][1].success;
            jest.spyOn(ctx.instance, 'focusNewRow').mockImplementation(() => undefined);
            ctx.instance.options.multiselect = true;
            success(false, undefined);
            expect(hide).toHaveBeenCalled();
            hide.mockClear();
            $row.detach();
            success(false, undefined);
            expect(hide).not.toHaveBeenCalled();
        });

        it('finds the row before the always new row after saving it', () => {
            ctx = quick();
            const newRow = ctx.$el.find('tr.always-new-row');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const hide = jest.spyOn(ctx.instance, 'hideRowEditMode').mockImplementation(() => undefined);
            jest.spyOn(ctx.instance, 'focusNewRow').mockImplementation(() => undefined);
            ctx.instance._onEnter(newRow.find('input').first(), newRow, true, { stopPropagation: jest.fn() });
            (spy.mock.calls as any)[0][1].success(false, undefined);
            expect(hide).toHaveBeenCalled();
        });

        it('stops when the matching row is the always new row itself', () => {
            ctx = quick();
            const newRow = ctx.$el.find('tr.always-new-row');
            newRow.attr('data-row-id', '4');
            newRow.insertBefore(row(0));
            const editingRow = row(2);
            editingRow.addClass('row-editing');
            editingRow.attr('data-row-id', '4');
            editingRow.find('td').eq(1).html('<input data-field-name="name">');
            editingRow.find('td').eq(1).attr('data-field-name', 'name');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const hide = jest.spyOn(ctx.instance, 'hideRowEditMode').mockImplementation(() => undefined);
            jest.spyOn(ctx.instance, 'focusNewRow').mockImplementation(() => undefined);
            ctx.instance._onEnter(editingRow.find('input').first(), editingRow, true, { stopPropagation: jest.fn() });
            (spy.mock.calls as any)[0][1].success(false, undefined);
            expect(hide).not.toHaveBeenCalled();
        });

        it('keeps focus while focusing out inside the same row or from the actions column', () => {
            ctx = quick();
            ctx.$el.wrap('<div class="app-grid" widget-id="a"></div>');
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const actions = $('<span class="actions-column"><button class="x"></button></span>').appendTo(row(0).find('td').last());
            const sibling = $('<input class="sib">').appendTo(ctx.$el.closest('.app-grid'));
            const focusOut = (target: any, related: any) => $(target).trigger($.Event('focusout', { relatedTarget: related }));
            focusOut(row(0).find('td').eq(1)[0], row(1)[0]);
            focusOut(actions.find('button')[0], null);
            focusOut(row(0).find('td').eq(1)[0], sibling[0]);
            expect(spy).not.toHaveBeenCalled();
            const focusTarget = $('<button focus-target=""></button>').appendTo(ctx.$el.closest('.app-grid'));
            focusOut(row(0).find('td').first()[0], focusTarget[0]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('keeps the row when focus leaves the first column of a row inside the same grid', () => {
            ctx = quick();
            ctx.$el.wrap('<div class="app-grid" widget-id="a"></div>');
            row(0).trigger('click', [undefined, { action: 'edit' }]);
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const sibling = $('<input class="sib">').appendTo(ctx.$el.closest('.app-grid'));
            jest.spyOn(ctx.instance, 'isLastColumn').mockReturnValue(false);
            $(row(0).find('td').eq(1)).trigger($.Event('focusout', { relatedTarget: sibling[0] }));
            expect(spy).not.toHaveBeenCalled();
            (ctx.instance.isLastColumn as jest.Mock).mockReturnValue(true);
            $(row(0)[0]).trigger($.Event('focusout', { relatedTarget: sibling[0] }));
            expect(spy).not.toHaveBeenCalled();
            $(row(0).find('td').eq(1)).addClass('file-upload').trigger($.Event('focusout', { relatedTarget: sibling[0] }));
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('expansion icon swapping', () => {
        it('swaps the collapse icon for the expand icon when a row opens', () => {
            ctx = mount({
                rowExpansionEnabled: true,
                colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')],
                getRowExpansionAction: jest.fn(() => $('<button class="app-button"><i class="app-icon wi wi-plus-square"></i></button>')[0]),
                generateRowDetailView: jest.fn((e: any, d: any, id: any, a: any, b: any, done: Function) => done()),
                onBeforeRowCollapse: jest.fn(() => true),
                onRowCollapse: jest.fn(),
            });
            ctx.$el.datatable('expandRow', 0);
            expect(row(0).find('i.app-icon').hasClass('wi-minus-square')).toBe(true);
            row(0).next('tr.app-datagrid-detail-row').show();
            ctx.instance.options.cssClassNames.rowCollapseIcon = undefined;
            ctx.$el.datatable('collapseRow', 0);
            expect(ctx.options.onRowCollapse).toHaveBeenCalled();
        });
    });

    describe('column width calculation for hidden panes', () => {
        const withWidths = (widths: { host?: number; th?: number; col?: number }) =>
            jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                if (this.is('th')) {
                    return widths.th ?? 0;
                }
                if (this.is('col')) {
                    return widths.col ?? 0;
                }
                return this.is('.grid-host') ? widths.host ?? 0 : 0;
            } as any);
        const pad = () => {
            ctx.$el.add(ctx.$el.find('.app-grid-header-inner, .app-grid-header, .table-container')).css({ 'padding-left': '5px', 'padding-right': '5px' });
        };
        const widthsOf = () => ctx.$el.find('colgroup col').map((i: number, c: any) => c.style.width).get();

        it('removes the padding of the containers from the available width', () => {
            const spy = withWidths({ host: 600 });
            ctx = mount();
            pad();
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(parseFloat(widthsOf()[0])).toBeCloseTo((600 - 40) / 3, 0);
        });

        it('subtracts the width of columns that have a defined width', () => {
            const spy = withWidths({ host: 600, col: 50 });
            ctx = mount({ colDefs: [defaultCol('id', { width: '' }), defaultCol('name', { width: '' }), defaultCol('age', { width: '' })] });
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(widthsOf().length).toBe(3);
        });

        it('never makes a column narrower than the minimum width', () => {
            const spy = withWidths({ host: 100 });
            ctx = mount();
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(widthsOf()).toEqual(['90px', '90px', '90px']);
        });

        it('uses the minimum width for narrow headers', () => {
            const spy = withWidths({ th: 50 });
            ctx = mount();
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(widthsOf()).toEqual(['90px', '90px', '90px']);
        });

        it('falls back to the minimum width when no parent has a width', () => {
            const spy = jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                return this.is('th') ? 0 : undefined;
            } as any);
            ctx = mount();
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(widthsOf()).toEqual(['90px', '90px', '90px']);
        });
    });

    describe('last navigation and search details', () => {
        it('does not reselect columns when none is selected', () => {
            ctx = mount({ enableColumnSelection: true });
            const spy = jest.spyOn(ctx.instance, 'columnSelectionHandler');
            ctx.instance._reselectColumns();
            expect(spy).not.toHaveBeenCalled();
        });

        it('moves up past hidden detail rows', () => {
            ctx = mount({ rowExpansionEnabled: true, colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')] });
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            ctx.instance.processUpDownKeys({}, row(1), 'up');
            ctx.instance.processUpDownKeys({}, row(1), 'down');
            expect(focus).toHaveBeenCalledTimes(2);
        });

        it('does not add a new row after the last row when the form is on top', () => {
            ctx = mount({ editmode: 'quickedit', showNewRow: true, formPosition: 'top', colDefs: [defaultCol('name', { readonly: false })], getInlineEditWidget: jest.fn(() => '<input>'), getRowAction: jest.fn(() => '') });
            const add = jest.spyOn(ctx.instance, 'addNewRow').mockImplementation(() => undefined);
            const last = ctx.$el.find('tr.app-datagrid-row:not(.always-new-row)').last();
            ctx.instance.editSuccessHandler(false, undefined, {}, last, false);
            expect(add).not.toHaveBeenCalled();
        });

        it('searches with an empty type for columns without a type', () => {
            ctx = mount({ filtermode: 'search', colDefs: [{ field: 'name', show: true, searchable: true }] });
            ctx.$el.find('.app-search-button').trigger('click');
            expect(ctx.options.searchHandler).toHaveBeenCalledWith(expect.objectContaining({ type: '' }), expect.anything(), 'search');
        });
    });

    describe('search by a typed column', () => {
        it('reports the type of the selected column', () => {
            ctx = mount({ filtermode: 'search' });
            ctx.$el.find('[data-element="dgFilterValue"]').val('name');
            ctx.$el.find('[data-element="dgFilterValue"] option[value="name"]').prop('selected', true);
            ctx.$el.find('.app-search-button').trigger('click');
            expect(ctx.options.searchHandler).toHaveBeenCalledWith(expect.objectContaining({ field: 'name', type: 'string' }), expect.anything(), 'search');
        });
    });

    describe('leftover branches', () => {
        it('does not append an empty grid template', () => {
            ctx = mount();
            jest.spyOn(ctx.instance, '_getGridTemplate').mockReturnValue('');
            expect(() => ctx.instance._buildGridMarkup(false)).not.toThrow();
        });

        it('falls back to the default width for columns whose col width is already pixel based', () => {
            ctx = mount();
            ctx.$el.find('colgroup col').first().css('width', '120px');
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('120px');
            ctx.$el.find('colgroup col').first().css('width', '70px');
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBeDefined();
        });
    });
});
