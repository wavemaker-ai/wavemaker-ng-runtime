import { Component, ViewChild } from '@angular/core';
import { StylableComponent } from '@wm/components/base';
import { App } from '@wm/core';
import { SanitizePipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { LabelDirective } from './label.directive';

@Component({
    standalone: false,
    template: `<label wmLabel name="labelx" caption.bind="'x'" [attr.caption.bind]="bindAttr"></label>`
})
class LabelExtraHost {
    bindAttr: string = null;
    @ViewChild(LabelDirective, { static: true }) wmComponent: LabelDirective;
}

const moduleDef = {
    imports: [LabelDirective],
    declarations: [LabelExtraHost],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: SanitizePipe, useClass: SanitizePipe }
    ]
};

const frame = () => new Promise(r => requestAnimationFrame(r));

describe('LabelDirective extra coverage', () => {
    let fixture;
    let label: LabelDirective;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, LabelExtraHost);
        label = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('stringifies an object caption into textContent when not trusted', async () => {
        label.onPropertyChange('caption', { a: 1 });
        await frame();
        expect(label.nativeElement.textContent).toBe('{"a":1}');
    });

    it('renders html of object caption when bind attribute uses trustAs', async () => {
        label.nativeElement.setAttribute('caption.bind', 'trustAs:html');
        label.onPropertyChange('caption', { html: '<b>bold</b>' });
        await frame();
        expect(label.nativeElement.innerHTML).toBe('<b>bold</b>');
    });

    it('sanitizes string captions and inserts zero width spaces into long digit runs', async () => {
        label.onPropertyChange('caption', 'id 1234567890123');
        await frame();
        expect(label.nativeElement.textContent).toBe('id 1234567890123');
        label.onPropertyChange('caption', 42);
        await frame();
        expect(label.nativeElement.textContent).toBe('42');
    });

    it('falls back to textContent when sanitizePipe is unavailable', async () => {
        (label as any).sanitizePipe = null;
        label.onPropertyChange('caption', 'plain <b>text</b>');
        await frame();
        expect(label.nativeElement.textContent).toBe('plain <b>text</b>');
    });

    it('toggles required class', async () => {
        label.onPropertyChange('required', true);
        await frame();
        expect(label.nativeElement.classList.contains('required')).toBe(true);
        label.onPropertyChange('required', false);
        await frame();
        expect(label.nativeElement.classList.contains('required')).toBe(false);
    });

    it('delegates other keys to the parent', () => {
        const spy = jest.spyOn(StylableComponent.prototype as any, 'onPropertyChange');
        label.onPropertyChange('hint', 'tip');
        expect(spy).toHaveBeenCalledWith('hint', 'tip', undefined);
        spy.mockRestore();
    });

    it('ignores property changes after destroy and clears sanitizePipe', async () => {
        fixture.destroy();
        expect((label as any).sanitizePipe).toBeNull();
        label.nativeElement.textContent = 'keep';
        label.onPropertyChange('caption', 'changed');
        await frame();
        expect(label.nativeElement.textContent).toBe('keep');
    });
});
