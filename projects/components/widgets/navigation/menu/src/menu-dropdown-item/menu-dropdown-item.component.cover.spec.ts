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

describe('MenuDropdownItemComponent - cover branches', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    const event = (): any => ({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    it('DOWN-ARROW on the last item hides the dropdown when it opens upward-left', () => {
        const { nextLi, menuRoot } = buildMenuTree();
        const { component, menuRef } = createComponent({ $element: $(menuRoot), menuposition: 'up,left' }, nextLi);
        // with a left opening menu the arrows keep the vertical meaning for up and down
        component.onKeyDown(event(), 'DOWN-ARROW');
        expect(menuRef.bsDropdown.hide).toHaveBeenCalled();
    });

    it('DOWN-ARROW on the last item of a downward menu does not hide it', () => {
        const { nextLi, menuRoot } = buildMenuTree();
        const { component, menuRef } = createComponent({ $element: $(menuRoot), menuposition: 'down,right' }, nextLi);
        component.onKeyDown(event(), 'DOWN-ARROW');
        expect(menuRef.bsDropdown.hide).not.toHaveBeenCalled();
    });

    it('SHIFT-TAB on an item that is neither first in the menu nor in its list just stops the event', () => {
        const { currentLi, menuRoot } = buildMenuTree();
        const { component, menuRef } = createComponent({ $element: $(menuRoot) }, currentLi);
        const $event = event();
        component.onKeyDown($event, 'SHIFT-TAB');
        expect(menuRef.bsDropdown.hide).not.toHaveBeenCalled();
        expect($event.stopPropagation).toHaveBeenCalled();
    });

    it('SHIFT-TAB on the first item of a nested list closes that list level', () => {
        const { childLi, currentLi, menuRoot } = buildMenuTree();
        currentLi.classList.add('open');
        const { component, menuRef } = createComponent({ $element: $(menuRoot) }, childLi);
        const $event = event();
        component.onKeyDown($event, 'SHIFT-TAB');
        expect(menuRef.bsDropdown.hide).not.toHaveBeenCalled();
        expect(currentLi.classList.contains('open')).toBe(false);
        expect($event.preventDefault).toHaveBeenCalled();
    });
});
