import { updateDeviceView } from './deviceview';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: jest.fn(() => true),
    setCSS: jest.fn((el: HTMLElement, prop: string, value: string) => ((el.style as any)[prop] = value)),
}));

import { setCSS } from '@wm/core';

describe('updateDeviceView: coverage gaps', () => {
    let root: HTMLElement;

    afterEach(() => root?.remove());

    it('toggles a visible left panel from the header icon when the header has no search box', () => {
        root = document.createElement('div');
        root.innerHTML = `
            <header data-role="page-header"><span data-role="page-left-panel-icon"></span></header>
            <nav data-role="page-left-panel" class="page-left-panel visible"></nav>
            <div class="app-content-column"></div>`;
        document.body.appendChild(root);
        const leftNav: any = root.querySelector('.page-left-panel');
        leftNav.widget = { toggle: jest.fn(), collapse: jest.fn() };
        updateDeviceView(root);
        (root.querySelector('[data-role="page-left-panel-icon"]') as HTMLElement).click();
        expect(leftNav.widget.toggle).toHaveBeenCalledTimes(1);
        expect(setCSS).not.toHaveBeenCalled();
    });
});
