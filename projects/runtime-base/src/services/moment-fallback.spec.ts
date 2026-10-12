describe('moment resolution fallback', () => {
    afterEach(() => {
        delete (window as any).moment;
        jest.resetModules();
        jest.dontMock('moment-timezone/moment-timezone');
    });

    it('uses the global moment when the bundled module has no default export (i18n service)', () => {
        (window as any).moment = jest.fn();
        jest.resetModules();
        jest.doMock('moment-timezone/moment-timezone', () => ({ __esModule: true }));
        expect(() => require('./i18n.service')).not.toThrow();
    });

    it('uses the global moment when the bundled module has no default export (app service)', () => {
        (window as any).moment = jest.fn();
        jest.resetModules();
        jest.doMock('moment-timezone/moment-timezone', () => ({ __esModule: true }));
        expect(() => require('./app.service')).not.toThrow();
    });
});
