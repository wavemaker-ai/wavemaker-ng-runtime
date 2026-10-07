import { Injector } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { SecurityService } from './security.service';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: jest.fn().mockReturnValue({ homePage: 'home' }),
}));

const appProperties = (window as any)._WM_APP_PROPERTIES = { securityEnabled: true } as any;

describe('SecurityService - extra paths', () => {
    let http: { send: jest.Mock };
    let app: { notify: jest.Mock; subscribe: jest.Mock };
    let location: { path: jest.Mock };
    let service: SecurityService;

    const create = () => {
        http = { send: jest.fn() };
        app = { notify: jest.fn(), subscribe: jest.fn() };
        location = { path: jest.fn().mockReturnValue('/home') };
        return new SecurityService(
            { get: jest.fn().mockReturnValue(app) } as unknown as Injector,
            http as any,
            { navigate: jest.fn() } as unknown as Router,
            { queryParams: of({}) } as unknown as ActivatedRoute,
            location as unknown as Location,
        );
    };

    beforeEach(() => {
        appProperties.securityEnabled = true;
        delete appProperties.securityInfo;
        service = create();
    });

    describe('load', () => {
        it('resolves with null when security is disabled', async () => {
            appProperties.securityEnabled = false;
            await expect(service.load()).resolves.toBeNull();
            expect(http.send).not.toHaveBeenCalled();
        });

        it('requests the security info and keeps the user info', async () => {
            http.send.mockResolvedValue({ body: { userInfo: { userName: 'ram' } } });
            const config = await service.load();
            expect(http.send).toHaveBeenCalledWith({ url: 'services/security/info', method: 'GET' });
            expect(config).toEqual({ userInfo: { userName: 'ram' } });
            expect(service.loggedInUser).toEqual({ userName: 'ram' });
            expect(appProperties.securityInfo).toBe(config);
            expect(service.isLoaded()).toBe(config);
        });

        it('shares one request between concurrent callers', async () => {
            http.send.mockResolvedValue({ body: { userInfo: null } });
            const first = service.load();
            const second = service.load();
            expect(second).toBe(first);
            await first;
            expect(http.send).toHaveBeenCalledTimes(1);
        });

        it('returns the cached config unless a reload is forced', async () => {
            http.send.mockResolvedValue({ body: { userInfo: null } });
            await service.load();
            await expect(service.load()).resolves.toBe(service.config);
            expect(http.send).toHaveBeenCalledTimes(1);

            await service.load(true);
            expect(http.send).toHaveBeenCalledTimes(2);
        });

        it('remembers the previous user when reloading', async () => {
            http.send.mockResolvedValueOnce({ body: { userInfo: { userName: 'first' } } })
                .mockResolvedValueOnce({ body: { userInfo: { userName: 'second' } } });
            await service.load();
            await service.load(true);
            expect(service.getLastLoggedInUsername()).toBe('first');
            expect(service.loggedInUser.userName).toBe('second');
        });

        it('rejects on a failed request and allows a retry afterwards', async () => {
            http.send.mockRejectedValueOnce('down').mockResolvedValueOnce({ body: { userInfo: null } });
            await expect(service.load()).rejects.toBe('down');
            expect(service.loadPromise).toBeNull();
            await expect(service.load()).resolves.toEqual({ userInfo: null });
        });
    });

    describe('getConfig', () => {
        it('returns the loaded config straight away', () => {
            service.config = { securityEnabled: true };
            const success = jest.fn();
            service.getConfig(success, jest.fn());
            expect(success).toHaveBeenCalledWith({ securityEnabled: true });
            expect(http.send).not.toHaveBeenCalled();
        });

        it('adds the home page and user info to the loaded config', async () => {
            http.send.mockResolvedValue({ body: { authenticated: true, userInfo: { userName: 'ram' } } });
            const config: any = await new Promise((resolve, reject) => service.getConfig(resolve, reject));
            expect(config.homePage).toBe('home');
            expect(service.loggedInUser).toEqual({ userName: 'ram' });
        });

        it('serves a missing config as an empty one', async () => {
            appProperties.securityEnabled = false;
            const config: any = await new Promise((resolve, reject) => service.getConfig(resolve, reject));
            expect(config).toEqual({ homePage: 'home' });
        });

        it('sends one request and notifies all queued callers', async () => {
            http.send.mockResolvedValue({ body: { userInfo: null } });
            const results: any[] = [];
            const done = new Promise<void>((resolve) => {
                service.getConfig((c) => { results.push(['a', c]); }, jest.fn());
                service.getConfig((c) => { results.push(['b', c]); resolve(); }, jest.fn());
            });
            await done;
            expect(http.send).toHaveBeenCalledTimes(1);
            expect(results.map((r) => r[0])).toEqual(['a', 'b']);
            expect(service.requestQueue.config).toBeNull();
        });

        it('notifies every queued caller about a failure', async () => {
            http.send.mockRejectedValue('down');
            const errors: any[] = [];
            await new Promise<void>((resolve) => {
                service.getConfig(jest.fn(), (e) => { errors.push(e); });
                service.getConfig(jest.fn(), (e) => { errors.push(e); resolve(); });
            });
            expect(errors).toEqual(['down', 'down']);
        });
    });

    describe('getWebConfig', () => {
        it('serves the config that is already available', () => {
            service.config = { a: 1 };
            const success = jest.fn();
            service.getWebConfig(success, jest.fn());
            expect(success).toHaveBeenCalledWith({ a: 1 });
        });

        it('loads the config otherwise', async () => {
            http.send.mockResolvedValue({ body: { b: 2, userInfo: null } });
            const config = await new Promise((resolve, reject) => service.getWebConfig(resolve, reject));
            expect(config).toEqual({ b: 2, userInfo: null });
        });
    });

    describe('route helpers', () => {
        it('getCurrentRoutePage ignores the query string', () => {
            location.path.mockReturnValue('/Page?x=1&y=2');
            expect(service.getCurrentRoutePage()).toBe('Page');
        });

        it('getCurrentRoutePage returns the whole path without a query string', () => {
            location.path.mockReturnValue('/Page');
            expect(service.getCurrentRoutePage()).toBe('Page');
        });

        it('getRedirectPage keeps a page other than home and login', () => {
            expect(service.getRedirectPage({ loginConfig: { pageName: 'Login' } }, 'Dashboard')).toBe('Dashboard');
        });

        it('getRedirectPage drops the home page and login page when no redirect param exists', () => {
            expect(service.getRedirectPage({ loginConfig: { pageName: 'Login' } }, 'home')).toBeUndefined();
            expect(service.getRedirectPage({ loginConfig: { pageName: 'Login' } }, 'Login')).toBeUndefined();
        });
    });

    describe('appLogin', () => {
        it('posts the url encoded credentials and notifies the app', async () => {
            http.send.mockResolvedValue({ body: { wm_xsrf_token: 'abc' } });
            const success = jest.fn();

            await service.appLogin({ j_username: 'a b', j_password: 'p&q' }, success, jest.fn());

            const request = http.send.mock.calls[0][0];
            expect(request.method).toBe('POST');
            expect(request.url).toBe('j_spring_security_check');
            expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(request.data).toBe('j_username=a%20b&j_password=p%26q');
            expect(app.notify).toHaveBeenCalledWith('userLoggedIn', {});
            expect(success).toHaveBeenCalled();
        });

        it('copes with an empty response body', async () => {
            http.send.mockResolvedValue({ body: null });
            const success = jest.fn();
            await service.appLogin({}, success, jest.fn());
            expect(success).toHaveBeenCalled();
        });

        it('passes failures to the failure callback', async () => {
            http.send.mockRejectedValue('denied');
            const failure = jest.fn();
            await service.appLogin({ a: 1 }, jest.fn(), failure);
            expect(failure).toHaveBeenCalledWith('denied');
        });
    });

    describe('appLogout', () => {
        it('clears the authenticated state and notifies the app', async () => {
            service.config = { authenticated: true, userInfo: { userName: 'ram' } };
            http.send.mockResolvedValue({});
            const success = jest.fn();

            await service.appLogout(success, jest.fn());

            expect(service.config.authenticated).toBe(false);
            expect(service.config.userInfo).toBeNull();
            expect(app.notify).toHaveBeenCalledWith('userLoggedOut', {});
            expect(success).toHaveBeenCalled();
        });

        it('passes failures to the failure callback', async () => {
            http.send.mockRejectedValue('nope');
            const failure = jest.fn();
            await service.appLogout(jest.fn(), failure);
            expect(failure).toHaveBeenCalledWith('nope');
        });
    });

    describe('onUserLogin', () => {
        it('waits for the login event when the user is not authenticated and cleans up the subscription', async () => {
            service.config = { securityEnabled: true, authenticated: false };
            const unsubscribe = jest.fn();
            let loginHandler: () => void;
            app.subscribe.mockImplementation((_event: string, handler: () => void) => {
                loginHandler = handler;
                return unsubscribe;
            });

            let resolved = false;
            const promise = service.onUserLogin().then(() => { resolved = true; });
            await Promise.resolve();
            expect(resolved).toBe(false);
            expect(app.subscribe).toHaveBeenCalledWith('userLoggedIn', expect.any(Function));

            loginHandler!();
            await promise;
            expect(resolved).toBe(true);
            expect(unsubscribe).toHaveBeenCalled();
            expect((service as any).appSubscriptions).toEqual([]);
        });
    });

    describe('ngOnDestroy', () => {
        it('unsubscribes everything that is still tracked', () => {
            const sub = { unsubscribe: jest.fn() };
            const appUnsub = jest.fn();
            (service as any).queryParamsSubscriptions = [sub, null];
            (service as any).appSubscriptions = [appUnsub, undefined];

            service.ngOnDestroy();

            expect(sub.unsubscribe).toHaveBeenCalled();
            expect(appUnsub).toHaveBeenCalled();
            expect((service as any).queryParamsSubscriptions).toEqual([]);
            expect((service as any).appSubscriptions).toEqual([]);
        });
    });
});
