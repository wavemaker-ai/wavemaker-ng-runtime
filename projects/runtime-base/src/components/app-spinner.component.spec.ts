import { TestBed } from '@angular/core/testing';
import { Directive, Input } from '@angular/core';

jest.mock('@wm/components/base', () => {
    const { Directive, Input } = jest.requireActual('@angular/core');
    class TextContentDirective {
        textContent: string;
    }
    Directive({ selector: '[textContent]', standalone: true })(TextContentDirective);
    Input()(TextContentDirective.prototype, 'textContent');
    return { TextContentDirective };
});

import { AppSpinnerComponent } from './app-spinner.component';

describe('AppSpinnerComponent', () => {
    const create = (inputs: Partial<AppSpinnerComponent>) => {
        const fixture = TestBed.createComponent(AppSpinnerComponent);
        Object.assign(fixture.componentInstance, inputs);
        fixture.detectChanges();
        return fixture;
    };

    beforeEach(() => TestBed.configureTestingModule({ imports: [AppSpinnerComponent] }));

    it('renders nothing when hidden', () => {
        const fixture = create({ show: false });
        expect(fixture.nativeElement.querySelector('.app-spinner')).toBeNull();
    });

    it('renders the spinner with its class and messages when shown', () => {
        const fixture = create({ show: true, classname: 'my-class', spinnermessages: ['one', 'two'], arialabel: 'a' });
        const el: HTMLElement = fixture.nativeElement.querySelector('.app-spinner');
        expect(el).not.toBeNull();
        expect(el.classList.contains('my-class')).toBe(true);
        expect(el.querySelectorAll('.spinner-messages p')).toHaveLength(2);
    });
});
