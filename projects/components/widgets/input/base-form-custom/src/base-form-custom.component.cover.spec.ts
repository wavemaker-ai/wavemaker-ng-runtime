import { FormControlName } from '@angular/forms';

jest.mock('@wm/components/input/base-form', () => {
    const calls: any = { ngOnInit: jest.fn(), ngOnDestroy: jest.fn(), invokeOnChange: jest.fn(), updatePrevDatavalue: jest.fn(), onPropertyChange: jest.fn(), invokeEventCallback: jest.fn() };
    class BaseFormComponent {
        inj: any;
        isDestroyed = false;
        datavalue: any;
        ngOnInit() { calls.ngOnInit(); }
        ngOnDestroy() { calls.ngOnDestroy(); }
        invokeOnChange(...a: any[]) { calls.invokeOnChange(...a); }
        updatePrevDatavalue(...a: any[]) { calls.updatePrevDatavalue(...a); }
        onPropertyChange(...a: any[]) { calls.onPropertyChange(...a); }
        invokeEventCallback(...a: any[]) { calls.invokeEventCallback(...a); }
    }
    (BaseFormComponent as any).calls = calls;
    return { BaseFormComponent };
});

import { BaseFormCustomComponent } from './base-form-custom.component';
import { BaseFormComponent } from '@wm/components/input/base-form';

const calls: any = (BaseFormComponent as any).calls;

class Custom extends (BaseFormCustomComponent as any) {
    show = true;
    required = true;
    constructor(inj: any) {
        super();
        this.inj = inj;
    }
}

describe('BaseFormCustomComponent - real implementation', () => {
    let formControl: any;
    let cmp: any;
    const make = (control: any = null) => {
        formControl = control;
        Object.values(calls).forEach((c: any) => c.mockClear());
        cmp = new Custom({ get: jest.fn().mockReturnValue(control) });
        cmp.ngOnInit();
        return cmp;
    };

    it('looks up the form control on init and exposes it', () => {
        const control = { valueAccessor: { widgetSubType: 'wm-text' } };
        make(control);
        expect(cmp.inj.get).toHaveBeenCalledWith(FormControlName, null);
        expect(cmp.formControl).toBe(control);
    });

    it('has harmless default callbacks', () => {
        make();
        expect(cmp._onChange('x')).toBeUndefined();
        expect(cmp._onTouched()).toBeUndefined();
        expect(() => cmp.invokeOnChange('v')).not.toThrow();
        expect(() => cmp.invokeOnTouched()).not.toThrow();
    });

    it('registers the change and touch callbacks', () => {
        make();
        const change = jest.fn();
        const touch = jest.fn();
        cmp.registerOnChange(change);
        cmp.registerOnTouched(touch);
        cmp.invokeOnChange('v');
        cmp.invokeOnTouched();
        expect(change).toHaveBeenCalledWith('v');
        expect(touch).toHaveBeenCalled();
    });

    describe('writeValue', () => {
        it('ignores writes on a destroyed widget', () => {
            make({ valueAccessor: { widgetSubType: 'wm-text' } });
            cmp.isDestroyed = true;
            cmp.registerOnChange(jest.fn());
            cmp.writeValue('x');
            expect(cmp.datavalue).toBeUndefined();
            expect(calls.updatePrevDatavalue).not.toHaveBeenCalled();
        });
        it('ignores writes for custom widgets', () => {
            make({ valueAccessor: { widgetSubType: 'wm-custom-foo' } });
            const change = jest.fn();
            cmp.registerOnChange(change);
            cmp.writeValue('x');
            expect(cmp.datavalue).toBeUndefined();
            expect(change).not.toHaveBeenCalled();
        });
        it('sets the data value for form controlled widgets', () => {
            make({ valueAccessor: { widgetSubType: 'wm-text' } });
            const change = jest.fn();
            cmp.registerOnChange(change);
            cmp.writeValue('x');
            expect(cmp.datavalue).toBe('x');
            expect(calls.onPropertyChange).toHaveBeenCalledWith('datavalue', 'x');
            expect(calls.updatePrevDatavalue).toHaveBeenCalledWith('x');
            expect(change).not.toHaveBeenCalled();
        });
        it('pushes the data value to the model when it differs from the written one', () => {
            make(null);
            const change = jest.fn();
            cmp.registerOnChange(change);
            cmp.datavalue = 'default';
            cmp.writeValue('other');
            expect(change).toHaveBeenCalledWith('default');
            change.mockClear();
            cmp.writeValue('default');
            expect(change).not.toHaveBeenCalled();
        });
    });

    describe('invokeOnChange', () => {
        it('forwards to the base class when an event is given', () => {
            make();
            const change = jest.fn();
            cmp.registerOnChange(change);
            const ev = { type: 'change' };
            cmp.invokeOnChange('v', ev);
            expect(calls.invokeOnChange).toHaveBeenCalledWith('v', ev);
            expect(change).toHaveBeenCalledWith('v');
        });
        it('updates the previous value only for valid changes without event', () => {
            make();
            cmp.registerOnChange(jest.fn());
            cmp.invokeOnChange('v', undefined, true);
            expect(calls.updatePrevDatavalue).toHaveBeenCalledWith('v');
            calls.updatePrevDatavalue.mockClear();
            cmp.invokeOnChange('v', undefined, false);
            expect(calls.updatePrevDatavalue).not.toHaveBeenCalled();
        });
        it('works without registered callbacks', () => {
            make();
            cmp._onChange = null;
            expect(() => cmp.invokeOnChange('v', undefined, true)).not.toThrow();
        });
    });

    describe('invokeOnTouched and focus', () => {
        it('raises blur only with an event and tolerates a missing callback', () => {
            make();
            cmp._onTouched = null;
            const ev = {} as any;
            cmp.invokeOnTouched();
            expect(calls.invokeEventCallback).not.toHaveBeenCalled();
            cmp.invokeOnTouched(ev);
            expect(calls.invokeEventCallback).toHaveBeenCalledWith('blur', { $event: ev });
        });
        it('raises focus', () => {
            make();
            const ev = {} as any;
            cmp.invokeOnFocus(ev);
            expect(calls.invokeEventCallback).toHaveBeenCalledWith('focus', { $event: ev });
        });
    });

    describe('validate', () => {
        const run = (value: any) => { make(); return cmp.validate({ value }); };
        it('requires a value when required', () => {
            expect(run(undefined)).toEqual({ required: true });
            expect(run(null)).toEqual({ required: true });
            expect(run('')).toEqual({ required: true });
            expect(run('a')).toBeNull();
        });
        it('treats zero as a number value but not NaN', () => {
            expect(run(0)).toBeNull();
            expect(run(5)).toBeNull();
            expect(run(NaN)).toEqual({ required: true });
        });
        it('checks the content of objects and arrays', () => {
            expect(run(null)).toEqual({ required: true });
            expect(run([])).toEqual({ required: true });
            expect(run({})).toEqual({ required: true });
            expect(run([1])).toBeNull();
            expect(run({ a: 1 })).toBeNull();
        });
        it('is valid when not required or hidden', () => {
            make();
            cmp.required = false;
            expect(cmp.validate({ value: '' })).toBeNull();
            cmp.required = true;
            cmp.show = false;
            expect(cmp.validate({ value: '' })).toBeNull();
        });
    });

    it('releases its callbacks on destroy', () => {
        make({ valueAccessor: {} });
        cmp.ngOnDestroy();
        expect(calls.ngOnDestroy).toHaveBeenCalled();
        expect(cmp.formControl).toBeNull();
        expect(cmp._onChange).toBeNull();
        expect(cmp._onTouched).toBeNull();
    });
});
