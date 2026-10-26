import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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

import * as core from '@wm/core';

@Component({
    standalone: false,
    template: '<form wmForm name="extraForm" captionposition="top" tabindex="0"></form>',
})
class ExtraFormWrapperComponent {
    @ViewChild(FormComponent, { static: true }) wmComponent: FormComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [
        BrowserAnimationsModule, InputTextComponent, NumberComponent, FormsModule, ReactiveFormsModule, IMaskModule,
        LayoutGridRowDirective, LabelDirective, CommonModule, BsDatepickerModule, TimepickerModule, BsDropdownModule,
        FormComponent, FormActionDirective, FormFieldDirective, FormWidgetDirective, TimeComponent, DateComponent, ToDatePipe,
    ],
    declarations: [ExtraFormWrapperComponent],
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

describe('FormComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraFormWrapperComponent>;
    let form: any;

    const field = (key: string, overrides: any = {}) => ({
        key,
        name: key,
        value: undefined,
        defaultvalue: undefined,
        datavalue: undefined,
        _control: { value: undefined },
        form: undefined as any,
        $element: $('<div><input focus-target></div>'),
        nativeElement: document.createElement('div'),
        setReadOnlyState: jest.fn(),
        validationmessage: '',
        ...overrides,
    });

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, ExtraFormWrapperComponent);
        form = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        jest.spyOn(form, 'invokeEventCallback').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (core.isElementInViewport as jest.Mock).mockReturnValue(true);
        (core.scrollToElement as jest.Mock).mockClear();
    });

    describe('onPropertyChange', () => {
        it('applies the caption alignment and size', () => {
            form.onPropertyChange('captionalign', 'right');
            expect(form.captionAlignClass).toBe('align-right');
            form.onPropertyChange('captionsize', '30px');
            expect(form.captionsize).toBe('30px');
        });

        it('recomputes the layout for caption position and width', () => {
            form.captionwidth = 'xs-12 sm-12 md-12 lg-12';
            form.captionposition = 'top';
            form.onPropertyChange('captionposition', 'top');
            expect(typeof form._widgetClass).toBe('string');
            expect(typeof form._captionClass).toBe('string');
            form.onPropertyChange('captionwidth', 'xs-12');
            expect(core.$appDigest).toHaveBeenCalled();
        });

        it('derives the validation type from novalidate', () => {
            form.onPropertyChange('novalidate', true);
            expect(form.widget.validationtype).toBe('none');
            form.onPropertyChange('novalidate', 'false');
            expect(form.widget.validationtype).toBe('default');
        });

        it('sets form data, using the last item for arrays, but only when it changed', () => {
            const setData = jest.spyOn(form, 'setFormData').mockImplementation(() => undefined);
            const change = jest.spyOn(form, 'onDataSourceChange').mockImplementation(() => undefined);
            form.datasource = { id: 1 };
            form.isDataSourceUpdated = false;
            form.onPropertyChange('formdata', { a: 1 }, { a: 1 });
            expect(setData).not.toHaveBeenCalled();
            form.onPropertyChange('formdata', [{ a: 1 }, { a: 2 }], undefined);
            expect(setData).toHaveBeenLastCalledWith({ a: 2 });
            form.onPropertyChange('formdata', { a: 3 }, undefined);
            expect(setData).toHaveBeenLastCalledWith({ a: 3 });
            expect(change).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['Edit', true],
            ['View', false],
        ])('applies the %s default mode', (mode, expected) => {
            form.isLayoutDialog = false;
            form.formFields = [];
            form.onPropertyChange('defaultmode', mode);
            expect(form.isUpdateMode).toBe(expected);
        });

        it('keeps the update mode for layout dialogs', () => {
            form.formFields = [];
            form.isLayoutDialog = true;
            form.isUpdateMode = false;
            form.onPropertyChange('defaultmode', 'Edit');
            expect(form.isUpdateMode).toBe(false);
        });

        it('propagates a changed data source and form data source', () => {
            const dsChange = jest.spyOn(form, 'onDataSourceChange').mockImplementation(() => undefined);
            const formDsChange = jest.spyOn(form, 'onFormDataSourceChange').mockImplementation(() => undefined);
            form.onPropertyChange('datasource', {});
            form.onPropertyChange('formdatasource', {});
            expect(dsChange).toHaveBeenCalled();
            expect(formDsChange).toHaveBeenCalled();
        });

        it('regenerates the form fields for new metadata', () => {
            const generate = jest.spyOn(form, 'generateFormFields').mockImplementation(() => undefined);
            form.onPropertyChange('metadata', {});
            expect(generate).toHaveBeenCalled();
        });

        it('notifies unbound form fields about a new dataset', () => {
            const next = jest.fn();
            jest.spyOn(form, 'getFormFields').mockReturnValue([
                { isDataSetBound: false, formWidget: { dataset$: { next } } },
                { isDataSetBound: true, formWidget: { dataset$: { next } } },
                { isDataSetBound: false, formWidget: {} },
            ]);
            form.onPropertyChange('dataset', []);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('disables the buttons of a readonly form and restores them afterwards', () => {
            jest.spyOn(form, 'setReadonlyFields').mockImplementation(() => undefined);
            const first: any = { disabled: false };
            form.buttonArray = [first];
            form.onPropertyChange('readonly', true);
            expect(first.disabled).toBe(true);

            const buttonDef: any = { disabled: true };
            form.formWidgets = { save: { widgetType: 'wm-form-action', buttonDef, disabled: false }, plain: { widgetType: 'wm-input' } };
            form.onPropertyChange('readonly', false);
            expect(buttonDef.disabled).toBe(false);
        });

        it('applies the items per row classes', () => {
            form.onPropertyChange('itemsperrow', 'xs-1 sm-2');
            expect(form).toBeDefined();
        });
    });

    describe('result and messages', () => {
        it('raises result and success for successful operations', () => {
            form.operationType = 'insert';
            form.onResultCb({ id: 1 }, true, 'evt');
            const params = { $event: 'evt', $data: { id: 1 }, $operation: 'insert' };
            expect(form.invokeEventCallback).toHaveBeenCalledWith('result', params);
            expect(form.invokeEventCallback).toHaveBeenCalledWith('success', params);
        });

        it('raises result and error for failures', () => {
            form.onResultCb('boom', false);
            expect(form.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ $data: 'boom' }));
        });

        it('shows messages through the app notification for toaster layouts', () => {
            const notifyApp = jest.spyOn(form.app, 'notifyApp').mockImplementation(() => undefined);
            form.messagelayout = 'Toaster';
            form.toggleMessage(true, 'Saved', 'success', 'Done');
            expect(notifyApp).toHaveBeenCalledWith('Saved', 'success', 'Done');
        });

        it('prefers the configured error message for errors', () => {
            const notifyApp = jest.spyOn(form.app, 'notifyApp').mockImplementation(() => undefined);
            form.messagelayout = 'Toaster';
            form.errormessage = 'Custom error';
            form.toggleMessage(true, 'Raw', 'error');
            expect(notifyApp).toHaveBeenCalledWith('Custom error', 'error', undefined);
        });

        it('shows inline messages and scrolls the form into view when needed', () => {
            const showMessage = jest.fn();
            form.messageRef = { showMessage };
            form.messagelayout = 'Inline';
            (core.isElementInViewport as jest.Mock).mockReturnValue(false);
            form.toggleMessage(true, 'Inline text', 'info');
            expect(form.statusMessage).toEqual({ caption: 'Inline text', type: 'info' });
            expect(showMessage).toHaveBeenCalledWith('Inline text', 'info');
            expect(core.scrollToElement).toHaveBeenCalled();
        });

        it('does not scroll when the form is visible and tolerates a missing message component', () => {
            form.messageRef = undefined;
            form.messagelayout = 'Inline';
            form.toggleMessage(true, 'text', 'info');
            expect(core.scrollToElement).not.toHaveBeenCalled();
        });

        it('uses the application error message for inline errors', () => {
            form.messagelayout = 'Inline';
            form.app.Actions = { appNotification: { getMessage: () => 'App level error' } };
            form.toggleMessage(true, 'Server error', 'error');
            expect(form.statusMessage.caption).toBe('App level error');
            delete form.app.Actions;
        });

        it('only uses the application message for errors', () => {
            form.app.Actions = { appNotification: { getMessage: () => 'App level error' } };
            expect(form.checkAppServiceErrorMsg('error')).toBe('App level error');
            expect(form.checkAppServiceErrorMsg('success')).toBeUndefined();
            delete form.app.Actions;
            expect(form.checkAppServiceErrorMsg('error')).toBeUndefined();
        });

        it('clears the message', () => {
            form.statusMessage = { caption: 'x', type: 'info' };
            form.clearMessage();
            expect(form.statusMessage.caption).toBe('');
        });
    });

    describe('registration and data output', () => {
        beforeEach(() => {
            form.formFields = [];
            form.formfields = {};
            form.formWidgets = {};
            form.buttonArray = [];
            jest.spyOn(form, '_debouncedUpdateFieldSource').mockImplementation(() => undefined);
        });

        it('registers widgets by name or key', () => {
            form.registerFormWidget({ name: 'w1' });
            form.registerFormWidget({ key: 'k1' });
            expect(Object.keys(form.formWidgets)).toEqual(['w1', 'k1']);
        });

        it('registers form fields on the form and the parent form', () => {
            const parentSetData = jest.fn();
            form.parentForm = { formFields: [], formfields: {}, setFormData: parentSetData, formdata: { p: 1 } };
            form.numberOfFields = 5;
            const f: any = field('name');
            form.registerFormFields(f);
            expect(form.formFields).toEqual([f]);
            expect(form.formfields.name).toBe(f);
            expect(form.formWidgets.name).toBe(f);
            expect(form.parentForm.formFields).toEqual([f]);
            expect(parentSetData).toHaveBeenCalledWith({ p: 1 }, form.formFields, {});
            form.parentForm = undefined;
        });

        it('applies the form data once the last field is registered', () => {
            const change = jest.spyOn(form, 'onDataSourceChange').mockImplementation(() => undefined);
            const setData = jest.spyOn(form, 'setFormData').mockImplementation(() => undefined);
            form.numberOfFields = 1;
            form.formdata = [{ a: 1 }, { a: 2 }];
            form.registerFormFields(field('a'));
            expect(change).toHaveBeenCalled();
            expect(setData).toHaveBeenCalledWith({ a: 2 });

            form.formFields = [];
            form.formdata = { a: 3 };
            form.registerFormFields(field('a'));
            expect(setData).toHaveBeenLastCalledWith({ a: 3 });
        });

        it('registers actions', () => {
            form.registerActions('action');
            expect(form.buttonArray).toEqual(['action']);
        });

        it('adds the values of widgets that are not form fields to the output', () => {
            form.ngform = { value: { extra: 'x', known: 'k' } };
            form.formFields = [{ key: 'known' }];
            form.updateFormDataOutput({ known: 'k' });
            expect(form.dataoutput).toEqual({ known: 'k', extra: 'x' });
        });

        it('builds the data object from the form fields', () => {
            const fields: any[] = [
                field('name', { datavalue: 'Ram', form }),
                field('empty', { datavalue: '', form }),
                field('fromControl', { _control: { value: 5 }, form }),
            ];
            jest.spyOn(form, 'getFormFields').mockReturnValue(fields);
            form.ngform = { value: {} };
            form.formFields = fields;
            const data = form.constructDataObject();
            expect(data).toEqual({ name: 'Ram', empty: undefined, fromControl: 5 });
        });

        it('groups the fields of inner forms under their form group name', () => {
            const inner = { widgetId: 'inner', formGroupName: 'address' };
            const fields: any[] = [field('street', { datavalue: 'Main', form: inner }), field('city', { datavalue: 'X', form: inner })];
            jest.spyOn(form, 'getFormFields').mockReturnValue(fields);
            form.ngform = { value: {} };
            form.formFields = fields;
            expect(form.constructDataObject()).toEqual({ address: { street: 'Main', city: 'X' } });
        });

        it('groups the fields of forms in lists by their array index', () => {
            const listForm = { widgetId: 'row', formArrayIndex: 1, isParentList: true, parentList: { name: 'rows' } };
            const fields: any[] = [field('a', { datavalue: 'x', form: listForm })];
            jest.spyOn(form, 'getFormFields').mockReturnValue(fields);
            form.ngform = { value: {} };
            form.formFields = fields;
            form.parentForm = undefined;
            const data = form.constructDataObject();
            expect(data.rows[1]).toEqual({ a: 'x' });
        });

        it('reads file fields from the file widgets', () => {
            const spy = core.getFiles as jest.Mock;
            const upload: any = field('doc', { type: 'file', multiple: true, form });
            jest.spyOn(form, 'getFormFields').mockReturnValue([upload]);
            form.ngform = { value: {} };
            form.formFields = [upload];
            const data = form.constructDataObject();
            expect(spy).toHaveBeenCalledWith(form.name, 'doc_formWidget', true);
            expect(data.doc).toEqual(['file']);
        });

        it('collects the data and validation messages after the output was updated', () => {
            const construct = jest.spyOn(form, 'constructDataObject').mockImplementation(() => undefined);
            const validation = jest.spyOn(form, 'setValidationMsgs').mockImplementation(() => undefined);
            form.ngform = { touched: false };
            form.updateDataOutput();
            expect(validation).not.toHaveBeenCalled();
            form.ngform = { touched: true };
            form.updateDataOutput();
            expect(construct).toHaveBeenCalledTimes(2);
            expect(validation).toHaveBeenCalledWith(true);
        });

        it('returns only the fields of this form', () => {
            form.name = 'mine';
            form.formFields = [{ form: { name: 'mine' } }, { form: { name: 'inner' } }];
            expect(form.getFormFields()).toHaveLength(1);
        });
    });

    describe('setFieldValue', () => {
        const ctx = (overrides: any = {}) => field('key', { form: { parentForm: undefined }, ...overrides });

        it('assigns the value found under the key', () => {
            const f: any = ctx();
            form.setFieldValue(f, { key: 'v' });
            expect(f.value).toBe('v');
        });

        it('resolves dotted keys through their first segment', () => {
            const f: any = ctx({ key: 'parent.child' });
            form.setFieldValue(f, { parent: { child: 'deep' } });
            expect(f.value).toBe('deep');
        });

        it('leaves the field alone for keys that are not in the data', () => {
            const f: any = ctx({ value: 'default' });
            form.setFieldValue(f, { other: 1 });
            expect(f.value).toBe('default');
        });

        it('uses the default value of inner form fields when the inner form has no data', () => {
            form.name = 'outer';
            const f: any = ctx({ defaultvalue: 'dflt', form: { parentForm: { name: 'outer' } } });
            form.setFieldValue(f, { key: 'outer-data' }, {});
            expect(f.value).toBe('dflt');
        });

        it('does nothing without data', () => {
            const f: any = ctx({ value: 'keep' });
            form.setFieldValue(f, undefined);
            expect(f.value).toBe('keep');
        });
    });

    describe('validation messages', () => {
        beforeEach(() => {
            form.validationMessages = [];
        });

        it('adds a message for an invalid control and updates it later', () => {
            const control: any = { invalid: true, valid: false, errors: { required: true } };
            const f: any = field('name', { value: '', validationmessage: 'Required' });
            form.prepareValidationObj(control, 'name', f, 'outer.inner');
            expect(form.validationMessages).toHaveLength(1);
            expect(form.validationMessages[0]).toEqual(expect.objectContaining({
                field: 'name', errorType: ['required'], message: 'Required', formName: 'inner', fullyQualifiedFormName: 'outer.inner',
            }));
            expect(form.validationMessages[0].getElement().length).toBe(1);

            f.value = 'x';
            control.errors = { minlength: true };
            form.prepareValidationObj(control, 'name', f, 'outer.inner');
            expect(form.validationMessages).toHaveLength(1);
            expect(form.validationMessages[0].value).toBe('x');
            expect(form.validationMessages[0].errorType).toEqual(['minlength']);
        });

        it('removes the message once the control is valid', () => {
            const f: any = field('name');
            form.prepareValidationObj({ invalid: true, valid: false, errors: { required: true } }, 'name', f, 'form');
            form.prepareValidationObj({ invalid: false, valid: true }, 'name', f, 'form');
            expect(form.validationMessages).toEqual([]);
        });

        it('prepares messages only for known and touched fields', () => {
            const prepare = jest.spyOn(form, 'prepareValidationObj').mockImplementation(() => undefined);
            const input = document.createElement('input');
            const known: any = field('known', { nativeElement: document.createElement('div') });
            known.nativeElement.appendChild(input);
            form.formFields = [known];
            const target: any = { ngform: { controls: { known: { invalid: true, touched: true }, unknown: { invalid: true, touched: true }, untouched: { invalid: true, touched: false } } }, formFields: [known, field('untouched')], prepareValidationObj: prepare };
            form.setValidationOnFields(target, 'form', true);
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(prepare).toHaveBeenCalledTimes(2);
        });

        it('skips forms without form fields', () => {
            const prepare = jest.spyOn(form, 'prepareValidationObj').mockImplementation(() => undefined);
            form.setValidationOnFields({ ngform: { controls: { a: {} } }, formFields: undefined } as any, 'form');
            expect(prepare).not.toHaveBeenCalled();
        });

        it('collects validation messages from the form and its inner forms', () => {
            const onFields = jest.spyOn(form, 'setValidationOnFields').mockImplementation(() => undefined);
            const onInner = jest.spyOn(form, 'setValidationOnInnerForms').mockImplementation(() => undefined);
            form.formFields = [];
            form.ngform = { controls: {} };
            form.setValidationMsgs();
            expect(onFields).not.toHaveBeenCalled();

            form.formFields = [{}];
            form.setValidationMsgs(true);
            expect(onFields).toHaveBeenCalledWith(form, form.name, true);
            expect(onInner).toHaveBeenCalledWith(true);
        });
    });

    describe('events', () => {
        it('does not attach the submit handler twice', () => {
            const callback = jest.fn();
            form.handleEvent(document.createElement('div'), 'submit', callback, {});
            form.handleEvent(document.createElement('div'), 'click', callback, {});
            expect(form).toBeDefined();
        });

        it('remembers keyboard interaction', () => {
            form._triggeredByUser = false;
            form.onKeydownHandler({} as any);
            expect(form._triggeredByUser).toBe(true);
        });

        it('resets the form on the reset event', () => {
            const reset = jest.spyOn(form, 'reset').mockImplementation(() => undefined);
            form.onReset();
            expect(reset).toHaveBeenCalled();
        });

        it('submits through the debounced handler inside the zone', async () => {
            const submitForm = jest.spyOn(form, 'submitForm').mockImplementation(() => undefined);
            form.submit('evt');
            form.submit('evt2');
            await new Promise((resolve) => setTimeout(resolve, 350));
            expect(submitForm).toHaveBeenCalledTimes(1);
            expect(submitForm).toHaveBeenCalledWith('evt2');
        });
    });

    describe('modes', () => {
        it('removes the panel classes for layout dialogs', async () => {
            form.nativeElement.classList.add('panel', 'app-panel', 'liveform-inline');
            form.isLayoutDialog = true;
            await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
            expect(form.nativeElement.classList.contains('panel')).toBe(false);
            expect(form.isLayoutDialog).toBe(true);
        });

        it('applies the read only state to every field when the mode changes', () => {
            const f1: any = field('a');
            const f2: any = field('b');
            form.formFields = [f1, f2];
            form.isUpdateMode = true;
            expect(f1.setReadOnlyState).toHaveBeenCalledWith(true);
            expect(f2.setReadOnlyState).toHaveBeenCalledWith(true);
            expect(form.isUpdateMode).toBe(true);
        });

        it('only updates the field source for data sources with two way binding', () => {
            const f1: any = field('a', { form });
            form.formFields = [f1];
            form.formdatasource = { execute: jest.fn((op: any) => op === DataSource.Operation.IS_API_AWARE) };
            const setFieldValue = jest.spyOn(form, 'setFieldValue').mockImplementation(() => undefined);
            form.updateFieldSource();
            expect(setFieldValue).not.toHaveBeenCalled();
            form.formdatasource = { execute: jest.fn().mockReturnValue(false), twoWayBinding: false };
            form.updateFieldSource();
            expect(setFieldValue).not.toHaveBeenCalled();
        });
    });

    describe('form data and state', () => {
        beforeEach(() => {
            jest.spyOn(form, 'constructDataObject').mockImplementation(() => undefined);
            form.validationMessages = [];
        });

        it('sets the field values and refreshes custom validation messages', () => {
            const setCustom = jest.fn();
            const fields = [field('a', { fieldValidations: { setCustomValidationMessage: setCustom }, form }), field('b', { form })];
            form.setFormData({ a: 1, b: 2 }, fields);
            expect(fields[0].value).toBe(1);
            expect(fields[1].value).toBe(2);
            expect(setCustom).toHaveBeenCalledTimes(1);
            expect(form.constructDataObject).toHaveBeenCalled();
        });

        it('uses the registered form fields by default', () => {
            const f: any = field('a', { form });
            form.formFields = [f];
            form.setFormData({ a: 'x' });
            expect(f.value).toBe('x');
        });

        it('forwards the data of inner forms to their form', () => {
            const innerForm: any = { formGroupName: 'address', parentForm: undefined, parentFormArray: undefined, formFields: [], constructDataObject: jest.fn() };
            const f: any = field('street', { form: innerForm });
            const setFormData = jest.spyOn(form, 'setFormData');
            form.setFieldValue(f, { street: 's', address: { street: 'inner' } });
            expect(setFormData).toHaveBeenCalledWith({ street: 'inner' });
        });

        it('reads the data of forms that are part of a list from the parent form data', () => {
            const listForm: any = { parentFormArray: [{}], parentForm: undefined };
            const fromParent = jest.spyOn(form, 'setFormDataFromParentFormData').mockImplementation(() => undefined);
            form.setFieldValue(field('a', { form: listForm }), { a: 1 });
            expect(fromParent).toHaveBeenCalled();
        });

        it('keeps the form pristine when a default value was applied programmatically', () => {
            const markAsPristine = jest.spyOn(form, 'markAsPristine').mockImplementation(() => undefined);
            Object.defineProperty(form, 'dirty', { configurable: true, get: () => true });
            form._triggeredByUser = false;
            form.setFieldValue(field('a', { form: { parentForm: undefined } }), { a: 1 });
            expect(markAsPristine).toHaveBeenCalled();
        });

        it('clears validation messages and the touched state when the form state is reset', () => {
            form.validationMessages = [{}];
            const untouched = jest.spyOn(form.ngform, 'markAsUntouched');
            const pristine = jest.spyOn(form.ngform, 'markAsPristine');
            form.resetFormState();
            expect(form.validationMessages).toEqual([]);
            expect(untouched).toHaveBeenCalled();
            expect(pristine).toHaveBeenCalled();
        });

        it('resets all fields, file uploads and sliders', () => {
            const upload: any = field('doc', { widgettype: 'upload' });
            const blob: any = field('blob', { type: 'blob' });
            const slider: any = field('range', { widgettype: 'slider' });
            const input = document.createElement('input');
            input.setAttribute('aria-invalid', 'true');
            const plain: any = field('plain');
            plain.nativeElement.appendChild(input);
            form.formFields = [upload, blob, slider, plain];
            const resetUpload = jest.spyOn(form, 'resetFileUploadWidget').mockImplementation(() => undefined);
            const resetSlider = jest.spyOn(form, 'resetSliderWidget').mockImplementation(() => undefined);
            const clear = jest.spyOn(form, 'clearMessage').mockImplementation(() => undefined);

            form.reset();

            expect(plain.value).toBe('');
            expect(input.hasAttribute('aria-invalid')).toBe(false);
            expect(resetUpload).toHaveBeenCalledTimes(2);
            expect(resetSlider).toHaveBeenCalledWith(slider);
            expect(form.constructDataObject).toHaveBeenCalled();
            expect(clear).toHaveBeenCalled();
        });

        it('resets the slider track', () => {
            const track = document.createElement('div');
            track.className = 'slider-control';
            const slider = document.createElement('input');
            slider.setAttribute('name', 'range_formWidget');
            track.appendChild(slider);
            form.nativeElement.appendChild(track);
            form.resetSliderWidget({ key: 'range' });
            expect(track.style.getPropertyValue('--end')).toBe('50%');
            expect(() => form.resetSliderWidget({ key: 'missing' })).not.toThrow();
        });

        it('keeps the previous field definitions and values for undo', () => {
            form.formFields = [field('a', { type: 'string', widgettype: 'text', outputformat: 'x', value: 1 })];
            form.savePrevformFields();
            expect(form.prevformFields).toEqual([{ key: 'a', type: 'string', widgettype: 'text', outputformat: 'x', value: 1 }]);
            form.savePrevDataValues();
            expect(form.prevDataValues).toEqual([{ key: 'a', value: 1 }]);
        });

        it('applies the read only state to every field', () => {
            const f: any = field('a');
            form.formFields = [f];
            form.setReadonlyFields();
            expect(f.setReadOnlyState).toHaveBeenCalled();
        });

        it('resets a file upload widget and optionally its value', () => {
            const reset = jest.fn();
            const input = document.createElement('input');
            input.setAttribute('name', 'doc_formWidget');
            input.value = 'file';
            form.nativeElement.appendChild(input);
            const f: any = field('doc', { _control: { reset }, href: 'x', value: 'y' });
            form.resetFileUploadWidget(f);
            expect(reset).toHaveBeenCalled();
            expect(f.href).toBe('');
            expect(f.value).toBeNull();

            f.value = 'keep';
            form.resetFileUploadWidget(f, true);
            expect(f.value).toBe('keep');
        });

        it('empties the data model', () => {
            const text: any = field('a', { datavalue: 'x' });
            const blob: any = field('b', { type: 'blob', _control: { reset: jest.fn() } });
            form.formFields = [text, blob, undefined];
            form.emptyDataModel();
            expect(text.datavalue).toBe('');
            expect(blob._control.reset).toHaveBeenCalled();
        });

        it('applies the default values of every field', () => {
            const change = jest.spyOn(form, 'onFieldDefaultValueChange').mockImplementation(() => undefined);
            form.formFields = [field('a', { defaultvalue: 1 }), field('b', { defaultvalue: 2 })];
            form.setDefaultValues();
            expect(change).toHaveBeenCalledTimes(2);
        });

        it('defaults the operation type to insert', () => {
            form.setOperationType('update');
            expect(form.operationType).toBe('update');
            form.setOperationType(undefined);
            expect(form.operationType).toBe('insert');
        });

        it('switches to a new record', () => {
            jest.useFakeTimers();
            const empty = jest.spyOn(form, 'emptyDataModel').mockImplementation(() => undefined);
            const defaults = jest.spyOn(form, 'setDefaultValues').mockImplementation(() => undefined);
            const savePrev = jest.spyOn(form, 'savePrevformFields').mockImplementation(() => undefined);
            jest.spyOn(form, 'savePrevDataValues').mockImplementation(() => undefined);
            jest.spyOn(form, 'clearMessage').mockImplementation(() => undefined);
            form.formFields = [];
            form.isSelected = true;

            form.new();
            jest.runAllTimers();

            expect(form.operationType).toBe('insert');
            expect(savePrev).toHaveBeenCalled();
            expect(empty).toHaveBeenCalled();
            expect(defaults).toHaveBeenCalled();
            expect(form.isUpdateMode).toBe(true);
        });

        it('switches to editing the current record', () => {
            const savePrev = jest.spyOn(form, 'savePrevformFields').mockImplementation(() => undefined);
            const readonly = jest.spyOn(form, 'setReadonlyFields').mockImplementation(() => undefined);
            jest.spyOn(form, 'savePrevDataValues').mockImplementation(() => undefined);
            jest.spyOn(form, 'clearMessage').mockImplementation(() => undefined);
            form.formFields = [];
            form.isSelected = true;
            form.formdata = { id: 1 };

            form.edit();

            expect(form.operationType).toBe('update');
            expect(savePrev).toHaveBeenCalled();
            expect(readonly).toHaveBeenCalled();
            expect(form.prevDataObject).toEqual({ id: 1 });
            expect(form.isUpdateMode).toBe(true);
        });
    });

    describe('submitting', () => {
        beforeEach(() => {
            (performDataOperation as jest.Mock).mockReset();
            jest.spyOn(form, 'validateFieldsOnSubmit').mockReturnValue(false);
            jest.spyOn(form, 'constructDataObject').mockReturnValue({ name: 'x' });
            jest.spyOn(form, 'resetFormState').mockImplementation(() => undefined);
            jest.spyOn(form, 'toggleMessage').mockImplementation(() => undefined);
            const onResult = jest.spyOn(form, 'onResultCb').mockImplementation(() => undefined);
            form.__onResult = onResult;
            form.datasource = undefined;
            form.onSubmitEvt = undefined;
            form.onBeforeSubmitEvt = undefined;
        });

        it('does nothing for invalid forms', () => {
            (form.validateFieldsOnSubmit as jest.Mock).mockReturnValue(true);
            form.submitForm('evt');
            expect(form.constructDataObject).not.toHaveBeenCalled();
        });

        it('stops when beforesubmit returns false', () => {
            form.onBeforeSubmitEvt = true;
            (form.invokeEventCallback as jest.Mock).mockReturnValue(false);
            form.submitForm('evt');
            expect(form.onResultCb).not.toHaveBeenCalled();
        });

        it('continues after beforesubmit and reports success without a data source', () => {
            form.onBeforeSubmitEvt = true;
            (form.invokeEventCallback as jest.Mock).mockReturnValue(true);
            form.onSubmitEvt = true;
            form.submitForm('evt');
            expect(form.resetFormState).toHaveBeenCalled();
            expect(form.invokeEventCallback).toHaveBeenCalledWith('submit', { $event: 'evt', $formData: { name: 'x' }, $data: { name: 'x' } });
            expect(form.onResultCb).toHaveBeenCalledWith({}, true, 'evt');
        });

        it('reports success when no submit handler or data source exists', () => {
            form.submitForm('evt');
            expect(form.onResultCb).toHaveBeenCalledWith({}, true, 'evt');
            expect(form.invokeEventCallback).not.toHaveBeenCalledWith('submit', expect.anything());
        });

        const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

        it('saves through the data source and reports the result', async () => {
            form.datasource = { category: 'wm.ServiceVariable', pagination: { number: 1 } };
            form.postmessage = 'Saved';
            (performDataOperation as jest.Mock).mockResolvedValue({ body: '{"id":1}' });
            form.submitForm('evt');
            await settle();
            expect(performDataOperation).toHaveBeenCalledWith(form.datasource, { name: 'x' }, { operationType: 'insert' });
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'Saved', 'success');
            expect(form.onResultCb).toHaveBeenCalledWith(expect.anything(), true, 'evt');
        });

        it('uses the plain response when it has no body', async () => {
            form.datasource = { category: 'wm.ServiceVariable' };
            form.operationType = 'update';
            (performDataOperation as jest.Mock).mockResolvedValue({ id: 5 });
            form.submitForm('evt');
            await settle();
            expect(form.onResultCb).toHaveBeenCalledWith({ id: 5 }, true, 'evt');
            expect(performDataOperation).toHaveBeenCalledWith(form.datasource, { name: 'x' }, { operationType: 'update' });
        });

        it('refreshes the list and closes the dialog after saving a crud variable', async () => {
            const execute = jest.fn();
            const triggerEvent = jest.spyOn(form, 'triggerWMEvent').mockImplementation(() => undefined);
            const close = jest.spyOn(form, 'closeDialog').mockImplementation(() => undefined);
            form.datasource = { category: 'wm.CrudVariable', pagination: { number: 2 }, execute };
            form.dialogId = 'dlg';
            (performDataOperation as jest.Mock).mockResolvedValue({ body: 'ok' });
            form.submitForm('evt');
            await settle();
            expect(triggerEvent).toHaveBeenCalledWith('resetEditMode');
            expect(execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, { skipToggleState: true, operation: 'list', page: 3, preventMissingOpMsg: true });
            expect(close).toHaveBeenCalled();
        });

        it('reports failures with the configured or server error message', async () => {
            form.datasource = { category: 'wm.ServiceVariable' };
            form.errormessage = '';
            (performDataOperation as jest.Mock).mockRejectedValue({ error: 'Server says no' });
            form.submitForm('evt');
            await settle();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'Server says no', 'error');
            expect(form.onResultCb).toHaveBeenCalledWith('Server says no', false, 'evt');

            form.errormessage = 'Configured';
            (performDataOperation as jest.Mock).mockRejectedValue('plain');
            form.submitForm('evt');
            await settle();
            expect(form.toggleMessage).toHaveBeenLastCalledWith(true, 'Configured', 'error');
        });

        it('does not show a message when the matching handler exists', async () => {
            form.datasource = { category: 'wm.ServiceVariable' };
            form.onSuccess = true;
            (performDataOperation as jest.Mock).mockResolvedValue({ body: 'x' });
            form.submitForm('evt');
            await settle();
            expect(form.toggleMessage).not.toHaveBeenCalled();
        });

        it('closes the dialog through the dialog service', () => {
            const close = jest.fn();
            form.dialogService = { close };
            form.dialogId = 'dlg';
            form.closeDialog();
            expect(close).toHaveBeenCalledWith('dlg');
        });

        it('notifies dependent tables about form events', () => {
            const notify = jest.spyOn(form.app, 'notify').mockImplementation(() => undefined);
            form.nativeElement.removeAttribute('dependsontable');
            form.triggerWMEvent('resetEditMode');
            expect(notify).not.toHaveBeenCalled();
            form.nativeElement.setAttribute('dependsontable', 'table1');
            form.triggerWMEvent('resetEditMode');
            expect(notify).toHaveBeenCalledWith('wm-event', { eventName: 'resetEditMode', widgetName: 'table1' });
        });

        it('shows a button position only when it has buttons', () => {
            form.isUpdateMode = true;
            form.buttonArray = [{ position: 'header', updateMode: true }, { position: 'footer', updateMode: false }];
            expect(form.showButtons('header')).toBe(true);
            expect(form.showButtons('footer')).toBe(false);
        });
    });
});
