import * as core from '@wm/core';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import {
    debounceVariableCall,
    decodeData,
    formatDate,
    initiateCallback,
    processBinding,
    setDependency,
    setInput,
    simulateFileDownload,
} from './variables.utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn()),
}));

const CATEGORY = VARIABLE_CONSTANTS.CATEGORY;
const watchMock = core.$watch as unknown as jest.Mock;
const listenerOf = (callIndex = 0) => watchMock.mock.calls[callIndex][3];

describe('variables.utils - processBinding', () => {
    beforeEach(() => {
        watchMock.mockClear();
    });

    describe('static bindings', () => {
        it('assigns nested targets, creating the intermediate objects', () => {
            const variable: any = { name: 'v1', category: CATEGORY.SERVICE, dataBinding: [{ target: 'user.address.city', value: 'NYC' }] };
            processBinding(variable, {});
            expect(variable.dataBinding).toEqual({ user: { address: { city: 'NYC' } } });
        });

        it('keeps a bracket target such as ["my.param"] as a single key', () => {
            const variable: any = { name: 'v2', category: CATEGORY.SERVICE, dataBinding: [{ target: "['my.param']", value: 1 }] };
            processBinding(variable, {});
            expect(variable.dataBinding).toEqual({ 'my.param': 1 });
        });

        it('re-targets dataBinding to dataSet for static variables', () => {
            const variable: any = { name: 'v3', category: CATEGORY.MODEL, dataBinding: [{ target: 'dataBinding', value: [1, 2] }] };
            processBinding(variable, {}, 'dataBinding', 'dataSet');
            expect(variable.dataSet).toEqual([1, 2]);
        });

        it('collects duplicate service query params into slots of an array', () => {
            const variable: any = {
                name: 'v4', category: CATEGORY.SERVICE,
                dataBinding: [{ target: 'q', value: 'a' }, { target: 'q', value: 'b' }],
            };
            processBinding(variable, {});
            expect(variable.dataBinding.q).toEqual(['a', 'b']);
        });

        it('wraps an existing single value when collecting multi values', () => {
            const variable: any = {
                name: 'v5', category: CATEGORY.SERVICE,
                dataBinding: [{ target: 'q', value: 'a', collectionFormat: 'multi' }],
            };
            processBinding(variable, {});
            expect(variable.dataBinding.q).toEqual(['a']);
        });

        it('fills the filterFields of a live read variable', () => {
            const variable: any = {
                name: 'v6', category: CATEGORY.LIVE, operation: 'read', filterFields: {},
                dataBinding: [{ target: 'name', value: 'x', type: 'string' }],
            };
            processBinding(variable, {});
            expect(variable.filterFields.name).toEqual({ value: 'x', type: 'string' });
        });

        it('fills the inputFields of a live write variable', () => {
            const variable: any = {
                name: 'v7', category: CATEGORY.LIVE, operation: 'insert', inputFields: {},
                dataBinding: [{ target: 'name', value: 'x' }],
            };
            processBinding(variable, {});
            expect(variable.inputFields.name).toBe('x');
        });

        it('does not invoke the variable for static bindings even when autoUpdate is set', () => {
            jest.useFakeTimers();
            const invoke = jest.fn();
            const variable: any = { name: 'v8', category: CATEGORY.SERVICE, autoUpdate: true, invoke, dataBinding: [{ target: 'a', value: 1 }] };
            processBinding(variable, {});
            jest.advanceTimersByTime(200);
            expect(invoke).not.toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('expression bindings', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('watches the expression without the bind: prefix and registers the destroy listener', () => {
            const scope = { registerDestroyListener: jest.fn() };
            const variable: any = { name: 'w1', category: CATEGORY.SERVICE, dataBinding: [{ target: 'a', value: 'bind:Widgets.name.datavalue' }] };
            processBinding(variable, scope);
            expect(watchMock.mock.calls[0][0]).toBe('Widgets.name.datavalue');
            expect(watchMock.mock.calls[0][1]).toBe(scope);
            expect(scope.registerDestroyListener).toHaveBeenCalled();
        });

        it('reports the muted state of the variable to the watcher', () => {
            const variable: any = { name: 'w2', category: CATEGORY.SERVICE, isMuted: true, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            expect(watchMock.mock.calls[0][7]()).toBe(true);
        });

        it('writes the new value to the target', () => {
            const variable: any = { name: 'w3', category: CATEGORY.SERVICE, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()('hello', undefined);
            expect(variable.dataBinding.a).toBe('hello');
        });

        it('ignores an undefined value that did not change', () => {
            const variable: any = { name: 'w4', category: CATEGORY.SERVICE, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()(undefined, undefined);
            expect(variable.dataBinding).toEqual({});
        });

        it('ignores a switch to undefined once the target already has a value', () => {
            const variable: any = { name: 'w5', category: CATEGORY.SERVICE, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()('first', undefined);
            listenerOf()(undefined, 'first');
            expect(variable.dataBinding.a).toBe('first');
        });

        it('clones object values but keeps blob and file values by reference', () => {
            const variable: any = {
                name: 'w6', category: CATEGORY.SERVICE,
                dataBinding: [{ target: 'obj', value: 'bind:x' }, { target: 'file', value: 'bind:y', type: 'blob' }],
            };
            processBinding(variable, {});
            const source = { a: 1 };
            const blob = { size: 1 };
            listenerOf(0)(source, undefined);
            listenerOf(1)(blob, undefined);
            expect(variable.dataBinding.obj).toEqual(source);
            expect(variable.dataBinding.obj).not.toBe(source);
            expect(variable.dataBinding.file).toBe(blob);
        });

        it('re-applies earlier computed nested bindings when their parent is recomputed', () => {
            const variable: any = {
                name: 'w7', category: CATEGORY.SERVICE,
                dataBinding: [{ target: 'dept.budget', value: 'bind:budget' }, { target: 'dept', value: 'bind:dept' }],
            };
            processBinding(variable, {});
            listenerOf(0)({ q1: 5 }, undefined);
            listenerOf(1)({ name: 'HR' }, undefined);
            expect(variable.dataBinding.dept).toEqual({ name: 'HR', budget: { q1: 5 } });
        });

        it('invokes a service variable once after a bound value changes', () => {
            const invoke = jest.fn();
            const variable: any = { name: 'w8', category: CATEGORY.SERVICE, autoUpdate: true, invoke, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()(1, undefined);
            listenerOf()(2, 1);
            jest.advanceTimersByTime(150);
            expect(invoke).toHaveBeenCalledTimes(1);
        });

        it('does not invoke when autoUpdate is off', () => {
            const invoke = jest.fn();
            const variable: any = { name: 'w9', category: CATEGORY.SERVICE, autoUpdate: false, invoke, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()(1, undefined);
            jest.advanceTimersByTime(150);
            expect(invoke).not.toHaveBeenCalled();
        });

        it('invokes a crud list variable', () => {
            const invoke = jest.fn();
            const variable: any = { name: 'w10', category: CATEGORY.CRUD, operationType: 'list', autoUpdate: true, invoke, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()(1, undefined);
            jest.advanceTimersByTime(150);
            expect(invoke).toHaveBeenCalledTimes(1);
        });

        it('does not invoke a crud variable that is not a list', () => {
            const invoke = jest.fn();
            const variable: any = { name: 'w11', category: CATEGORY.CRUD, operationType: 'create', autoUpdate: true, invoke, dataBinding: [{ target: 'a', value: 'bind:x' }] };
            processBinding(variable, {});
            listenerOf()(1, undefined);
            jest.advanceTimersByTime(150);
            expect(invoke).not.toHaveBeenCalled();
        });

        it('lists records of a live read variable and tracks the filter fields', () => {
            const listRecords = jest.fn();
            const variable: any = {
                name: 'w12', category: CATEGORY.LIVE, operation: 'read', autoUpdate: true, filterFields: {}, listRecords,
                dataBinding: [{ target: 'name', value: 'bind:x', type: 'string' }],
            };
            processBinding(variable, {});
            listenerOf()('abc', undefined);
            jest.advanceTimersByTime(150);
            expect(variable.filterFields.name).toEqual({ value: 'abc', type: 'string' });
            expect(listRecords).toHaveBeenCalledTimes(1);
        });

        it('copies a whole dataBinding object into the filter fields of a live read variable', () => {
            const variable: any = {
                name: 'w13', category: CATEGORY.LIVE, operation: 'read', filterFields: {},
                dataBinding: [{ target: 'dataBinding', value: 'bind:x' }],
            };
            processBinding(variable, {});
            listenerOf()({ a: 1, b: 2 }, undefined);
            expect(variable.filterFields).toEqual({ a: { value: 1 }, b: { value: 2 } });
        });

        it('calls the write record function of a live write variable', () => {
            const insertRecord = jest.fn().mockReturnValue(Promise.reject('ignored'));
            const variable: any = {
                name: 'w14', category: CATEGORY.LIVE, operation: 'insert', autoUpdate: true, inputFields: {}, insertRecord,
                dataBinding: [{ target: 'name', value: 'bind:x' }],
            };
            processBinding(variable, {});
            listenerOf()('abc', undefined);
            jest.advanceTimersByTime(150);
            expect(variable.inputFields.name).toBe('abc');
            expect(insertRecord).toHaveBeenCalledTimes(1);
        });

        it('replaces the input fields of a live write variable bound at dataBinding level', () => {
            const variable: any = {
                name: 'w15', category: CATEGORY.LIVE, operation: 'update', inputFields: {},
                dataBinding: [{ target: 'dataBinding', value: 'bind:x' }],
            };
            processBinding(variable, {});
            listenerOf()({ id: 1 }, undefined);
            expect(variable.inputFields).toEqual({ id: 1 });
        });
    });
});

describe('variables.utils - debounceVariableCall', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('coalesces rapid calls for the same variable into one', () => {
        const variable: any = { run: jest.fn() };
        debounceVariableCall(variable, 'run');
        debounceVariableCall(variable, 'run');
        debounceVariableCall(variable, 'run');
        jest.advanceTimersByTime(150);
        expect(variable.run).toHaveBeenCalledTimes(1);
    });

    it('swallows rejections of the invoked operation', async () => {
        const variable: any = { run: jest.fn().mockRejectedValue('boom') };
        debounceVariableCall(variable, 'run');
        jest.advanceTimersByTime(150);
        await Promise.resolve();
        expect(variable.run).toHaveBeenCalledTimes(1);
    });
});

describe('variables.utils - initiateCallback', () => {
    const notification = (message?: string) => ({
        getMessage: jest.fn().mockReturnValue(message),
        invoke: jest.fn(),
    });
    const contextWith = (action: any) => ({ Actions: { [VARIABLE_CONSTANTS.DEFAULT_VAR.NOTIFICATION]: action } });

    it('shows the error through the default notification when no error handler is set', () => {
        const action = notification();
        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: contextWith(action) }, 'Something failed');
        expect(action.invoke).toHaveBeenCalledWith({ message: 'Something failed' }, undefined, undefined);
    });

    it('prefers the message configured on the notification action', () => {
        const action = notification('Configured');
        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: contextWith(action) }, 'Raw');
        expect(action.invoke).toHaveBeenCalledWith({ message: 'Configured' }, undefined, undefined);
    });

    it('falls back to a generic message for non string errors', () => {
        const action = notification();
        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: contextWith(action) }, { code: 500 });
        expect(action.invoke).toHaveBeenCalledWith({ message: 'An error has occured. Please check the app logs.' }, undefined, undefined);
    });

    it('does not notify when the default notification is skipped, an error handler exists, or the action is missing', () => {
        const action = notification();
        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: contextWith(action) }, 'x', undefined, true);
        initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { onError: 'handler()', _context: { ...contextWith(action), handler: jest.fn() } }, 'x');
        expect(action.invoke).not.toHaveBeenCalled();
        expect(() => initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: { Actions: {} } }, 'x')).not.toThrow();
    });

    it('passes variable, data and options to a handler', () => {
        const received: any[] = [];
        const variable: any = { onSuccess: 'handler(variable, data, options)', _context: { handler: (...args: any[]) => received.push(args) } };
        initiateCallback('onSuccess', variable, 'payload', { o: 1 });
        expect(received).toEqual([[variable, 'payload', { o: 1 }]]);
    });

    it('provides the data filter to onBeforeUpdate of a live read variable', () => {
        const received: any[] = [];
        const variable: any = {
            category: 'wm.LiveVariable', operation: 'read',
            onBeforeUpdate: 'handler(dataFilter)', _context: { handler: (v: any) => received.push(v) },
        };
        initiateCallback(VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE, variable, { f: 1 });
        expect(received).toEqual([{ f: 1 }]);
    });

    it('provides the input data to onBeforeUpdate of other variables', () => {
        const received: any[] = [];
        const variable: any = {
            category: 'wm.ServiceVariable',
            onBeforeUpdate: 'handler(inputData)', _context: { handler: (v: any) => received.push(v) },
        };
        initiateCallback(VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE, variable, { i: 1 });
        expect(received).toEqual([{ i: 1 }]);
    });
});

describe('variables.utils - setInput file and number types', () => {
    it('converts file input values to a blob with the content type', () => {
        const target = setInput({}, 'doc', 'text', { type: 'file', contentType: 'text/csv' });
        expect(target.doc).toBeInstanceOf(Blob);
        expect(target.doc.type).toBe('text/csv');
    });

    it('keeps numeric values as numbers', () => {
        expect(setInput({}, 'n', 5, { type: 'number' }).n).toBe(5);
    });
});

describe('variables.utils - formatDate edge cases', () => {
    const transform = jest.fn().mockReturnValue('formatted');

    beforeEach(() => {
        transform.mockClear();
        setDependency('appManager', { getPipe: () => ({ transform }) });
    });

    it('formats Date objects', () => {
        expect(formatDate(new Date(1700000000000), 'date')).toBe('formatted');
        expect(transform).toHaveBeenCalledWith(1700000000000, expect.any(String));
    });

    it('formats numeric strings as epoch values', () => {
        formatDate('1700000000000', 'datetime');
        expect(transform).toHaveBeenCalledWith(1700000000000, expect.any(String));
    });

    it('returns the epoch itself for timestamp types', () => {
        expect(formatDate(1700000000000, 'timestamp')).toBe(1700000000000);
    });

    it('returns NaN for invalid dates of non time types', () => {
        expect(formatDate('not a date', 'date')).toBeNaN();
    });

    it('builds an epoch for time only values', () => {
        formatDate('10:30:00', 'time');
        expect(transform).toHaveBeenCalledWith(expect.any(Number), expect.any(String));
    });

    it('returns undefined for an undefined value', () => {
        expect(formatDate(undefined, 'date')).toBeUndefined();
    });
});

describe('variables.utils - decodeData extra paths', () => {
    beforeAll(() => {
        (window as any).he = { unescape: (str: string) => str.replace(/&amp;/g, '&') };
    });

    it('decodes plain strings inside arrays and objects nested in arrays', () => {
        const data: any[] = ['a &amp; b', { k: 'c &amp; d', nested: { x: 'e &amp; f' } }];
        decodeData(data);
        expect(data[1].k).toBe('c & d');
        expect(data[1].nested.x).toBe('e & f');
    });

    it('returns a decoded string for string input', () => {
        expect(decodeData('x &amp; y')).toBe('x & y');
    });
});

describe('variables.utils - simulateFileDownload', () => {
    let createObjectURL: jest.Mock;
    let revokeObjectURL: jest.Mock;
    let click: jest.SpyInstance;
    let open: jest.SpyInstance;
    const headersOf = (map: any) => ({ get: (name: string) => map[name] });

    beforeEach(() => {
        jest.useFakeTimers();
        createObjectURL = jest.fn(() => 'blob:download');
        revokeObjectURL = jest.fn();
        (window.URL as any).createObjectURL = createObjectURL;
        (window.URL as any).revokeObjectURL = revokeObjectURL;
        click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        open = jest.spyOn(window, 'open').mockReturnValue({} as any);
    });

    afterEach(() => {
        jest.useRealTimers();
        click.mockRestore();
        open.mockRestore();
        delete (window.navigator as any).msSaveBlob;
        delete (window.URL as any).createObjectURL;
        delete (window.URL as any).revokeObjectURL;
        document.body.innerHTML = '';
    });

    describe('through an anchor (request has headers)', () => {
        const request = () => ({ url: '/export', method: 'POST', headers: { 'X-A': '1' }, data: 'd', dataParams: 'dp' });

        it('sends the request with a default content type and downloads the named file', async () => {
            const http = {
                send: jest.fn().mockResolvedValue({
                    body: 'file-content',
                    headers: headersOf({ 'Content-Disposition': 'attachment; filename="report.csv"', 'Content-Type': 'text/csv' }),
                }),
            };
            setDependency('http', http);
            const success = jest.fn();
            const req = request();

            simulateFileDownload(req, 'report', 'CSV', success, jest.fn(), undefined);
            await Promise.resolve();
            jest.advanceTimersByTime(900);
            jest.advanceTimersByTime(500);

            const sent = http.send.mock.calls[0][0];
            expect(sent.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(sent.data).toBe('dp');
            expect(sent.responseType).toBe('arraybuffer');
            const anchor = document.querySelector('a[download]') as HTMLAnchorElement;
            expect(anchor.download).toBe('report.csv');
            expect(click).toHaveBeenCalled();
            expect(success).toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
        });

        it('opens the blob in a new window when the response has no file name', async () => {
            setDependency('http', { send: jest.fn().mockResolvedValue({ body: 'x', headers: headersOf({ 'Content-Type': 'text/plain' }) }) });
            const success = jest.fn();

            simulateFileDownload(request(), 'report', 'CSV', success, jest.fn(), undefined);
            await Promise.resolve();
            jest.advanceTimersByTime(900);
            jest.advanceTimersByTime(500);

            expect(open).toHaveBeenCalledWith('blob:download', '_blank');
            expect(success).toHaveBeenCalled();
        });

        it('calls the error callback when the request fails', async () => {
            setDependency('http', { send: jest.fn().mockRejectedValue('network') });
            const error = jest.fn();

            simulateFileDownload(request(), 'report', 'CSV', jest.fn(), error, undefined);
            await Promise.resolve();
            await Promise.resolve();

            expect(error).toHaveBeenCalledWith('network');
        });

        it('uses msSaveBlob when it is available', async () => {
            (window.navigator as any).msSaveBlob = jest.fn().mockReturnValue(true);
            setDependency('http', { send: jest.fn().mockResolvedValue({ body: 'x', headers: headersOf({}) }) });
            const success = jest.fn();

            simulateFileDownload(request(), 'report', 'CSV', success, jest.fn(), undefined);
            await Promise.resolve();
            jest.advanceTimersByTime(900);
            jest.advanceTimersByTime(500);

            expect((window.navigator as any).msSaveBlob).toHaveBeenCalledTimes(1);
            expect(success).toHaveBeenCalledTimes(1);
            expect(createObjectURL).not.toHaveBeenCalled();
        });

        it('reports an error when msSaveBlob fails', async () => {
            (window.navigator as any).msSaveBlob = jest.fn().mockReturnValue(false);
            setDependency('http', { send: jest.fn().mockResolvedValue({ body: 'x', headers: headersOf({}) }) });
            const error = jest.fn();

            simulateFileDownload(request(), 'report', 'CSV', jest.fn(), error, undefined);
            await Promise.resolve();
            jest.advanceTimersByTime(900);

            expect(error).toHaveBeenCalledTimes(1);
        });
    });

    describe('through an iframe (request without headers)', () => {
        let submit: jest.SpyInstance;

        beforeEach(() => {
            submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
        });

        afterEach(() => {
            submit.mockRestore();
        });

        const formInputs = () => {
            const iframe = document.getElementById('fileDownloadIFrame') as HTMLIFrameElement;
            const inputs = iframe.contentDocument!.querySelectorAll('form#fileDownloadForm input');
            return Array.from(inputs).reduce((acc: any, el: any) => ({ ...acc, [el.name]: el.value }), {});
        };

        it('builds a hidden form from the request data and reports success after the timeout', () => {
            const success = jest.fn();
            simulateFileDownload({ url: '/export', method: 'POST', headers: {}, data: 'a=1&b=two%20words' }, 'f', 'CSV', success, jest.fn(), undefined);

            expect(document.getElementById('fileDownloadIFrame')).not.toBeNull();
            jest.advanceTimersByTime(100);

            expect(submit).toHaveBeenCalled();
            expect(formInputs()).toEqual({ a: '1', b: 'two words' });
            jest.advanceTimersByTime(2000);
            expect(success).toHaveBeenCalledTimes(1);
        });

        it('uses the query string and data binding values for GET requests', () => {
            simulateFileDownload({ url: '/export?x=1&y=2', method: 'GET', headers: {}, data: '' }, 'f', 'CSV', jest.fn(), jest.fn(), undefined);
            jest.advanceTimersByTime(100);
            expect(formInputs()).toEqual({ x: '1', y: '2' });
        });

        it('falls back to the data binding when there is no request data', () => {
            simulateFileDownload({ url: '/export', method: 'POST', headers: {}, data: '' }, 'f', 'CSV', jest.fn(), jest.fn(), { from: 'binding' });
            jest.advanceTimersByTime(100);
            expect(formInputs()).toEqual({ from: 'binding' });
        });

        it('removes a previous iframe and collapses a double slash in the url', () => {
            simulateFileDownload({ url: 'a//b', method: 'POST', headers: {}, data: 'k=v' }, 'f', 'CSV', jest.fn(), jest.fn(), undefined);
            simulateFileDownload({ url: 'a//b', method: 'POST', headers: {}, data: 'k=v' }, 'f', 'CSV', jest.fn(), jest.fn(), undefined);
            expect(document.querySelectorAll('#fileDownloadIFrame').length).toBe(1);
            jest.advanceTimersByTime(100);
            const iframe = document.getElementById('fileDownloadIFrame') as HTMLIFrameElement;
            expect(iframe.contentDocument!.querySelector('form')!.getAttribute('action')).toBe('a/b');
        });

        it('reports the parsed error when the iframe loads an error document', () => {
            const error = jest.fn();
            const success = jest.fn();
            simulateFileDownload({ url: '/export', method: 'POST', headers: {}, data: 'k=v' }, 'f', 'CSV', success, error, undefined);
            jest.advanceTimersByTime(100);

            const iframe = document.getElementById('fileDownloadIFrame') as HTMLIFrameElement;
            iframe.contentDocument!.body.innerHTML = '{"message":"failed"}';
            $(iframe).trigger('load');
            $(iframe).trigger('load');
            jest.advanceTimersByTime(2500);

            expect(error).toHaveBeenCalledTimes(1);
            expect(error).toHaveBeenCalledWith({ error: { message: 'failed' } });
            expect(success).not.toHaveBeenCalled();
        });

        it('passes an empty message when the error document is not json', () => {
            const error = jest.fn();
            simulateFileDownload({ url: '/export', method: 'POST', headers: {}, data: 'k=v' }, 'f', 'CSV', jest.fn(), error, undefined);
            jest.advanceTimersByTime(100);
            const iframe = document.getElementById('fileDownloadIFrame') as HTMLIFrameElement;
            iframe.contentDocument!.body.innerHTML = 'plain error';
            $(iframe).trigger('load');
            expect(error).toHaveBeenCalledWith('');
        });
    });
});
