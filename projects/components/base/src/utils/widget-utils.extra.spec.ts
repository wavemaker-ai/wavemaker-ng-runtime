import { createFocusTrap } from '@wavemaker/focus-trap';
import {
    getConditionalClasses,
    getContainerTargetClass,
    getCurrentWidgets,
    getKeyboardFocusableElements,
    prepareFieldDefs,
    setFocusTrap,
} from './widget-utils';

jest.mock('@wavemaker/focus-trap', () => ({
    createFocusTrap: jest.fn(() => ({ activate: jest.fn() })),
}));

describe('widget-utils - getConditionalClasses extra paths', () => {
    it('collects the classes of every truthy key in an object', () => {
        const { toAdd } = getConditionalClasses({ 'a b': true, c: false, d: 1 });
        expect(toAdd).toEqual(['a', 'b', 'd']);
    });

    it('passes an array of class names through unchanged', () => {
        const { toAdd } = getConditionalClasses(['a', 'b']);
        expect(toAdd).toEqual(['a', 'b']);
    });

    it('treats the previous value as the classes to remove', () => {
        const { toAdd, toRemove } = getConditionalClasses({ new: true }, { old: true });
        expect(toAdd).toEqual(['new']);
        expect(toRemove).toEqual(['old']);
    });

    it('accepts an already split toAdd and toRemove pair', () => {
        const result = getConditionalClasses({ toAdd: ['x'], toRemove: ['y'] });
        expect(result).toEqual({ toAdd: ['x'], toRemove: ['y'] });
    });

    it('converts string values into single class lists', () => {
        expect(getConditionalClasses('new', 'old')).toEqual({ toAdd: ['new'], toRemove: ['old'] });
        expect(getConditionalClasses('', undefined)).toEqual({ toAdd: [], toRemove: [] });
    });

    it('accepts array values for the previous classes', () => {
        const { toRemove } = getConditionalClasses({ a: true }, ['b', 'c']);
        expect(toRemove).toEqual(['b', 'c']);
    });
});

describe('widget-utils - prepareFieldDefs extra paths', () => {
    it('returns the whole definition for filter all and the groups for objects and terminals', () => {
        const data = [{ name: 'a', address: { city: 'x' } }];
        const all: any = prepareFieldDefs(data, { filter: 'all' });
        expect(Object.keys(all)).toEqual(['objects', 'terminals']);
        expect(prepareFieldDefs(data, { filter: 'objects' })).toEqual(all.objects);
        expect(prepareFieldDefs(data, { filter: 'terminals' })).toEqual(all.terminals);
    });

    it('returns the definition for an unknown filter', () => {
        const result: any = prepareFieldDefs([{ a: 1 }], { filter: 'something' });
        expect(result.terminals).toHaveLength(1);
    });

    it('keeps the raw titles when noModifyTitle is set', () => {
        const result: any = prepareFieldDefs([{ first_name: 'a' }], { noModifyTitle: true });
        expect(result[0].displayName).toBe('first_name');
    });

    it('prefixes nested titles and keeps the bindable field path', () => {
        const result: any = prepareFieldDefs([{ address: { city: 'x' } }], { filter: 'terminals' });
        expect(result[0].field).toBe('address.city');
        expect(result[0].displayName).toContain('City');
    });

    it('shortens the title of related columns to the last two words', () => {
        const result: any = prepareFieldDefs([{ 'dept.name': 'x' }]);
        expect(result[0].relatedTable).toBe('dept');
        expect(result[0].relatedField).toBe('name');
    });

    it('processes the first item of array values', () => {
        const result: any = prepareFieldDefs([{ items: [{ sku: 'a' }] }], { filter: 'terminals' });
        expect(result[0].field).toBe('items[0].sku');
    });

    it('treats empty arrays as leaf values', () => {
        const result: any = prepareFieldDefs([{ tags: [] }], { filter: 'terminals' });
        expect(result.map((r: any) => r.field)).toEqual(['tags']);
    });

    it('stops collecting columns at the upper bound', () => {
        const result: any = prepareFieldDefs([{ a: 1, b: 2, c: 3 }], { upperBound: 2 });
        expect(result).toHaveLength(2);
    });

    it('fills null values of the first row from the following rows', () => {
        const result: any = prepareFieldDefs([{ a: null, b: 1 }, { a: { deep: 'x' }, c: 2 }], { filter: 'terminals' });
        expect(result.map((r: any) => r.field)).toEqual(expect.arrayContaining(['a.deep', 'b', 'c']));
    });

    it('uses a plain object as the sample as well', () => {
        const result: any = prepareFieldDefs({ a: 1 });
        expect(result).toHaveLength(1);
    });
});

describe('widget-utils - misc helpers', () => {
    it('getContainerTargetClass targets the app container', () => {
        expect(getContainerTargetClass(document.createElement('div'))).toBe('.wm-app');
    });

    it('setFocusTrap toggles the active class and forwards the options', () => {
        const container = document.createElement('div');
        const returnFocus = jest.fn();
        setFocusTrap(container, true, returnFocus);

        const options = (createFocusTrap as jest.Mock).mock.calls[0][1];
        expect((createFocusTrap as jest.Mock).mock.calls[0][0]).toBe(container);
        expect(options.allowOutsideClick).toBe(true);
        expect(options.setReturnFocus).toBe(returnFocus);
        expect(options.preventScroll).toBe(true);

        options.onActivate();
        expect(container.classList.contains('is-active')).toBe(true);
        options.onDeactivate();
        expect(container.classList.contains('is-active')).toBe(false);
    });

    it('getKeyboardFocusableElements skips disabled, hidden and negative tabindex elements', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <button id="ok"></button>
            <button id="disabled" disabled></button>
            <input id="hidden" hidden>
            <a id="neg" tabindex="-1"></a>
            <a id="pos" tabindex="0"></a>`;
        const ids = getKeyboardFocusableElements(root).map((e) => e.id);
        expect(ids).toEqual(['ok', 'pos']);
    });

    it('getCurrentWidgets registers the widget of every element carrying a widget-id', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div widget-id="1"></div><div widget-id="2"></div><div></div>';
        const [first, second] = Array.from(root.querySelectorAll('[widget-id]')) as any[];
        first.widget = { name: 'one' };
        second.widget = { name: 'two' };
        const existing = { zero: { name: 'zero' } };

        const result = getCurrentWidgets(root, existing);

        expect(result).toBe(existing);
        expect(Object.keys(result)).toEqual(['zero', 'one', 'two']);
    });
});
