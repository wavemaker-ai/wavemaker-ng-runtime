jest.mock('@wm/security', () => ({ SecurityService: class SecurityService {} }));

import { AccessrolesDirective } from './accessroles.directive';

describe('AccessrolesDirective', () => {
    let templateRef: any, vcRef: any;

    const create = (securityConfig: any, explicitContext?: any, lView: any[] = []) => {
        const security: any = { get: jest.fn(() => securityConfig) };
        const inj: any = { _lView: lView };
        return new AccessrolesDirective(templateRef, vcRef, security, inj, explicitContext);
    };

    beforeEach(() => {
        templateRef = { t: 1 };
        vcRef = { createEmbeddedView: jest.fn(), clear: jest.fn() };
    });

    describe('with security disabled', () => {
        it('always renders the content', () => {
            const d = create({ securityEnabled: false });
            d.accessroles = 'Admin';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledWith(templateRef, {});
        });

        it('copes with a missing security config', () => {
            const d = create(undefined);
            d.accessroles = 'Admin';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledWith(templateRef, {});
        });
    });

    describe('with security enabled', () => {
        const config = (authenticated: boolean, roles: string[] = []) => ({
            securityEnabled: true,
            authenticated,
            userInfo: { userRoles: roles }
        });

        it('grants access to Everyone', () => {
            const d = create(config(false));
            d.accessroles = 'Everyone';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledWith(templateRef, {});
        });

        it('grants Anonymous access only to unauthenticated users', () => {
            const anon = create(config(false));
            anon.accessroles = 'Anonymous';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledTimes(1);

            const user = create(config(true, ['X']));
            user.accessroles = 'Anonymous';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledTimes(1);
            expect(vcRef.clear).toHaveBeenCalledTimes(1);
        });

        it('grants Authenticated access only to authenticated users', () => {
            const user = create(config(true));
            user.accessroles = 'Authenticated';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledTimes(1);

            const anon = create(config(false));
            anon.accessroles = 'Authenticated';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledTimes(1);
            expect(vcRef.clear).toHaveBeenCalledTimes(1);
        });

        it('matches specific roles for authenticated users, with trimming and encoded commas', () => {
            const d = create(config(true, ['Admin', 'a,b']));
            d.accessroles = ' Other , a&#44;b ';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledWith(templateRef, {});
        });

        it('denies when no role matches or the user is not authenticated', () => {
            create(config(true, ['User'])).accessroles = 'Admin';
            create(config(false, ['Admin'])).accessroles = 'Admin';
            expect(vcRef.createEmbeddedView).not.toHaveBeenCalled();
            expect(vcRef.clear).toHaveBeenCalledTimes(2);
        });

        it('denies when no roles are given', () => {
            create(config(true, ['Admin'])).accessroles = '';
            create(config(true, ['Admin'])).accessroles = undefined;
            expect(vcRef.clear).toHaveBeenCalledTimes(2);
        });

        it('only evaluates once', () => {
            const d = create(config(true, ['Admin']));
            d.accessroles = 'Admin';
            d.accessroles = 'Nobody';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledTimes(1);
            expect(vcRef.clear).not.toHaveBeenCalled();
        });
    });

    describe('context', () => {
        it('merges the parent view context and the explicit context', () => {
            const parent = { fromParent: 1 };
            const d = create({ securityEnabled: false }, { explicit: 2 }, [0, 0, 0, 0, 0, 0, 0, 0, parent]);
            d.accessroles = 'x';
            expect(vcRef.createEmbeddedView).toHaveBeenCalledWith(templateRef, { fromParent: 1, explicit: 2 });
        });

        it('is cleared on destroy', () => {
            const d: any = create({ securityEnabled: false }, { explicit: 2 });
            d.ngOnDestroy();
            expect(d.context).toBeNull();
            expect(() => d.ngOnDestroy()).not.toThrow();
        });
    });
});
