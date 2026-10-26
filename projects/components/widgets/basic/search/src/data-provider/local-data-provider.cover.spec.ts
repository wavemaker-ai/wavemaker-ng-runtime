import { LocalDataProvider } from './local-data-provider';

describe('LocalDataProvider - cover', () => {
    const provider = new LocalDataProvider();

    it('matches numeric entries case sensitively by their string form', async () => {
        const res = await provider.filter({ dataset: [12, 31, 125], query: '12', casesensitive: true } as any);
        expect(res.data).toEqual([12, 125]);
        expect(res.hasMoreData).toBe(false);
        expect(res.isLastPage).toBe(true);
    });

    it('keeps the case of the query for object entries when case sensitive', async () => {
        const dataset = [{ name: 'Alpha' }, { name: 'alpha' }];
        const res = await provider.filter({ dataset, query: 'Alp', casesensitive: true } as any);
        expect(res.data).toEqual([{ name: 'Alpha' }]);
    });

    it('ignores case for object entries by default', async () => {
        const dataset = [{ name: 'Alpha' }, { name: 'beta' }];
        const res = await provider.filter({ dataset, query: 'ALP' } as any);
        expect(res.data).toEqual([{ name: 'Alpha' }]);
    });

    it('applies the match mode to case sensitive primitive entries', async () => {
        const res = await provider.filter({ dataset: ['Apple', 'apple', 'pineapple'], query: 'apple', casesensitive: true, matchMode: 'startignorecase' } as any);
        expect(res.data).toEqual(['apple']);
    });
});
