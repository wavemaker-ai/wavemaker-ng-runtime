import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { Component, QueryList, ViewChildren } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IMaskModule } from 'angular-imask';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import {
    AbstractDialogService, AbstractI18nService, App, AppDefaults, DataSource, DynamicComponentRefProvider,
    UserDefinedExecutionContext, Viewport,
} from '@wm/core';
import { SanitizePipe, performDataOperation } from '@wm/components/base';
import { LabelDirective } from '@wm/components/basic/label';
import { LayoutGridRowDirective } from '@wm/components/containers/layout-grid';
import { InputTextComponent } from '@wm/components/input/text';
import { NumberComponent } from '@wm/components/input/number';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { ToDatePipe, TrailingZeroDecimalPipe } from '../../../../base/src/pipes/custom-pipes';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { compileTestComponent, mockApp, mockViewport } from '../../../../base/src/test/util/component-test-util';
import { DateComponent } from '../../../input/epoch/date/src/date.component';
import { TimeComponent } from '../../../input/epoch/time/src/time.component';
import { FormComponent } from './form.component';
import { FormActionDirective } from './form-action/form-action.directive';
import { FormFieldDirective } from './form-field/form-field.directive';
import { LiveFormDirective } from './live-form/live-form.directive';
import { LiveFilterDirective } from './live-filter/live-filter.directive';
import { FormWidgetDirective } from './form-widget.directive';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    performDataOperation: jest.fn(),
}));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isElementInViewport: jest.fn(() => true),
    scrollToElement: jest.fn(),
    $appDigest: jest.fn(),
    $invokeWatchers: jest.fn(),
    getFiles: jest.fn(() => ['file']),
}));

import { $appDigest } from '@wm/core';


@Component({
    standalone: false,
    template: `<form wmForm name="plainForm"></form>
        <form wmForm name="liveForm" wmLiveForm=""></form>
        <form wmForm name="liveFilter" wmLiveFilter=""></form>
        <form wmForm name="loginForm" data-role="app-login"></form>`,
})
class MoreFormWrapperComponent {
    @ViewChildren(FormComponent) forms: QueryList<FormComponent>;
}

// referencing the classes keeps their static prop registration (initializeProps) from being elided
export const registeredFlavours = [LiveFormDirective, LiveFilterDirective];

const moduleDef: ITestModuleDef = {
    imports: [
        BrowserAnimationsModule, InputTextComponent, NumberComponent, FormsModule, ReactiveFormsModule, IMaskModule,
        LayoutGridRowDirective, LabelDirective, CommonModule, BsDatepickerModule, TimepickerModule, BsDropdownModule,
        FormComponent, FormActionDirective, FormFieldDirective, FormWidgetDirective, TimeComponent, DateComponent, ToDatePipe,
    ],
    declarations: [MoreFormWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Viewport, useValue: mockViewport },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: DynamicComponentRefProvider, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: UserDefinedExecutionContext, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        AbstractDialogService,
        { provide: SanitizePipe, useClass: SanitizePipe },
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe },
    ],
    teardown: { destroyAfterEach: false },
};

describe('FormComponent - more coverage', () => {
    let fixture: ComponentFixture<MoreFormWrapperComponent>;
    let forms: any[];
    let form: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, MoreFormWrapperComponent);
        fixture.detectChanges();
        forms = fixture.componentInstance.forms.toArray();
        form = forms[0];
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('chooses the host class by form flavour (plain, live form, live filter, login)', () => {
        const cls = (f) => f.nativeElement.className;
        expect(cls(forms[0])).toContain('app-form');
        expect(cls(forms[0])).not.toContain('app-liveform');
        expect(cls(forms[1])).toContain('app-liveform');
        expect(cls(forms[2])).toContain('app-livefilter');
        expect(cls(forms[3])).toContain('app-login-form');
    });

    describe('isParentList', () => {
        const wrapInList = (innerFormId?: string) => {
            const list = document.createElement('div');
            list.className = 'app-livelist';
            list.setAttribute('name', 'rows');
            document.body.appendChild(list);
            list.appendChild(form.nativeElement);
            if (innerFormId) {
                const inner = document.createElement('form');
                inner.setAttribute('widget-id', innerFormId);
                list.appendChild(inner);
            }
            return list;
        };

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('is true when the list does not contain the parent form', () => {
            form.parentList = { name: 'rows' };
            form.parentForm = { widgetId: 'pf' };
            form._formIsInList = undefined;
            wrapInList();
            expect(form.isParentList).toBe(true);
            expect(form._formIsInList).toBe(true);
        });

        it('is false when the list contains the parent form', () => {
            form.parentList = { name: 'rows' };
            form.parentForm = { widgetId: 'pf' };
            form._formIsInList = undefined;
            wrapInList('pf');
            expect(form.isParentList).toBe(false);
        });

        it('falls back to the parent list when no list element is found', () => {
            form.parentList = { name: 'missing' };
            form.parentForm = { widgetId: 'pf' };
            form._formIsInList = undefined;
            expect(form.isParentList).toBe(form.parentList);
        });
    });

    describe('addInnerNgFormToForm for prefab / partial', () => {
        const setup = (container: any, markup: string, formInside = true) => {
            const $el = $(markup);
            const formEle = $el.find('form')[0] as any;
            if (formEle && formInside) {
                formEle.widget = { widgetId: form.widgetId };
            }
            form.parentForm = { ngform: new FormGroup({}) };
            form._formIsInList = false;
            form.parentList = undefined;
            container.$element = $el;
            return $el;
        };

        it('names the inner form after the prefab', () => {
            form.parentPrefab = {};
            setup(form.parentPrefab, '<div><div wmprefabcontainer><form></form></div></div>');
            form.parentPrefab.name = 'myPrefab';
            form.addInnerNgFormToForm('inner');
            expect(form.formGroupName).toBe('myPrefab');
            expect(form.parentForm.ngform.get('myPrefab')).toBe(form.ngform);
        });

        it('names the inner form after the partial and de-duplicates the control name', () => {
            form.parentPartial = { name: 'myPartial' };
            setup(form.parentPartial, '<div><form></form></div>');
            form.parentForm.ngform.addControl('myPartial', new FormControl(''));
            form.addInnerNgFormToForm('inner');
            expect(form.formGroupName).toBe('myPartial_1');
        });

        it('keeps the own binding when the partial has several forms', () => {
            form.parentPartial = { name: 'myPartial' };
            setup(form.parentPartial, '<div><form></form><form></form></div>');
            form.addInnerNgFormToForm('inner');
            expect(form.formGroupName).toBe('inner');
        });

        it('keeps the own binding when the first form belongs to another widget', () => {
            form.parentPartial = { name: 'myPartial' };
            setup(form.parentPartial, '<div><form></form></div>', false);
            form.addInnerNgFormToForm('inner');
            expect(form.formGroupName).toBe('inner');
        });

        it('does nothing for a form inside a list', () => {
            form.parentForm = { ngform: new FormGroup({}) };
            form.parentList = { name: 'rows' };
            form._formIsInList = true;
            form.addInnerNgFormToForm('inner');
            expect(form.parentForm.ngform.get('inner')).toBeNull();
        });
    });

    describe('highlightInvalidFields', () => {
        const fieldMarkup = (key: string, type: string, attr = 'key') =>
            `<div wmformfield ${attr}="${key}" widgettype="${type}" __validationId="v_${key}">` +
            `<select></select><textarea></textarea><input></div>`;

        it('marks invalid controls as touched and sets the aria attributes on the active element', () => {
            const a = new FormControl('', Validators.required);
            const b = new FormControl('', Validators.required);
            const c = new FormControl('', Validators.required);
            const ok = new FormControl('fine', Validators.required);
            form.ngform = new FormGroup({ a, b, c, ok, nested: new FormGroup({ d: new FormControl('', Validators.required) }) });
            form.$element.append(
                fieldMarkup('a', 'select'), fieldMarkup('b', 'textarea', 'name'), fieldMarkup('c', 'text'),
                fieldMarkup('d', 'text')
            );
            form.highlightInvalidFields();

            const elA = form.$element.find('[key="a"]')[0];
            expect(elA.getAttribute('__errormsg')).toBe('v_a');
            expect(elA.querySelector('select').getAttribute('aria-invalid')).toBe('true');
            expect(elA.querySelector('select').getAttribute('aria-describedby')).toBe('v_a');
            expect(elA.querySelector('input').hasAttribute('aria-invalid')).toBe(false);
            const elB = form.$element.find('[name="b"]')[0];
            expect(elB.querySelector('textarea').getAttribute('aria-invalid')).toBe('true');
            const elC = form.$element.find('[key="c"]')[0];
            expect(elC.querySelector('input').getAttribute('aria-describedby')).toBe('v_c');
            expect(a.touched && b.touched && c.touched).toBe(true);
            expect(ok.touched).toBe(false);
            expect(form.ngform.get('nested.d').touched).toBe(true);
        });

        it('does nothing for a valid form', () => {
            form.ngform = new FormGroup({ a: new FormControl('x', Validators.required) });
            form.$element.append(fieldMarkup('a', 'text'));
            form.highlightInvalidFields();
            expect(form.$element.find('[key="a"]')[0].hasAttribute('__errormsg')).toBe(false);
        });
    });

    describe('validateFieldsOnSubmit with a visible invalid element', () => {
        let origVisible;
        beforeEach(() => {
            origVisible = ($.expr as any).pseudos.visible;
            ($.expr as any).pseudos.visible = () => true;
            jest.spyOn(form, 'setValidationMsgs').mockImplementation(() => undefined);
            jest.spyOn(form, 'highlightInvalidFields').mockImplementation(() => undefined);
            form.validationtype = 'default';
            form.operationType = 'insert';
        });
        afterEach(() => {
            ($.expr as any).pseudos.visible = origVisible;
        });

        it('focuses the invalid element and marks its control as touched', () => {
            const ctrl = new FormControl('', Validators.required);
            form.ngform = new FormGroup({ name: ctrl });
            form.$element.append('<div><input formControlName="name" class="ng-invalid" focus-target></div>');
            const focus = jest.spyOn($.fn, 'focus');
            expect(form.validateFieldsOnSubmit()).toBe(true);
            expect(form.highlightInvalidFields).toHaveBeenCalled();
            expect(focus).toHaveBeenCalled();
            expect(ctrl.touched).toBe(true);
            expect($appDigest).toHaveBeenCalled();
        });

        it('does not focus an autocomplete search input but still reports invalid', () => {
            const ctrl = new FormControl('', Validators.required);
            form.ngform = new FormGroup({ name: ctrl });
            form.$element.append('<div><input formControlName="name" class="ng-invalid app-search-input" focus-target></div>');
            const focus = jest.spyOn($.fn, 'focus');
            expect(form.validateFieldsOnSubmit()).toBe(true);
            expect(focus).not.toHaveBeenCalled();
            expect(ctrl.touched).toBe(true);
        });

        it('focuses the checkbox when the invalid element has no focus-target', () => {
            form.ngform = new FormGroup({ agree: new FormControl('', Validators.required) });
            form.$element.append('<div><input type="checkbox" formControlName="agree" class="ng-invalid"></div>');
            const focus = jest.spyOn($.fn, 'focus');
            expect(form.validateFieldsOnSubmit()).toBe(true);
            expect(focus).toHaveBeenCalled();
        });

        it('returns true even when no invalid element can be located', () => {
            form.ngform = new FormGroup({ name: new FormControl('', Validators.required) });
            expect(form.validateFieldsOnSubmit()).toBe(true);
        });
    });

    describe('setFormDataFromParentFormData', () => {
        it('uses the inner form data of the parent when the form array data is missing', () => {
            const orig = form.setFormDataFromParentFormData;
            form.setFormDataFromParentFormData = jest.fn();
            form.formdata = {};
            form.parentList = { name: 'rows' };
            form.parentForm = { formGroupName: 'grp', ngform: new FormGroup({ rows: new FormArray([]) }) };
            form._formIsInList = true;
            orig.call(form, { grp: { x: 1 } });
            expect(form.setFormDataFromParentFormData).toHaveBeenCalledWith({ x: 1 });
        });
    });

    describe('onFieldDefaultValueChange', () => {
        it('parses the value and resets a dirty form not touched by the user', () => {
            const field: any = { widgettype: 'number' };
            form.ngform.markAsDirty();
            form._triggeredByUser = false;
            const pristine = jest.spyOn(form, 'markAsPristine');
            form.onFieldDefaultValueChange(field, '12');
            expect(field.value).toBe(12);
            expect(pristine).toHaveBeenCalled();
            expect(form.dirty).toBe(false);
        });

        it('keeps the form dirty when triggered by the user', () => {
            const field: any = { widgettype: 'text' };
            form.ngform.markAsDirty();
            form._triggeredByUser = true;
            form.onFieldDefaultValueChange(field, 'abc');
            expect(field.value).toBe('abc');
            expect(form.dirty).toBe(true);
        });
    });

    describe('generateFormFields', () => {
        let created: any;
        let provider: any;
        beforeEach(() => {
            created = { instance: new (class DynInstance {})(), location: { nativeElement: document.createElement('span') } };
            form.dynamicFormRef = { clear: jest.fn(), createComponent: jest.fn(() => created) };
            provider = { getComponentFactoryRef: jest.fn().mockResolvedValue(class Dyn {}) };
            form.dynamicComponentProvider = provider;
            form.viewParent = { page: 'p' };
            jest.spyOn(form, 'setFormData').mockImplementation(() => undefined);
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            form._isGridLayoutPresent = false;
        });

        it('creates a dynamic container, wraps the template in a layout grid and appends the component', async () => {
            form.metadata = { data: [{ key: 'a' }, { key: 'b' }] };
            await form.generateFormFields();
            const tmpl = provider.getComponentFactoryRef.mock.calls[0][1];
            expect(tmpl).toContain('<wm-layoutgrid>');
            expect(tmpl).toContain('key="a"');
            expect(tmpl.match(/<wm-gridrow>/g).length).toBe(2);
                        const container = form.$element.find('.form-elements .dynamic-form-container')[0];
            expect(container).toBeTruthy();
            expect(container.contains(created.location.nativeElement)).toBe(true);
            expect(Object.getPrototypeOf(Object.getPrototypeOf(created.instance))).toBe(form._dynamicContext);
            expect(form.dynamicFormRef.clear).toHaveBeenCalled();
            expect(form.setFormData).toHaveBeenCalled();
        });

        it('uses the grid layout columns when present and lets beforerender replace the fields', async () => {
            form.$element.find('.form-elements').append('<div wmlayoutgrid columns="2"></div>');
            form._isGridLayoutPresent = true;
            form.onBeforeRenderEvt = 'x';
            form.invokeEventCallback = jest.fn().mockReturnValue([{ key: 'u1' }, { key: 'u2' }, { key: 'u3' }]);
            form.metadata = [{ key: 'orig' }];
            await form.generateFormFields();
            const tmpl = provider.getComponentFactoryRef.mock.calls[0][1];
            expect(tmpl).not.toContain('<wm-layoutgrid>');
            expect(tmpl).toContain('columnwidth="6"');
            expect(tmpl).not.toContain('orig');
            expect(tmpl.match(/<wm-gridrow>/g).length).toBe(2);
        });

        it('stops when beforerender returns a non-array', async () => {
            form.onBeforeRenderEvt = 'x';
            form.invokeEventCallback = jest.fn().mockReturnValue({ not: 'array' });
            form.metadata = [{ key: 'orig' }];
            await form.generateFormFields();
            expect(provider.getComponentFactoryRef).not.toHaveBeenCalled();
        });

        it('stops when there is no metadata', async () => {
            form.metadata = undefined;
            await form.generateFormFields();
            expect(form.formFields).toEqual([]);
            expect(provider.getComponentFactoryRef).not.toHaveBeenCalled();
        });

        it('logs when the component class could not be created', async () => {
            provider.getComponentFactoryRef.mockResolvedValue(undefined);
            form.metadata = [{ key: 'a' }];
            await form.generateFormFields();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create dynamic form component'));
            expect(form.dynamicFormRef.createComponent).not.toHaveBeenCalled();
        });

        it('logs when the grid layout element cannot be found', async () => {
            jest.spyOn(form, '$element', 'get').mockReturnValue($('<div></div>'));
            form.metadata = [{ key: 'a' }];
            await form.generateFormFields();
            expect(console.error).toHaveBeenCalledWith('Form grid layout element not found');
        });

        it('logs errors thrown while compiling', async () => {
            const err = new Error('boom');
            provider.getComponentFactoryRef.mockRejectedValue(err);
            form.metadata = [{ key: 'a' }];
            await form.generateFormFields();
            expect(console.error).toHaveBeenCalledWith('Error creating dynamic form component:', err);
        });
    });

    describe('ngform state accessors', () => {
        it('reflects the underlying form group state', () => {
            form.ngform = new FormGroup({ a: new FormControl('', Validators.required) });
            expect(form.invalid).toBe(true);
            expect(form.valid).toBe(false);
            expect(form.touched).toBe(false);
            expect(form.pristine).toBe(true);
            form.ngform.get('a').setValue('x');
            form.ngform.markAsTouched();
            form.ngform.markAsDirty();
            expect(form.valid).toBe(true);
            expect(form.touched).toBe(true);
            expect(form.pristine).toBe(false);
        });

        it('returns undefined when there is no form group', () => {
            form.ngform = undefined;
            expect(form.invalid).toBeUndefined();
            expect(form.valid).toBeUndefined();
            expect(form.touched).toBeUndefined();
            expect(form.pristine).toBeUndefined();
        });
    });

    it('evaluates a form action expression against the view parent with the event', () => {
        const fn = jest.fn();
        form.viewParent = { fn };
        const evt = { type: 'click' };
        form.invokeActionEvent(evt, 'fn($event)');
        expect(fn).toHaveBeenCalledWith(evt);
        expect(form.context.$event).toBe(evt);
    });

    it('resolves the mode from the operation type or from findOperationType', () => {
        form.operationType = 'insert';
        expect(form.mode).toBe('insert');
        form.operationType = undefined;
        const find = jest.spyOn(form, 'findOperationType').mockReturnValue('update');
        expect(form.mode).toBe('update');
        expect(find).toHaveBeenCalled();
    });
});
