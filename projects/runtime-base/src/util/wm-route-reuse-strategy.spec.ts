import {
    CACHE_PAGE,
    WmDefaultRouteReuseStrategy,
    WmNgRouteReuseStrategy,
    WmRouteReuseStrategy
} from './wm-route-reuse-strategy';

const route = (opts: any = {}): any => ({
    queryParams: {},
    params: {},
    data: {},
    routeConfig: undefined,
    ...opts
});

const handle = () => ({ componentRef: { destroy: jest.fn() } } as any);

describe('WmDefaultRouteReuseStrategy', () => {
    let strategy: WmDefaultRouteReuseStrategy;

    beforeEach(() => {
        jest.useFakeTimers();
        strategy = new WmDefaultRouteReuseStrategy(10, 0);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('store / retrieve and key building', () => {
        it('ignores empty handles', () => {
            strategy.store(route({ params: { pageName: 'A' } }), null);
            expect(strategy.retrieve(route({ params: { pageName: 'A' } }))).toBeNull();
        });

        it('stores handles under pageName plus sorted query params, ignoring wm_state and cache param', () => {
            const h = handle();
            const r = route({
                params: { pageName: 'A' },
                queryParams: { b: 2, a: 1, wm_state: 'x', [CACHE_PAGE]: 'true' },
                data: { [CACHE_PAGE]: true }
            });
            strategy.store(r, h);
            expect(h[CACHE_PAGE]).toBe(true);
            expect(strategy.retrieve(route({ params: { pageName: 'A' }, queryParams: { a: 1, b: 2 } }))).toBe(h);
            expect(strategy.retrieve(route({ params: { pageName: 'A' } }))).toBeNull();
        });

        it('uses data.pageName when the route path matches it', () => {
            const h = handle();
            strategy.store(route({ params: { pageName: 'X' }, data: { pageName: 'Real' }, routeConfig: { path: 'Real' } }), h);
            expect(strategy.retrieve(route({ params: { pageName: 'Real' } }))).toBe(h);
        });

        it('keeps params.pageName when the route path differs from data.pageName', () => {
            const h = handle();
            strategy.store(route({ params: { pageName: 'X' }, data: { pageName: 'Real' }, routeConfig: { path: 'other' } }), h);
            expect(strategy.retrieve(route({ params: { pageName: 'X' } }))).toBe(h);
        });

        it('marks non-cacheable handles as such', () => {
            const h = handle();
            strategy.store(route({ params: { pageName: 'A' } }), h);
            expect(h[CACHE_PAGE]).toBe(false);
        });
    });

    describe('shouldDetach', () => {
        it('detaches when the route data enables page caching', () => {
            expect(strategy.shouldDetach(route({ params: { pageName: 'A' }, data: { [CACHE_PAGE]: true } }))).toBe(true);
        });

        it('honours the cache query param over route data ("true" and true enable, others disable)', () => {
            expect(strategy.shouldDetach(route({ params: { pageName: 'A' }, queryParams: { [CACHE_PAGE]: 'true' } }))).toBe(true);
            expect(strategy.shouldDetach(route({ params: { pageName: 'A' }, queryParams: { [CACHE_PAGE]: true } }))).toBe(true);
            expect(strategy.shouldDetach(route({
                params: { pageName: 'A' },
                queryParams: { [CACHE_PAGE]: 'false' },
                data: { [CACHE_PAGE]: true }
            }))).toBe(false);
        });

        it('drops the cache entry and does not detach when caching is off', () => {
            const r = route({ params: { pageName: 'A' } });
            const h = handle();
            strategy.store(r, h);
            expect(strategy.shouldDetach(r)).toBe(false);
            expect(strategy.retrieve(r)).toBeNull();
            expect(h.componentRef.destroy).toHaveBeenCalled();
        });
    });

    describe('shouldAttach', () => {
        it('attaches a cached, cache-enabled handle', () => {
            const r = route({ params: { pageName: 'A' }, data: { [CACHE_PAGE]: true } });
            strategy.store(r, handle());
            expect(strategy.shouldAttach(r)).toBe(true);
        });

        it('does not attach when nothing is cached', () => {
            expect(strategy.shouldAttach(route({ params: { pageName: 'A' } }))).toBe(false);
        });

        it('rejects a handle whose caching was disabled', () => {
            const r = route({ params: { pageName: 'A' } });
            strategy.store(r, handle()); // stored with CACHE_PAGE=false
            expect(strategy.shouldAttach(r)).toBe(false);
        });

        it('keeps the current route entry when it is evicted (re-adds it)', () => {
            const r = route({ params: { pageName: 'A' }, data: { [CACHE_PAGE]: true } });
            const h = handle();
            strategy.store(r, h);
            strategy.shouldAttach(r); // marks 'A' as current
            strategy.reset('A');
            expect(h.componentRef.destroy).not.toHaveBeenCalled();
            expect(strategy.retrieve(r)).toBe(h);
        });
    });

    describe('reset', () => {
        const populate = () => {
            const handles: Record<string, any> = {};
            [
                ['A', {}],
                ['A', { x: 1 }],
                ['AB', {}],
                ['B', {}]
            ].forEach(([name, qp]: any) => {
                const h = handle();
                handles[name + JSON.stringify(qp)] = h;
                strategy.store(route({ params: { pageName: name }, queryParams: qp }), h);
            });
            return handles;
        };

        it('removes a page and its query-param variants only', () => {
            const h = populate();
            strategy.reset('A');
            expect(h['A{}'].componentRef.destroy).toHaveBeenCalled();
            expect(h['A{"x":1}'].componentRef.destroy).toHaveBeenCalled();
            expect(h['AB{}'].componentRef.destroy).not.toHaveBeenCalled();
            expect(h['B{}'].componentRef.destroy).not.toHaveBeenCalled();
        });

        it('clears everything without a page name', () => {
            const h = populate();
            strategy.reset();
            Object.values(h).forEach((x: any) => expect(x.componentRef.destroy).toHaveBeenCalled());
        });
    });

    describe('size limit', () => {
        it('evicts the oldest handle when the cache is full', () => {
            const s = new WmDefaultRouteReuseStrategy(1, 0);
            const first = handle();
            s.store(route({ params: { pageName: 'A' } }), first);
            s.store(route({ params: { pageName: 'B' } }), handle());
            expect(first.componentRef.destroy).toHaveBeenCalled();
        });

        it('supports default sizes', () => {
            expect(() => new WmDefaultRouteReuseStrategy()).not.toThrow();
        });
    });
});

describe('WmRouteReuseStrategy (preview / WM deployment)', () => {
    let strategy: WmRouteReuseStrategy;

    beforeEach(() => {
        jest.useFakeTimers();
        strategy = new WmRouteReuseStrategy();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('never reuses the prefab-preview route', () => {
        const r = route({ routeConfig: { path: 'prefab-preview' } });
        expect(strategy.shouldReuseRoute(r, r)).toBe(false);
    });

    it('reuses when neither route has params', () => {
        expect(strategy.shouldReuseRoute(route({ routeConfig: { path: 'x' } }), route())).toBe(true);
        expect(strategy.shouldReuseRoute(route(), route())).toBe(true);
    });

    it('does not reuse when param counts differ', () => {
        expect(strategy.shouldReuseRoute(route({ params: { pageName: 'A' } }), route())).toBe(false);
    });

    it('does not reuse different pages', () => {
        expect(strategy.shouldReuseRoute(route({ params: { pageName: 'A' } }), route({ params: { pageName: 'B' } }))).toBe(false);
    });

    it('reuses the same page only with the same query params', () => {
        const p = { pageName: 'A' };
        expect(strategy.shouldReuseRoute(route({ params: p }), route({ params: p }))).toBe(true);
        expect(strategy.shouldReuseRoute(
            route({ params: p, queryParams: { a: 1 } }), route({ params: p, queryParams: { a: 1 } }))).toBe(true);
        expect(strategy.shouldReuseRoute(
            route({ params: p, queryParams: { a: 1 } }), route({ params: p, queryParams: { a: 2 } }))).toBe(false);
        expect(strategy.shouldReuseRoute(
            route({ params: p, queryParams: { a: 1 } }), route({ params: p, queryParams: { a: 1, b: 2 } }))).toBe(false);
    });

    it('treats a throwing queryParams access as not-same', () => {
        const p = { pageName: 'A' };
        const bad = route({ params: p });
        Object.defineProperty(bad, 'queryParams', { get: () => { throw new Error('x'); } });
        expect(strategy.shouldReuseRoute(bad, route({ params: p }))).toBe(false);
    });

    it('treats null params as empty when comparing routes', () => {
        expect(strategy.shouldReuseRoute(route({ params: null }), route({ params: null }))).toBe(true);
        expect(strategy.shouldReuseRoute(route({ params: { pageName: 'A' } }), route({ params: null }))).toBe(false);
    });

    it('treats missing queryParams as empty', () => {
        const p = { pageName: 'A' };
        expect(strategy.shouldReuseRoute(route({ params: p, queryParams: null }), route({ params: p, queryParams: undefined }))).toBe(true);
    });
});

describe('WmNgRouteReuseStrategy (Angular deployment)', () => {
    let strategy: WmNgRouteReuseStrategy;

    beforeEach(() => {
        jest.useFakeTimers();
        strategy = new WmNgRouteReuseStrategy();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('reuses when neither route has a routeConfig', () => {
        expect(strategy.shouldReuseRoute(route(), route())).toBe(true);
    });

    it('does not reuse different route configs (including one missing)', () => {
        expect(strategy.shouldReuseRoute(route({ routeConfig: { path: 'a' } }), route({ routeConfig: { path: 'b' } }))).toBe(false);
        expect(strategy.shouldReuseRoute(route({ routeConfig: { path: 'a' } }), route())).toBe(false);
    });

    it('reuses layout routes without comparing query params', () => {
        const cfg = { path: 'layout' };
        expect(strategy.shouldReuseRoute(
            route({ routeConfig: cfg, data: { layoutName: 'L' }, queryParams: { a: 1 } }),
            route({ routeConfig: cfg, data: { layoutName: 'L' }, queryParams: { a: 2 } }))).toBe(true);
    });

    it('compares query params for the same non-layout route', () => {
        const cfg = { path: 'page' };
        expect(strategy.shouldReuseRoute(
            route({ routeConfig: cfg, queryParams: { a: 1 } }), route({ routeConfig: cfg, queryParams: { a: 1 } }))).toBe(true);
        expect(strategy.shouldReuseRoute(
            route({ routeConfig: cfg, queryParams: { a: 1 } }), route({ routeConfig: cfg, queryParams: { a: 2 } }))).toBe(false);
        expect(strategy.shouldReuseRoute(
            route({ routeConfig: cfg, data: { layoutName: 'L' } }), route({ routeConfig: cfg }))).toBe(true);
    });
});
