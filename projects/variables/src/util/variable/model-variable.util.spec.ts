import {
    setData, getValue, setValue, getItem, setItem, addItem, removeItem, clearData, getCount,
} from './model-variable.util';

describe('model-variable.util', () => {
    describe('setData', () => {
        it('should return the existing dataSet when the new dataSet is falsy', () => {
            const variable: any = { dataSet: { a: 1 } };
            expect(setData(variable, null)).toEqual({ a: 1 });
        });

        it('should return the existing dataSet for a list variable when given a non-array dataset', () => {
            const variable: any = { isList: true, dataSet: [1, 2] };
            expect(setData(variable, { a: 1 })).toEqual([1, 2]);
        });

        it('should replace the dataSet otherwise', () => {
            const variable: any = { dataSet: { a: 1 } };
            expect(setData(variable, { b: 2 })).toEqual({ b: 2 });
            expect(variable.dataSet).toEqual({ b: 2 });
        });

        it('should accept an array dataset for a list variable', () => {
            const variable: any = { isList: true, dataSet: [] };
            expect(setData(variable, [1, 2, 3])).toEqual([1, 2, 3]);
        });
    });

    describe('getValue', () => {
        it('should get a keyed value from a plain-object dataSet', () => {
            const variable: any = { dataSet: { name: 'Ram' } };
            expect(getValue(variable, 'name', undefined)).toBe('Ram');
        });

        it('should get a keyed value from a list dataSet, defaulting index to 0', () => {
            const variable: any = { isList: true, dataSet: [{ name: 'Ram' }, { name: 'Shyam' }] };
            expect(getValue(variable, 'name', undefined)).toBe('Ram');
            expect(getValue(variable, 'name', 1)).toBe('Shyam');
        });
    });

    describe('setValue', () => {
        it('should return the dataSet unchanged when no key is given', () => {
            const variable: any = { dataSet: { a: 1 } };
            expect(setValue(variable, undefined, 'x')).toEqual({ a: 1 });
        });

        it('should return the dataSet unchanged for a list variable', () => {
            const variable: any = { isList: true, dataSet: [{ a: 1 }] };
            expect(setValue(variable, 'a', 2)).toEqual([{ a: 1 }]);
        });

        it('should set the keyed value on a plain-object dataSet', () => {
            const variable: any = { dataSet: { a: 1 } };
            expect(setValue(variable, 'a', 2)).toEqual({ a: 2 });
        });
    });

    describe('getItem', () => {
        it('should return the dataSet itself for a non-list variable', () => {
            const variable: any = { dataSet: { a: 1 } };
            expect(getItem(variable, 0)).toEqual({ a: 1 });
        });

        it('should return the item at the given index for a list variable', () => {
            const variable: any = { isList: true, dataSet: ['a', 'b', 'c'] };
            expect(getItem(variable, 1)).toBe('b');
        });
    });

    describe('setItem', () => {
        it('should return the dataSet unchanged for a non-list variable', () => {
            const variable: any = { dataSet: [1, 2] };
            expect(setItem(variable, 0, 'x')).toEqual([1, 2]);
        });

        it('should return the dataSet unchanged when index or value is undefined', () => {
            const variable: any = { isList: true, dataSet: [1, 2] };
            expect(setItem(variable, undefined, 'x')).toEqual([1, 2]);
            expect(setItem(variable, 0, undefined)).toEqual([1, 2]);
        });

        it('should set the value at a numeric index', () => {
            const variable: any = { isList: true, dataSet: [1, 2, 3] };
            setItem(variable, 1, 'x');
            expect(variable.dataSet).toEqual([1, 'x', 3]);
        });

        it('should find and replace an item matching a partial object', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }, { id: 2 }] };
            setItem(variable, { id: 2 }, { id: 2, name: 'updated' });
            expect(variable.dataSet[1]).toEqual({ id: 2, name: 'updated' });
        });

        it('should leave the dataSet unchanged when the object match is not found', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }] };
            setItem(variable, { id: 99 }, { id: 99 });
            expect(variable.dataSet).toEqual([{ id: 1 }]);
        });
    });

    describe('addItem', () => {
        it('should return the dataSet unchanged for a non-list variable', () => {
            const variable: any = { dataSet: [1] };
            expect(addItem(variable, 2, undefined)).toEqual([1]);
        });

        it('should return the dataSet unchanged when value is falsy', () => {
            const variable: any = { isList: true, dataSet: [1] };
            expect(addItem(variable, null, undefined)).toEqual([1]);
        });

        it('should append the value at the end by default', () => {
            const variable: any = { isList: true, dataSet: [1, 2] };
            addItem(variable, 3, undefined);
            expect(variable.dataSet).toEqual([1, 2, 3]);
        });

        it('should insert the value at the given index', () => {
            const variable: any = { isList: true, dataSet: [1, 3] };
            addItem(variable, 2, 1);
            expect(variable.dataSet).toEqual([1, 2, 3]);
        });
    });

    describe('removeItem', () => {
        it('should remove the last item by default', () => {
            const variable: any = { isList: true, dataSet: [1, 2, 3] };
            removeItem(variable, undefined, undefined);
            expect(variable.dataSet).toEqual([1, 2]);
        });

        it('should remove the item at a numeric index', () => {
            const variable: any = { isList: true, dataSet: [1, 2, 3] };
            removeItem(variable, 0, undefined);
            expect(variable.dataSet).toEqual([2, 3]);
        });

        it('should remove an item matching a partial object when exactMatch is not set', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }, { id: 2, extra: true }] };
            removeItem(variable, { id: 2 }, false);
            expect(variable.dataSet).toEqual([{ id: 1 }]);
        });

        it('should not remove a partial match when exactMatch is true and it is not a full match', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }, { id: 2, extra: true }] };
            removeItem(variable, { id: 2 }, true);
            expect(variable.dataSet).toEqual([{ id: 1 }, { id: 2, extra: true }]);
        });

        it('should remove the exact match when exactMatch is true and it fully matches', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }, { id: 2 }] };
            removeItem(variable, { id: 2 }, true);
            expect(variable.dataSet).toEqual([{ id: 1 }]);
        });
    });

    describe('clearData', () => {
        it('should reset a list dataSet to an empty array', () => {
            const variable: any = { isList: true, dataSet: [1, 2, 3] };
            expect(clearData(variable)).toEqual([]);
        });

        it('should reset a non-list dataSet to an empty object', () => {
            const variable: any = { isList: false, dataSet: { a: 1 } };
            expect(clearData(variable)).toEqual({});
        });
    });

    describe('getCount', () => {
        it('should return the array length for a list variable', () => {
            const variable: any = { isList: true, dataSet: [1, 2, 3] };
            expect(getCount(variable)).toBe(3);
        });

        it('should return 1 for a non-list variable', () => {
            const variable: any = { isList: false, dataSet: { a: 1 } };
            expect(getCount(variable)).toBe(1);
        });
    });
});
