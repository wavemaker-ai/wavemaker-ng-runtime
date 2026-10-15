jest.mock('@wm/runtime/base', () => ({
    PrefabPreviewComponent: class PrefabPreviewComponent {},
    CanDeactivatePageGuard: class CanDeactivatePageGuard {},
    EmptyPageComponent: class EmptyPageComponent {}
}));
jest.mock('./components/page-wrapper.component', () => ({ PageWrapperComponent: class PageWrapperComponent {} }));

import { CanDeactivatePageGuard, EmptyPageComponent, PrefabPreviewComponent } from '@wm/runtime/base';
import { PageWrapperComponent } from './components/page-wrapper.component';
import { routes } from './app.routes';

describe('app routes', () => {
    it('maps the empty path, prefab preview and named pages', () => {
        expect(routes).toHaveLength(3);
        expect(routes[0]).toEqual({ path: '', pathMatch: 'full', component: EmptyPageComponent });
        expect(routes[1]).toEqual({ path: 'prefab-preview', pathMatch: 'full', component: PrefabPreviewComponent });
        expect(routes[2]).toEqual({
            path: ':pageName',
            pathMatch: 'full',
            component: PageWrapperComponent,
            canDeactivate: [CanDeactivatePageGuard]
        });
    });
});
