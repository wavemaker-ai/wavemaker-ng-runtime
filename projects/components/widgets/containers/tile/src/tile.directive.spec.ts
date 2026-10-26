import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { TileDirective } from './tile.directive';

@Component({ standalone: false, template: `<div wmTile name="w1"></div>` })
class HostComponent {
    @ViewChild(TileDirective, { static: true }) wmComponent: TileDirective;
}

describe('TileDirective', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('creates the widget on its host element', () => {
        const fixture = compileTestComponent({
            imports: [TileDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        const widget: any = fixture.componentInstance.wmComponent;
        expect(widget).toBeTruthy();
        expect(widget.nativeElement).toBeInstanceOf(HTMLElement);
    });
});
