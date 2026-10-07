import { LiveFilterDirective } from './live-filter.directive';
import { DataSource, DataType, FormWidgetType } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    applyFilterOnField: jest.fn(),
    fetchDistinctValues: jest.fn(),
    getDistinctValuesForField: jest.fn(),
    isDataSetWidget: jest.fn()
}));

const field = (overrides: any = {}) => ({
    field: 'f',
    name: 'f',
    widgettype: FormWidgetType.TEXT,
    type: DataType.STRING,
    readonly: false,
    show: true,
    resetDisplayInput: jest.fn(),
    ...overrides
});

const makeForm = (fields: any[], extra: any = {}): any => ({
    formFields: fields,
    datasource: { execute: jest.fn().mockResolvedValue({ data: {}, pagination: {} }) },
    enableemptyfilter: '',
    appLocale: { LABEL_NO_VALUE: '(empty)' },
    invokeEventCallback: jest.fn(),
    toggleMessage: jest.fn(),
    onResultCb: jest.fn(),
    pagesize: 20,
    filterWidgets: {},
    ...extra
});

const listArgs = (form: any) => form.datasource.execute.mock.calls.find((c: any[]) => c[0] === DataSource.Operation.LIST_RECORDS)[1];

describe('LiveFilterDirective coverage', () => {
    it('applyFilter uses the options object itself when it has no data wrapper', () => {
        const form = makeForm([]);
        const dir = new LiveFilterDirective(form);
        const filter = jest.spyOn(dir, 'filter').mockReturnValue('r' as any);
        expect(dir.applyFilter({ page: 3, orderBy: 'name' })).toBe('r');
        expect(filter).toHaveBeenCalledWith({ page: 3, orderBy: 'name' });
    });

    it('filter prefers an explicit options.orderBy and stores it', () => {
        const form = makeForm([]);
        const dir = new LiveFilterDirective(form);
        dir.filter({ orderBy: 'age desc' });
        expect(dir.orderBy).toBe('age desc');
        expect(listArgs(form).orderBy).toBe('age desc');
    });

    it('filter falls back to the default page size when the form has none', () => {
        const form = makeForm([], { pagesize: undefined });
        new LiveFilterDirective(form).filter();
        expect(listArgs(form).pagesize).toBe(20);
    });

    it('filter prefers defined min/max values of autocomplete range fields over the DOM', () => {
        const dom: any = { first: jest.fn(), last: jest.fn(), val: jest.fn().mockReturnValue('dom') };
        dom.first.mockReturnValue(dom);
        dom.last.mockReturnValue(dom);
        const f = field({ widgettype: FormWidgetType.AUTOCOMPLETE, 'is-range': true, minValue: 1, maxValue: 9 });
        const form = makeForm([f], { $element: { find: jest.fn().mockReturnValue(dom) } });
        const beforeCall = form.invokeEventCallback;
        new LiveFilterDirective(form).filter();
        expect(beforeCall.mock.calls[0][1].$data).toEqual({ f: { minValue: 1, maxValue: 9 } });
        expect(dom.val).not.toHaveBeenCalled();
    });

    it('filter continues after a beforeservicecall error that is not an "Abort"', () => {
        const form = makeForm([field({ value: 'x' })]);
        form.invokeEventCallback.mockImplementation(() => { throw new Error('boom'); });
        new LiveFilterDirective(form).filter();
        expect(listArgs(form).filterFields).toBeDefined();
    });

    it.each([FormWidgetType.CHECKBOXSET, FormWidgetType.CHIPS])('includes non-empty %s values', (widgettype) => {
        const form = makeForm([field({ widgettype, _value: ['a', 'b'] })]);
        const dir = new LiveFilterDirective(form);
        form.invokeEventCallback.mockImplementation(() => undefined);
        // _value is overwritten from the data model, so seed value instead
        form.formFields[0].value = ['a', 'b'];
        dir.filter();
        expect(listArgs(form).filterFields.f.value).toEqual(['a', 'b']);
    });

    it.each([FormWidgetType.CHECKBOX, FormWidgetType.TOGGLE, FormWidgetType.ICONBUTTONTOGGLE])('%s: skips undefined values and keeps non-boolean raw values', (widgettype) => {
        const empty = makeForm([field({ widgettype, type: DataType.BOOLEAN })]);
        new LiveFilterDirective(empty).filter();
        expect(listArgs(empty).filterFields).toEqual({});

        const raw = makeForm([field({ widgettype, type: DataType.INTEGER, value: 5 })]);
        new LiveFilterDirective(raw).filter();
        expect(listArgs(raw).filterFields.f.value).toBe(5);

        const bool = makeForm([field({ widgettype, type: DataType.BOOLEAN, value: 'true' })]);
        new LiveFilterDirective(bool).filter();
        expect(listArgs(bool).filterFields.f.value).toBe(true);
    });

    it('registerFormWidget falls back to the widget name when there is no key', () => {
        const form = makeForm([]);
        const dir = new LiveFilterDirective(form);
        const w = { name: 'w1' };
        dir.registerFormWidget(w);
        expect(form.filterWidgets.w1).toBe(w);
    });

    it('ngOnDestroy tolerates being called twice', () => {
        const dir = new LiveFilterDirective(makeForm([]));
        const cancel = jest.fn();
        (dir as any)._filter = Object.assign(() => undefined, { cancel });
        dir.ngOnDestroy();
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(dir._filter).toBeNull();
        expect(() => dir.ngOnDestroy()).not.toThrow();
    });

    it('ngOnDestroy handles a _filter without cancel', () => {
        const dir = new LiveFilterDirective(makeForm([]));
        (dir as any)._filter = () => undefined;
        dir.ngOnDestroy();
        expect(typeof dir._filter).toBe('function');
    });
});
