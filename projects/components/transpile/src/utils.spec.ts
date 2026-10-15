import { DataType, FormWidgetType } from '@wm/core';

import * as flat from './utils';
import * as nested from './utils/utils';

describe.each([
    ['transpile/utils', flat],
    ['transpile/utils/utils', nested]
])('%s', (_name, utils: any) => {
    it('exposes the constants', () => {
        expect(utils.ALLFIELDS).toBe('All Fields');
        expect(utils.EDIT_MODE).toEqual({ QUICK_EDIT: 'quickedit', INLINE: 'inline', FORM: 'form', DIALOG: 'dialog' });
    });

    describe('isDataSetWidget', () => {
        it.each([
            FormWidgetType.SELECT, FormWidgetType.CHECKBOXSET, FormWidgetType.RADIOSET, FormWidgetType.SWITCH,
            FormWidgetType.AUTOCOMPLETE, FormWidgetType.CHIPS, FormWidgetType.TYPEAHEAD, FormWidgetType.RATING
        ])('is true for %s', widget => {
            expect(utils.isDataSetWidget(widget)).toBe(true);
        });

        it('is false for other widgets', () => {
            expect(utils.isDataSetWidget(FormWidgetType.TEXT)).toBe(false);
            expect(utils.isDataSetWidget(undefined)).toBe(false);
        });
    });

    describe('getDataTableFilterWidget', () => {
        it('uses the first widget of the field type when it is a supported filter widget', () => {
            expect(utils.getDataTableFilterWidget('integer')).toBe(FormWidgetType.NUMBER);
            expect(utils.getDataTableFilterWidget('string')).toBe(FormWidgetType.TEXT);
            expect(utils.getDataTableFilterWidget('date')).toBe(FormWidgetType.DATE);
            expect(utils.getDataTableFilterWidget('time')).toBe(FormWidgetType.TIME);
            expect(utils.getDataTableFilterWidget('datetime')).toBe(FormWidgetType.DATETIME);
            expect(utils.getDataTableFilterWidget('list')).toBe(FormWidgetType.SELECT);
        });

        it('uses a select for booleans', () => {
            expect(utils.getDataTableFilterWidget(DataType.BOOLEAN)).toBe(FormWidgetType.SELECT);
        });

        it('falls back to text for unsupported filter widgets and unknown types', () => {
            expect(utils.getDataTableFilterWidget('blob')).toBe(FormWidgetType.TEXT);
            expect(utils.getDataTableFilterWidget('timestamp')).toBe(FormWidgetType.TEXT);
            expect(utils.getDataTableFilterWidget('unknown')).toBe(FormWidgetType.TEXT);
            expect(utils.getDataTableFilterWidget(undefined)).toBe(FormWidgetType.TEXT);
        });
    });

    describe('getEditModeWidget', () => {
        it('uses a select for primary-key related entities', () => {
            expect(utils.getEditModeWidget({ 'related-entity-name': 'E', 'primary-key': true, type: 'string' })).toBe(FormWidgetType.SELECT);
        });

        it('uses the default widget of the column type', () => {
            expect(utils.getEditModeWidget({ type: 'integer' })).toBe('number');
            expect(utils.getEditModeWidget({ type: 'boolean' })).toBe('checkbox');
            expect(utils.getEditModeWidget({ type: 'blob' })).toBe('upload');
            expect(utils.getEditModeWidget({ 'related-entity-name': 'E', type: 'string' })).toBe('text');
        });

        it('falls back to text for unknown types', () => {
            expect(utils.getEditModeWidget({ type: 'mystery' })).toBe(FormWidgetType.TEXT);
            expect(utils.getEditModeWidget({})).toBe(FormWidgetType.TEXT);
        });
    });
});
