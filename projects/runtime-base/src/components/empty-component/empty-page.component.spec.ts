jest.mock('../../services/app.manager.service', () => ({ AppManagerService: class {} }));

import { EmptyPageComponent } from './empty-page.component';

describe('EmptyPageComponent', () => {
    const createComponent = (appOverrides: any = {}) => {
        const route: any = {};
        const securityService: any = { getPageByLoggedInUser: jest.fn() };
        const router: any = { navigate: jest.fn() };
        const app: any = { isPrefabType: false, isApplicationType: false, ...appOverrides };
        const appManager: any = { postAppTypeInfo: jest.fn() };
        const component = new EmptyPageComponent(route, securityService, router, app, appManager);
        return { component, route, securityService, router, app, appManager };
    };

    afterEach(() => {
        delete (window as any)._WM_APP_PROPERTIES;
    });

    it('should navigate to prefab-preview for a prefab app', () => {
        const { component, router, securityService } = createComponent({ isPrefabType: true });
        component.ngOnInit();
        expect(router.navigate).toHaveBeenCalledWith(['prefab-preview']);
        expect(securityService.getPageByLoggedInUser).not.toHaveBeenCalled();
    });

    it('should navigate to the configured home page and post app type info for a non-prefab, non-application project', () => {
        (window as any)._WM_APP_PROPERTIES = { homePage: 'Main' };
        const { component, router, appManager, securityService } = createComponent();
        component.ngOnInit();
        expect(router.navigate).toHaveBeenCalledWith(['Main']);
        expect(appManager.postAppTypeInfo).toHaveBeenCalled();
        expect(securityService.getPageByLoggedInUser).not.toHaveBeenCalled();
    });
});
