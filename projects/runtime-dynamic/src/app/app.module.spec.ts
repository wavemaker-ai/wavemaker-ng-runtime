export {};
declare const $;
($ as any).fn.swipeAnimation = ($ as any).fn.swipeAnimation || {};

jest.mock('@wm/transpiler', () => ({ transpile: jest.fn(), scopeComponentStyles: jest.fn() }));
jest.mock('@wm/build-task', () => ({ initComponentsBuildTask: jest.fn() }));
jest.mock('@wavemaker-ai/custom-widgets-m3', () => ({}), { virtual: true });

describe('AppModule', () => {
    const load = (props: any = {}) => {
        let mod: any;
        jest.isolateModules(() => {
            jest.doMock('@wm/core', () => ({
                ...jest.requireActual('@wm/core'),
                getWmProjectProperties: () => props
            }));
            mod = require('./app.module');
        });
        return mod;
    };

    afterEach(() => jest.dontMock('@wm/core'));

    it('exposes the router, toastr and http xsrf modules', () => {
        const mod = load();
        expect(mod.routerModule.ngModule).toBeDefined();
        expect(mod.toastrModule.ngModule).toBeDefined();
        expect(mod.httpClientXsrfModule.ngModule).toBeDefined();
    });

    const values = (mod: any) => (mod.httpClientXsrfModule.providers as any[]).map(p => p && p.useValue);

    it('uses the default xsrf header when the project does not configure one', () => {
        const provided = values(load({}));
        expect(provided).toContain('wm_xsrf_token');
        expect(provided).not.toContain('X-Custom');
    });

    it('passes a configured xsrf header name through', () => {
        const provided = values(load({ xsrf_header_name: 'X-Custom' }));
        expect(provided).toContain('wm_xsrf_token');
        expect(provided).toContain('X-Custom');
    });

    it('can be instantiated with its collaborators', () => {
        const { AppModule } = load();
        expect(new AppModule({}, {}, {})).toBeInstanceOf(AppModule);
    });
});
