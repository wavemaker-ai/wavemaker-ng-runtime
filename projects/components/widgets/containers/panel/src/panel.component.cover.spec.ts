import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { App, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { PanelComponent } from './panel.component';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';

@Component({
    standalone: false,
    template: `<div wmPanel name="panelc" title="T"></div>`
})
class PanelCoverHostComponent {
    @ViewChild(PanelComponent, { static: true }) wmComponent: PanelComponent;
}

describe('PanelComponent remaining branches', () => {
    let fixture: ComponentFixture<PanelCoverHostComponent>;
    let cmp: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            declarations: [PanelCoverHostComponent],
            imports: [PanelComponent],
            providers: [
                { provide: Router, useValue: Router },
                { provide: App, useValue: mockApp },
                { provide: SecurityService, useValue: SecurityService },
                { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
                provideAnimations()
            ]
        }, PanelCoverHostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('toggle is a no-op when the panel is not collapsible', () => {
        const invoke = jest.spyOn(cmp, 'invokeEventCallback');
        cmp.collapsible = false;
        cmp.expanded = true;
        cmp.toggle({});
        expect(invoke).not.toHaveBeenCalled();
        expect(cmp.expanded).toBe(true);
    });

    it('toggleFullScreen does not change state when fullscreen is disabled', () => {
        const invoke = jest.spyOn(cmp, 'invokeEventCallback');
        cmp.enablefullscreen = false;
        cmp.fullscreen = false;
        cmp.toggleFullScreen({});
        expect(invoke).not.toHaveBeenCalled();
        expect(cmp.fullscreen).toBe(false);
    });

    it('toggleFullScreen raises exitfullscreen and leaves fullscreen when it was active', () => {
        jest.useFakeTimers();
        const invoke = jest.spyOn(cmp, 'invokeEventCallback');
        cmp.enablefullscreen = true;
        cmp.fullscreen = true;
        cmp.hasFooter = true;
        cmp.expanded = true;
        const footer = document.createElement('div');
        footer.className = 'panel-footer';
        Object.defineProperty(footer, 'offsetHeight', { value: 50 });
        cmp.nativeElement.appendChild(footer);
        Object.defineProperty(cmp.panelHeader.nativeElement, 'offsetHeight', { value: 30, configurable: true });
        cmp.toggleFullScreen({});
        expect(invoke).toHaveBeenCalledWith('exitfullscreen', expect.anything());
        expect(cmp.fullscreen).toBe(false);
        jest.runOnlyPendingTimers();
    });

    it('computeDimensions subtracts the footer height while in fullscreen with a visible footer', async () => {
        cmp.fullscreen = true;
        jest.spyOn(PanelComponent.prototype as any, 'hideFooter', 'get').mockReturnValue(false);
        let footer = cmp.nativeElement.querySelector('.panel-footer') as HTMLElement;
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'panel-footer';
            cmp.nativeElement.appendChild(footer);
        }
        Object.defineProperty(footer, 'offsetHeight', { value: 50 });
        Object.defineProperty(cmp.panelHeader.nativeElement, 'offsetHeight', { value: 30, configurable: true });
        // plain object so the raw (unit-less) value assigned by computeDimensions can be observed
        cmp.panelContent = { nativeElement: { style: {} as any } };
        cmp.computeDimensions();
        await new Promise(r => setTimeout(r, 100));
        expect(cmp.panelContent.nativeElement.style.height).toBe(window.innerHeight - 80);
    });

    it('toggleHelp clears the help class when it is already shown', () => {
        cmp.helpClass = 'show-help';
        cmp.toggleHelp();
        expect(cmp.helpClass).toBe('');
        cmp.toggleHelp();
        expect(cmp.helpClass).toBe('show-help');
    });
});
