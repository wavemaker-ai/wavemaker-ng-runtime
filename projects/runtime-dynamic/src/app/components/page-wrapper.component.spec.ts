import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Injector } from '@angular/core';
import { Subject } from 'rxjs';

const mockClear = jest.fn();

jest.mock('@wm/runtime/base', () => ({
    AppManagerService: class AppManagerService {},
    BasePageComponent: class BasePageComponent { static clear() { mockClear(); } },
    ComponentRefProvider: class ComponentRefProvider {},
    ComponentType: { PAGE: 'PAGE' }
}));
jest.mock('@wm/variables', () => ({ MetadataService: class MetadataService {} }));
jest.mock('@wm/security', () => ({ SecurityService: class SecurityService {} }));

import { PageWrapperComponent } from './page-wrapper.component';

describe('PageWrapperComponent', () => {
    let comp: any;
    let host: HTMLElement;
    let vcRef: any, appManager: any, app: any, ngZone: any, provider: any, router: any, params$: Subject<any>, route: any;
    let errorSpy: jest.SpyInstance;
    const flush = () => new Promise(r => setTimeout(r));

    beforeEach(() => {
        jest.clearAllMocks();
        host = document.createElement('div');
        host.innerHTML = '<div>placeholder</div>';
        params$ = new Subject();
        route = { params: params$ };
        const pageEl = document.createElement('section');
        vcRef = {
            clear: jest.fn(),
            length: 1,
            remove: jest.fn(),
            createComponent: jest.fn(() => ({ instance: { id: 'inst' }, location: { nativeElement: pageEl } }))
        };
        appManager = { loadAppVariables: jest.fn(() => Promise.resolve()) };
        app = { isPrefabType: false };
        ngZone = { run: jest.fn(fn => fn()) };
        provider = { getComponentFactoryRef: jest.fn(() => Promise.resolve(class Page {})) };
        router = { navigate: jest.fn() };
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        comp = new PageWrapperComponent(
            TestBed.inject(Injector), { env: 1 } as any, route as ActivatedRoute, vcRef, {} as any, {} as any, {} as any,
            appManager, app, ngZone, { nativeElement: host } as any, {} as any, provider, router
        );
    });

    afterEach(() => errorSpy.mockRestore());

    it('exposes the host element as the target node and can reset it', () => {
        expect(comp.getTargetNode()).toBe(host);
        comp.resetViewContainer();
        expect(vcRef.clear).toHaveBeenCalled();
        expect(host.innerHTML).toBe('');
    });

    describe('ngOnInit', () => {
        it('navigates to the prefab preview for prefab projects', () => {
            app.isPrefabType = true;
            comp.ngOnInit();
            expect(router.navigate).toHaveBeenCalledWith(['prefab-preview']);
            expect(comp.subscription).toBeUndefined();
        });

        it('removes the placeholder and renders pages as route params change', async () => {
            comp.ngOnInit();
            expect(host.querySelector('div')).toBeNull();
            params$.next({ pageName: 'Main' });
            await flush();
            expect(ngZone.run).toHaveBeenCalled();
            expect(provider.getComponentFactoryRef).toHaveBeenCalledWith('Main', 'PAGE');
        });

        it('does not render when no page name is given', async () => {
            comp.ngOnInit();
            params$.next({});
            await flush();
            expect(provider.getComponentFactoryRef).not.toHaveBeenCalled();
        });
    });

    describe('renderPage', () => {
        it('creates the page with a route-aware injector and appends it', async () => {
            comp.renderPage('Main');
            await flush();
            expect(appManager.loadAppVariables).toHaveBeenCalled();
            const opts = vcRef.createComponent.mock.calls[0][1];
            expect(opts.index).toBe(0);
            expect(opts.environmentInjector).toEqual({ env: 1 });
            expect(opts.injector.get(ActivatedRoute)).toBe(route);
            expect(comp.instance).toEqual({ id: 'inst' });
            expect(host.querySelector('section')).not.toBeNull();
            expect(vcRef.remove).not.toHaveBeenCalled();
        });

        it('removes duplicate component instances', async () => {
            vcRef.length = 2;
            comp.renderPage('Main');
            await flush();
            expect(vcRef.remove).toHaveBeenCalledWith(1);
        });

        it('clears the page snapshot when the component cannot be resolved', async () => {
            provider.getComponentFactoryRef.mockResolvedValue(undefined);
            comp.renderPage('Missing');
            await flush();
            expect(errorSpy).toHaveBeenCalledWith('Failed to load page component: Missing');
            expect(mockClear).toHaveBeenCalled();
            expect(vcRef.createComponent).not.toHaveBeenCalled();
        });

        it('clears the page snapshot when creation fails', async () => {
            vcRef.createComponent.mockImplementation(() => { throw new Error('boom'); });
            comp.renderPage('Main');
            await flush();
            expect(errorSpy).toHaveBeenCalledWith('Error creating page component Main:', expect.any(Error));
            expect(mockClear).toHaveBeenCalled();
        });

        it('clears the page snapshot when app variables fail to load', async () => {
            appManager.loadAppVariables.mockRejectedValue('nope');
            comp.renderPage('Main');
            await flush();
            expect(errorSpy).toHaveBeenCalledWith('Error loading app variables for page Main:', 'nope');
            expect(mockClear).toHaveBeenCalled();
        });
    });

    describe('attach / detach', () => {
        it('re-attaches the cached page and notifies it', () => {
            const $page = document.createElement('section');
            comp.instance = { $page: [$page], ngOnAttach: jest.fn(), ngOnDetach: jest.fn() };
            comp.ngOnAttach();
            expect(host.contains($page)).toBe(true);
            expect(comp.instance.ngOnAttach).toHaveBeenCalled();
            comp.ngOnDetach();
            expect(comp.instance.ngOnDetach).toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('clears the view container, unsubscribes and drops the instance', () => {
            comp.ngOnInit();
            const sub = comp.subscription;
            comp.instance = {};
            comp.ngOnDestroy();
            expect(vcRef.clear).toHaveBeenCalled();
            expect(sub.closed).toBe(true);
            expect(comp.subscription).toBeNull();
            expect(comp.instance).toBeNull();
        });

        it('is safe without a subscription', () => {
            expect(() => comp.ngOnDestroy()).not.toThrow();
        });
    });
});
