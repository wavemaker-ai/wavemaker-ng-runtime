import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AbstractI18nService, App, setPipeProvider } from '@wm/core';
import { INPUTMODE, TrailingZeroDecimalPipe } from '@wm/components/base';
import { PipeProvider } from '../../../../../runtime-base/src/services/pipe-provider.service';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { NumberComponent } from './number.component';

@Component({
    standalone: false,
    template: `<div wmNumber name="num" ngModel></div>`,
})
class HostComponent {
    @ViewChild(NumberComponent, { static: true }) wmComponent: NumberComponent;
    constructor(pipeProvider: PipeProvider) {
        setPipeProvider(pipeProvider);
    }
}

const moduleDef = {
    imports: [FormsModule, NumberComponent],
    declarations: [HostComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe },
    ],
};

const keyEvent = (key: string, value = '', extra: any = {}): any => ({
    key,
    code: extra.code,
    ctrlKey: !!extra.ctrlKey,
    target: { value, selectionStart: extra.selectionStart ?? value.length },
    preventDefault: jest.fn(),
});

describe('NumberLocale (via NumberComponent) - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.step = 1;
        cmp.decimalplaces = NaN;
        cmp.minvalue = NaN;
        cmp.maxvalue = NaN;
        cmp.inputmode = INPUTMODE.NATURAL;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('datavalue setter', () => {
        it.each([[null], [undefined], ['']])('clears the widget for the empty value %p', (val) => {
            cmp.datavalue = 5;
            cmp.isDefaultQuery = true;
            cmp.datavalue = val as any;
            expect(cmp.datavalue).toBeNull();
            expect(cmp.displayValue).toBeNull();
            expect(cmp.inputEl.nativeElement.value).toBe('');
        });

        it('raises a change when a user removed the value', () => {
            const change = jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
            cmp.isDefaultQuery = false;
            cmp.prevDatavalue = 3;
            cmp.datavalue = '';
            expect(change).toHaveBeenCalledWith('');
        });

        it('parses numbers and formats the display value', () => {
            cmp.datavalue = 1234.5;
            expect(cmp.datavalue).toBe(1234.5);
            expect(cmp.displayValue).toBe('1,234.5');
        });

        it('accepts localized strings', () => {
            cmp.datavalue = '1,234.56';
            expect(cmp.datavalue).toBe(1234.56);
        });

        it('triggers change for user entries but not for defaults', () => {
            const change = jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
            cmp.isDefaultQuery = true;
            cmp.datavalue = 5;
            expect(change).not.toHaveBeenCalled();
            cmp.isDefaultQuery = false;
            cmp.datavalue = 6;
            expect(change).toHaveBeenCalledWith(6);
        });

        it('treats separator-only input as invalid', () => {
            const change = jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
            cmp.isDefaultQuery = false;
            cmp.datavalue = '.';
            expect(cmp.datavalue).toBeNull();
            expect(cmp.displayValue).toBe('.');
            expect(change).toHaveBeenCalledWith(null);
        });

        it('keeps a trailing decimal while the user is typing', () => {
            cmp.isDefaultQuery = false;
            jest.spyOn($.fn, 'find').mockReturnValue({ length: 1 } as any);
            cmp.ngModelOptions = { updateOn: 'change' };
            cmp.datavalue = '3.';
            expect(cmp.lastValIsDecimal).toBe(true);
            expect(cmp.displayValue).toBe('3.');
        });

        it('limits decimals in natural mode with decimalplaces', () => {
            jest.spyOn(cmp, 'getAttr').mockImplementation((k: any) => (k === 'decimalplaces' ? '2' : ''));
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.isDefaultQuery = true;
            cmp.decimalplaces = 2;
            cmp.datavalue = 3.14159 as any;
            expect(cmp.datavalue).toBe(3.14);
        });

        it('drops decimals when decimalplaces is zero', () => {
            jest.spyOn(cmp, 'getAttr').mockImplementation((k: any) => (k === 'decimalplaces' ? '0' : ''));
            cmp.isDefaultQuery = true;
            cmp.decimalplaces = 0;
            cmp.datavalue = '7.9';
            expect(cmp.datavalue).toBe(7);
        });

        it('pads the decimals of localized strings with decimalplaces', () => {
            jest.spyOn(cmp, 'getAttr').mockImplementation((k: any) => (k === 'decimalplaces' ? '1' : ''));
            cmp.isDefaultQuery = true;
            cmp.decimalplaces = 1;
            cmp.datavalue = '5.67';
            expect(cmp.datavalue).toBe(5.6);
            cmp.datavalue = '8';
            expect(cmp.datavalue).toBe(8);
        });
    });

    describe('validation', () => {
        it('flags values outside the range but keeps them', () => {
            cmp.minvalue = 5;
            cmp.maxvalue = 10;
            cmp.datavalue = 2;
            expect(cmp.datavalue).toBe(2);
            expect(cmp.validate({ value: 2 })).toEqual({ numberNotInRange: { valid: false } });
            expect(cmp.validateType).toBe('minvalue');
            cmp.datavalue = 11;
            expect(cmp.validateType).toBe('maxvalue');
            cmp.datavalue = 7;
            expect(cmp.validate({ value: 7 })).toBeNull();
        });

        it('rejects values with more decimals than the step allows', () => {
            cmp.step = 0.1;
            expect(cmp.isValid(1.25)).toBe(false);
            expect(cmp.validate({ value: 1 })).toEqual({ invalidNumber: { valid: false } });
            expect(cmp.validateType).toBe('');
            expect(cmp.isValid(1.2)).toBe(true);
        });

        it('rejects values with more decimals than decimalplaces in natural mode', () => {
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.decimalplaces = 1;
            expect(cmp.isValid(1.23)).toBe(false);
            expect(cmp.isValid(1.2)).toBe(true);
        });

        it('rejects NaN and infinite values', () => {
            expect(cmp.isValid(NaN)).toBe(false);
            expect(cmp.isValid(Infinity)).toBe(false);
        });

        it('reports pattern errors and required values', () => {
            cmp.invalidPattern = true;
            expect(cmp.validate({ value: 1 })).toEqual({ pattern: { valid: false } });
            cmp.invalidPattern = false;
            cmp.show = true;
            cmp.required = true;
            expect(cmp.validate({ value: '' })).toEqual({ required: true });
            expect(cmp.validate({ value: 0 })).toBeNull();
            expect(cmp.validate({ value: 4 })).toBeNull();
        });

        it('re-validates when the range properties change', () => {
            const valid = jest.spyOn(cmp, 'isValid');
            cmp.onPropertyChange('minvalue', 3);
            cmp.onPropertyChange('maxvalue', 9);
            expect(valid).toHaveBeenCalledTimes(2);
        });
    });

    describe('parseNumber', () => {
        it.each([
            ['1,234', 1234],
            ['1,234.56', 1234.56],
            ['-123.45', -123.45],
            ['-0.5', -0.5],
            ['0.25', 0.25],
            ['12', 12],
        ])('parses %s', (text, expected) => {
            expect(cmp.parseNumber(text)).toBe(expected);
        });

        it.each([['1.2.3'], ['5.'], ['abc'], ['1.x']])('rejects %s', (text) => {
            expect(cmp.parseNumber(text)).toBeNaN();
        });

        it('uses the dot as a separator for financial values formatted without the locale separator', () => {
            cmp.inputmode = INPUTMODE.FINANCIAL;
            expect(cmp.parseNumber('12.34')).toBe(12.34);
        });
    });

    describe('countDecimals', () => {
        it.each([
            [0, 0],
            [1, 0],
            [1.25, 2],
            [1e-7, 7],
            [1.5e-7, 8],
            [1e21, 0],
            ['abc', 0],
        ])('counts decimals of %p', (value, expected) => {
            expect(cmp.countDecimals(value)).toBe(expected);
        });
    });

    describe('step length and currency detection', () => {
        it('returns the decimal length of the step', () => {
            cmp.step = 0.25;
            expect(cmp.stepLength()).toBe(2);
            cmp.step = 1;
            expect(cmp.stepLength()).toBeUndefined();
        });

        it('returns decimalplaces for the natural mode constant string', () => {
            cmp.inputmode = 'INPUTMODE.NATURAL';
            cmp.decimalplaces = 3;
            expect(cmp.stepLength()).toBe(3);
        });

        it('detects natural currency inputs', () => {
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.widgetType = 'wm-currency';
            cmp.trailingzero = true;
            expect(cmp.isNaturalCurrency()).toBe(true);
            cmp.widgetType = 'wm-number';
            expect(cmp.isNaturalCurrency()).toBe(false);
        });
    });

    describe('display text', () => {
        it('applies the trailing zero pattern check', () => {
            cmp.trailingzero = true;
            cmp.regexPattern = '^\\d+$';
            cmp.proxyModel = 1234;
            cmp.updateDisplayText();
            expect(cmp.invalidPattern).toBe(true);
            cmp.regexPattern = '.*';
            cmp.updateDisplayText();
            expect(cmp.invalidPattern).toBe(false);
        });

        it('formats financial values with the step precision', () => {
            cmp.inputmode = INPUTMODE.FINANCIAL;
            cmp.step = 0.01;
            cmp.proxyModel = 5;
            cmp.updateDisplayText();
            expect(cmp.displayValue).toBe('5.00');
        });

        it('restores the cursor position when updating on default and user typing', () => {
            const input = cmp.inputEl.nativeElement;
            const set = jest.spyOn(input, 'setSelectionRange');
            cmp.updateon = 'default';
            cmp.isDefaultQuery = false;
            cmp.proxyModel = 12;
            input.value = '12';
            cmp.updateDisplayText();
            expect(set).toHaveBeenCalled();
            cmp.resetCursorPosition(100);
            expect(set).toHaveBeenLastCalledWith(0, 0);
        });
    });

    describe('onInputChange', () => {
        beforeEach(() => {
            jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
            cmp.ngModelOptions = { updateOn: 'change' };
            cmp.widgetType = 'wm-number';
        });

        it('returns for undefined or empty values without a data value', () => {
            cmp.onInputChange(undefined);
            cmp.proxyModel = null;
            cmp.onInputChange('');
            expect(cmp.handleChange).not.toHaveBeenCalled();
        });

        it('raises changes for number widgets with a previous or current value', () => {
            cmp.proxyModel = 3;
            cmp.onInputChange('3');
            expect(cmp.handleChange).toHaveBeenCalledWith('3');
        });

        it('skips the first change of an empty number widget', () => {
            cmp.proxyModel = null;
            jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue(undefined);
            cmp.onInputChange('5');
            expect(cmp.handleChange).not.toHaveBeenCalled();
        });

        it('compares previous data in financial mode', () => {
            cmp.inputmode = INPUTMODE.FINANCIAL;
            cmp.step = 1;
            cmp.proxyModel = 4;
            jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue(4);
            cmp.onInputChange('4');
            expect(cmp.handleChange).not.toHaveBeenCalled();
            (cmp.getPrevDataValue as jest.Mock).mockReturnValue(2);
            cmp.onInputChange('4');
            expect(cmp.handleChange).toHaveBeenCalledWith('4');
        });

        it('always raises changes for currency widgets', () => {
            cmp.widgetType = 'wm-currency';
            cmp.onInputChange('9');
            expect(cmp.handleChange).toHaveBeenCalledWith('9');
        });

        describe('financial entry', () => {
            beforeEach(() => {
                cmp.inputmode = INPUTMODE.FINANCIAL;
                cmp.step = 0.01;
                cmp.widgetType = 'wm-currency';
            });

            it('shifts the digits for user input and updates the data value on change', () => {
                cmp.isDefaultQuery = false;
                cmp.onInputChange('1234');
                expect(cmp.datavalue).toBe(12.34);
            });

            it('formats defaults as they are', () => {
                cmp.isDefaultQuery = true;
                cmp.onInputChange('5.5');
                expect(cmp.datavalue).toBe(5.5);
            });

            it('only updates the display value when not updating on change', () => {
                cmp.isDefaultQuery = false;
                cmp.ngModelOptions = { updateOn: 'blur' };
                cmp.onInputChange('250');
                expect(cmp.displayValue).toBe('2.50');
            });

            it('clears the value for non numeric input unless updating on blur', () => {
                cmp.isDefaultQuery = false;
                cmp.onInputChange('abc');
                expect(cmp.datavalue).toBeNull();
                (cmp.handleChange as jest.Mock).mockClear();
                cmp.ngModelOptions = { updateOn: 'blur' };
                cmp.onInputChange('abc');
                expect(cmp.handleChange).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('checkForTrailingZeros', () => {
        it('re-validates a trailing decimal that is no longer being typed', () => {
            const model = jest.spyOn(cmp, 'onModelChange').mockImplementation(() => undefined);
            cmp.lastValIsDecimal = true;
            cmp.displayValue = '3.';
            cmp.checkForTrailingZeros({ type: 'blur' });
            expect(model).toHaveBeenCalledWith('3.');
        });

        it('does nothing for plain natural numbers', () => {
            const t = jest.spyOn(cmp, 'transformNumber');
            cmp.checkForTrailingZeros({ type: 'focus' });
            expect(t).not.toHaveBeenCalled();
        });

        it('shows fixed precision on focus in financial mode', () => {
            cmp.inputmode = INPUTMODE.FINANCIAL;
            cmp.trailingzero = false;
            cmp.step = 0.01;
            cmp.proxyModel = 3;
            cmp.checkForTrailingZeros({ type: 'focus' });
            expect(cmp.displayValue).toBe('3.00');
            cmp.checkForTrailingZeros({ type: 'blur' });
            expect(cmp.displayValue).toBe('3');
        });

        it('shows fixed precision on blur for natural currency', () => {
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.widgetType = 'wm-currency';
            cmp.trailingzero = true;
            cmp.step = 0.01;
            cmp.proxyModel = 3;
            cmp.checkForTrailingZeros({ type: 'blur' });
            expect(cmp.displayValue).toBe('3.00');
        });
    });

    describe('arrow keys', () => {
        const press = (key: string, value = '') => {
            const ev: any = { preventDefault: jest.fn(), target: { value } };
            cmp.onArrowPress(ev, key);
            return ev;
        };

        it('increments and decrements the model', () => {
            cmp.proxyModel = 5;
            press('UP');
            expect(cmp.datavalue).toBe(6);
            press('DOWN');
            expect(cmp.datavalue).toBe(5);
        });

        it('prefers the text of the input', () => {
            cmp.proxyModel = 1;
            press('UP', '1,010');
            expect(cmp.datavalue).toBe(1011);
        });

        it('starts from the minimum when empty', () => {
            cmp.proxyModel = null;
            cmp.minvalue = 4;
            press('UP');
            expect(cmp.datavalue).toBe(4);
        });

        it('is ignored for readonly widgets or zero steps', () => {
            cmp.proxyModel = 5;
            cmp.readonly = true;
            press('UP');
            cmp.readonly = false;
            cmp.step = 0;
            press('UP');
            expect(cmp.datavalue).toBe(5);
        });

        it('does not go beyond the range', () => {
            cmp.proxyModel = 10;
            cmp.maxvalue = 10;
            press('UP');
            expect(cmp.datavalue).toBe(10);
        });

        it('recovers from an out of range text value', () => {
            cmp.numberNotInRange = true;
            cmp.minvalue = 5;
            cmp.inputEl.nativeElement.value = '2';
            cmp.proxyModel = 2;
            press('UP', '');
            expect(cmp.datavalue).toBe(5);
            expect(cmp.numberNotInRange).toBe(false);
        });

        it('keeps decimals precise', () => {
            cmp.step = 0.1;
            cmp.proxyModel = 0.2;
            press('UP');
            expect(cmp.datavalue).toBe(0.3);
        });
    });

    describe('validateInputEntry', () => {
        it('lets control and navigation keys through', () => {
            expect(cmp.validateInputEntry(keyEvent('a', '', { ctrlKey: true }))).toBeUndefined();
            ['Backspace', 'ArrowRight', 'ArrowLeft', 'Tab', 'Enter', 'Delete'].forEach((k) => {
                expect(cmp.validateInputEntry(keyEvent(k))).toBeUndefined();
            });
            expect(cmp.isDefaultQuery).toBe(false);
        });

        it('accepts digits and rejects letters', () => {
            expect(cmp.validateInputEntry(keyEvent('5', '12'))).toBeUndefined();
            expect(cmp.validateInputEntry(keyEvent('x', '12'))).toBe(false);
        });

        it('rejects input beyond 15 digits unless a range is selected in the widget', () => {
            expect(cmp.validateInputEntry(keyEvent('1', '1234567890123456'))).toBe(false);
            jest.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '12', focusNode: cmp.nativeElement } as any);
            expect(cmp.validateInputEntry(keyEvent('1', '1234567890123456'))).toBe(true);
        });

        it('restricts decimals in natural mode', () => {
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.decimalplaces = 0;
            expect(cmp.validateInputEntry(keyEvent('.', '12'))).toBe(false);
            cmp.decimalplaces = 2;
            expect(cmp.validateInputEntry(keyEvent('5', '1.25', { selectionStart: 4 }))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('5', '1.2', { selectionStart: 3 }))).toBeUndefined();
            expect(cmp.validateInputEntry(keyEvent('5', '1.25', { selectionStart: 0 }))).toBeUndefined();
        });

        it('allows each special character only once', () => {
            expect(cmp.validateInputEntry(keyEvent(',', '1,'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('.', '1.5'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('e', '1e5'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('E', '1e5'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('-', '-1'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('+', '1+'))).toBe(false);
            expect(cmp.validateInputEntry(keyEvent('-', '1'))).toBeUndefined();
        });

        it('rejects a leading space and tolerates a missing target', () => {
            expect(cmp.validateInputEntry({ key: ' ', code: 'Space', target: { value: '' } })).toBe(false);
            expect(cmp.validateInputEntry({ key: '5' })).toBeUndefined();
        });
    });

    describe('events', () => {
        it('marks user edits for backspace and delete', () => {
            cmp.isDefaultQuery = true;
            cmp.onBackspace({});
            expect(cmp.isDefaultQuery).toBe(false);
            cmp.isDefaultQuery = true;
            cmp.onDelete({});
            expect(cmp.isDefaultQuery).toBe(false);
        });

        it('applies the typed value on enter', () => {
            cmp.onEnter({ target: { value: '42' } });
            expect(cmp.datavalue).toBe(42);
        });

        it('updates the data value on model change in natural mode and for financial blur updates', () => {
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.onModelChange('7');
            expect(cmp.datavalue).toBe(7);
            cmp.inputmode = INPUTMODE.FINANCIAL;
            cmp.ngModelOptions = { updateOn: 'change' };
            cmp.onModelChange('9');
            expect(cmp.datavalue).toBe(7);
            cmp.ngModelOptions = { updateOn: 'blur' };
            cmp.onModelChange('9');
            expect(cmp.datavalue).toBe(9);
        });

        it('blocks pasted text with invalid characters', () => {
            const ok: any = { clipboardData: { getData: () => '123' }, preventDefault: jest.fn() };
            const bad: any = { clipboardData: { getData: () => '12a' }, preventDefault: jest.fn() };
            cmp.onPaste(ok);
            expect(ok.preventDefault).not.toHaveBeenCalled();
            cmp.onPaste(bad);
            expect(bad.preventDefault).toHaveBeenCalledTimes(1);
        });

        it('handles datavalue and regexp property changes', () => {
            const input = jest.spyOn(cmp, 'onInputChange').mockImplementation(() => undefined);
            cmp.onPropertyChange('datavalue', 5, undefined);
            expect(input).toHaveBeenCalledWith(5);
            cmp.widgetType = 'wm-currency';
            cmp.inputmode = INPUTMODE.NATURAL;
            cmp.trailingzero = true;
            const trailing = jest.spyOn(cmp, 'checkForTrailingZeros').mockImplementation(() => undefined);
            cmp.onPropertyChange('datavalue', 5, undefined);
            expect(trailing).toHaveBeenCalledWith({ type: 'blur' });
            cmp.onPropertyChange('regexp', '^x$');
            expect(cmp.regexPattern).toBe('^x$');
        });
    });
});
