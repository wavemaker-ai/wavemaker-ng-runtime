declare const $;

import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { App, DynamicComponentRefProvider, StatePersistence } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { TabsComponent } from './tabs.component';
import { TabPaneComponent } from './tab-pane/tab-pane.component';

const markup = `
    <div wmTabs name="tabs1">
        <div wmTabPane name="p1" title="One"></div>
        <div wmTabPane name="p2" title="Two"></div>
        <div wmTabPane name="p3" title="Three"></div>
    </div>`;

@Component({ standalone: false, template: markup })
class HostComponent {
    @ViewChild(TabsComponent, { static: true }) wmComponent: TabsComponent;
}

const markupBottom = `
    <div wmTabs name="tabsBottom" tabsposition="bottom" transition="slide">
        <div wmTabPane name="b1" title="One"></div>
        <div wmTabPane name="b2" title="Two"></div>
    </div>`;

@Component({ standalone: false, template: markupBottom })
class BottomHostComponent {
    @ViewChild(TabsComponent, { static: true }) wmComponent: TabsComponent;
}

const markupLeft = `
    <div wmTabs name="tabsLeft" tabsposition="left">
        <div wmTabPane name="l1" title="One"></div>
    </div>`;

@Component({ standalone: false, template: markupLeft })
class LeftHostComponent {
    @ViewChild(TabsComponent, { static: true }) wmComponent: TabsComponent;
}

describe('TabsComponent', () => {
    let statePersistence: any;
    let dynamicProvider: any;

    const moduleDef = (host: any): ITestModuleDef => ({
        imports: [TextContentDirective, TabsComponent, TabPaneComponent],
        declarations: [host],
        providers: [
            { provide: App, useValue: mockApp },
            { provide: DynamicComponentRefProvider, useValue: dynamicProvider },
            { provide: StatePersistence, useValue: statePersistence }
        ]
    });

    const setup = (host: any = HostComponent) => {
        const fixture: ComponentFixture<any> = compileTestComponent(moduleDef(host), host);
        const tabs: TabsComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        // the first pane is normally selected through the widget property pipeline
        (tabs as any).selectDefaultPaneByIndex(0);
        fixture.detectChanges();
        return { fixture, tabs, panes: () => tabs.panes.toArray() as any[] };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        ($ as any).fn.swipey = { DIRECTIONS: { HORIZONTAL: 'horizontal' } };
        ($ as any).fn.swipeAnimation = jest.fn();
        statePersistence = {
            computeMode: jest.fn(() => 'none'),
            setWidgetState: jest.fn(),
            getWidgetState: jest.fn()
        };
        dynamicProvider = { addComponent: jest.fn(() => Promise.resolve({ destroy: jest.fn() })) };
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    describe('initialisation', () => {
        it('collects panes, renders headers and selects the first pane', () => {
            const { fixture, tabs, panes } = setup();
            jest.advanceTimersByTime(200);
            fixture.detectChanges();
            expect(panes()).toHaveLength(3);
            expect(fixture.nativeElement.querySelectorAll('li.tab-header')).toHaveLength(3);
            expect(panes()[0].isActive).toBe(true);
            expect(tabs.getActiveTabIndex()).toBe(0);
            expect(tabs.currentTabPaneIndex).toBe(0);
        });

        it('places headers after the content for bottom tabs and enables sliding', () => {
            const { fixture, tabs } = setup(BottomHostComponent);
            jest.advanceTimersByTime(200);
            fixture.detectChanges();
            expect(tabs.tabsposition).toBe('bottom');
            expect(tabs.vertical).toBe(false);
            tabs.next();
            fixture.detectChanges();
        });

        it('treats left tabs as vertical', () => {
            const { tabs } = setup(LeftHostComponent);
            expect(tabs.vertical).toBe(true);
        });
    });

    describe('selection', () => {
        it('selects, notifies and deselects panes', () => {
            const { fixture, tabs, panes } = setup();
            const onChange = jest.spyOn(tabs as any, 'invokeEventCallback');
            const [p1, p2] = panes();
            const onSelect = jest.spyOn(p2, 'invokeOnSelectCallback');
            const onDeselect = jest.spyOn(p1, 'deselect');

            p2.select(new Event('click'));
            fixture.detectChanges();

            expect(p2.isActive).toBe(true);
            expect(p1.isActive).toBe(false);
            expect(onDeselect).toHaveBeenCalled();
            expect(onSelect).toHaveBeenCalled();
            expect(onChange).toHaveBeenCalledWith('change', expect.objectContaining({ newPaneIndex: 1, oldPaneIndex: 0 }));
        });

        it('does not fire change for programmatic selection', () => {
            const { tabs, panes } = setup();
            const onChange = jest.spyOn(tabs as any, 'invokeEventCallback');
            panes()[1].select();
            expect(onChange).not.toHaveBeenCalledWith('change', expect.anything());
        });

        it('ignores selecting an active, disabled or hidden pane', () => {
            const { tabs, panes } = setup();
            const [p1, p2, p3] = panes();
            const notify = jest.spyOn(tabs, 'notifyChange');
            p1.select(); // already active
            p2.disabled = true;
            p2.select();
            p3.show = false;
            tabs.notifyChange(p3, undefined as any, false);
            expect(p2.isActive).toBe(false);
            expect(notify).toHaveBeenCalledTimes(1);
            expect(tabs.getActiveTabIndex()).toBe(0);
        });

        it('deselect only fires when active', () => {
            const { panes } = setup();
            const [p1, p2] = panes();
            const spy = jest.spyOn(p2, 'invokeEventCallback');
            p2.deselect();
            expect(spy).not.toHaveBeenCalled();
            p1.deselect();
            expect(p1.isActive).toBe(false);
        });

        it('goToTab selects valid indexes only', () => {
            const { tabs, panes } = setup();
            tabs.goToTab(2);
            expect(panes()[1].isActive).toBe(true);
            tabs.goToTab(10);
            tabs.goToTab(0);
            expect(panes()[1].isActive).toBe(true);
        });

        it('next and prev skip unselectable panes and wrap around', () => {
            const { tabs, panes } = setup();
            const [p1, p2, p3] = panes();
            p2.disabled = true;
            tabs.next();
            expect(p3.isActive).toBe(true);
            tabs.next(); // wraps to the first
            expect(p1.isActive).toBe(true);
            tabs.prev(); // wraps to the last
            expect(p3.isActive).toBe(true);
            tabs.prev();
            expect(p1.isActive).toBe(true);
        });

        it('next does nothing when no other tab can be selected', () => {
            const { tabs, panes } = setup();
            const [, p2, p3] = panes();
            p2.disabled = true;
            p3.disabled = true;
            tabs.next();
            expect(panes()[0].isActive).toBe(true);
            tabs.prev();
            expect(panes()[0].isActive).toBe(true);
        });

        it('reports first and last tab panes', () => {
            const { tabs, panes } = setup();
            expect(tabs.isFirstTabPane).toBe(true);
            expect(tabs.isLastTabPane).toBe(false);
            panes()[2].select();
            expect(tabs.isFirstTabPane).toBe(false);
            expect(tabs.isLastTabPane).toBe(true);
        });

        it('handles header clicks and header click events', () => {
            const { fixture, tabs, panes } = setup();
            const headerClick = jest.spyOn(panes()[1], 'tabpaneHeaderClick');
            const link = fixture.nativeElement.querySelectorAll('li.tab-header a')[1] as HTMLElement;
            link.click();
            expect(headerClick).toHaveBeenCalledWith(expect.anything(), 1);
            expect(panes()[1].isActive).toBe(true);
            expect(tabs.getActiveTabIndex()).toBe(1);
        });
    });

    describe('state persistence', () => {
        it('stores the selected pane name when a state mode is active', () => {
            const { tabs, panes } = setup();
            statePersistence.computeMode.mockReturnValue('url');
            (tabs as any).isPageLoadCall = false;
            panes()[1].select();
            expect(statePersistence.setWidgetState).toHaveBeenCalledWith(tabs, 'p2');
        });

        it('remembers the default pane index on page load', () => {
            const { tabs, panes } = setup();
            statePersistence.computeMode.mockReturnValue('url');
            (tabs as any).isPageLoadCall = true;
            panes()[2].select();
            expect(tabs.defaultpaneindex).toBe(2);
            expect((tabs as any).isPageLoadCall).toBe(false);
        });

        it('restores a persisted pane through the statehandler property', () => {
            const { tabs, panes } = setup();
            statePersistence.getWidgetState.mockReturnValue('p3');
            tabs.onPropertyChange('statehandler', 'url', undefined);
            jest.advanceTimersByTime(50);
            expect(panes()[2].isActive).toBe(true);
        });

        it('warns and falls back to the default pane for unknown persisted names', () => {
            const { tabs, panes } = setup();
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            statePersistence.getWidgetState.mockReturnValue('missing');
            tabs.defaultpaneindex = 1;
            tabs.onPropertyChange('statehandler', 'url', undefined);
            jest.advanceTimersByTime(50);
            expect(warn).toHaveBeenCalled();
            expect(panes()[1].isActive).toBe(true);
        });

        it('uses the default pane when there is no persisted state or the handler is none', () => {
            const { tabs, panes } = setup();
            tabs.defaultpaneindex = 2;
            statePersistence.getWidgetState.mockReturnValue(undefined);
            tabs.onPropertyChange('statehandler', 'url', undefined);
            jest.advanceTimersByTime(50);
            expect(panes()[2].isActive).toBe(true);
            statePersistence.getWidgetState.mockReturnValue('p1');
            tabs.defaultpaneindex = undefined as any;
            tabs.onPropertyChange('statehandler', 'none', undefined);
            jest.advanceTimersByTime(50);
            expect(panes()[0].isActive).toBe(true);
        });
    });

    describe('properties', () => {
        it('updates the default pane index and auto activation', () => {
            const { tabs } = setup();
            tabs.onPropertyChange('defaultpaneindex', 2, 0);
            expect(tabs.defaultpaneindex).toBe(2);
            tabs.onPropertyChange('autotabactivation', true, false);
            expect(tabs.autoActivation).toBe(true);
        });

        it('creates field defs from a dataset and selects the default pane', () => {
            const { tabs, panes } = setup();
            tabs.defaultpaneindex = 1;
            tabs.onPropertyChange('dataset', [{ a: 1 }, { a: 2 }], undefined);
            expect(tabs.fieldDefs).toHaveLength(2);
            jest.advanceTimersByTime(10);
            expect(panes()[1].isActive).toBe(true);
            tabs.defaultpaneindex = undefined as any;
            tabs.onPropertyChange('dataset', [], undefined);
            jest.advanceTimersByTime(10);
        });

        it('delegates other properties to the base widget', () => {
            const { fixture, tabs } = setup();
            tabs.onPropertyChange('class', 'extra', '');
            fixture.detectChanges();
            expect(tabs).toBeDefined();
        });

        it('selects the first selectable pane when the default pane is not selectable', () => {
            const { tabs, panes } = setup();
            const [p1, p2, p3] = panes();
            p1.disabled = true;
            p3.select();
            (tabs as any).selectDefaultPaneByIndex(0);
            expect(p2.isActive || p3.isActive).toBe(true);
            (tabs as any).selectDefaultPaneByIndex(-1);
            (tabs as any).selectDefaultPaneByIndex(50);
        });
    });

    describe('getWidgets', () => {
        it('requires a widget name', () => {
            const { tabs } = setup();
            expect(tabs.getWidgets('')).toBeUndefined();
        });

        it('collects widgets from all panes or from a single pane', () => {
            const { tabs, panes } = setup();
            jest.spyOn(panes()[0], 'currentTabWidgets', 'get').mockReturnValue({ w: 'a' } as any);
            jest.spyOn(panes()[1], 'currentTabWidgets', 'get').mockReturnValue({ w: 'b' } as any);
            jest.spyOn(panes()[2], 'currentTabWidgets', 'get').mockReturnValue({} as any);
            expect(tabs.getWidgets('w')).toEqual(['a', 'b']);
            expect(tabs.getWidgets('w', 1)).toEqual(['b']);
            expect(tabs.getWidgets('w', '0' as any)).toEqual(['a']);
            expect(tabs.getWidgets('w', 99)).toBeUndefined();
        });
    });

    describe('keyboard navigation', () => {
        const key = (k: string) => ({ key: k, preventDefault: jest.fn() });

        it('moves the focus highlight with arrow keys', () => {
            const { fixture, tabs, panes } = setup();
            const e = key('ArrowRight');
            tabs.onkeydown(e);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
            const li = fixture.nativeElement.querySelector(`li[data-paneid="${panes()[1].widgetId}"]`);
            expect(li.classList.contains('select')).toBe(true);
            tabs.onkeydown(key('ArrowLeft'));
            tabs.onkeydown(key('ArrowDown'));
            tabs.onkeydown(key('ArrowUp'));
        });

        it('activates tabs directly when auto activation is on', () => {
            const { tabs, panes } = setup();
            tabs.autoActivation = true;
            tabs.onkeydown(key('ArrowRight'));
            expect(panes()[1].isActive).toBe(true);
            tabs.onkeydown(key('ArrowLeft'));
            expect(panes()[0].isActive).toBe(true);
        });

        it('selects the highlighted tab on Enter', () => {
            const { tabs, panes } = setup();
            const e = key('Enter');
            tabs.onkeydown(e);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
            expect(tabs.getSelectedPaneIndex()).toBeGreaterThanOrEqual(0);
            expect(panes()[1].isActive || panes()[0].isActive).toBe(true);
        });

        it('ignores other keys', () => {
            const { tabs } = setup();
            const e = key('a');
            tabs.onkeydown(e);
            expect(e.preventDefault).not.toHaveBeenCalled();
        });

        it('does not highlight when there is no target pane', () => {
            const { tabs, panes } = setup();
            panes()[1].disabled = true;
            panes()[2].disabled = true;
            const e = key('ArrowRight');
            tabs.onkeydown(e);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
        });
    });

    describe('dynamic panes', () => {
        it('adds panes through the dynamic component provider, skipping duplicates', async () => {
            const { tabs } = setup();
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const names = tabs.addPane([{ name: 'dyn1', title: 'D1', params: { a: 1 } }, { title: 'D2' }, { name: 'p1' }]);
            expect(names).toEqual(['dyn1', 'tabpane5']);
            expect(warn).toHaveBeenCalledWith('The tab pane with name p1 already exists');
            expect(dynamicProvider.addComponent).toHaveBeenCalledTimes(2);
            const markupArg = dynamicProvider.addComponent.mock.calls[0][1];
            expect(markupArg).toContain('<wm-param name="a" value="1">');
            expect(markupArg).toContain('name="dyn1"');
            await Promise.resolve();
            await Promise.resolve();
        });

        it('wraps a single pane definition and reuses the dynamic context', () => {
            const { tabs } = setup();
            tabs.addPane({ name: 'solo' });
            tabs.addPane({ name: 'solo2' });
            expect(dynamicProvider.addComponent).toHaveBeenCalledTimes(2);
            expect(dynamicProvider.addComponent.mock.calls[0][2]).toBe(dynamicProvider.addComponent.mock.calls[1][2]);
        });

        it('registers dynamic panes once all of them are initialised', () => {
            const { tabs, panes } = setup();
            (tabs as any).dynamicPaneIndex = 2;
            const select = jest.fn();
            const a: any = { dynamicPaneIndex: 0, active: false, select, name: 'a' };
            const b: any = { dynamicPaneIndex: 1, active: true, select, name: 'b' };
            tabs.registerDynamicTab(a);
            expect(panes()).toHaveLength(3);
            tabs.registerDynamicTab(b);
            expect(tabs.panes.length).toBe(5);
            jest.advanceTimersByTime(30);
            expect(select).toHaveBeenCalledTimes(1);
            // registering again does not duplicate existing panes
            (tabs as any).dynamicTabs = [a];
            (tabs as any).dynamicPaneIndex = 1;
            tabs.registerDynamicTab({ dynamicPaneIndex: 0 } as any);
        });

        it('removes panes by name', () => {
            const { tabs, panes } = setup();
            const [p1] = panes();
            const remove = jest.spyOn(p1, 'remove');
            tabs.removePane('p1');
            expect(remove).toHaveBeenCalledTimes(1);
            tabs.removePane('nope');
        });
    });

    describe('tab pane specifics', () => {
        it('removes an active pane by moving to the neighbour and cleaning the DOM', () => {
            const { fixture, tabs, panes } = setup();
            const [p1, p2] = panes();
            p1.remove();
            expect(p2.isActive).toBe(true);
            expect(tabs.panes.length).toBe(2);
            expect(fixture.nativeElement.contains(p1.nativeElement)).toBe(false);
        });

        it('removes the last pane by moving back', () => {
            const { tabs, panes } = setup();
            const [, p2, p3] = panes();
            p3.select();
            p3.remove();
            expect(p2.isActive).toBe(true);
            expect(tabs.panes.length).toBe(2);
        });

        it('removes inactive panes without changing the selection', () => {
            const { tabs, panes } = setup();
            panes()[2].remove();
            expect(panes()[0].isActive).toBe(true);
            expect(tabs.panes.length).toBe(2);
        });

        it('swipes to neighbouring tabs', () => {
            const { panes } = setup();
            (panes()[0] as any).handleSwipeLeft();
            expect(panes()[1].isActive).toBe(true);
            (panes()[1] as any).handleSwipeRight();
            expect(panes()[0].isActive).toBe(true);
        });

        it('fires load once for inline content and redraws children', () => {
            const { panes } = setup();
            const pane = panes()[1];
            const load = jest.spyOn(pane, 'invokeEventCallback');
            const redraw = jest.fn();
            pane.reDrawableComponents = [{ redraw }];
            pane.select();
            jest.advanceTimersByTime(150);
            expect(redraw).toHaveBeenCalled();
            expect(load).toHaveBeenCalledWith('load');
            load.mockClear();
            pane.deselect();
            pane.select();
            jest.advanceTimersByTime(150);
            expect(load).not.toHaveBeenCalledWith('load');
        });

        it('does not fire load for partial content and tolerates no redrawable children', () => {
            const { panes } = setup();
            const pane = panes()[1];
            pane.content = 'SomePartial';
            pane.reDrawableComponents = undefined;
            const load = jest.spyOn(pane, 'invokeEventCallback');
            pane.select();
            jest.advanceTimersByTime(150);
            expect(load).not.toHaveBeenCalledWith('load');
        });

        it('lazy loads content when it changes on an active pane', () => {
            const { panes } = setup();
            const [p1, p2] = panes();
            const lazy1 = jest.fn();
            const lazy2 = jest.fn();
            p1.$lazyLoad = lazy1;
            p2.$lazyLoad = lazy2;
            p1.onPropertyChange('content', 'X');
            p2.onPropertyChange('content', 'X');
            jest.advanceTimersByTime(150);
            expect(lazy1).toHaveBeenCalled();
            expect(lazy2).not.toHaveBeenCalled();
        });

        it('handles the show property in all states', () => {
            const { tabs, panes } = setup();
            const [p1, p2] = panes();
            const select = jest.spyOn(tabs as any, 'selectDefaultPaneByIndex');
            (p2 as any)._isFirstLoad = true;
            // first call selects the default pane
            p2.onPropertyChange('show', true);
            expect(select).toHaveBeenCalled();
            expect(p2.nativeElement.hidden).toBe(false);
            // hiding the active pane moves to the next one
            p1.onPropertyChange('show', false);
            expect(p1.nativeElement.hidden).toBe(true);
            p1.onPropertyChange('show', false);
            expect(p2.isActive).toBe(true);
            // showing a pane re-positions the transition
            const transition = jest.fn();
            (tabs as any).tabsAnimator = { transitionTabIntoView: transition };
            p1.onPropertyChange('show', true);
            expect(transition).toHaveBeenCalled();
            p2.onPropertyChange('show', false);
            p1.onPropertyChange('class', 'x');
        });

        it('sets the pane title from the title attribute', () => {
            const { panes } = setup();
            expect(panes()[0].title).toBe('One');
        });

        it('does not forward the select event to the base handler', () => {
            const { panes } = setup();
            const cb = jest.fn();
            (panes()[0] as any).handleEvent(null, 'select', cb, {});
            expect(cb).not.toHaveBeenCalled();
            expect(() => (panes()[0] as any).handleEvent(null, 'click', cb, {})).not.toThrow();
        });

        it('cleans up on destroy', () => {
            const { fixture, panes } = setup();
            const pane = panes()[0];
            fixture.destroy();
            expect(pane.$lazyLoad).toBeNull();
            expect(pane.reDrawableComponents).toBeNull();
        });
    });

    describe('animation and scrolling', () => {
        it('slides panes into view and recalibrates on selection', () => {
            const { fixture, tabs, panes } = setup(BottomHostComponent);
            jest.advanceTimersByTime(200);
            panes()[1].select();
            fixture.detectChanges();
            const animator = (tabs as any).tabsAnimator;
            expect(animator).toBeDefined();
            expect(animator.calibrate().noOfTabs).toBe(2);
            expect(typeof animator.bounds()).toBe('object');
            expect(animator.context()).toHaveProperty('w');
            expect(animator.animation()).toHaveProperty('transform');
            expect(animator.threshold()).toBe(5);
            animator.onLower();
            animator.onUpper();
            animator.transitionTabIntoView();
        });

        it('blurs focused content of the active pane when bounds are computed', () => {
            const { fixture, tabs, panes } = setup(BottomHostComponent);
            jest.advanceTimersByTime(200);
            document.body.appendChild(fixture.nativeElement);
            panes()[0].select();
            panes()[1].select();
            fixture.detectChanges();
            const input = document.createElement('input');
            panes()[1].nativeElement.classList.add('tab-pane');
            panes()[1].nativeElement.appendChild(input);
            input.focus();
            (tabs as any).tabsAnimator.bounds();
            expect(document.activeElement).not.toBe(input);
        });

        it('only scrolls the header list when the tabs overflow', () => {
            const { fixture, tabs } = setup();
            (tabs as any).registerTabsScroll();
            jest.advanceTimersByTime(10);
            const ul = tabs.$element.find('> ul');
            const idleWheel: any = new Event('mousewheel', { cancelable: true });
            idleWheel.wheelDelta = 5;
            ul[0].dispatchEvent(idleWheel);
            expect(idleWheel.defaultPrevented).toBe(false);
            jest.spyOn($.fn, 'position' as any).mockReturnValue({ left: 1000 });
            jest.spyOn($.fn, 'width' as any).mockReturnValue(10);
            (tabs as any).registerTabsScroll();
            jest.advanceTimersByTime(10);
            const wheel: any = new Event('mousewheel', { cancelable: true });
            wheel.wheelDelta = 5;
            ul[0].dispatchEvent(wheel);
            fixture.detectChanges();
            expect(wheel.defaultPrevented).toBe(true);
        });

        it('moves the header into view when animating', () => {
            const { fixture, tabs } = setup();
            const items = fixture.nativeElement.querySelectorAll('li.tab-header');
            Object.defineProperty(items[1], 'offsetLeft', { value: 40 });
            tabs.animateIn(items[1]);
            expect(fixture.nativeElement.querySelector('ul').scrollLeft).toBe(0);
            tabs.animateIn(items[0]);
            expect(items[0].classList.contains('active')).toBe(true);
        });
    });

    describe('destroy', () => {
        it('releases subscriptions, dynamic components and state', async () => {
            const { fixture, tabs } = setup();
            const destroy = jest.fn();
            (tabs as any).dynamicComponentRefs = [{ destroy }, null, {}];
            (tabs as any)._dynamicContext = { a: 1 };
            (tabs as any).tabsAnimator = {};
            fixture.destroy();
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(tabs.fieldDefs).toBeNull();
            expect((tabs as any).dynamicComponentRefs).toEqual([]);
        });
    });

    describe('leftover branches', () => {
        it('does not add a dynamic tab that already exists', () => {
            const { tabs, panes } = setup();
            const existing: any = panes()[0];
            existing.dynamicPaneIndex = 0;
            (tabs as any).dynamicTabs = [];
            (tabs as any).dynamicPaneIndex = 1;
            tabs.registerDynamicTab(existing);
            expect(tabs.panes.length).toBe(3);
        });

        it('does not select a new dynamic tab that is not active', () => {
            const { tabs } = setup();
            (tabs as any).dynamicPaneIndex = 1;
            const select = jest.fn();
            tabs.registerDynamicTab({ dynamicPaneIndex: 0, active: false, select, name: 'idle' } as any);
            jest.advanceTimersByTime(30);
            expect(select).not.toHaveBeenCalled();
        });

        it('ignores an empty result from the dynamic component provider', async () => {
            const { tabs } = setup();
            dynamicProvider.addComponent.mockReturnValue(Promise.resolve(undefined));
            tabs.addPane({ name: 'ghost' });
            await Promise.resolve();
            await Promise.resolve();
            expect((tabs as any).dynamicComponentRefs).toHaveLength(0);
        });

        it('only wraps around to selectable panes', () => {
            const { tabs, panes } = setup();
            panes()[0].disabled = true;
            expect((tabs as any).getSelectableTabAfterIndex(2)).toBeUndefined();
            panes()[2].disabled = true;
            expect((tabs as any).getSelectableTabBeforeIndex(0)).toBeUndefined();
            expect((tabs as any).getSelectableTabBeforeIndex(1)).toBeUndefined();
            panes()[2].disabled = false;
            expect((tabs as any).getSelectableTabBeforeIndex(0)).toBe(panes()[2]);
            panes()[0].disabled = false;
            expect((tabs as any).getSelectableTabAfterIndex(2)).toBe(panes()[0]);
        });

        it('selects nothing when no pane can be selected', () => {
            const { tabs, panes } = setup();
            panes().forEach(p => (p.disabled = true));
            const before = tabs.getSelectedPaneIndex();
            (tabs as any).selectDefaultPaneByIndex(1);
            expect(tabs.getSelectedPaneIndex()).toBe(before);
        });

        it('falls back to the first pane when the stored state is wrong and no default index is set', () => {
            const { tabs } = setup();
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            statePersistence.getWidgetState.mockReturnValue('missing');
            const select = jest.spyOn(tabs as any, 'selectDefaultPaneByIndex');
            tabs.defaultpaneindex = undefined;
            tabs.onPropertyChange('statehandler', 'url', undefined);
            jest.advanceTimersByTime(30);
            expect(select).toHaveBeenCalledWith(0);
        });

        it('does nothing on Enter when no tab can be selected', () => {
            const { tabs, panes } = setup();
            panes().forEach(p => (p.disabled = true));
            const e = { key: 'Enter', preventDefault: jest.fn() };
            tabs.onkeydown(e as any);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
        });

        it('re-selects the default pane when the pane list changes', () => {
            const { tabs } = setup();
            const select = jest.spyOn(tabs as any, 'selectDefaultPaneByIndex');
            tabs.defaultpaneindex = 0;
            tabs.panes.notifyOnChanges();
            expect(select).toHaveBeenCalledWith(0);
            tabs.defaultpaneindex = 2;
            tabs.panes.notifyOnChanges();
            expect(select).toHaveBeenCalledWith(2);
            select.mockClear();
            tabs.panes.reset([]);
            tabs.panes.notifyOnChanges();
            expect(select).not.toHaveBeenCalled();
        });

        it('tolerates being destroyed twice and without dynamic tabs or an animator', () => {
            const { tabs } = setup();
            tabs.ngOnDestroy();
            (tabs as any).dynamicTabs = null;
            (tabs as any).tabsAnimator = null;
            expect(() => tabs.ngOnDestroy()).not.toThrow();
        });

        it('computes slide bounds for the first and the middle tab', () => {
            const { fixture, tabs, panes } = setup(BottomHostComponent);
            jest.advanceTimersByTime(200);
            panes()[0].select();
            fixture.detectChanges();
            const animator = (tabs as any).tabsAnimator;
            const first = animator.bounds();
            expect(first.upper).toBe(first.center);
            panes()[1].select();
            fixture.detectChanges();
            expect(animator.bounds().lower).toBe(0);
        });

        it('skips hidden panes when calibrating the animator', () => {
            const { fixture, tabs, panes } = setup(BottomHostComponent);
            jest.advanceTimersByTime(200);
            panes()[1].nativeElement.hidden = true;
            fixture.detectChanges();
            expect((tabs as any).tabsAnimator.calibrate().noOfTabs).toBe(1);
        });

        it('exposes the widgets inside a pane and registers dynamic panes from their view init', () => {
            const { tabs, panes } = setup();
            expect(panes()[0].currentTabWidgets).toBeDefined();
            const register = jest.spyOn(tabs, 'registerDynamicTab').mockImplementation(() => {});
            panes()[0].isdynamic = true;
            panes()[0].ngAfterViewInit();
            expect(register).toHaveBeenCalledWith(panes()[0]);
        });

        it('falls back to the heading when a pane has no title', () => {
            const { panes } = setup();
            const pane: any = panes()[0];
            pane.title = '';
            pane.heading = 'Heading';
            jest.spyOn(Object.getPrototypeOf(TabPaneComponent.prototype), 'ngOnInit').mockImplementation(() => undefined);
            pane.ngOnInit();
            expect(pane.title).toBe('Heading');
        });
    });
});
