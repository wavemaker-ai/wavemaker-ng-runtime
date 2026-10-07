import { Injector } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { SecurityService } from './security.service';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: jest.fn().mockReturnValue({ homePage: 'home' }),
}));

(window as any)._WM_APP_PROPERTIES = { securityEnabled: true };

describe('SecurityService - cover', () => {
    let app: { notify: jest.Mock; subscribe: jest.Mock };
    let location: { path: jest.Mock };
    let router: { navigate: jest.Mock };
    let service: SecurityService;

    beforeEach(() => {
        app = { notify: jest.fn(), subscribe: jest.fn() };
        location = { path: jest.fn().mockReturnValue('/other') };
        router = { navigate: jest.fn() };
        service = new SecurityService(
            { get: jest.fn().mockReturnValue(app) } as unknown as Injector,
            { send: jest.fn() } as any,
            router as unknown as Router,
            { queryParams: of({}) } as unknown as ActivatedRoute,
            location as unknown as Location,
        );
    });

    describe('getPageByLoggedInUser', () => {
        it('falls back to the home page when the authenticated user has no landing page', async () => {
            const isXsrf = jest.spyOn(service, 'isXsrfEnabled');
            service.config = { securityEnabled: true, authenticated: true, userInfo: {} };
            await expect(service.getPageByLoggedInUser()).resolves.toBe('home');
            expect(isXsrf).toHaveBeenCalled();
        });

        it('uses the landing page of the authenticated user', async () => {
            service.config = { securityEnabled: true, authenticated: true, userInfo: { landingPage: 'dash' } };
            await expect(service.getPageByLoggedInUser()).resolves.toBe('dash');
        });

        it('skips the xsrf handling when the xsrf cookie is not available', async () => {
            jest.spyOn(service, 'getCookieByName').mockReturnValue('');
            const isXsrf = jest.spyOn(service, 'isXsrfEnabled');
            service.config = { securityEnabled: true, authenticated: true, userInfo: { landingPage: 'dash' } };
            await expect(service.getPageByLoggedInUser()).resolves.toBe('dash');
            expect(isXsrf).toHaveBeenCalled();
            expect(isXsrf.mock.results[0].value).toBe('');
        });
    });

    describe('loadPageByUserRole', () => {
        // jsdom cannot navigate/reload; it reports "Not implemented: navigation" through console.error,
        // which is what tells us window.location.reload() was reached.
        let errSpy: jest.SpyInstance;

        beforeEach(() => {
            errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            errSpy.mockRestore();
        });

        const navigationNotImplemented = () =>
            errSpy.mock.calls.some(c => String(c[0]?.message ?? c[0]).includes('navigation'));

        it('reloads the window when the landing page equals the current page', async () => {
            location.path.mockReturnValue('/home');
            service.config = { securityEnabled: false };
            await service.loadPageByUserRole(true);
            expect(navigationNotImplemented()).toBe(true);
            expect(router.navigate).not.toHaveBeenCalled();
        });

        it('navigates when the landing page differs from the current page', async () => {
            location.path.mockReturnValue('/other');
            service.config = { securityEnabled: false };
            await service.loadPageByUserRole(true);
            expect(router.navigate).toHaveBeenCalledWith(['/home']);
            expect(navigationNotImplemented()).toBe(false);
        });
    });

    describe('onUserLogin', () => {
        it('tolerates the login notification firing after the subscription was already untracked', async () => {
            let handler: () => void;
            const unsubscribe = jest.fn();
            app.subscribe.mockImplementation((_evt, fn) => { handler = fn; return unsubscribe; });
            service.config = { securityEnabled: true, authenticated: false };

            const promise = service.onUserLogin();
            expect((service as any).appSubscriptions).toEqual([unsubscribe]);
            // simulate the tracking entry having been removed already (e.g. by a previous notification)
            (service as any).appSubscriptions = [];
            handler();

            await expect(promise).resolves.toBeUndefined();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
            expect((service as any).appSubscriptions).toEqual([]);
        });

        it('removes the tracked subscription when the login notification arrives', async () => {
            let handler: () => void;
            const unsubscribe = jest.fn();
            app.subscribe.mockImplementation((_evt, fn) => { handler = fn; return unsubscribe; });
            service.config = { securityEnabled: true, authenticated: false };
            const promise = service.onUserLogin();
            handler();
            await promise;
            expect((service as any).appSubscriptions).toEqual([]);
        });
    });
});
