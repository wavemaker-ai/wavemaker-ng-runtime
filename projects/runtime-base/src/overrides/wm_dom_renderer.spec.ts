import { RendererStyleFlags2, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CssVarNamespacer, provideCssVarNamespacing } from '@angular/platform-browser';

import { WMDomRendererFactory2, flattenStyles } from './wm_dom_renderer';

const STYLE = '.a{--%NS%c:red;color:var(--%NS%c)}';

const createRenderers = (factory: WMDomRendererFactory2) => {
    factory.createRenderer(document.createElement('div'), { id: 'e', encapsulation: ViewEncapsulation.Emulated, styles: [STYLE], data: {} } as any);
    factory.createRenderer(document.createElement('div'), { id: 'n', encapsulation: ViewEncapsulation.None, styles: [STYLE], data: {} } as any);
    const host = document.createElement('div');
    factory.createRenderer(host, { id: 's', encapsulation: ViewEncapsulation.ShadowDom, styles: [STYLE], data: {} } as any);
    return host;
};

describe('wm_dom_renderer flattenStyles', () => {
    it('replaces the css variable namespace placeholder', () => {
        expect(flattenStyles('c1', ['.a{--%NS%c:red;color:var(--%NS%c)}', ['.b{--%NS%d:1}']], []))
            .toEqual(['.a{--c:red;color:var(--c)}', '.b{--d:1}']);
        expect(flattenStyles('c1', ['.a-%COMP%{--%NS%c:red;color:var(--%NS%c)}'], [], 'ns_'))
            .toEqual(['.a-c1{--ns_c:red;color:var(--ns_c)}']);
    });
});

describe('WMDomRendererFactory2 css variables', () => {
    let eventManager: any;
    let sharedStyles: any;

    beforeEach(() => {
        eventManager = { addEventListener: jest.fn(() => () => {}) };
        sharedStyles = { addStyles: jest.fn(), addHost: jest.fn(), removeHost: jest.fn() };
    });

    describe('without provideCssVarNamespacing', () => {
        let factory: WMDomRendererFactory2;
        let renderer: any;
        let el: HTMLElement;

        beforeEach(() => {
            factory = new WMDomRendererFactory2(eventManager, sharedStyles, 'app', document);
            renderer = factory.createRenderer(null, null);
            el = document.createElement('div');
        });

        it('strips the namespace placeholder from component styles', () => {
            const host = createRenderers(factory);
            expect(sharedStyles.addStyles).toHaveBeenNthCalledWith(1, ['.a{--c:red;color:var(--c)}']);
            expect(sharedStyles.addStyles).toHaveBeenNthCalledWith(2, ['.a{--c:red;color:var(--c)}']);
            expect(host.shadowRoot.querySelector('style').textContent).toBe('.a{--c:red;color:var(--c)}');
        });

        it('sets and removes css variables, stripping the namespace placeholder', () => {
            renderer.setStyle(el, '--%NS%c', 'red', 0);
            expect(el.style.getPropertyValue('--c')).toBe('red');
            // jsdom does not track priority for custom properties, so assert on the call instead
            const setProperty = jest.spyOn(el.style, 'setProperty');
            renderer.setStyle(el, '--%NS%d', 'blue', RendererStyleFlags2.Important);
            expect(setProperty).toHaveBeenCalledWith('--d', 'blue', 'important');
            renderer.removeStyle(el, '--%NS%c', 0);
            renderer.removeStyle(el, '--%NS%d', 0);
            expect(el.style.getPropertyValue('--c')).toBe('');
            expect(el.style.getPropertyValue('--d')).toBe('');
        });

        it('applies css variables from the style attribute', () => {
            renderer.setAttribute(el, 'style', '--wm-btn-color: red');
            expect(el.style.getPropertyValue('--wm-btn-color')).toBe('red');
        });
    });

    describe('with provideCssVarNamespacing', () => {
        let factory: WMDomRendererFactory2;

        beforeEach(() => {
            TestBed.configureTestingModule({ providers: [provideCssVarNamespacing('ns')] });
            factory = new WMDomRendererFactory2(eventManager, sharedStyles, 'app', document, TestBed.inject(CssVarNamespacer));
        });

        it('prefixes css variables in component styles with the configured namespace', () => {
            const host = createRenderers(factory);
            expect(sharedStyles.addStyles).toHaveBeenNthCalledWith(1, ['.a{--ns_c:red;color:var(--ns_c)}']);
            expect(sharedStyles.addStyles).toHaveBeenNthCalledWith(2, ['.a{--ns_c:red;color:var(--ns_c)}']);
            expect(host.shadowRoot.querySelector('style').textContent).toBe('.a{--ns_c:red;color:var(--ns_c)}');
        });

        it('prefixes css variables set and removed through setStyle/removeStyle', () => {
            const renderer: any = factory.createRenderer(null, null);
            const el = document.createElement('div');
            renderer.setStyle(el, '--%NS%c', 'red', 0);
            expect(el.style.getPropertyValue('--ns_c')).toBe('red');
            renderer.removeStyle(el, '--%NS%c', 0);
            expect(el.style.getPropertyValue('--ns_c')).toBe('');
        });
    });
});
