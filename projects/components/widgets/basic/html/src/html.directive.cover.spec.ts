import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { App } from '@wm/core';
import { SanitizePipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { HtmlDirective } from './html.directive';

@Component({
    standalone: false,
    template: '<div wmHtml name="coverHtml"></div>',
})
class HostComponent {
    @ViewChild(HtmlDirective, { static: true }) wmComponent: HtmlDirective;
}

const moduleDef: ITestModuleDef = {
    imports: [HtmlDirective],
    declarations: [HostComponent],
    providers: [{ provide: App, useValue: mockApp }, SanitizePipe],
};

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

describe('HtmlDirective - cover', () => {
    let fixture: ComponentFixture<HostComponent>;
    let html: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        html = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => jest.restoreAllMocks());

    it('ignores property changes after the widget was destroyed', async () => {
        html.nativeElement.innerHTML = 'original';
        Object.defineProperty(html, 'isDestroyed', { value: true, configurable: true });
        html.onPropertyChange('content', '<b>new</b>');
        await frame();
        expect(html.nativeElement.innerHTML).toBe('original');
        delete html.isDestroyed;
    });

    it('falls back to text content when no sanitize pipe is available', async () => {
        html.sanitizePipe = null;
        html.onPropertyChange('content', '<b>plain</b>');
        await frame();
        expect(html.nativeElement.textContent).toBe('<b>plain</b>');
        expect(html.nativeElement.querySelector('b')).toBeNull();
    });

    it('writes sanitized html when a sanitize pipe is available', async () => {
        html.onPropertyChange('content', '<b>bold</b><script>x()</script>');
        await frame();
        expect(html.nativeElement.querySelector('b').textContent).toBe('bold');
        expect(html.nativeElement.querySelector('script')).toBeNull();
    });
});
