import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';

@Component({
    standalone: false,
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `<div><div wmCard name="testcard" title="T"></div></div>`
})
class CardCoverHost {
    @ViewChild(CardComponent, { static: true }) card: CardComponent;
}

describe('CardComponent (cover)', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('clicks the host element and prevents default when Enter is pressed', () => {
        TestBed.configureTestingModule({
            imports: [CardComponent],
            declarations: [CardCoverHost],
            providers: [{ provide: App, useValue: mockApp }]
        });
        const fixture = TestBed.createComponent(CardCoverHost);
        fixture.detectChanges();
        const el: HTMLElement = (fixture.componentInstance.card as any).nativeElement;
        const clickSpy = jest.fn();
        el.addEventListener('click', clickSpy);
        const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});
