import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { By } from '@angular/platform-browser';
import { waitForAsync, ComponentFixture, ComponentFixtureAutoDetect, fakeAsync, tick } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { MENU_POSITION, MenuComponent } from './menu.component';
import { MenuDropdownComponent } from './menu-dropdown/menu-dropdown.component';
import { MenuDropdownItemComponent } from './menu-dropdown-item/menu-dropdown-item.component';
import { NavigationControlDirective } from './nav/navigation-control.directive';
import { Router } from '@angular/router';
import { AbstractI18nService, App, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { ButtonComponent } from '@wm/components/input/button';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, getHtmlSelectorElement, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { AUTOCLOSE_TYPE } from '@wm/components/base';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';

const markup = `<div
                wmMenu
                dropdown
                fontsize="16"
                fontfamily="Times New Roman"
                color="#000000"
                fontweight="400"
                textalign="start"
                backgroundcolor
                backgroundrepeat="repeat"
                backgroundposition
                backgroundimage
                backgroundsize="auto"
                backgroundattachment="scroll"
                bordercolor="#000000"
                borderstyle
                borderwidth="0px"
                padding="0px"
                margin="0px"
                tabindex="0"
                caption="My Menu"
                autoclose="outsideClick"
                name="menu1"
                menuposition="inline"
                animateitems="fade"
                shortcutkey="x"
                itemlabel="firstname"
                itemlink="link"
                itemicon="icon"
                itemchildren="children"
                select.event="menu1Select($event, widget, $item)">`;
@Component({
    standalone: false,
    template: markup
})
class MenuWrapperComponent {
    @ViewChild(MenuComponent, /* TODO: add static flag */ { static: true })
    wmComponent: MenuComponent;

    public testdata = 'Op1,op2,op3';

    public testDataforActions = [{ firstname: 'keith', link: 'https://s3.amazonaws.com/wmstudio-apps/salesrep/Keith-Neilson.png', icon: 'wi wi-home' }];


    menu1Select($event, widget, $item) { }
}

const menuComponentModuleDef: ITestModuleDef = {
    declarations: [MenuWrapperComponent],
    imports: [MenuComponent, MenuDropdownComponent, MenuDropdownItemComponent, NavigationControlDirective, BsDropdownModule, BrowserAnimationsModule],
    providers: [
        { provide: Router, useValue: Router },
        { provide: App, useValue: mockApp },
        { provide: SecurityService, useValue: SecurityService },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: ComponentFixtureAutoDetect, useValue: true },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        provideAnimations()
    ],
    teardown: { destroyAfterEach: true }
};


describe('MenuComponent - additional behaviour', () => {
    let fixture: ComponentFixture<MenuWrapperComponent>;
    let cmp: any;
    let dropdown: any;

    const key = (type = 'keydown') => ({ preventDefault: jest.fn(), type } as any);

    beforeEach(() => {
        fixture = compileTestComponent(menuComponentModuleDef, MenuWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        dropdown = { isOpen: false, show: jest.fn(), hide: jest.fn(), toggle: jest.fn() };
        cmp.bsDropdown = dropdown;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('keyboard and hover handling', () => {
        it('opens a closed menu on the down and right arrows and selects the first item', () => {
            cmp.onKeyDownArrowDown(key());
            expect(dropdown.show).toHaveBeenCalled();
            expect(cmp._selectFirstItem).toBe(true);
            dropdown.show.mockClear();
            cmp.onKeyDownArrowRight(key());
            expect(dropdown.show).toHaveBeenCalled();
        });

        it('focuses the first item of an open menu', () => {
            dropdown.isOpen = true;
            const focus = jest.fn();
            jest.spyOn($.fn, 'find').mockReturnValue({ first: () => ({ find: () => ({ focus }) }) } as any);
            cmp.onKeyDownArrowDown(key());
            expect(dropdown.show).not.toHaveBeenCalled();
            expect(focus).toHaveBeenCalled();
        });

        it('toggles on enter and on mouse enter only when showing on hover', () => {
            cmp.onKeyDownEnter(key());
            expect(dropdown.toggle).toHaveBeenCalledWith(true);
            dropdown.toggle.mockClear();
            cmp.showonhover = false;
            cmp.onMouseEnter(key('mouseenter'));
            expect(dropdown.toggle).not.toHaveBeenCalled();
            cmp.showonhover = true;
            cmp.onMouseEnter(key('mouseenter'));
            expect(dropdown.toggle).toHaveBeenCalledWith(true);
        });

        it('hides on the up and left arrows and when leaving a hover menu that always closes', () => {
            cmp.onKeyDownArrowUp(key());
            cmp.onKeyDownArrowLeft(key());
            expect(dropdown.hide).toHaveBeenCalledTimes(2);
            dropdown.hide.mockClear();
            cmp.showonhover = true;
            cmp.autoclose = 'always';
            cmp.onMouseLeave(key('mouseleave'));
            expect(dropdown.hide).toHaveBeenCalledTimes(1);
            cmp.autoclose = 'outsideClick';
            cmp.onMouseLeave(key('mouseleave'));
            expect(dropdown.hide).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['up,right', 'DOWN-ARROW', 'hide'],
            ['up,right', 'UP-ARROW', 'show'],
            ['up,left', 'RIGHT-ARROW', 'hide'],
            ['up,left', 'LEFT-ARROW', 'show'],
            ['down,left', 'RIGHT-ARROW', 'hide'],
            ['down,left', 'LEFT-ARROW', 'show'],
        ])('reverses the arrows of %s menus (%s)', (position, action, expected) => {
            cmp.menuposition = position;
            cmp.onKeyDown(key(), action);
            expect(dropdown[expected]).toHaveBeenCalled();
        });

        it('prevents the default action', () => {
            const ev = key();
            cmp.onKeyDown(ev, 'OTHER');
            expect(ev.preventDefault).toHaveBeenCalled();
        });
    });

    describe('shown and hidden', () => {
        it('remembers the position and focuses the first item after showing', () => {
            jest.useFakeTimers();
            const focus = jest.fn();
            jest.spyOn($.fn, 'find').mockReturnValue({ first: () => ({ find: () => ({ focus }) }) } as any);
            cmp.menuposition = 'up,left';
            cmp._selectFirstItem = true;
            cmp.onShow();
            expect(cmp._menuposition).toBe('up,left');
            jest.runAllTimers();
            expect(focus).toHaveBeenCalled();
        });

        it('does not focus when no first item was requested', () => {
            jest.useFakeTimers();
            const find = jest.spyOn($.fn, 'find');
            cmp._selectFirstItem = false;
            cmp.onShow();
            jest.runAllTimers();
            expect(find).not.toHaveBeenCalled();
        });

        it('restores the opening position when hidden', () => {
            cmp._menuposition = 'up,right';
            cmp.menuposition = 'down,left';
            cmp._selectFirstItem = true;
            cmp.onHide();
            expect(cmp.menuposition).toBe('up,right');
            expect(cmp._selectFirstItem).toBe(false);
            cmp._menuposition = undefined;
            cmp.onHide();
            expect(cmp.menuposition).toBe('down,right');
        });
    });

    describe('menu positions', () => {
        it.each([
            ['down,right', false, 'pull-left', 'fa-caret-down'],
            ['down,left', false, 'pull-right', 'fa-caret-down'],
            ['up,left', true, 'pull-right', 'fa-caret-up'],
            ['up,right', true, 'pull-left', 'fa-caret-up'],
        ])('applies %s', async (position, dropup, align, caret) => {
            cmp.menuposition = position;
            cmp.setMenuPosition();
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
            expect(cmp.nativeElement.classList.contains('dropup')).toBe(dropup);
            expect(cmp.menualign).toBe(align);
            expect(cmp.menuCaret).toBe(caret);
        });

        it('uses an inline menu alignment', () => {
            cmp.menuposition = 'inline';
            cmp.setMenuPosition();
            expect(cmp.menualign).toBe('dropinline-menu');
        });
    });

    describe('properties and items', () => {
        it('updates the auto close state of the dropdown', () => {
            dropdown._state = { autoClose: true };
            cmp.onPropertyChange('autoclose', 'disabled');
            expect(dropdown._state.autoClose).toBe(false);
            expect(cmp.autoclose).toBe('disabled');
            cmp.onPropertyChange('autoclose', 'always');
            expect(dropdown._state.autoClose).toBe(true);
        });

        it('delegates other property changes including tabindex to the base class', () => {
            const base = jest.spyOn(Object.getPrototypeOf(MenuComponent.prototype), 'onPropertyChange').mockImplementation(() => undefined);
            cmp.onPropertyChange('tabindex', 2, 0);
            cmp.onPropertyChange('caption', 'x', 'y');
            expect(base).toHaveBeenCalledTimes(2);
        });

        it('raises the select event with the item value', () => {
            const spy = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            const $event = { type: 'click' };
            cmp.onMenuItemSelect({ $event, $item: { value: { id: 1 } } });
            expect(spy).toHaveBeenCalledWith('select', { $event, $item: { id: 1 } });
        });

        it('opens automatically when asked to', () => {
            jest.spyOn(Object.getPrototypeOf(MenuComponent.prototype), 'resetNodes').mockImplementation(() => undefined);
            cmp.autoopen = 'always';
            cmp.resetNodes();
            expect(dropdown.show).toHaveBeenCalled();
            dropdown.show.mockClear();
            cmp.autoopen = 'never';
            cmp.resetNodes();
            expect(dropdown.show).not.toHaveBeenCalled();
        });

        it('fixes a NaN tab index after the view was initialised', () => {
            cmp.widget.tabindex = NaN;
            cmp.ngAfterViewInit();
            expect(cmp.tabindex).toBe(0);
        });
    });

    describe('active item on load', () => {
        it('selects the first active item of nested nodes and triggers its action', () => {
            const spy = jest.spyOn(cmp, 'onMenuItemSelect').mockImplementation(() => undefined);
            const active = { value: { id: 3 }, isactive: true, children: [] };
            cmp.nodes = [{ value: {}, children: [{ value: {}, children: [active] }] }, { value: {}, isactive: true, children: [] }];
            cmp.nodes$.next(cmp.nodes);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith({ $event: {}, $item: active });
        });

        it('highlights the toggle when a node links to the current page', () => {
            cmp.route = { url: '/Home' };
            const toggle = cmp.nativeElement.querySelector('.dropdown-toggle');
            cmp.nodes = [{ value: {}, link: '#/Home', children: [] }];
            cmp.nodes$.next(cmp.nodes);
            expect(toggle).toBeTruthy();
        });
    });
});
