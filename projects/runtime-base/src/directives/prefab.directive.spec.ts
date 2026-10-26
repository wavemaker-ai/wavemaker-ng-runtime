jest.mock('@wm/components/base', () => ({ WidgetRef: class WidgetRef {} }));
jest.mock('../services/prefab-manager.service', () => ({ PrefabManagerService: class PrefabManagerService {} }));

import { ComponentType } from '../types/types';
import { PrefabDirective } from './prefab.directive';

describe('PrefabDirective', () => {
    let prefabMngr: any, vcRef: any, elRef: any, componentRefProvider: any, injector: any, envInjector: any;
    let errorSpy: jest.SpyInstance;
    const flush = () => new Promise(r => setTimeout(r));

    const create = () => new PrefabDirective({ prefabName: 'pf' }, vcRef, elRef, prefabMngr, injector, envInjector, componentRefProvider);

    beforeEach(() => {
        prefabMngr = { loadDependencies: jest.fn(() => Promise.resolve()) };
        const host = document.createElement('div');
        const created = document.createElement('span');
        vcRef = { createComponent: jest.fn(() => ({ location: { nativeElement: created } })), clear: jest.fn() };
        elRef = { nativeElement: host };
        componentRefProvider = { getComponentFactoryRef: jest.fn(() => Promise.resolve(class Prefab {})) };
        injector = { i: 1 };
        envInjector = { e: 1 };
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => errorSpy.mockRestore());

    it('loads dependencies, creates the prefab component and appends it to the host', async () => {
        create();
        await flush();
        expect(prefabMngr.loadDependencies).toHaveBeenCalledWith('pf');
        expect(componentRefProvider.getComponentFactoryRef).toHaveBeenCalledWith('pf', ComponentType.PREFAB);
        expect(vcRef.createComponent).toHaveBeenCalledWith(expect.any(Function), { index: 0, environmentInjector: envInjector, injector });
        expect(elRef.nativeElement.children).toHaveLength(1);
    });

    it('logs when the prefab component cannot be resolved', async () => {
        componentRefProvider.getComponentFactoryRef.mockResolvedValue(undefined);
        create();
        await flush();
        expect(errorSpy).toHaveBeenCalledWith('Failed to load prefab component: pf');
        expect(vcRef.createComponent).not.toHaveBeenCalled();
    });

    it('logs when creating the component fails', async () => {
        vcRef.createComponent.mockImplementation(() => { throw new Error('boom'); });
        create();
        await flush();
        expect(errorSpy).toHaveBeenCalledWith('Error creating prefab component pf:', expect.any(Error));
    });

    it('logs when dependency loading fails', async () => {
        prefabMngr.loadDependencies.mockRejectedValue('nope');
        create();
        await flush();
        expect(errorSpy).toHaveBeenCalledWith('Error loading dependencies for prefab pf:', 'nope');
    });

    it('clears the view container and releases the element on destroy', async () => {
        const d: any = create();
        await flush();
        d.ngOnDestroy();
        expect(vcRef.clear).toHaveBeenCalled();
        expect(d.elRef).toBeNull();
    });

    it('tolerates a missing view container on destroy', async () => {
        const d: any = create();
        await flush();
        d.vcRef = null;
        expect(() => d.ngOnDestroy()).not.toThrow();
    });
});
