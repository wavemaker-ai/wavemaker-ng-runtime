import { I18nResolve } from './i18n.resolve';

describe('I18nResolve', () => {
    it('loads the default locale', async () => {
        const i18n: any = { loadDefaultLocale: jest.fn(() => Promise.resolve('en')) };
        await expect(new I18nResolve(i18n).resolve()).resolves.toBe('en');
        expect(i18n.loadDefaultLocale).toHaveBeenCalled();
    });
});
