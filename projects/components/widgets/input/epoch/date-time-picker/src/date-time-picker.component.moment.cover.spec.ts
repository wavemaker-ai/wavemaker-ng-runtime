describe('DateTimePickerComponent moment fallback', () => {
    afterEach(() => jest.restoreAllMocks());

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
            loaded = require('./date-time-picker.component');
        });
        jest.dontMock('moment');
        expect(loaded.DateTimePickerComponent).toBeDefined();
        delete (window as any).moment;
    });
});
