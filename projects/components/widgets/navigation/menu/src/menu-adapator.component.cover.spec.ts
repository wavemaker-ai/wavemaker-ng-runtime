import { TestBed } from '@angular/core/testing';
import { Component, Inject, Injector, QueryList } from '@angular/core';
import { MenuAdapterComponent } from './menu-adapator.component';
import { MenuComponent } from './menu.component';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';

@Component({
    standalone: false,
    selector: 'app-test-menu-adapter-cover',
    template: '<div></div>'
})
class TestAdapterComponent extends MenuAdapterComponent {
    constructor(injector: Injector, @Inject('WIDGET_CONFIG') cfg: any, @Inject('EXPLICIT_CONTEXT') ctx: any) {
        super(injector, cfg, ctx);
    }
}

describe('MenuAdapterComponent cover', () => {
    let component: TestAdapterComponent;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [TestAdapterComponent],
            imports: [MenuComponent],
            providers: [
                { provide: 'WIDGET_CONFIG', useValue: { widgetType: 'wm-menu' } },
                { provide: 'EXPLICIT_CONTEXT', useValue: null },
                { provide: App, useValue: mockApp }
            ]
        });
        component = TestBed.createComponent(TestAdapterComponent).componentInstance;
    });

    it('does not set menu properties on init when no menu is rendered yet, and ignores empty query changes', () => {
        const ql = new QueryList<MenuComponent>();
        ql.reset([]);
        (component as any).menuRefQL = ql;
        const spy = jest.spyOn(component as any, 'setMenuProperty');

        component.ngAfterViewInit();
        expect(spy).not.toHaveBeenCalled();

        ql.notifyOnChanges();
        expect(spy).not.toHaveBeenCalled();
        expect((component as any).menuRefQLSubscription).toBeTruthy();
    });

    it('sets menu properties on init when a menu already exists', () => {
        const menu: any = {};
        const ql = new QueryList<MenuComponent>();
        ql.reset([menu]);
        (component as any).menuRefQL = ql;
        (component as any).itemlabel = 'L';
        component.ngAfterViewInit();
        expect((component as any).menuRef).toBe(menu);
        expect(menu.itemlabel).toBe('L');
        // bind props falsy -> not copied
        expect('binditemicon' in menu).toBe(false);
        (component as any).menuRefQLSubscription?.unsubscribe();
    });

    it('unsubscribes after the first emission containing a menu and tolerates a second emission', () => {
        const ql = new QueryList<MenuComponent>();
        ql.reset([]);
        (component as any).menuRefQL = ql;
        component.ngAfterViewInit();
        const sub = (component as any).menuRefQLSubscription;
        const unsubSpy = jest.spyOn(sub, 'unsubscribe');
        const menu: any = {};
        ql.reset([menu]);
        ql.notifyOnChanges();
        expect(unsubSpy).toHaveBeenCalled();
        expect((component as any).menuRefQLSubscription).toBeNull();
        expect((component as any).menuRef).toBe(menu);
    });

    it('handles an emission when the subscription reference was already cleared', () => {
        const ql = new QueryList<MenuComponent>();
        ql.reset([]);
        (component as any).menuRefQL = ql;
        component.ngAfterViewInit();
        const sub = (component as any).menuRefQLSubscription;
        (component as any).menuRefQLSubscription = null;
        const menu: any = {};
        ql.reset([menu]);
        ql.notifyOnChanges();
        expect((component as any).menuRef).toBe(menu);
        sub.unsubscribe();
    });

    it('ngOnDestroy unsubscribes and clears references', () => {
        const unsubscribe = jest.fn();
        (component as any).menuRefQLSubscription = { unsubscribe };
        (component as any).menuRef = {};
        component.ngOnDestroy();
        expect(unsubscribe).toHaveBeenCalled();
        expect((component as any).menuRefQLSubscription).toBeNull();
        expect((component as any).menuRefQL).toBeNull();
        expect((component as any).menuRef).toBeNull();
    });

    it('setMenuProperty does nothing when there is no first menu', () => {
        (component as any).menuRefQL = {};
        (component as any).menuRef = undefined;
        (component as any).setMenuProperty();
        expect((component as any).menuRef).toBeUndefined();
    });

    it('setMenuProperty does nothing when first is truthy on check but falsy on read', () => {
        let reads = 0;
        (component as any).menuRefQL = { get first() { return ++reads === 1 ? { x: 1 } : null; } };
        (component as any).menuRef = undefined;
        (component as any).setMenuProperty();
        expect((component as any).menuRef).toBeUndefined();
    });
});
