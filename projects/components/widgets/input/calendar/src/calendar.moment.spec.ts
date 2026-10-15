describe('calendar moment resolution fallback', () => {
    afterEach(() => {
        delete (window as any).moment;
        jest.resetModules();
        jest.dontMock('moment');
    });

    it('uses the global moment when the bundled module has no default export', () => {
        (window as any).moment = jest.requireActual('moment');
        jest.resetModules();
        jest.doMock('moment', () => {
            const actual = jest.requireActual('moment');
            const withoutDefault: any = (...args: any[]) => actual(...args);
            Object.assign(withoutDefault, actual);
            delete withoutDefault.default;
            Object.defineProperty(withoutDefault, '__esModule', { value: true });
            return withoutDefault;
        });
        expect(() => require('./calendar.component')).not.toThrow();
    });
});
