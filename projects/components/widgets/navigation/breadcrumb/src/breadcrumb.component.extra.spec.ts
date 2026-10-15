import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BreadcrumbComponent } from './breadcrumb.component';
import { AbstractHttpService, App } from '@wm/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { By } from '@angular/platform-browser';
import { SecurityService } from '@wm/security';
import { ComponentTestBase, ITestComponentDef } from 'projects/components/base/src/test/common-widget.specs';

const markup = `<div wmBreadcrumb name="breadcrumb1" aria-label="breadcrumb"></div>`;

@Component({
    standalone: false,
    // Angular 22 changed the default changeDetection strategy for components with no
    // explicit setting (see .claude/skills/angular-upgrade/patterns/runtime.md §27a).
    // Pin it here to match the pre-22 default behavior these tests rely on.
    changeDetection: ChangeDetectionStrategy.Eager,
    template: markup
})
class BreadcrumbWrapperComponent {
    @ViewChild(BreadcrumbComponent, { static: true }) wmComponent: BreadcrumbComponent;
}

const testModuleDef = {
    imports: [FormsModule, BreadcrumbComponent],
    declarations: [BreadcrumbWrapperComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: Location, useValue: { path: jest.fn().mockReturnValue('/test-route') } },
        { provide: SecurityService, useClass: SecurityService },
        { provide: AbstractHttpService, useClass: AbstractHttpService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } }
    ]
};

describe('BreadcrumbComponent - additional behaviour', () => {
    let fixture: ComponentFixture<BreadcrumbWrapperComponent>;
    let cmp: any;
    let router: any;
    let location: any;

    const node = (id: string, children: any[] = []) => ({ id, label: id, children });

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, BreadcrumbWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        router = cmp.route;
        router.navigate.mockClear();
        location = cmp.location;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('path of the current route', () => {
        const tree = () => [node('Home', [node('Orders', [node('Detail')]), node('Users')]), node('About')];

        it('finds the chain of nodes leading to the key', () => {
            const info = { key: 'Detail', isPathFound: false };
            const path = cmp.getPath(info, tree());
            expect(path.map((n: any) => n.id)).toEqual(['Home', 'Orders', 'Detail']);
            expect(info.isPathFound).toBe(true);
        });

        it('drops branches that do not contain the key', () => {
            const path = cmp.getPath({ key: 'Users', isPathFound: false }, tree());
            expect(path.map((n: any) => n.id)).toEqual(['Home', 'Users']);
        });

        it('finds top level nodes and stops searching afterwards', () => {
            const path = cmp.getPath({ key: 'Home', isPathFound: false }, tree());
            expect(path.map((n: any) => n.id)).toEqual(['Home']);
        });

        it('returns an empty path for unknown routes', () => {
            expect(cmp.getPath({ key: 'Nope', isPathFound: false }, tree())).toEqual([]);
        });

        it('reads the current route without the slash and query string', () => {
            location.path.mockReturnValue('/Orders?x=1');
            expect(cmp.getCurrentRoute()).toBe('Orders');
        });

        it('limits the nodes to the active path when the widget has an item id', () => {
            location.path.mockReturnValue('/Orders');
            cmp.nodes = tree();
            jest.spyOn(Object.getPrototypeOf(BreadcrumbComponent.prototype), 'resetNodes').mockImplementation(() => undefined);
            cmp.itemid = 'id';
            cmp.resetNodes();
            expect(cmp.nodes.map((n: any) => n.id)).toEqual(['Home', 'Orders']);
        });

        it('keeps all nodes without an item id', () => {
            cmp.nodes = tree();
            jest.spyOn(Object.getPrototypeOf(BreadcrumbComponent.prototype), 'resetNodes').mockImplementation(() => undefined);
            cmp.itemid = undefined;
            cmp.binditemid = undefined;
            cmp.resetNodes();
            expect(cmp.nodes).toHaveLength(2);
        });
    });

    describe('item clicks', () => {
        const click = (item: any) => {
            const $event = { preventDefault: jest.fn() } as any;
            cmp.onItemClick($event, item);
            return $event;
        };

        it('navigates to internal links with their query params', () => {
            const $event = click({ link: '#/Orders?id=5', value: { id: 5 } });
            expect($event.preventDefault).toHaveBeenCalled();
            expect(router.navigate).toHaveBeenCalledWith(['/Orders'], { queryParams: { id: '5' } });
        });

        it('opens other links and targets in the browser', () => {
            const open = jest.spyOn(window, 'open').mockImplementation(() => null);
            click({ link: 'https://example.com', target: '_blank', value: {} });
            expect(router.navigate).not.toHaveBeenCalled();
            expect(open).toHaveBeenCalled();
            router.navigate.mockClear();
            click({ link: '#/Orders', target: '_blank', value: {} });
            expect(router.navigate).not.toHaveBeenCalled();
        });

        it('does nothing without a link or when beforenavigate cancels', () => {
            click({ value: {} });
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(false);
            click({ link: '#/Orders', value: {} });
            expect(router.navigate).not.toHaveBeenCalled();
        });

        it('passes the item value to beforenavigate', () => {
            const spy = jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            click({ link: '#/Orders', value: { id: 1 } });
            expect(spy).toHaveBeenCalledWith('beforenavigate', expect.objectContaining({ $item: { id: 1 } }));
        });
    });
});
