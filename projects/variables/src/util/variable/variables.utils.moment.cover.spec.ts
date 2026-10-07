describe('variables.utils - moment fallback', () => {
    it('falls back to window.moment when the moment module has no default export', () => {
        const realMoment: any = jest.requireActual('moment');
        const realFn = realMoment.default || realMoment;
        (window as any).moment = realFn;
        let loaded: any;
        jest.isolateModules(() => {
            jest.doMock('moment', () => {
                const noDefault: any = Object.assign((...args: any[]) => realFn(...args), realFn, { __esModule: true });
                noDefault.default = undefined;
                return noDefault;
            });
            loaded = require('./variables.utils');
        });
        jest.dontMock('moment');
        expect(typeof loaded.formatDate).toBe('function');
        delete (window as any).moment;
    });
});
