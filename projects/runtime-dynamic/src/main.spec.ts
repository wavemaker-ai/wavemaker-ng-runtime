const mockBootstrap = jest.fn();
const mockEnableProdMode = jest.fn();

jest.mock('@angular/core', () => ({ ...jest.requireActual('@angular/core'), enableProdMode: (...a) => mockEnableProdMode(...a) }));
jest.mock('@angular/platform-browser', () => ({ ...jest.requireActual('@angular/platform-browser'), bootstrapApplication: (...a) => mockBootstrap(...a) }));
jest.mock('@wm/runtime/base', () => ({ AppComponent: class AppComponent {} }));
jest.mock('./app/app.config', () => ({ appConfig: { cfg: 1 } }));

describe('runtime-dynamic main', () => {
    const load = () => {
        jest.isolateModules(() => {
            require('./main');
        });
    };
    const flush = () => new Promise(r => setTimeout(r));

    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
        jest.spyOn(console, 'time').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (window as any).debugMode;
    });

    it('enables prod mode unless debug mode is on', () => {
        load();
        expect(mockEnableProdMode).toHaveBeenCalledTimes(1);
        sessionStorage.setItem('debugMode', 'true');
        load();
        expect(mockEnableProdMode).toHaveBeenCalledTimes(1);
    });

    it('bootstraps the app on DOMContentLoaded and destroys components on pagehide', async () => {
        const destroy = jest.fn();
        mockBootstrap.mockResolvedValue({ components: [{ destroy }, null] });
        load();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flush();
        expect(mockBootstrap).toHaveBeenCalledWith(expect.any(Function), { cfg: 1 });
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
        expect(destroy).toHaveBeenCalled();
    });

    it('keeps components alive when the page enters bfcache (pagehide with persisted=true)', async () => {
        const destroy = jest.fn();
        mockBootstrap.mockResolvedValue({ components: [{ destroy }] });
        load();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flush();
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        expect(destroy).not.toHaveBeenCalled();
    });

    it('logs bootstrap failures', async () => {
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockBootstrap.mockRejectedValue(new Error('x'));
        load();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flush();
        expect(err).toHaveBeenCalledWith('Error bootstrapping app:', expect.any(Error));
    });

    describe('window.debugMode', () => {
        beforeEach(() => load());

        it('turns debug mode on (a missing argument means "on") and reloads when it changes', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            (window as any).debugMode();
            expect(sessionStorage.getItem('debugMode')).toBe('true');
        });

        it('turns debug mode off with debugMode(false) and reloads when it changes', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            sessionStorage.setItem('debugMode', 'true');
            const set = jest.spyOn(Storage.prototype, 'setItem');
            (window as any).debugMode(false);
            expect(set).toHaveBeenCalledWith('debugMode', 'false');
            expect(sessionStorage.getItem('debugMode')).toBe('false');
        });

        it('keeps prod mode enabled on the next load after switching debug mode off', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            sessionStorage.setItem('debugMode', 'true');
            (window as any).debugMode(false);
            mockEnableProdMode.mockClear();
            load();
            expect(mockEnableProdMode).toHaveBeenCalledTimes(1);
        });

        it('treats a truthy argument as "on"', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            (window as any).debugMode('yes');
            expect(sessionStorage.getItem('debugMode')).toBe('true');
        });

        it('does nothing when the value is unchanged', () => {
            sessionStorage.setItem('debugMode', 'true');
            const set = jest.spyOn(Storage.prototype, 'setItem');
            (window as any).debugMode(true);
            expect(set).not.toHaveBeenCalled();
        });
    });

    it('exports a no-op default', () => {
        jest.isolateModules(() => {
            expect(require('./main').default()).toBeUndefined();
        });
    });
});
