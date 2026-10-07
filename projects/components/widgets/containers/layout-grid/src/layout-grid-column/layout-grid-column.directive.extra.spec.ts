import { Component, ViewChild } from '@angular/core';
import { StylableComponent } from '@wm/components/base';
import { App, Viewport } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { LayoutGridColumnDirective } from './layout-grid-column.directive';

@Component({
    standalone: false,
    template: `<div wmLayoutGridColumn name="col1" height="50px" xscolumnwidth="12"></div>`
})
class ColWithHeightHost {
    @ViewChild(LayoutGridColumnDirective, { static: true }) wmComponent: LayoutGridColumnDirective;
}

@Component({
    standalone: false,
    template: `<div wmLayoutGridColumn name="col2"></div>`
})
class ColNoHeightHost {
    @ViewChild(LayoutGridColumnDirective, { static: true }) wmComponent: LayoutGridColumnDirective;
}

const build = (host: any, isMobileType: boolean) => {
    const def = {
        imports: [LayoutGridColumnDirective],
        declarations: [host],
        providers: [
            { provide: App, useValue: mockApp },
            { provide: Viewport, useValue: { isMobileType } }
        ]
    };
    const fixture = compileTestComponent(def, host);
    fixture.detectChanges();
    return fixture.componentInstance.wmComponent as LayoutGridColumnDirective;
};

const frame = () => new Promise(r => requestAnimationFrame(r));

describe('LayoutGridColumnDirective extra coverage', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('sets overflow auto when a height attribute is present', async () => {
        const dir = build(ColWithHeightHost, false);
        await frame();
        expect(dir.nativeElement.style.overflow).toBe('auto');
    });

    it('does not set overflow without a height attribute', async () => {
        const dir = build(ColNoHeightHost, false);
        await frame();
        expect(dir.nativeElement.style.overflow).toBe('');
    });

    it('applies the col-sm class on non mobile viewports and swaps the old one', async () => {
        const dir = build(ColNoHeightHost, false);
        dir.onPropertyChange('columnwidth', 6);
        await frame();
        expect(dir.nativeElement.classList.contains('col-sm-6')).toBe(true);
        dir.onPropertyChange('columnwidth', 4, 6);
        await frame();
        expect(dir.nativeElement.classList.contains('col-sm-4')).toBe(true);
        expect(dir.nativeElement.classList.contains('col-sm-6')).toBe(false);
    });

    it('applies the class on mobile when no xscolumnwidth is set', async () => {
        const dir = build(ColNoHeightHost, true);
        dir.onPropertyChange('columnwidth', 3);
        await frame();
        expect(dir.nativeElement.classList.contains('col-sm-3')).toBe(true);
    });

    it('skips the class on mobile when xscolumnwidth is set', async () => {
        const dir = build(ColWithHeightHost, true);
        dir.onPropertyChange('columnwidth', 3);
        await frame();
        expect(dir.nativeElement.classList.contains('col-sm-3')).toBe(false);
    });

    it('delegates other keys to the parent', () => {
        const spy = jest.spyOn(StylableComponent.prototype as any, 'onPropertyChange');
        build(ColNoHeightHost, false).onPropertyChange('hint', 'tip');
        expect(spy).toHaveBeenCalledWith('hint', 'tip', undefined);
        spy.mockRestore();
    });
});
