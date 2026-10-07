import { FormWidgetType } from '../enums/enums';
import { getFormWidgetTemplate } from './build-utils';

describe('build-utils: getFormWidgetTemplate (not required)', () => {
    const types = Object.values(FormWidgetType).filter(v => typeof v === 'string') as string[];

    it.each(types)('does not emit required=true for %s when required is not "true"', (type) => {
        const attrs = new Map<string, string>([['required', 'false']]);
        const tmpl = getFormWidgetTemplate(type, 'INNER', attrs, { counter: 'c', pCounter: 'p' });
        expect(tmpl).toContain('INNER');
        expect(tmpl).not.toContain('required=true');
    });

    it('emits required=true for a required checkbox and omits it otherwise', () => {
        const yes = getFormWidgetTemplate(FormWidgetType.CHECKBOX, 'X', new Map([['required', 'true']]));
        const no = getFormWidgetTemplate(FormWidgetType.CHECKBOX, 'X', new Map());
        expect(yes).toContain('required=true');
        expect(no).not.toContain('required=true');
    });

    it('uses the default text input template for unknown types without required', () => {
        const tmpl = getFormWidgetTemplate('unknown-type', 'X', new Map([['required', 'false']]));
        expect(tmpl).toContain('<wm-input');
        expect(tmpl).not.toContain('required=true');
    });
});
