import * as core from '@wm/core';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import {
    applyMultiIndexForDuplicateBindings,
    decodeData,
    getEvaluatedOrderBy,
    processBinding,
    setDependency,
    simulateFileDownload,
} from './variables.utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn()),
}));

const CATEGORY = VARIABLE_CONSTANTS.CATEGORY;

describe('variables.utils - coverage', () => {
    beforeEach(() => {
        (core.$watch as unknown as jest.Mock).mockClear();
    });

    describe('applyMultiIndexForDuplicateBindings', () => {
        it('keeps a collectionFormat that is already set', () => {
            const bindMap: any[] = [{ target: 'a', collectionFormat: 'csv' }, { target: 'a' }];
            applyMultiIndexForDuplicateBindings(bindMap);
            expect(bindMap[0].collectionFormat).toBe('csv');
            expect(bindMap[1].collectionFormat).toBe('multi');
        });
    });

    describe('getEvaluatedOrderBy', () => {
        it('drops the variable order entirely when every field is overridden by the options', () => {
            expect(getEvaluatedOrderBy('name asc', 'name desc')).toBe('name desc');
        });

        it('appends the remaining variable order after the options order', () => {
            expect(getEvaluatedOrderBy('name asc,age asc', 'name desc')).toBe('name desc,age asc');
        });
    });

    describe('decodeData', () => {
        beforeEach(() => {
            (window as any).he = { unescape: (str: string) => str.replace(/&amp;/g, '&') };
        });

        it('leaves non string/object entries of arrays untouched and decodes the rest', () => {
            const data: any[] = [1, 'a &amp; b', { n: 2, s: 'x &amp; y', nested: { t: 'p &amp; q' } }];
            decodeData(data);
            expect(data[0]).toBe(1);
            expect(data[2].n).toBe(2);
            expect(data[2].s).toBe('x & y');
            expect(data[2].nested.t).toBe('p & q');
        });

        it('leaves non string values of objects untouched', () => {
            const obj: any = { n: 3, flag: true, s: 'a &amp; b', inner: { s: 'c &amp; d' } };
            decodeData(obj);
            expect(obj).toEqual({ n: 3, flag: true, s: 'a & b', inner: { s: 'c & d' } });
        });

        it('returns nothing for other primitive types', () => {
            expect(decodeData(5)).toBeUndefined();
            expect(decodeData(0)).toBe(0);
        });
    });

    describe('processBinding', () => {
        it('wraps an existing single value into an array before collecting multi values', () => {
            const variable: any = {
                name: 'm1', category: CATEGORY.MODEL,
                dataBinding: [
                    { target: 'q', value: 'a' },
                    { target: 'q', value: 'b', collectionFormat: 'multi' },
                ],
            };
            processBinding(variable, {});
            expect(variable.dataBinding.q).toEqual(['a', 'b']);
        });

        it('skips assigning when the root node of the target does not exist', () => {
            const variable: any = { name: 'm2', category: CATEGORY.MODEL, dataBinding: [{ target: 'a', value: 1 }] };
            processBinding(variable, {}, 'dataBinding', 'dataSet');
            expect(variable.dataSet).toBeUndefined();
        });

        it('ignores bindings that have no value', () => {
            const variable: any = { name: 'm3', category: CATEGORY.SERVICE, dataBinding: [{ target: 'a' }] };
            processBinding(variable, {});
            expect(variable.dataBinding).toEqual({});
            expect(core.$watch).not.toHaveBeenCalled();
        });
    });

    describe('simulateFileDownload', () => {
        let submit: jest.SpyInstance;

        beforeEach(() => {
            jest.useFakeTimers();
            submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
            delete (window.URL as any).createObjectURL;
            delete (window.URL as any).revokeObjectURL;
            document.body.innerHTML = '';
        });

        const headersOf = (map: any) => ({ get: (name: string) => map[name] });

        const formOf = () => {
            const iframe = document.getElementById('fileDownloadIFrame') as HTMLIFrameElement;
            return iframe.contentDocument!.querySelector('form#fileDownloadForm') as HTMLFormElement;
        };

        describe('through an iframe', () => {
            it('does not report an error when the iframe loads without any text', () => {
                const error = jest.fn();
                const success = jest.fn();
                simulateFileDownload({ url: '/export', method: 'POST', headers: {}, data: 'a=1' }, 'f', 'CSV', success, error, undefined);
                jest.advanceTimersByTime(100);
                $('#fileDownloadIFrame').trigger('load');
                expect(error).not.toHaveBeenCalled();
                jest.advanceTimersByTime(2000);
                expect(success).toHaveBeenCalledTimes(1);
            });

            // an array carrying a Content-Type property is "empty" for the headers check, but still exposes the header
            it.each([
                ['/export?x=1', [['x', '1'], ['dp', '']]],
                ['/export', [['dp', '']]],
            ])('appends the url encoded data params to the query of %s and keeps the declared content type', (url, expectedInputs) => {
                const headers: any = [];
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                simulateFileDownload({ url, method: 'GET', headers, data: '', dataParams: 'dp' }, 'f', 'CSV', jest.fn(), jest.fn(), undefined);
                jest.advanceTimersByTime(100);
                expect(formOf().getAttribute('enctype')).toBe('application/x-www-form-urlencoded');
                // the Content-Type header itself is excluded from the posted params
                const inputs = Array.from(formOf().querySelectorAll('input')).map((el: any) => [el.name, el.value]);
                expect(inputs).toEqual(expectedInputs);
            });
        });

        describe('through an anchor', () => {
            const request = () => ({ url: '/export', method: 'POST', headers: { 'X-A': '1' }, data: 'd' });

            beforeEach(() => {
                (window.URL as any).createObjectURL = jest.fn(() => 'blob:dl');
                (window.URL as any).revokeObjectURL = jest.fn();
                jest.spyOn(window, 'open').mockReturnValue({} as any);
                jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
            });

            const run = async (headers: any) => {
                const success = jest.fn();
                setDependency('http', { send: jest.fn().mockResolvedValue({ body: 'x', headers: headersOf(headers) }) });
                simulateFileDownload(request(), 'report', 'CSV', success, jest.fn(), undefined);
                await Promise.resolve();
                jest.advanceTimersByTime(900);
                jest.advanceTimersByTime(500);
                return success;
            };

            it('opens the blob instead of downloading when the disposition carries no file name', async () => {
                const success = await run({ 'Content-Disposition': 'attachment', 'Content-Type': 'text/plain' });
                expect(window.open).toHaveBeenCalledWith('blob:dl', '_blank');
                expect(success).toHaveBeenCalled();
            });

            it('opens the blob when the file name in the disposition is empty', async () => {
                const success = await run({ 'Content-Disposition': 'attachment; filename=', 'Content-Type': 'text/plain' });
                expect(window.open).toHaveBeenCalledWith('blob:dl', '_blank');
                expect(success).toHaveBeenCalled();
            });

            it('uses webkitURL when window.URL is not available', async () => {
                const webkit = { createObjectURL: jest.fn(() => 'blob:webkit'), revokeObjectURL: jest.fn() };
                const originalURL = window.URL;
                (window as any).URL = undefined;
                (window as any).webkitURL = webkit;
                try {
                    const success = await run({ 'Content-Type': 'text/plain' });
                    expect(webkit.createObjectURL).toHaveBeenCalled();
                    expect(window.open).toHaveBeenCalledWith('blob:webkit', '_blank');
                    expect(success).toHaveBeenCalled();
                    jest.advanceTimersByTime(100);
                    expect(webkit.revokeObjectURL).toHaveBeenCalledWith('blob:webkit');
                } finally {
                    (window as any).URL = originalURL;
                    delete (window as any).webkitURL;
                }
            });
        });
    });
});
