import { PipeProvider } from './pipe-provider.service';

describe('PipeProvider cover', () => {
    it('defaults formatsByLocale to an empty object when no i18n service is available', () => {
        const provider = new PipeProvider({} as any, { get: jest.fn() } as any, {} as any, undefined as any);
        expect(provider.formatsByLocale).toEqual({});
    });

    it('uses the i18n service widget locale when available', () => {
        const locale = { a: 1 };
        const provider = new PipeProvider({} as any, { get: jest.fn() } as any, {} as any, { getwidgetLocale: jest.fn().mockReturnValue(locale) } as any);
        expect(provider.formatsByLocale).toBe(locale);
    });
});
