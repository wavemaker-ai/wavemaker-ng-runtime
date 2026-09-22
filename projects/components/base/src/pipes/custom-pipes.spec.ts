import {
    TrailingZeroDecimalPipe, ToDatePipe, ToNumberPipe, ToCurrencyPipe, PrefixPipe, SuffixPipe,
    CustomPipe, TimeFromNowPipe, NumberToStringPipe, StringToNumberPipe, FilterPipe, FileSizePipe,
    FileIconClassPipe, StateClassPipe, TemplateReplacePipe, FileExtensionFromMimePipe,
} from './custom-pipes';

describe('custom-pipes', () => {
    describe('TrailingZeroDecimalPipe', () => {
        it('should build a fraction-size filter from decimalValue length when trailingzero is set', () => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue('1.50') };
            const pipe = new TrailingZeroDecimalPipe(decimalPipe);
            const result = pipe.transform(1.5, 'en', '1.2-2', undefined, true, '00', false, undefined);
            expect(decimalPipe.transform).toHaveBeenCalledWith(1.5, '1.2-16', 'en');
            expect(result).toBe('1.50');
        });

        it('should keep the given numberfilter when trailingzero is false', () => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue('1.50') };
            const pipe = new TrailingZeroDecimalPipe(decimalPipe);
            pipe.transform(1.5, 'en', '1.2-2', undefined, false, '00', false, undefined);
            expect(decimalPipe.transform).toHaveBeenCalledWith(1.5, '1.2-2', 'en');
        });

        it('should prefer the formattedLocale number setting over selectedLocale', () => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue('1.50') };
            const pipe = new TrailingZeroDecimalPipe(decimalPipe);
            pipe.transform(1.5, 'en', '1.2-2', undefined, false, '00', false, { number: 'fr' });
            expect(decimalPipe.transform).toHaveBeenCalledWith(1.5, '1.2-2', 'fr');
        });
    });

    describe('ToDatePipe', () => {
        const makePipe = () => {
            const datePipe: any = { transform: jest.fn().mockReturnValue('formatted-date') };
            const i18nService: any = { getTimezone: jest.fn().mockReturnValue(undefined) };
            const app: any = { Variables: {} };
            const customPipeManager: any = { getCustomPipe: jest.fn().mockReturnValue(null) };
            return { pipe: new ToDatePipe(datePipe, i18nService, app, customPipeManager), datePipe };
        };

        it('should return an empty string for null/empty-string input', () => {
            const { pipe } = makePipe();
            expect(pipe.transform('null', 'dd/MM/yyyy')).toBe('');
            expect(pipe.transform('', 'dd/MM/yyyy')).toBe('');
        });

        it('should return an empty string for undefined input', () => {
            const { pipe } = makePipe();
            expect(pipe.transform(undefined, 'dd/MM/yyyy')).toBe('');
        });

        it('should return the raw epoch for the timestamp format', () => {
            const { pipe } = makePipe();
            expect(pipe.transform(1700000000000, 'timestamp')).toBe(1700000000000);
        });

        it('should return an ISO string for the UTC format', () => {
            const { pipe } = makePipe();
            expect(pipe.transform(1700000000000, 'UTC')).toBe(new Date(1700000000000).toISOString());
        });

        it('should delegate to the injected DatePipe for a normal format', () => {
            const { pipe, datePipe } = makePipe();
            const result = pipe.transform(1700000000000, 'dd/MM/yyyy');
            expect(datePipe.transform).toHaveBeenCalledWith(1700000000000, 'dd/MM/yyyy');
            expect(result).toBe('formatted-date');
        });
    });

    describe('ToNumberPipe', () => {
        const makePipe = (transformReturn: any = '1,234.50') => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue(transformReturn) };
            const i18nService: any = { getwidgetLocale: jest.fn().mockReturnValue(undefined) };
            return { pipe: new ToNumberPipe(decimalPipe, i18nService), decimalPipe };
        };

        it('should format a numeric value via the decimal pipe', () => {
            const { pipe, decimalPipe } = makePipe();
            const result = pipe.transform(1234.5, undefined);
            expect(decimalPipe.transform).toHaveBeenCalledWith(1234.5, undefined, null);
            expect(result).toBe('1,234.50');
        });

        it('should return undefined for a non-numeric value', () => {
            const { pipe } = makePipe();
            expect(pipe.transform('abc', undefined)).toBeUndefined();
        });

        it('should normalize a bare fracSize digit into a "1.n-n" filter', () => {
            const { pipe, decimalPipe } = makePipe();
            pipe.transform(1, 2);
            expect(decimalPipe.transform).toHaveBeenCalledWith(1, '1.2-2', null);
        });
    });

    describe('NumberToStringPipe', () => {
        it('should behave like ToNumberPipe', () => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue('42') };
            const i18nService: any = { getwidgetLocale: jest.fn().mockReturnValue(undefined) };
            const pipe = new NumberToStringPipe(decimalPipe, i18nService);
            expect(pipe.transform(42, undefined)).toBe('42');
        });
    });

    describe('ToCurrencyPipe', () => {
        const makePipe = (transformReturn: any) => {
            const decimalPipe: any = { transform: jest.fn().mockReturnValue(transformReturn) };
            const i18nService: any = { getwidgetLocale: jest.fn().mockReturnValue(undefined) };
            return new ToCurrencyPipe(decimalPipe, i18nService);
        };

        it('should prefix a positive amount with the currency symbol', () => {
            const pipe = makePipe('100.00');
            expect(pipe.transform(100, 'USD', 2)).toBe('$100.00');
        });

        it('should keep the minus sign before the currency symbol for a negative amount', () => {
            const pipe = makePipe('-50.00');
            expect(pipe.transform(-50, 'USD', 2)).toBe('-$50.00');
        });

        it('should fall back to the raw currencySymbol when it is not a known currency code', () => {
            const pipe = makePipe('10.00');
            expect(pipe.transform(10, '¥', 2)).toBe('¥10.00');
        });

        it('should return an empty string when the underlying number formatting fails', () => {
            const pipe = makePipe(undefined);
            expect(pipe.transform('abc', 'USD', 2)).toBe('');
        });
    });

    describe('PrefixPipe / SuffixPipe', () => {
        it('should prefix non-empty values with the padding', () => {
            expect(new PrefixPipe().transform('5', 'Rs. ')).toBe('Rs. 5');
        });

        it('should pass through undefined/null/empty values unchanged', () => {
            const pipe = new PrefixPipe();
            expect(pipe.transform(undefined, 'x')).toBeUndefined();
            expect(pipe.transform(null, 'x')).toBeNull();
            expect(pipe.transform('', 'x')).toBe('');
        });

        it('should suffix non-empty values with the padding', () => {
            expect(new SuffixPipe().transform('5', ' kg')).toBe('5 kg');
        });
    });

    describe('CustomPipe', () => {
        it('should invoke the resolved custom pipe formatter with extra args and app.Variables', () => {
            const app: any = { Variables: { a: 1 } };
            const formatter = jest.fn().mockReturnValue('custom-result');
            const custmeUserPipe: any = { getCustomPipe: jest.fn().mockReturnValue({ formatter }) };
            const pipe = new CustomPipe(app, custmeUserPipe);
            // transform() reads extra args via `arguments`, beyond its declared (data, pipename) signature.
            const result = (pipe.transform as any)('data', 'myPipe', 'extra1', 'extra2');
            expect(formatter).toHaveBeenCalledWith('data', 'extra1', 'extra2', { a: 1 });
            expect(result).toBe('custom-result');
        });

        it('should warn and return data unchanged when the pipe is not found', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const app: any = { Variables: {} };
            const custmeUserPipe: any = { getCustomPipe: jest.fn().mockReturnValue(null) };
            const pipe = new CustomPipe(app, custmeUserPipe);
            expect(pipe.transform('data', 'missingPipe')).toBe('data');
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('should catch a throwing formatter and return data unchanged', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const app: any = { Variables: {} };
            const formatter = jest.fn().mockImplementation(() => { throw new Error('boom'); });
            const custmeUserPipe: any = { getCustomPipe: jest.fn().mockReturnValue({ formatter }) };
            const pipe = new CustomPipe(app, custmeUserPipe);
            expect(pipe.transform('data', 'myPipe')).toBe('data');
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('TimeFromNowPipe', () => {
        it('should return undefined for undefined input', () => {
            expect(new TimeFromNowPipe().transform(undefined)).toBeUndefined();
        });

        it('should return a relative time string for a valid date', () => {
            const result = new TimeFromNowPipe().transform(Date.now());
            expect(typeof result).toBe('string');
        });
    });

    describe('StringToNumberPipe', () => {
        it('should convert a numeric string to a number', () => {
            expect(new StringToNumberPipe().transform('42')).toBe(42);
        });

        it('should return undefined for a non-numeric string', () => {
            expect(new StringToNumberPipe().transform('abc')).toBeUndefined();
        });
    });

    describe('FilterPipe', () => {
        it('should return an empty array for falsy data', () => {
            expect(new FilterPipe().transform(undefined, 'a', 1)).toEqual([]);
        });

        it('should filter by a matcher object when field is an object', () => {
            const data = [{ id: 1, active: true }, { id: 2, active: false }];
            expect(new FilterPipe().transform(data, { active: true }, undefined)).toEqual([{ id: 1, active: true }]);
        });

        it('should filter by a field/value pair otherwise', () => {
            const data = [{ tags: 'red,blue' }, { tags: 'green' }];
            expect(new FilterPipe().transform(data, 'tags', 'red')).toEqual([{ tags: 'red,blue' }]);
        });
    });

    describe('FileSizePipe', () => {
        it('should format bytes without conversion when under 1024', () => {
            expect(new FileSizePipe().transform(500, 0)).toBe('500 bytes');
        });

        it('should convert to KB/MB with the given precision', () => {
            expect(new FileSizePipe().transform(1048576, 1)).toBe('1.0 MB');
        });
    });

    describe('FileIconClassPipe', () => {
        it('should map a known extension to its icon class', () => {
            expect(new FileIconClassPipe().transform('pdf')).toBe('fa fa-file-pdf-o');
        });

        it('should fall back to the default file icon for an unknown extension', () => {
            expect(new FileIconClassPipe().transform('xyz')).toBe('fa fa-file-o');
        });
    });

    describe('StateClassPipe', () => {
        it('should map success/error states case-insensitively', () => {
            expect(new StateClassPipe().transform('SUCCESS')).toBe('wi wi-check-circle text-success');
            expect(new StateClassPipe().transform('error')).toBe('wi wi-error text-danger');
        });
    });

    describe('TemplateReplacePipe', () => {
        it('should replace ${key} placeholders from the given map', () => {
            const result = new TemplateReplacePipe().transform('Hello ${name}!', { name: 'World' });
            expect(result).toBe('Hello World!');
        });
    });

    describe('FileExtensionFromMimePipe', () => {
        it('should map a known mime type to its extension', () => {
            expect(new FileExtensionFromMimePipe().transform('application/pdf')).toBe('.pdf');
        });

        it('should return undefined for an unknown mime type', () => {
            expect(new FileExtensionFromMimePipe().transform('application/x-unknown')).toBeUndefined();
        });
    });
});
