jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

describe('AppVariablesResolve', () => {
    // holds a module-level "already loaded" flag, so each test loads a fresh copy of the module.
    const loadCtor = () => {
        let ctor: any;
        jest.isolateModules(() => {
            ctor = require('./app-variables.resolve').AppVariablesResolve;
        });
        return ctor;
    };

    it('should load security config, metadata and app variables in sequence on first resolve', async () => {
        const Ctor = loadCtor();
        const appManager: any = {
            loadSecurityConfig: jest.fn().mockResolvedValue(undefined),
            loadMetadata: jest.fn().mockResolvedValue(undefined),
            loadAppVariables: jest.fn().mockResolvedValue(undefined),
        };
        const appVariablesProvider: any = { getAppVariables: jest.fn().mockResolvedValue({ a: 1 }) };
        const resolve = new Ctor(appManager, appVariablesProvider);
        await resolve.resolve();
        expect(appManager.loadSecurityConfig).toHaveBeenCalled();
        expect(appManager.loadMetadata).toHaveBeenCalled();
        expect(appVariablesProvider.getAppVariables).toHaveBeenCalled();
        expect(appManager.loadAppVariables).toHaveBeenCalledWith({ a: 1 });
    });

    it('should short-circuit to true on subsequent resolves without reloading', async () => {
        const Ctor = loadCtor();
        const appManager: any = {
            loadSecurityConfig: jest.fn().mockResolvedValue(undefined),
            loadMetadata: jest.fn().mockResolvedValue(undefined),
            loadAppVariables: jest.fn().mockResolvedValue(undefined),
        };
        const appVariablesProvider: any = { getAppVariables: jest.fn().mockResolvedValue({}) };
        const resolve = new Ctor(appManager, appVariablesProvider);
        await resolve.resolve();
        const secondResult = resolve.resolve();
        expect(secondResult).toBe(true);
        expect(appManager.loadSecurityConfig).toHaveBeenCalledTimes(1);
    });
});
