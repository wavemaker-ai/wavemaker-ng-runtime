import { RendererStyleFlags2, ViewEncapsulation } from '@angular/core';

import {
    NAMESPACE_URIS,
    WMDomRendererFactory2,
    flattenStyles,
    shimContentAttribute,
    shimHostAttribute
} from './wm_dom_renderer';

describe('wm_dom_renderer helpers', () => {
    it('shims content and host attributes', () => {
        expect(shimContentAttribute('abc')).toBe('_ngcontent-abc');
        expect(shimHostAttribute('abc')).toBe('_nghost-abc');
    });

    it('flattens nested styles and replaces the component placeholder', () => {
        expect(flattenStyles('c1', ['.a-%COMP%{}', ['.b-%COMP%{}', ['.c{}']]], [])).toEqual(['.a-c1{}', '.b-c1{}', '.c{}']);
    });

    it('exposes known namespaces', () => {
        expect(NAMESPACE_URIS['svg']).toBe('http://www.w3.org/2000/svg');
    });
});

describe('WMDomRendererFactory2', () => {
    let eventManager: any;
    let sharedStyles: any;
    let factory: WMDomRendererFactory2;
    let renderer: any;

    beforeEach(() => {
        eventManager = { addEventListener: jest.fn(() => () => 'removed') };
        sharedStyles = { addStyles: jest.fn(), addHost: jest.fn(), removeHost: jest.fn() };
        factory = new WMDomRendererFactory2(eventManager, sharedStyles, 'app', document);
        renderer = factory.createRenderer(null, null);
    });

    describe('createRenderer', () => {
        it('returns the default renderer without element or type', () => {
            expect(factory.createRenderer(null, { id: 'x' } as any)).toBe(renderer);
            expect(factory.createRenderer(document.createElement('div'), null)).toBe(renderer);
        });

        it('creates and caches emulated renderers and applies the host attribute each time', () => {
            const type: any = { id: 'c1', encapsulation: ViewEncapsulation.Emulated, styles: ['.a-%COMP%{}'], data: {} };
            const host1 = document.createElement('div');
            const host2 = document.createElement('div');
            const r1: any = factory.createRenderer(host1, type);
            const r2 = factory.createRenderer(host2, type);
            expect(r2).toBe(r1);
            expect(r1).not.toBe(renderer);
            expect(sharedStyles.addStyles).toHaveBeenCalledTimes(1);
            expect(sharedStyles.addStyles).toHaveBeenCalledWith(['.a-app-c1{}']);
            expect(host1.hasAttribute('_nghost-app-c1')).toBe(true);
            expect(host2.hasAttribute('_nghost-app-c1')).toBe(true);

            const el = r1.createElement('span');
            expect(el.hasAttribute('_ngcontent-app-c1')).toBe(true);
        });

        it('creates shadow DOM renderers for ShadowDom and the legacy native value', () => {
            [ViewEncapsulation.ShadowDom, 1].forEach(enc => {
                const host = document.createElement('div');
                const r: any = factory.createRenderer(host, { id: 's', encapsulation: enc, styles: ['.x{}', '.y{}'], data: {} } as any);
                expect(sharedStyles.addHost).toHaveBeenCalled();
                expect(host.shadowRoot.querySelectorAll('style')).toHaveLength(2);

                // appendChild / insertBefore target the shadow root when the parent is the host
                const child = document.createElement('p');
                r.appendChild(host, child);
                expect(host.shadowRoot.contains(child)).toBe(true);
                const before = document.createElement('i');
                r.insertBefore(host, before, child);
                expect(before.nextSibling).toBe(child);

                // parentNode maps the shadow root back to the host
                expect(r.parentNode(child)).toBe(host.shadowRoot);
                const outside = document.createElement('div');
                const inner = document.createElement('b');
                outside.appendChild(inner);
                expect(r.parentNode(inner)).toBe(outside);

                r.removeChild(host, child);
                expect(host.shadowRoot.contains(child)).toBe(false);

                r.destroy();
                expect(sharedStyles.removeHost).toHaveBeenCalledWith(host.shadowRoot);
            });
        });

        it('registers styles once for non-encapsulated components', () => {
            const type: any = { id: 'n1', encapsulation: ViewEncapsulation.None, styles: ['.a-%COMP%{}'], data: {} };
            const el = document.createElement('div');
            expect(factory.createRenderer(el, type)).toBe(renderer);
            expect(factory.createRenderer(el, type)).toBe(renderer);
            expect(sharedStyles.addStyles).toHaveBeenCalledTimes(1);
            expect(sharedStyles.addStyles).toHaveBeenCalledWith(['.a-n1{}']);
        });

        it('begin/end are no-ops', () => {
            expect(factory.begin()).toBeUndefined();
            expect(factory.end()).toBeUndefined();
        });
    });

    describe('default renderer: nodes', () => {
        it('creates elements, namespaced elements, comments and text', () => {
            expect(renderer.createElement('div').tagName).toBe('DIV');
            const svg = renderer.createElement('rect', 'svg');
            expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
            expect(renderer.createElement('rect', 'http://custom/ns').namespaceURI).toBe('http://custom/ns');
            expect(renderer.createComment('c').nodeType).toBe(Node.COMMENT_NODE);
            expect(renderer.createText('t').textContent).toBe('t');
        });

        it('appends and inserts, redirecting into template content', () => {
            const parent = document.createElement('div');
            const a = document.createElement('a');
            const b = document.createElement('b');
            renderer.appendChild(parent, a);
            renderer.insertBefore(parent, b, a);
            expect(parent.firstChild).toBe(b);

            const tpl = document.createElement('template');
            const c = document.createElement('c-el');
            renderer.appendChild(tpl, c);
            expect(tpl.content.contains(c)).toBe(true);
            const d = document.createElement('d-el');
            renderer.insertBefore(tpl, d, c);
            expect(tpl.content.firstChild).toBe(d);

            expect(() => renderer.insertBefore(null, document.createElement('x'), null)).not.toThrow();
        });

        it('removes children, finds parents and siblings', () => {
            const parent = document.createElement('div');
            const a = document.createElement('a');
            const b = document.createElement('b');
            parent.append(a, b);
            expect(renderer.parentNode(a)).toBe(parent);
            expect(renderer.nextSibling(a)).toBe(b);
            renderer.removeChild(parent, a);
            expect(parent.contains(a)).toBe(false);
        });

        it('selects root elements by selector or node, clearing content unless preserved', () => {
            document.body.innerHTML = '<div id="root">content</div>';
            const el = renderer.selectRootElement('#root', true);
            expect(el.textContent).toBe('content');
            expect(renderer.selectRootElement(el).textContent).toBe('');
            expect(() => renderer.selectRootElement('#missing')).toThrow('did not match any elements');
        });

        it('setValue updates node values', () => {
            const t = document.createTextNode('a');
            renderer.setValue(t, 'b');
            expect(t.nodeValue).toBe('b');
        });
    });

    describe('default renderer: attributes, classes, styles, properties', () => {
        let el: HTMLElement;
        beforeEach(() => {
            el = document.createElement('div');
        });

        it('sets and removes plain attributes', () => {
            renderer.setAttribute(el, 'data-a', '1');
            expect(el.getAttribute('data-a')).toBe('1');
            renderer.removeAttribute(el, 'data-a');
            expect(el.hasAttribute('data-a')).toBe(false);
        });

        it('sets namespaced attributes (known and unknown namespace) and removes them', () => {
            const svg = document.createElementNS(NAMESPACE_URIS['svg'], 'svg');
            renderer.setAttribute(svg, 'href', '#x', 'xlink');
            expect(svg.getAttributeNS(NAMESPACE_URIS['xlink'], 'href')).toBe('#x');
            renderer.removeAttribute(svg, 'href', 'xlink');
            expect(svg.getAttributeNS(NAMESPACE_URIS['xlink'], 'href')).toBeNull();

            renderer.setAttribute(el, 'foo', 'v', 'custom');
            expect(el.getAttribute('custom:foo')).toBe('v');
            renderer.removeAttribute(el, 'foo', 'custom');
            expect(el.hasAttribute('custom:foo')).toBe(false);
        });

        it('applies a style attribute by resetting and parsing the style string', () => {
            el.style.setProperty('color', 'red');
            renderer.setAttribute(el, 'style', 'width: 10px; height : 5px; invalid; a:b:c');
            expect(el.style.width).toBe('10px');
            expect(el.style.height).toBe('5px');
            renderer.setAttribute(el, 'style', '');
            expect(el.style.width).toBe('10px'); // empty style strings are ignored
        });

        it('resetStyles removes listed properties', () => {
            const fake: any = { 0: 'color', length: 1, style: { removeProperty: jest.fn() } };
            renderer.resetStyles(fake);
            expect(fake.style.removeProperty).toHaveBeenCalledWith('color');
        });

        it('adds and removes classes', () => {
            renderer.addClass(el, 'x');
            expect(el.classList.contains('x')).toBe(true);
            renderer.removeClass(el, 'x');
            expect(el.classList.contains('x')).toBe(false);
        });

        it('sets styles with and without flags', () => {
            renderer.setStyle(el, 'color', 'red', 0);
            expect(el.style.color).toBe('red');
            renderer.setStyle(el, 'background-color', 'blue', RendererStyleFlags2.DashCase);
            expect(el.style.backgroundColor).toBe('blue');
            renderer.setStyle(el, 'width', '1px', RendererStyleFlags2.Important);
            expect(el.style.getPropertyPriority('width')).toBe('important');
        });

        it('removes styles with and without dash-case', () => {
            el.style.color = 'red';
            el.style.setProperty('background-color', 'blue');
            renderer.removeStyle(el, 'color', 0);
            renderer.removeStyle(el, 'background-color', RendererStyleFlags2.DashCase);
            expect(el.style.color).toBe('');
            expect(el.style.backgroundColor).toBe('');
        });

        it('sets properties, ignoring animation (@) properties and null elements', () => {
            renderer.setProperty(el, 'title', 'hello');
            expect(el.title).toBe('hello');
            renderer.setProperty(el, '@anim', 'x');
            expect((el as any)['@anim']).toBeUndefined();
            expect(() => renderer.setProperty(null, 'title', 'x')).not.toThrow();
            expect(() => renderer.setProperty(el, '', 'x')).not.toThrow();
        });

        it('destroy and destroyNode are no-ops', () => {
            expect(renderer.destroy()).toBeUndefined();
            expect(renderer.destroyNode).toBeNull();
        });
    });

    describe('default renderer: listen', () => {
        it('delegates to the event manager and returns the unlisten function', () => {
            const target = document.createElement('div');
            const unlisten = renderer.listen(target, 'click', () => true);
            expect(eventManager.addEventListener).toHaveBeenCalledWith(target, 'click', expect.any(Function));
            expect(unlisten()).toBe('removed');
        });

        it('ignores animation (@) events', () => {
            const off = renderer.listen(document.body, '@anim.done', () => true);
            expect(eventManager.addEventListener).not.toHaveBeenCalled();
            expect(off()).toBeUndefined();
        });

        it('resolves global targets by name', () => {
            renderer.listen('window', 'resize', () => true);
            renderer.listen('document', 'click', () => true);
            renderer.listen('body', 'click', () => true);
            expect(eventManager.addEventListener.mock.calls[0][0]).toBe(window);
            expect(eventManager.addEventListener.mock.calls[1][0]).toBe(document);
            expect(eventManager.addEventListener.mock.calls[2][0]).toBe(document.body);
        });

        it('throws for unsupported global targets', () => {
            expect(() => renderer.listen('nowhere', 'click', () => true)).toThrow('Unsupported event target');
        });

        it('wraps handlers: prevents default on false, unwraps on token', () => {
            const handler = jest.fn(() => false);
            renderer.listen(document.body, 'click', handler);
            const wrapped = eventManager.addEventListener.mock.calls[0][2];
            const event = { preventDefault: jest.fn(), returnValue: true };
            expect(wrapped(event)).toBeUndefined();
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.returnValue).toBe(false);

            handler.mockReturnValue(true as any);
            const event2 = { preventDefault: jest.fn() };
            wrapped(event2);
            expect(event2.preventDefault).not.toHaveBeenCalled();

            expect(wrapped('__ngUnwrap__')).toBe(handler);
        });
    });
});
