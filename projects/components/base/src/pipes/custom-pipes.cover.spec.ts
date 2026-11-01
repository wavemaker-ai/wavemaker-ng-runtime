import { DatePipe, DecimalPipe } from '@angular/common';
import * as momentLib from 'moment-timezone/moment-timezone';
import { PrefixPipe, SuffixPipe, TimeFromNowPipe, ToCurrencyPipe, ToDatePipe } from './custom-pipes';

describe('custom-pipes remaining branches', () => {
    beforeAll(() => {
        // register a fixed UTC+9 zone so moment.tz() has data in jsdom
        const m: any = (momentLib as any).default || (momentLib as any);
        m.tz.add('Fixed/Nine|NIN|-90|0||');
    });

    describe('ToDatePipe', () => {
        const build = (i18n: any, pipeRef?: any) => {
            const manager: any = { getCustomPipe: jest.fn(() => pipeRef) };
            return new ToDatePipe(new DatePipe('en-US'), i18n, { Variables: {} } as any, manager);
        };

        it('uses the timezone argument when there is no i18n service', () => {
            const pipe = build(null);
            const ts = Date.UTC(2020, 0, 1, 12, 0, 0);
            // timestamp number + timezone -> formatted in the given zone (UTC+9 => 21:00)
            expect(pipe.transform(ts, 'HH:mm', 'Fixed/Nine')).toBe('21:00');
        });

        it('applies the timezone to date strings that carry an explicit offset', () => {
            const pipe = build(null);
            expect(pipe.transform('2020-01-01T12:00:00+00:00', 'HH:mm', 'Fixed/Nine')).toBe('21:00');
        });

        it('falls back to the DatePipe for offset-less strings even when a timezone is given', () => {
            const pipe = build(null);
            const spy = jest.spyOn((pipe as any).datePipe, 'transform');
            pipe.transform('2020-01-01', 'yyyy', 'Fixed/Nine');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('returns the data unchanged when a custom formatter is given no args', () => {
            const formatter = jest.fn(() => 'custom');
            const pipe: any = build({ getTimezone: () => undefined }, { formatter });
            // spreading undefined args throws inside customFormatter, which falls back to the raw data
            expect(pipe.returnFn('x', undefined, { v: 1 })).toBe('x');
            expect(formatter).not.toHaveBeenCalled();
        });
    });

    describe('ToCurrencyPipe', () => {
        it('renders without a symbol when none is supplied', () => {
            const pipe = new ToCurrencyPipe(new DecimalPipe('en-US'), { getwidgetLocale: () => undefined } as any);
            expect(pipe.transform(1234.5, undefined, '1.2-2')).toBe('1,234.50');
        });
    });

    describe('PrefixPipe / SuffixPipe', () => {
        it('treats a missing padding as an empty string', () => {
            expect(new PrefixPipe().transform('abc', undefined)).toBe('abc');
            expect(new SuffixPipe().transform('abc', undefined)).toBe('abc');
        });

        it('returns empty-ish suffix input unchanged', () => {
            expect(new SuffixPipe().transform('', '!')).toBe('');
            expect(new SuffixPipe().transform(null, '!')).toBeNull();
            expect(new SuffixPipe().transform(undefined, '!')).toBeUndefined();
        });
    });

    describe('TimeFromNowPipe', () => {
        it('returns undefined when the value cannot be parsed to a timestamp', () => {
            expect(new TimeFromNowPipe().transform('not a date')).toBeUndefined();
        });
    });
});

describe('custom-pipes moment fallback', () => {
    it('falls back to window.moment when the moment module has no default export', () => {
        jest.isolateModules(() => {
            const real = jest.requireActual('moment-timezone/moment-timezone');
            const realFn = real.default || real;
            const fake: any = (...a: any[]) => realFn(...a);
            (window as any).moment = Object.assign(fake, realFn);
            jest.doMock('moment-timezone/moment-timezone', () => ({ __esModule: true, default: undefined }));
            const mod = require('./custom-pipes');
            // the pipe still works through the window.moment fallback
            expect(typeof new mod.TimeFromNowPipe().transform(Date.now())).toBe('string');
        });
        delete (window as any).moment;
        jest.dontMock('moment-timezone/moment-timezone');
    });
});
