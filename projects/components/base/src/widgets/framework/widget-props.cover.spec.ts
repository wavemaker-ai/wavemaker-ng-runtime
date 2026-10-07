import { FormWidgetType } from '@wm/core';
import { getWidgetPropsByType, PROP_ANY, PROP_BOOLEAN, PROP_NUMBER, PROP_STRING, PROP_TYPE, register, registerFormWidget } from './widget-props';

describe('widget-props', () => {
    afterEach(() => { delete (window as any).WM_LOADED_COMPONENTS; });

    it('pre-registers an empty map for every form widget type', () => {
        const key = Object.keys(FormWidgetType)[0];
        const m = getWidgetPropsByType('wm-form-field-' + (FormWidgetType as any)[key]);
        expect(m).toBeInstanceOf(Map);
        expect(m.size).toBe(0);
        expect(getWidgetPropsByType('unknown')).toBeUndefined();
    });

    it('register stores props and tracks loaded components (starting from empty and appending)', () => {
        const props = new Map<string, any>([['a', 1]]);
        register('wm-x', props);
        expect(getWidgetPropsByType('wm-x')).toBe(props);
        expect((window as any).WM_LOADED_COMPONENTS).toEqual(['wm-x']);
        register('wm-y', new Map());
        expect((window as any).WM_LOADED_COMPONENTS).toEqual(['wm-x', 'wm-y']);
    });

    it('registerFormWidget merges into existing form widget props and ignores unknown ones', () => {
        const type = (FormWidgetType as any)[Object.keys(FormWidgetType)[0]];
        registerFormWidget(type, new Map([['k', 'v']]));
        expect(getWidgetPropsByType('wm-form-field-' + type).get('k')).toBe('v');
        registerFormWidget('does-not-exist', new Map([['k', 'v']]));
        expect(getWidgetPropsByType('wm-form-field-does-not-exist')).toBeUndefined();
    });

    it('exposes prop type constants', () => {
        expect(PROP_STRING.type).toBe(PROP_TYPE.STRING);
        expect(PROP_NUMBER.type).toBe(PROP_TYPE.NUMBER);
        expect(PROP_BOOLEAN.type).toBe(PROP_TYPE.BOOLEAN);
        expect(PROP_ANY.arrayType).toBe(true);
    });
});
