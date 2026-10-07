import { ALLFIELDS } from './data-utils';
import { getUniqObjsByDataField, groupData, toggleAllHeaders, transformFormData } from './form-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getFormattedDate: jest.fn((_pipe: any, _value: any, format: string) => `fmt:${format}`),
}));

describe('form-utils - more', () => {
    afterEach(() => jest.restoreAllMocks());

    describe('transformFormData', () => {
        it('uses all fields as the data field when none is given', () => {
            const items: any[] = transformFormData({}, [{ name: 'a' }, { name: 'b' }], undefined, { displayField: 'name' }, 5);
            expect(items.map(i => i.key)).toEqual([5, 6]);
            expect(items.map(i => i.label)).toEqual(['a', 'b']);
            expect(items[0].value).toEqual({ name: 'a' });
            expect(items[1].index).toBe(6);
        });
    });

    describe('getUniqObjsByDataField', () => {
        it('only requires a label when all fields are the data field', () => {
            const data: any[] = [
                { key: 1, label: 'A', value: { a: 1 } },
                { key: 2, label: '  ', value: { a: 2 } },
                { key: 3, label: 'C', value: { a: 3 } },
            ];
            const result = getUniqObjsByDataField(data, ALLFIELDS, 'label');
            expect(result.map((r: any) => r.label)).toEqual(['A', 'C']);
        });
    });

    describe('groupData by day', () => {
        it('rolls dates up to Today or the formatted date, and restores the calendar afterwards', () => {
            const data = [
                { id: 1, when: new Date() },
                { id: 2, when: new Date(2001, 4, 4) },
                { id: 3 },
            ];
            const result = groupData({}, data, 'when', 'day', '', 'yyyy-MM-dd', {} as any, undefined, { dateFormat: 'yyyy-MM-dd' });
            const keys = result.map(g => g.key);
            expect(keys).toEqual(expect.arrayContaining(['Today', 'fmt:yyyy-MM-dd', 'Others']));
            expect(keys).toHaveLength(3);
        });
    });

    describe('toggleAllHeaders', () => {
        const build = (iconClass: string) => {
            const nativeElement = document.createElement('div');
            nativeElement.innerHTML = `<div class="item-group">
                <ul><li class="list-group-header"><span class="app-icon ${iconClass}"></span></li>
                <li class="group-list-item">x</li></ul></div>`;
            document.body.appendChild(nativeElement);
            return nativeElement;
        };
        afterEach(() => { document.body.innerHTML = ''; });

        it('flips the chevron from down to up and back', () => {
            const el = build('wi-chevron-down');
            const icon = el.querySelector('.app-icon') as HTMLElement;

            toggleAllHeaders({ nativeElement: el });
            expect(icon.classList.contains('wi-chevron-up')).toBe(true);
            expect(icon.classList.contains('wi-chevron-down')).toBe(false);

            toggleAllHeaders({ nativeElement: el });
            expect(icon.classList.contains('wi-chevron-down')).toBe(true);
            expect(icon.classList.contains('wi-chevron-up')).toBe(false);
        });
    });
});
