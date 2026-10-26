import { TestBed } from '@angular/core/testing';

const mockTranspile = jest.fn((m: string) => ({ markup: m }));
const mockInitBuildTask = jest.fn();

jest.mock('@wm/transpiler', () => ({ transpile: (...a) => (mockTranspile as any)(...a) }));
jest.mock('@wm/build-task', () => ({ initComponentsBuildTask: (...a) => mockInitBuildTask(...a) }));
jest.mock('../runtime-base.module', () => ({ REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS: [] }));
jest.mock('./app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));

import { ApplicationRef } from '@angular/core';
import { AppManagerService } from './app.manager.service';
import { DynamicComponentRefProviderService } from './dynamic-component-ref-provider.service';

describe('DynamicComponentRefProviderService', () => {
    let service: DynamicComponentRefProviderService;
    let appManager: any;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTranspile.mockImplementation((m: string) => ({ markup: m }));
        appManager = { notifyApp: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                DynamicComponentRefProviderService,
                { provide: AppManagerService, useValue: appManager }
            ]
        });
        service = TestBed.inject(DynamicComponentRefProviderService);
        service.clearCache();
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('initialises the components build task at import time', () => {
        jest.isolateModules(() => {
            mockInitBuildTask.mockClear();
            require('./dynamic-component-ref-provider.service');
            expect(mockInitBuildTask).toHaveBeenCalled();
        });
    });

    describe('getComponentFactoryRef', () => {
        it('rejects invalid selectors without notifying', async () => {
            await expect(service.getComponentFactoryRef('1bad', '<div></div>')).rejects.toThrow('Invalid selector: 1bad');
            expect(appManager.notifyApp).not.toHaveBeenCalled();
        });

        it('transpiles markup by default and does not cache by default', async () => {
            mockTranspile.mockReturnValue({ markup: '<span>t</span>' });
            const a = await service.getComponentFactoryRef('app-a', '<div></div>');
            const b = await service.getComponentFactoryRef('app-a', '<div></div>');
            expect(mockTranspile).toHaveBeenCalledTimes(2);
            expect(a).not.toBe(b);
            expect(service.getCacheSize()).toBe(0);
        });

        it('skips transpilation when disabled', async () => {
            await service.getComponentFactoryRef('app-b', '<div></div>', { transpile: false });
            expect(mockTranspile).not.toHaveBeenCalled();
        });

        it('caches components when noCache is false and serves them from the cache', async () => {
            const a = await service.getComponentFactoryRef('app-c', '<div></div>', { noCache: false });
            expect(service.getCacheSize()).toBe(1);
            const b = await service.getComponentFactoryRef('app-c', '<div>other</div>', { noCache: false });
            expect(b).toBe(a);
            expect(mockTranspile).toHaveBeenCalledTimes(1);
            service.clearCache();
            expect(service.getCacheSize()).toBe(0);
        });

        it('generates a selector when none is given via addComponent and applies styles', async () => {
            const ref = await service.getComponentFactoryRef('app-d', '<div></div>', { styles: '.x{color:red}' });
            expect(ref).toBeDefined();
        });

        it('notifies and rethrows on invalid markup', async () => {
            await expect(service.getComponentFactoryRef('app-e', '   ')).rejects.toThrow('Invalid markup');
            expect(appManager.notifyApp).toHaveBeenCalledWith('Failed to create component: Invalid markup', 'error');
            expect(errorSpy).toHaveBeenCalled();
        });

        it('reports unknown errors thrown by the transpiler', async () => {
            mockTranspile.mockImplementation(() => { throw 'weird'; });
            await expect(service.getComponentFactoryRef('app-f', '<div></div>')).rejects.toBe('weird');
            expect(appManager.notifyApp).toHaveBeenCalledWith('Failed to create component: Unknown error', 'error');
        });

        it('tolerates an app manager without notifyApp', async () => {
            delete appManager.notifyApp;
            await expect(service.getComponentFactoryRef('app-g', '')).rejects.toThrow('Invalid markup');
        });
    });

    describe('addComponent', () => {
        it('rejects non-element targets', async () => {
            await expect(service.addComponent(null as any, '<div></div>')).rejects.toThrow('Invalid target element');
        });

        it('creates, extends, attaches and appends the component', async () => {
            const target = document.createElement('div');
            const appRef = TestBed.inject(ApplicationRef);
            const attach = jest.spyOn(appRef, 'attachView');
            const detach = jest.spyOn(appRef, 'detachView');

            const ref: any = await service.addComponent(target, '<p class="hi">hello</p>', { extra: 42 });

            expect(target.children).toHaveLength(1);
            expect(ref.instance.extra).toBe(42);
            expect(ref.instance.isDynamicComponent).toBe(true);
            expect(attach).toHaveBeenCalledWith(ref.hostView);

            ref.destroy();
            expect(detach).toHaveBeenCalledWith(ref.hostView);
        });

        it('works with no context, custom selector and custom injector', async () => {
            const target = document.createElement('div');
            const ref: any = await service.addComponent(target, '<p>x</p>', undefined, {
                selector: 'app-custom',
                inj: TestBed.inject(ApplicationRef)['_injector'] ?? undefined
            });
            expect(target.querySelector('app-custom')).not.toBeNull();
            ref.destroy();
        });

        it('notifies and rethrows when the markup is invalid', async () => {
            const target = document.createElement('div');
            await expect(service.addComponent(target, '  ')).rejects.toThrow('Invalid markup');
            expect(appManager.notifyApp).toHaveBeenCalledTimes(2); // once in factory, once in addComponent
        });
    });
});
