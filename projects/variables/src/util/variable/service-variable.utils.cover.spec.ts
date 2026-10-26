import { $rootScope } from '../../constants/variables.constants';
import { ServiceVariableUtils } from './service-variable.utils';
import { PaginationUtils } from './pagination.utils';
import { setDependency } from './variables.utils';

jest.mock('./../oAuth.utils', () => ({
    getAccessToken: jest.fn(),
}));

const build = (variable: any, operationInfo: any, inputFields: any = {}, options?: any) =>
    ServiceVariableUtils.constructRequestParams(variable, operationInfo, inputFields, options);

describe('ServiceVariableUtils.constructRequestParams - cover', () => {
    const variable = (overrides: any = {}) => ({ getPrefabName: () => undefined, serviceType: 'RestService', ...overrides });
    const direct = (overrides: any = {}) => ({
        directPath: 'http://host/api',
        relativePath: '/api',
        httpMethod: 'GET',
        proxySettings: { web: false },
        parameters: [],
        ...overrides,
    });

    beforeEach(() => {
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        setDependency('appManager', { getPipe: () => ({ transform: (v: any) => `formatted-${v}` }) });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('treats a missing variable as an empty one when the operation info is unauthorised', () => {
        expect(build(null, null).error.type).toBe('user_unauthorised');
    });

    describe('defaults for proxy settings and method', () => {
        it('defaults to a web proxy call and uses methodType when httpMethod is absent', () => {
            const info: any = { relativePath: '/api', methodType: 'POST', parameters: [] };
            const result = build(variable(), info);
            expect(info.proxySettings).toEqual({ web: true, mobile: false });
            expect(result.method).toBe('POST');
            expect(result.url).toBe('http://host/services/api');
            expect(result.isDirectCall).toBe(false);
        });

        it('copes with an operation that has no method at all and a url-encoded body', () => {
            const info: any = {
                relativePath: '/api', proxySettings: { web: false }, directPath: 'http://h/x', consumes: ['application/x-www-form-urlencoded'],
                parameters: [{ name: 'q', parameterType: 'query', sampleValue: 'v' }],
            };
            const result = build(variable(), info);
            expect(result.method).toBeUndefined();
            expect(result.data).toBe('q=v');
            expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });

        it('keeps the url free of a query string when a url-encoded request has no query params', () => {
            const info = direct({ httpMethod: 'POST', consumes: ['application/x-www-form-urlencoded'] });
            const result = build(variable(), info);
            expect(result.url).toBe('http://host/api');
            expect(result.data).toBeUndefined();
            expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });
    });

    describe('required params reported by id', () => {
        it('falls back to the param id when a missing required param has no name', () => {
            const result = build(variable(), direct({ parameters: [{ id: 'p-id', parameterType: 'query', required: true }] }));
            expect(result.error.field).toBe('p-id');
        });

        it('falls back to the field id for a missing required body field of a query variable', () => {
            const queryVar = variable({ controller: 'QueryExecution', serviceType: 'DataService', operationType: 'post' });
            const info = direct({
                httpMethod: 'POST',
                definitions: { Body: [{ id: 'fieldId', type: 'string', required: true }] },
                parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: {} }],
            });
            const result = build(queryVar, info, { body: {} });
            expect(result.error.field).toBe('fieldId');
        });
    });

    describe('null query params for body-type query/procedure variables', () => {
        const queryParamInfo = (value: any, extra: any = {}) => direct({
            httpMethod: 'POST',
            parameters: [{ name: 'tag', parameterType: 'query', type: 'string', sampleValue: value, ...extra }],
        });

        it('skips a null query param for a query variable', () => {
            const v = variable({ controller: 'QueryExecution', serviceType: 'DataService', operationType: 'post' });
            expect(build(v, queryParamInfo(null)).url).toBe('http://host/api');
        });

        it('skips null elements of a multi valued query param for a query variable', () => {
            const v = variable({ controller: 'QueryExecution', serviceType: 'DataService', operationType: 'post' });
            const info = queryParamInfo([null, 'x'], { collectionFormat: 'multi', type: 'integer' });
            expect(build(v, info).url).toBe('http://host/api?tag=x');
        });

        it('does not skip null query params for procedure variables', () => {
            const v = variable({ controller: 'ProcedureExecution', serviceType: 'DataService', operationType: 'post' });
            expect(build(v, queryParamInfo(null)).url).toBe('http://host/api?tag=null');
        });

        it('does not skip null elements for non-query data services', () => {
            const v = variable({ controller: 'ProcedureExecution', serviceType: 'DataService', operationType: 'post' });
            const info = queryParamInfo([null], { collectionFormat: 'multi', type: 'integer' });
            expect(build(v, info).url).toBe('http://host/api?tag=null');
        });
    });

    describe('api designer mode (no input fields) for body-type query variables', () => {
        const v = () => variable({ controller: 'QueryExecution', serviceType: 'DataService', operationType: 'post' });

        it('reads the child definitions of the param and an empty value when no sample value exists', () => {
            const info = direct({
                httpMethod: 'POST',
                parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: null, children: [{ name: 'a', type: 'string', required: true }] }],
            });
            const result = ServiceVariableUtils.constructRequestParams(v(), info, undefined);
            expect(result.error.field).toBe('a');
        });

        it('builds the body from the sample value of the param', () => {
            const info = direct({
                httpMethod: 'POST',
                parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: { a: 'x' }, children: [{ name: 'a', type: 'string' }] }],
            });
            const result = ServiceVariableUtils.constructRequestParams(v(), info, undefined);
            expect(result.data).toEqual({ a: 'x' });
        });
    });

    describe('form data', () => {
        const fileInfo = (value: any, extra: any = {}) => direct({
            httpMethod: 'POST',
            consumes: ['multipart/form-data'],
            parameters: [{ name: 'files', parameterType: 'formdata', sampleValue: value, type: 'file', ...extra }],
        });

        it('falls back to a blob for array file entries without content', () => {
            const data: FormData = build(variable(), fileInfo(['plain text'])).data;
            expect(data.getAll('files')).toHaveLength(1);
        });

        it('uses the content of array file entries when present', () => {
            const content = new Blob(['abc']);
            const data: FormData = build(variable(), fileInfo([{ content, name: 'a.txt' }])).data;
            expect((data.get('files') as File).name).toBe('a.txt');
        });

        it('does not build form data when file upload is not supported by the browser', () => {
            const original = (window as any).FileList;
            (window as any).FileList = undefined;
            try {
                const result = build(variable(), fileInfo([{ content: new Blob(['abc']), name: 'a.txt' }]));
                expect(result.data).toBeUndefined();
            } finally {
                (window as any).FileList = original;
            }
        });
    });

    describe('proxy calls', () => {
        it('leaves the url untouched for a prefab variable whose service type is not a supported rest service', () => {
            const v = variable({ serviceType: 'CustomService', getPrefabName: () => 'myPrefab' });
            const info: any = { relativePath: '/api', httpMethod: 'GET', parameters: [] };
            const result = build(v, info);
            expect(result.url).toBe('http://host//api');
            expect(result.target).toBeUndefined();
        });

        it('prefixes prefab rest services', () => {
            const v = variable({ getPrefabName: () => 'myPrefab' });
            const result = build(v, { relativePath: '/api', httpMethod: 'GET', parameters: [] });
            expect(result.url).toBe('http://host/prefabs/myPrefab/api');
            expect(result.target).toBe('invokePrefabRestService');
        });
    });

    describe('pagination', () => {
        const paged = () => variable({ pagination: true });
        const stubPagination = (resp: any) => {
            jest.spyOn(PaginationUtils, 'checkPaginationAtQuery').mockImplementation(() => {});
            jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue({} as any);
            return jest.spyOn(PaginationUtils, 'setPaginationAtReq').mockReturnValue(resp);
        };

        it('keeps the request unchanged when no pagination response is produced', () => {
            const spy = stubPagination(undefined);
            const result = build(paged(), direct());
            expect(spy).toHaveBeenCalled();
            expect(result.url).toBe('http://host/api');
        });

        it('applies pagination headers', () => {
            stubPagination({ headers: { 'X-Page': '2' } });
            expect(build(paged(), direct()).headers).toEqual({ 'X-Page': '2' });
        });

        it('applies a pagination request body', () => {
            stubPagination({ requestBody: { page: 2 } });
            expect(build(paged(), direct()).data).toEqual({ page: 2 });
        });

        it('applies a pagination url', () => {
            stubPagination({ url: 'http://host/api?page=2' });
            expect(build(paged(), direct()).url).toBe('http://host/api?page=2');
        });

        it('ignores a pagination response without headers, body or url', () => {
            stubPagination({});
            expect(build(paged(), direct()).url).toBe('http://host/api');
        });
    });
});
