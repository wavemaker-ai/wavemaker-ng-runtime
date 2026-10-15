import { isAndroid } from '@wm/core';
import { getFieldLayoutConfig, getRowOperationsColumn, setHeaderConfig } from './live-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isAndroid: jest.fn()
}));

describe('live-utils: coverage gaps', () => {
    beforeEach(() => (isAndroid as jest.Mock).mockReset());

    describe('setHeaderConfig', () => {
        it('replaces an existing column inside the matching group', () => {
            const headerConfig = [{ isGroup: true, field: 'g1', columns: [{ field: 'a', v: 1 }, { field: 'b', v: 2 }] }];
            const config = { field: 'b', v: 99 };
            setHeaderConfig(headerConfig, config, 'g1', 5);
            expect(headerConfig[0].columns[1]).toBe(config);
            expect(headerConfig[0].columns.length).toBe(2);
        });

        it('recurses into nested groups that do not match', () => {
            const inner = { isGroup: true, field: 'inner', columns: [{ field: 'x' }] };
            const headerConfig = [{ isGroup: true, field: 'outer', columns: [inner] }];
            const config = { field: 'y' };
            setHeaderConfig(headerConfig, config, 'inner', 1);
            expect(inner.columns[1]).toBe(config);
        });
    });

    it('getRowOperationsColumn returns the row operation column definition', () => {
        const col = getRowOperationsColumn();
        expect(col.field).toBe('rowOperations');
        expect(col.isRowOperation).toBe(true);
        expect(col.operations).toEqual([]);
    });

    describe('getFieldLayoutConfig', () => {
        it('defaults to the top position and checks android when os is not android', () => {
            (isAndroid as jest.Mock).mockReturnValue(false);
            expect(getFieldLayoutConfig('md-3', undefined, 'ios')).toEqual({ captionCls: '', widgetCls: '' });
            expect(isAndroid).toHaveBeenCalled();
        });

        it('uses full width columns for top position on android', () => {
            (isAndroid as jest.Mock).mockReturnValue(true);
            expect(getFieldLayoutConfig('', undefined, undefined)).toEqual({ captionCls: 'col-xs-12', widgetCls: 'col-xs-12' });
        });

        it('treats floating captions like top captions', () => {
            expect(getFieldLayoutConfig('', 'floating', 'android')).toEqual({ captionCls: 'col-xs-12', widgetCls: 'col-xs-12' });
        });

        it('returns empty classes for a side caption without a caption width', () => {
            expect(getFieldLayoutConfig('', 'left', undefined)).toEqual({ captionCls: '', widgetCls: '' });
        });

        it('falls back to a 12 column widget when the caption takes all columns', () => {
            expect(getFieldLayoutConfig('md-12', 'left', undefined)).toEqual({ captionCls: ' col-md-12', widgetCls: ' col-md-12' });
        });
    });
});
