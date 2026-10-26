jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

describe('AppJSResolve', () => {
    // holds a module-level "already loaded" flag, so each test loads a fresh copy of the module.
    const loadCtor = () => {
        let ctor: any;
        jest.isolateModules(() => {
            ctor = require('./app-js.resolve').AppJSResolve;
        });
        return ctor;
    };

    it('should execute the app.js script function with app/util/injector on first resolve', async () => {
        const Ctor = loadCtor();
        const appManager: any = {};
        const inj: any = { get: jest.fn().mockReturnValue(appManager) };
        const app: any = {};
        const utilService: any = {};
        const appScriptFn = jest.fn();
        const appJsProvider: any = { getAppScriptFn: jest.fn().mockResolvedValue(appScriptFn) };
        const resolve = new Ctor(inj, app, utilService, appJsProvider);
        const result = await resolve.resolve();
        expect(result).toBe(true);
        expect(appScriptFn).toHaveBeenCalledWith(app, utilService, inj);
    });

    it('should short-circuit to true on subsequent resolves without re-executing app.js', async () => {
        const Ctor = loadCtor();
        const inj: any = { get: jest.fn().mockReturnValue({}) };
        const appJsProvider: any = { getAppScriptFn: jest.fn().mockResolvedValue(jest.fn()) };
        const resolve = new Ctor(inj, {}, {}, appJsProvider);
        await resolve.resolve();
        await resolve.resolve();
        expect(appJsProvider.getAppScriptFn).toHaveBeenCalledTimes(1);
    });

    it('should warn and still resolve true when the app.js script throws', async () => {
        const Ctor = loadCtor();
        const inj: any = { get: jest.fn().mockReturnValue({}) };
        const appJsProvider: any = {
            getAppScriptFn: jest.fn().mockResolvedValue(() => {
                throw new Error('boom');
            }),
        };
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const resolve = new Ctor(inj, {}, {}, appJsProvider);
        const result = await resolve.resolve();
        expect(result).toBe(true);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
