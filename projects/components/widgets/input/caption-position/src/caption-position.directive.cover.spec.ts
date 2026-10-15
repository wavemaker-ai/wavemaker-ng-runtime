import { CaptionPositionDirective } from './caption-position.directive';

declare const $: any;

const setup = (innerHtml: string) => {
    const nativeEl = document.createElement('div');
    nativeEl.innerHTML = innerHtml;
    document.body.appendChild(nativeEl);
    const inj: any = { get: jest.fn().mockReturnValue({ nativeElement: nativeEl }) };
    let animate: any;
    const app: any = { subscribe: jest.fn((_name: string, cb: any) => { animate = cb; return jest.fn(); }) };
    const directive: any = new CaptionPositionDirective(inj, app);
    directive.ngOnInit();
    return { directive, nativeEl, animate: (d: any) => animate(d) };
};

describe('CaptionPositionDirective - cover', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    describe('onBlurCb with mobile date/time inputs', () => {
        const blur = (html: string) => {
            const { directive, nativeEl } = setup(html);
            directive.compositeEle = nativeEl;
            nativeEl.classList.add('float-active');
            directive.inputEl = $(nativeEl).find('input');
            directive.onBlurCb();
            return nativeEl;
        };

        it('keeps the floating caption when a mobile input holds a value', () => {
            const el = blur('<input class="mobile-input" value="12:30"><input class="other">');
            expect(el.classList.contains('float-active')).toBe(true);
        });

        it('removes the floating caption when no mobile input holds a value', () => {
            const el = blur('<input class="mobile-input"><input class="mobile-input" value=""><input class="plain" value="">');
            expect(el.classList.contains('float-active')).toBe(false);
        });

        it('ignores values of inputs that are not mobile inputs', () => {
            const el = blur('<input class="mobile-input"><input class="plain" id="p">');
            (el.querySelector('#p') as HTMLInputElement).value = '';
            expect(el.classList.contains('float-active')).toBe(false);
        });
    });

    describe('captionPositionAnimate notifications', () => {
        it('restores the placeholder of a focused empty input', () => {
            const { directive, nativeEl, animate } = setup('<input>');
            const input = nativeEl.querySelector('input') as HTMLInputElement;
            directive.inputEl = $(input);
            directive.placeholder = 'Type here';
            input.focus();
            const target = $('<div>');
            animate({ displayVal: false, nativeEl: target });
            expect(target.hasClass('float-active')).toBe(true);
            expect(input.getAttribute('placeholder')).toBe('Type here');
        });

        it('does not touch the placeholder when a value is displayed', () => {
            const { directive, nativeEl, animate } = setup('<input>');
            directive.inputEl = $(nativeEl.querySelector('input'));
            const target = $('<div>');
            animate({ displayVal: true, nativeEl: target });
            expect(target.hasClass('float-active')).toBe(true);
            expect(nativeEl.querySelector('input').hasAttribute('placeholder')).toBe(false);
        });

        it('removes the floating class without an input element', () => {
            const { animate } = setup('<input>');
            const target = $('<div class="float-active">');
            expect(() => animate({ displayVal: false, nativeEl: target })).not.toThrow();
            expect(target.hasClass('float-active')).toBe(false);
        });

        it('leaves an input without placeholder untouched when the caption sinks', () => {
            const { directive, nativeEl, animate } = setup('<input>');
            directive.inputEl = $(nativeEl.querySelector('input'));
            directive.placeholder = 'kept';
            const target = $('<div class="float-active">');
            animate({ displayVal: false, nativeEl: target });
            expect(target.hasClass('float-active')).toBe(false);
            expect(directive.placeholder).toBe('kept');
        });

        it('stores and removes the placeholder of the input when the caption sinks', () => {
            const { directive, nativeEl, animate } = setup('<input placeholder="Hint">');
            directive.inputEl = $(nativeEl.querySelector('input'));
            animate({ displayVal: false, nativeEl: $('<div>') });
            expect(directive.placeholder).toBe('Hint');
            expect(nativeEl.querySelector('input').hasAttribute('placeholder')).toBe(false);
        });

        it('empties the select placeholder option when the caption sinks', () => {
            const { directive, nativeEl, animate } = setup('<select><option id="placeholderOption">Pick</option></select>');
            directive.inputEl = $(nativeEl.querySelector('select'));
            animate({ displayVal: false, nativeEl: $('<div>') });
            expect(nativeEl.querySelector('#placeholderOption').textContent).toBe('');
        });
    });
});
