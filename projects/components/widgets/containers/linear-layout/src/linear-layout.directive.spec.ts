import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { LinearLayoutDirective } from './linear-layout.directive';

@Component({ standalone: false, template: `<div wmLinearLayout name="ll"></div>` })
class HostComponent {
    @ViewChild(LinearLayoutDirective, { static: true }) wmComponent: LinearLayoutDirective;
}

describe('LinearLayoutDirective', () => {
    let layout: any;
    let el: HTMLElement;

    beforeEach(() => {
        const fixture = compileTestComponent({
            imports: [LinearLayoutDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        layout = fixture.componentInstance.wmComponent;
        el = layout.nativeElement;
    });

    afterEach(() => TestBed.resetTestingModule());

    describe('direction', () => {
        it('replaces the direction class and aligns horizontally for rows', () => {
            layout.horizontalalign = 'center';
            el.classList.add('app-linear-layout-direction-column', 'keep');
            layout.onPropertyChange('direction', 'row', 'column');
            expect(el.classList.contains('app-linear-layout-direction-column')).toBe(false);
            expect(el.classList.contains('app-linear-layout-direction-row')).toBe(true);
            expect(el.classList.contains('keep')).toBe(true);
            expect(el.style.justifyContent).toBe('center');
            expect(el.style.flexDirection).toBe('row');
        });

        it('aligns horizontally for reversed rows', () => {
            layout.horizontalalign = 'right';
            layout.onPropertyChange('direction', 'row-reverse', 'row');
            expect(el.style.justifyContent).toBe('flex-end');
        });

        it('aligns vertically for columns and reversed columns', () => {
            layout.verticalalign = 'bottom';
            layout.onPropertyChange('direction', 'column', 'row');
            expect(el.style.justifyContent).toBe('flex-end');
            layout.verticalalign = 'top';
            layout.onPropertyChange('direction', 'column-reverse', 'column');
            expect(el.style.justifyContent).toBe('flex-start');
        });

        it('leaves the alignment alone for unknown directions', () => {
            el.style.justifyContent = 'space-between';
            layout.onPropertyChange('direction', 'diagonal', 'row');
            expect(el.style.justifyContent).toBe('space-between');
            expect(el.classList.contains('app-linear-layout-direction-diagonal')).toBe(true);
        });
    });

    describe('alignment and spacing properties', () => {
        it('maps alignment properties to justify-content', () => {
            layout.onPropertyChange('horizontalalign', 'left', '');
            expect(el.style.justifyContent).toBe('flex-start');
            layout.onPropertyChange('verticalalign', 'center', '');
            expect(el.style.justifyContent).toBe('center');
        });

        it('replaces the spacing class', () => {
            layout.onPropertyChange('spacing', 'sm', '');
            layout.onPropertyChange('spacing', 'lg', 'sm');
            expect(el.classList.contains('app-linear-layout-spacing-lg')).toBe(true);
            expect(el.classList.contains('app-linear-layout-spacing-sm')).toBe(false);
        });

        it('delegates unknown properties to the base widget', () => {
            expect(() => layout.onPropertyChange('class', 'x', '')).not.toThrow();
        });
    });

    describe('style changes', () => {
        it('aligns horizontally along the main axis for rows and along the cross axis otherwise', () => {
            layout.direction = 'row';
            layout.onStyleChange('horizontalalign', 'right', '');
            expect(el.style.justifyContent).toBe('flex-end');
            layout.direction = 'row-reverse';
            layout.onStyleChange('horizontalalign', 'center', '');
            expect(el.style.justifyContent).toBe('center');
            layout.direction = 'column';
            layout.onStyleChange('horizontalalign', 'left', '');
            expect(el.style.alignItems).toBe('flex-start');
        });

        it('aligns vertically along the main axis for columns and along the cross axis otherwise', () => {
            layout.direction = 'column';
            layout.onStyleChange('verticalalign', 'bottom', '');
            expect(el.style.justifyContent).toBe('flex-end');
            layout.direction = 'column-reverse';
            layout.onStyleChange('verticalalign', 'top', '');
            expect(el.style.justifyContent).toBe('flex-start');
            layout.direction = 'row';
            layout.onStyleChange('verticalalign', 'center', '');
            expect(el.style.alignItems).toBe('center');
        });

        it('passes other style keys to the base widget', () => {
            expect(() => layout.onStyleChange('color', 'red', '')).not.toThrow();
        });
    });
});
