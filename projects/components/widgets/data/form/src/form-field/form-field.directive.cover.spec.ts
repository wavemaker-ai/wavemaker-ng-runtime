import { ComponentFixture } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Component, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { App, FormWidgetType, isMobile, Viewport } from '@wm/core';
import { ListComponent } from '@wm/components/data/list';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { FormFieldDirective } from './form-field.directive';
import { FormComponent } from '../form.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: jest.fn(() => false),
}));

@Component({
    standalone: false,
    template: `<div wmFormField name="field1"></div>`,
})
class HostComponent {
    @ViewChild(FormFieldDirective, { static: true }) wmComponent: FormFieldDirective;
}

const moduleDef = {
    declarations: [HostComponent],
    imports: [ReactiveFormsModule, FormFieldDirective],
    providers: [
        FormBuilder,
        { provide: App, useValue: mockApp },
        { provide: FormComponent, useValue: FormComponent },
        { provide: Viewport, useValue: Viewport },
        { provide: ListComponent, useValue: ListComponent },
    ],
};

const makeForm = (extra: any = {}) =>
    ({
        registerFormFields: jest.fn(),
        onFieldValueChange: jest.fn(),
        ngform: new FormGroup({}),
        formdata: {},
        isUpdateMode: false,
        ...extra,
    } as any);

describe('FormFieldDirective - remaining branches', () => {
    let fixture: ComponentFixture<HostComponent>;
    let field: any;

    beforeEach(() => {
        (isMobile as jest.Mock).mockReturnValue(false);
        fixture = compileTestComponent(moduleDef, HostComponent);
        field = fixture.componentInstance.wmComponent;
        field.form = makeForm();
        field._fieldName = 'name';
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('remembers that the user clicked', () => {
        field._clicktriggeredByUser = false;
        field.handleClick(new MouseEvent('click'));
        expect(field._clicktriggeredByUser).toBe(true);
    });

    it('debounces validator set up', async () => {
        // the core debounce uses the un-patched timers, so a real wait is required
        field.formWidget = {};
        const spy = jest.spyOn(field, 'setUpValidators').mockImplementation(() => undefined);
        spy.mockClear();
        field._debounceSetUpValidators();
        field._debounceSetUpValidators();
        expect(spy).not.toHaveBeenCalled();
        await new Promise(resolve => setTimeout(resolve, 650));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('ignores non-object entries when building the view mode caption', () => {
        field.displayfield = 'label';
        field.formWidget = { datavalue: [{ label: 'a' }, 'plain', { label: 'b' }] };
        expect(field.getDisplayExpr()).toBe('a,b');
    });

    it('getCaption prefers the value and falls back to the form output', () => {
        field.formWidget = { datavalue: 'v1' };
        expect(field.getCaption()).toBe('v1');
        field.formWidget = { datavalue: undefined };
        field.form.dataoutput = { name: 'from-output' };
        expect(field.getCaption()).toBe('from-output');
        field.form.dataoutput = {};
        expect(field.getCaption()).toBe('');
    });

    describe('setUpValidators', () => {
        it('does nothing after the validations were released', () => {
            const setUp = jest.fn();
            field.fieldValidations = null;
            expect(() => field.setUpValidators()).not.toThrow();
            field.fieldValidations = { setUpValidators: setUp };
            field.setUpValidators('custom');
            expect(setUp).toHaveBeenCalledWith('custom');
        });
    });

    describe('onPropertyChange', () => {
        it('does not forward the tabindex to the base widget', () => {
            const base = jest.spyOn(Object.getPrototypeOf(FormFieldDirective.prototype), 'onPropertyChange');
            field.onPropertyChange('tabindex', 2);
            expect(base).not.toHaveBeenCalled();
            field.onPropertyChange('hint', 'h');
            expect(base).toHaveBeenCalled();
        });

        it('marks the form pristine again when initialising required made it dirty', () => {
            let reads = 0;
            Object.defineProperty(field.form, 'dirty', { get: () => ++reads > 1 });
            field.form.markAsPristine = jest.fn();
            jest.spyOn(Object.getPrototypeOf(FormFieldDirective.prototype), 'onPropertyChange').mockImplementation(() => undefined);
            field._debounceSetUpValidators = jest.fn();
            field.onPropertyChange('required', true);
            expect(field.form.markAsPristine).toHaveBeenCalled();
            expect(field._debounceSetUpValidators).toHaveBeenCalled();
        });

        it('leaves the form untouched when required does not change the dirty state', () => {
            field.form.dirty = false;
            field.form.markAsPristine = jest.fn();
            jest.spyOn(Object.getPrototypeOf(FormFieldDirective.prototype), 'onPropertyChange').mockImplementation(() => undefined);
            field._debounceSetUpValidators = jest.fn();
            field.onPropertyChange('required', true);
            expect(field.form.markAsPristine).not.toHaveBeenCalled();
        });

        it('only sets the primary key on the form when the flag is truthy', () => {
            field.form.setPrimaryKey = jest.fn();
            field.onPropertyChange('primary-key', true);
            expect(field.form.setPrimaryKey).toHaveBeenCalledWith('name');
            field.form.setPrimaryKey.mockClear();
            field.onPropertyChange('primary-key', false);
            expect(field.form.setPrimaryKey).not.toHaveBeenCalled();
        });
    });

    describe('onValueChange and floating captions', () => {
        let notify: jest.Mock;
        beforeEach(() => {
            notify = jest.fn();
            field.app = { notify };
            field.formWidget = { multiple: true };
            field._activeField = true;
            field.$element.append('<div class="caption-floating"><input type="text"></div>');
        });

        it('does not animate when there is no floating caption', () => {
            field.$element.find('.caption-floating').remove();
            field.onValueChange('x');
            expect(notify).not.toHaveBeenCalledWith('captionPositionAnimate', expect.anything());
        });

        it('animates the caption for a defined value, including falsy ones such as 0', () => {
            field.onValueChange(0);
            const [evt, payload] = notify.mock.calls.find(c => c[0] === 'captionPositionAnimate');
            expect(evt).toBe('captionPositionAnimate');
            expect(payload.displayVal).toBe(true);
            expect(payload.isSelectMultiple).toBe(true);
            expect(payload.isFocused).toBe(true);
            expect(payload.nativeEl.length).toBe(1);
        });

        it('uses the typed input value when the value is empty', () => {
            field.$element.find('input').val('typed');
            field.onValueChange('');
            expect(notify.mock.calls.find(c => c[0] === 'captionPositionAnimate')[1].displayVal).toBe('typed');
        });

        it('falls back to the autofill detection for empty values', () => {
            const original = $.fn.find;
            let autofillCount = 0;
            jest.spyOn($.fn, 'find').mockImplementation(function (this: any, selector: any) {
                if (typeof selector === 'string' && selector.includes('autofill')) {
                    return { length: autofillCount } as any;
                }
                return original.call(this, selector);
            });
            autofillCount = 1;
            field.onValueChange(null);
            expect(notify.mock.calls.find(c => c[0] === 'captionPositionAnimate')[1].displayVal).toBe(1);
            notify.mockClear();
            autofillCount = 0;
            field.onValueChange(undefined);
            expect(notify.mock.calls.find(c => c[0] === 'captionPositionAnimate')[1].displayVal).toBe(0);
        });
    });

    describe('onStatusChange', () => {
        it('shows the spinner and disables the widget while pending', () => {
            field.formWidget = { disabled: false };
            field.onStatusChange('PENDING');
            expect(field.showPendingSpinner).toBe(true);
            expect(field.formWidget.disabled).toBe(true);
        });

        it('restores the widget disabled state only when it differs from the field state', () => {
            field.disabled = false;
            field.formWidget = { disabled: true };
            field.onStatusChange('VALID');
            expect(field.formWidget.disabled).toBe(false);
            field.formWidget = { disabled: false };
            field.onStatusChange('VALID');
            expect(field.formWidget.disabled).toBe(false);
            expect(field.showPendingSpinner).toBe(false);
        });
    });

    describe('setReadOnlyState', () => {
        let setWidget: jest.SpyInstance;
        beforeEach(() => {
            setWidget = jest.spyOn(field, 'setFormWidget').mockImplementation(() => undefined);
            field.form.isUpdateMode = true;
            field.form.readonly = false;
        });

        it('is read only in view mode', () => {
            field.form.isUpdateMode = false;
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenCalledWith('readonly', true);
        });

        it('leaves assigned primary keys editable for new entries and locks them when updating', () => {
            field['primary-key'] = true;
            field['is-related'] = false;
            field.period = false;
            field.generator = 'assigned';
            field.form.operationType = 'insert';
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', false);
            field.form.operationType = 'update';
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', true);
            field.generator = 'identity';
            field.form.operationType = 'insert';
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', true);
        });

        it('uses the field and form readonly flags for ordinary fields', () => {
            field['primary-key'] = false;
            field.readonly = false;
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', false);
            field.readonly = true;
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', true);
            field.readonly = false;
            field.form.readonly = true;
            field.setReadOnlyState();
            expect(setWidget).toHaveBeenLastCalledWith('readonly', true);
        });
    });

    describe('resetDisplayInput', () => {
        it('resets the widget display input only for empty values', () => {
            const reset = jest.fn();
            field.formWidget = { resetDisplayInput: reset, datavalue: 'abc' };
            field.resetDisplayInput();
            expect(reset).not.toHaveBeenCalled();
            field.formWidget.datavalue = '';
            field.resetDisplayInput();
            expect(reset).toHaveBeenCalledTimes(1);
            field.formWidget.datavalue = undefined;
            field.resetDisplayInput();
            expect(reset).toHaveBeenCalledTimes(2);
        });
    });

    describe('ready state handling', () => {
        let ready: Function;
        beforeEach(() => {
            field.registerReadyStateListener = jest.fn((cb: Function) => { ready = cb; });
            field.formWidget = { widget: {} };
            field.prepareFormWidget();
            field.setReadOnlyState = jest.fn();
            field.widget = { show: true };
        });

        it('builds an empty permitted list for uploads without file type or extensions', () => {
            field.widgettype = FormWidgetType.UPLOAD;
            field.filetype = undefined;
            field.extensions = undefined;
            field.viewport = { isMobileType: false, isTabletType: false };
            field['pc-display'] = true;
            ready();
            expect(field.permitted).toBe('');
        });

        it('keeps the field visible on mobile when it is enabled for mobile', () => {
            (isMobile as jest.Mock).mockReturnValue(true);
            field.viewport = { isMobileType: true };
            field['mobile-display'] = true;
            ready();
            expect(field.widget.show).toBe(true);
        });

        it('keeps the field visible on tablets when it is enabled for tablets', () => {
            field.viewport = { isMobileType: false, isTabletType: true };
            field['tablet-display'] = true;
            ready();
            expect(field.widget.show).toBe(true);
        });
    });

    describe('custom widgets', () => {
        beforeEach(() => {
            field.widgetSubType = 'wm-form-field-custom-widget';
        });

        it('unwraps the inner widget and re-prepares whenever its config changes', () => {
            const configSubject = new Subject<void>();
            const inner = { configSubject };
            field.formWidget = { nativeElement: { widget: inner } };
            const prepare = jest.spyOn(field, 'prepareFormWidget').mockImplementation(() => undefined);
            field.ngAfterContentInit();
            expect(field.formWidget).toBe(inner);
            expect(prepare).not.toHaveBeenCalled();
            configSubject.next();
            expect(prepare).toHaveBeenCalledTimes(1);
        });

        it('keeps the widget when it has no native element', () => {
            const configSubject = new Subject<void>();
            const widget = { configSubject };
            field.formWidget = widget;
            jest.spyOn(field, 'prepareFormWidget').mockImplementation(() => undefined);
            field.ngAfterContentInit();
            expect(field.formWidget).toBe(widget);
        });
    });

    describe('ngOnDestroy', () => {
        it('copes with released helper state', () => {
            field.notifyForFields = null;
            field.fieldDefConfig = null;
            expect(() => field.ngOnDestroy()).not.toThrow();
            expect(field.formWidget).toBeNull();
            expect(field.notifyForFields).toBeNull();
            expect(field.fieldDefConfig).toBeNull();
        });
    });
});
