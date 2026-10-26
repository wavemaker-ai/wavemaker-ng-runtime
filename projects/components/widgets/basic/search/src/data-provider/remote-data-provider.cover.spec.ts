import { RemoteDataProvider } from './remote-data-provider';
import { DataSource } from '@wm/core';

jest.mock('@wm/core');
jest.mock('@wm/components/base');

describe('RemoteDataProvider (cover)', () => {
    let provider: any;
    let datasource: any;

    beforeEach(() => {
        provider = new RemoteDataProvider();
        datasource = { execute: jest.fn() };
    });

    it('falls through to SEARCH_RECORDS when dataoptions has neither relatedField nor distinctField', () => {
        datasource.execute.mockReturnValueOnce({}).mockReturnValueOnce('searched');
        const config: any = { datasource, dataoptions: {} };
        expect(provider.filterData(config)).toBe('searched');
        expect(datasource.execute).toHaveBeenLastCalledWith(DataSource.Operation.SEARCH_RECORDS, config);
    });

    it('uses pagesize for the distinct call when no limit is configured', () => {
        datasource.execute.mockReturnValueOnce({ filterFields: {} }).mockReturnValueOnce('distinct');
        const config: any = { datasource, pagesize: 7, page: 2, dataoptions: { distinctField: 'f', tableName: 't' } };
        expect(provider.filterData(config)).toBe('distinct');
        expect(datasource.execute.mock.calls[1][1]).toEqual(expect.objectContaining({ pagesize: 7, page: 2, fields: 'f', entityName: 't' }));
    });

    it('treats a negative data size as having zero pages', () => {
        expect(provider.isLast(0, -1, 10, 5)).toBe(true);
        expect(provider.isLast(1, -1, 10, 5)).toBe(false);
    });

    it('resolves the data as is when there is no data expression', async () => {
        datasource.execute.mockReturnValue(false);
        const res = await provider.onFilterSuccess({ datasource, binddataset: '' }, { data: [{ a: 1 }] });
        expect(res.data).toEqual([{ a: 1 }]);
    });
});
