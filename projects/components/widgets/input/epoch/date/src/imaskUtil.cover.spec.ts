describe('imaskUtil - cover', () => {
    afterEach(() => {
        delete (window as any).moment;
        jest.dontMock('moment');
        jest.resetModules();
    });

    it('falls back to the global moment when the module has no default export', () => {
        const parsed = new Date(2020, 4, 6);
        const momentFn: any = jest.fn(() => ({ toDate: () => parsed, format: (f: string) => `formatted:${f}` }));
        (window as any).moment = momentFn;
        let util: any;
        jest.isolateModules(() => {
            jest.doMock('moment', () => ({ __esModule: true }));
            util = require('./imaskUtil');
        });
        const cfg = util.validateTheMaskedDate('dd/MM/yyyy', 'en');
        expect(cfg.parse('06/05/2020')).toBe(parsed);
        expect(momentFn).toHaveBeenCalledWith('06/05/2020', cfg.pattern);
        expect(cfg.format(parsed)).toBe(`formatted:${cfg.pattern}`);
    });
});
