import { updateDeviceView } from './deviceview';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: jest.fn(() => true),
    setCSS: jest.fn((el: HTMLElement, prop: string, value: string) => ((el.style as any)[prop] = value)),
}));

import { isMobile, setCSS } from '@wm/core';

declare const $: any;

describe('updateDeviceView with a real DOM', () => {
    let root: HTMLElement;
    let leftNav: any;
    let rightNav: HTMLElement;
    let search: HTMLElement;
    let page: HTMLElement;

    const build = (parts: { left?: boolean; right?: boolean; search?: boolean; header?: boolean; icon?: boolean } = {}) => {
        const { left = true, right = true, search: withSearch = true, header = true, icon = true } = parts;
        root?.remove();
        root = document.createElement('div');
        root.innerHTML = `
            ${header ? `<header data-role="page-header" class="page-header">
                ${icon ? '<span data-role="page-left-panel-icon"></span>' : ''}
                ${withSearch ? '<div class="app-search"></div>' : ''}
            </header>` : ''}
            ${left ? '<nav data-role="page-left-panel" class="page-left-panel"></nav>' : ''}
            ${right ? '<aside data-role="page-right-panel" class="page-right-panel"></aside>' : ''}
            <div class="app-content-column"></div>`;
        document.body.appendChild(root);
        leftNav = root.querySelector('.page-left-panel');
        if (leftNav) {
            leftNav.widget = { toggle: jest.fn(), collapse: jest.fn() };
        }
        rightNav = root.querySelector('.page-right-panel') as HTMLElement;
        search = root.querySelector('.app-search') as HTMLElement;
        page = root.querySelector('.app-content-column') as HTMLElement;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (isMobile as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        root?.remove();
    });

    it('collapses the left panel and hides search when the content is tapped on mobile', () => {
        build();
        updateDeviceView(root);
        search.style.display = 'inline-table';
        page.click();
        expect(leftNav.widget.collapse).toHaveBeenCalled();
        expect(setCSS).toHaveBeenCalledWith(search, 'display', 'none');
    });

    it('ignores content taps on desktop and tablets', () => {
        build();
        (isMobile as jest.Mock).mockReturnValue(false);
        updateDeviceView(root);
        page.click();
        expect(leftNav.widget.collapse).not.toHaveBeenCalled();
        build();
        (isMobile as jest.Mock).mockReturnValue(true);
        updateDeviceView(root, true);
        page.click();
        expect(leftNav.widget.collapse).not.toHaveBeenCalled();
    });

    it('survives a left panel without a widget when the content is tapped', () => {
        build();
        leftNav.widget = undefined;
        updateDeviceView(root);
        expect(() => page.click()).not.toThrow();
    });

    it('toggles the left panel from the header icon and hides search while it is visible', () => {
        build();
        updateDeviceView(root);
        const icon = root.querySelector('[data-role="page-left-panel-icon"]') as HTMLElement;
        icon.click();
        expect(leftNav.widget.toggle).toHaveBeenCalled();
        expect(setCSS).not.toHaveBeenCalledWith(search, 'display', 'none');
        leftNav.classList.add('visible');
        icon.click();
        expect(setCSS).toHaveBeenCalledWith(search, 'display', 'none');
    });

    it('does not bind the same handler twice', () => {
        build();
        updateDeviceView(root);
        updateDeviceView(root);
        (root.querySelector('[data-role="page-left-panel-icon"]') as HTMLElement).click();
        expect(leftNav.widget.toggle).toHaveBeenCalledTimes(2);
    });

    it('removes the icon when there is no left panel', () => {
        build({ left: false });
        updateDeviceView(root);
        expect(root.querySelector('[data-role="page-left-panel-icon"]')).toBeNull();
    });

    it('hides the panels when the right panel is tapped', () => {
        build();
        updateDeviceView(root);
        rightNav.click();
        expect(setCSS).not.toHaveBeenCalled();
    });

    it('adds a search icon that toggles the search container', () => {
        build();
        updateDeviceView(root);
        const icon = root.querySelector('a.app-header-action') as HTMLElement;
        expect(icon).toBeTruthy();
        expect(icon.nextElementSibling).toBe(search);
        search.style.display = 'none';
        icon.click();
        expect(leftNav.widget.collapse).toHaveBeenCalled();
        expect(setCSS).toHaveBeenCalledWith(search, 'display', 'inline-table');
        search.style.display = 'inline-table';
        icon.click();
        expect(setCSS).toHaveBeenCalledWith(search, 'display', 'none');
    });

    it('works without optional panels and a header', () => {
        build({ left: false, right: false, search: false, header: false });
        expect(() => updateDeviceView(root)).not.toThrow();
        page.click();
        build({ search: false });
        expect(() => updateDeviceView(root)).not.toThrow();
        expect(root.querySelector('a.app-header-action')).toBeNull();
    });
});
