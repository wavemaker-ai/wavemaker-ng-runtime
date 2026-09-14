import { Renderer2 } from '@angular/core';
import { WMDomRendererFactory2 } from './wm_dom_renderer';

describe('WMDomRendererFactory2 - style attribute handling', () => {
    let renderer: Renderer2;

    beforeEach(() => {
        // EventManager / ɵSharedStylesHost aren't exercised by setAttribute('style', ...), so
        // lightweight stubs are enough — no TestBed/DI needed for this plain-class renderer.
        const factory = new WMDomRendererFactory2({} as any, {} as any, 'test-app', document);
        // createRenderer(element, type) returns the shared default renderer whenever `type` is
        // falsy — this is the only public way to reach WMDefaultDomRenderer2, which isn't exported.
        renderer = factory.createRenderer(null, null);
    });

    it('should apply every declared style property from a style attribute value', () => {
        const el = document.createElement('div');
        renderer.setAttribute(el, 'style', 'color: red; font-size: 12px');
        expect(el.style.color).toBe('red');
        expect(el.style.fontSize).toBe('12px');
    });

    it('should remove a style property that is no longer present when the style attribute changes', () => {
        const el = document.createElement('div');
        renderer.setAttribute(el, 'style', 'color: red; font-size: 12px');
        renderer.setAttribute(el, 'style', 'color: blue');

        expect(el.style.color).toBe('blue');
        // Regression coverage for a real bug: resetStyles() was called as
        // `[].slice.call(element)` on the DOM element itself (not `element.style`), which always
        // returns an empty array for a plain element (no numeric `.length`) — so it silently
        // never cleared anything, leaving stale properties from the previous style value behind.
        expect(el.style.fontSize).toBe('');
    });

    // CSP regression guard: this renderer intentionally does NOT set the `style` HTML attribute
    // directly — under a strict `style-src` CSP policy (no `'unsafe-inline'`), setting the
    // attribute itself (via markup, `.setAttribute('style', ...)`, or `.cssText`) is blocked,
    // while assigning individual CSSOM properties (`element.style.foo = value`) is not. Asserting
    // against the element's native `setAttribute` directly (not just the resulting computed
    // style) catches a regression that would otherwise look identical in a CSP-less test
    // environment like this one but would silently break under a real CSP policy.
    it('should never call the native setAttribute("style", ...) path — CSP style-src compliance', () => {
        const el = document.createElement('div');
        const setAttributeSpy = jest.spyOn(el, 'setAttribute');

        renderer.setAttribute(el, 'style', 'color: red; font-size: 12px');

        expect(setAttributeSpy).not.toHaveBeenCalledWith('style', expect.anything());
        // Sanity: the style still actually gets applied, just via the CSSOM instead.
        expect(el.style.color).toBe('red');
        expect(el.style.fontSize).toBe('12px');
    });

    it('should still set non-style attributes via native setAttribute as normal', () => {
        const el = document.createElement('div');
        const setAttributeSpy = jest.spyOn(el, 'setAttribute');

        renderer.setAttribute(el, 'title', 'hello');

        expect(setAttributeSpy).toHaveBeenCalledWith('title', 'hello');
        expect(el.getAttribute('title')).toBe('hello');
    });
});
