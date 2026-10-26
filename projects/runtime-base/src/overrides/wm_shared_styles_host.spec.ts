import { SharedStylesHost, WMDomSharedStylesHost } from './wm_shared_styles_host';

describe('SharedStylesHost', () => {
    it('tracks unique styles and reports only additions', () => {
        const host = new SharedStylesHost();
        const spy = jest.spyOn(host, 'onStylesAdded');
        host.addStyles(['a', 'b']);
        host.addStyles(['b', 'c']);
        expect(spy.mock.calls[0][0]).toEqual(new Set(['a', 'b']));
        expect(spy.mock.calls[1][0]).toEqual(new Set(['c']));
        expect(host.getAllStyles()).toEqual(['a', 'b', 'c']);
    });

    it('default onStylesAdded is a no-op', () => {
        expect(new SharedStylesHost().onStylesAdded(new Set(['x']))).toBeUndefined();
    });
});

describe('WMDomSharedStylesHost', () => {
    let host: WMDomSharedStylesHost;

    const headStyles = () => Array.from(document.head.querySelectorAll('style'));

    beforeEach(() => {
        document.head.innerHTML = '';
        host = new WMDomSharedStylesHost(document);
    });

    afterEach(() => {
        host.ngOnDestroy();
        document.head.innerHTML = '';
    });

    it('adds styles to the document head with the default nonce', () => {
        host.addStyles(['.a{}']);
        const [el] = headStyles();
        expect(el.textContent).toBe('.a{}');
        expect(el.getAttribute('nonce')).toBe('wm-csp-nonce');
    });

    it('uses the nonce from the CSP-NONCE meta tag when present', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'CSP-NONCE');
        meta.setAttribute('content', 'abc');
        document.head.appendChild(meta);
        host.addStyles(['.a{}']);
        expect(headStyles()[0].getAttribute('nonce')).toBe('abc');
    });

    it('falls back to the default nonce when the meta tag has no content', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'CSP-NONCE');
        document.head.appendChild(meta);
        host.addStyles(['.a{}']);
        expect(headStyles()[0].getAttribute('nonce')).toBe('wm-csp-nonce');
    });

    it('copies existing styles to newly added hosts and removes them with the host', () => {
        host.addStyles(['.a{}', '.b{}']);
        const shadowHost = document.createElement('div');
        const root = shadowHost.attachShadow({ mode: 'open' });
        host.addHost(root);
        expect(root.querySelectorAll('style')).toHaveLength(2);

        host.addStyles(['.c{}']);
        expect(root.querySelectorAll('style')).toHaveLength(3);

        host.removeHost(root);
        expect(root.querySelectorAll('style')).toHaveLength(0);
        host.addStyles(['.d{}']);
        expect(root.querySelectorAll('style')).toHaveLength(0);
    });

    it('removeHost ignores unknown hosts', () => {
        expect(() => host.removeHost(document.createElement('div'))).not.toThrow();
    });

    it('removeStyles is a no-op', () => {
        host.addStyles(['.a{}']);
        host.removeStyles(['.a{}'], []);
        expect(headStyles()).toHaveLength(1);
    });

    it('removes every style node on destroy', () => {
        host.addStyles(['.a{}']);
        host.ngOnDestroy();
        expect(headStyles()).toHaveLength(0);
    });
});
