import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { App } from '@wm/core';
import { CheckboxComponent } from './checkbox.component';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';

@Component({
    standalone: false,
    template: `<div wmCheckbox hint="checkbox" caption="Label" name="checkbox1"></div>`
})
class HostComponent {
    @ViewChild(CheckboxComponent, { static: true }) wmComponent: CheckboxComponent;
}

@Component({
    standalone: false,
    template: `<div wmCheckbox type="button" name="checkboxBtn"></div>`
})
class ButtonHostComponent {
    @ViewChild(CheckboxComponent, { static: true }) wmComponent: CheckboxComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, CheckboxComponent],
    declarations: [HostComponent, ButtonHostComponent],
    providers: [{ provide: App, useValue: mockApp }]
};

describe('CheckboxComponent coverage', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: CheckboxComponent;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('required change re-emits the current datavalue through _onChange', () => {
        const onChange = jest.spyOn(cmp as any, '_onChange');
        cmp.onPropertyChange('required', true, false);
        expect(onChange).toHaveBeenCalledWith(cmp.datavalue);
    });

    it('tabindex change is ignored', () => {
        const onChange = jest.spyOn(cmp as any, '_onChange');
        cmp.onPropertyChange('tabindex', 3, 1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('type="button" uses the icon-button toggle host class', async () => {
        TestBed.resetTestingModule();
        const f = compileTestComponent(moduleDef, ButtonHostComponent);
        f.detectChanges();
        await new Promise(r => requestAnimationFrame(() => r(null)));
        const el: HTMLElement = f.componentInstance.wmComponent.nativeElement;
        expect(el.classList.contains('app-iconbutton-toggle')).toBe(true);
    });
});
