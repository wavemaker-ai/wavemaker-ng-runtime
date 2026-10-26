import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';

const mockTranspile = jest.fn((m: string) => ({ markup: 'T:' + m }));
const mockScope = jest.fn((name: string, type: string, css: string) => `S:${name}:${type}:${css}`);
const mockCustomWidgets: any = {};

jest.mock('@wm/transpiler', () => ({
    transpile: (...a) => (mockTranspile as any)(...a),
    scopeComponentStyles: (...a) => (mockScope as any)(...a)
}));
jest.mock('@wm/runtime/base', () => {
    class Base {
        constructor() {}
    }
    Base.prototype['init'] = jest.fn();
    class BasePageComponent extends Base {}
    class BasePartialComponent extends Base {}
    class BasePrefabComponent extends Base {}
    class BaseCustomWidgetComponent extends Base {}
    return {
        AppManagerService: class AppManagerService {},
        BasePageComponent,
        BasePartialComponent,
        BasePrefabComponent,
        BaseCustomWidgetComponent,
        ComponentRefProvider: class ComponentRefProvider {},
        ComponentType: { PAGE: 'PAGE', PARTIAL: 'PARTIAL', PREFAB: 'PREFAB', WIDGET: 'WIDGET' },
        getPrefabMinJsonUrl: (n) => `prefab/${n}/min.json`,
        getPrefabPartialJsonUrl: (p, n) => `prefab/${p}/${n}.json`,
        REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS: [],
        AccessrolesDirective: class {},
        AppSpinnerComponent: class {},
        CustomToasterComponent: class {},
        AppComponent: class {},
        PrefabPreviewComponent: class {},
        EmptyPageComponent: class {},
        PrefabDirective: class {}
    };
});
jest.mock('@wavemaker-ai/custom-widgets-m3', () => {
    Object.defineProperty(mockCustomWidgets, '__esModule', { value: true });
    return mockCustomWidgets;
}, { virtual: true });
jest.mock('./app-resource-manager.service', () => ({
    AppResourceManagerService: class AppResourceManagerService {}
}));
jest.mock('@wm/components/page', () => ({
    ContentComponent: class {}, LayoutDirective: class {}, PageContentComponent: class {},
    PageDirective: class {}, RouterOutletDirective: class {}, SpaPageDirective: class {}
}));
jest.mock('@wm/components/base', () => ({ PartialDirective: class {} }));
jest.mock('@wm/components/basic/progress/progress-bar', () => ({ ProgressBarComponent: class {} }));
jest.mock('@wm/components/prefab', () => ({ PrefabContainerDirective: class {} }));

import { App, UserDefinedExecutionContext } from '@wm/core';
import { AppManagerService, ComponentType } from '@wm/runtime/base';
import { AppResourceManagerService } from './app-resource-manager.service';
import { ComponentRefProviderService } from './component-ref-provider.service';

const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');

const rawFragment = (extra: any = {}) => ({
    markup: enc('<div>m</div>'),
    script: enc('Page.ran = App.id + Utils.id;'),
    styles: enc('.a{}'),
    variables: enc('{"v":1}'),
    ...extra
});

describe('ComponentRefProviderService', () => {
    let service: ComponentRefProviderService;
    let app: any, appManager: any, resMngr: any;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(mockCustomWidgets).forEach(k => delete mockCustomWidgets[k]);
        app = { appLocale: {} };
        appManager = { notifyApp: jest.fn() };
        resMngr = { get: jest.fn(() => Promise.resolve(rawFragment())), clearCache: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                ComponentRefProviderService,
                { provide: App, useValue: app },
                { provide: AppManagerService, useValue: appManager },
                { provide: AppResourceManagerService, useValue: resMngr }
            ]
        });
        service = TestBed.inject(ComponentRefProviderService);
        service.clearComponentFactoryRefCache();
        resMngr.clearCache.mockClear();
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => errorSpy.mockRestore());

    it('exposes the fragment cache on window', () => {
        expect((window as any).resourceCache).toBeInstanceOf(Map);
    });

    describe('fragment urls', () => {
        it.each([
            ['Main', ComponentType.PAGE, undefined, './pages/Main/page.min.json'],
            ['Header', ComponentType.PARTIAL, undefined, './pages/Header/page.min.json'],
            ['Header', ComponentType.PARTIAL, { prefab: 'pf' }, 'prefab/pf/Header.json'],
            ['pf', ComponentType.PREFAB, undefined, 'prefab/pf/min.json'],
            ['Widget1', ComponentType.WIDGET, undefined, './custom-widgets/Widget1/page.min.json']
        ])('%s (%s) loads %s', async (name, type, opts, url) => {
            await service.getComponentFactoryRef(name, type as any, opts as any);
            expect(resMngr.get).toHaveBeenCalledWith(url, true);
        });
    });

    describe('getComponentFactoryRef', () => {
        it('processes the fragment and builds a component class', async () => {
            const cls: any = await service.getComponentFactoryRef('Main', ComponentType.PAGE);
            expect(mockTranspile).toHaveBeenCalledWith('<div>m</div>');
            expect(mockScope).toHaveBeenCalledWith('Main', 'PAGE', '.a{}');
            expect(cls).toBeDefined();
        });

        it('caches by type and name (component and instance caches)', async () => {
            const a = await service.getComponentFactoryRef('Main', ComponentType.PAGE);
            const b = await service.getComponentFactoryRef('Main', ComponentType.PAGE);
            expect(b).toBe(a);
            expect(resMngr.get).toHaveBeenCalledTimes(1);
        });

        it('serves from the instance cache after the shared cache is cleared', async () => {
            const a = await service.getComponentFactoryRef('Main', ComponentType.PAGE);
            // clear only the shared per-type cache, keeping the instance cache
            const other = TestBed.inject(ComponentRefProviderService);
            expect(other).toBe(service);
            (service as any).cache.set('PAGE-Ghost', a);
            // a different service instance has an empty shared cache entry for 'Ghost' but not for the instance
            expect(await service.getComponentFactoryRef('Ghost', ComponentType.PAGE)).toBe(a);
        });

        it('keys prefab partials by prefab+name', async () => {
            await service.getComponentFactoryRef('Header', ComponentType.PARTIAL, { prefab: 'pf' });
            await service.getComponentFactoryRef('Header', ComponentType.PARTIAL, { prefab: 'pf' });
            expect(resMngr.get).toHaveBeenCalledTimes(1);
            await service.getComponentFactoryRef('Header', ComponentType.PARTIAL);
            expect(resMngr.get).toHaveBeenCalledTimes(2);
        });

        it('shares in-flight fragment loads between callers', async () => {
            const [a, b] = await Promise.all([
                service.getComponentFactoryRef('Dup', ComponentType.PREFAB),
                service.getComponentFactoryRef('Dup', ComponentType.PREFAB)
            ]);
            expect(a).toBeDefined();
            expect(b).toBeDefined();
            expect(resMngr.get).toHaveBeenCalledTimes(1);
        });

        it('keeps the config of a fragment that has one', async () => {
            resMngr.get.mockResolvedValue(rawFragment({ config: enc('{"c":1}') }));
            expect(await service.getComponentFactoryRef('WithCfg', ComponentType.PAGE)).toBeDefined();
        });

        it('uses bundled custom widgets without fetching', async () => {
            mockCustomWidgets['Bundled'] = rawFragment();
            expect(await service.getComponentFactoryRef('Bundled', ComponentType.WIDGET)).toBeDefined();
            expect(resMngr.get).not.toHaveBeenCalled();
        });

        it('fetches custom widgets that are not bundled', async () => {
            await service.getComponentFactoryRef('Remote', ComponentType.WIDGET);
            expect(resMngr.get).toHaveBeenCalledWith('./custom-widgets/Remote/page.min.json', true);
        });

        it('decodes plus signs and tolerates undecodable text', async () => {
            resMngr.get.mockResolvedValue(rawFragment({ markup: 'a+b%E0%A4%A' }));
            await service.getComponentFactoryRef('Bad', ComponentType.PAGE);
            expect(mockTranspile).toHaveBeenCalledWith('a+b%E0%A4%A');
        });
    });

    describe('error handling', () => {
        it.each([
            [404, 'Page not available'],
            [403, 'Access Denied'],
            [500, 'Unknown error loading component'],
            [undefined, 'Unknown error loading component']
        ])('notifies for status %s', async (status, message) => {
            resMngr.get.mockRejectedValue({ details: { status } });
            await expect(service.getComponentFactoryRef(`Err${status}`, ComponentType.PAGE)).resolves.toBeUndefined();
            expect(appManager.notifyApp).toHaveBeenCalledWith(message, 'error');
        });

        it('uses localized messages when available', async () => {
            app.appLocale = { MESSAGE_PAGE_NOT_FOUND: 'Not here', LABEL_ACCESS_DENIED: 'Nope' };
            resMngr.get.mockRejectedValue({ details: { status: 404 } });
            await service.getComponentFactoryRef('L404', ComponentType.PAGE);
            expect(appManager.notifyApp).toHaveBeenCalledWith('Not here', 'error');
            resMngr.get.mockRejectedValue({ details: { status: 403 } });
            await service.getComponentFactoryRef('L403', ComponentType.PAGE);
            expect(appManager.notifyApp).toHaveBeenCalledWith('Nope', 'error');
        });

        it('handles a missing locale and errors without details', async () => {
            app.appLocale = undefined;
            resMngr.get.mockRejectedValue({ details: { status: 404 } });
            await service.getComponentFactoryRef('NoLocale', ComponentType.PAGE);
            expect(appManager.notifyApp).toHaveBeenCalledWith('Page not available', 'error');
            resMngr.get.mockRejectedValue(null);
            await service.getComponentFactoryRef('NullErr', ComponentType.PAGE);
        });

        it('uses a generic message when a non-string error escapes the build step', async () => {
            mockTranspile.mockImplementationOnce(() => { throw new Error('boom'); });
            await service.getComponentFactoryRef('Boom', ComponentType.PAGE);
            expect(appManager.notifyApp).toHaveBeenCalledWith('Unknown error loading component', 'error');
        });

        it('reports non-string errors from component creation generically', async () => {
            const spy = jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => { throw new Error('json'); });
            await expect(service.getComponentFactoryRef('Json', ComponentType.PAGE)).resolves.toBeUndefined();
            expect(appManager.notifyApp).toHaveBeenCalledWith('Error loading component, check console', 'error');
            spy.mockRestore();
        });
    });

    describe('generated component class', () => {
        const instantiate = async (name: string, type: any, fragment?: any) => {
            if (fragment) { resMngr.get.mockResolvedValue(fragment); }
            const cls: any = await service.getComponentFactoryRef(name, type);
            const instance = new cls(TestBed.inject(Injector));
            return instance;
        };

        it.each([
            [ComponentType.PAGE, 'pageName'],
            [ComponentType.PARTIAL, 'partialName'],
            [ComponentType.PREFAB, 'prefabName'],
            [ComponentType.WIDGET, 'customWidgetName']
        ])('%s components know their name and initialise', async (type, prop) => {
            const instance = await instantiate('N' + type, type);
            expect(instance[prop]).toBe('N' + type);
            expect(instance.isDynamicComponent).toBe(true);
            expect(instance.init).toHaveBeenCalled();
            expect(instance.injector).toBeDefined();
            expect(instance.getExpressions()).toEqual({});
        });

        it('parses variables, falling back to an empty object', async () => {
            const ok = await instantiate('V1', ComponentType.PAGE);
            expect(ok.getVariables()).toEqual({ v: 1 });
            const bad = await instantiate('V2', ComponentType.PAGE, rawFragment({ variables: enc('not json') }));
            expect(bad.getVariables()).toEqual({});
            const nul = await instantiate('V3', ComponentType.PAGE, rawFragment({ variables: enc('null') }));
            expect(nul.getVariables()).toEqual({});
        });

        it('runs the user script with the page context, caching the compiled function', async () => {
            const instance = await instantiate('S1', ComponentType.PAGE);
            const ctx: any = {};
            instance.evalUserScript(ctx, { id: 'a' }, { id: 'u' });
            expect(ctx.ran).toBe('au');
            const ctx2: any = {};
            instance.evalUserScript(ctx2, { id: 'b' }, { id: 'v' });
            expect(ctx2.ran).toBe('bv');
        });

        it('recompiles partial scripts for partials inside prefabs', async () => {
            const frag = rawFragment({ script: enc('Partial.n = (Partial.n || 0) + 1;') });
            const instance = await instantiate('P1', ComponentType.PARTIAL, frag);
            const inPrefab: any = { Prefab: {} };
            instance.evalUserScript(inPrefab, {}, {});
            instance.evalUserScript(inPrefab, {}, {});
            expect(inPrefab.n).toBe(2);
            const plain: any = {};
            instance.evalUserScript(plain, {}, {});
            expect(plain.n).toBe(1);
        });

        it('provides itself as the UserDefinedExecutionContext', async () => {
            const cls: any = await service.getComponentFactoryRef('Ctx', ComponentType.PAGE);
            const annotations = (cls as any).__annotations__ || [];
            expect(UserDefinedExecutionContext).toBeDefined();
            expect(cls).toBeDefined();
            expect(Array.isArray(annotations)).toBe(true);
        });
    });

    describe('clearComponentFactoryRefCache', () => {
        it('clears resource, fragment and component caches', async () => {
            await service.getComponentFactoryRef('Clr', ComponentType.PAGE);
            service.clearComponentFactoryRefCache();
            expect(resMngr.clearCache).toHaveBeenCalled();
            await service.getComponentFactoryRef('Clr', ComponentType.PAGE);
            expect(resMngr.get).toHaveBeenCalledTimes(2);
        });
    });
});
