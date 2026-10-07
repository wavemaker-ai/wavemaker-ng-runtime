import { $parseEvent } from '@wm/core';
import { getOrderedDataset, groupData, toggleAllHeaders, transformFormData } from './form-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getFormattedDate: jest.fn((_pipe: any, _value: any, format: string) => `fmt:${format}`),
    $parseEvent: jest.fn(),
}));

describe('form-utils - cover branches', () => {
    afterEach(() => jest.restoreAllMocks());

    it('orders by fields nested in the inner item', () => {
        const data = [{ dataObject: { n: 2 } }, { dataObject: { n: 1 } }];
        const result = getOrderedDataset(data, 'n:asc', 'dataObject');
        expect(result.map((r: any) => r.dataObject.n)).toEqual([1, 2]);
    });

    describe('transformFormData', () => {
        it('uses the row itself for user defined group by functions on primitive values', () => {
            const fn = jest.fn().mockImplementation((_ctx: any, locals: any) => 'g-' + locals.row.value);
            ($parseEvent as jest.Mock).mockReturnValue(fn);
            const items: any[] = transformFormData({}, ['a', 'b'], undefined, {}, 1, { widgetType: 'wm-search', groupby: 'fn(row)' });
            expect(items.map(i => i.groupby)).toEqual(['g-a', 'g-b']);
        });

        it('gives an empty label to null primitive values', () => {
            const items: any[] = transformFormData({}, [null, 'x'], undefined, {}, 1);
            expect(items.map(i => i.label)).toEqual(['', 'x']);
        });

        it('gives an empty label to null values of an object data set', () => {
            const items: any[] = transformFormData({}, { a: null, b: 'B' }, undefined, {}, 1);
            expect(items.map(i => i.label)).toEqual(['', 'B']);
        });

        it('omits records whose data field is missing and keeps an empty label for null display values', () => {
            const items: any[] = transformFormData({}, [{ id: 1, name: null }, { name: 'skipped' }], 'id', { displayField: 'name' }, 1);
            expect(items.length).toBe(1);
            expect(items[0].key).toBe(1);
            expect(items[0].label).toBe('');
        });
    });

    describe('groupData', () => {
        it('groups by a field of the inner item', () => {
            const data = [{ dataObject: { t: 'b' } }, { dataObject: { t: 'a' } }, { dataObject: { t: 'b' } }];
            const result = groupData({}, data, 't', '', '', '', null, 'dataObject');
            expect((result as any[]).map(g => g.key)).toEqual(['a', 'b']);
            expect((result as any[])[1].data.length).toBe(2);
        });

        it('keeps invalid hour values as their own group', () => {
            const data = [{ when: 'not a time' }];
            const result = groupData({}, data, 'when', 'hour', '', 'hh:mm a', {} as any, undefined, { timeFormat: 'hh:mm a' });
            expect((result as any[]).length).toBe(1);
        });
    });

    describe('toggleAllHeaders', () => {
        it('copes with a missing icon collection', () => {
            const orig = (global as any).$;
            const toggle = jest.fn();
            const groups: any = { find: jest.fn((sel: string) => (sel === '.group-list-item' ? { toggle } : undefined)) };
            (global as any).$ = jest.fn(() => ({ find: jest.fn(() => groups) }));
            try {
                expect(() => toggleAllHeaders({ nativeElement: {} })).not.toThrow();
                expect(toggle).toHaveBeenCalled();
            } finally {
                (global as any).$ = orig;
            }
        });
    });

    it('falls back to the global moment when the module has no default export', () => {
        const realMoment = jest.requireActual('moment');
        (window as any).moment = realMoment;
        jest.isolateModules(() => {
            jest.doMock('moment', () => ({ __esModule: true }));
            const mod = require('./form-utils');
            expect(typeof mod.groupData).toBe('function');
        });
        jest.dontMock('moment');
    });
});
