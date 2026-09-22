import { CURRENCY_INFO } from './currency-constants';

describe('currency-constants', () => {
    it('should expose well-known currency codes with their symbols', () => {
        expect(CURRENCY_INFO['USD'].symbol).toBe('$');
        expect(CURRENCY_INFO['EUR'].symbol).toBe('€');
        expect(CURRENCY_INFO['USD'].code).toBe('USD');
    });

    it('should give every currency entry a symbol, name, code and decimal_digits', () => {
        Object.entries(CURRENCY_INFO).forEach(([code, info]: [string, any]) => {
            expect(info.symbol).toBeDefined();
            expect(info.name).toBeDefined();
            expect(info.code).toBe(code);
            expect(typeof info.decimal_digits).toBe('number');
        });
    });
});
