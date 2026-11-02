import { CaptionPositionDirective } from './caption-position.directive';

declare const $: any;

const attrsMap = (obj: Record<string, string>) => ({ get: (k: string) => obj[k] });

const createDirective = (widget: any, innerHtml = '<input>', attrs: Record<string, string> = {}) => {
    const nativeEl = document.createElement('div');
    nativeEl.innerHTML = innerHtml;
    Object.entries(attrs).forEach(([k, v]) => nativeEl.setAttribute(k, v));
    (nativeEl as any).widget = widget;
    document.body.appendChild(nativeEl);

    const inj: any = { get: jest.fn().mockReturnValue({ nativeElement: nativeEl }) };
    const unsubscribeFn = jest.fn();
    const app: any = { subscribe: jest.fn().mockReturnValue(unsubscribeFn) };
    const directive = new CaptionPositionDirective(inj, app);
    return { directive, nativeEl, app, unsubscribeFn };
};

const seedInputEl = (directive: any, nativeEl: HTMLElement) => {
    directive.inputEl = $(nativeEl).find('input, select, textarea');
};

describe('CaptionPositionDirective', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('ngAfterViewInit', () => {
        it('should do nothing when captionposition is not floating', () => {
            const { directive } = createDirective({ $attrs: attrsMap({}), form: null });
            expect(() => directive.ngAfterViewInit()).not.toThrow();
            expect((directive as any).inputEl).toBeUndefined();
        });

        it('should add float-active when the input already has a default value', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input value="foo">'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
        });

        it('should not add float-active when there is no default value', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.classList.contains('float-active')).toBe(false);
        });

        it('should add float-active when the composite element has a defaultvalue attribute', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input>',
                { defaultvalue: 'x' }
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
        });

        it('should add float-active when a select has a selected option with text', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<select><option value="1" selected>One</option></select>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
        });

        it('should add float-active for a multi-select', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<select multiple></select>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
        });

        it('should clear the placeholder option text for a non-focused, non-datavalue-bound select', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<select><option id="placeholderOption">Choose</option></select>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.querySelector('#placeholderOption')!.textContent).toBe('');
        });

        it('should keep the placeholder option text when the select is inside a datavalue-bound widget', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<div widget-id="w1" datavalue="1"><select><option id="placeholderOption">Choose</option></select></div>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect(nativeEl.querySelector('#placeholderOption')!.textContent).toBe('Choose');
        });

        it('should convert caption-floating to caption-top for skip-list widget types inside a form', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="app-composite-widget caption-floating"><input></div>',
                { widgettype: 'radioset' }
            );
            directive.ngAfterViewInit();
            const compositeEle = nativeEl.querySelector('.app-composite-widget')!;
            expect(compositeEle.classList.contains('caption-top')).toBe(true);
            expect(compositeEle.classList.contains('caption-floating')).toBe(false);
            jest.runAllTimers();
        });

        it('should leave caption-floating untouched for widget types not in the skip list', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="app-composite-widget caption-floating"><input></div>',
                { widgettype: 'text' }
            );
            directive.ngAfterViewInit();
            const compositeEle = nativeEl.querySelector('.app-composite-widget')!;
            expect(compositeEle.classList.contains('caption-floating')).toBe(true);
            expect(compositeEle.classList.contains('caption-top')).toBe(false);
            jest.runAllTimers();
        });

        it('should add input-grp-icon to the label for a right-aligned form with an input-group-btn', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="align-right"><div class="app-composite-widget"><label>Name</label><div class="input-group-btn"></div><input></div></div>'
            );
            directive.ngAfterViewInit();
            const label = nativeEl.querySelector('label')!;
            expect(label.classList.contains('input-grp-icon')).toBe(true);
            expect(label.classList.contains('input-grp-dt-icon')).toBe(false);
            jest.runAllTimers();
        });

        it('should add input-grp-dt-icon to the label when the composite widget contains a datetime picker', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="align-right"><div class="app-composite-widget"><label>Name</label><div class="input-group-btn"></div><div wmdatetime></div><input></div></div>'
            );
            directive.ngAfterViewInit();
            const label = nativeEl.querySelector('label')!;
            expect(label.classList.contains('input-grp-dt-icon')).toBe(true);
            jest.runAllTimers();
        });

        it('should not modify the label when the form is not right-aligned', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="app-composite-widget"><label>Name</label><div class="input-group-btn"></div><input></div>'
            );
            directive.ngAfterViewInit();
            const label = nativeEl.querySelector('label')!;
            expect(label.classList.contains('input-grp-icon')).toBe(false);
            expect(label.classList.contains('input-grp-dt-icon')).toBe(false);
            jest.runAllTimers();
        });

        it('should create a MutationObserver watching the input when placeholder is bound on the widget element', () => {
            const { directive } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="app-composite-widget"><input></div>',
                { 'placeholder.bind': 'someExpr' }
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect((directive as any)._attrObserver).toBeInstanceOf(MutationObserver);
        });

        it('should not create a MutationObserver when placeholder is not bound', () => {
            const { directive } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            expect((directive as any)._attrObserver).toBeUndefined();
        });
    });

    describe('onFocusCb / onBlurCb', () => {
        it('onFocusCb should add float-active and restore the stored placeholder', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            (directive as any).placeholder = 'Enter name';
            (directive as any).onFocusCb();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
            expect($(nativeEl).find('input').attr('placeholder')).toBe('Enter name');
        });

        it('onBlurCb should remove float-active and the placeholder when the input has no value', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input>'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            nativeEl.classList.add('float-active');
            (directive as any).onBlurCb();
            expect(nativeEl.classList.contains('float-active')).toBe(false);
            expect($(nativeEl).find('input').attr('placeholder')).toBeUndefined();
        });

        it('onBlurCb should keep float-active when the input still has a value', () => {
            const { directive, nativeEl } = createDirective(
                { $attrs: attrsMap({ captionposition: 'floating' }), form: null },
                '<input value="foo">'
            );
            directive.ngAfterViewInit();
            jest.runAllTimers();
            (directive as any).onBlurCb();
            expect(nativeEl.classList.contains('float-active')).toBe(true);
        });
    });

    describe('ngOnInit / captionPositionAnimate handling', () => {
        it('should subscribe to captionPositionAnimate on init', () => {
            const { directive, app } = createDirective({ $attrs: attrsMap({}), form: null }, '<input>');
            directive.ngOnInit();
            expect(app.subscribe).toHaveBeenCalledWith('captionPositionAnimate', expect.any(Function));
        });

        it('should add float-active when the event reports a display value', () => {
            const { directive, app, nativeEl } = createDirective({ $attrs: attrsMap({}), form: null }, '<input>');
            seedInputEl(directive, nativeEl);
            directive.ngOnInit();
            const callback = app.subscribe.mock.calls[0][1];
            const fakeNativeEl = { addClass: jest.fn(), removeClass: jest.fn() };
            callback({ displayVal: true, isFocused: false, isSelectMultiple: false, nativeEl: fakeNativeEl });
            expect(fakeNativeEl.addClass).toHaveBeenCalledWith('float-active');
        });

        it('should remove float-active and store+clear an existing placeholder when nothing qualifies', () => {
            const { directive, app, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: null },
                '<input placeholder="Enter name">'
            );
            seedInputEl(directive, nativeEl);
            directive.ngOnInit();
            const callback = app.subscribe.mock.calls[0][1];
            const fakeNativeEl = { addClass: jest.fn(), removeClass: jest.fn() };
            callback({ displayVal: false, isFocused: false, isSelectMultiple: false, nativeEl: fakeNativeEl });
            expect(fakeNativeEl.removeClass).toHaveBeenCalledWith('float-active');
            expect((directive as any).placeholder).toBe('Enter name');
            expect($(nativeEl).find('input').attr('placeholder')).toBeUndefined();
        });

        it('should clear the placeholderOption text instead of the input placeholder when a select placeholder option is present', () => {
            const { directive, app, nativeEl } = createDirective(
                { $attrs: attrsMap({}), form: null },
                '<select><option id="placeholderOption">Choose</option></select>'
            );
            seedInputEl(directive, nativeEl);
            directive.ngOnInit();
            const callback = app.subscribe.mock.calls[0][1];
            const fakeNativeEl = { addClass: jest.fn(), removeClass: jest.fn() };
            callback({ displayVal: false, isFocused: false, isSelectMultiple: false, nativeEl: fakeNativeEl });
            expect(nativeEl.querySelector('#placeholderOption')!.textContent).toBe('');
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe the app subscription and disconnect the attribute observer', () => {
            const { directive, unsubscribeFn } = createDirective(
                { $attrs: attrsMap({}), form: { $attrs: attrsMap({ captionposition: 'floating' }) } },
                '<div class="app-composite-widget"><input></div>',
                { 'placeholder.bind': 'someExpr' }
            );
            directive.ngOnInit();
            directive.ngAfterViewInit();
            jest.runAllTimers();
            const observer = (directive as any)._attrObserver;
            const disconnectSpy = jest.spyOn(observer, 'disconnect');
            directive.ngOnDestroy();
            expect(unsubscribeFn).toHaveBeenCalledTimes(1);
            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        });

        it('should be a no-op when neither subscription nor observer were set up', () => {
            const { directive } = createDirective({ $attrs: attrsMap({}), form: null }, '<input>');
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });
    });
});
