import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils', () => {
    describe('setPaginationQueryParams', () => {
        it('should set page sampleValue for the page/offset input param', () => {
            const operationInfo: any = { parameters: [{ name: 'page' }, { name: 'size' }] };
            const paginationInfo: any = { input: { page: 'page', size: 'size' } };
            const variable: any = { pagination: { page: 2, size: 10 } };
            PaginationUtils.setPaginationQueryParams(variable, operationInfo, paginationInfo);
            expect(operationInfo.parameters[0].sampleValue).toBe(2);
            expect(operationInfo.parameters[1].sampleValue).toBe(10);
        });

        it('should use the offset input param when pagination type is offset', () => {
            const operationInfo: any = { parameters: [{ name: 'offset' }] };
            const paginationInfo: any = { type: 'offset', input: { offset: 'offset', size: 'size' } };
            const variable: any = { pagination: { page: 5, size: 10 } };
            PaginationUtils.setPaginationQueryParams(variable, operationInfo, paginationInfo);
            expect(operationInfo.parameters[0].sampleValue).toBe(5);
        });
    });

    describe('setVariablePagination', () => {
        it('should initialize pagination and compute totalPages evenly', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 1, totalElements: 20 }, {});
            expect(variable.pagination.size).toBe(10);
            expect(variable.pagination.totalPages).toBe(2);
            expect(variable.pagination.first).toBe(true);
        });

        it('should round up totalPages when not evenly divisible', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 0, totalElements: 25 }, {});
            expect(variable.pagination.totalPages).toBe(3);
            expect(variable.pagination.first).toBe(true);
        });

        it('should set next/prev/first/last for cursor pagination', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, totalElements: 20, next: 'n', prev: 'p' }, {});
            expect(variable.pagination.next).toBe('n');
            expect(variable.pagination.prev).toBe('p');
            expect(variable.pagination.last).toBe(false);
            expect(variable.pagination.first).toBe(false);
        });

        it('should use options.page to compute the number field', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, totalElements: 10 }, { page: 3 });
            expect(variable.pagination.number).toBe(2);
        });
    });

    describe('setPaginationItems', () => {
        it('should resolve a $body expression via jmespath', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$body.total', { total: 42 }, res, 'totalElements', {});
            expect(res.totalElements).toBe(42);
        });

        it('should warn and not throw for an invalid $body expression', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const res: any = {};
            expect(() => PaginationUtils.setPaginationItems('$body.[invalid', {}, res, 'totalElements', {})).not.toThrow();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('should resolve a single-segment $header expression', () => {
            // JMESPath identifiers must be alphanumeric/underscore (no hyphens) to parse unquoted.
            // The header value must resolve to an array (as real multi-valued header entries do) -
            // the code unconditionally calls .join() on the resolved value.
            const res: any = {};
            const resHeaders = { headers: new Map([['total', ['100']]]) };
            PaginationUtils.setPaginationItems('$header.total', {}, res, 'totalElements', resHeaders);
            expect(res.totalElements).toBe('100');
        });

        it('should resolve a nested $header expression from a JSON header value', () => {
            const res: any = {};
            const resHeaders = { headers: new Map([['pageinfo', [JSON.stringify({ total: 7 })]]]) };
            PaginationUtils.setPaginationItems('$header.pageinfo.total', {}, res, 'totalElements', resHeaders);
            expect(res.totalElements).toBe(7);
        });

        it('should do nothing for an item that is neither $body nor $header', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$other.thing', {}, res, 'totalElements', {});
            expect(res.totalElements).toBeUndefined();
        });
    });

    describe('getPaginationInfo', () => {
        it('should return operationInfo.paginationInfo when present', () => {
            expect(PaginationUtils.getPaginationInfo({ paginationInfo: { a: 1 } }, {})).toEqual({ a: 1 });
        });

        it('should fall back to variable._paginationConfig', () => {
            expect(PaginationUtils.getPaginationInfo({}, { _paginationConfig: { b: 2 } })).toEqual({ b: 2 });
        });
    });

    describe('getOffsetInfo', () => {
        it('should compute offset from size and page', () => {
            const variable: any = { pagination: { size: 10 } };
            expect(PaginationUtils.getOffsetInfo(variable, { page: 3 })).toBe(20);
        });

        it('should default the multiplier to 1 when no page is given', () => {
            const variable: any = { pagination: { size: 10 } };
            expect(PaginationUtils.getOffsetInfo(variable, {})).toBe(10);
        });
    });

    describe('checkPaginationAtQuery', () => {
        it('should do nothing when there is no pagination on the variable', () => {
            const variable: any = { dataBinding: {} };
            expect(() => PaginationUtils.checkPaginationAtQuery({}, variable, { page: 2 })).not.toThrow();
            expect(variable.pagination).toBeUndefined();
        });

        it('should set pagination.page from options when a query param matches', () => {
            const operationInfo: any = {
                paginationInfo: { input: { page: 'page', size: 'size' } },
                parameters: [{ name: 'page', parameterType: 'query' }],
            };
            const variable: any = { dataBinding: { a: 1 }, pagination: { page: 1, size: 10 } };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, { page: 4 });
            expect(variable.pagination.page).toBe(4);
        });

        it('should not update pagination.page when dataBinding is empty', () => {
            const operationInfo: any = {
                paginationInfo: { input: { page: 'page', size: 'size' } },
                parameters: [{ name: 'page', parameterType: 'query' }],
            };
            const variable: any = { dataBinding: {}, pagination: { page: 1, size: 10 } };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, { page: 4 });
            expect(variable.pagination.page).toBe(1);
        });
    });

    describe('setParameterVal', () => {
        it('should set res[paramName] from the matching parameter sampleValue', () => {
            const operationInfo: any = {
                paginationInfo: { input: { size: 'size' } },
                parameters: [{ name: 'size', sampleValue: 25 }],
            };
            const res: any = {};
            PaginationUtils.setParameterVal('size', res, operationInfo, {});
            expect(res.size).toBe(25);
        });
    });

    describe('setPaginationAtReq', () => {
        it('should set header page/size when the matched param is a header', () => {
            const paginationInfo: any = { input: { page: 'page', size: 'size' } };
            const operationInfo: any = { parameters: [{ name: 'page', parameterType: 'header' }] };
            const variable: any = { pagination: { page: 2, size: 10 } };
            const resp = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, undefined, 'url', {});
            expect(resp['headers']['page']).toBe('2');
        });

        it('should set the body page field when the matched param is a body param with an existing sample value', () => {
            // bodyVal?.[bodyParam] gates this branch: the sample body must already have a truthy
            // value at the *second* segment of paginationInfo.input[inputParam] (a pre-existing
            // "does this field exist" check), e.g. input 'body.num' checks sampleValue.num.
            const paginationInfo: any = { input: { page: 'body.num', size: 'body.size' } };
            const operationInfo: any = { parameters: [{ name: 'body', parameterType: 'body', sampleValue: JSON.stringify({ num: 1, size: 1 }) }] };
            const variable: any = { pagination: { page: 3, size: 10 } };
            const resp = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, undefined, 'url', {});
            const body = JSON.parse(resp['requestBody']);
            expect(body.num).toBe(3);
        });

        it('should return an empty object when no param matches and pagination has no next', () => {
            const paginationInfo: any = { input: { page: 'page', size: 'size' } };
            const operationInfo: any = { parameters: [] };
            const variable: any = { pagination: { page: 1, size: 10 } };
            const resp = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, undefined, 'url', {});
            expect(resp).toEqual({});
        });

        it('should rewrite a query-based cursor URL using pagination.next', () => {
            // The param matched for the cursor rewrite is looked up by the *pagination input*
            // key name (paginationInfo.input.page), not by any "cursor"-named parameter.
            const paginationInfo: any = { input: { page: 'page', size: 'size' } };
            const operationInfo: any = { parameters: [{ name: 'page', parameterType: 'query' }] };
            const variable: any = { pagination: { next: 'a?cursor=2', isNext: true } };
            const resp = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, undefined, 'base?cursor=1', {});
            expect(resp['url']).toBe('base?cursor=2');
        });
    });

    describe('generatePaginationRes', () => {
        it('should build a non-cursor res object using output metadata', () => {
            const operationInfo: any = { parameters: [] };
            const paginationInfo: any = {
                output: { size: '$body.size', page: '$body.page', totalElements: '$body.total' },
            };
            const response = { size: 10, page: 1, total: 30 };
            const res = PaginationUtils.generatePaginationRes(operationInfo, paginationInfo, response, {}, {}, { pagination: {} });
            expect(res).toEqual({ size: 10, page: 1, totalElements: 30, hasMoreItems: '' });
        });

        it('should compute totalElements from size*page when no totalElements output is defined', () => {
            const operationInfo: any = { parameters: [] };
            const paginationInfo: any = { input: {}, output: { size: '$body.size', page: '$body.page' } };
            const response = { size: 5, page: 2 };
            const res = PaginationUtils.generatePaginationRes(operationInfo, paginationInfo, response, {}, {}, { pagination: {} });
            expect(res['totalElements']).toBe(11);
        });

        it('should build a cursor res object with next/prev', () => {
            const operationInfo: any = { parameters: [] };
            const paginationInfo: any = { output: { next: '$body.next', prev: '$body.prev' } };
            const response = { next: 'n', prev: 'p' };
            const res = PaginationUtils.generatePaginationRes(operationInfo, paginationInfo, response, {}, {}, {});
            expect(res).toEqual({ next: 'n', prev: 'p' });
        });
    });
});
