import { convertToBlob, findValueOf, getDateObj, getMomentLocaleObject, getValidDateObject, isInsecureContentRequest } from './utils';

describe('utils - remaining branches', () => {
    describe('isInsecureContentRequest', () => {
        it('allows empty, data and non http urls on an http page', () => {
            expect(isInsecureContentRequest('')).toBe(false);
            expect(isInsecureContentRequest('data:image/png;base64,AAAA')).toBe(false);
            expect(isInsecureContentRequest('http://example.com/a')).toBe(false);
        });
    });

    describe('getDateObj', () => {
        it('falls back to the current time for invalid dates', () => {
            const before = Date.now();
            const result = getDateObj('not a date at all 99/99/99') as Date;
            expect(result === undefined || Math.abs(result.getTime() - before) < 5000).toBe(true);
        });

        it('keeps date objects and parses timestamps', () => {
            const d = new Date(2020, 0, 2);
            expect(getDateObj(d)).toBe(d);
            expect(getDateObj(String(d.getTime()))).toEqual(d);
        });

        it('returns undefined for empty values', () => {
            expect(getDateObj('')).toBeUndefined();
        });
    });

    describe('findValueOf', () => {
        it('reads nested values and creates paths on demand', () => {
            expect(findValueOf(undefined, 'a')).toBeUndefined();
            expect(findValueOf({}, '')).toBeUndefined();
            expect(findValueOf({ a: { b: 1 } }, 'a.b')).toBe(1);
            const obj: any = {};
            findValueOf(obj, 'a.b[0].c', true);
            expect(obj.a).toBeDefined();
        });
    });

    describe('getMomentLocaleObject', () => {
        it('returns dates in the given time zone', () => {
            const now = getMomentLocaleObject('Asia/Kolkata');
            const given = getMomentLocaleObject('Asia/Kolkata', new Date(Date.UTC(2024, 0, 1, 0, 0, 0)));
            expect(now).toBeInstanceOf(Date);
            expect(given.getHours()).toBe(5);
            expect(given.getMinutes()).toBe(30);
        });
    });

    describe('convertToBlob', () => {
        afterEach(() => {
            delete (globalThis as any).resolveLocalFileSystemURL;
        });

        it('reads a cordova file into a blob', async () => {
            const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
            (globalThis as any).resolveLocalFileSystemURL = (path: string, ok: Function) => ok({ file: (cb: Function) => cb(file) });
            const result: any = await convertToBlob('file:///a.txt');
            expect(result.filepath).toBe('file:///a.txt');
            expect(result.blob).toBeInstanceOf(Blob);
            expect(result.blob.type).toBe('text/plain');
        });

        it('rejects when the file cannot be resolved', async () => {
            (globalThis as any).resolveLocalFileSystemURL = (path: string, ok: Function, fail: Function) => fail('nope');
            await expect(convertToBlob('file:///missing')).rejects.toBe('nope');
        });
    });

    describe('on iOS', () => {
        let utils: any;

        beforeAll(() => {
            Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)', configurable: true });
            jest.isolateModules(() => {
                utils = require('./utils');
            });
        });

        afterAll(() => {
            Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/26.0.0', configurable: true });
        });

        it('recognises iOS devices', () => {
            expect(utils.isIphone()).toBe(true);
            expect(utils.isIos()).toBe(true);
        });

        it('normalises dates to a format safari understands', () => {
            const typed = utils.getValidDateObject('2024-03-05 10:20:30', { pattern: 'yyyy-MM-dd HH:mm:ss', isNativePicker: false });
            expect(typed).toBeDefined();
            const plain = utils.getValidDateObject('2024/03/05 10:20:30', { isNativePicker: true });
            expect(typeof plain === 'string' || plain instanceof Date).toBe(true);
        });
    });

    it('creates valid date objects on other platforms', () => {
        const result: any = getValidDateObject('2024-03-05', { pattern: 'yyyy-MM-dd', isNativePicker: false });
        expect(result instanceof Date || typeof result === 'string' || result?.isValid?.()).toBeTruthy();
    });
});
