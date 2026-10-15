import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { App, UserDefinedExecutionContext } from '@wm/core';
import { SecurityService } from '@wm/security';
import { NavComponent } from './nav.component';
import { NavigationControlDirective } from './navigation-control.directive';
import { ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';

@Component({
    standalone: false,
    template: `<ul wmNav type="pills" name="coverNav" itemlabel="label" itemlink="link"></ul>`
})
class HostComponent {
    @ViewChild(NavComponent, { static: true }) wmComponent: NavComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [HostComponent],
    imports: [NavComponent, NavigationControlDirective],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Router, useValue: mockApp },
        { provide: UserDefinedExecutionContext, useValue: mockApp },
        { provide: SecurityService, useValue: {} }
    ]
};

describe('NavComponent coverage', () => {
    let fixture: ComponentFixture<HostComponent>;
    let nav: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        nav = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    it('activePageName reads from the app instance', () => {
        (mockApp as any).activePageName = 'Home';
        expect(nav.activePageName).toBe('Home');
    });

    it('selects the first active top-level node and marks it _selected', () => {
        const spy = jest.spyOn(nav, 'invokeEventCallback');
        const first = { label: 'a', value: { label: 'a' } };
        const active = { label: 'b', isactive: true, value: { label: 'b' } };
        const later = { label: 'c', isactive: true, value: { label: 'c' } };
        nav.nodes = [first, active, later];
        nav.nodes$.next(null);
        expect(nav.selecteditem).toEqual({ label: 'b' });
        expect((active as any)._selected).toBe(true);
        expect((later as any)._selected).toBeUndefined();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('selects an active nested (menu) node without _selected and skips later siblings', () => {
        const spy = jest.spyOn(nav, 'invokeEventCallback');
        const child = { label: 'child', isactive: true, value: 'cv', children: [] };
        const parent = { label: 'parent', children: [child] };
        const sibling = { label: 'sib', isactive: true, value: { label: 'sib' } };
        nav.nodes = [parent, sibling];
        nav.nodes$.next(null);
        expect(nav.selecteditem).toEqual({ label: 'child', isactive: true });
        expect((child as any)._selected).toBeUndefined();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('select', { $event: {}, $item: 'cv' });
    });

    it('does nothing when there are no nodes', () => {
        const spy = jest.spyOn(nav, 'invokeEventCallback');
        nav.selecteditem = undefined;
        nav.nodes = [];
        nav.nodes$.next(null);
        expect(nav.selecteditem).toBeUndefined();
        expect(spy).not.toHaveBeenCalled();
    });
});
