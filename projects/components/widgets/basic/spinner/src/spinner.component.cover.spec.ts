import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { App, AppDefaults } from '@wm/core';
import { ImagePipe, provideAsWidgetRef, ToDatePipe, TrustAsPipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { SpinnerComponent } from './spinner.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    validateDataSourceCtx: jest.fn(() => true),
}));
import { validateDataSourceCtx } from '@wm/core';

@Component({
    standalone: false,
    template: `<div wmSpinner name="sp" servicevariabletotrack="v1,v2"></div>`
})
class HostComponent {
    @ViewChild(SpinnerComponent, { static: true }) wmComponent: SpinnerComponent;
}

describe('SpinnerComponent - variable tracking', () => {
    let cmp: any;
    let handler: (d: any) => void;
    const unsubscribe = jest.fn();

    beforeEach(() => {
        unsubscribe.mockClear();
        (validateDataSourceCtx as jest.Mock).mockReturnValue(true);
        const app = { ...mockApp, subscribe: jest.fn((evt: string, fn: any) => { handler = fn; return unsubscribe; }) };
        const fixture = compileTestComponent({
            imports: [FormsModule, SpinnerComponent, ImagePipe, TrustAsPipe],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: app }, ToDatePipe, DatePipe, AppDefaults, ImagePipe, TrustAsPipe]
        }, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    const evt = (name: string, active: boolean) => ({ variable: { execute: jest.fn(() => name) }, active });

    it('hides the spinner initially and shows it for a tracked variable', () => {
        expect(cmp.widget.show).toBe(false);
        handler(evt('v2', true));
        expect(cmp.widget.show).toBe(true);
        handler(evt('v2', false));
        expect(cmp.widget.show).toBe(false);
    });

    it('ignores untracked variables and variables from a different context', () => {
        handler(evt('other', true));
        expect(cmp.widget.show).toBe(false);
        (validateDataSourceCtx as jest.Mock).mockReturnValue(false);
        handler(evt('v1', true));
        expect(cmp.widget.show).toBe(false);
    });

    it('unsubscribes on destroy', () => {
        cmp.ngOnDestroy();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(cmp.toggleVariableStateSubscription).toBeNull();
    });
});
