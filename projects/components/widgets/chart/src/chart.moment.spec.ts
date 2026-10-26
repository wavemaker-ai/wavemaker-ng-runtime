describe('chart moment resolution fallback', () => {
    afterEach(() => {
        delete (window as any).moment;
        jest.resetModules();
        jest.dontMock('moment');
        jest.dontMock('@wm/core');
    });

    it('uses the global moment when the bundled module has no default export', () => {
        (window as any).moment = jest.fn();
        jest.resetModules();
        jest.doMock('@wm/core', () => ({ isEmptyObject: jest.fn(), prettifyLabels: jest.fn() }));
        jest.doMock('moment', () => ({ __esModule: true }));
        expect(() => require('./chart.utils')).not.toThrow();
    });
});
