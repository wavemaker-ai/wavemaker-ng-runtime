import { Component, ViewChild } from '@angular/core';
import { ComponentFixtureAutoDetect } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { AbstractI18nService, App, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { MenuComponent } from './menu.component';
import { MenuDropdownComponent } from './menu-dropdown/menu-dropdown.component';
import { MenuDropdownItemComponent } from './menu-dropdown-item/menu-dropdown-item.component';
import { NavigationControlDirective } from './nav/navigation-control.directive';
import { NavComponent } from './nav/nav.component';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';

@Component({
    standalone: false,
    template: `<div wmMenu dropdown name="menu1" caption="My Menu" itemlabel="firstname" itemlink="link"></div>`
})
class HostComponent {
    @ViewChild(MenuComponent, { static: true }) wmComponent: MenuComponent;
}

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(null)));

const setup = (extraProviders: any[] = [], app: any = mockApp) => {
    const fixture = compileTestComponent({
        declarations: [HostComponent],
        imports: [MenuComponent, MenuDropdownComponent, MenuDropdownItemComponent, NavigationControlDirective, BsDropdownModule, BrowserAnimationsModule],
        providers: [
            { provide: Router, useValue: Router },
            { provide: App, useValue: app },
            { provide: SecurityService, useValue: SecurityService },
            { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
            { provide: ComponentFixtureAutoDetect, useValue: true },
            { provide: AbstractI18nService, useClass: MockAbstractI18nService },
            provideAnimations(),
            ...extraProviders
        ],
        teardown: { destroyAfterEach: true }
    }, HostComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance.wmComponent as any };
};

describe('MenuComponent - nav parent, empty nodes and auto open', () => {
    afterEach(() => jest.restoreAllMocks());

    it('ignores empty node lists when the dataset notifies', () => {
        const { cmp } = setup();
        const spy = jest.spyOn(cmp, 'onMenuItemSelect');
        cmp.nodes = [];
        cmp.nodes$.next(null);
        expect(spy).not.toHaveBeenCalled();
    });

    it('leaves item selection to the parent nav and inherits its disableMenuContext flag', () => {
        const { cmp } = setup([{ provide: NavComponent, useValue: { disableMenuContext: true } }]);
        expect(cmp.disableMenuContext).toBe(true);
        const spy = jest.spyOn(cmp, 'onMenuItemSelect');
        cmp.nodes = [{ value: {}, isactive: true, children: [] }];
        cmp.nodes$.next(null);
        expect(spy).not.toHaveBeenCalled();
    });

    it('treats a missing disableMenuContext on the parent nav as false', () => {
        const { cmp } = setup([{ provide: NavComponent, useValue: {} }]);
        expect(cmp.disableMenuContext).toBe(false);
    });

    it('opens on init when autoopen is "activepage" and an item links to the current page', () => {
        const { cmp } = setup();
        const show = jest.fn();
        cmp.bsDropdown = { show };
        jest.spyOn(Object.getPrototypeOf(MenuComponent.prototype), 'resetNodes').mockImplementation(() => undefined);
        cmp.autoopen = 'activepage';
        cmp.route = { url: '/Main' };
        cmp.nodes = [{ link: '#/Other' }];
        cmp.resetNodes();
        expect(show).not.toHaveBeenCalled();
        cmp.nodes = [{ link: '#/Main' }];
        cmp.resetNodes();
        expect(show).toHaveBeenCalledTimes(1);
    });
});

describe('MenuComponent - highlightActiveLink', () => {
    it('toggles the active class of the dropdown toggle for the current page', async () => {
        let highlight: () => void;
        const cancel = jest.fn();
        const app = { ...mockApp, subscribe: jest.fn((evt: string, fn: any) => { if (evt === 'highlightActiveLink') { highlight = fn; } return cancel; }) };
        const { cmp, fixture } = setup([], app);
        const toggle: HTMLElement = fixture.nativeElement.querySelector('.dropdown-toggle');
        expect(toggle).toBeTruthy();
        cmp.route = { url: '/Main' };
        cmp.nodes = [{ link: '#/Main' }];
        highlight();
        await nextFrame();
        expect(toggle.classList.contains('active')).toBe(true);
        cmp.nodes = [{ link: '#/Other' }];
        highlight();
        await nextFrame();
        expect(toggle.classList.contains('active')).toBe(false);
        fixture.destroy();
        expect(cancel).toHaveBeenCalled();
    });
});
