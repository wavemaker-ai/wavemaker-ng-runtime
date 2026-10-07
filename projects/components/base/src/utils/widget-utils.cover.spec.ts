import { getConditionalClasses, getWatchIdentifier, prepareFieldDefs } from './widget-utils';

describe('widget-utils remaining branches', () => {
    it('getWatchIdentifier joins its arguments with underscores', () => {
        expect(getWatchIdentifier('widget', 'name', 3)).toBe('widget_name_3');
        expect(getWatchIdentifier()).toBe('');
    });

    describe('getConditionalClasses', () => {
        it('yields no classes to add or remove when the toAdd/toRemove values are plain strings of an object', () => {
            const res = getConditionalClasses({ toAdd: 'abc', toRemove: 'xyz' });
            expect(res.toAdd).toBeUndefined();
            expect(res.toRemove).toBeUndefined();
        });

        it('evaluates object maps for add and remove', () => {
            const res = getConditionalClasses({ toAdd: { 'a b': true, c: false }, toRemove: { d: 1 } });
            expect(res).toEqual({ toAdd: ['a', 'b'], toRemove: ['d'] });
        });

        it('uses the old value as the classes to remove for string values', () => {
            expect(getConditionalClasses('new', 'old')).toEqual({ toAdd: ['new'], toRemove: ['old'] });
            expect(getConditionalClasses('', undefined)).toEqual({ toAdd: [], toRemove: [] });
        });
    });

    describe('prepareFieldDefs', () => {
        it('keeps the full dotted name for related fields that stay a single word', () => {
            const defs: any[] = prepareFieldDefs({ 'dept.name': 'x' }, { noModifyTitle: true }) as any;
            expect(defs).toHaveLength(1);
            expect(defs[0].displayName).toBe('dept.name');
            expect(defs[0].relatedTable).toBe('dept');
            expect(defs[0].relatedField).toBe('name');
        });

        it('does not list an object node once the column limit has been reached', () => {
            const res: any = prepareFieldDefs({ a: 1, b: { c: 2 } }, { upperBound: 1, filter: 'all' });
            expect(res.terminals.map(t => t.field)).toEqual(['a']);
            expect(res.objects).toEqual([]);
        });
    });
});
