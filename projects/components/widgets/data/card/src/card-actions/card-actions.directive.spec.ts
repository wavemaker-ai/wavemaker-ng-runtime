import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { CardActionsDirective } from './card-actions.directive';

@Component({ standalone: false, template: `<div wmCardActions name="w1"></div>` })
class HostComponent {
    @ViewChild(CardActionsDirective, { static: true }) wmComponent: CardActionsDirective;
}

describe('CardActionsDirective', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('creates the widget on its host element', () => {
        const fixture = compileTestComponent({
            imports: [CardActionsDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        const widget: any = fixture.componentInstance.wmComponent;
        expect(widget).toBeTruthy();
        expect(widget.nativeElement).toBeInstanceOf(HTMLElement);
    });
});
