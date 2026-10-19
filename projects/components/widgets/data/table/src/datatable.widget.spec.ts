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

describe('wm.datatable jQuery widget', () => {
    let ctx: ReturnType<typeof mount>;
    const originalVisible = $.expr.pseudos.visible;

    // jsdom has no layout, so jQuery's :visible is always false. Use the inline display style instead.
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
    });

    describe('rendering', () => {
        it('renders the header and one row per record', () => {
            ctx = mount();
            expect(ctx.$el.find('th.app-datagrid-header-cell')).toHaveLength(3);
            expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
            expect(ctx.$el.find('th').first().text()).toContain('ID');
            const cells = ctx.$el.find('tr.app-datagrid-row').first().find('td');
            expect(cells.eq(1).text()).toBe('Alice');
            expect(cells.eq(1).attr('title')).toBe('Alice');
        });

        it('assigns row identifiers and indexes to the prepared data', () => {
            ctx = mount();
            expect(ctx.instance.preparedData.map((r: any) => r.$$pk)).toEqual([0, 1, 2]);
            expect(ctx.instance.preparedData.map((r: any) => r.$$index)).toEqual([1, 2, 3]);
        });

        it('shows null as null only when null records are not filtered and hides undefined', () => {
            ctx = mount({ data: [{ id: null, name: undefined, age: 0 }], filterNullRecords: false });
            const cells = ctx.$el.find('tr.app-datagrid-row td');
            expect(cells.eq(0).text()).toBe('null');
            expect(cells.eq(1).text()).toBe('');
            expect(cells.eq(2).text()).toBe('0');
        });

        it('hides null values by default', () => {
            ctx = mount({ data: [{ id: null }], filterNullRecords: true });
            expect(ctx.$el.find('tr.app-datagrid-row td').first().text()).toBe('');
        });

        it('generates the columns from the data when no column definitions exist', () => {
            ctx = mount({ colDefs: [] });
            expect(ctx.instance.options.colDefs.length).toBeGreaterThan(0);
            expect(ctx.$el.find('th.app-datagrid-header-cell').length).toBeGreaterThan(0);
        });

        it('reads nested field values', () => {
            ctx = mount({
                data: [{ address: { city: 'Paris' }, tags: ['a', 'b'], 'flat.key': 'v' }],
                colDefs: [defaultCol('address.city'), defaultCol('tags[0]'), defaultCol('flat.key')],
            });
            const cells = ctx.$el.find('tr.app-datagrid-row td');
            expect(cells.eq(0).text()).toBe('Paris');
            expect(cells.eq(1).text()).toBe('a');
            expect(cells.eq(2).text()).toBe('v');
        });

        it('uses a custom expression for columns that define one', () => {
            ctx = mount({ colDefs: [defaultCol('name', { customExpression: true })] });
            expect(ctx.options.getCustomExpression).toHaveBeenCalledWith('name', 0);
            expect(ctx.$el.find('tr.app-datagrid-row td').first().text()).toBe('expr');
        });

        it('renders custom checkbox, radio, row index and expansion columns', () => {
            const custom = (field: string, extra: any = {}) => ({ field, type: 'custom', show: true, textAlignment: 'center', ...extra });
            ctx = mount({
                colDefs: [
                    custom('checkbox', { isMultiSelectCol: true }),
                    custom('radio'),
                    custom('rowIndex', { displayName: 'S. No.' }),
                    custom('__expand'),
                    custom('rowOperations'),
                    custom('none'),
                    custom('other'),
                    defaultCol('name'),
                ],
                multiselecttitle: 'select',
                radioselecttitle: ['r1', 'r2', 'r3'],
                multiselectarialabel: ['m1', 'm2', 'm3'],
                radioselectarialabel: 'radio-aria',
            });
            const first = ctx.$el.find('tr.app-datagrid-row').first();
            expect(first.find('input[name="gridMultiSelect"]')).toHaveLength(1);
            expect(first.find('input[type="radio"]')).toHaveLength(1);
            expect(first.find('td').eq(0).attr('title')).toBe('select');
            expect(first.find('td').eq(0).attr('aria-label')).toBe('m1');
            expect(first.find('td').eq(1).attr('title')).toBe('r1');
            expect(first.find('td').eq(1).attr('aria-label')).toBe('radio-aria');
            expect(first.find('td').eq(2).text()).toBe('1');
            expect(first.find('.row-expansion-column')).toHaveLength(1);
            expect(first.find('.actions-column')).toHaveLength(1);
        });

        it('marks checked rows and disabled checkboxes', () => {
            ctx = mount({ colDefs: [{ field: 'checkbox', type: 'custom', isMultiSelectCol: true, show: true }] });
            const row = { _checked: true, disabed: true };
            const html = ctx.instance._getCheckboxTemplate(row, true);
            expect(html).toContain('checked');
            expect(html).toContain('disabled');
            expect(ctx.instance._getCheckboxTemplate({}, false)).toContain('unchecked');
            expect(ctx.instance._getCheckboxLabel('x')).toBe('Select row');
            expect(ctx.instance._getCheckboxLabel('')).toBe('Select all rows');
            expect(ctx.instance._getRadioTemplate({ _checked: true, disabed: true })).toContain('checked');
        });

        it('adds header groups from the header config', () => {
            ctx = mount({
                headerConfig: [
                    { field: 'id', displayName: 'ID' },
                    { field: 'grp', displayName: 'Group', isGroup: true, columns: [{ field: 'name', displayName: 'NAME' }, { field: 'age', displayName: 'AGE' }] },
                ],
            });
            expect(ctx.$el.find('th').length).toBeGreaterThan(3);
        });

        it('applies condensed spacing classes', () => {
            ctx = mount({ spacing: 'condensed' });
            expect(ctx.$el.find('table').hasClass('table-condensed')).toBe(true);
            ctx.$el.datatable('option', 'spacing', 'normal');
            expect(ctx.$el.find('table').hasClass('table-condensed')).toBe(false);
        });

        it('skips the header when showHeader is false and toggles it on option change', () => {
            ctx = mount();
            expect(ctx.$el.find('thead th').length).toBeGreaterThan(0);
            ctx.$el.datatable('option', 'showHeader', false);
            expect(ctx.$el.find('thead th')).toHaveLength(0);
            ctx.$el.datatable('option', 'showHeader', true);
            expect(ctx.$el.find('thead th').length).toBeGreaterThan(0);
        });

        it('sets inline styles from style strings without using the style attribute', () => {
            ctx = mount({ colDefs: [defaultCol('name', { style: 'width: 120px; color: red;' })] });
            const col = ctx.$el.find('colgroup col').first()[0] as HTMLElement;
            expect(col.style.width).toBe('120px');
            expect(col.style.color).toBe('red');
        });
    });

    describe('status', () => {
        it('shows the loading, error, nodata and ready states', () => {
            ctx = mount({ dataStates: { loading: 'Loading...', ready: '', error: 'Oops', nodata: 'Nothing here' } });
            const overlay = () => ctx.$el.find('.overlay').first();
            ctx.instance.dataStatus = { state: 'loading', message: 'Loading...' };
            ctx.instance.__setStatus();
            ctx.instance.dataStatus = { state: 'nodata', message: 'Nothing here' };
            ctx.instance.__setStatus();
            expect(overlay().find('.message').text()).toBe('Nothing here');
            ctx.instance.dataStatus = { state: 'error', message: 'Oops' };
            ctx.instance.__setStatus();
            expect(overlay().find('.message').text()).toBe('Oops');
            ctx.instance.dataStatus = { state: 'ready', message: '' };
            ctx.instance.__setStatus();
            expect(overlay().css('display')).toBe('none');
        });

        it('stores the status through setStatus', () => {
            jest.useFakeTimers();
            ctx = mount();
            ctx.$el.datatable('setStatus', 'nodata', 'No rows');
            expect(ctx.instance.dataStatus).toEqual({ state: 'nodata', message: 'No rows' });
            jest.advanceTimersByTime(200);
            ctx.$el.datatable('setStatus', 'loading');
            expect(ctx.instance.dataStatus.state).toBe('loading');
            jest.advanceTimersByTime(200);
        });
    });

    describe('row selection', () => {
        it('selects a row on click and raises the callbacks', () => {
            ctx = mount();
            const row = ctx.$el.find('tr.app-datagrid-row').eq(1);
            row.trigger('click');
            expect(row.hasClass('active')).toBe(true);
            expect(ctx.options.callOnRowClickEvent).toHaveBeenCalledWith(ctx.options.data[1], expect.anything());
            expect(ctx.options.assignSelectedItems).toHaveBeenCalledWith(ctx.options.data[1], expect.anything(), { rowId: '1', _selected: true });
            expect(ctx.options.onRowSelect).toHaveBeenCalledWith(ctx.options.data[1], expect.anything());
        });

        it('moves the selection to another row', () => {
            ctx = mount();
            const rows = ctx.$el.find('tr.app-datagrid-row');
            rows.eq(0).trigger('click');
            rows.eq(1).trigger('click');
            expect(rows.eq(0).hasClass('active')).toBe(false);
            expect(rows.eq(1).hasClass('active')).toBe(true);
        });

        it('reports a re-click on the active row as a selection without changing it', () => {
            ctx = mount();
            const row = ctx.$el.find('tr.app-datagrid-row').eq(0);
            row.trigger('click');
            ctx.options.onRowSelect.mockClear();
            row.trigger('click');
            expect(ctx.options.callOnRowClickEvent).toHaveBeenCalledTimes(1);
        });

        it('toggles checkboxes of multi select tables and updates the select all checkbox', () => {
            ctx = mount({
                multiselect: true,
                headerselectall: true,
                colDefs: [defaultCol('name')],
            });
            const rows = ctx.$el.find('tr.app-datagrid-row');
            rows.eq(0).find('td').eq(0).trigger('click');
            rows.eq(1).find('td').eq(0).trigger('click');
            expect(rows.eq(0).hasClass('active')).toBe(true);
            expect(rows.eq(1).hasClass('active')).toBe(true);
            expect(rows.eq(0).find('input[name="gridMultiSelect"]').prop('checked')).toBe(true);
            expect(rows.eq(0).find('.sr-only').first().text()).toBe('Row Selected');
            rows.eq(2).find('td').eq(0).trigger('click');
            expect(ctx.$el.find('th input:checkbox').prop('checked')).toBe(true);
            rows.eq(1).find('td').eq(0).trigger('click');
            expect(rows.eq(1).find('.sr-only').first().text()).toBe('Row Deselected');
            expect(ctx.options.onRowDeselect).toHaveBeenCalledWith(expect.objectContaining({ id: 2, name: 'Bob' }), expect.anything());
            expect(ctx.$el.find('th input:checkbox').prop('checked')).toBe(false);
        });

        it('ignores clicks in the selection column unless rows are selectable', () => {
            ctx = mount({
                multiselect: true,
                isrowselectable: false,
                colDefs: [defaultCol('name')],
            });
            const row = ctx.$el.find('tr.app-datagrid-row').first();
            jest.spyOn(ctx.instance, 'getColInfo').mockReturnValue('1');
            const closeDropdown = jest.spyOn(ctx.instance, 'closeDropdown').mockImplementation(() => undefined);
            row.find('td').eq(1).trigger('click');
            expect(closeDropdown).toHaveBeenCalled();
            expect(ctx.options.callOnRowClickEvent).not.toHaveBeenCalled();
        });

        it('selects radio rows', () => {
            ctx = mount({
                showRadioColumn: true,
                colDefs: [defaultCol('name')],
            });
            const row = ctx.$el.find('tr.app-datagrid-row').eq(1);
            row.find('td').eq(0).trigger('click');
            expect(row.find('input[type="radio"]').prop('checked')).toBe(true);
            expect(ctx.instance.preparedData[1]._checked).toBe(true);
        });

        it('selects and deselects rows programmatically', () => {
            ctx = mount();
            ctx.$el.datatable('selectRow', 1, true);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(1).hasClass('active')).toBe(true);
            ctx.$el.datatable('selectRow', ctx.options.data[2], true);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(2).hasClass('active')).toBe(true);
            ctx.$el.datatable('deselectRow', 2);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(2).hasClass('active')).toBe(false);
            expect(ctx.options.callOnRowDeselectEvent).toHaveBeenCalledWith(ctx.instance.preparedData[2]);
            ctx.$el.datatable('selectRow', { id: 99 }, true);
            expect(ctx.$el.find('tr.app-datagrid-row.active').length).toBe(0);
        });

        it('selects the first row', () => {
            ctx = mount();
            ctx.$el.datatable('selectFirstRow', true);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(0).hasClass('active')).toBe(true);
            ctx.$el.datatable('selectFirstRow', false, true);
            expect(ctx.options.onRowSelect).toHaveBeenCalledWith(ctx.options.data[0], expect.anything());
        });

        it('selects the first row after render when the option is set', () => {
            ctx = mount({ selectFirstRow: true });
            ctx.$el.datatable('option', 'data', people());
            expect(ctx.$el.find('tr.app-datagrid-row').eq(0).hasClass('active')).toBe(true);
        });

        it('handles double clicks', () => {
            ctx = mount();
            ctx.$el.find('tr.app-datagrid-row').eq(1).trigger('dblclick');
            expect(ctx.options.onRowDblClick).toHaveBeenCalledWith(ctx.instance.preparedData[1], expect.anything());
        });

        it('returns selected rows', () => {
            ctx = mount();
            ctx.$el.find('tr.app-datagrid-row').eq(1).trigger('click');
            expect(ctx.$el.datatable('getSelectedRows')).toEqual([ctx.options.data[1]]);
        });
    });

    describe('sorting', () => {
        it('cycles the sort direction when a sortable header is clicked', () => {
            ctx = mount();
            const header = ctx.$el.find('th.app-datagrid-header-cell').eq(1);
            header.find('.sort-buttons-container, .header-data').first().trigger('click');
            expect(ctx.options.sortHandler).toHaveBeenCalledTimes(1);
            expect(ctx.options.sortInfo || ctx.instance.options.sortInfo).toMatchObject({ field: 'name', direction: 'asc' });
            header.find('.sort-buttons-container, .header-data').first().trigger('click');
            expect(ctx.instance.options.sortInfo.direction).toBe('desc');
        });

        it('resets the previous column when another column is sorted', () => {
            ctx = mount();
            const headers = ctx.$el.find('th.app-datagrid-header-cell');
            headers.eq(0).find('.sort-buttons-container, .header-data').first().trigger('click');
            headers.eq(2).find('.sort-buttons-container, .header-data').first().trigger('click');
            expect(ctx.instance.options.sortInfo.field).toBe('age');
            expect(ctx.$el.find('.sort-buttons-container.active')).toHaveLength(1);
        });

        it('sorts by the configured sort by column', () => {
            ctx = mount({ colDefs: [defaultCol('id', { sortby: 'name' }), defaultCol('name')] });
            ctx.$el.find('th.app-datagrid-header-cell').eq(0).find('.sort-buttons-container, .header-data').first().trigger('click');
            expect(ctx.instance.options.sortInfo).toMatchObject({ field: 'name', sortBy: 'id' });
        });

        it('marks the default sort column and resets sort icons', () => {
            ctx = mount({ sortInfo: { field: 'name', direction: 'desc' } });
            expect(ctx.$el.find('th[data-col-field="name"] .sort-buttons-container').hasClass('active')).toBe(true);
            ctx.instance.options.sortInfo = { field: 'name', direction: 'asc' };
            ctx.instance.setSortIconDefault();
            expect(ctx.$el.find('th[data-col-field="name"] i.sort-icon').hasClass('asc')).toBe(true);
            ctx.instance.resetSortIcons();
            expect(ctx.$el.find('.sort-buttons-container.active')).toHaveLength(0);
            expect(ctx.instance.isResetSortIconsDone).toBe(true);
        });

        it('does not render sort controls when sorting is disabled', () => {
            ctx = mount({ enableSort: false });
            expect(ctx.$el.find('th[data-col-sortable]')).toHaveLength(0);
            ctx.$el.datatable('option', 'enableSort', true);
            expect(ctx.$el.find('th[data-col-sortable]').length).toBeGreaterThan(0);
        });

        it('returns the sort direction of a column', () => {
            ctx = mount({ sortInfo: { field: 'name', direction: 'asc' } });
            expect(ctx.instance._getColumnSortDirection('name')).toBe('asc');
            expect(ctx.instance._getColumnSortDirection('id')).toBe('');
        });
    });

    describe('column selection and header clicks', () => {
        it('selects a column when column selection is enabled', () => {
            ctx = mount({ enableColumnSelection: true, enableSort: false });
            const th = ctx.$el.find('th.app-datagrid-header-cell').eq(1);
            th.find('.header-data').first().trigger('click');
            expect(ctx.options.onColumnSelect).toHaveBeenCalledWith(expect.objectContaining({ data: ['Alice', 'Bob', 'Carol'] }), expect.anything());
            th.find('.header-data').first().trigger('click');
            expect(ctx.options.onColumnDeselect).toHaveBeenCalledWith(expect.objectContaining({ data: ['Alice', 'Bob', 'Carol'] }), expect.anything());
        });

        it('raises header clicks', () => {
            ctx = mount({ enableColumnSelection: true });
            ctx.$el.find('th.app-datagrid-header-cell').eq(0).trigger('click');
            expect(ctx.options.onHeaderClick).toHaveBeenCalledWith(ctx.instance.preparedHeaderData[0], expect.anything());
        });
    });

    describe('options and data updates', () => {
        it('re-renders the rows when the data changes', () => {
            ctx = mount();
            ctx.$el.datatable('option', 'data', [{ id: 9, name: 'Zed', age: 1 }]);
            expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(1);
            expect(ctx.$el.find('tr.app-datagrid-row td').eq(1).text()).toBe('Zed');
        });

        it('updates the search placeholder and messages', () => {
            ctx = mount({ filtermode: 'search', searchLabel: 'Search', messages: { selectField: 'Select Field' } });
            ctx.$el.datatable('option', 'searchLabel', 'Find');
            expect(ctx.$el.find('[data-element="dgSearchText"]').attr('placeholder')).toBe('Find');
            ctx.$el.datatable('option', 'messages', { selectField: 'Pick' });
            expect(ctx.$el.find('option.placeholder').text()).toBe('Pick');
        });

        it('switches the filter mode', () => {
            ctx = mount({ filtermode: 'search' });
            expect(ctx.$el.find('[data-element="dgSearchText"]').length).toBeGreaterThan(0);
            ctx.$el.datatable('option', 'filtermode', 'multicolumn');
            expect(ctx.$el.find('[data-element="dgSearchText"]')).toHaveLength(0);
        });

        it('refreshes the grid after a delay for structural options', () => {
            jest.useFakeTimers();
            ctx = mount();
            const refresh = jest.spyOn(ctx.instance, '_refreshGrid');
            ctx.$el.datatable('option', 'showRowIndex', true);
            ctx.$el.datatable('option', 'multiselect', true);
            expect(refresh).not.toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            expect(refresh).toHaveBeenCalledTimes(1);
        });

        it('applies the loading icon and class names', () => {
            ctx = mount({ loadingicon: 'fa fa-spin' });
            ctx.$el.datatable('option', 'loadingicon', 'fa fa-cog');
            expect(ctx.$el.find('.overlay i').first().attr('class')).toBe('fa fa-cog');
            ctx.$el.datatable('option', 'cssClassNames', { ...ctx.instance.options.cssClassNames, grid: 'custom-grid' });
            expect(ctx.$el.find('table').first().hasClass('custom-grid')).toBe(true);
        });

        it('returns the options and updates column properties', () => {
            ctx = mount();
            expect(ctx.$el.datatable('getOptions')).toBe(ctx.instance.options);
            ctx.$el.datatable('setColumnProp', 'name', 'displayName', 'Full Name');
            const th = ctx.$el.find('th[data-col-field="name"]');
            expect(th.attr('title')).toBe('Full Name');
            expect(th.find('.header-data').html()).toBe('Full Name');
        });

        it('sets the grid dimensions', () => {
            ctx = mount();
            ctx.$el.datatable('setGridDimensions', 'height', '200px');
            expect(ctx.$el.find('.app-grid-header-inner')[0].style.height).toBe('200px');
        });
    });

    describe('row expansion', () => {
        const expandable = (extra: any = {}) =>
            mount({
                rowExpansionEnabled: true,
                colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')],
                generateRowDetailView: jest.fn((e: any, data: any, id: any, $section: any, $overlay: any, done: Function) => done()),
                onBeforeRowCollapse: jest.fn(() => true),
                onRowCollapse: jest.fn(),
                ...extra,
            });
        const detailRow = () => ctx.$el.find('tr.app-datagrid-detail-row').first();

        it('renders a hidden detail row and expands it', () => {
            ctx = expandable();
            expect(detailRow()).toHaveLength(1);
            ctx.$el.datatable('expandRow', 0);
            expect(ctx.options.generateRowDetailView).toHaveBeenCalledWith(undefined, expect.objectContaining({ $index: 1 }), 0, expect.anything(), expect.anything(), expect.any(Function));
            expect(ctx.$el.find('tr.app-datagrid-row').first().hasClass('expanded')).toBe(true);
        });

        it('collapses an expanded row and raises the callbacks', () => {
            ctx = expandable();
            ctx.$el.datatable('expandRow', 0);
            detailRow().show();
            ctx.$el.datatable('collapseRow', 0);
            expect(ctx.options.onBeforeRowCollapse).toHaveBeenCalledTimes(1);
            expect(ctx.options.onRowCollapse).toHaveBeenCalledTimes(1);
        });

        it('keeps the row expanded when the collapse is cancelled', () => {
            ctx = expandable({ onBeforeRowCollapse: jest.fn(() => false) });
            ctx.$el.datatable('expandRow', 0);
            detailRow().show();
            ctx.$el.datatable('collapseRow', 0);
            expect(ctx.options.onRowCollapse).not.toHaveBeenCalled();
        });

        it('ignores redundant expand and collapse requests', () => {
            ctx = expandable();
            ctx.$el.datatable('collapseRow', 0);
            expect(ctx.options.onBeforeRowCollapse).not.toHaveBeenCalled();
            ctx.$el.datatable('expandRow', 0);
            detailRow().show();
            ctx.$el.datatable('expandRow', 0);
            expect(ctx.options.generateRowDetailView).toHaveBeenCalledTimes(1);
        });

        it('closes other rows when closeothers is set', () => {
            ctx = expandable({ rowDef: { closeothers: true, columnwidth: '50px' } });
            ctx.$el.datatable('expandRow', 0);
            ctx.$el.find('tr.app-datagrid-detail-row').eq(0).show();
            ctx.$el.datatable('expandRow', 1);
            expect(ctx.options.onRowCollapse).toHaveBeenCalledTimes(1);
        });

        it('toggles from the expansion button', () => {
            ctx = expandable();
            const spy = jest.spyOn(ctx.instance, 'toggleExpandRow');
            ctx.$el.find('[data-identifier="rowExpansionButtons"]').first().trigger('click');
            expect(spy).toHaveBeenCalledWith(0, undefined, expect.anything());
        });
    });

    describe('search and row filters', () => {
        const withSearch = (extra: any = {}) => mount({ filtermode: 'search', searchLabel: 'Search', ...extra });
        const type = (text: string, which?: number) => {
            const box = ctx.$el.find('[data-element="dgSearchText"]');
            box.val(text);
            const ev = $.Event('keyup');
            ev.which = which;
            box.trigger(ev);
        };

        it('searches with the selected field when the search button is clicked', () => {
            ctx = withSearch();
            ctx.$el.find('[data-element="dgSearchText"]').val('ali');
            ctx.$el.find('.app-search-button').trigger('click');
            expect(ctx.options.searchHandler).toHaveBeenCalledWith(
                expect.objectContaining({ value: 'ali', field: expect.any(String), type: expect.any(String) }),
                expect.anything(),
                'search'
            );
        });

        it('searches on enter or on every key press when enabled', () => {
            ctx = withSearch();
            type('a', 65);
            expect(ctx.options.searchHandler).not.toHaveBeenCalled();
            type('al', 13);
            expect(ctx.options.searchHandler).toHaveBeenCalledTimes(1);
            ctx.instance.options.filteronkeypress = true;
            type('ali', 65);
            expect(ctx.options.searchHandler).toHaveBeenCalledTimes(2);
        });

        it('shows all rows again when the search text is cleared', () => {
            ctx = withSearch();
            type('al', 13);
            ctx.options.searchHandler.mockClear();
            type('', 8);
            expect(ctx.instance.emptySearch).toBe(true);
            expect(ctx.options.searchHandler).toHaveBeenCalledTimes(1);
            expect(ctx.instance.searchObj.value).toBe('');
        });

        it('searches again when the field changes while no data is found', () => {
            ctx = withSearch();
            const select = ctx.$el.find('[data-element="dgFilterValue"]');
            select.trigger('change');
            expect(ctx.options.searchHandler).not.toHaveBeenCalled();
            ctx.instance.dataStatusContainer.find('.status').text(ctx.instance.options.dataStates.nodata);
            select.trigger('change');
            expect(ctx.options.searchHandler).toHaveBeenCalledTimes(1);
        });

        it('renders a row of filters for searchable columns in multi column mode', () => {
            ctx = mount({
                filtermode: 'multicolumn',
                colDefs: [defaultCol('id', { searchable: false }), defaultCol('name'), defaultCol('age')],
                getFilterWidget: jest.fn((field: string) => `<input class="flt" data-f="${field}">`),
            });
            expect(ctx.options.generateFilterRow).toHaveBeenCalledTimes(1);
            expect(ctx.options.getFilterWidget).toHaveBeenCalledTimes(2);
            expect(ctx.$el.find('tr.filter-row th')).toHaveLength(3);
            expect(ctx.$el.find('.flt')).toHaveLength(2);
        });

        it('shows and hides the row filter', () => {
            ctx = mount({ filtermode: 'multicolumn', getFilterWidget: jest.fn(() => '<input>') });
            ctx.$el.datatable('toggleRowFilter', false);
            expect(ctx.$el.find('tr.filter-row')[0].style.display).toBe('none');
            ctx.$el.datatable('toggleRowFilter', true);
            expect(ctx.$el.find('tr.filter-row')[0].style.display).not.toBe('none');
            ctx.$el.datatable('option', 'filtermode', 'search');
            ctx.$el.datatable('toggleRowFilter', false);
        });

        it('renders the filter row inside the grid when the header is hidden on mobile', () => {
            ctx = mount({ filtermode: 'multicolumn', isMobile: true, showHeader: false, getFilterWidget: jest.fn(() => '<input>') });
            expect(ctx.instance.gridSearch.hasClass('filter-row')).toBe(true);
        });
    });

    describe('summary row', () => {
        it('stores the definitions and renders a footer row', () => {
            ctx = mount();
            ctx.$el.datatable('setSummaryRowDef', 'name', { value: 'Total', class: 'sum-cell' }, 0);
            ctx.$el.datatable('setSummaryRowDef', 'age', 75, 0, true);
            expect(ctx.instance.options.summaryRowDefs[0]).toMatchObject({ name: 'Total', age: 75 });
            expect(ctx.$el.find('tfoot tr').length).toBe(1);
            expect(ctx.$el.find('tfoot td.sum-cell').text()).toBe('Total');
        });

        it('shows a spinner for promise values', () => {
            ctx = mount();
            ctx.$el.datatable('setSummaryRowDef', 'name', Promise.resolve('x'), 0, true);
            expect(ctx.$el.find('tfoot .form-field-spinner')).toHaveLength(1);
        });

        it('resets the summary definitions on create', () => {
            ctx = mount({ summaryRow: true, summaryRowDefs: [{ a: 1 }] });
            expect(ctx.instance.options.summaryRowDefs).toEqual([]);
        });
    });

    describe('paging helpers', () => {
        it('computes the start index of the page', () => {
            ctx = mount({ getCurrentPage: jest.fn(() => 3), getPageSize: jest.fn(() => 5) });
            expect(ctx.instance.getPageStartIndex()).toBe(10);
            ctx.instance.options.actionRowPage = 2;
            expect(ctx.instance.getPageStartIndex()).toBe(5);
        });

        it('falls back to page one with ten records when the callbacks are missing', () => {
            ctx = mount();
            ctx.instance.options.getCurrentPage = undefined;
            ctx.instance.options.getPageSize = undefined;
            expect(ctx.instance.getPageStartIndex()).toBe(0);
        });

        it('only keeps rows that are not rendered yet for infinite scroll', () => {
            ctx = mount();
            const rows = ctx.instance.preparedData.concat([{ $$pk: 7 }]);
            expect(ctx.instance._getPreparedDataForInfiniteScroll(ctx.instance.gridElement, rows)).toEqual([{ $$pk: 7 }]);
        });
    });

    describe('infinite scroll and on demand', () => {
        const scroll = (extra: any = {}) =>
            mount({
                navigation: 'Scroll',
                isNavTypeScrollOrOndemand: jest.fn(() => true),
                getCurrentPage: jest.fn(() => 1),
                getPageSize: jest.fn(() => 3),
                ...extra,
            });

        it('renders the first page and appends later pages', () => {
            ctx = scroll({ isDatasetUpdated: true });
            expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
            ctx.instance.options.isDatasetUpdated = false;
            ctx.instance.options.getCurrentPage = jest.fn(() => 2);
            ctx.instance.options.isNextPageData = true;
            ctx.$el.datatable('option', 'data', [...people(), { id: 4, name: 'Dan', age: 40 }, { id: 5, name: 'Eve', age: 35 }]);
            expect(ctx.$el.find('tr.app-datagrid-row').length).toBeGreaterThanOrEqual(3);
            expect(ctx.instance.preparedData.length).toBeGreaterThanOrEqual(3);
        });

        it('clears the body for a search or dataset update', () => {
            ctx = scroll({ lastActionPerformed: 'search_or_sort', isSearchTrigerred: true, navigation: 'On-Demand', isLastPage: false });
            ctx.instance.options.setIsSearchTrigerred.mockClear();
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.options.clearCustomExpression).toHaveBeenCalled();
            expect(ctx.options.clearRowDetailExpression).toHaveBeenCalled();
            expect(ctx.options.setIsSearchTrigerred).toHaveBeenCalledWith(false);
            expect(ctx.options.setIsDatasetUpdated).toHaveBeenCalledWith(false);
        });

        it('replaces the edited row', () => {
            ctx = scroll({});
            ctx.instance.options.lastActionPerformed = 'edit';
            ctx.instance.options.actionRowIndex = 1;
            ctx.instance.preparedData[1].name = 'Changed';
            ctx.instance._handleCRUDForInfiniteScroll(ctx.instance.gridElement);
            expect(ctx.options.generateCustomExpressions).toHaveBeenCalledWith(ctx.instance.preparedData[1], 1);
            expect(ctx.$el.find('tr.app-datagrid-row[data-row-id="1"] td').eq(1).text()).toBe('Changed');
        });

        it('re-renders for infinite scroll without the footer and the always new row', () => {
            ctx = scroll({});
            const render = jest.spyOn(ctx.instance, '_renderGrid').mockImplementation(() => undefined);
            ctx.instance.gridElement.append('<tr class="app-datagrid-row always-new-row"></tr>');
            ctx.instance.callRenderGridForInfiniteScroll();
            expect(ctx.instance.gridElement.find('> tr.always-new-row')).toHaveLength(0);
            expect(render).toHaveBeenCalledWith(undefined);
            ctx.instance.refreshGridData();
            expect(render).toHaveBeenCalledTimes(2);
        });

        it('binds the navigation controls of dynamic tables', () => {
            ctx = mount({ isdynamictable: true, navigation: 'On-Demand' });
            expect(ctx.options.addLoadMoreBtn).toHaveBeenCalled();
            ctx.instance.options.navigation = 'Scroll';
            ctx.instance.addNavigationControls();
            expect(ctx.options.bindScrollEvt).toHaveBeenCalledTimes(1);
        });

        it('hides the load more link on the last page', () => {
            ctx = scroll({ getCurrentPage: jest.fn(() => 2), getPageCount: jest.fn(() => 2), showviewlessbutton: false });
            ctx.$el.append('<div class="on-demand-datagrid"><a>more</a></div>');
            ctx.instance.dataStatus = { state: 'loading', message: '' };
            ctx.instance.__setStatus();
            expect(ctx.$el.find('.on-demand-datagrid a')[0].style.display).toBe('none');
        });
    });

    describe('status variants', () => {
        it('turns nodata into ready when the always new row is present', () => {
            ctx = mount();
            ctx.instance.gridElement.append('<tr class="app-datagrid-row always-new-row"></tr>');
            ctx.$el.datatable('setStatus', 'nodata', 'x');
            expect(ctx.instance.dataStatus.state).toBe('ready');
            expect(ctx.options.setGridState).toHaveBeenCalledWith('ready');
        });

        it('adjusts the overlay height for auto height grids', () => {
            ctx = mount({ height: 'auto' });
            ctx.instance.dataStatus = { state: 'nodata', message: 'none' };
            ctx.instance.__setStatus();
            expect(ctx.instance.dataStatus.contentHeight).toBe(0);
            ctx.instance.dataStatus = { state: 'loading', message: '' };
            ctx.instance.__setStatus();
            expect(ctx.instance.dataStatusContainer[0].style.height).toBeDefined();
            expect(ctx.instance.gridElement.hasClass('hidden')).toBe(true);
        });

        it('hides the overlay for later pages of scrolling grids', () => {
            ctx = mount({ height: '100%', isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 2), getPageCount: jest.fn(() => 5) });
            ctx.instance.dataStatus = { state: 'loading', message: '' };
            ctx.instance.__setStatus();
            expect(ctx.instance.dataStatusContainer[0].style.display).toBe('none');
        });

        it('focuses and highlights the active row in quick edit mode', () => {
            ctx = mount({ editmode: 'quickedit', showNewRow: false });
            const focus = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            ctx.instance.setActiveRow(ctx.options.data[1]);
            ctx.instance.dataStatus = { state: 'ready', message: '' };
            ctx.instance.__setStatus();
            expect(focus).toHaveBeenCalled();
            expect(ctx.$el.find('tr.app-datagrid-row').eq(1).hasClass('active')).toBe(true);
            expect(ctx.instance.options.activeRow).toBeUndefined();
            ctx.instance.attachHandlersToActiveRow({ id: 404 });
        });

        it('applies the loading icon and keeps the status when data states change', () => {
            ctx = mount();
            ctx.instance.dataStatus = { state: 'nodata', nodata: 'nothing', message: '' };
            ctx.$el.datatable('option', 'dataStates', { loading: 'L', ready: '', error: 'E', nodata: 'N' });
            expect(ctx.instance.dataStatus.state).toBe('nodata');
            ctx.instance.dataStatus.state = 'loading';
            ctx.$el.datatable('option', 'dataStates', { loading: 'L2', ready: '', error: 'E', nodata: 'N' });
            expect(ctx.instance.dataStatus.state).toBe('loading');
        });

        it('adds or removes the scroll class on the header', () => {
            ctx = mount();
            ctx.instance.addOrRemoveScroll();
            expect(ctx.$el.find('.table-header').hasClass('scroll-visible')).toBe(false);
        });
    });

    describe('selection helpers', () => {
        it('selects several rows and replaces the previous selection', () => {
            ctx = mount();
            ctx.$el.datatable('selectRows', [0, 2]);
            expect(ctx.$el.find('tr.app-datagrid-row.active').length).toBeGreaterThan(0);
            ctx.$el.datatable('selectRows', 1);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(1).hasClass('active')).toBe(true);
        });

        it('returns the data of the selected rows', () => {
            ctx = mount();
            ctx.instance.preparedData[1]._selected = true;
            expect(ctx.$el.datatable('getSelectedRows')).toEqual([ctx.options.data[1]]);
        });

        it('ignores rows without prepared data and updates select all for empty grids', () => {
            ctx = mount({ multiselect: true });
            ctx.instance.toggleRowSelection($(), true);
            ctx.instance.toggleRowSelection($('<tr data-row-id="99"></tr>'), true);
            ctx.instance.gridElement.empty();
            ctx.instance.updateSelectAllCheckboxState();
            expect(ctx.$el.find('th input:checkbox').prop('checked')).toBe(false);
        });

        it('does not update select all without multiselect or header', () => {
            ctx = mount();
            expect(ctx.instance.updateSelectAllCheckboxState()).toBeUndefined();
        });

        it('keeps single selection by deselecting the previous row', () => {
            ctx = mount();
            const rows = ctx.$el.find('tr.app-datagrid-row');
            ctx.instance.toggleRowSelection(rows.eq(0), true);
            ctx.instance.toggleRowSelection(rows.eq(1), true);
            expect(rows.eq(0).hasClass('active')).toBe(false);
        });
    });

    describe('row actions', () => {
        it('renders the row action markup for every row', () => {
            ctx = mount({
                rowActions: [{ action: 'editRow($event)' }, { action: 'deleteRow($event)' }],
                colDefs: [defaultCol('name'), { field: 'rowOperations', type: 'custom', show: true }],
                getRowAction: jest.fn(() => '<button class="act">act</button>'),
            });
            expect(ctx.options.generateRowActions).toHaveBeenCalledTimes(3);
            expect(ctx.$el.find('.actions-column .act')).toHaveLength(3);
            expect(ctx.instance.options.actionsEnabled).toMatchObject({ edit: true, delete: true });
            expect(ctx.instance._getRowActionsColumnDefIndex()).toBe(1);
            expect(ctx.instance._getRowActionsColumnDef().field).toBe('rowOperations');
        });

        it('has no action column by default', () => {
            ctx = mount();
            expect(ctx.instance._getRowActionsColumnDefIndex()).toBe(-1);
            expect(ctx.instance._getRowActionsColumnDef()).toBeNull();
        });

        it('forwards custom events', () => {
            ctx = mount();
            ctx.instance._handleCustomEvents({ type: 'x' }, { a: 1 });
            expect(ctx.options.handleCustomEvents).toHaveBeenCalledWith({ type: 'x' }, { a: 1 });
        });
    });

    describe('keyboard', () => {
        const key = (target: any, which: number, extra: any = {}) => {
            const ev = $.Event('keydown', { which, ...extra });
            $(target).trigger(ev);
            return ev;
        };

        it('moves focus between rows with the arrow keys', () => {
            ctx = mount();
            const rows = ctx.$el.find('tr.app-datagrid-row');
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            key(rows.eq(1)[0], 40);
            key(rows.eq(1)[0], 38);
            expect(focus).toHaveBeenCalledTimes(2);
            focus.mockRestore();
        });

        it('skips hidden detail rows when moving with expansion enabled', () => {
            ctx = mount({ rowExpansionEnabled: true, colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')] });
            const rows = ctx.$el.find('tr.app-datagrid-row');
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            key(rows.eq(0)[0], 40);
            expect(focus).toHaveBeenCalled();
            focus.mockRestore();
        });

        it('sorts a column on enter', () => {
            ctx = mount();
            const sort = jest.spyOn(ctx.instance, 'sortHandler').mockImplementation(() => undefined);
            ctx.instance.keydownHandler({ key: 'Enter' });
            ctx.instance.keydownHandler({ key: 'a' });
            ctx.instance.keydownHandler(undefined);
            expect(sort).toHaveBeenCalledTimes(1);
        });

        it('selects the row on enter after the debounce', () => {
            jest.useFakeTimers();
            ctx = mount();
            const row = ctx.$el.find('tr.app-datagrid-row').eq(1);
            const click = jest.fn();
            row.on('click', click);
            key(row[0], 13);
            jest.advanceTimersByTime(200);
            expect(click).toHaveBeenCalledTimes(1);
        });

        it('ignores enter on selection columns of multi select tables', () => {
            jest.useFakeTimers();
            ctx = mount({ multiselect: true });
            const spy = jest.spyOn(ctx.instance, '_onEnter');
            key(ctx.$el.find('tr.app-datagrid-row').first().find('td').eq(1)[0], 13);
            jest.advanceTimersByTime(200);
            expect(spy).not.toHaveBeenCalled();
        });

        it('does not delete from the keyboard when deleting is not enabled or in inputs', () => {
            ctx = mount();
            const del = jest.spyOn(ctx.instance, 'deleteRow').mockImplementation(() => undefined);
            key(ctx.$el.find('tr.app-datagrid-row')[0], 46);
            expect(del).not.toHaveBeenCalled();
            ctx.instance.options.actionsEnabled.delete = true;
            key(ctx.$el.find('tr.app-datagrid-row')[0], 46);
            expect(del).toHaveBeenCalledTimes(1);
            const input = $('<input>').appendTo(ctx.$el.find('tr.app-datagrid-row').first().find('td').first());
            key(input[0], 46);
            expect(del).toHaveBeenCalledTimes(1);
        });

        it('cancels the edit on escape', () => {
            ctx = mount();
            const row = ctx.$el.find('tr.app-datagrid-row').first();
            const click = jest.fn();
            row.on('click', click);
            key(row[0], 27);
            expect(click).toHaveBeenCalledTimes(1);
        });

        it('stops an enter from reaching a parent form', () => {
            ctx = mount();
            const $row = ctx.$el.find('tr.app-datagrid-row').first();
            const ev: any = { stopPropagation: jest.fn() };
            ctx.instance._onEnter($row, $row, false, ev);
            expect(ev.stopPropagation).toHaveBeenCalledTimes(1);
            const btn = $('<button>').appendTo($row);
            ctx.instance._onEnter(btn, $row, false, ev);
            expect(ev.stopPropagation).toHaveBeenCalledTimes(1);
        });

        it('opens a row for edit on enter in quick edit mode', () => {
            ctx = mount({ editmode: 'quickedit', showNewRow: false });
            const $row = ctx.$el.find('tr.app-datagrid-row').first();
            const handler = jest.fn();
            $row.on('click', handler);
            ctx.instance._onEnter($row, $row, true, { stopPropagation: jest.fn() });
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('column widths and resizing', () => {
        it('recomputes the column widths', () => {
            ctx = mount();
            expect(() => ctx.$el.datatable('refreshColumnWidths')).not.toThrow();
            expect(() => ctx.instance.setColGroupWidths()).not.toThrow();
        });

        it('computes the column span of header groups', () => {
            ctx = mount({
                headerConfig: [
                    { field: 'id', displayName: 'ID' },
                    { field: 'grp', displayName: 'Group', isGroup: true, columns: [{ field: 'name', displayName: 'NAME' }, { field: 'age', displayName: 'AGE' }] },
                ],
            });
            expect(() => ctx.instance._setColSpan(ctx.instance.options.headerConfig)).not.toThrow();
        });
    });

    describe('default data helpers', () => {
        it('fills default values for new rows', () => {
            ctx = mount({ colDefs: [defaultCol('id', { defaultvalue: 5 }), defaultCol('name', { defaultvalue: 'x' })] });
            const row: any = {};
            ctx.instance.setDefaultRowData(row);
            expect(row).toEqual({ id: 5, name: 'x' });
        });

        it('applies the ng class of rows and columns', () => {
            ctx = mount();
            ctx.$el.find('tr.app-datagrid-row').eq(1).addClass('old');
            ctx.instance.applyRowNgClass({ toAdd: 'foo bar', toRemove: 'old' }, 1);
            const row = ctx.$el.find('tr.app-datagrid-row').eq(1);
            expect(row.hasClass('foo') && row.hasClass('bar')).toBe(true);
            expect(row.hasClass('old')).toBe(false);
            ctx.instance.applyColNgClass({ toAdd: 'col-x', toRemove: '' }, 1, 1);
            expect(row.find('td').eq(1).hasClass('col-x')).toBe(true);
            expect(ctx.$el.find('th[data-col-id="1"]').hasClass('col-x')).toBe(true);
        });
    });

    describe('editing', () => {
        let fieldValues: Record<string, any>;
        const editable = (extra: any = {}) => {
            fieldValues = {};
            const result = mount({
                editmode: 'inline',
                colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false }), defaultCol('age', { readonly: false, required: true }), { field: 'rowOperations', type: 'custom', show: true, readonly: true }],
                rowActions: [{ action: 'editRow($event)' }, { action: 'deleteRow($event)' }],
                getInlineEditWidget: jest.fn((field: string) => `<input data-field-name="${field}" value="">`),
                getFieldValue: jest.fn((name: string) => fieldValues[name]),
                getRowAction: jest.fn(() =>
                    '<button class="edit-row-button"></button><button class="cancel-edit-row-button hidden"></button><button class="save-edit-row-button hidden"></button><button class="delete-row-button"></button>'
                ),
                ...extra,
            });
            ctx = result;
            return result;
        };
        const row = (i: number) => ctx.$el.find('tr.app-datagrid-row').eq(i);
        const startEdit = (i = 0, options: any = {}) => {
            row(i).trigger('click', [undefined, { action: 'edit', ...options }]);
        };
        const addFooter = () => {
            ctx.$el.after('<div class="panel-footer"><div class="app-datagrid-actions"><button class="app-button"><i class="wi-plus"></i></button></div></div>');
        };

        describe('make a row editable', () => {
            it('replaces editable cells with widgets and calls the hooks', () => {
                editable();
                startEdit(1);
                expect(row(1).hasClass('row-editing')).toBe(true);
                expect(row(1).find('td.cell-editing')).toHaveLength(2);
                expect(row(1).find('td').eq(0).hasClass('cell-editing')).toBe(false);
                expect(ctx.options.setActionRowIndex).toHaveBeenCalledWith('1');
                expect(ctx.options.setLastActionPerformed).toHaveBeenCalledWith('edit');
                expect(ctx.options.callLoadInlineWidgetData).toHaveBeenCalledTimes(1);
                expect(ctx.options.removeValidations).toHaveBeenCalledTimes(1);
                expect(ctx.options.generateInlineEditRow).toHaveBeenCalledWith(expect.objectContaining({ $index: 2 }), undefined);
                expect(ctx.options.applyValidations).toHaveBeenCalledTimes(2);
                expect(row(1).find('td.cell-editing').last().hasClass('required-field')).toBe(true);
                expect(row(1).find('.edit-row-button').hasClass('hidden')).toBe(true);
                expect(row(1).find('.save-edit-row-button').hasClass('hidden')).toBe(false);
                expect(row(1).find('.delete-row-button').hasClass('disabled-action')).toBe(false);
                expect(row(0).find('.edit-row-button').hasClass('disabled-action')).toBe(true);
                expect(ctx.options.setGridEditMode).toHaveBeenCalledWith(true);
                expect(ctx.options.onFormRender).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'edit', false);
            });

            it('marks cells with expressions or format patterns as editable expressions', () => {
                editable({
                    colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false, customExpression: true }), defaultCol('age', { readonly: false, formatpattern: 'toNumber' })],
                });
                startEdit(0);
                expect(row(0).find('td.editable-expression')).toHaveLength(2);
                expect(row(0).find('td.editable-expression').first().data('originalValue')).toEqual({ rowIndex: 0, fieldName: 'name' });
            });

            it('stops clicks and vertical arrows inside editing cells from reaching the row', () => {
                editable();
                startEdit(0);
                const cell = row(0).find('td.cell-editing').first();
                const parentClick = jest.fn();
                ctx.$el.on('click', parentClick);
                cell.trigger('click');
                expect(parentClick).not.toHaveBeenCalled();
                const outer = jest.fn();
                ctx.$el.on('keydown', outer);
                cell.trigger($.Event('keydown', { which: 40 }));
                expect(outer).not.toHaveBeenCalled();
            });

            it('does not edit when onBeforeFormRender cancels it', () => {
                editable({ onBeforeFormRender: jest.fn(() => false) });
                startEdit(0);
                expect(row(0).find('td.cell-editing')).toHaveLength(0);
            });

            it('leaves form and dialog edit modes to the caller', () => {
                editable({ editmode: 'form' });
                startEdit(0);
                expect(row(0).hasClass('row-editing')).toBe(true);
                expect(row(0).find('td.cell-editing')).toHaveLength(0);
            });

            it('ignores clicks inside menus and removed rows', () => {
                editable();
                const spy = jest.spyOn(ctx.instance, 'closeDropdown');
                const menu = $('<div class="app-menu"><span class="inner"></span></div>').appendTo(row(0).find('td').first());
                ctx.instance.toggleEditRow({ target: menu.find('.inner')[0], stopPropagation: jest.fn() }, { action: 'edit' });
                expect(spy).not.toHaveBeenCalled();
                row(0).attr('data-removed', 'true');
                ctx.instance.toggleEditRow(undefined, { $row: row(0), action: 'edit' });
                expect(row(0).hasClass('row-editing')).toBe(false);
            });

            it('selects the row when asked to', () => {
                editable();
                startEdit(2, { selectRow: true });
                expect(row(2).hasClass('active')).toBe(true);
            });
        });

        describe('adding rows', () => {
            it('appends a new editable row and shows the save and cancel buttons', () => {
                editable({ beforeRowInsert: jest.fn(), rowActions: [] });
                addFooter();
                ctx.$el.datatable('addNewRow');
                expect(ctx.options.beforeRowInsert).toHaveBeenCalledTimes(1);
                expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(4);
                expect(row(3).hasClass('row-editing')).toBe(true);
                expect(ctx.options.onBeforeFormRender).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'new');
                expect(ctx.$el.siblings('.panel-footer').find('.saveNewRow')).toHaveLength(1);
                expect(ctx.$el.siblings('.panel-footer').find('.app-button').first().css('display')).toBe('none');
            });

            it('adds the row on top for a top form position', () => {
                editable({ formPosition: 'top' });
                ctx.$el.datatable('addNewRow');
                expect(row(0).hasClass('row-editing')).toBe(true);
            });

            it('does nothing for form and dialog modes', () => {
                editable({ editmode: 'dialog' });
                ctx.$el.datatable('addNewRow');
                expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
            });

            it('shows the ready state when adding the first row of an empty grid', () => {
                editable({ data: [] });
                const status = jest.spyOn(ctx.instance, 'setStatus');
                ctx.$el.datatable('addNewRow');
                expect(status.mock.calls[0][0]).toBe('ready');
            });

            it('saves a new row from the footer button and cancels it', () => {
                editable({ rowActions: [] });
                addFooter();
                ctx.$el.datatable('addNewRow');
                fieldValues = { name: 'Zed', age: '9' };
                ctx.$el.siblings('.panel-footer').find('.saveNewRow').trigger('click');
                expect(ctx.options.onRowInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zed', age: '9' }), expect.anything(), expect.any(Function), {});
                ctx.$el.datatable('addNewRow');
                ctx.$el.siblings('.panel-footer').find('.cancelNewRow').trigger('click');
                expect(ctx.$el.find('tr.app-datagrid-row[data-removed="true"]')).toHaveLength(0);
            });

            it('builds the always new row of quick edit tables', () => {
                editable({ editmode: 'quickedit', showNewRow: true });
                const newRow = ctx.$el.find('tr.always-new-row');
                expect(newRow).toHaveLength(1);
                expect(newRow.hasClass('row-editing')).toBe(true);
                expect(newRow.find('.delete-row-button')[0].style.display).toBe('none');
                expect(newRow.find('.edit-row-button')[0].style.display).toBe('none');
                expect(ctx.options.runInNgZone).toHaveBeenCalled();
            });

            it('focuses and submits the existing always new row', () => {
                editable({ editmode: 'quickedit', showNewRow: true });
                const input = ctx.$el.find('tr.always-new-row input').first();
                const keydown = jest.fn();
                input.on('keydown', keydown);
                ctx.$el.datatable('addNewRow');
                expect(keydown).toHaveBeenCalled();
                expect(ctx.$el.find('tr.always-new-row')).toHaveLength(1);
            });

            it('resets the always new row', () => {
                editable({ editmode: 'quickedit', showNewRow: true, colDefs: [defaultCol('name', { readonly: false, defaultvalue: 'dflt' })] });
                const newRow = ctx.$el.find('tr.always-new-row');
                ctx.instance.resetNewRow(newRow);
                expect(ctx.options.clearForm).toHaveBeenCalledWith(true);
                expect(ctx.options.setFieldValue).toHaveBeenCalledWith('name_new', 'dflt');
                expect(ctx.options.safeApply).toHaveBeenCalled();
            });
        });

        describe('saving', () => {
            it('saves an edited row with the new values', () => {
                editable();
                startEdit(0);
                fieldValues = { name: 'Alicia', age: '31' };
                row(0).trigger('click', [undefined, { action: 'save', success: jest.fn() }]);
                expect(ctx.options.afterRowUpdate).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 1, name: 'Alicia', age: '31' }),
                    expect.anything(),
                    expect.any(Function),
                    {}
                );
            });

            it('reports unchanged rows and restores the view', () => {
                editable();
                startEdit(0);
                fieldValues = { name: 'Alice', age: 30 };
                const success = jest.fn();
                row(0).trigger('click', [undefined, { action: 'save', success }]);
                expect(ctx.options.noChangesDetected).toHaveBeenCalledTimes(1);
                expect(success).toHaveBeenCalledWith(false);
                expect(row(0).hasClass('row-editing')).toBe(false);
                expect(row(0).find('td').eq(1).text()).toBe('Alice');
            });

            it('does not notify about unchanged rows when noMsg is set', () => {
                editable();
                startEdit(0);
                fieldValues = { name: 'Alice', age: 30 };
                row(0).trigger('click', [undefined, { action: 'save', noMsg: true }]);
                expect(ctx.options.noChangesDetected).not.toHaveBeenCalled();
            });

            it('sets cleared values to undefined or an empty string depending on the field', () => {
                editable();
                startEdit(0);
                fieldValues = { name: 'null', age: undefined };
                row(0).trigger('click', [undefined, { action: 'save' }]);
                const saved = ctx.options.afterRowUpdate.mock.calls[0][0];
                expect(saved.name).toBe('');
                expect('age' in saved).toBe(true);
                expect(saved.age).toBeUndefined();
            });

            it('sets related objects to null', () => {
                editable({
                    data: [{ id: 1, dept: { id: 4 } }],
                    colDefs: [defaultCol('id', { readonly: true }), defaultCol('dept.id', { readonly: false })],
                });
                startEdit(0);
                fieldValues = { 'dept.id': 'null' };
                row(0).trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.options.afterRowUpdate.mock.calls[0][0].dept).toBeNull();
            });

            it('stops when onBeforeRowUpdate cancels the save', () => {
                editable({ onBeforeRowUpdate: jest.fn(() => false) });
                startEdit(0);
                fieldValues = { name: 'X', age: 1 };
                row(0).trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.options.afterRowUpdate).not.toHaveBeenCalled();
            });

            it('passes the row locator for variable data sources', () => {
                editable({ getDataSource: jest.fn(() => ({ category: 'wm.Variable' })), data: [{ id: 1, name: 'A', age: 1, $$wmSourceListIndex: 7 }] });
                startEdit(0);
                fieldValues = { name: 'B', age: 2 };
                row(0).trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.options.afterRowUpdate.mock.calls[0][3]).toEqual({ rowindex: 7 });
            });

            it('highlights invalid fields and waits for pending validators', () => {
                jest.useFakeTimers();
                editable();
                startEdit(0);
                fieldValues = { name: 'B', age: 2 };
                const cell = row(0).find('td.cell-editing').last();
                cell.append('<div class="ng-invalid"><input formcontrolname="age" focus-target></div>');
                const success = jest.fn();
                row(0).trigger('click', [undefined, { action: 'save', success }]);
                expect(ctx.options.setTouched).toHaveBeenCalledWith('age');
                expect(success).toHaveBeenCalledWith(false, true);
                expect(ctx.options.afterRowUpdate).not.toHaveBeenCalled();
                cell.find('.ng-invalid').remove();
                cell.append('<div class="ng-pending"></div>');
                row(0).trigger('click', [undefined, { action: 'save' }]);
                cell.find('.ng-pending').remove();
                jest.advanceTimersByTime(250);
                expect(ctx.options.afterRowUpdate).toHaveBeenCalledTimes(1);
            });

            it('inserts a new row', () => {
                editable();
                ctx.$el.datatable('addNewRow');
                fieldValues = { name: 'New', age: '5', id: '' };
                const newRow = ctx.$el.find('tr.row-editing');
                newRow.trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.options.onRowInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', age: '5' }), expect.anything(), expect.any(Function), {});
                expect(ctx.options.setGridEditMode).toHaveBeenCalledWith(true);
            });

            it('stops inserting when onBeforeRowInsert cancels', () => {
                editable({ onBeforeRowInsert: jest.fn(() => false) });
                ctx.$el.datatable('addNewRow');
                fieldValues = { name: 'New', age: '5' };
                ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.options.onRowInsert).not.toHaveBeenCalled();
            });

            it('removes the inserted row for scrolling pagination', () => {
                editable({ isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10) });
                ctx.$el.datatable('addNewRow');
                fieldValues = { name: 'New', age: '5' };
                ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'save' }]);
                expect(ctx.$el.find('tr.row-editing')).toHaveLength(0);
            });

            it('drops empty new rows of quick edit tables', () => {
                editable({ editmode: 'quickedit', showNewRow: false });
                ctx.$el.datatable('addNewRow');
                fieldValues = {};
                const success = jest.fn();
                const newRow = ctx.$el.find('tr.row-editing');
                newRow.trigger('click', [undefined, { action: 'save', success }]);
                expect(success).toHaveBeenCalledWith(false, undefined, true);
                expect(ctx.$el.find('tr.row-editing')).toHaveLength(0);
            });

            it('saves all editing rows', () => {
                editable();
                startEdit(0);
                const spy = jest.fn();
                row(0).on('click', spy);
                ctx.$el.datatable('saveRow', jest.fn());
                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][2]).toMatchObject({ action: 'save', skipSelect: true, noMsg: true });
            });

            it('saves the previous row before editing another one in quick edit', () => {
                editable({ editmode: 'quickedit', showNewRow: false });
                startEdit(0);
                fieldValues = { name: 'Q', age: 1 };
                startEdit(1);
                expect(ctx.options.afterRowUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Q' }), expect.anything(), expect.any(Function), {});
            });
        });

        describe('cancelling and closing', () => {
            it('restores the original cell text on cancel', () => {
                editable();
                startEdit(0);
                row(0).trigger('click', [undefined, { action: 'cancel' }]);
                expect(row(0).hasClass('row-editing')).toBe(false);
                expect(row(0).find('td').eq(1).text()).toBe('Alice');
                expect(row(0).find('td').eq(1).attr('title')).toBe('Alice');
                expect(ctx.options.clearActionRowIndex).toHaveBeenCalled();
                expect(row(0).find('.edit-row-button').hasClass('hidden')).toBe(false);
                expect(row(1).find('.edit-row-button').hasClass('disabled-action')).toBe(false);
            });

            it('restores expression cells through the expression callback', () => {
                editable({
                    colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false, customExpression: true })],
                });
                startEdit(0);
                row(0).trigger('click', [undefined, { action: 'cancel' }]);
                expect(row(0).find('td').eq(1).text()).toBe('expr');
            });

            it('removes a new row on cancel', () => {
                editable();
                ctx.$el.datatable('addNewRow');
                ctx.$el.find('tr.row-editing').trigger('click', [undefined, { action: 'cancel' }]);
                expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
            });

            it('closes the editing row, removing new rows and cancelling edits', () => {
                editable();
                startEdit(1);
                ctx.$el.datatable('closeEditedRow');
                expect(row(1).hasClass('row-editing')).toBe(false);
                ctx.$el.datatable('addNewRow');
                ctx.$el.datatable('closeEditedRow');
                expect(ctx.$el.find('tr.app-datagrid-row')).toHaveLength(3);
                expect(() => ctx.$el.datatable('closeEditedRow')).not.toThrow();
            });

            it('shows the saved values when hiding the edit mode', () => {
                editable();
                startEdit(0);
                fieldValues = { name: 'Saved', age: 3 };
                ctx.instance.hideRowEditMode(row(0));
                expect(row(0).hasClass('row-editing')).toBe(false);
                expect(row(0).find('td').eq(1).text()).toBe('Saved');
            });

            it('resets the always new row instead of hiding it for scrolling grids', () => {
                editable({ editmode: 'quickedit', showNewRow: true, isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1) });
                const reset = jest.spyOn(ctx.instance, 'resetNewRow').mockImplementation(() => undefined);
                ctx.instance.hideRowEditMode(ctx.$el.find('tr.always-new-row'));
                expect(reset).toHaveBeenCalledTimes(1);
            });

            it('removes new rows and updates the status', () => {
                editable({ data: [] });
                const status = jest.spyOn(ctx.instance, 'setStatus');
                ctx.$el.datatable('addNewRow');
                ctx.instance.removeNewRow(ctx.$el.find('tr.row-editing'));
                expect(status.mock.calls[status.mock.calls.length - 1][0]).toBe('nodata');
                editable({ editmode: 'quickedit', showNewRow: true });
                ctx.instance.removeNewRow(ctx.$el.find('tr.always-new-row'));
                expect(ctx.$el.find('tr.always-new-row')).toHaveLength(1);
            });
        });

        describe('detecting modifications', () => {
            it('compares values, datetimes and uploads', () => {
                editable({
                    colDefs: [
                        defaultCol('name', { readonly: false }),
                        defaultCol('when', { readonly: false, editWidgetType: 'datetime' }),
                        defaultCol('file', { readonly: false, editWidgetType: 'upload' }),
                    ],
                    data: [{ name: 'A', when: '2020-01-01T00:00:00', file: null }],
                });
                startEdit(0);
                const cells = row(0).find('td.cell-editing');
                const nameCell = cells.eq(0);
                const whenCell = cells.eq(1);
                const fileCell = cells.eq(2);
                const data = { name: 'A', when: '2020-01-01T00:00:00' };
                fieldValues = { name: 'A', when: '2020-01-01T00:00:00' };
                expect(ctx.instance.isDataModified(nameCell, data, false)).toBe(false);
                fieldValues = { name: 'B' };
                expect(ctx.instance.isDataModified(nameCell, data, false)).toBe(true);
                fieldValues = { when: '2021-01-01T00:00:00' };
                expect(ctx.instance.isDataModified(whenCell, data, false)).toBe(true);
                fieldValues = { when: '2020-01-01T00:00:00' };
                expect(ctx.instance.isDataModified(whenCell, data, false)).toBe(false);
                fieldValues = {};
                expect(ctx.instance.isDataModified(nameCell, { name: null }, false)).toBe(false);
                expect(ctx.instance.isDataModified(fileCell, data, false)).toBe(false);
                fieldValues = { name_new: 'X' };
                expect(ctx.instance.isDataModified(nameCell, data, true)).toBe(true);
            });
        });

        describe('deleting', () => {
            const del = (i: number) => {
                const btn = row(i).find('.delete-row-button')[0];
                const ev = $.Event('click');
                ctx.instance.deleteRow({ ...ev, target: btn, stopPropagation: jest.fn(), which: 0 });
            };

            it('marks the row while the delete is in progress and restores it afterwards', () => {
                editable({ onBeforeRowDelete: jest.fn(), beforeRowDelete: jest.fn() });
                row(0).addClass('active');
                del(0);
                expect(ctx.options.beforeRowDelete).toHaveBeenCalledWith(ctx.options.data[0], expect.anything());
                expect(ctx.options.onBeforeRowDelete).toHaveBeenCalledWith(ctx.options.data[0], expect.anything(), {});
                expect(row(0).hasClass('danger')).toBe(true);
                expect(row(0).hasClass('active')).toBe(false);
                const [data, cancel] = ctx.options.onRowDelete.mock.calls[0];
                expect(data).toBe(ctx.options.data[0]);
                cancel();
                expect(row(0).hasClass('danger')).toBe(false);
                expect(row(0).hasClass('active')).toBe(true);
            });

            it('stops when onBeforeRowDelete cancels', () => {
                editable({ onBeforeRowDelete: jest.fn(() => false) });
                del(0);
                expect(ctx.options.onRowDelete).not.toHaveBeenCalled();
            });

            it('passes the row locator for variable data sources', () => {
                editable({ getDataSource: jest.fn(() => ({ category: 'wm.Variable' })) });
                del(1);
                expect(ctx.options.onRowDelete.mock.calls[0][4]).toEqual({ rowindex: 1 });
            });

            it('removes unsaved rows directly', () => {
                editable({ data: [] });
                ctx.$el.datatable('addNewRow');
                const newRowBtn = ctx.$el.find('tr.row-editing .delete-row-button')[0] || ctx.$el.find('tr.row-editing')[0];
                ctx.instance.deleteRow({ target: newRowBtn, stopPropagation: jest.fn() });
                expect(ctx.$el.find('tr.row-editing')).toHaveLength(0);
            });

            it('removes the row from the data of scrolling grids after the delete succeeds', () => {
                editable({ isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10) });
                del(0);
                const success = ctx.options.onRowDelete.mock.calls[0][3];
                success();
                expect(ctx.options.setDeletedRowIndex).toHaveBeenCalledWith(0);
                expect(ctx.options.data).toHaveLength(2);
                expect(ctx.$el.find('tr.app-datagrid-row').length).toBe(2);
            });

            it('edits the neighbouring row after deleting in quick edit mode', () => {
                editable({ editmode: 'quickedit', showNewRow: false });
                const btn = row(1).find('.delete-row-button')[0];
                ctx.instance.deleteRow({ target: btn, stopPropagation: jest.fn() });
                const success = ctx.options.onRowDelete.mock.calls[0][3];
                const handler = jest.fn();
                row(1).on('click', handler);
                success(false, undefined);
                expect(handler).toHaveBeenCalledTimes(1);
                handler.mockClear();
                success(false, true);
                expect(handler).not.toHaveBeenCalled();
            });

            it('updates select all after deleting', () => {
                editable({ multiselect: true });
                const spy = jest.spyOn(ctx.instance, 'updateSelectAllCheckboxState');
                ctx.instance.deleteRowAndUpdateSelectAll({ target: row(0).find('.delete-row-button')[0], stopPropagation: jest.fn() });
                expect(spy).toHaveBeenCalledTimes(1);
            });
        });

        describe('after a successful save', () => {
            it('focuses the first field on errors', () => {
                editable();
                startEdit(0);
                const focus = jest.spyOn(ctx.instance, 'setFocusOnElement').mockImplementation(() => undefined);
                ctx.instance.editSuccessHandler(false, true, { target: row(0)[0] }, row(0));
                expect(focus).toHaveBeenCalledWith(expect.objectContaining({ target: row(0)[0] }));
            });

            it('moves to the neighbouring row with the arrow direction', () => {
                editable();
                const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
                ctx.instance.editSuccessHandler(false, undefined, {}, row(0), true, 'down');
                ctx.instance.editSuccessHandler(false, undefined, {}, row(0), true, 'up');
                expect(focus).toHaveBeenCalledTimes(2);
                focus.mockRestore();
            });

            it('edits the next row, or adds a new row after the last one', () => {
                editable({ multiselect: true });
                const handler = jest.fn();
                row(1).on('click', handler);
                ctx.instance.editSuccessHandler(false, undefined, {}, row(0), false);
                expect(handler).toHaveBeenCalledWith(expect.anything(), undefined, expect.objectContaining({ action: 'edit', skipSelect: true }));
                const add = jest.spyOn(ctx.instance, 'addNewRow').mockImplementation(() => undefined);
                ctx.instance.editSuccessHandler(false, undefined, {}, row(2), false);
                expect(add).toHaveBeenCalledTimes(1);
                ctx.instance.options.actionsEnabled.new = false;
                ctx.instance.editSuccessHandler(false, undefined, {}, row(2), false);
                expect(add).toHaveBeenCalledTimes(1);
            });

            it('adds a row when the next row is the always new row', () => {
                editable({ editmode: 'quickedit', showNewRow: true });
                const add = jest.spyOn(ctx.instance, 'addNewRow').mockImplementation(() => undefined);
                ctx.instance.editSuccessHandler(false, undefined, {}, row(2), true);
                expect(add).not.toHaveBeenCalled();
                ctx.instance.editSuccessHandler(false, undefined, {}, row(2), false);
                expect(add).toHaveBeenCalledTimes(1);
            });

            it('detects the last editable column', () => {
                editable();
                startEdit(0);
                const cells = row(0).find('td');
                expect(ctx.instance.isLastColumn(cells.last())).toBe(true);
                expect(ctx.instance.isLastColumn(cells.eq(0))).toBe(false);
                expect(ctx.instance.isLastColumn(row(0).find('td.cell-editing').first())).toBe(false);
            });
        });

        describe('focus helpers', () => {
            it('focuses the first input of the editing cells', () => {
                editable();
                startEdit(0);
                const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
                expect(() => ctx.instance.setFocusOnElement(undefined, row(0), true)).not.toThrow();
                focus.mockRestore();
            });

            it('focuses the input of the clicked cell', () => {
                editable();
                startEdit(0);
                const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
                ctx.instance.setFocusOnElement({ target: row(0).find('td.cell-editing')[0] });
                expect(ctx.options.timeoutCall).toHaveBeenCalled();
                focus.mockRestore();
            });

            it('focuses the active row and the always new row input', () => {
                editable({ editmode: 'quickedit', showNewRow: true });
                row(0).addClass('active');
                ctx.instance.focusActiveRow();
                const input = ctx.$el.find('tr.always-new-row input')[0] as HTMLInputElement;
                const focus = jest.spyOn(input, 'focus');
                ctx.instance.focusNewRow();
                expect(focus).toHaveBeenCalledTimes(1);
            });

            it('reads field values for edited and new rows', () => {
                editable();
                fieldValues = { name: 'a', name_new: 'b' };
                expect(ctx.instance.getTextValue('name')).toBe('a');
                expect(ctx.instance.getTextValue('name', true)).toBe('b');
            });

            it('reads uploaded files from the form', () => {
                editable();
                const file = new File(['x'], 'x.txt');
                const form = document.createElement('form');
                form.name = 'uploadForm';
                Object.defineProperty(document, 'forms', { configurable: true, value: { uploadForm: { upl: { files: [file] } } } });
                const $el = $('<td><form name="uploadForm"></form></td>');
                expect(ctx.instance.getUploadedFiles($el, 'upl')).toBe(file);
                delete (document as any).forms;
            });
        });
    });

    describe('load more and loading indicators', () => {
        it('adds a load more button and handles its click', () => {
            ctx = mount({ isLastPage: false, getCurrentPage: jest.fn(() => 1), getPageCount: jest.fn(() => 3), showviewlessbutton: false });
            const cb = jest.fn();
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading data', cb, false);
            const btn = ctx.$el.find('.on-demand-load-btn');
            expect(btn.text()).toBe('More');
            btn.trigger('click');
            expect(ctx.$el.find('.loading-data-msg')).toHaveLength(1);
            expect(ctx.$el.find('.loading-data-msg .loading-text').html()).toBe('Loading data');
            expect(btn[0].style.display).toBe('none');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('does not add a button on the last page unless scrolling', () => {
            ctx = mount({ isLastPage: true });
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, false);
            expect(ctx.$el.find('.on-demand-load-btn')).toHaveLength(0);
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            expect(ctx.$el.find('.on-demand-load-btn')).toHaveLength(1);
        });

        it('removes the button after the last page of infinite scroll and re-renders for view less', () => {
            ctx = mount({ isLastPage: false, getCurrentPage: jest.fn(() => 3), getPageCount: jest.fn(() => 3), showviewlessbutton: false, viewlessmessage: 'Less' });
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            ctx.$el.find('.on-demand-load-btn').trigger('click');
            expect(ctx.$el.find('.on-demand-datagrid')).toHaveLength(0);

            ctx.instance.options.showviewlessbutton = true;
            const render = jest.spyOn(ctx.instance, '_renderGrid').mockImplementation(() => undefined);
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, false);
            ctx.$el.find('.on-demand-load-btn').trigger('click');
            expect(ctx.options.enableNavigation).toHaveBeenCalledTimes(1);
            expect(render).toHaveBeenCalledTimes(1);
            expect(ctx.instance.renderTableOnViewLess).toBe(true);
        });

        it('shows and reuses the loading indicator', () => {
            ctx = mount();
            ctx.$el.datatable('showLoadingIndicator', 'Loading', false);
            expect(ctx.$el.find('.on-demand-datagrid .loading-data-msg')).toHaveLength(1);
            ctx.$el.datatable('hideLoadingIndicator', false, false);
            expect(ctx.$el.find('.loading-data-msg')[0].style.display).toBe('none');
            ctx.$el.datatable('showLoadingIndicator', 'Loading', false);
            expect(ctx.$el.find('.loading-data-msg')[0].style.display).not.toBe('none');
            ctx.$el.find('.on-demand-datagrid').hide();
            ctx.$el.datatable('showLoadingIndicator', 'Loading', true);
            expect(ctx.$el.find('.on-demand-datagrid')[0].style.display).not.toBe('none');
        });

        it('appends the indicator to an existing on demand container', () => {
            ctx = mount();
            ctx.$el.find('.app-grid-header-inner').append('<div class="on-demand-datagrid"></div>');
            ctx.$el.datatable('showLoadingIndicator', 'Loading', false);
            expect(ctx.$el.find('.on-demand-datagrid .loading-data-msg')).toHaveLength(1);
        });

        it('restores the load more link or the view less link when hiding the indicator', () => {
            ctx = mount({ ondemandmessage: 'More', viewlessmessage: 'Less', getCurrentPage: jest.fn(() => 2), getPageCount: jest.fn(() => 2), showviewlessbutton: true });
            ctx.$el.datatable('addLoadMoreBtn', 'More', 'Loading', undefined, true);
            ctx.$el.datatable('hideLoadingIndicator', true, false);
            expect(ctx.$el.find('.on-demand-load-btn').text()).toBe('Less');
            ctx.instance.options.addLoadMoreBtn = jest.fn();
            ctx.$el.find('.on-demand-datagrid').remove();
            ctx.$el.datatable('hideLoadingIndicator', true, true);
            expect(ctx.instance.options.addLoadMoreBtn).toHaveBeenCalledTimes(1);
            ctx.$el.datatable('hideLoadingIndicator', false, false);
            ctx.instance.options.showviewlessbutton = false;
            ctx.$el.find('.app-grid-header-inner').append('<div class="on-demand-datagrid"></div>');
            ctx.$el.datatable('hideLoadingIndicator', true, true);
            expect(ctx.$el.find('.on-demand-datagrid')[0].style.display).toBe('none');
        });
    });

    describe('default columns and header configuration', () => {
        const grouped = () => [
            { field: 'id', displayName: 'ID' },
            { field: 'grp', displayName: 'Group', isGroup: true, columns: [{ field: 'name', displayName: 'NAME' }, { field: 'age', displayName: 'AGE' }] },
        ];

        it('places the expansion column at the start, the end or after a field', () => {
            ctx = mount({ rowExpansionEnabled: true, rowDef: { position: '0', columnwidth: '40px', closeothers: false }, headerConfig: grouped() });
            expect(ctx.instance.preparedHeaderData[0].field).toBe('__expand');
            expect(ctx.instance.preparedHeaderData[0].width).toBe('40px');
            expect(ctx.instance.options.headerConfig[0]).toEqual({ field: '__expand', isPredefined: true });

            ctx.instance.options.rowDef.position = '-1';
            ctx.instance._prepareHeaderData();
            expect(ctx.instance.preparedHeaderData[ctx.instance.preparedHeaderData.length - 1].field).toBe('__expand');
            expect(ctx.instance.options.headerConfig[ctx.instance.options.headerConfig.length - 1].field).toBe('__expand');

            ctx.instance.options.rowDef.position = 'name';
            ctx.instance._prepareHeaderData();
            const fields = ctx.instance.preparedHeaderData.map((c: any) => c.field);
            expect(fields[fields.indexOf('name') + 1]).toBe('__expand');
            const group = ctx.instance.options.headerConfig.find((c: any) => c.isGroup);
            expect(group.columns.map((c: any) => c.field)).toEqual(['name', '__expand', 'age']);
        });

        it('adds the row index, checkbox and radio columns to the front', () => {
            ctx = mount({ showRowIndex: true, multiselect: true, headerConfig: grouped() });
            expect(ctx.instance.preparedHeaderData.slice(0, 2).map((c: any) => c.field)).toEqual(['checkbox', 'rowIndex']);
            expect(ctx.instance.options.headerConfig.slice(0, 2).map((c: any) => c.field)).toEqual(['checkbox', 'rowIndex']);
            ctx.$el.datatable('destroy');
            ctx = mount({ showRadioColumn: true });
            expect(ctx.instance.preparedHeaderData[0].field).toBe('radio');
        });

        it('keeps the header config untouched when it is empty or without matching positions', () => {
            ctx = mount();
            ctx.instance.setHeaderConfigForDefaultFields('checkbox', '0');
            expect(ctx.instance.options.headerConfig).toEqual([]);
            ctx.instance.options.headerConfig = [{ field: 'id' }];
            ctx.instance._insertFieldInHeaderConfig(ctx.instance.options.headerConfig, 'x', 'missing');
            expect(ctx.instance.options.headerConfig).toEqual([{ field: 'id' }]);
        });

        it('does not add default columns without column definitions', () => {
            ctx = mount({ colDefs: [], data: [], multiselect: true });
            ctx.instance.preparedHeaderData = [];
            ctx.instance.setDefaultColsData(true);
            expect(ctx.instance.preparedHeaderData).toEqual([]);
        });

        it('counts the column span of groups without hidden columns', () => {
            ctx = mount({
                colDefs: [defaultCol('id'), defaultCol('name', { show: false }), defaultCol('age')],
                headerConfig: grouped(),
            });
            const group = ctx.instance.options.headerConfig.find((c: any) => c.isGroup);
            expect(ctx.instance._getColSpan(group.columns)).toBe(1);
            ctx.instance._setColSpan(ctx.instance.options.headerConfig);
            expect(group.colspan).toBe(1);
            expect(ctx.$el.find('th[data-col-group="grp"]').attr('colspan')).toBe('1');
        });

        it('adds row spans to header cells next to groups', () => {
            ctx = mount({ headerConfig: grouped() });
            expect(ctx.$el.find('th.app-datagrid-header-cell[rowspan="2"]').length).toBeGreaterThan(0);
        });
    });

    describe('column widths', () => {
        it('applies defined widths and hides columns that are not shown', () => {
            ctx = mount({
                colDefs: [defaultCol('id', { width: '120px' }), defaultCol('name', { show: false }), defaultCol('age', { width: '30%' })],
            });
            ctx.instance.setColGroupWidths();
            const cols = ctx.$el.find('colgroup col');
            expect(cols[0].style.width).toBe('120px');
            expect(cols.eq(1).css('display')).toBe('none');
            expect(ctx.$el.find('th[data-col-id="1"]').css('display')).toBe('none');
            expect(ctx.$el.find('td[data-col-id="1"]').first().css('display')).toBe('none');
        });

        it('uses a small fixed width for selection columns', () => {
            ctx = mount({ multiselect: true });
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('50px');
        });

        it('falls back to the minimum width when the header width is not available', () => {
            ctx = mount();
            ctx.instance.setColGroupWidths();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('90px');
        });

        it('uses the header width when available and removes the scroll bar width from the last column', () => {
            const width = jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                return this.is('th') ? 200 : 0;
            } as any);
            ctx = mount();
            width.mockRestore();
            jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                return this.is('th') ? 200 : 0;
            } as any);
            ctx.instance.setColGroupWidths();
            (($.fn.width as any) as jest.SpyInstance).mockRestore();
            const cols = ctx.$el.find('colgroup col');
            expect(cols[0].style.width).toBe('200px');
            expect(cols[cols.length - 1].style.width).toBe('183px');
        });

        it('derives the width from the closest parent for hidden panes', () => {
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
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            const cols = ctx.$el.find('colgroup col');
            expect(cols[0].style.width).toBe('200px');
        });

        it('converts percentage widths of hidden panes to pixels', () => {
            const spy = jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                if (value !== undefined) {
                    return this;
                }
                if (this.is('th')) {
                    return 0;
                }
                return this.is('.grid-host') ? 1000 : 0;
            } as any);
            ctx = mount({ colDefs: [defaultCol('id', { width: '20%' }), defaultCol('name')] });
            ctx.instance.tableContainer.find('col').first().css('width', '20%');
            ctx.instance.setColGroupWidths();
            spy.mockRestore();
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('200px');
        });

        it('recomputes widths when the container has a width', () => {
            ctx = mount();
            const spy = jest.spyOn($.fn, 'width').mockImplementation(function (this: any, value?: any) {
                return value !== undefined ? this : 300;
            } as any);
            expect(() => ctx.$el.datatable('refreshColumnWidths')).not.toThrow();
            spy.mockRestore();
        });

        it('uses the first row cells when the header is hidden', () => {
            ctx = mount();
            ctx.$el.datatable('option', 'showHeader', false);
            expect(() => ctx.instance.setColGroupWidths()).not.toThrow();
        });

        it('resizes columns and the table with the header handles', () => {
            ctx = mount();
            const th = ctx.$el.find('th[data-col-resizable]').first();
            const instance = th.resizable('instance');
            const ui = { helper: th, size: { width: 150 }, originalSize: { width: 100 } };
            instance.options.resize({}, ui);
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('150px');
            expect(ctx.options.redrawWidgets).toHaveBeenCalled();
            instance.options.resize({}, { ...ui, size: { width: 60 } });
            expect(ctx.$el.find('colgroup col')[0].style.width).toBe('60px');
        });

        it('does not add resize handles on mobile', () => {
            ctx = mount({ isMobile: true });
            expect(ctx.$el.find('th[data-col-resizable]').first().resizable('instance')).toBeUndefined();
        });
    });

    describe('selected columns', () => {
        it('returns the data of selected columns without the default columns', () => {
            ctx = mount({ multiselect: true, showRowIndex: true });
            ctx.instance.preparedHeaderData.find((c: any) => c.field === 'name').selected = true;
            ctx.instance.preparedHeaderData.find((c: any) => c.field === 'checkbox').selected = true;
            const result = ctx.instance.getSelectedColumns();
            expect(Object.keys(result)).toEqual(['name']);
            expect(result.name.colData).toEqual(['Alice', 'Bob', 'Carol']);
        });

        it('skips the radio column', () => {
            ctx = mount({ showRadioColumn: true });
            ctx.instance.preparedHeaderData.find((c: any) => c.field === 'radio').selected = true;
            expect(ctx.instance.getSelectedColumns()).toEqual({});
        });

        it('keeps the column selection after the data refresh', () => {
            ctx = mount({ enableColumnSelection: true, enableSort: false });
            ctx.$el.find('th.app-datagrid-header-cell').eq(1).find('.header-data').trigger('click');
            ctx.$el.datatable('option', 'data', people());
            expect(ctx.$el.find('td[data-col-id="1"]').first().hasClass('selected-column')).toBe(true);
        });
    });

    describe('select all header checkbox', () => {
        it('selects and deselects all visible rows', () => {
            ctx = mount({ multiselect: true });
            const header = ctx.$el.find('th input:checkbox').first();
            header[0].click();
            expect(ctx.$el.find('tr.app-datagrid-row.active')).toHaveLength(3);
            expect(ctx.options.selectAllRows).toHaveBeenCalledWith(true, expect.anything());
            expect(ctx.options.onRowSelect).toHaveBeenCalledTimes(3);
            expect(header.siblings('span.sr-only').text()).toBe('All Rows Selected');
            header[0].click();
            expect(ctx.$el.find('tr.app-datagrid-row.active')).toHaveLength(0);
            expect(ctx.options.onRowDeselect).toHaveBeenCalledTimes(3);
        });

        it('does not raise row events when header select all is enabled', () => {
            ctx = mount({ multiselect: true, headerselectall: true });
            ctx.$el.find('th input:checkbox')[0].click();
            expect(ctx.options.onRowSelect).not.toHaveBeenCalled();
            expect(ctx.options.assignSelectedItems).toHaveBeenCalledTimes(3);
        });

        it('toggles the header checkbox with the enter key', () => {
            jest.useFakeTimers();
            ctx = mount({ multiselect: true });
            const header = ctx.$el.find('th input:checkbox').first();
            const click = jest.fn();
            header[0].addEventListener('click', click);
            header.trigger($.Event('keydown', { key: 'Enter' }));
            jest.runAllTimers();
            expect(click).toHaveBeenCalledTimes(1);
        });

        it('clicks the checkbox when enter is pressed on the checkbox header cell', () => {
            ctx = mount({ multiselect: true });
            const th = ctx.$el.find('th[data-col-field="checkbox"]');
            const click = jest.fn();
            th.find('input').on('click', click);
            th.trigger($.Event('keydown', { key: 'Enter', target: th[0] }));
            expect(click).toHaveBeenCalledTimes(1);
        });
    });

    describe('quick edit focus handling', () => {
        const quick = (extra: any = {}) =>
            mount({
                editmode: 'quickedit',
                showNewRow: false,
                colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false }), defaultCol('age', { readonly: false })],
                getInlineEditWidget: jest.fn((field: string) => `<input data-field-name="${field}">`),
                getFieldValue: jest.fn(() => undefined),
                getRowAction: jest.fn(() => ''),
                ...extra,
            });
        const row = (i: number) => ctx.$el.find('tr.app-datagrid-row').eq(i);

        it('edits a row when one of its cells receives the focus', () => {
            ctx = quick();
            row(1).find('td').first().trigger('focusin');
            expect(row(1).hasClass('row-editing')).toBe(true);
        });

        it('ignores focus on the row itself and on rows already being edited', () => {
            ctx = quick();
            row(1).trigger('focusin');
            expect(row(1).hasClass('row-editing')).toBe(false);
            row(1).addClass('row-editing');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow');
            row(1).find('td').first().trigger('focusin');
            expect(spy).not.toHaveBeenCalled();
        });

        const focusOut = (target: any, relatedTarget: any) => {
            const ev = $.Event('focusout', { relatedTarget });
            $(target).trigger(ev);
        };
        const wrapInGrid = () => {
            ctx.$el.wrap('<div class="app-grid" widget-id="grid-a"></div>');
            $('<div class="app-grid" widget-id="grid-b"><input class="other"></div>').appendTo(document.body);
        };

        it('saves the row when the focus moves to another grid', () => {
            ctx = quick();
            wrapInGrid();
            row(0).find('td').first().trigger('focusin');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            focusOut(row(0).find('td').eq(1)[0], $('.other')[0]);
            expect(ctx.options.timeoutCall).toHaveBeenCalled();
            expect(spy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'save', noMsg: true }));
            const success = (spy.mock.calls as any)[0][1].success;
            const next = jest.spyOn(ctx.instance, 'editSuccessHandler').mockImplementation(() => undefined);
            success(false, undefined, false);
            expect(next).not.toHaveBeenCalled();
        });

        it('does not save when the focus leaves the grids or stays in the same row', () => {
            ctx = quick();
            wrapInGrid();
            row(0).find('td').first().trigger('focusin');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            focusOut(row(0).find('td').eq(1)[0], document.body);
            focusOut(row(0).find('td').eq(1)[0], row(0)[0]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('does not save for confirm dialogs, grid actions and focus targets', () => {
            ctx = quick();
            wrapInGrid();
            row(0).find('td').first().trigger('focusin');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            row(0).addClass('danger');
            focusOut(row(0).find('td').eq(1)[0], $('.other')[0]);
            row(0).removeClass('danger');
            const action = $('<div class="app-datagrid-actions"><button></button></div>').appendTo(document.body);
            focusOut(row(0).find('td').eq(1)[0], action.find('button')[0]);
            const target = $('<button focus-target=""></button>').appendTo(document.body);
            focusOut(row(0).find('td').eq(1)[0], target[0]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('saves and moves on when tabbing out of the last column of the same grid', () => {
            ctx = quick();
            wrapInGrid();
            const sameGridInput = $('<input class="same">').appendTo(ctx.$el.closest('.app-grid'));
            row(0).find('td').first().trigger('focusin');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            jest.spyOn(ctx.instance, 'isLastColumn').mockReturnValue(true);
            focusOut(row(0).find('td').last()[0], sameGridInput[0]);
            expect(spy).toHaveBeenCalledTimes(1);
            const next = jest.spyOn(ctx.instance, 'editSuccessHandler').mockImplementation(() => undefined);
            (spy.mock.calls as any)[0][1].success(false, undefined, false);
            expect(next).toHaveBeenCalledTimes(1);
            (spy.mock.calls as any)[0][1].success(false, undefined, true);
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('enter on editing rows', () => {
        const editing = () => {
            ctx = mount({
                editmode: 'quickedit',
                showNewRow: false,
                colDefs: [defaultCol('id', { readonly: true }), defaultCol('name', { readonly: false })],
                getInlineEditWidget: jest.fn((field: string) => `<input data-field-name="${field}">`),
                getFieldValue: jest.fn(),
                getRowAction: jest.fn(() => ''),
            });
            const $row = ctx.$el.find('tr.app-datagrid-row').eq(1);
            $row.trigger('click', [undefined, { action: 'edit' }]);
            return $row;
        };

        it('saves the row and moves to the always new row in quick edit', () => {
            const $row = editing();
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const focusNew = jest.spyOn(ctx.instance, 'focusNewRow').mockImplementation(() => undefined);
            const hide = jest.spyOn(ctx.instance, 'hideRowEditMode').mockImplementation(() => undefined);
            const input = $row.find('input').first();
            ctx.instance._onEnter(input, $row, true, { stopPropagation: jest.fn() });
            const success = (spy.mock.calls as any)[0][1].success;
            success(false, undefined);
            expect(hide).toHaveBeenCalledTimes(1);
            expect(focusNew).toHaveBeenCalledTimes(1);
            expect($row.hasClass('active')).toBe(false);
        });

        it('focuses the failing field on error', () => {
            const $row = editing();
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const input = $row.find('input').first();
            const focus = jest.spyOn($.fn, 'focus').mockImplementation(function (this: any) { return this; });
            ctx.instance._onEnter(input, $row, true, { stopPropagation: jest.fn() });
            (spy.mock.calls as any)[0][1].success(false, true);
            expect(focus).toHaveBeenCalled();
            focus.mockRestore();
        });

        it('focuses the active row after saving in inline mode', () => {
            const $row = editing();
            ctx.instance.options.editmode = 'inline';
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            const focusActive = jest.spyOn(ctx.instance, 'focusActiveRow').mockImplementation(() => undefined);
            ctx.instance._onEnter($row.find('input').first(), $row, false, { stopPropagation: jest.fn() });
            (spy.mock.calls as any)[0][1].success(false, undefined);
            expect(focusActive).toHaveBeenCalledTimes(1);
        });

        it('focuses the new row after pressing enter on it', () => {
            ctx = mount({ editmode: 'quickedit', showNewRow: true, colDefs: [defaultCol('name', { readonly: false })], getInlineEditWidget: jest.fn(() => '<input data-field-name="name">'), getRowAction: jest.fn(() => '') });
            const $new = ctx.$el.find('tr.always-new-row');
            const focusNew = jest.spyOn(ctx.instance, 'focusNewRow').mockImplementation(() => undefined);
            ctx.instance._onEnter($new, $new, true, { stopPropagation: jest.fn() });
            expect(focusNew).toHaveBeenCalled();
        });

        it('moves through rows with the arrow keys while saving the editing row', () => {
            const $row = editing();
            $row.find('input').val('x');
            const spy = jest.spyOn(ctx.instance, 'toggleEditRow').mockImplementation(() => undefined);
            ctx.instance.processUpDownKeys({}, $row, 'down');
            const handler = jest.spyOn(ctx.instance, 'editSuccessHandler').mockImplementation(() => undefined);
            (spy.mock.calls as any)[0][1].success(false, undefined);
            expect(handler).toHaveBeenCalledWith(false, undefined, {}, $row, true, 'down');
        });

        it('cancels or resets rows on escape', () => {
            const $row = editing();
            const reset = jest.spyOn(ctx.instance, 'resetNewRow').mockImplementation(() => undefined);
            jest.spyOn(ctx.instance, '_isNewRow').mockReturnValue(true);
            $row.addClass('always-new-row');
            $row.trigger($.Event('keydown', { which: 27 }));
            expect(reset).toHaveBeenCalled();
        });
    });

    describe('utilities', () => {
        it('finds objects in arrays and rejects other inputs', () => {
            ctx = mount();
            const utils = ctx.instance.Utils;
            expect(utils.getObjectIndex([{ a: 1 }, { a: 2 }], { a: 2 })).toBe(1);
            expect(utils.getObjectIndex([{ a: 1 }], { a: 9 })).toBe(-1);
            expect(utils.getObjectIndex('x', {})).toBe(-1);
            expect(utils.isObject(null)).toBe(false);
            expect(utils.isObject({})).toBe(true);
            expect(utils.isDefined(undefined)).toBe(false);
        });

        it('generates unique ids and recognises html', () => {
            ctx = mount();
            const utils = ctx.instance.Utils;
            expect(utils.random()).toMatch(/^[0-9a-f]{4}$/);
            expect(utils.generateGuid()).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
            expect(utils.generateGuid()).not.toBe(utils.generateGuid());
            expect(utils.isValidHtml('<b>x</b>')).toBe(true);
            expect(utils.isValidHtml('plain')).toBe(false);
        });

        it('detects the delete key on the current platform', () => {
            ctx = mount();
            const utils = ctx.instance.Utils;
            expect(utils.isDeleteKey({ which: 46 })).toBe(true);
            const platform = jest.spyOn(navigator, 'platform', 'get');
            platform.mockReturnValue('MacIntel');
            expect(utils.isMac()).toBe(true);
            expect(utils.isDeleteKey({ which: 8 })).toBe(true);
            platform.mockReturnValue('Win32');
            expect(utils.isMac()).toBe(false);
            expect(utils.isDeleteKey({ which: 8 })).toBe(false);
            platform.mockRestore();
        });

        it('applies style strings property by property and ignores empty ones', () => {
            ctx = mount();
            const el = $('<div></div>');
            ctx.instance._setStyles(el, '');
            ctx.instance._setStyles(el, undefined);
            ctx.instance._setStyles(el, 'color: red; margin-left: 5px; ;');
            expect(el[0].style.color).toBe('red');
            expect(el[0].style.marginLeft).toBe('5px');
        });

        it('builds the event attributes of editable widgets', () => {
            ctx = mount();
            const change = ctx.instance._getEventTemplate({ onBlur: 'blur()' });
            expect(change).toContain('on-blur="blur()"');
            expect(change).toContain('on-change="_onChangeField($event, $scope, newVal, oldVal);"');
            expect(ctx.instance._getEventTemplate({ editWidgetType: 'autocomplete' })).toContain('on-submit="_onSubmitField');
        });
    });

    describe('presentation details', () => {
        it('applies spacing classes to the search area too', () => {
            ctx = mount({ filtermode: 'search', searchLabel: 'Search' });
            ctx.$el.datatable('option', 'spacing', 'condensed');
            expect(ctx.$el.find('.form-search select').hasClass('input-sm')).toBe(true);
            ctx.$el.datatable('option', 'spacing', 'normal');
            expect(ctx.$el.find('.form-search select').hasClass('input-sm')).toBe(false);
            expect(ctx.instance._toggleSpacingClasses('other')).toBeUndefined();
        });

        it('marks selected columns in the header', () => {
            ctx = mount({ colDefs: [defaultCol('id', { selected: true, class: 'extra' }), defaultCol('name')] });
            const th = ctx.$el.find('th[data-col-field="id"]');
            expect(th.hasClass('selected-column')).toBe(true);
            expect(th.hasClass('extra')).toBe(true);
        });

        it('registers title watches for custom expansion buttons', () => {
            const button = document.createElement('button');
            button.setAttribute('expandtitle.bind', 'a');
            button.setAttribute('collapsetitle.bind', 'b');
            ctx = mount({
                rowExpansionEnabled: true,
                colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')],
                getRowExpansionAction: jest.fn(() => button.cloneNode()),
            });
            expect(ctx.options.registerCollapseOrExpandTitleWatch).toHaveBeenCalledWith('a', expect.anything(), 0, 'expandtitle', expect.anything());
            expect(ctx.options.registerCollapseOrExpandTitleWatch).toHaveBeenCalledWith('b', expect.anything(), 0, 'collapsetitle', expect.anything());
        });

        it('gives detail rows the height of the row overlay', () => {
            ctx = mount({
                rowExpansionEnabled: true,
                colDefs: [{ field: '__expand', type: 'custom', show: true }, defaultCol('name')],
                rowDef: { position: '0', closeothers: false, columnwidth: '50px', height: '120px' },
            });
            const overlay = ctx.$el.find('tr.app-datagrid-detail-row .row-overlay').first();
            expect(overlay.length).toBe(1);
        });

        it('uses a title per row for selection columns', () => {
            ctx = mount({ multiselect: true, multiselecttitle: ['one', 'two', 'three'], radioselecttitle: 'r' });
            const cells = ctx.$el.find('tr.app-datagrid-row').map((i: number, tr: any) => $(tr).find('td').first().attr('title')).get();
            expect(cells).toEqual(['one', 'two', 'three']);
        });
    });

    describe('scroll grids with deletes and view less', () => {
        const scroll = (extra: any = {}) =>
            mount({
                navigation: 'On-Demand',
                isNavTypeScrollOrOndemand: jest.fn(() => true),
                getCurrentPage: jest.fn(() => 1),
                getPageSize: jest.fn(() => 10),
                isLastPage: false,
                ...extra,
            });

        it('re-renders from the first row after the view less action', () => {
            ctx = scroll();
            ctx.instance.renderTableOnViewLess = true;
            ctx.instance.options.isNextPageData = false;
            const hide = jest.spyOn(ctx.instance, 'hideLoadingIndicator');
            ctx.instance.refreshGridData();
            expect(hide).toHaveBeenCalled();
            expect(ctx.instance.renderTableOnViewLess).toBe(false);
        });

        it('continues numbering after a deleted row', () => {
            ctx = scroll({ lastActionPerformed: 'delete', actionRowIndex: 1 });
            ctx.instance.options.isDatasetUpdated = false;
            ctx.instance.refreshGridData();
            expect(ctx.$el.find('tr.app-datagrid-row').length).toBeGreaterThan(0);
        });
    });

    describe('option changes', () => {
        it('rebuilds the header when columns change during infinite scroll', () => {
            ctx = mount({ isNavTypeScrollOrOndemand: jest.fn(() => true), getCurrentPage: jest.fn(() => 1), getPageSize: jest.fn(() => 10), isNextPageData: true });
            ctx.$el.datatable('option', 'colDefs', [defaultCol('id'), defaultCol('name')]);
            expect(ctx.$el.find('th.app-datagrid-header-cell').length).toBe(2);
        });

        it('keeps the default sort icon when data changes before any sort', () => {
            ctx = mount({ sortInfo: { field: 'name', direction: 'asc' } });
            ctx.instance.isResetSortIconsDone = false;
            ctx.$el.datatable('option', 'data', people());
            expect(ctx.$el.find('th[data-col-field="name"] .sort-buttons-container').hasClass('active')).toBe(true);
        });

        it('refreshes the sort header and column selection options', () => {
            ctx = mount();
            const refresh = jest.spyOn(ctx.instance, 'refreshSortHeader');
            ctx.$el.datatable('option', 'enableColumnSelection', true);
            ctx.$el.datatable('option', 'enableSort', false);
            expect(refresh).toHaveBeenCalledTimes(2);
        });

        it('selects the first row when the option is switched on', () => {
            ctx = mount();
            ctx.$el.datatable('option', 'selectFirstRow', true);
            expect(ctx.$el.find('tr.app-datagrid-row').eq(0).hasClass('active')).toBe(true);
        });

        it('rebuilds the header of dynamic widgets', () => {
            ctx = mount();
            ctx.instance.refreshSortHeader();
            expect(ctx.$el.find('th.app-datagrid-header-cell').length).toBe(3);
        });
    });

    describe('destroy', () => {
        it('removes the markup and event handlers', () => {
            ctx = mount();
            ctx.$el.datatable('destroy');
            expect(ctx.$el.find('table')).toHaveLength(0);
        });
    });
});
