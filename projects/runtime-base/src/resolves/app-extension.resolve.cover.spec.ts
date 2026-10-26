jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

describe('AppExtensionJSResolve loadedFormatterScript error path', () => {
    it('should warn and not throw when registering a formatter fails', () => {
        let Ctor: any;
        jest.isolateModules(() => {
            Ctor = require('./app-extension.resolve').AppExtensionJSResolve;
        });
        const err = new Error('boom');
        const customPipeManager: any = { setCustomPipe: jest.fn(() => { throw err; }) };
        const resolve = new Ctor({}, {}, customPipeManager);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(() => resolve.loadedFormatterScript({ bad: () => undefined })).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith('Error in reading formatters.js', err);
        warnSpy.mockRestore();
    });
});
