import { getCustomWidgetConfig, getPrefabConfig, registerCustomWidgetConfig, registerPrefabConfig } from './page-util';

describe('page-util', () => {
    it('registers and returns prefab configs', () => {
        expect(getPrefabConfig('pf')).toBeUndefined();
        registerPrefabConfig('pf', { a: 1 });
        expect(getPrefabConfig('pf')).toEqual({ a: 1 });
        registerPrefabConfig('pf', { a: 2 });
        expect(getPrefabConfig('pf')).toEqual({ a: 2 });
    });

    it('registers and returns custom widget configs independently of prefab configs', () => {
        expect(getCustomWidgetConfig('w')).toBeUndefined();
        registerCustomWidgetConfig('w', { b: 1 });
        expect(getCustomWidgetConfig('w')).toEqual({ b: 1 });
        expect(getPrefabConfig('w')).toBeUndefined();
    });
});
