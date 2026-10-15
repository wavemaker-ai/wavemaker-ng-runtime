import { Component, Inject, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { SecurityService } from '@wm/security';
import { DatasetAwareNavComponent } from './dataset-aware-nav.component';
import { register } from '../../framework/widget-props';
import { Context } from '../../framework/types';
import { mockApp } from '../../../test/util/component-test-util';
import { getOrderedDataset } from '../../../utils/form-utils';

jest.mock('../../../utils/form-utils', () => {
    const actual = jest.requireActual('../../../utils/form-utils');
    return { ...actual, getOrderedDataset: jest.fn(actual.getOrderedDataset) };
});


register('wm-test-nav', new Map());

@Component({
    standalone: false,
    selector: 'app-test-nav',
    template: ''
})
class TestNavComponent extends DatasetAwareNavComponent {
    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') ctx: any) {
        super(inj, { widgetType: 'wm-test-nav', hostClass: '' }, ctx);
    }
    // expose internals for assertions
    callResetNodes() { this.resetNodes(); }
    get nodes$Ref() { return this.nodes$; }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('DatasetAwareNavComponent cover', () => {
    let cmp: any;
    let localeHandler: () => void;
    let cancelLocale: jest.Mock;
    let security: any;

    beforeEach(() => {
        cancelLocale = jest.fn();
        security = { loggedInUser: { userRoles: ['admin'] } };
        TestBed.configureTestingModule({
            declarations: [TestNavComponent],
            providers: [
                { provide: App, useValue: { ...mockApp, subscribe: jest.fn((evt, fn) => { localeHandler = fn; return cancelLocale; }) } },
                { provide: SecurityService, useValue: security },
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: 'EXPLICIT_CONTEXT', useValue: null }
            ]
        });
        cmp = TestBed.createComponent(TestNavComponent).componentInstance;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('node construction', () => {
        it('builds nodes from primitive datasets, with label and value equal to the primitive', () => {
            cmp.dataset = 'a,b';
            cmp.callResetNodes();
            expect(cmp.nodes.map(n => n.label)).toEqual(['a', 'b']);
            expect(cmp.nodes.map(n => n.value)).toEqual([{ label: 'a', value: 'a' }, { label: 'b', value: 'b' }]);
        });

        it('builds nodes from object datasets using default field names and handles nested children and links', () => {
            cmp.dataset = [
                { label: 'Home', link: '/home', icon: 'i-home', hint: 'h', badge: '3', action: 'go()', class: 'c', itemid: 'id1', target: 'www.site.com',
                  children: [{ label: 'Child', link: '#/child' }] },
                { label: 'Ext', link: 'http://x.com', target: '/' },
                { label: 'None' }
            ];
            cmp.callResetNodes();
            const [home, ext, none] = cmp.nodes;
            expect(home).toMatchObject({ label: 'Home', link: '#/home', icon: 'i-home', hint: 'h', badge: '3', action: 'go()', class: 'c', id: 'id1', target: '//www.site.com' });
            expect(home.children).toHaveLength(1);
            expect(home.children[0]).toMatchObject({ label: 'Child', link: '#/child' });
            expect(ext.link).toBe('http://x.com');
            expect(ext.target).toBe('#/');
            expect(none.link).toBeUndefined();
            expect(none.children).toEqual([]);
        });

        it('uses configured item field names', () => {
            cmp.itemlabel = 'name';
            cmp.itemicon = 'ic';
            cmp.itemchildren = 'kids';
            cmp.itemlink = 'url';
            cmp.dataset = [{ name: 'N', ic: 'x', url: '/u', kids: [{ name: 'K' }] }];
            cmp.callResetNodes();
            expect(cmp.nodes[0]).toMatchObject({ label: 'N', icon: 'x', link: '#/u' });
            expect(cmp.nodes[0].children[0].label).toBe('K');
        });

        it('resolves node value from datafield (specific field and All Fields) or the node itself', () => {
            const row = { label: 'L', code: 'C1' };
            cmp.dataset = [row];
            cmp.datafield = 'code';
            cmp.callResetNodes();
            expect(cmp.nodes[0].value).toBe('C1');
            cmp.datafield = 'All Fields';
            cmp.callResetNodes();
            expect(cmp.nodes[0].value).toEqual(row);
            cmp.datafield = undefined;
            cmp.callResetNodes();
            expect(cmp.nodes[0].value).toEqual(row);
        });

        it('filters nodes by the logged in user roles', () => {
            cmp.userrole = 'role';
            cmp.dataset = [
                { label: 'A', role: 'admin' },
                { label: 'B', role: 'guest' },
                { label: 'C' }
            ];
            cmp.callResetNodes();
            expect(cmp.nodes.map(n => n.label)).toEqual(['A', 'C']);
        });

        it('returns an empty list for an empty dataset', () => {
            cmp.dataset = [];
            cmp.callResetNodes();
            expect(cmp.nodes).toEqual([]);
        });

        it('returns an empty list when ordering yields nothing', () => {
            (getOrderedDataset as jest.Mock).mockReturnValueOnce(undefined);
            cmp.dataset = [{ label: 'a' }];
            cmp.callResetNodes();
            expect(cmp.nodes).toEqual([]);
        });

        it('treats a missing dataset as a single empty object', () => {
            cmp.dataset = undefined;
            cmp.callResetNodes();
            expect(cmp.nodes).toHaveLength(1);
            expect(cmp.nodes[0].children).toEqual([]);
        });

        it('orders nodes by the orderby property', () => {
            cmp.orderby = 'label:desc';
            cmp.dataset = [{ label: 'a' }, { label: 'c' }, { label: 'b' }];
            cmp.callResetNodes();
            expect(cmp.nodes.map(n => n.label)).toEqual(['c', 'b', 'a']);
        });

        it('caches the item field map until reset', () => {
            const first = cmp.getItemFieldsMap();
            expect(cmp.getItemFieldsMap()).toBe(first);
            cmp.itemlabel = 'custom';
            expect(cmp.getItemFieldsMap().labelField).toBe('label');
            cmp.resetItemFieldMap();
            expect(cmp.getItemFieldsMap().labelField).toBe('custom');
        });

        it('notifies nodes$ listeners on reset', () => {
            const next = jest.fn();
            cmp.nodes$Ref.subscribe(next);
            cmp.callResetNodes();
            expect(next).toHaveBeenCalledWith(null);
        });
    });

    describe('change handling', () => {
        it('debounces node resets for node-related property changes only', async () => {
            const spy = jest.spyOn(cmp, 'resetNodes');
            cmp.dataset = [{ label: 'x' }];
            for (const key of ['dataset', 'itemicon', 'itemlabel', 'itemhint', 'itemlink', 'itemtarget', 'itemclass', 'itemchildren', 'isactive', 'orderby']) {
                cmp.onPropertyChange(key, 'v', undefined);
            }
            await wait(100);
            expect(cmp.nodes).toHaveLength(1);
            spy.mockClear();
            cmp.onPropertyChange('unrelated', 'v', undefined);
            await wait(100);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resets nodes when the locale changes', async () => {
            cmp.dataset = [{ label: 'x' }];
            localeHandler();
            await wait(100);
            expect(cmp.nodes).toHaveLength(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('cancels the locale subscription, completes nodes$ and clears state', () => {
            const complete = jest.fn();
            cmp.nodes$Ref.subscribe({ complete });
            cmp.dataset = [{ label: 'x' }];
            cmp.callResetNodes();
            cmp.ngOnDestroy();
            expect(cancelLocale).toHaveBeenCalled();
            expect(complete).toHaveBeenCalled();
            expect(cmp.nodes).toEqual([]);
            expect(cmp.dataset).toBeNull();
            expect(cmp.nodes$).toBeNull();
            expect(cmp._resetNodes).toBeNull();
        });

        it('tolerates being destroyed when the helpers are already gone', () => {
            cmp.cancelLocaleChangeSubscription = undefined;
            cmp._resetNodes = null;
            cmp.nodes$ = null;
            expect(() => cmp.ngOnDestroy()).not.toThrow();
            expect(cancelLocale).not.toHaveBeenCalled();
        });

        it('skips cancel when the debounced function has no cancel method', () => {
            cmp._resetNodes = () => {};
            cmp.ngOnDestroy();
            expect(cmp._resetNodes).toBeTruthy();
        });
    });
});
