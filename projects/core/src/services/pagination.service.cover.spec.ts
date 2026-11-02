import { PaginationService } from './pagination.service';

declare const $: any;

describe('PaginationService (cover)', () => {
    let service: PaginationService;
    let fetchFn: jest.Mock;

    beforeEach(() => {
        service = new PaginationService();
        fetchFn = jest.fn();
        jest.spyOn(service, 'debouncedFetchNextDatasetOnScroll').mockReturnValue(fetchFn as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (document as any).scrollingElement;
    });

    // builds a parent whose first child resolves to a (fake) scroll parent
    const build = (opts: { direction?: string; widgetType?: string; navScroll?: boolean; scrollable: boolean; node?: any }) => {
        const node = opts.node ?? {};
        if (opts.node === undefined) {
            Object.assign(node, opts.direction === 'row'
                ? { scrollWidth: opts.scrollable ? 1000 : 100, clientWidth: 100, scrollLeft: 0 }
                : { scrollHeight: opts.scrollable ? 1000 : 100, clientHeight: 100, scrollTop: 0 });
        }
        const handlers: any = {};
        const $scrollParent: any = { 0: node };
        $scrollParent.each = jest.fn((fn: any) => { fn(0, node); return $scrollParent; });
        $scrollParent.off = jest.fn(() => $scrollParent);
        $scrollParent.on = jest.fn((evt: string, fn: any) => { handlers[evt] = fn; return $scrollParent; });
        const $root: any = {
            children: () => ({ first: () => ({ length: 1, scrollParent: () => $scrollParent }) }),
            off: jest.fn(),
            on: jest.fn((evt: string, fn: any) => { handlers[evt] = fn; })
        };
        const parent: any = {
            direction: opts.direction,
            widgetType: opts.widgetType ?? 'wm-list',
            dataNavigator: {},
            $element: { find: () => $root },
            gridOptions: { isNavTypeScrollOrOndemand: () => !!opts.navScroll }
        };
        return { parent, handlers, node, $scrollParent, $root };
    };

    describe.each([
        ['vertical', undefined, 'scroll.scroll_evt', 'wheel.scroll_evt', 'scrollTop', 'scrollHeight', 'clientHeight', 'deltaY'],
        ['horizontal', 'row', 'scroll.scroll_evt_horizontal', 'wheel.scroll_evt_horizontal', 'scrollLeft', 'scrollWidth', 'clientWidth', 'deltaX']
    ])('%s', (_name, direction, scrollEvt, wheelEvt, posProp, totalProp, clientProp, deltaProp) => {
        const scrollTarget = (extra: any = {}) => ({ [posProp as string]: 950, [totalProp as string]: 1000, [clientProp as string]: 100, ...extra });

        it('resolves the document scrollingElement when the scroll event target is the document', () => {
            const b = build({ direction, scrollable: true });
            service.bindScrollEvt(b.parent, 'ul', 10);
            const el = scrollTarget();
            Object.defineProperty(document, 'scrollingElement', { value: el, configurable: true });
            const ctx = document.createElement('div');
            b.handlers[scrollEvt as string].call(ctx, { target: document, stopPropagation: jest.fn() });
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });

        it('falls back to document.body when the document has no scrollingElement', () => {
            const b = build({ direction, scrollable: true });
            service.bindScrollEvt(b.parent, 'ul', 10);
            jest.spyOn($.fn, posProp === 'scrollTop' ? 'scrollTop' : 'scrollLeft').mockReturnValue(5000);
            const bodyDims = jest.spyOn(document.body, totalProp as any, 'get').mockReturnValue(1000);
            jest.spyOn(document.body, clientProp as any, 'get').mockReturnValue(100);
            const ctx = document.createElement('div');
            b.handlers[scrollEvt as string].call(ctx, { target: document, stopPropagation: jest.fn() });
            expect(bodyDims).toHaveBeenCalled();
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });

        it('stops propagation for table widgets using scroll/ondemand navigation only', () => {
            const t = build({ direction, scrollable: true, widgetType: 'wm-table', navScroll: true });
            service.bindScrollEvt(t.parent, 'tbody', 10);
            const ev1 = { target: scrollTarget({ [posProp as string]: 0 }), stopPropagation: jest.fn() };
            t.handlers[scrollEvt as string].call(document.createElement('div'), ev1);
            expect(ev1.stopPropagation).toHaveBeenCalledTimes(1);

            const t2 = build({ direction, scrollable: true, widgetType: 'wm-table', navScroll: false });
            service.bindScrollEvt(t2.parent, 'tbody', 10);
            const ev2 = { target: scrollTarget({ [posProp as string]: 0 }), stopPropagation: jest.fn() };
            t2.handlers[scrollEvt as string].call(document.createElement('div'), ev2);
            expect(ev2.stopPropagation).not.toHaveBeenCalled();
            expect(fetchFn).not.toHaveBeenCalled();
        });

        it('uses the wheel fallback when not scrollable and honours table propagation rules', () => {
            const t = build({ direction, scrollable: false, widgetType: 'wm-table', navScroll: true });
            service.bindScrollEvt(t.parent, 'tbody', 10);
            const e1: any = { stopPropagation: jest.fn(), originalEvent: { [deltaProp as string]: 1 } };
            t.handlers[wheelEvt as string](e1);
            expect(e1.stopPropagation).toHaveBeenCalled();
            expect(t.$root.off).toHaveBeenCalledWith(wheelEvt);
            expect(fetchFn).toHaveBeenCalledTimes(1);

            const n = build({ direction, scrollable: false, widgetType: 'wm-list' });
            service.bindScrollEvt(n.parent, 'ul', 10);
            const e2: any = { stopPropagation: jest.fn(), originalEvent: { [deltaProp as string]: 0 } };
            n.handlers[wheelEvt as string](e2);
            expect(e2.stopPropagation).not.toHaveBeenCalled();
            expect(fetchFn).toHaveBeenCalledTimes(1);

            const t2 = build({ direction, scrollable: false, widgetType: 'wm-table', navScroll: false });
            service.bindScrollEvt(t2.parent, 'tbody', 10);
            const e3: any = { stopPropagation: jest.fn(), originalEvent: { [deltaProp as string]: 0 } };
            t2.handlers[wheelEvt as string](e3);
            expect(e3.stopPropagation).not.toHaveBeenCalled();
        });
    });

    it('pushes no new items when the loaded items already exceed the current page capacity', () => {
        const parent: any = {
            widgetType: 'wm-list',
            fieldDefs: [1, 2, 3, 4, 5],
            currentPage: 1,
            pagesize: 2,
            dataNavigator: { isFirstPage: () => false, pageCount: 10, dn: { currentPage: 3 }, dataSize: 50 }
        };
        const [fieldDefs, page] = service.updateFieldsOnPagination(parent, ['x', 'y']);
        expect(fieldDefs).toEqual([1, 2, 3, 4, 5]);
        expect(page).toBe(1);
    });
});
