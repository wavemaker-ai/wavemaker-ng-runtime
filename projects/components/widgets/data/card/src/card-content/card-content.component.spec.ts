import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { CardContentComponent } from './card-content.component';

@Component({ standalone: false, template: `<div wmCardContent name="cc"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(CardContentComponent, { static: true }) wmComponent: CardContentComponent;
}

describe('CardContentComponent', () => {
    let fixture: any;
    let card: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [CardContentComponent],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        card = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('projects its content into the container element', () => {
        expect(card.nativeElement.querySelector('[partial-container-target] .projected')).not.toBeNull();
    });

    it('releases the container reference on destroy', () => {
        expect(card.cardContentContainerElRef).toBeDefined();
        fixture.destroy();
        expect(card.cardContentContainerElRef).toBeNull();
    });
});
