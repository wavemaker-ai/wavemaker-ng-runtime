import * as api from './public_api';

describe('form public_api', () => {
    it('re-exports the form directives and components', () => {
        for (const name of ['FormComponent', 'FormFieldDirective', 'LiveFilterDirective', 'LiveFormDirective']) {
            expect((api as any)[name]).toBeDefined();
        }
        expect(api.FormComponent.name).toBe('FormComponent');
        expect(api.FormFieldDirective.name).toBe('FormFieldDirective');
        expect(api.LiveFilterDirective.name).toBe('LiveFilterDirective');
    });
});
