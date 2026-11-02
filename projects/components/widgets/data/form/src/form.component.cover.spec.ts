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
class CoverFormWrapperComponent {
    @ViewChildren(FormComponent) forms: QueryList<FormComponent>;
}

// referencing the classes keeps their static prop registration (initializeProps) from being elided
export const coverRegisteredFlavours = [LiveFormDirective, LiveFilterDirective];

const moduleDef: ITestModuleDef = {
    imports: [
        BrowserAnimationsModule, InputTextComponent, NumberComponent, FormsModule, ReactiveFormsModule, IMaskModule,
        LayoutGridRowDirective, LabelDirective, CommonModule, BsDatepickerModule, TimepickerModule, BsDropdownModule,
        FormComponent, FormActionDirective, FormFieldDirective, FormWidgetDirective, TimeComponent, DateComponent, ToDatePipe,
    ],
    declarations: [CoverFormWrapperComponent],
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

describe('FormComponent (cover)', () => {
    let fixture: ComponentFixture<CoverFormWrapperComponent>;
    let forms: any[];
    let form: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CoverFormWrapperComponent);
        fixture.detectChanges();
        forms = fixture.componentInstance.forms.toArray();
        form = forms[0];
    }));

    const defGet = (name: string, value: any) => Object.defineProperty(form, name, { get: () => value, configurable: true });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('validateFieldsOnSubmit', () => {
        const fakeEle = (isForm: boolean, attrs: any = {}, focusLen = 0) => {
            const found: any = { length: focusLen, hasClass: () => false, focus: jest.fn() };
            const parent: any = { find: jest.fn(() => ({ length: 0, first: () => ({ length: 0 }), ...found })) };
            const ele: any = {
                is: () => isForm,
                attr: (n: string) => attrs[n],
                parent: () => parent,
                find: () => ({ first: () => ele })
            };
            return ele;
        };

        beforeEach(() => {
            jest.spyOn(form, 'setValidationMsgs').mockImplementation(() => undefined);
            jest.spyOn(form, 'highlightInvalidFields').mockImplementation(() => undefined);
            form.operationType = 'insert';
            form.validationtype = 'default';
            form.ngform.setErrors({ bad: true });
        });

        it('looks the invalid inner form up by name and returns the element itself when no inner control exists', () => {
            const ele = fakeEle(true, { name: 'inner' });
            defGet('$element', { find: () => ({ first: () => ele }) });
            expect(form.validateFieldsOnSubmit()).toBe(true);
            expect(form.highlightInvalidFields).toHaveBeenCalledTimes(1);
        });

        it('recurses into an inner form found by its formControlName', () => {
            const inner: any = { controls: {} };
            form.ngform.controls['grp'] = inner;
            const innerEle = fakeEle(false, {});
            const outerEle: any = fakeEle(true, { formControlName: 'grp' });
            outerEle.find = () => ({ first: () => innerEle });
            defGet('$element', { find: () => ({ first: () => outerEle }) });
            expect(form.validateFieldsOnSubmit()).toBe(true);
            delete form.ngform.controls['grp'];
        });

        it('returns false when the form stops being invalid between the two checks', () => {
            defGet('$element', { find: () => ({ first: () => fakeEle(false) }) });
            jest.spyOn(form.ngform, 'invalid', 'get').mockReturnValueOnce(true).mockReturnValueOnce(false);
            expect(form.validateFieldsOnSubmit()).toBe(false);
        });
    });

    it('ignores components without a name when registering form widgets', () => {
        jest.useFakeTimers();
        form.componentRefs = [{}, { name: 'w1' }];
        form.formWidgets = {};
        form.ngAfterContentInit();
        jest.advanceTimersByTime(300);
        expect(Object.keys(form.formWidgets)).toEqual(['w1']);
    });

    it('findOperationType is a no-op', () => {
        expect(form.findOperationType()).toBeUndefined();
    });

    describe('readonly property change', () => {
        it('re-enables nothing when there are no form widgets', () => {
            jest.spyOn(form, 'setReadonlyFields').mockImplementation(() => undefined);
            form.formWidgets = undefined;
            expect(() => form.onPropertyChange('readonly', false)).not.toThrow();
        });

        it('defaults a form action button to enabled when the action has no disabled flag', () => {
            jest.spyOn(form, 'setReadonlyFields').mockImplementation(() => undefined);
            const action: any = { widgetType: 'wm-form-action', buttonDef: { disabled: true } };
            form.formWidgets = { a: action, b: { widgetType: 'other' } };
            form.onPropertyChange('readonly', false);
            expect(action.buttonDef.disabled).toBe(false);
        });
    });

    it('treats an unset form data as an empty object when editing', () => {
        jest.spyOn(form, 'setReadonlyFields').mockImplementation(() => undefined);
        form.formdata = undefined;
        form.edit();
        expect(form.prevDataObject).toEqual({});
    });

    describe('registerFormFields with a parent form', () => {
        it('passes an empty object to the parent when the inner form has no data', () => {
            const parent: any = { formFields: [], formfields: {}, formdata: { p: 1 }, setFormData: jest.fn() };
            form.parentForm = parent;
            form.formdata = undefined;
            jest.spyOn(form, 'registerFormWidget').mockImplementation(() => undefined);
            form._debouncedUpdateFieldSource = jest.fn();
            const field = { key: 'k' };
            form.registerFormFields(field);
            expect(parent.setFormData).toHaveBeenCalledWith({ p: 1 }, form.formFields, {});
            expect(parent.formfields.k).toBe(field);
        });
    });

    describe('constructDataObject field names', () => {
        const field = (extra: any) => ({ _control: { value: 'v' }, form: { widgetId: undefined, name: 'x' }, ...extra });

        it('names the value by key, then target, then name', () => {
            form.widgetId = 'w';
            const fields = [field({ key: 'k' }), field({ target: 't' }), field({ name: 'n' })];
            fields.forEach(f => (f.form as any).widgetId = 'w');
            jest.spyOn(form, 'getFormFields').mockReturnValue(fields);
            const upd = jest.spyOn(form, 'updateFormDataOutput').mockImplementation(() => undefined);
            form.constructDataObject();
            expect(upd).toHaveBeenCalledWith({ k: 'v', t: 'v', n: 'v' });
        });
    });

    describe('setFieldValue', () => {
        it('falls back to the field name as the key', () => {
            const f: any = { name: 'nm', form: {} };
            form.setFieldValue(f, { nm: 'val' });
            expect(f.value).toBe('val');
        });

        it('ignores a dotted key whose root is missing from the data', () => {
            const f: any = { key: 'a.b', form: {}, value: 'orig' };
            form.setFieldValue(f, { other: 1 });
            expect(f.value).toBe('orig');
        });
    });

    describe('submitForm', () => {
        const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
        beforeEach(() => {
            (performDataOperation as jest.Mock).mockReset();
            jest.spyOn(form, 'validateFieldsOnSubmit').mockReturnValue(false);
            jest.spyOn(form, 'constructDataObject').mockReturnValue({ name: 'x' });
            jest.spyOn(form, 'resetFormState').mockImplementation(() => undefined);
            jest.spyOn(form, 'toggleMessage').mockImplementation(() => undefined);
            jest.spyOn(form, 'onResultCb').mockImplementation(() => undefined);
        });

        it('does not close a dialog after saving a crud variable when the form is not in a dialog', async () => {
            const close = jest.spyOn(form, 'closeDialog').mockImplementation(() => undefined);
            jest.spyOn(form, 'triggerWMEvent').mockImplementation(() => undefined);
            form.datasource = { category: 'wm.CrudVariable', execute: jest.fn() };
            form.dialogId = undefined;
            (performDataOperation as jest.Mock).mockResolvedValue({ body: 'ok' });
            form.submitForm('e');
            await settle();
            expect(close).not.toHaveBeenCalled();
            expect(form.datasource.execute).toHaveBeenCalledTimes(1);
        });

        it('reports a plain error value as the message when no error message is configured', async () => {
            form.datasource = { category: 'wm.ServiceVariable' };
            form.errormessage = '';
            (performDataOperation as jest.Mock).mockRejectedValue('plain failure');
            form.submitForm('e');
            await settle();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'plain failure', 'error');
        });
    });

    describe('setFormDataFromParentFormData', () => {
        it('does nothing without a parent form or without data', () => {
            const set = jest.spyOn(form, 'setFormData').mockImplementation(() => undefined);
            form.formdata = undefined;
            form.parentForm = undefined;
            form.setFormDataFromParentFormData({ a: 1 });
            form.parentForm = { name: 'p' };
            form.setFormDataFromParentFormData(undefined);
            expect(set).not.toHaveBeenCalled();
        });

        describe('inside a list', () => {
            let set: jest.SpyInstance;
            beforeEach(() => {
                set = jest.spyOn(form, 'setFormData').mockImplementation(() => undefined);
                form.formdata = undefined;
                form.parentForm = { formGroupName: 'grp' };
                defGet('parentFormArray', { patchValue: jest.fn() });
                defGet('parentList', { name: 'rows' });
                defGet('formArrayIndex', 1);
            });

            it('keeps the bound form data when the form is bound to formdata', () => {
                form.bindformdata = 'Variables.x';
                form.setFormDataFromParentFormData({ rows: [{ a: 1 }, { a: 2 }] });
                expect(form.parentFormArray.patchValue).toHaveBeenCalledWith([{ a: 1 }, { a: 2 }]);
                expect(form.formdata).toBeUndefined();
                expect(set).toHaveBeenCalledWith(undefined);
            });

            it('does nothing further when there are no child array data and the form is not in a parent list', () => {
                defGet('isParentList', false);
                form.setFormDataFromParentFormData({});
                expect(set).not.toHaveBeenCalled();
            });
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
        });

        it('defaults to one column, reuses an existing container and an existing dynamic context', async () => {
            form.$element.find('.form-elements').append('<div wmlayoutgrid></div>');
            form._isGridLayoutPresent = true;
            form.onBeforeRenderEvt = 'x';
            form.invokeEventCallback = jest.fn().mockReturnValue(undefined);
            form.metadata = [{ key: 'a' }];
            const ctx: any = { form: 'preset' };
            form._dynamicContext = ctx;
            await form.generateFormFields();
            expect(provider.getComponentFactoryRef.mock.calls[0][1]).toContain('columnwidth="12"');
            expect(form._dynamicContext).toBe(ctx);
        });

        it('does not prepend a second dynamic container when one already exists', async () => {
            form._isGridLayoutPresent = false;
            form.$element.find('.form-elements').append('<div class="dynamic-form-container"></div>');
            form.metadata = [{ key: 'a' }];
            await form.generateFormFields();
            expect(form.$element.find('.form-elements .dynamic-form-container').length).toBe(1);
        });
    });

    it('destroys cleanly without a dynamic form ref', () => {
        form.dynamicFormRef = undefined;
        expect(() => form.ngOnDestroy()).not.toThrow();
    });
});
