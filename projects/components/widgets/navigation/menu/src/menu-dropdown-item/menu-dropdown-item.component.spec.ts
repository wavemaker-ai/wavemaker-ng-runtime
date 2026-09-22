import { TestBed } from '@angular/core/testing';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    addClass: jest.fn(),
    toggleClass: jest.fn(),
    triggerItemAction: jest.fn(),
}));

import { addClass, toggleClass, triggerItemAction } from '@wm/core';
import { MenuComponent } from '../menu.component';
import { MenuDropdownItemComponent } from './menu-dropdown-item.component';

declare const $: any;

const defaultMenuRef = () => ({
    menualign: 'pull-left',
    menulayout: 'vertical',
    menuposition: undefined as any,
    autoclose: undefined as any,
    linktarget: undefined as any,
    bsDropdown: { hide: jest.fn() },
    $element: $(document.createElement('div')),
    onMenuItemSelect: jest.fn(),
    route: { url: '' },
});

const createComponent = (menuRefOverrides: any = {}, nativeElement?: HTMLElement, parentNav: any = null) => {
    const el = nativeElement ?? (() => {
        const li = document.createElement('li');
        document.body.appendChild(li);
        return li;
    })();
    const elRef: any = { nativeElement: el };
    const app: any = { subscribe: jest.fn().mockReturnValue(jest.fn()) };
    const userDefinedExecutionContext: any = {};
    const menuRef: any = { ...defaultMenuRef(), ...menuRefOverrides };

    TestBed.configureTestingModule({ providers: [{ provide: MenuComponent, useValue: menuRef }] });
    const component = TestBed.runInInjectionContext(
        () => new MenuDropdownItemComponent(app, userDefinedExecutionContext, parentNav, elRef)
    );
    component.item = { link: undefined, children: [] };
    return { component, nativeElement: el, app, menuRef };
};

const buildMenuTree = () => {
    const menuRoot = document.createElement('div');
    menuRoot.innerHTML = `
        <ul class="dropdown-menu" id="topUl">
            <li id="prevLi"><a id="prevLink" href="#">Prev</a></li>
            <li id="currentLi"><a id="currentLink" href="#">Current</a>
                <ul class="dropdown-menu" id="childUl">
                    <li id="childLi"><a id="childLink" href="#">Child</a></li>
                </ul>
            </li>
            <li id="nextLi"><a id="nextLink" href="#">Next</a></li>
        </ul>`;
    document.body.appendChild(menuRoot);
    return {
        menuRoot,
        topUl: menuRoot.querySelector('#topUl') as HTMLElement,
        prevLi: menuRoot.querySelector('#prevLi') as HTMLElement,
        prevLink: menuRoot.querySelector('#prevLink') as HTMLElement,
        currentLi: menuRoot.querySelector('#currentLi') as HTMLElement,
        currentLink: menuRoot.querySelector('#currentLink') as HTMLElement,
        childUl: menuRoot.querySelector('#childUl') as HTMLElement,
        childLi: menuRoot.querySelector('#childLi') as HTMLElement,
        childLink: menuRoot.querySelector('#childLink') as HTMLElement,
        nextLi: menuRoot.querySelector('#nextLi') as HTMLElement,
        nextLink: menuRoot.querySelector('#nextLink') as HTMLElement,
    };
};

describe('MenuDropdownItemComponent', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should add the app-menu-item class to the native element', () => {
            const { nativeElement } = createComponent();
            expect(addClass).toHaveBeenCalledWith(nativeElement, 'app-menu-item');
        });

        it('should default the caret alignment to pull-left when menualign is unrecognized', () => {
            const { component } = createComponent({ menualign: undefined });
            expect(component.menualign).toBe('fa-caret-right');
        });

        it('should read the caret alignment class for a known menualign value', () => {
            const { component } = createComponent({ menualign: 'pull-right' });
            expect(component.menualign).toBe('fa-caret-left');
        });

        it('should read the inline dropdown caret alignment', () => {
            const { component } = createComponent({ menualign: 'dropinline-menu' });
            expect(component.menualign).toBe('fa-caret-down');
        });
    });

    describe('getInitialKeyMovements', () => {
        it('should use default arrow-key mappings for a vertical, non-inline menu', () => {
            const { component } = createComponent({ menulayout: 'vertical', menuposition: undefined });
            const movements = component.getInitialKeyMovements();
            expect(movements.MOVE_UP).toBe('UP-ARROW');
            expect(movements.MOVE_DOWN).toBe('DOWN-ARROW');
            expect(movements.MOVE_LEFT).toBe('LEFT-ARROW');
            expect(movements.MOVE_RIGHT).toBe('RIGHT-ARROW');
        });

        it('should remap movements for a horizontal menu layout', () => {
            const { component } = createComponent({ menulayout: 'horizontal' });
            const movements = component.getInitialKeyMovements();
            expect(movements.MOVE_UP).toBe('LEFT-ARROW');
            expect(movements.MOVE_LEFT).toBe('UP-ARROW');
            expect(movements.MOVE_RIGHT).toBe('DOWN-ARROW');
            expect(movements.MOVE_DOWN).toBe('RIGHT-ARROW');
        });

        it('should remap movements for an inline menu position', () => {
            const { component } = createComponent({ menulayout: 'vertical', menuposition: 'inline' });
            const movements = component.getInitialKeyMovements();
            expect(movements.MOVE_UP).toBe('LEFT-ARROW');
        });

        it('should swap left/right for menus opening toward the left', () => {
            const { component } = createComponent({ menulayout: 'vertical', menuposition: 'down,left' });
            const movements = component.getInitialKeyMovements();
            expect(movements.MOVE_LEFT).toBe('RIGHT-ARROW');
            expect(movements.MOVE_RIGHT).toBe('LEFT-ARROW');
        });
    });

    describe('keydown host listener delegation', () => {
        it.each([
            ['onKeyDownTab', 'TAB'],
            ['onKeyDownShiftTab', 'SHIFT-TAB'],
            ['onKeyDownEscape', 'ESC'],
            ['onKeyDownEnter', 'ENTER'],
            ['onKeyDownArrowUp', 'UP-ARROW'],
            ['onKeyDownArrowDown', 'DOWN-ARROW'],
            ['onKeyDownArrowRight', 'RIGHT-ARROW'],
            ['onKeyDownArrowLeft', 'LEFT-ARROW'],
        ])('%s should delegate to onKeyDown with %s', (method, action) => {
            const { component } = createComponent();
            const spy = jest.spyOn(component, 'onKeyDown').mockImplementation(() => undefined);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            (component as any)[method]($event);
            expect(spy).toHaveBeenCalledWith($event, action);
        });
    });

    describe('onKeyDown', () => {
        it('should preventDefault for arrow key actions', () => {
            const { currentLi, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'UP-ARROW');
            expect($event.preventDefault).toHaveBeenCalled();
        });

        it('ESC should hide the bsDropdown', () => {
            const { currentLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'ESC');
            expect(menuRef.bsDropdown.hide).toHaveBeenCalled();
        });

        it('TAB on the last top-level item hides the dropdown', () => {
            const { nextLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent({ $element: $(menuRoot) }, nextLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'TAB');
            expect(menuRef.bsDropdown.hide).toHaveBeenCalled();
        });

        it('SHIFT-TAB on the first top-level item hides the dropdown', () => {
            const { prevLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent({ $element: $(menuRoot) }, prevLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'SHIFT-TAB');
            expect(menuRef.bsDropdown.hide).toHaveBeenCalled();
        });

        it('TAB on a middle item just stops propagation', () => {
            const { currentLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'TAB');
            expect(menuRef.bsDropdown.hide).not.toHaveBeenCalled();
            expect($event.stopPropagation).toHaveBeenCalled();
        });

        it('ENTER should focus its own link when the item has no link and no children', () => {
            const { currentLi, currentLink, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            component.item = { link: undefined, children: [] };
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'ENTER');
            expect(document.activeElement).toBe(currentLink);
        });

        it('ENTER should open the item and focus the first child link when the item has children', () => {
            const { currentLi, childLink, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            component.item = { link: undefined, children: [{}] };
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'ENTER');
            expect(currentLi.classList.contains('open')).toBe(true);
            expect(document.activeElement).toBe(childLink);
        });

        it('RIGHT-ARROW should behave like an enter-without-link (open + focus first child)', () => {
            const { currentLi, childLink, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            component.item = { link: '#/home', children: [{}] };
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'RIGHT-ARROW');
            expect(document.activeElement).toBe(childLink);
        });

        it('ENTER with a link should delegate to onSelect', () => {
            const { currentLi, menuRoot } = buildMenuTree();
            currentLi.classList.add('app-menu-item');
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            component.item = { link: '#/home', children: [] };
            const selectSpy = jest.spyOn(component, 'onSelect');
            const $event: any = { target: currentLi, preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'ENTER');
            expect(selectSpy).toHaveBeenCalledWith($event, component.item);
        });

        it('LEFT-ARROW on a nested submenu item should close it and focus the parent link', () => {
            const { currentLi, currentLink, childLi, menuRoot } = buildMenuTree();
            currentLi.classList.add('open');
            const { component } = createComponent({ $element: $(menuRoot) }, childLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'LEFT-ARROW');
            expect(currentLi.classList.contains('open')).toBe(false);
            expect(document.activeElement).toBe(currentLink);
        });

        it('LEFT-ARROW at the top level does nothing', () => {
            const { currentLi, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            expect(() => component.onKeyDown($event, 'LEFT-ARROW')).not.toThrow();
            expect(currentLi.classList.contains('open')).toBe(false);
        });

        it('UP-ARROW should focus the previous sibling link', () => {
            const { currentLi, prevLink, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'UP-ARROW');
            expect(document.activeElement).toBe(prevLink);
        });

        it('UP-ARROW on the first item does nothing', () => {
            const { prevLi, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, prevLi);
            const activeBefore = document.activeElement;
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            expect(() => component.onKeyDown($event, 'UP-ARROW')).not.toThrow();
            expect(document.activeElement).toBe(activeBefore);
        });

        it('DOWN-ARROW should focus the next sibling link', () => {
            const { currentLi, nextLink, menuRoot } = buildMenuTree();
            const { component } = createComponent({ $element: $(menuRoot) }, currentLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'DOWN-ARROW');
            expect(document.activeElement).toBe(nextLink);
        });

        it('DOWN-ARROW on the last item hides the dropdown when it opens upward-right', () => {
            const { nextLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent({ $element: $(menuRoot), menuposition: 'up,right' }, nextLi);
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'DOWN-ARROW');
            expect(menuRef.bsDropdown.hide).toHaveBeenCalled();
        });

        it('DOWN-ARROW on the last item focuses the next sibling when the menu is horizontal', () => {
            const { nextLi, menuRoot } = buildMenuTree();
            const { component, menuRef } = createComponent(
                { $element: $(menuRoot), menulayout: 'horizontal', menuposition: 'up,right' },
                nextLi
            );
            const $event: any = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onKeyDown($event, 'DOWN-ARROW');
            expect(menuRef.bsDropdown.hide).not.toHaveBeenCalled();
        });
    });

    describe('onSelect', () => {
        it('should ignore a click whose target is not inside this menu item', () => {
            const { component, menuRef } = createComponent();
            const otherMenuItem = document.createElement('li');
            otherMenuItem.className = 'app-menu-item';
            document.body.appendChild(otherMenuItem);
            const $event: any = { target: otherMenuItem, preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onSelect($event, component.item);
            expect($event.preventDefault).not.toHaveBeenCalled();
            expect(menuRef.onMenuItemSelect).not.toHaveBeenCalled();
        });

        it('should handle a click targeting this menu item and trigger the item action', () => {
            const { component, nativeElement, menuRef } = createComponent({ linktarget: '_self' });
            nativeElement.classList.add('app-menu-item');
            component.item = { link: '#/home', target: undefined };
            const $event: any = { target: nativeElement, preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onSelect($event, component.item);
            expect($event.preventDefault).toHaveBeenCalled();
            expect(menuRef.onMenuItemSelect).toHaveBeenCalledWith({ $event, $item: component.item });
            expect(triggerItemAction).toHaveBeenCalledWith(component, expect.objectContaining({ link: '#/home', target: '_self' }));
        });

        it('should stop propagation when autoclose is outsideClick', () => {
            const { component, nativeElement } = createComponent({ autoclose: 'outsideClick' });
            nativeElement.classList.add('app-menu-item');
            component.item = { link: '#/home' };
            const $event: any = { target: nativeElement, preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onSelect($event, component.item);
            expect($event.stopPropagation).toHaveBeenCalled();
        });

        it('should preserve an explicit item target over the menu linktarget default', () => {
            const { component, nativeElement } = createComponent({ linktarget: '_self' });
            nativeElement.classList.add('app-menu-item');
            component.item = { link: '#/home', target: '_blank' };
            const $event: any = { target: nativeElement, preventDefault: jest.fn(), stopPropagation: jest.fn() };
            component.onSelect($event, component.item);
            expect(triggerItemAction).toHaveBeenCalledWith(component, expect.objectContaining({ target: '_blank' }));
        });
    });

    describe('ngOnInit', () => {
        it('should do nothing when there is no parent nav', () => {
            const { component, app } = createComponent();
            component.ngOnInit();
            expect(app.subscribe).not.toHaveBeenCalled();
        });

        it('should add the active class when the item links to the current page and there is a parent nav', () => {
            const { component, nativeElement } = createComponent({ route: { url: 'home' } }, undefined, {});
            component.item = { link: '#/home' };
            component.ngOnInit();
            expect(addClass).toHaveBeenCalledWith(nativeElement, 'active');
        });

        it('should not add the active class when the item does not link to the current page', () => {
            const { component } = createComponent({ route: { url: 'home' } }, undefined, {});
            component.item = { link: '#/about' };
            (addClass as jest.Mock).mockClear();
            component.ngOnInit();
            expect(addClass).not.toHaveBeenCalledWith(expect.anything(), 'active');
        });

        it('should subscribe to highlightActiveLink and toggle the active class on for a matching link', () => {
            const { component, app, nativeElement } = createComponent({ route: { url: 'home' } }, undefined, {});
            component.item = { link: '#/home' };
            component.ngOnInit();
            expect(app.subscribe).toHaveBeenCalledWith('highlightActiveLink', expect.any(Function));
            const callback = app.subscribe.mock.calls[0][1];
            callback({});
            expect(toggleClass).toHaveBeenCalledWith(nativeElement, 'active', true);
        });

        it('should toggle the active class off when the item no longer links to the current page', () => {
            const { component, app, nativeElement } = createComponent({ route: { url: 'home' } }, undefined, {});
            component.item = { link: '#/home' };
            component.ngOnInit();
            const callback = app.subscribe.mock.calls[0][1];
            component.item = { link: '#/about' };
            callback({});
            expect(toggleClass).toHaveBeenCalledWith(nativeElement, 'active', false);
        });
    });

    describe('ngOnDestroy', () => {
        it('should call the highlightActiveLink unsubscribe function when set', () => {
            const { component, app } = createComponent({ route: { url: 'home' } }, undefined, {});
            component.item = { link: '#/home' };
            component.ngOnInit();
            const unsubscribeFn = app.subscribe.mock.results[0].value;
            component.ngOnDestroy();
            expect(unsubscribeFn).toHaveBeenCalled();
        });

        it('should be a no-op when there was no parent nav subscription', () => {
            const { component } = createComponent();
            expect(() => component.ngOnDestroy()).not.toThrow();
        });
    });
});
