import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { ColorPickerDirective } from 'ngx-color-picker';
import { App } from '@wm/core';
import { AUTOCLOSE_TYPE } from '@wm/components/base';
import { ColorPickerComponent } from './color-picker.component';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';

@Component({
    standalone: false,
    template: `<div wmColorPicker name="colorpicker1"></div>`
})
class HostComponent {
    @ViewChild(ColorPickerComponent, { static: true }) wmComponent: ColorPickerComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, ColorPickerDirective, ColorPickerComponent],
    declarations: [HostComponent],
    providers: [{ provide: App, useValue: mockApp }]
};

describe('ColorPickerComponent coverage', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: ColorPickerComponent;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('colorPickerOpen does not attach a click-to-close handler when autoclose is not "always"', () => {
        cmp.autoclose = AUTOCLOSE_TYPE.OUTSIDECLICK;
        const container = document.createElement('div');
        container.className = 'color-picker';
        cmp.nativeElement.appendChild(container);
        cmp.colorPickerOpen('#fff');
        expect(container.onclick).toBeNull();
    });

    it('colorPickerOpen attaches a click-to-close handler when autoclose is "always"', () => {
        cmp.autoclose = AUTOCLOSE_TYPE.ALWAYS;
        const container = document.createElement('div');
        container.className = 'color-picker';
        cmp.nativeElement.appendChild(container);
        const close = jest.spyOn(cmp.cpDirective, 'closeDialog').mockImplementation(() => {});
        cmp.colorPickerOpen('#fff');
        container.click();
        expect(close).toHaveBeenCalledTimes(1);
    });
});
