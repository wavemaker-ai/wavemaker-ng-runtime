import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { App } from '@wm/core';
import { provideAsWidgetRef } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ProgressBarComponent } from './progress-bar.component';

@Component({
    standalone: false,
    template: `<div wmProgressBar name="pb"></div>`
})
class HostComponent {
    @ViewChild(ProgressBarComponent, { static: true }) wmComponent: ProgressBarComponent;
}

describe('ProgressBarComponent - extra branches', () => {
    let cmp: any;
    beforeEach(() => {
        const fixture = compileTestComponent({
            imports: [FormsModule, ProgressBarComponent],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }, provideAsWidgetRef(ProgressBarComponent)]
        }, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    it('onTypeChange does nothing when a dataset is provided', () => {
        cmp.hasDataset = true;
        const before = cmp.data[0].cls;
        cmp.type = 'success';
        cmp.onTypeChange();
        expect(cmp.data[0].cls).toBe(before);
    });

    it('onTypeChange tolerates empty data', () => {
        cmp.hasDataset = false;
        cmp.data = [];
        expect(() => cmp.onTypeChange()).not.toThrow();
        expect(cmp.data).toEqual([]);
    });

    it('keeps dataset values that already contain a percent sign', () => {
        cmp.dataset = [{ v: '40%', t: 'info' }];
        cmp.datavalue = 'v';
        cmp.type = 't';
        cmp.prepareData();
        expect(cmp.data[0].progressBarWidth).toBe('40%');
        expect(cmp.data[0].cls).toBe('progress-bar-info');
    });

    it('falls back to a denominator of 1 when min equals max', () => {
        cmp.dataset = undefined;
        cmp.minvalue = 10;
        cmp.maxvalue = 10;
        cmp.datavalue = '11';
        cmp.prepareData();
        expect(cmp.data[0].progressBarWidth).toBe('100%');
    });
});
