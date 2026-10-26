jest.mock('../../services/app.manager.service', () => ({ AppManagerService: class {} }));

import { EmptyPageComponent } from './empty-page.component';

describe('EmptyPageComponent - application type', () => {
    const create = (page = 'Main') => {
        const securityService: any = { getPageByLoggedInUser: jest.fn().mockResolvedValue(page) };
        const router: any = { navigate: jest.fn() };
        const app: any = { isPrefabType: false, isApplicationType: true };
        const component = new EmptyPageComponent({} as any, securityService, router, app, { postAppTypeInfo: jest.fn() } as any);
        return { component, router, securityService };
    };
    const flush = () => new Promise((resolve) => setTimeout(resolve));

    afterEach(() => {
        history.replaceState(null, '', '/');
        jest.restoreAllMocks();
    });

    it('navigates to the page of the logged in user', async () => {
        const { component, router } = create('Home');
        component.ngOnInit();
        await flush();
        expect(router.navigate).toHaveBeenCalledWith(['Home'], { queryParams: {}, replaceUrl: true });
    });

    it('moves query params that precede the hash behind it and keeps them for the router', async () => {
        history.replaceState(null, '', '/app/?code=abc&state=xyz');
        const replace = jest.spyOn(history, 'replaceState');
        const { component, router } = create('Home');
        component.ngOnInit();
        await flush();
        expect(replace).toHaveBeenCalledWith(null, '', `${window.location.origin}/app/#/Home?code=abc&state=xyz`);
        expect(router.navigate).toHaveBeenCalledWith(['Home'], { queryParams: { code: 'abc', state: 'xyz' }, replaceUrl: true });
    });

    it('leaves the url alone when the params are already behind the hash', async () => {
        history.replaceState(null, '', '/app/?code=abc#/Home?code=abc');
        const replace = jest.spyOn(history, 'replaceState');
        const { component } = create('Home');
        component.ngOnInit();
        await flush();
        expect(replace).not.toHaveBeenCalled();
    });

    it('parses search params', () => {
        const { component } = create();
        expect((component as any).parseSearchParams('?a=1&b=two')).toEqual({ a: '1', b: 'two' });
        expect((component as any).parseSearchParams('')).toEqual({});
    });
});
