import { FormControl } from '@angular/forms';
import * as core from '@wm/core';
import { BaseFieldValidations } from './base-field-validations';

describe('BaseFieldValidations - behaviour', () => {
    let instance: any;
    let formwidget: any;
    let control: FormControl;
    let context: any;
    let watchSpy: jest.SpyInstance;
    let unwatchSpy: jest.SpyInstance;

    const create = (widgettype = 'text', tableFieldType?: string) =>
        new BaseFieldValidations(instance, formwidget, widgettype, control, context, tableFieldType);

    beforeEach(() => {
        instance = {
            show: true,
            widgetId: 'w1',
            widget: {},
            value: 'x',
            registerDestroyListener: jest.fn(),
            viewParent: {},
            onStatusChange: jest.fn(),
            validationmessage: '',
        };
        formwidget = { prevDatavalue: 'old' };
        control = new FormControl('');
        context = { ngform: { touched: false } };
        watchSpy = jest.spyOn(core, '$watch').mockReturnValue('watch-handle' as any);
        unwatchSpy = jest.spyOn(core, '$unwatch').mockReturnValue(true as any);
    });

    afterEach(() => {
        watchSpy.mockRestore();
        unwatchSpy.mockRestore();
    });

    describe('default validators', () => {
        const errorsOf = (validations: BaseFieldValidations, value: any) => {
            validations.applyDefaultValidators();
            control.setValue(value);
            return control.errors;
        };

        it('adds nothing for a hidden field', () => {
            instance.show = false;
            instance.required = true;
            expect(errorsOf(create(), '')).toBeNull();
        });

        it('requires a value for regular fields', () => {
            instance.required = true;
            expect(errorsOf(create(), '')).toEqual({ required: true });
            expect(errorsOf(create(), 'a')).toBeNull();
        });

        it('requires a true value for checkboxes and toggles', () => {
            instance.required = true;
            instance.checkedvalue = true;
            expect(errorsOf(create('checkbox'), false)).toEqual({ required: true });
            expect(errorsOf(create('toggle'), false)).toEqual({ required: true });
            expect(errorsOf(create('toggle'), true)).toBeNull();
        });

        it('matches the checked value for checkboxes with a custom checked value', () => {
            instance.required = true;
            instance.checkedvalue = 'yes';
            const validations = create('checkbox');
            expect(errorsOf(validations, 'no')).toHaveProperty('pattern');
            expect(errorsOf(validations, 'yes')).toBeNull();
        });

        it.each(['date', 'time', 'datetime'])('requires a value for %s fields through the trailing check', (type) => {
            instance.required = true;
            expect(errorsOf(create(type), '')).toEqual({ required: true });
        });

        it('limits the number of characters', () => {
            instance.maxchars = 3;
            expect(errorsOf(create(), 'abcd')).toHaveProperty('maxlength');
            expect(errorsOf(create(), 'abc')).toBeNull();
        });

        it('limits the minimum and maximum value', () => {
            instance.minvalue = 5;
            instance.maxvalue = 10;
            expect(errorsOf(create(), 2)).toHaveProperty('min');
            expect(errorsOf(create(), 20)).toHaveProperty('max');
            expect(errorsOf(create(), 7)).toBeNull();
        });

        it('ignores the maximum value for ratings', () => {
            instance.maxvalue = 5;
            expect(errorsOf(create('rating'), 20)).toBeNull();
        });

        it('applies a regular expression', () => {
            instance.regexp = '^[a-z]+$';
            expect(errorsOf(create(), '123')).toHaveProperty('pattern');
            expect(errorsOf(create(), 'abc')).toBeNull();
        });

        it('includes the validate function of the form widget', () => {
            formwidget.validate = jest.fn().mockReturnValue({ custom: true });
            expect(errorsOf(create(), 'a')).toEqual({ custom: true });
        });
    });

    describe('setUpValidators', () => {
        it('applies the validators once and skips subsequent calls', () => {
            instance.required = true;
            const validations = create();
            const setValidators = jest.spyOn(control, 'setValidators');
            validations.setUpValidators();
            expect(setValidators).toHaveBeenCalledTimes(1);
            expect(instance._validators.length).toBe(1);

            validations.setValidators([]);
            validations.setUpValidators();
            expect(setValidators).toHaveBeenCalledTimes(2);
        });

        it('adds the custom validator', () => {
            const custom = jest.fn();
            create().setUpValidators(custom);
            expect(instance._validators).toContain(custom);
        });

        it('does not touch the control without a form', () => {
            context.ngform = undefined;
            const setValidators = jest.spyOn(control, 'setValidators');
            create().setUpValidators();
            expect(setValidators).not.toHaveBeenCalled();
        });

        it('keeps the value change quiet when the value did not change', () => {
            const update = jest.spyOn(control, 'updateValueAndValidity');
            instance.value = 'old';
            create().setUpValidators();
            expect(update).toHaveBeenCalledWith({ emitEvent: false });
        });

        it('keeps the value change quiet when the value is empty', () => {
            const update = jest.spyOn(control, 'updateValueAndValidity');
            instance.value = '';
            create().setUpValidators();
            expect(update).toHaveBeenCalledWith({ emitEvent: false });
        });

        it('emits the value change otherwise', () => {
            const update = jest.spyOn(control, 'updateValueAndValidity');
            create().setUpValidators();
            expect(update).toHaveBeenCalledWith({});
        });
    });

    describe('setValidators', () => {
        it('binds custom validator functions to the control and the context', () => {
            const validations = create();
            const received: any[][] = [];
            const custom = function (...args: any[]) {
                received.push(args);
                return { bad: true };
            };
            validations.setValidators([custom]);
            control.setValue('a');
            expect(received.length).toBeGreaterThan(0);
            expect(received[received.length - 1][0]).toBe(control);
            expect(received[received.length - 1][1]).toBe(context);
            expect(control.errors).toEqual({ bad: true });
        });

        it('turns default validator definitions into widget properties', () => {
            const validations = create();
            validations.setValidators([{ type: 'maxchars', validator: 7, errorMessage: 'Too long' }]);
            expect(instance.widget.maxchars).toBe(7);
            expect(instance.maxchars).toBe(7);
        });

        it('also sets the property on the inner widget of custom widgets', () => {
            instance.formWidget = { baseWidget: {} };
            const validations = create('custom-widget');
            validations.setValidators([{ type: 'maxchars', validator: 7 }]);
            expect(instance.formWidget.baseWidget.maxchars).toBe(7);
        });

        it('watches default validators that are bound to a function', () => {
            const validations = create();
            validations.setValidators([{ type: 'required', validator: () => true }]);
            expect(unwatchSpy).toHaveBeenCalledWith('w1_required_formField');
            expect(watchSpy).toHaveBeenCalled();
            expect(instance.registerDestroyListener).toHaveBeenCalledWith('watch-handle');

            const listener = watchSpy.mock.calls[0][3];
            listener(true, false);
            expect(instance.widget.required).toBe(true);
        });
    });

    describe('setCustomValidationMessage', () => {
        it('does nothing when the control is valid', () => {
            const validations = create();
            validations.setCustomValidationMessage();
            expect(instance.validationmessage).toBe('');
        });

        it('uses the errorMessage of the error', () => {
            control.setErrors({ errorMessage: 'Custom' });
            create().setCustomValidationMessage();
            expect(instance.validationmessage).toBe('Custom');
        });

        it('uses the message configured for the default validator', () => {
            const validations = create();
            validations.setValidators([{ type: 'required', errorMessage: 'Please fill this', validator: true }]);
            control.setErrors({ required: true });
            validations.setCustomValidationMessage();
            expect(instance.validationmessage).toBe('Please fill this');
        });

        it('evaluates message functions with the control and the context', () => {
            const validations = create();
            const received: any[] = [];
            const message = (c: any, ctx: any) => {
                received.push([c, ctx]);
                return 'computed';
            };
            validations.setValidators([{ type: 'required', errorMessage: message, validator: true }]);
            control.setErrors({ required: true });
            validations.setCustomValidationMessage();
            expect(received[received.length - 1][0]).toBe(control);
            expect(received[received.length - 1][1]).toBe(context);
            expect(instance.validationmessage).toBe('computed');
        });

        it('falls back to the validation type of the form widget', () => {
            formwidget.validateType = 'custom';
            instance.validationmessage = 'preset';
            control.setErrors({ somethingElse: true });
            create().setCustomValidationMessage();
            expect(instance.validationmessage).toBe('preset');
        });

        it('clears the message for errors without any message source', () => {
            instance.validationmessage = 'stale';
            control.setErrors({ somethingElse: true });
            create().setCustomValidationMessage();
            expect(instance.validationmessage).toBe('');
        });
    });

    describe('async validation', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        const settle = async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        };

        it('collects the promises returned by the validators', () => {
            const validations = create();
            const promise = Promise.resolve();
            const list = validations.getPromiseList([() => promise, promise, 'text', () => 'not a promise']);
            expect(list).toEqual([promise, promise]);
        });

        it('clears the validation message once all validators resolve', async () => {
            const validations = create();
            validations.setAsyncValidators([() => Promise.resolve()]);
            const validatorFn = (control as any)._rawAsyncValidators[0];
            instance.validationmessage = 'old';
            const result = validatorFn();
            await settle();
            await expect(result).resolves.toBeNull();
            expect(instance.validationmessage).toBe('');
        });

        it('uses the errorMessage of a rejected validator', async () => {
            const validations = create();
            validations.setAsyncValidators([() => Promise.reject({ errorMessage: 'Taken' })]);
            const validatorFn = (control as any)._rawAsyncValidators[0];
            const result = validatorFn();
            await settle();
            await expect(result).resolves.toEqual({ errorMessage: 'Taken' });
            expect(instance.validationmessage).toBe('Taken');
        });

        it('uses the first key of a rejection without errorMessage', async () => {
            const validations = create();
            validations.setAsyncValidators([() => Promise.reject({ code: 42 })]);
            const validatorFn = (control as any)._rawAsyncValidators[0];
            const result = validatorFn();
            await settle();
            await result;
            expect(instance.validationmessage).toBe('42');
        });

        it('reports the control status once it is no longer pending', async () => {
            const validations = create('text', 'quickedit');
            validations.setAsyncValidators([() => Promise.resolve()]);
            const validatorFn = (control as any)._rawAsyncValidators[0];
            const result = validatorFn();
            await settle();
            await result;

            Object.defineProperty(control, 'status', { configurable: true, get: () => 'PENDING' });
            jest.advanceTimersByTime(100);
            expect(instance.onStatusChange).not.toHaveBeenCalled();

            Object.defineProperty(control, 'status', { configurable: true, get: () => 'VALID' });
            jest.advanceTimersByTime(100);
            expect(instance.onStatusChange).toHaveBeenCalledWith('VALID', 'quickedit');
        });

        it('re-validates immediately when the form was touched', () => {
            context.ngform.touched = true;
            const update = jest.spyOn(control, 'updateValueAndValidity');
            create().setAsyncValidators([]);
            expect(update).toHaveBeenCalledWith({});
        });

        it('keeps the change quiet when re-validating an unchanged value', () => {
            context.ngform.touched = true;
            instance.value = 'old';
            const update = jest.spyOn(control, 'updateValueAndValidity');
            create().setAsyncValidators([]);
            expect(update).toHaveBeenCalledWith({ emitEvent: false });
        });
    });

    describe('validate', () => {
        it('re-applies validators, re-runs async validation and marks the touched control', () => {
            context.ngform.touched = true;
            const validations = create();
            validations.setAsyncValidators([]);
            const markAsTouched = jest.spyOn(control, 'markAsTouched');
            const update = jest.spyOn(control, 'updateValueAndValidity');

            validations.validate();

            expect(update).toHaveBeenCalled();
            expect(markAsTouched).toHaveBeenCalledTimes(1);
        });

        it('only applies validators when no async validation is configured', () => {
            const validations = create();
            const setAsync = jest.spyOn(control, 'setAsyncValidators');
            validations.validate();
            expect(setAsync).not.toHaveBeenCalled();
        });
    });

    describe('observeOn', () => {
        it('registers the instance on the fields it depends on', () => {
            const dependent: any = { key: 'a' };
            const other: any = { key: 'b', notifyForFields: [] };
            context.formfields = [dependent, other];
            create().observeOn(['a', 'b', 'missing'], 'formfields');
            expect(dependent.notifyForFields).toEqual([instance]);
            expect(other.notifyForFields).toEqual([instance]);
        });
    });

    describe('isDefaultValidator / isNullOrEmptyOrFalsy', () => {
        it('recognises the default validators case insensitively', () => {
            const validations = create();
            expect(validations.isDefaultValidator('required')).toBeTruthy();
            expect(validations.isDefaultValidator('MaxChars')).toBeTruthy();
            expect(validations.isDefaultValidator('custom')).toBeFalsy();
        });

        it('treats empty values as empty', () => {
            const validations = create();
            expect(validations.isNullOrEmptyOrFalsy('')).toBe(true);
            expect(validations.isNullOrEmptyOrFalsy(null)).toBe(true);
            expect(validations.isNullOrEmptyOrFalsy('a')).toBe(false);
        });
    });

    describe('destroy', () => {
        it('releases every reference', () => {
            const validations = create();
            validations.setValidators([{ type: 'required', errorMessage: 'm', validator: true }]);
            validations.setAsyncValidators([]);
            validations.destroy();
            expect((validations as any).instance).toBeNull();
            expect((validations as any).formwidget).toBeNull();
            expect((validations as any).widgetControl).toBeNull();
            expect((validations as any).widgetContext).toBeNull();
            expect((validations as any)._syncValidators).toEqual([]);
            expect((validations as any)._asyncValidatorFn).toBeNull();
            expect((validations as any).defaultValidatorMessages).toEqual([]);
        });

        it('copes with an instance that never had validators', () => {
            const validations = create();
            (validations as any)._syncValidators = undefined;
            (validations as any).defaultValidatorMessages = undefined;
            expect(() => validations.destroy()).not.toThrow();
        });
    });
});
