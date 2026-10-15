import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AbstractI18nService, App, AppDefaults } from '@wm/core';
import { ToDatePipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { SelectComponent } from './select.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isIos: jest.fn(() => false),
    isSafari: jest.fn(() => false),
}));

import { isIos } from '@wm/core';

@Component({
    standalone: false,
    template: `<wm-select name="sel" placeholder="Pick"></wm-select>`,
})
class HostComponent {
    @ViewChild(SelectComponent, { static: true }) wmComponent: SelectComponent;
}

const moduleDef = {
    imports: [FormsModule, SelectComponent],
    declarations: [HostComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
    ],
};

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('SelectComponent - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        (isIos as jest.Mock).mockReturnValue(false);
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        fixture.destroy();
    });

    describe('dataset subscription on iOS/Safari', () => {
        beforeEach(() => {
            (isIos as jest.Mock).mockReturnValue(true);
        });

        it('clears the native value when there is no datavalue and no placeholder', async () => {
            cmp.placeholder = '';
            cmp.selectEl.nativeElement.value = 'stale';
            cmp.datavalue = undefined;
            cmp.dataset$.next(undefined);
            await wait(150);
            expect(cmp.selectEl.nativeElement.value).toBe('');
        });

        it('keeps the native value when there is no datavalue but a placeholder exists', async () => {
            cmp.placeholder = 'Pick';
            const el = cmp.selectEl.nativeElement as HTMLSelectElement;
            const spy = jest.spyOn(el, 'value', 'set');
            cmp.datavalue = undefined;
            cmp.dataset$.next(undefined);
            await wait(150);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resets modelByKey and the native value when the selected item vanished', async () => {
            cmp.placeholder = '';
            cmp.datasetItems = [{ key: 'a', value: 'a', label: 'a', selected: false }];
            cmp._modelByValue = 'gone';
            const selectByKey = jest.spyOn(cmp, 'selectByKey');
            cmp.dataset$.next(undefined);
            await wait(150);
            expect(selectByKey).toHaveBeenCalledWith(undefined);
            expect(cmp.selectEl.nativeElement.value).toBe('');
        });

        it('only resets modelByKey when a placeholder exists', async () => {
            cmp.placeholder = 'Pick';
            cmp.datasetItems = [{ key: 'a', value: 'a', label: 'a', selected: false }];
            cmp._modelByValue = 'gone';
            const el = cmp.selectEl.nativeElement as HTMLSelectElement;
            const spy = jest.spyOn(el, 'value', 'set');
            const selectByKey = jest.spyOn(cmp, 'selectByKey');
            cmp.dataset$.next(undefined);
            await wait(150);
            expect(selectByKey).toHaveBeenCalledWith(undefined);
            expect(spy).not.toHaveBeenCalled();
        });

        it('does nothing when the selected item is still present', async () => {
            cmp.datasetItems = [{ key: 'a', value: 'a', label: 'a', selected: true }];
            cmp._modelByValue = 'a';
            const selectByKey = jest.spyOn(cmp, 'selectByKey');
            cmp.dataset$.next(undefined);
            await wait(150);
            expect(selectByKey).not.toHaveBeenCalled();
        });
    });
});
