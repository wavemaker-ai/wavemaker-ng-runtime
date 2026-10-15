import { Component, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { waitForAsync, ComponentFixture } from '@angular/core/testing';
import { AbstractI18nService, App, AppDefaults, CURRENCY_INFO, setPipeProvider } from '@wm/core';
import { TrailingZeroDecimalPipe } from '@wm/components/base';
import { PipeProvider } from '../../../../../runtime-base/src/services/pipe-provider.service';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { CurrencyComponent } from './currency.component';

@Component({
    standalone: false,
    template: `<div wmCurrency name="coverCurrency" tabindex="1"></div>`
})
class CoverCurrencyWrapper {
    @ViewChild(CurrencyComponent, { static: true }) wmComponent: CurrencyComponent;
    constructor(_pipeProvider: PipeProvider) {
        setPipeProvider(_pipeProvider);
    }
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, CurrencyComponent],
    declarations: [CoverCurrencyWrapper],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: DecimalPipe, useClass: DecimalPipe },
        { provide: TrailingZeroDecimalPipe, useClass: TrailingZeroDecimalPipe }
    ]
};

describe('CurrencyComponent - cover branches', () => {
    let fixture: ComponentFixture<CoverCurrencyWrapper>;
    let cmp: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CoverCurrencyWrapper);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('falls back to the application currency when the currency property is cleared', () => {
        cmp.appDefaults = { currencyCode: 'EUR' };
        cmp.onPropertyChange('currency', '', 'USD');
        expect(cmp.currencyCode).toBe('');
        expect(cmp.currencySymbol).toBe(CURRENCY_INFO['EUR'].symbol);
    });
});
