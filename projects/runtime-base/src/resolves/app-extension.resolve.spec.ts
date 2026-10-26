jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

describe('AppExtensionJSResolve', () => {
    // holds a module-level "already loaded" flag, so each test loads a fresh copy of the module.
    const loadCtor = () => {
        let ctor: any;
        jest.isolateModules(() => {
            ctor = require('./app-extension.resolve').AppExtensionJSResolve;
        });
        return ctor;
    };

    it('should resolve true immediately for a prefab project without loading the formatter script', () => {
        const Ctor = loadCtor();
        const appManager: any = { isPrefabType: () => true, isTemplateBundleType: () => false };
        const appJsProvider: any = { loadFormatterConfigScript: jest.fn() };
        const customPipeManager: any = { setCustomPipe: jest.fn() };
        const resolve = new Ctor(appManager, appJsProvider, customPipeManager);
        expect(resolve.resolve()).toBe(true);
        expect(appJsProvider.loadFormatterConfigScript).not.toHaveBeenCalled();
    });

    it('should load the formatter config script once for a regular web app', () => {
        const Ctor = loadCtor();
        const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false };
        const appJsProvider: any = { loadFormatterConfigScript: jest.fn() };
        const customPipeManager: any = { setCustomPipe: jest.fn() };
        const resolve = new Ctor(appManager, appJsProvider, customPipeManager);
        const first = resolve.resolve();
        const second = resolve.resolve();
        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(appJsProvider.loadFormatterConfigScript).toHaveBeenCalledTimes(1);
    });

    describe('loadedFormatterScript', () => {
        it('should register each formatter with the custom pipe manager', () => {
            const Ctor = loadCtor();
            const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false };
            const customPipeManager: any = { setCustomPipe: jest.fn() };
            const resolve = new Ctor(appManager, {}, customPipeManager);
            resolve.loadedFormatterScript({ upper: () => undefined, lower: () => undefined });
            expect(customPipeManager.setCustomPipe).toHaveBeenCalledWith('upper', expect.any(Function));
            expect(customPipeManager.setCustomPipe).toHaveBeenCalledWith('lower', expect.any(Function));
        });

        it('should warn without throwing when the response is falsy', () => {
            const Ctor = loadCtor();
            const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false };
            const customPipeManager: any = { setCustomPipe: jest.fn() };
            const resolve = new Ctor(appManager, {}, customPipeManager);
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            expect(() => resolve.loadedFormatterScript(null)).not.toThrow();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });
});
