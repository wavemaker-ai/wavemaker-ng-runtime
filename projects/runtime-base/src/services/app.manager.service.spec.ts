import { AppManagerService } from './app.manager.service';

const mockDigest = jest.fn();
const mockFetchContent = jest.fn();
const mockGetProps = jest.fn(() => ({ homePage: 'Main' }));
const mockGetModes = jest.fn(() => ({ stored: true }));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $appDigest: (...a) => mockDigest(...a),
    fetchContent: (...a) => (mockFetchContent as any)(...a),
    getWmProjectProperties: () => mockGetProps()
}));

jest.mock('../public_api', () => ({
    getModesFromLocalStorage: () => mockGetModes()
}));

import { $rootScope } from '@wm/variables';

describe('AppManagerService', () => {
    let http: any, security: any, dialog: any, router: any, app: any, variables: any, metadata: any,
        spinner: any, i18n: any, datePipe: any;
    let handlers: Record<string, Function>;
    let unsubscribers: jest.Mock[];
    let service: AppManagerService;
    const flush = () => new Promise(r => setTimeout(r));

    beforeEach(() => {
        jest.clearAllMocks();
        handlers = {};
        unsubscribers = [];
        http = {
            registerOnSessionTimeout: jest.fn(() => jest.fn()),
            get: jest.fn(() => Promise.resolve({ v: 1 })),
            executeSessionFailureRequests: jest.fn(),
            pushToSessionFailureQueue: jest.fn()
        };
        security = {
            load: jest.fn(() => Promise.resolve('cfg')),
            get: jest.fn(() => ({ loginConfig: { type: 'dialog' } })),
            getConfig: jest.fn((cb) => cb({ userInfo: { userId: 'other' } })),
            getPageByLoggedInUser: jest.fn(() => Promise.resolve('Home')),
            getRedirectedRouteQueryParams: jest.fn(() => ({ a: 1 })),
            getQueryString: jest.fn(() => 'a=1'),
            getCurrentRoutePage: jest.fn(() => 'Current'),
            getRedirectPage: jest.fn((c, p) => p || 'Redirect')
        };
        dialog = { open: jest.fn() };
        router = { navigate: jest.fn() };
        app = {
            subscribe: jest.fn((name, fn) => {
                handlers[name] = fn;
                const u = jest.fn();
                unsubscribers.push(u);
                return u;
            }),
            clearPageCache: jest.fn(),
            notify: jest.fn(),
            notifyApp: jest.fn(),
            setMode: jest.fn(),
            Variables: {},
            Actions: {},
            appLocale: {},
            deployedUrl: 'http://dep/'
        };
        variables = { registerDependency: jest.fn(), register: jest.fn(() => ({ Variables: { x: 1 }, Actions: { y: 2 } })) };
        metadata = { load: jest.fn(() => Promise.resolve('meta')) };
        spinner = { show: jest.fn(() => 'sid'), hide: jest.fn() };
        i18n = { getSelectedLocale: jest.fn(() => 'en') };
        datePipe = { name: 'date' };
        service = new AppManagerService(http, security, dialog, router, app, variables, metadata, spinner, i18n, datePipe);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.textContent = '';
    });

    describe('constructor', () => {
        it('registers dependencies and subscriptions', () => {
            expect(http.registerOnSessionTimeout).toHaveBeenCalled();
            expect(variables.registerDependency).toHaveBeenCalledWith('appManager', service);
            expect(Object.keys(handlers)).toEqual(['toggle-variable-state', 'userLoggedIn', 'userLoggedOut', 'http401']);
        });

        describe('toggle-variable-state', () => {
            it('ignores variables with empty spinnerContext', () => {
                handlers['toggle-variable-state']({ variable: { spinnerContext: '  ' }, active: true });
                expect(spinner.show).not.toHaveBeenCalled();
            });

            it('shows a spinner when active', () => {
                const variable: any = { spinnerContext: 'ctx', spinnerMessage: 'm', spinnerclass: 'c', _id: 'v1' };
                handlers['toggle-variable-state']({ variable, active: true });
                expect(spinner.show).toHaveBeenCalledWith('m', expect.stringMatching(/^v1_\d+$/), 'c', 'ctx');
                expect(variable._spinnerId).toEqual(['sid']);
            });

            it('skips spinner if the same one already exists (finalMessage)', () => {
                spinner.messagesByContext = { ctx: { finalMessage: 'm' } };
                const variable: any = { spinnerContext: 'ctx', spinnerMessage: 'm', _id: 'v1', _spinnerId: ['v1_123'] };
                handlers['toggle-variable-state']({ variable, active: true });
                expect(spinner.show).not.toHaveBeenCalled();
            });

            it('skips spinner if the same one already exists (item message)', () => {
                spinner.messagesByContext = { ctx: { finalMessage: 'x', v1_123: 'm' } };
                const variable: any = { spinnerContext: 'ctx', spinnerMessage: 'm', _id: 'v1', _spinnerId: ['v1_123'] };
                handlers['toggle-variable-state']({ variable, active: true });
                expect(spinner.show).not.toHaveBeenCalled();
            });

            it('shows a spinner when existing ids do not match', () => {
                spinner.messagesByContext = { ctx: { finalMessage: 'x' } };
                const variable: any = { spinnerContext: 'ctx', spinnerMessage: 'm', _id: 'v1', _spinnerId: ['other_1'] };
                handlers['toggle-variable-state']({ variable, active: true });
                expect(spinner.show).toHaveBeenCalled();
                expect(variable._spinnerId).toEqual(['other_1', 'sid']);
            });

            it('shows a spinner when messagesByContext is absent', () => {
                const variable: any = { spinnerContext: 'ctx', spinnerMessage: 'm', _id: 'v1', _spinnerId: ['v1_1'] };
                handlers['toggle-variable-state']({ variable, active: true });
                expect(spinner.show).toHaveBeenCalled();
            });

            it('hides the spinner when inactive', () => {
                const variable: any = { spinnerContext: 'ctx', _spinnerId: ['a', 'b'] };
                handlers['toggle-variable-state']({ variable, active: false });
                expect(spinner.hide).toHaveBeenCalledWith('a');
                expect(variable._spinnerId).toEqual(['b']);
            });
        });

        describe('userLoggedIn', () => {
            it('sets the landing page only when no previous user', async () => {
                handlers['userLoggedIn']();
                await flush();
                expect(app.landingPageName).toBe('Home');
                expect(security.getConfig).not.toHaveBeenCalled();
            });

            it('clears page cache when user changed', () => {
                (service as any).lastLoggedUserId = 'old';
                handlers['userLoggedIn']();
                expect(app.clearPageCache).toHaveBeenCalled();
            });

            it('does not clear page cache when user is same or config missing', () => {
                (service as any).lastLoggedUserId = 'other';
                handlers['userLoggedIn']();
                security.getConfig.mockImplementation(cb => cb(null));
                handlers['userLoggedIn']();
                expect(app.clearPageCache).not.toHaveBeenCalled();
            });
        });

        it('userLoggedOut resets landing page and clears cache', async () => {
            handlers['userLoggedOut']();
            await flush();
            expect(app.clearPageCache).toHaveBeenCalled();
        });

        it('http401 delegates to handle401 (with and without payload)', () => {
            const spy = jest.spyOn(service, 'handle401').mockImplementation(() => {});
            handlers['http401']({ page: 'p', options: { o: 1 } });
            expect(spy).toHaveBeenCalledWith('p', { o: 1 });
            handlers['http401']();
            expect(spy).toHaveBeenCalledWith(undefined, undefined);
        });
    });

    describe('simple loaders', () => {
        it('no-op loaders exist', () => {
            expect(service.loadAppJS()).toBeUndefined();
            expect(service.loadCommonPage()).toBeUndefined();
            expect(service.updateSupportedLocaleVariable()).toBeUndefined();
        });

        it('loadSecurityConfig sets landing page when missing', async () => {
            await expect(service.loadSecurityConfig(true)).resolves.toBe('cfg');
            await flush();
            expect(app.landingPageName).toBe('Home');
        });

        it('loadSecurityConfig skips landing page when already set', async () => {
            app.landingPageName = 'Set';
            await service.loadSecurityConfig();
            expect(security.getPageByLoggedInUser).not.toHaveBeenCalled();
        });

        it('loadMetadata delegates', async () => {
            await expect(service.loadMetadata()).resolves.toBe('meta');
        });
    });

    describe('loadAppVariables', () => {
        it('loads from json, registers, and short-circuits next time', async () => {
            await service.loadAppVariables();
            expect(http.get).toHaveBeenCalledWith('./app.variables.json');
            expect(app.Variables).toEqual({ x: 1 });
            expect(app.Actions).toEqual({ y: 2 });
            expect(service.isAppVariablesFired()).toBe(false);
            await service.loadAppVariables();
            expect(http.get).toHaveBeenCalledTimes(1);
        });

        it('uses passed variables directly', async () => {
            await service.loadAppVariables({ z: 1 });
            expect(http.get).not.toHaveBeenCalled();
            expect(variables.register).toHaveBeenCalledWith('app', { z: 1 }, app);
        });

        it('isAppVariablesFired getter/setter', () => {
            expect(service.isAppVariablesFired()).toBe(false);
            expect(service.isAppVariablesFired(true)).toBe(true);
        });
    });

    describe('updateLoggedInUserVariable (via loadAppVariables)', () => {
        const run = async () => {
            await service.loadAppVariables({});
            await flush();
        };

        it('returns early when no loggedInUser', async () => {
            await run();
            expect(security.load).not.toHaveBeenCalled();
        });

        it('populates the user when authenticated', async () => {
            const user: any = {};
            app.Variables.loggedInUser = { dataSet: user };
            variables.register.mockReturnValue({ Variables: {}, Actions: {} });
            security.get.mockReturnValue({
                securityEnabled: true,
                authenticated: true,
                userInfo: { userRoles: ['r'], userName: 'n', userId: 'i', tenantId: 't', userAttributes: { a: 1 } }
            });
            await run();
            expect(user).toMatchObject({ isAuthenticated: true, roles: ['r'], name: 'n', id: 'i', tenantId: 't', userAttributes: { a: 1 } });
        });

        it('clears the user when not authenticated', async () => {
            const user: any = { name: 'x' };
            app.Variables.loggedInUser = { dataSet: user };
            variables.register.mockReturnValue({ Variables: {}, Actions: {} });
            security.get.mockReturnValue({ securityEnabled: false });
            await run();
            expect(user.isAuthenticated).toBe(false);
            expect(user.roles).toEqual([]);
            expect(user.name).toBeUndefined();
            expect(user.userAttributes).toEqual({});
            expect(user.isSecurityEnabled).toBe(false);
        });

        it('handles undefined security config', async () => {
            const user: any = {};
            app.Variables.loggedInUser = { dataSet: user };
            variables.register.mockReturnValue({ Variables: {}, Actions: {} });
            security.get.mockReturnValue(undefined);
            await run();
            expect(user.isAuthenticated).toBe(false);
        });
    });

    describe('handleSSOLogin', () => {
        it('writes a redirect message and builds the sso url (query params + redirect page)', () => {
            service.handleSSOLogin({}, { queryParams: { q: 1 } });
            expect(security.getQueryString).toHaveBeenCalledWith({ q: 1 });
            expect(document.body.textContent).toBe('Redirecting to sso login...');
        });

        it('falls back to router query params, uses localized message, skips redirectPage for home w/o params', () => {
            security.getQueryString.mockReturnValue('');
            security.getCurrentRoutePage.mockReturnValue('Main');
            app.appLocale = { MESSAGE_LOGIN_REDIRECTION: 'Going' };
            service.handleSSOLogin({}, undefined);
            expect(security.getRedirectedRouteQueryParams).toHaveBeenCalled();
            expect(document.body.textContent).toBe('Going');
        });

        it('handles missing current route page', () => {
            security.getCurrentRoutePage.mockReturnValue(undefined);
            expect(() => service.handleSSOLogin({}, {})).not.toThrow();
        });
    });

    describe('handle401', () => {
        let sso: jest.SpyInstance;
        beforeEach(() => {
            sso = jest.spyOn(service, 'handleSSOLogin').mockImplementation(() => {});
            jest.spyOn<any, any>(service, 'showLoginDialog');
        });

        describe('session timeout (user known)', () => {
            const cfg = (sessionTimeout?) => ({
                userInfo: { userName: 'u', userId: 'id1' },
                loginConfig: { sessionTimeout, pageName: 'LoginPage' },
                authenticated: true
            });

            it('defaults to dialog', () => {
                const c = cfg();
                security.get.mockReturnValue(c);
                service.handle401();
                expect(c.authenticated).toBe(false);
                expect(dialog.open).toHaveBeenCalledWith('CommonLoginDialog');
                expect(spinner.hide).toHaveBeenCalledWith('globalSpinner');
                expect(mockDigest).toHaveBeenCalled();
                expect((service as any).lastLoggedUserId).toBe('id1');
            });

            it('navigates to the timeout page, deriving the page from route', () => {
                security.get.mockReturnValue(cfg({ type: 'page', pageName: 'TimeoutPage' }));
                service.handle401();
                expect(router.navigate).toHaveBeenCalledWith(['TimeoutPage'], { queryParams: { redirectTo: 'Current', a: 1 } });
            });

            it('uses the supplied page and avoids redirecting to the login page itself', () => {
                security.get.mockReturnValue(cfg({ type: 'page', pageName: 'TimeoutPage' }));
                service.handle401('Given');
                expect(router.navigate).toHaveBeenCalledWith(['TimeoutPage'], { queryParams: { redirectTo: 'Given', a: 1 } });
                router.navigate.mockClear();
                service.handle401('TimeoutPage');
                expect(router.navigate).not.toHaveBeenCalled();
            });

            it('handles SSO', () => {
                security.get.mockReturnValue(cfg({ type: 'sso' }));
                service.handle401(undefined, { o: 1 });
                expect(sso).toHaveBeenCalledWith(expect.anything(), { o: 1 });
            });

            it('ignores unknown session timeout type', () => {
                security.get.mockReturnValue(cfg({ type: 'weird' }));
                expect(() => service.handle401()).not.toThrow();
                expect(dialog.open).not.toHaveBeenCalled();
            });
        });

        describe('first-time login (no user)', () => {
            const cfg = (type, pageName?) => ({ loginConfig: { type, pageName } });

            it('dialog: sets noRedirect and shows dialog', () => {
                security.get.mockReturnValue(cfg('DIALOG'));
                service.handle401();
                expect(service.noRedirect()).toBe(true);
                expect(dialog.open).toHaveBeenCalled();
            });

            it('page: navigates to login page with redirectTo and extra params', () => {
                security.get.mockReturnValue(cfg('page', 'Login'));
                service.handle401('Target');
                expect(router.navigate).toHaveBeenCalledWith(['Login'], { queryParams: { redirectTo: 'Target', a: 1 } });
                expect(app.landingPageName).toBe('Login');
            });

            it('page: prefers options.queryParams', () => {
                security.get.mockReturnValue(cfg('page', 'Login'));
                service.handle401('Target', { queryParams: { z: 9 } });
                expect(router.navigate).toHaveBeenCalledWith(['Login'], { queryParams: { redirectTo: 'Target', z: 9 } });
            });

            it('sso', () => {
                security.get.mockReturnValue(cfg('sso'));
                service.handle401();
                expect(sso).toHaveBeenCalled();
            });

            it('unknown type does nothing', () => {
                security.get.mockReturnValue(cfg('other'));
                expect(() => service.handle401()).not.toThrow();
            });
        });
    });

    describe('reloadAppData', () => {
        it('chains security, metadata, user variable and beforeAppReady', async () => {
            jest.spyOn<any, any>(service, 'updateLoggedInUserVariable').mockResolvedValue('uCfg');
            const ready = jest.fn();
            app.onBeforeAppReady = ready;
            await expect(service.reloadAppData()).resolves.toBe('uCfg');
            expect(security.load).toHaveBeenCalledWith(true);
            expect(metadata.load).toHaveBeenCalled();
            expect(ready).toHaveBeenCalled();
        });
    });

    describe('handleSSOLogin inside a frame', () => {
        const original: Record<string, PropertyDescriptor | undefined> = {};
        const redefine = (name: string, value: any) => {
            original[name] = Object.getOwnPropertyDescriptor(window, name);
            Object.defineProperty(window, name, { configurable: true, get: typeof value === 'function' ? value : () => value });
        };

        beforeEach(() => {
            security.getQueryString.mockReturnValue('');
            security.getCurrentRoutePage.mockReturnValue('Main');
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            Object.keys(original).forEach(name => {
                if (original[name]) {
                    Object.defineProperty(window, name, original[name]);
                } else {
                    delete (window as any)[name];
                }
            });
            Object.keys(original).forEach(k => delete original[k]);
        });

        it('hands the login over to the preview toolbar when it is the parent window', () => {
            const parent: any = { origin: window.location.origin, name: 'WM_PREVIEW_WINDOW', location: { href: '' } };
            redefine('self', { location: { href: 'http://self/page' } });
            redefine('parent', parent);
            service.handleSSOLogin({}, {});
            expect(parent.location.href).toBe('http://self/page');
            expect(parent.name).toBe('');
        });

        it('leaves a parent window that is not the preview toolbar alone', () => {
            const parent: any = { origin: window.location.origin, name: 'other', location: { href: 'keep' } };
            redefine('self', { location: { href: 'http://self/page' } });
            redefine('parent', parent);
            service.handleSSOLogin({}, {});
            expect(parent.location.href).toBe('keep');
        });

        it('redirects the frame itself when the parent is on another origin', () => {
            redefine('self', { location: { href: 'x' } });
            redefine('parent', { origin: 'http://other', name: '' });
            expect(() => service.handleSSOLogin({}, {})).not.toThrow();
        });

        it('falls back to redirecting the frame when the parent cannot be read', () => {
            redefine('self', { location: { href: 'x' } });
            redefine('parent', () => { throw new Error('cross origin'); });
            expect(() => service.handleSSOLogin({}, {})).not.toThrow();
        });
    });

    describe('delegates and accessors', () => {
        it('noRedirect getter/setter', () => {
            expect(service.noRedirect()).toBe(false);
            expect(service.noRedirect(true)).toBe(true);
            expect(service.noRedirect()).toBe(true);
        });

        it('session failure delegates', () => {
            const cb = jest.fn();
            service.executeSessionFailureRequests();
            service.pushToSessionFailureRequests(cb);
            expect(http.executeSessionFailureRequests).toHaveBeenCalled();
            expect(http.pushToSessionFailureQueue).toHaveBeenCalledWith(cb);
        });

        it('getDeployedURL prefers app.deployedUrl, falls back to rootScope', () => {
            expect(service.getDeployedURL()).toBe('http://dep/');
            app.deployedUrl = '';
            ($rootScope as any).project = { deployedUrl: 'http://root/' };
            expect(service.getDeployedURL()).toBe('http://root/');
        });

        it('misc app passthroughs', () => {
            app.customUrlScheme = 'wm://';
            app.activePage = 'P';
            app.appLocale = { k: 1 };
            app.isPrefabType = true;
            app.isTemplateBundleType = true;
            expect(service.getCustomUrlScheme()).toBe('wm://');
            expect(service.getActivePage()).toBe('P');
            expect(service.getAppLocale()).toEqual({ k: 1 });
            expect(service.getSelectedLocale()).toBe('en');
            expect(service.isPrefabType()).toBe(true);
            expect(service.isTemplateBundleType()).toBe(true);
            service.notify('e', 1);
            expect(app.notify).toHaveBeenCalledWith('e', 1);
            service.subscribe('e', jest.fn());
            service.notifyApp('t', 'error', 'title');
            expect(app.notifyApp).toHaveBeenCalledWith('t', 'error', 'title');
        });

        it('getPipe returns date pipe only for "date"', () => {
            expect(service.getPipe('date')).toBe(datePipe);
            expect(service.getPipe('other')).toBeUndefined();
        });
    });

    describe('notifyAccessDenied', () => {
        it('uses explicit message and page', () => {
            app.onServiceError = jest.fn();
            service.notifyAccessDenied('Pg', 'Nope');
            expect(app.onServiceError).toHaveBeenCalledWith('Nope', expect.objectContaining({
                status: 403, url: './pages/Pg/page.min.json', message: 'Nope'
            }));
            expect(app.notifyApp).toHaveBeenCalledWith('Nope', 'error', undefined);
        });

        it('falls back to locale, then default; uses current route page; blank url when none', () => {
            app.appLocale = { LABEL_ACCESS_DENIED: 'Denied!' };
            service.notifyAccessDenied();
            expect(app.notifyApp).toHaveBeenCalledWith('Denied!', 'error', undefined);

            app.appLocale = undefined;
            security.getCurrentRoutePage.mockReturnValue(undefined);
            service.notifyAccessDenied();
            expect(app.notifyApp).toHaveBeenLastCalledWith('Access Denied', 'error', undefined);
        });

        it('uses app.appLocale when getAppLocale yields nothing', () => {
            const spy = jest.spyOn(service, 'getAppLocale').mockReturnValue(undefined);
            app.appLocale = { LABEL_ACCESS_DENIED: 'FromApp' };
            service.notifyAccessDenied();
            expect(spy).toHaveBeenCalled();
            expect(app.notifyApp).toHaveBeenCalledWith('FromApp', 'error', undefined);
        });
    });

    describe('app lifecycle hooks', () => {
        it('trigger the app callbacks', () => {
            app.onBeforeServiceCall = jest.fn(() => 'b');
            app.onServiceSuccess = jest.fn(() => 's');
            app.onServiceError = jest.fn(() => 'e');
            app.onAppVariablesReady = jest.fn();
            app.onBeforeAppReady = jest.fn(() => 'r');
            expect(service.appOnBeforeServiceCall({ p: 1 })).toBe('b');
            expect(service.appOnServiceSuccess('d', 'x')).toBe('s');
            expect(service.appOnServiceError('d')).toBe('e');
            service.appVariablesReady();
            expect(service.beforeAppReady()).toBe('r');
            expect(app.onAppVariablesReady).toHaveBeenCalled();
        });
    });

    describe('template bundle', () => {
        let topPost: jest.SpyInstance;
        beforeEach(() => {
            topPost = jest.spyOn(window.top, 'postMessage').mockImplementation(() => {});
        });
        afterEach(() => {
            window.onmessage = null;
        });

        it('postMessage forwards to window.top', () => {
            service.postMessage({ a: 1 });
            expect(topPost).toHaveBeenCalledWith({ a: 1 }, '*');
        });

        it('postAppTypeInfo is a no-op for non template bundles', () => {
            app.isTemplateBundleType = false;
            expect(service.postAppTypeInfo()).toBeUndefined();
        });

        it('postTemplateBundleInfo wires messages and loads config', async () => {
            jest.useFakeTimers();
            app.isTemplateBundleType = true;
            mockFetchContent.mockImplementation((t, u, f, cb) => { cb({ templates: [{ id: 'T0' }] }); return 'fetched'; });
            expect(service.postAppTypeInfo()).toBe('fetched');
            jest.runAllTimers();
            jest.useRealTimers();
            expect(topPost).toHaveBeenCalledWith({ key: 'on-load' }, '*');
            expect(topPost).toHaveBeenCalledWith({ key: 'template-bundle-config', config: { templates: [{ id: 'T0' }] } }, '*');

            window.onmessage({ data: 'str' } as any);
            window.onmessage({ data: { key: 'hide-templates-show-case' } } as any);
            window.onmessage({ data: { key: 'unknown' } } as any);
            expect(router.navigate).not.toHaveBeenCalled();
            window.onmessage({ data: { key: 'select-template', templateIndex: 0 } } as any);
            expect(router.navigate).toHaveBeenCalledWith(['T0']);
        });

        it('does not post config when the response has an error', () => {
            mockFetchContent.mockImplementation((t, u, f, cb) => { cb({ error: 'x' }); });
            service.postTemplateBundleInfo();
            expect(topPost).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'template-bundle-config' }), '*');
            expect((service as any).templates).toEqual([]);
        });
    });

    describe('initAppModes', () => {
        it('applies stored modes and reacts to switch-mode messages', () => {
            service.initAppModes();
            expect(app.setMode).toHaveBeenCalledWith({ stored: true });
            const listener = (service as any).windowMessageListener;

            listener({ data: { key: 'switch-mode', modes: { m: 1 } } });
            expect(app.setMode).toHaveBeenLastCalledWith({ m: 1 }, true);
            listener({ data: { key: 'switch-mode', modes: { m: 2 }, shouldPersist: true } });
            expect(app.setMode).toHaveBeenLastCalledWith({ m: 2 }, false);

            app.setMode.mockClear();
            listener({ data: { key: 'switch-mode' } });
            listener({ data: { key: 'other', modes: {} } });
            listener({});
            expect(app.setMode).not.toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('unsubscribes everything and clears references', () => {
            const sessionUnsub = (service as any).sessionTimeoutUnsubscribe;
            service.initAppModes();
            const removeSpy = jest.spyOn(window, 'removeEventListener');
            (service as any).appSubscriptions.push(null);
            service.ngOnDestroy();
            unsubscribers.forEach(u => expect(u).toHaveBeenCalled());
            expect(sessionUnsub).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
            expect((service as any).templates).toBeNull();
            expect((service as any).lastLoggedUserId).toBeNull();
        });

        it('is safe when nothing was registered', () => {
            service.ngOnDestroy();
            expect(() => service.ngOnDestroy()).not.toThrow();
        });
    });
});
