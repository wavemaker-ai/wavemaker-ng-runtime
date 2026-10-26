import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils - cover branches', () => {
    describe('setPaginationQueryParams', () => {
        it('leaves parameters that are neither the page nor the size untouched', () => {
            const operationInfo = { parameters: [{ name: 'filter', sampleValue: 'x' }, { name: 'page', sampleValue: 0 }, { name: 'size', sampleValue: 0 }] };
            const variable = { pagination: { page: 3, size: 25 } };
            PaginationUtils.setPaginationQueryParams(variable, operationInfo, { input: { page: 'page', size: 'size' } });
            expect(operationInfo.parameters.map(p => p.sampleValue)).toEqual(['x', 3, 25]);
        });
    });

    describe('setVariablePagination', () => {
        it('keeps and updates the existing pagination object', () => {
            const existing: any = { empty: true, custom: 'keep' };
            const variable: any = { pagination: existing };
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 2, totalElements: 25, hasMoreItems: '' }, { page: 2 });
            expect(variable.pagination).toBe(existing);
            expect(existing.custom).toBe('keep');
            expect(existing.totalPages).toBe(3);
            expect(existing.number).toBe(1);
        });

        it('marks the first page for cursor pagination without a previous cursor', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 0, totalElements: 10, next: 'n2' }, {});
            expect(variable.pagination.first).toBe(true);
            expect(variable.pagination.last).toBe(false);
            expect(variable.pagination.prev).toBeUndefined();
        });

        it('is not the first page for cursor pagination with a previous cursor', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 0, totalElements: 10, next: 'n2', prev: 'p1' }, {});
            expect(variable.pagination.first).toBe(false);
        });
    });

    describe('generatePaginationRes', () => {
        it('derives the total of offset pagination from the size when no page option is given', () => {
            const parameters = [{ name: 'size', sampleValue: 10 }];
            const info: any = { type: 'offset', input: { offset: 'offset', size: 'size' }, output: {} };
            const res: any = PaginationUtils.generatePaginationRes({ parameters, paginationInfo: info }, info, {}, undefined, {}, {});
            expect(res.totalElements).toBe(11);
        });
    });
});
