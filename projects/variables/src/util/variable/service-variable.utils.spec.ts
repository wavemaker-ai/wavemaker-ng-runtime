import { ServiceVariableUtils } from './service-variable.utils';
import { $rootScope } from '../../constants/variables.constants';

describe('ServiceVariableUtils', () => {
    describe('isFileUploadRequest', () => {
        it('should return true only for FileService uploadFile operations', () => {
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'FileService', operation: 'uploadFile' })).toBe(true);
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'FileService', operation: 'download' })).toBe(false);
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'OtherService', operation: 'uploadFile' })).toBe(false);
        });
    });

    describe('excludePaginationParams', () => {
        it('should filter out page/size/sort param names', () => {
            const params = [{ name: 'page' }, { name: 'size' }, { name: 'sort' }, { name: 'q' }];
            expect(ServiceVariableUtils.excludePaginationParams(params)).toEqual(['q']);
        });

        it('should return an empty array when all params are pagination params', () => {
            const params = [{ name: 'page' }, { name: 'size' }];
            expect(ServiceVariableUtils.excludePaginationParams(params)).toEqual([]);
        });
    });

    describe('constructRequestParams', () => {
        const variable = { getPrefabName: () => undefined, serviceType: 'RestService' };

        beforeEach(() => {
            ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        });

        it('should return a USER_UNAUTHORISED error when operationInfo is null', () => {
            const result = ServiceVariableUtils.constructRequestParams(variable, null, {});
            expect(result.error.type).toBe('user_unauthorised');
        });

        it('should return a METADATA_MISSING error when operationInfo is empty', () => {
            const result = ServiceVariableUtils.constructRequestParams(variable, {}, {});
            expect(result.error.type).toBe('metadata_missing');
        });

        it('should return a CRUD_OPERATION_MISSING error when operationInfo is invalid', () => {
            const result = ServiceVariableUtils.constructRequestParams(variable, { invalid: true }, {});
            expect(result.error.type).toBe('crud_operation_missing');
        });

        it('should build a GET request url with query params for a direct (non-proxy) call', () => {
            const operationInfo: any = {
                directPath: 'http://host/api/employees',
                relativePath: '/api/employees',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'name', parameterType: 'query', sampleValue: 'ram' },
                ],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, { name: 'ram' });
            expect(result.url).toBe('http://host/api/employees?name=ram');
            expect(result.method).toBe('GET');
            expect(result.isDirectCall).toBe(true);
        });

        it('should report missing required params as an error', () => {
            const operationInfo: any = {
                directPath: 'http://host/api/employees',
                relativePath: '/api/employees',
                httpMethod: 'POST',
                proxySettings: { web: false },
                parameters: [
                    { name: 'id', parameterType: 'query', required: true },
                ],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, {});
            expect(result.error.type).toBe('required_field_missing');
        });

        it('should replace path params using the relative path regex', () => {
            const operationInfo: any = {
                directPath: 'http://host/api/employees/{id}',
                relativePath: '/api/employees/{id}',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'id', parameterType: 'path', sampleValue: '42' },
                ],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, {});
            expect(result.url).toBe('http://host/api/employees/42');
        });

        it('should set header params directly on the headers object', () => {
            const operationInfo: any = {
                directPath: 'http://host/api/employees',
                relativePath: '/api/employees',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'X-Trace', parameterType: 'header', sampleValue: 'trace-1' },
                ],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, {});
            expect(result.headers['X-Trace']).toBe('trace-1');
        });

        it('should set a plain BODY param as the requestBody for non query/procedure calls', () => {
            const operationInfo: any = {
                directPath: 'http://host/api/employees',
                relativePath: '/api/employees',
                httpMethod: 'POST',
                proxySettings: { web: false },
                parameters: [
                    { name: 'body', parameterType: 'body', sampleValue: { name: 'ram' } },
                ],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, {});
            expect(result.data).toEqual({ name: 'ram' });
        });

        it('should prefix the url with "services" and the deployedUrl for a proxy call', () => {
            const operationInfo: any = {
                basePath: '',
                relativePath: '/api/employees',
                httpMethod: 'GET',
                proxySettings: { web: true },
                skipCloakHeaders: true,
                parameters: [],
            };
            const result = ServiceVariableUtils.constructRequestParams(variable, operationInfo, {});
            expect(result.url).toBe('http://host/services/api/employees');
            expect(result.isDirectCall).toBe(false);
        });
    });
});
