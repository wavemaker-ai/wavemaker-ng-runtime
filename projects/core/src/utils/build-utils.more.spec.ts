import { Attribute, Element } from '@angular/compiler';
import { FormWidgetType } from '../enums/enums';
import {
    checkIsCustomPipeExpression,
    getFormWidgetTemplate,
    getNgModelAttr,
    getRequiredFormWidget,
    getRowActionAttrs,
    updateTemplateAttrs
} from './build-utils';

const mkAttr = (name: string, value: string) => new Attribute(name, value, null as any, null as any, null as any, undefined, undefined);
const mkEl = (name: string, attrs: Array<[string, string]> = [], children: any[] = []): any => ({
    name,
    attrs: attrs.map(([n, v]) => mkAttr(n, v)),
    children
});
const val = (el: any, name: string) => el.attrs.find(a => a.name === name)?.value;

describe('build-utils - getFormWidgetTemplate', () => {
    const attrs = (o: any = {}) => new Map<string, string>(Object.entries(o));

    it.each([
        [FormWidgetType.AUTOCOMPLETE, 'wmSearch type="autocomplete" debouncetime="300"'],
        [FormWidgetType.TYPEAHEAD, 'wmSearch type="autocomplete"'],
        [FormWidgetType.CHECKBOX, '<div wmCheckbox INNER required=true'],
        [FormWidgetType.CHECKBOXSET, '<ul role="group" wmCheckboxset'],
        [FormWidgetType.CHIPS, 'wmChips debouncetime="300"'],
        [FormWidgetType.COLORPICKER, 'wmColorPicker required=true'],
        [FormWidgetType.CURRENCY, 'wmCurrency required=true updateon="blur"'],
        [FormWidgetType.CUSTOMWIDGET, 'wmWidgetContainer customWidgetContainer'],
        [FormWidgetType.DATE, 'wmDate required=true dataentrymode="picker"'],
        [FormWidgetType.DATETIME, 'wmDateTime required=true dataentrymode="picker"'],
        [FormWidgetType.NUMBER, 'wmNumber INNER required=true type="number"'],
        [FormWidgetType.PASSWORD, '<wm-input INNER required=true type="password"'],
        [FormWidgetType.RADIOSET, '<ul role="radiogroup" wmRadioset'],
        [FormWidgetType.RATING, 'wmRating'],
        [FormWidgetType.RICHTEXT, 'wmRichTextEditor role="textbox"'],
        [FormWidgetType.SELECT, '<wm-select required=true'],
        [FormWidgetType.TOGGLE, 'type="toggle"'],
        [FormWidgetType.ICONBUTTONTOGGLE, 'type="button"'],
        [FormWidgetType.SLIDER, 'wmSlider'],
        [FormWidgetType.SWITCH, 'wmSwitch'],
        [FormWidgetType.TEXT, '<wm-input INNER  required=true type="email"'],
        [FormWidgetType.TEXTAREA, '<wm-textarea INNER required=true updateon="blur"'],
        [FormWidgetType.TIME, 'wmTime required=true dataentrymode="picker"'],
        [FormWidgetType.TIMESTAMP, 'wmDateTime required=true dataentrymode="picker"'],
        ['unknown', '<wm-input INNER required=true type="text" updateon="blur"']
    ])('%s template', (type, expected) => {
        const a = attrs({ required: 'true', debouncetime: '300', updateon: 'blur', dataentrymode: 'picker', inputtype: 'email' });
        const out = getFormWidgetTemplate(type as string, 'INNER', a);
        expect(out).toContain(expected);
        expect(out).toContain('show.bind="true"');
    });

    it('omits required and updateon when not set; TEXT defaults type and honors options.inputType', () => {
        const out = getFormWidgetTemplate(FormWidgetType.TEXT, 'I', attrs());
        expect(out).not.toContain('required=true');
        expect(out).not.toContain('updateon');
        expect(out).toContain('type="text"');
        const out2 = getFormWidgetTemplate(FormWidgetType.TEXT, 'I', attrs({ custom: 'tel' }), { inputType: 'custom' });
        expect(out2).toContain('type="tel"');
    });

    it('show attribute uses static form when showineditmode is "false", bind otherwise', () => {
        expect(getFormWidgetTemplate(FormWidgetType.SWITCH, 'I', attrs({ showineditmode: 'false' }))).toContain('show="false"');
        expect(getFormWidgetTemplate(FormWidgetType.SWITCH, 'I', attrs({ 'showineditmode.bind': 'x.y' }))).toContain('show.bind="x.y"');
    });

    it('UPLOAD with uploadProps renders a form with file input and events', () => {
        const a = attrs({ 'change.event': 'onChange()', 'blur.event': 'b()' });
        const out = getFormWidgetTemplate(FormWidgetType.UPLOAD, 'INNER', a, {
            counter: 'c', uploadProps: { formName: 'frm', name: 'fld' }
        });
        expect(out).toContain('<form name="frm" INNER>');
        expect(out).toContain('name="fld"');
        expect(out).toContain(`(change)="c.triggerUploadEvent($event, 'change', 'fld', row)"`);
        expect(out).toContain(`(blur)="c.triggerUploadEvent($event, 'blur', 'fld', row)"`);
    });

    it('UPLOAD without uploadProps renders blob upload template using key or name', () => {
        const out = getFormWidgetTemplate(FormWidgetType.UPLOAD, 'INNER', attrs({ key: 'k' }), { counter: 'c', pCounter: 'p' });
        expect(out).toContain('@if (c.filetype === \'image\' && c.href)');
        expect(out).toContain('name="k_formWidget"');
        expect(out).toContain('[class.hidden]="!p.isUpdateMode"');
        const out2 = getFormWidgetTemplate(FormWidgetType.UPLOAD, 'INNER', attrs({ name: 'n' }), { counter: 'c', pCounter: 'p' });
        expect(out2).toContain('name="n_formWidget"');
        // no event attributes -> no triggerUploadEvent, no counter prefix needed
        expect(out2).not.toContain('triggerUploadEvent');
    });

    it('UPLOAD events without counter omit the counter prefix', () => {
        const out = getFormWidgetTemplate(FormWidgetType.UPLOAD, 'I', attrs({ 'change.event': 'x' }), {
            uploadProps: { formName: 'f', name: 'n' }
        });
        expect(out).toContain(`(change)="triggerUploadEvent($event, 'change', 'n', row)"`);
    });
});

describe('build-utils - getRequiredFormWidget', () => {
    it.each([
        [FormWidgetType.AUTOCOMPLETE, 'wm-search'],
        [FormWidgetType.TYPEAHEAD, 'wm-search'],
        [FormWidgetType.CHIPS, 'wm-chips'],
        [FormWidgetType.COLORPICKER, 'wm-colorpicker'],
        [FormWidgetType.CURRENCY, 'wm-currency'],
        [FormWidgetType.CUSTOMWIDGET, 'wm-custom-widget'],
        [FormWidgetType.DATE, 'wm-date'],
        [FormWidgetType.DATETIME, 'wm-datetime'],
        [FormWidgetType.TIMESTAMP, 'wm-datetime'],
        [FormWidgetType.TIME, 'wm-time'],
        [FormWidgetType.RATING, 'wm-rating'],
        [FormWidgetType.RICHTEXT, 'wm-richtexteditor'],
        [FormWidgetType.SLIDER, 'wm-slider'],
        [FormWidgetType.CHECKBOXSET, 'wm-checkboxset'],
        [FormWidgetType.NUMBER, 'wm-number'],
        [FormWidgetType.PASSWORD, 'wm-text'],
        [FormWidgetType.RADIOSET, 'wm-radioset'],
        [FormWidgetType.SWITCH, 'wm-switch'],
        [FormWidgetType.SELECT, 'wm-select'],
        [FormWidgetType.TEXTAREA, 'wm-textarea'],
        [FormWidgetType.CHECKBOX, 'wm-checkbox'],
        [FormWidgetType.TOGGLE, 'wm-checkbox'],
        [FormWidgetType.ICONBUTTONTOGGLE, 'wm-checkbox'],
        [FormWidgetType.UPLOAD, 'wm-fileupload'],
        [FormWidgetType.TEXT, 'wm-text'],
        ['other', 'wm-text']
    ])('%s -> %s', (type, tag) => {
        expect(getRequiredFormWidget(type)).toBe(tag);
    });
});

describe('build-utils - small helpers', () => {
    it('checkIsCustomPipeExpression detects custom: with optional spaces', () => {
        expect(checkIsCustomPipeExpression('a | custom:b')).toBe(1);
        expect(checkIsCustomPipeExpression('a | custom   : b')).toBe(1);
        expect(checkIsCustomPipeExpression('a | other:b')).toBeUndefined();
    });

    it('getNgModelAttr skips ngModel when formControlName present', () => {
        expect(getNgModelAttr(new Map())).toBe('ngModel');
        expect(getNgModelAttr(new Map([['formControlName', 'x']]))).toBe('');
        expect(getNgModelAttr(new Map([['formControlName.bind', 'x']]))).toBe('');
    });

    it('getRowActionAttrs maps known attributes and ignores others', () => {
        const out = getRowActionAttrs(new Map([
            ['display-name', 'Edit'],
            ['title.bind', 'x.y'],
            ['show', 'true'],
            ['unknown', 'zzz']
        ]));
        expect(out).toBe('caption="Edit" hint.bind="x.y" show="true" ');
        expect(getRowActionAttrs(new Map())).toBe('');
    });
});

describe('build-utils - updateTemplateAttrs', () => {
    it('rewrites parent dataset bindings to the item reference and adds datasetboundexpr', () => {
        const child = mkEl('wm-label', [['caption', 'bind:Variables.v1.dataSet[$i].name'], ['other', 'plain']]);
        const root = mkEl('wm-table', [], [child]);
        updateTemplateAttrs(root, 'Variables.v1.dataSet', 'table1');
        expect(val(child, 'caption')).toBe('bind:item.name');
        expect(val(child, 'other')).toBe('plain');
        expect(val(child, 'datasetboundexpr')).toBeUndefined();
    });

    it('adds datasetboundexpr for dataset attribute only once', () => {
        const child = mkEl('wm-list', [['dataset', 'bind:Variables.v1.dataSet.children']]);
        updateTemplateAttrs([child], 'Variables.v1.dataSet', 'l');
        expect(val(child, 'dataset')).toBe('bind:item.children');
        expect(val(child, 'datasetboundexpr')).toBe('Variables.v1.dataSet.children');
        // run again; attribute exists so should not be duplicated
        const countBefore = child.attrs.length;
        child.attrs.find(a => a.name === 'dataset').value = 'bind:Variables.v1.dataSet.more';
        updateTemplateAttrs([child], 'Variables.v1.dataSet', 'l');
        expect(child.attrs.length).toBe(countBefore);
    });

    it('leaves exact parent binding and parent.length checks untouched', () => {
        const child = mkEl('wm-label', [
            ['a', 'bind:Variables.v1.dataSet'],
            ['b', 'bind:Variables.v1.dataSet.length > 0'],
            ['c', 'bind:(Variables.v1.dataSet).length']
        ]);
        updateTemplateAttrs([child], 'Variables.v1.dataSet', 'l');
        expect(val(child, 'a')).toBe('bind:Variables.v1.dataSet');
        expect(val(child, 'b')).toBe('bind:Variables.v1.dataSet.length > 0');
        expect(val(child, 'c')).toBe('bind:(Variables.v1.dataSet).length');
    });

    it('for wm-list root only itemclass/disableitem/dataset are rewritten', () => {
        const root = mkEl('wm-list', [
            ['itemclass', 'bind:Variables.v1.dataSet[$i].cls'],
            ['title', 'bind:Variables.v1.dataSet[$i].t']
        ], []);
        updateTemplateAttrs(root, 'Variables.v1.dataSet', 'list1');
        expect(val(root, 'itemclass')).toBe('bind:item.cls');
        expect(val(root, 'title')).toBe('bind:Variables.v1.dataSet[$i].t');
    });

    it('replaces currentItem and currentItemWidgets references (custom reference/instance)', () => {
        const child = mkEl('wm-label', [
            ['caption', 'bind:Widgets.list1.currentItem.name'],
            ['hint', 'bind:Widgets.list1.currentItemWidgets.w1.datavalue'],
            ['dataset', 'bind:Widgets.list1.currentItem.children']
        ]);
        updateTemplateAttrs([child], 'Variables.zz', 'list1', 'inst.', 'row');
        expect(val(child, 'caption')).toBe('bind:row.name');
        expect(val(child, 'hint')).toBe('bind:inst.currentItemWidgets.w1.datavalue');
        expect(val(child, 'dataset')).toBe('bind:row.children');
        expect(val(child, 'datasetboundexpr')).toBe('Widgets.list1.currentItem.children');
    });

    it('collapses formWidgets/filterWidgets references before replacing currentItem', () => {
        const child = mkEl('wm-label', [
            ['caption', 'bind:Widgets.form1.formWidgets.list1.currentItem.name']
        ]);
        updateTemplateAttrs([child], 'Variables.zz', 'list1');
        expect(val(child, 'caption')).toBe('bind:item.name');
    });

    it('appends currentItem as last arg for custom pipe expressions', () => {
        const child = mkEl('wm-label', [['caption', 'bind:Variables.v1.dataSet[$i].x | custom:foo']]);
        updateTemplateAttrs([child], 'Variables.v1.dataSet', 'list1');
        expect(val(child, 'caption')).toBe('bind:item.x | custom:foo:Widgets.list1.currentItem');
    });

    it('does not append currentItem for custom pipe when there is no widget name', () => {
        const child = mkEl('wm-label', [['caption', 'bind:Variables.v1.dataSet[$i].x | custom:foo']]);
        updateTemplateAttrs([child], 'Variables.v1.dataSet', '');
        expect(val(child, 'caption')).toBe('bind:item.x | custom:foo');
    });

    it('recurses into nested children, skips unnamed (text) nodes and trims values', () => {
        const leaf = mkEl('wm-label', [['caption', '  bind:Variables.v1.dataSet[$i].n  ']]);
        const mid = mkEl('div', [], [leaf]);
        const text: any = { value: 'text' };
        const root = mkEl('wm-table', [], [text, mid]);
        updateTemplateAttrs(root, 'Variables.v1.dataSet', 'table1');
        expect(val(leaf, 'caption')).toBe('bind:item.n');
    });

    it('handles root nodes without children', () => {
        expect(() => updateTemplateAttrs({ name: 'x' } as any, 'a', 'b')).not.toThrow();
    });
});
