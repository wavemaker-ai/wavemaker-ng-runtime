jest.mock('@wm/runtime/base', () => ({
    ComponentRefProvider: class ComponentRefProvider {},
    ComponentType: { PAGE: 'PAGE', PARTIAL: 'PARTIAL', PREFAB: 'PREFAB', WIDGET: 'WIDGET' }
}));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    PartialRefProvider: class PartialRefProvider {}
}));

import { ComponentType } from '@wm/runtime/base';
import { partialLazyModules, prefabLazyModules, prefabPartialLazyModules } from '../util/lazy-module-routes';
import { ComponentRefProviderService } from './component-ref-provider.service';
import { LazyComponentRefProviderService } from './lazy-component-ref-provider.service';

class Cmp {}

describe('LazyComponentRefProviderService', () => {
    let service: LazyComponentRefProviderService;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        service = new LazyComponentRefProviderService();
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        [partialLazyModules, prefabLazyModules, prefabPartialLazyModules].forEach(m => Object.keys(m).forEach(k => delete m[k]));
        jest.restoreAllMocks();
    });

    it('loads standard partials, prefabs and prefab scoped partials', async () => {
        partialLazyModules['P'] = { loadComponent: () => Promise.resolve(Cmp) };
        prefabLazyModules['Pf'] = { loadComponent: () => Promise.resolve(Cmp) };
        prefabPartialLazyModules['Pf_P'] = { loadComponent: () => Promise.resolve(Cmp) };
        await expect(service.getComponentFactoryRef('P', ComponentType.PARTIAL)).resolves.toBe(Cmp);
        await expect(service.getComponentFactoryRef('Pf', ComponentType.PREFAB)).resolves.toBe(Cmp);
        await expect(service.getComponentFactoryRef('P', ComponentType.PARTIAL, { prefab: 'Pf' })).resolves.toBe(Cmp);
    });

    it('returns null and logs when no lazy module exists', async () => {
        await expect(service.getComponentFactoryRef('X', ComponentType.PARTIAL)).resolves.toBeNull();
        await expect(service.getComponentFactoryRef('X', ComponentType.PAGE)).resolves.toBeNull();
        expect(errorSpy).toHaveBeenCalledWith('No lazy module found for X');
    });

    it('returns null when the module resolves no component or throws', async () => {
        partialLazyModules['Empty'] = { loadComponent: () => Promise.resolve(undefined as any) };
        partialLazyModules['Boom'] = { loadComponent: () => Promise.reject(new Error('x')) };
        await expect(service.getComponentFactoryRef('Empty', ComponentType.PARTIAL)).resolves.toBeNull();
        expect(errorSpy).toHaveBeenCalledWith('Failed to load component class: Empty');
        await expect(service.getComponentFactoryRef('Boom', ComponentType.PARTIAL)).resolves.toBeNull();
        expect(errorSpy).toHaveBeenCalledWith('Error lazy loading component Boom:', expect.any(Error));
    });
});

describe('ComponentRefProviderService', () => {
    let lazy: any;
    let service: ComponentRefProviderService;

    beforeEach(() => {
        lazy = { getComponentFactoryRef: jest.fn(() => Promise.resolve(null)) };
        service = new ComponentRefProviderService(lazy);
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('returns registered components from the cache', async () => {
        ComponentRefProviderService.registerComponentRef('Home', ComponentType.PAGE, Cmp, { legacy: true });
        await expect(service.getComponentFactoryRef('Home', ComponentType.PAGE)).resolves.toBe(Cmp);
        expect(lazy.getComponentFactoryRef).not.toHaveBeenCalled();
    });

    it('falls back to lazy loading for partials and prefabs', async () => {
        class Lazy {}
        lazy.getComponentFactoryRef.mockResolvedValueOnce(Lazy);
        await expect(service.getComponentFactoryRef('LazyP', ComponentType.PARTIAL, { prefab: 'x' })).resolves.toBe(Lazy);
        expect(lazy.getComponentFactoryRef).toHaveBeenCalledWith('LazyP', ComponentType.PARTIAL, { prefab: 'x' });
        lazy.getComponentFactoryRef.mockResolvedValueOnce(Lazy);
        await expect(service.getComponentFactoryRef('LazyPf', ComponentType.PREFAB)).resolves.toBe(Lazy);
    });

    it('warns and returns null when nothing is found', async () => {
        await expect(service.getComponentFactoryRef('Nope', ComponentType.PARTIAL)).resolves.toBeNull();
        await expect(service.getComponentFactoryRef('Nope', ComponentType.PAGE)).resolves.toBeNull();
        expect(lazy.getComponentFactoryRef).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Component not found: Nope (type: PAGE)');
    });

    it('treats unknown component types as not found', async () => {
        await expect(service.getComponentFactoryRef('x', 'OTHER' as any)).resolves.toBeNull();
    });
});
