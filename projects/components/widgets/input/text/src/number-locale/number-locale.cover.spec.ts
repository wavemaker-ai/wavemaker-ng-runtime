import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AbstractI18nService, App, setPipeProvider } from '@wm/core';
import { INPUTMODE, TrailingZeroDecimalPipe } from '@wm/components/base';
import { PipeProvider } from '../../../../../../runtime-base/src/services/pipe-provider.service';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { NumberComponent } from '../../../number/src/number.component';

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

const keyEvent = (key: string, value = '', selectionStart?: number): any => ({
    key,
    ctrlKey: false,
    target: { value, selectionStart: selectionStart ?? value.length },
    preventDefault: jest.fn(),
});

describe('NumberLocale coverage', () => {
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

    afterEach(() => jest.restoreAllMocks());

    it('transforms a non-localized string with decimalplaces 0', () => {
        jest.spyOn(cmp, 'getAttr').mockImplementation((k: any) => (k === 'decimalplaces' ? '0' : ''));
        cmp.isDefaultQuery = true;
        cmp.decimalplaces = 0;
        cmp.datavalue = '7';
        expect(cmp.datavalue).toBe(7);
        expect(cmp.decimalValue).toBe('');
    });

    it('keeps only the integer part for a localized string with an empty decimal part', () => {
        jest.spyOn(cmp, 'getAttr').mockImplementation((k: any) => (k === 'decimalplaces' ? '2' : ''));
        cmp.isDefaultQuery = true;
        cmp.decimalplaces = 2;
        cmp.datavalue = '5.';
        expect(cmp.decimalValue).toBe('');
        expect(cmp.datavalue).toBe(5);
    });

    it('financial wm-number: first change from an empty widget does not raise a change', () => {
        cmp.inputmode = INPUTMODE.FINANCIAL;
        cmp.step = 1;
        cmp.proxyModel = null;
        const change = jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
        jest.spyOn(cmp, 'getPrevDataValue').mockReturnValue(undefined);
        cmp.onInputChange('5');
        expect(change).not.toHaveBeenCalled();
    });

    describe('countDecimals fallback for non exponential-parsable numbers', () => {
        it('returns 0 for Infinity with the default separator', () => {
            expect(cmp.countDecimals(Infinity)).toBe(0);
        });

        it('splits on the locale decimal symbol when the string contains it', () => {
            cmp.DECIMAL = 'f';
            expect(cmp.countDecimals(Infinity)).toBe('inity'.length);
        });
    });

    it('arrow press with an out-of-range, unparsable input keeps the model unchanged', () => {
        cmp.numberNotInRange = true;
        cmp.proxyModel = 3;
        cmp.inputEl.nativeElement.value = 'abc';
        const change = jest.spyOn(cmp, 'handleChange').mockImplementation(() => undefined);
        cmp.onArrowPress({ preventDefault: jest.fn(), target: { value: 'abc' } }, 'UP');
        expect(cmp.proxyModel).toBe(3);
        expect(change).not.toHaveBeenCalled();
        expect(cmp.numberNotInRange).toBe(true);
    });

    it('natural decimalplaces check splits on "." when the input has no locale decimal symbol', () => {
        cmp.inputmode = INPUTMODE.NATURAL;
        cmp.decimalplaces = 2;
        cmp.DECIMAL = ',';
        expect(cmp.validateInputEntry(keyEvent('3', '12.5', 4))).toBeUndefined();
        expect(cmp.validateInputEntry(keyEvent('3', '12.55', 5))).toBe(false);
    });
});
