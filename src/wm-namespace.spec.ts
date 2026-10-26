describe('wm-namespace', () => {
    const original = process.env.WM_NPM_SCOPE;

    const load = () => {
        let mod: any;
        jest.isolateModules(() => {
            mod = require('./wm-namespace');
        });
        return mod;
    };

    afterEach(() => {
        if (original === undefined) {
            delete process.env.WM_NPM_SCOPE;
        } else {
            process.env.WM_NPM_SCOPE = original;
        }
    });

    it('defaults to the @wavemaker-ai scope', () => {
        delete process.env.WM_NPM_SCOPE;
        expect(load().WM_NPM_SCOPE).toBe('@wavemaker-ai');
    });

    it('can be overridden through the WM_NPM_SCOPE environment variable', () => {
        process.env.WM_NPM_SCOPE = '@wavemaker';
        expect(load().WM_NPM_SCOPE).toBe('@wavemaker');
    });
});
