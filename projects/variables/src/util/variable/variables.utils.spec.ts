import {
    applyMultiIndexForDuplicateBindings, processBinding, setInput, isFileUploadSupported,
    getEvaluatedOrderBy, formatExportExpression, formatDate, decodeData, setDependency,
} from './variables.utils';

describe('variables.utils', () => {
    describe('applyMultiIndexForDuplicateBindings', () => {
        it('should mark duplicate-target bindings with collectionFormat multi and incrementing multiIndex', () => {
            const bindMap: any[] = [{ target: 'a' }, { target: 'a' }, { target: 'b' }];
            applyMultiIndexForDuplicateBindings(bindMap);
            expect(bindMap[0].collectionFormat).toBe('multi');
            expect(bindMap[0].multiIndex).toBe(0);
            expect(bindMap[1].multiIndex).toBe(1);
            expect(bindMap[2].collectionFormat).toBeUndefined();
        });

        it('should not override an already-set multiIndex', () => {
            const bindMap: any[] = [{ target: 'a', multiIndex: 5 }, { target: 'a' }];
            applyMultiIndexForDuplicateBindings(bindMap);
            expect(bindMap[0].multiIndex).toBe(5);
            expect(bindMap[1].multiIndex).toBe(0);
        });

        it('should ignore nodes without a target', () => {
            const bindMap: any[] = [{}, {}];
            expect(() => applyMultiIndexForDuplicateBindings(bindMap)).not.toThrow();
        });
    });

    describe('processBinding', () => {
        it('should reset the bindSource to an empty object and stash the original under _bind<source>', () => {
            const variable: any = { dataBinding: undefined, _context: {} };
            processBinding(variable, {});
            expect(variable.dataBinding).toEqual({});
            expect(variable._binddataBinding).toBeUndefined();
        });

        it('should return early without processing when bindMap is not an array', () => {
            const variable: any = { dataBinding: { a: 1 }, _context: {} };
            processBinding(variable, {});
            expect(variable.dataBinding).toEqual({});
            expect(variable._binddataBinding).toEqual({ a: 1 });
        });
    });

    describe('setInput', () => {
        it('should set a simple key/value pair on the target object', () => {
            const target = setInput({}, 'username', 'ram', undefined);
            expect(target).toEqual({ username: 'ram' });
        });

        it('should merge an object of key/value pairs', () => {
            const target = setInput({ a: 1 }, { b: 2, c: 3 }, undefined, undefined);
            expect(target).toEqual({ a: 1, b: 2, c: 3 });
        });

        it('should resolve a dotted key against a nested object', () => {
            const target = setInput({ employee: { department: 'HR' } }, 'employee.department', 'Sales', undefined);
            expect(target).toEqual({ department: 'Sales' });
        });

        it('should default to an empty object when targetObj is not provided', () => {
            const target = setInput(undefined, 'a', 1, undefined);
            expect(target).toEqual({ a: 1 });
        });

        it('should coerce the value to a number when options.type is number', () => {
            const target = setInput({}, 'age', '25', { type: 'number' });
            expect(target).toEqual({ age: 25 });
        });
    });

    describe('isFileUploadSupported', () => {
        it('should return a truthy value in the jsdom test environment', () => {
            expect(isFileUploadSupported()).toBeTruthy();
        });
    });

    describe('getEvaluatedOrderBy', () => {
        it('should return the variable order when options order is empty', () => {
            expect(getEvaluatedOrderBy('name asc', undefined)).toBe('name asc');
        });

        it('should return the options order when variable order is empty', () => {
            expect(getEvaluatedOrderBy(undefined, 'age desc')).toBe('age desc');
        });

        it('should combine both, giving options order precedence for overlapping fields', () => {
            expect(getEvaluatedOrderBy('name asc,age asc', 'age desc')).toBe('age desc,name asc');
        });
    });

    describe('formatExportExpression', () => {
        it('should wrap each fieldDef expression in ${...}', () => {
            const fieldDefs = [{ expression: 'firstName' }, { noExpr: true }];
            formatExportExpression(fieldDefs);
            expect(fieldDefs[0].expression).toBe('${firstName}');
            expect((fieldDefs[1] as any).expression).toBeUndefined();
        });
    });

    describe('formatDate', () => {
        beforeEach(() => {
            setDependency('appManager', { getPipe: jest.fn().mockReturnValue({ transform: jest.fn().mockReturnValue('formatted') }) });
        });

        it('should format a single date value', () => {
            expect(formatDate(1700000000000, 'DATE')).toBe('formatted');
        });

        it('should format each value of an array', () => {
            expect(formatDate([1700000000000, 1700000001000], 'DATE')).toEqual(['formatted', 'formatted']);
        });

        it('should extract the base type from a dotted type string', () => {
            expect(formatDate(1700000000000, 'wm.date')).toBe('formatted');
        });
    });

    describe('decodeData', () => {
        // htmlDecode() calls the bare global `he` (an ambient `declare const he` in the source,
        // normally injected via a <script> tag in the real app) - shim it for the test environment.
        beforeAll(() => {
            (window as any).he = { unescape: (str: string) => str.replace(/&amp;/g, '&') };
        });

        afterAll(() => {
            delete (window as any).he;
        });

        it('should return falsy input unchanged', () => {
            expect(decodeData(null)).toBeNull();
            expect(decodeData('')).toBe('');
        });

        it('should html-decode a plain string', () => {
            expect(decodeData('a &amp; b')).toBe('a & b');
        });

        it('should html-decode string values within an object', () => {
            const obj = { name: 'Tom &amp; Jerry' };
            decodeData(obj);
            expect(obj.name).toBe('Tom & Jerry');
        });

        it('should recurse into nested objects', () => {
            const obj = { child: { name: 'A &amp; B' } };
            decodeData(obj);
            expect(obj.child.name).toBe('A & B');
        });

        it('should decode string items within an array of objects', () => {
            const arr = [{ name: 'X &amp; Y' }];
            decodeData(arr);
            expect(arr[0].name).toBe('X & Y');
        });
    });
});
