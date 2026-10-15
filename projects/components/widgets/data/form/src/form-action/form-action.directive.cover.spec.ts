import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { FormActionDirective } from './form-action.directive';
import { FormComponent } from '../form.component';

@Component({
    standalone: false,
    template: '<div wmFormAction></div>'
})
class FormActionCoverHostComponent { }

describe('FormActionDirective remaining branches', () => {
    let fixture: ComponentFixture<FormActionCoverHostComponent>;
    let directive: any;
    let form: any;

    beforeEach(() => {
        form = { registerActions: jest.fn(), readonly: false };
        TestBed.configureTestingModule({
            imports: [FormActionDirective],
            declarations: [FormActionCoverHostComponent],
            providers: [
                { provide: FormComponent, useValue: form },
                { provide: App, useValue: mockApp }
            ]
        });
        fixture = TestBed.createComponent(FormActionCoverHostComponent);
        directive = fixture.debugElement.query(By.directive(FormActionDirective)).injector.get(FormActionDirective);
    });

    describe('populateAction', () => {
        it('uses an empty class for non-button widgets and falls back to the binding for the key', () => {
            directive.binding = 'bind1';
            directive['widget-type'] = 'link';
            directive.populateAction();
            expect(directive.buttonDef.class).toBe('');
            expect(directive.buttonDef.key).toBe('bind1');
        });

        it('defaults the title to the display name, or an empty string when there is none', () => {
            directive['display-name'] = 'Save';
            directive.populateAction();
            expect(directive.buttonDef.title).toBe('Save');
            directive['display-name'] = undefined;
            directive.populateAction();
            expect(directive.buttonDef.title).toBe('');
            directive.title = 'Explicit';
            directive.populateAction();
            expect(directive.buttonDef.title).toBe('Explicit');
        });

        it('disables the action when the form is readonly', () => {
            form.readonly = true;
            directive.disabled = false;
            directive.populateAction();
            expect(directive.buttonDef.disabled).toBe(true);
        });
    });

    describe('onPropertyChange', () => {
        it('ignores changes before the props are initialised', () => {
            directive.buttonDef = {};
            directive.onPropertyChange('title', 'x', undefined);
            expect(directive.buttonDef).toEqual({});
        });

        it('sets both displayName and the raw key for display-name changes', () => {
            directive.populateAction();
            directive.onPropertyChange('display-name', 'New name', 'Old');
            expect(directive.buttonDef.displayName).toBe('New name');
            expect(directive.buttonDef['display-name']).toBe('New name');
        });

        it('combines disabled with the form readonly state', () => {
            directive.populateAction();
            form.readonly = true;
            directive.onPropertyChange('disabled', false, true);
            expect(directive.buttonDef.disabled).toBe(true);
            form.readonly = false;
            directive.onPropertyChange('disabled', false, true);
            expect(directive.buttonDef.disabled).toBe(false);
        });

        it('copies other properties straight onto the button definition', () => {
            directive.populateAction();
            directive.onPropertyChange('iconclass', 'wi wi-x', '');
            expect(directive.buttonDef.iconclass).toBe('wi wi-x');
        });
    });
});
