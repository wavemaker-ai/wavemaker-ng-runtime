import prefabConfig from './prefab-config';

describe('prefab-config', () => {
    it('exports a no-op default config provider', () => {
        expect(typeof prefabConfig).toBe('function');
        expect(prefabConfig()).toBeUndefined();
    });
});
