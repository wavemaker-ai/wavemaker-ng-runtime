import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ContentComponent } from './content.component';

@Component({ standalone: false, template: `<div wmContent name="content1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(ContentComponent, { static: true }) wmComponent: ContentComponent;
}

describe('ContentComponent', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('wraps projected content in the content row', () => {
        const fixture = compileTestComponent({
            imports: [ContentComponent],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        const content = fixture.componentInstance.wmComponent;
        expect(content.nativeElement.querySelector('.app-content-row .projected')).not.toBeNull();
        expect(content.widgetType).toBe('wm-content');
    });
});
