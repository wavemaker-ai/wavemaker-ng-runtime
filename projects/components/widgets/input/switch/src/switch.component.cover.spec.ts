import { Component, ViewChild } from '@angular/core';
import { SwitchComponent } from './switch.component';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { AbstractI18nService, App, AppDefaults } from '@wm/core';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { ToDatePipe } from '@wm/components/base';

jest.mock('lodash-es', () => {
    const actual = jest.requireActual('lodash-es');
    return { ...actual, findIndex: jest.fn((...a: any[]) => actual.findIndex(...a)) };
});
import { findIndex } from 'lodash-es';

@Component({ standalone: false, template: `<div wmSwitch name="switch1" datavalue="yes"></div>` })
class SwitchCoverHost {
    @ViewChild(SwitchComponent, { static: true }) wmComponent: SwitchComponent;
}
const moduleDef: ITestModuleDef = {
    imports: [FormsModule, SwitchComponent],
    declarations: [SwitchCoverHost],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};

describe('SwitchComponent (cover)', () => {
    let fixture: ComponentFixture<SwitchCoverHost>;
    let cmp: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, SwitchCoverHost);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    it('does not trigger an app digest when the debounced update runs without a value', async () => {
        await new Promise(r => setTimeout(r, 300)); // let pending debounced calls from init settle
        const upd = jest.spyOn(cmp, 'updateHighlighter');
        cmp._debounceSetSelectedValue(false);
        await new Promise(r => setTimeout(r, 300));
        expect(upd).toHaveBeenCalledTimes(1);
        expect(upd).toHaveBeenCalledWith(false);
    });

    it('does not fail when datavalue or dataset change after the debounced function was cleared', () => {
        cmp._debounceSetSelectedValue = null;
        cmp.datasetItems = [{ key: 'a', value: 'a' }];
        expect(() => cmp.updateSwitchOptions()).not.toThrow();
        expect(() => cmp.datavalue$.next('x')).not.toThrow();
        expect(cmp.btnwidth).toBe(100);
    });

    it('falls back to index -1 when the lookup yields no index', () => {
        cmp.btnwidth = 50;
        cmp.selectedItem = { key: 'a' };
        cmp.datasetItems = [{ key: 'a' }];
        jest.spyOn(cmp, 'setSelectedValue').mockImplementation(() => undefined);
        (findIndex as jest.Mock).mockReturnValueOnce(undefined);
        const css = jest.spyOn($.fn, 'css');
        cmp.updateHighlighter(true);
        expect(css).toHaveBeenCalledWith('left', '-50%');
        css.mockRestore();
    });

    it('leaves an array hint untouched on property change', () => {
        cmp.hint = 'kept';
        cmp.onPropertyChange('hint', ['a', 'b']);
        expect(cmp.hint).toBe('kept');
    });

    it('does not reset the hint on destroy when none is set', () => {
        cmp.hint = undefined;
        cmp.ngOnDestroy();
        expect(cmp.hint).toBeUndefined();
        expect(cmp.selectedItem).toBeNull();
    });
});
