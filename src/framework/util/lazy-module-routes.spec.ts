import { partialLazyModules, prefabLazyModules, prefabPartialLazyModules } from './lazy-module-routes';

describe('lazy-module-routes', () => {
    it('starts with empty registries that code generation fills in', () => {
        expect(prefabLazyModules).toEqual({});
        expect(partialLazyModules).toEqual({});
        expect(prefabPartialLazyModules).toEqual({});
    });
});
