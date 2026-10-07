import { $parseEvent, getFormattedDate } from '@wm/core';
import { transformFormData } from './form-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getFormattedDate: jest.fn((_pipe: any, _value: any, format: string) => `fmt:${format}`),
    $parseEvent: jest.fn(),
}));

describe('transformFormData - search group by', () => {
    const appDefaults = { dateFormat: 'yyyy-MM-dd', timeFormat: 'hh:mm a' };
    const searchScope = (overrides: any = {}) => ({ widgetType: 'wm-search', appDefaults, ...overrides });
    const options = { displayField: 'name' };

    const groupsOf = (dataSet: any, scope: any, dataField = 'id') =>
        transformFormData({}, dataSet, dataField, options, 1, scope).map((item: any) => item.groupby);

    beforeEach(() => {
        (getFormattedDate as jest.Mock).mockClear();
        ($parseEvent as jest.Mock).mockReset();
    });

    it('leaves the group empty when the search has no group by', () => {
        expect(groupsOf([{ id: 1, name: 'a' }], searchScope())).toEqual(['']);
    });

    it('does not group for widgets other than search', () => {
        const items = transformFormData({}, [{ id: 1, name: 'a', type: 'x' }], 'id', options, 1, { widgetType: 'wm-select', groupby: 'type' });
        expect((items[0] as any).groupby).toBeUndefined();
    });

    it('groups object items by the value of the group by field', () => {
        const data = [{ id: 1, name: 'a', type: 'fruit' }, { id: 2, name: 'b', type: 'veg' }];
        expect(groupsOf(data, searchScope({ groupby: 'type' }))).toEqual(['fruit', 'veg']);
    });

    it('puts items with an empty group by value in Others', () => {
        const data = [{ id: 1, name: 'a' }, { id: 2, name: 'b', type: null }, { id: 3, name: 'c', type: '  ' }];
        expect(groupsOf(data, searchScope({ groupby: 'type' }))).toEqual(['Others', 'Others', 'Others']);
    });

    it('groups by the first letter for the alphabet match', () => {
        const data = [{ id: 1, name: 'Banana', fruit: 'Banana' }, { id: 2, name: 'apple', fruit: 'apple' }];
        expect(groupsOf(data, searchScope({ groupby: 'fruit', match: 'alphabet' }))).toEqual(['B', 'a']);
    });

    it('uses a user defined function for group by expressions containing a bracket', () => {
        const groupFn = jest.fn().mockReturnValue('custom');
        ($parseEvent as jest.Mock).mockReturnValue(groupFn);
        const context = { ctx: true };
        const items = transformFormData(context, [{ id: 1, name: 'a' }], 'id', options, 1, searchScope({ groupby: 'groupOf(row)' }));

        expect((items[0] as any).groupby).toBe('custom');
        expect($parseEvent).toHaveBeenCalledWith('groupOf(row)');
        expect(groupFn).toHaveBeenCalledWith(context, { row: { id: 1, name: 'a' } });
    });

    it('groups comma separated strings and plain arrays through their value', () => {
        const fromString = transformFormData({}, 'a,b', undefined, options, 1, searchScope({ groupby: 'x' }));
        const fromArray = transformFormData({}, ['a', 'b'], undefined, options, 1, searchScope({ groupby: 'x' }));
        expect(fromString.map((i: any) => i.groupby)).toEqual(['Others', 'Others']);
        expect(fromArray.map((i: any) => i.groupby)).toEqual(['Others', 'Others']);
        expect(fromString.map((i: any) => i.key)).toEqual(['a', 'b']);
    });

    it('falls back to Others for the entries of an object dataset, as their inner value is the key', () => {
        const items = transformFormData({}, { name: 'A', age: 20 }, undefined, options, 1, searchScope({ groupby: 'name' }));
        expect(items.map((i: any) => i.groupby)).toEqual(['Others', 'Others']);
    });

    describe('time roll up', () => {
        const rolled = (value: any, match: string, dateformat?: string) =>
            groupsOf([{ id: 1, name: 'a', when: value }], searchScope({ groupby: 'when', match, dateformat }))[0];

        it('rolls up to the year', () => {
            expect(rolled('2000-06-15', 'year')).toBe('2000');
        });

        it('rolls up to the month with the weekly and monthly patterns', () => {
            expect(rolled('2000-06-15', 'month')).toBe('fmt:MMM, yyyy');
            expect(rolled('2000-06-15', 'week')).toBe("fmt:w 'Week',  yyyy");
        });

        it('rolls up to the day using the application date format by default', () => {
            expect(rolled('2000-06-15', 'day')).toBe('fmt:yyyy-MM-dd');
            expect(getFormattedDate).toHaveBeenCalledWith(undefined, expect.any(Number), 'yyyy-MM-dd');
        });

        it('rolls up to the day using the widget date format when given', () => {
            rolled('2000-06-15', 'day', 'dd/MM/yyyy');
            expect(getFormattedDate).toHaveBeenCalledWith(undefined, expect.any(Number), 'dd/MM/yyyy');
        });

        it('rolls up to the hour for full dates, formatting older dates with the time format', () => {
            expect(rolled('2000-06-15T10:30:00', 'hour')).toBe('fmt:hh:mm a');
        });

        it('rolls up time only values to the hour', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            expect(rolled('10:30 AM', 'hour')).toBe('fmt:hh:mm a');
            warn.mockRestore();
        });

        it('puts invalid dates in Others', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            expect(rolled('not a date', 'year')).toBe('Others');
            warn.mockRestore();
        });
    });
});
