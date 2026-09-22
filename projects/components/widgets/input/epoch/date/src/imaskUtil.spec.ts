import { validateTheMaskedDate } from './imaskUtil';

describe('validateTheMaskedDate', () => {
    it('should return false for timestamp format', () => {
        expect(validateTheMaskedDate('timestamp', 'en')).toBe(false);
    });

    it('should expand a single D to DD in the pattern', () => {
        const result: any = validateTheMaskedDate('yyyy-MM-d', 'en');
        expect(result.pattern).toBe('YYYY-MM-DD');
    });

    it('should not expand D when it already appears twice', () => {
        const result: any = validateTheMaskedDate('yyyy-MM-dd', 'en');
        expect(result.pattern).toBe('YYYY-MM-DD');
    });

    it('should expand a single M to MM in the pattern', () => {
        const result: any = validateTheMaskedDate('yyyy-M-dd', 'en');
        expect(result.pattern).toBe('YYYY-MM-DD');
    });

    it('should not expand M when it already appears three times (short month name)', () => {
        const result: any = validateTheMaskedDate('yyyy-MMM-dd', 'en');
        expect(result.pattern).toBe('YYYY-MMM-DD');
    });

    it('should replace day-of-week token e with lowercase d, distinct from day-of-month D', () => {
        const result: any = validateTheMaskedDate('eee, yyyy-MM-dd', 'en');
        expect(result.pattern).toBe('ddd, YYYY-MM-DD');
    });

    it('should return an IMask config object with the expected shape', () => {
        const result: any = validateTheMaskedDate('yyyy-MM-dd', 'en');
        expect(result.mask).toBe(Date);
        expect(result.autofix).toBe(true);
        expect(result.lazy).toBe(false);
        expect(result.overwrite).toBe(true);
        expect(result.skipInvalid).toBe(true);
        expect(typeof result.format).toBe('function');
        expect(typeof result.parse).toBe('function');
        expect(result.blocks).toBeDefined();
        expect(result.blocks.YYYY).toEqual(expect.objectContaining({ from: 1900, to: 9999, maxLength: 4 }));
        expect(result.blocks.MM).toEqual(expect.objectContaining({ from: 1, to: 12, maxLength: 2 }));
        expect(result.blocks.DD).toEqual(expect.objectContaining({ from: 1, to: 31, maxLength: 2 }));
    });

    it('should build month short/long name enums via the format\'s locale', () => {
        const result: any = validateTheMaskedDate('MMMM d, yyyy', 'en-US');
        expect(result.blocks.MMMM.enum).toContain('January');
        expect(result.blocks.MMMM.enum.length).toBe(12);
    });

    it('should build weekday short/long name enums via the format\'s locale', () => {
        const result: any = validateTheMaskedDate('eeee, yyyy-MM-dd', 'en-US');
        expect(result.blocks.dddd.enum.length).toBe(7);
        expect(result.blocks.dddd.enum).toContain('Sunday');
    });

    it('parse() should convert a formatted string back to a Date using the derived pattern', () => {
        const result: any = validateTheMaskedDate('yyyy-MM-dd', 'en');
        const parsed = result.parse('2024-03-15');
        expect(parsed instanceof Date).toBe(true);
        expect(parsed.getFullYear()).toBe(2024);
        expect(parsed.getMonth()).toBe(2);
        expect(parsed.getDate()).toBe(15);
    });

    it('format() should format a Date using the derived pattern', () => {
        const result: any = validateTheMaskedDate('yyyy-MM-dd', 'en');
        const formatted = result.format(new Date(2024, 2, 15));
        expect(formatted).toBe('2024-03-15');
    });
});
