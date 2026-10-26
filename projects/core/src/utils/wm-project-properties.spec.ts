import {
    getWmProjectProperties,
    setWmProjectProperties,
    setPreviewProperties,
    getPreviewProperties,
    loadPreviewFontConfig
} from './wm-project-properties';

describe('wm-project-properties', () => {

    afterEach(() => {
        delete (window as any)._WM_APP_PROPERTIES;
    });

    describe('getWmProjectProperties / setWmProjectProperties', () => {
        it('returns window._WM_APP_PROPERTIES when set', () => {
            (window as any)._WM_APP_PROPERTIES = { name: 'fromWindow' };
            expect(getWmProjectProperties()).toEqual({ name: 'fromWindow' });
        });

        it('falls back to the internal properties object set via setWmProjectProperties', () => {
            setWmProjectProperties({ name: 'fromSetter' });
            expect((getWmProjectProperties() as any).name).toBe('fromSetter');
        });

        it('prefers window._WM_APP_PROPERTIES over the internal properties object', () => {
            setWmProjectProperties({ name: 'fromSetter' });
            (window as any)._WM_APP_PROPERTIES = { name: 'fromWindow' };
            expect((getWmProjectProperties() as any).name).toBe('fromWindow');
        });
    });

    describe('getPreviewProperties / setPreviewProperties', () => {
        it('returns undefined when no fontConfig has been set', () => {
            expect(getPreviewProperties()).toBeUndefined();
        });

        it('wraps a plain fontConfig object with defaults filled in', () => {
            setPreviewProperties({ fontConfig: { baseFont: 'Roboto', fonts: ['Roboto'] } });
            expect(getPreviewProperties()).toEqual({
                default: { baseFont: 'Roboto', fonts: ['Roboto'] }
            });
        });

        it('unwraps a fontConfig module whose export is under .default', () => {
            setPreviewProperties({ fontConfig: { default: { baseFont: 'Inter', fonts: ['Inter'] } } });
            expect(getPreviewProperties()).toEqual({
                default: { baseFont: 'Inter', fonts: ['Inter'] }
            });
        });

        it('falls back to empty defaults for a non-object fontConfig', () => {
            setPreviewProperties({ fontConfig: 'not-an-object' });
            expect(getPreviewProperties()).toEqual({
                default: { baseFont: '', fonts: [] }
            });
        });

        it('defaults baseFont/fonts when missing from the config object', () => {
            setPreviewProperties({ fontConfig: {} });
            expect(getPreviewProperties()).toEqual({
                default: { baseFont: '', fonts: [] }
            });
        });

        it('ignores a non-array fonts value, defaulting to an empty array', () => {
            setPreviewProperties({ fontConfig: { baseFont: 'Roboto', fonts: 'not-an-array' } });
            expect(getPreviewProperties()).toEqual({
                default: { baseFont: 'Roboto', fonts: [] }
            });
        });
    });

    describe('loadPreviewFontConfig', () => {
        it('loads the font config module, stores it as preview properties, and returns the wrapped result', async () => {
            const url = new URL('./font.config.js', document.baseURI).href;
            jest.doMock(url, () => ({ baseFont: 'Roboto', fonts: ['Roboto'] }), { virtual: true });

            const result = await loadPreviewFontConfig();

            expect(result).toEqual({ default: { baseFont: 'Roboto', fonts: ['Roboto'] } });
            expect(getPreviewProperties()).toEqual({ default: { baseFont: 'Roboto', fonts: ['Roboto'] } });

            jest.dontMock(url);
        });
    });
});
