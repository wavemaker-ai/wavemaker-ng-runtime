import { Component, ViewChild } from '@angular/core';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { LayoutgridDirective } from './layout-grid.directive';

@Component({
    standalone: false,
    template: `<div wmLayoutGrid name="layoutgrid1" padding="4px"></div>`
})
class LayoutGridHost {
    @ViewChild(LayoutgridDirective, { static: true }) wmComponent: LayoutgridDirective;
}

const moduleDef = {
    imports: [LayoutgridDirective],
    declarations: [LayoutGridHost],
    providers: [{ provide: App, useValue: mockApp }]
};

describe('LayoutgridDirective', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('creates the widget with default classes and a widget type', async () => {
        const fixture = compileTestComponent(moduleDef, LayoutGridHost);
        fixture.detectChanges();
        const dir = fixture.componentInstance.wmComponent;
        await new Promise(r => requestAnimationFrame(r));
        expect(dir).toBeTruthy();
        expect(dir.name).toBe('layoutgrid1');
        expect(dir.nativeElement.classList.contains('app-grid-layout')).toBe(true);
        expect(dir.nativeElement.classList.contains('clearfix')).toBe(true);
    });
});
