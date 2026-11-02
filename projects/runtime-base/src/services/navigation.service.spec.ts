import { NavigationEnd, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';

import { CONSTANTS } from '@wm/variables';
import { NavigationServiceImpl } from './navigation.service';

declare const $;

describe('NavigationServiceImpl', () => {
    let events: Subject<any>;
    let router: any, app: any, zone: any;
    let service: NavigationServiceImpl;
    let root: HTMLElement;

    const history = () => (service as any).history;
    const start = (url: string) => events.next(new NavigationStart(1, url));

    const addWidget = (parent: JQuery | HTMLElement, html: string, widget: any) => {
        const $el = $(html);
        $el[0].widget = widget;
        $(parent).append($el);
        return $el[0];
    };

    beforeEach(() => {
        events = new Subject();
        router = { events, navigate: jest.fn() };
        app = {
            activePage: { activePageName: 'Active' },
            isPrefabType: false,
            subscribe: jest.fn(),
            notifyApp: jest.fn()
        };
        zone = { run: jest.fn(fn => fn()) };
        service = new NavigationServiceImpl(app, router, zone);
        document.body.innerHTML = '<app-root></app-root>';
        root = document.querySelector('app-root');
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('router NavigationStart tracking', () => {
        it('ignores non-NavigationStart events', () => {
            events.next(new NavigationEnd(1, '/a', '/a'));
            expect(history().getCurrentPage()).toBeUndefined();
        });

        it('records page name and query params (dropping "name")', () => {
            start('/Main?x=1&name=n&y=2');
            const page = history().getCurrentPage();
            expect(page.name).toBe('Main');
            expect(page.urlParams).toEqual({ x: '1', y: '2' });
            expect(page.transition).toBeNull();
        });

        it('handles urls without query or leading slash', () => {
            start('Plain');
            expect(history().getCurrentPage().name).toBe('Plain');
        });

        it('ignores empty page names', () => {
            start('/');
            expect(history().getCurrentPage()).toBeUndefined();
        });

        it('skips history push for navigations started by goToPage', () => {
            service.goToPage('A', { urlParams: { a: 1 } } as any);
            service.goToPage('B', { transition: 'slide' } as any);
            const before = history().getPagesCount();
            start('/B');
            expect(history().getPagesCount()).toBe(before);
        });
    });

    describe('getPageTransition', () => {
        it('returns null for empty or "none"', () => {
            expect(service.getPageTransition()).toBeNull();
            service.goToPage('A', { transition: 'none' } as any);
            expect(service.getPageTransition()).toBeNull();
        });

        it('returns the transition otherwise', () => {
            service.goToPage('A', { transition: 'slide' } as any);
            expect(service.getPageTransition()).toBe('slide');
        });
    });

    describe('goToPage', () => {
        it('navigates inside the zone with query params', () => {
            service.goToPage('Home', { urlParams: { a: 1 } } as any);
            expect(zone.run).toHaveBeenCalledTimes(1);
            expect(router.navigate).toHaveBeenCalledWith(['/Home'], { queryParams: { a: 1 } });
            expect(history().getCurrentPage().name).toBe('Home');
        });
    });

    describe('goToPrevious', () => {
        it('does nothing when there is no previous page', () => {
            const back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
            service.goToPrevious();
            expect(back).not.toHaveBeenCalled();
            back.mockRestore();
        });

        it('goes back with an -exit transition', () => {
            const back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
            service.goToPage('A', {} as any);
            service.goToPage('B', { transition: 'slide' } as any);
            service.goToPrevious();
            expect(service.getPageTransition()).toBe('slide-exit');
            expect(back).toHaveBeenCalledTimes(1);
            expect(history().getCurrentPage().name).toBe('A');
            back.mockRestore();
        });

        it('goes back without a transition suffix when there is none', () => {
            const back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
            service.goToPage('A', {} as any);
            service.goToPage('B', {} as any);
            service.goToPrevious();
            expect(service.getPageTransition()).toBeNull();
            back.mockRestore();
        });
    });

    describe('goToView', () => {
        it('prefab app: navigates to the view in the app root', () => {
            app.isPrefabType = true;
            const w = { widgetType: 'wm-panel', expanded: false };
            addWidget(root, '<div name="v1"></div>', w);
            service.goToView('v1', { pageName: 'X' }, null);
            expect(w.expanded).toBe(true);
        });

        it('other page + partial on page: finds the view in the partial container', () => {
            const w = { widgetType: 'wm-panel', expanded: false };
            const partial = $('<div partialcontainer content="Part"></div>');
            $(root).append(partial);
            addWidget(partial, '<div name="v1"></div>', w);
            service.goToView('v1', { pageName: 'Part' }, null);
            expect(w.expanded).toBe(true);
            expect(router.navigate).not.toHaveBeenCalled();
        });

        it('other page: navigates, then scrolls to the view on pageReady and unsubscribes', () => {
            const unsub = jest.fn();
            let cb: Function;
            app.subscribe.mockImplementation((name, fn) => { cb = fn; return unsub; });
            const w = { widgetType: 'wm-panel', expanded: false };
            addWidget(root, '<div name="v1"></div>', w);

            service.goToView('v1', { pageName: 'Other', transition: 'fade', urlParams: { p: 1 } }, null);
            expect(router.navigate).toHaveBeenCalledWith(['/Other'], { queryParams: { p: 1 } });
            expect(app.subscribe).toHaveBeenCalledWith('pageReady', expect.any(Function));

            // subscribe returns before callback fires in real life; emulate the later emission
            cb({});
            expect(w.expanded).toBe(true);
            expect(unsub).toHaveBeenCalledTimes(1);
        });

        it('handles missing options', () => {
            app.subscribe.mockReturnValue(jest.fn());
            service.goToView('v1', undefined, null);
            expect(router.navigate).toHaveBeenCalledWith(['/undefined'], { queryParams: undefined });
        });

        it('prefab context: navigates within the prefab', () => {
            const w = { widgetType: 'wm-panel', expanded: false };
            const prefab = $('<div prefabName="pf"></div>');
            $(root).append(prefab);
            addWidget(prefab, '<div name="v1"></div>', w);
            service.goToView('v1', { pageName: 'Active' }, { _context: { prefabName: 'pf' } });
            expect(w.expanded).toBe(true);
        });

        it('prefab context inside a different page name is handled by the prefab branch', () => {
            const w = { widgetType: 'wm-panel', expanded: false };
            const prefab = $('<div prefabName="pf"></div>');
            $(root).append(prefab);
            addWidget(prefab, '<div name="v1"></div>', w);
            service.goToView('v1', { pageName: 'Elsewhere' }, { _context: { prefabName: 'pf' } });
            expect(w.expanded).toBe(true);
        });

        it('same page (or no page name): navigates in the active page', () => {
            const w = { widgetType: 'wm-panel', expanded: false };
            addWidget(root, '<div name="v1"></div>', w);
            service.goToView('v1', { pageName: 'Active' }, null);
            expect(w.expanded).toBe(true);
        });

        it('notifies when the prefab does not exist', () => {
            service.goToView('v1', { pageName: 'Elsewhere' }, { _context: { prefabName: 'ghost' } });
            expect(app.notifyApp).toHaveBeenCalledWith(CONSTANTS.WIDGET_DOESNT_EXIST, 'error');
        });
    });

    describe('goToElementView widget handling (via goToView)', () => {
        const go = () => service.goToView('v1', { pageName: 'Active' }, null);

        it('accordion pane: shows ancestors then expands', () => {
            const calls: string[] = [];
            const ancestorTab = { widgetType: 'wm-tabpane', select: () => calls.push('tab') };
            const ancestorAcc = { widgetType: 'wm-accordionpane', expand: () => calls.push('acc-anc') };
            const ancestorSeg = { widgetType: 'wm-segment-content', navigate: () => calls.push('seg-anc') };
            const ancestorPanel: any = { widgetType: 'wm-panel', expanded: false };
            const ancestorOther = { widgetType: 'wm-other' };

            const outerEl = addWidget(root, '<div wm-navigable-element="true"></div>', ancestorAcc);
            const tabEl = addWidget(outerEl, '<div wm-navigable-element="true"></div>', ancestorTab);
            const segEl = addWidget(tabEl, '<div wm-navigable-element="true"></div>', ancestorSeg);
            const panelEl = addWidget(segEl, '<div wm-navigable-element="true"></div>', ancestorPanel);
            const otherEl = addWidget(panelEl, '<div wm-navigable-element="true"></div>', ancestorOther);
            addWidget(otherEl, '<div name="v1"></div>', { widgetType: 'wm-accordionpane', expand: () => calls.push('acc') });

            go();
            expect(calls).toEqual(['acc-anc', 'tab', 'seg-anc', 'acc']);
            expect(ancestorPanel.expanded).toBe(true);
        });

        it('tab pane selects', () => {
            const select = jest.fn();
            addWidget(root, '<div name="v1"></div>', { widgetType: 'wm-tabpane', select });
            go();
            expect(select).toHaveBeenCalledTimes(1);
        });

        it('segment content navigates', () => {
            const navigate = jest.fn();
            addWidget(root, '<div name="v1"></div>', { widgetType: 'wm-segment-content', navigate });
            go();
            expect(navigate).toHaveBeenCalledTimes(1);
        });

        it('unknown widget types are ignored', () => {
            addWidget(root, '<div name="v1"></div>', { widgetType: 'wm-label' });
            expect(() => go()).not.toThrow();
        });

        it('ignores duplicates that live inside partials/prefab containers', () => {
            const inPartial = $('<div data-role="partial"></div>');
            const inPrefab = $('<div wmprefabcontainer></div>');
            $(root).append(inPartial).append(inPrefab);
            const pw = { widgetType: 'wm-panel', expanded: false };
            const rw = { widgetType: 'wm-panel', expanded: false };
            addWidget(inPartial, '<div name="v1"></div>', pw);
            addWidget(inPrefab, '<div name="v1"></div>', { widgetType: 'wm-panel', expanded: false });
            addWidget(root, '<div name="v1"></div>', rw);
            go();
            expect(rw.expanded).toBe(true);
            expect(pw.expanded).toBe(false);
        });

        it('does nothing when the element is missing and no dialog holds it', () => {
            jest.useFakeTimers();
            go();
            jest.advanceTimersByTime(1);
            expect(app.notifyApp).not.toHaveBeenCalled();
        });

        it('opens the ancestor dialog and then navigates to the view', () => {
            jest.useFakeTimers();
            // <template> content is not part of the DOM tree, but html() still serialises it,
            // mirroring a dialog whose content is not rendered yet
            $(root).append('<template dialogtype="x" name="other"><div name="nope"></div></template>');
            $(root).append('<template dialogtype="x" name="dlg"><div><div name="v1"></div></div></template>');

            go();

            // once the dialog renders, the view exists in the DOM
            const w = { widgetType: 'wm-panel', expanded: false };
            addWidget(root, '<div name="v1"></div>', w);
            jest.advanceTimersByTime(1);
            expect(w.expanded).toBe(true);
        });
    });
});
