import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { WizardActionDirective } from './wizard-action.directive';

@Component({ standalone: false, template: `<div wmWizardAction name="w1"></div>` })
class HostComponent {
    @ViewChild(WizardActionDirective, { static: true }) wmComponent: WizardActionDirective;
}

describe('WizardActionDirective', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('creates the widget on its host element', () => {
        const fixture = compileTestComponent({
            imports: [WizardActionDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        const widget: any = fixture.componentInstance.wmComponent;
        expect(widget).toBeTruthy();
        expect(widget.nativeElement).toBeInstanceOf(HTMLElement);
    });
});
