declare const $;

// @wm/core captures requestAnimationFrame at import time; route it through (fake) timers
window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as any;

import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';

jest.mock('@wm/components/page', () => ({
    PageDirective: class PageDirective {},
    LayoutDirective: class LayoutDirective {}
}));

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, isMobile: jest.fn((...a: any[]) => actual.isMobile(...a)) };
});

import * as wmCore from '@wm/core';
import { App } from '@wm/core';
import { LayoutDirective, PageDirective } from '@wm/components/page';
import { compileTestComponent } from '../../../../base/src/test/util/component-test-util';
import { LeftPanelDirective, AnimationType } from './left-panel.directive';
import { LeftPanelAnimator } from './left-panel.animator';

@Component({
    standalone: false,
    template: `<div wmLeftPanel name="lp" navtype="push" navheight="tall"></div>`
})
class HostComponent {
    @ViewChild(LeftPanelDirective, { static: true }) wmComponent: LeftPanelDirective;
}

@Component({
    standalone: false,
    template: `<div wmLeftPanel name="lpSpa" spa="true"></div>`
})
class SpaHostComponent {
    @ViewChild(LeftPanelDirective, { static: true }) wmComponent: LeftPanelDirective;
}

@Component({
    standalone: false,
    template: `<div wmLeftPanel name="lpWide" columnwidth="3"></div>`
})
class WideHostComponent {
    @ViewChild(LeftPanelDirective, { static: true }) wmComponent: LeftPanelDirective;
}

// class helpers in @wm/core apply changes asynchronously
const cls = (el: any, name: string) => {
    jest.advanceTimersByTime(10);
    return $(el).hasClass(name);
};

describe('LeftPanelDirective', () => {
    let app: any, page: any, layout: any, routerEvents: Subject<any>;

    const setup = (host: any = HostComponent) => {
        const fixture: ComponentFixture<any> = compileTestComponent({
            imports: [LeftPanelDirective],
            declarations: [host],
            providers: [
                { provide: App, useValue: app },
                { provide: PageDirective, useValue: page },
                { provide: LayoutDirective, useValue: layout },
                { provide: Router, useValue: { events: routerEvents } }
            ]
        }, host);
        const panel: LeftPanelDirective = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        return { fixture, panel };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        ($ as any).fn.swipeAnimation = jest.fn();
        ($ as any).fn.swipey = { DIRECTIONS: { HORIZONTAL: 'h' } };
        app = { isTabletApplicationType: false, notify: jest.fn(), subscribe: () => () => {}, notifyApp: jest.fn(), isPrism: true };
        page = { $element: $('<div class="page"></div>'), notify: jest.fn() };
        layout = { $element: $('<div class="layout"></div>'), notify: jest.fn() };
        routerEvents = new Subject();
        document.body.innerHTML = '<button class="app-header-action"></button>';
    });

    afterEach(() => {
        // let @wm/core's shared animation-frame queue drain so it does not leak into the next test
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
        document.body.innerHTML = '';
    });

    describe('construction', () => {
        it('marks the page container and applies the nav classes', () => {
            const { panel } = setup();
            expect(cls(page.$element, 'left-panel-collapsed-container')).toBe(true);
            expect(panel.$ele).toBeDefined();
            expect(panel.$page).toBe(page.$element);
            expect(page.$element[0].className).toContain('nav');
            expect(panel.$element[0].className).toContain('nav');
        });

        it('uses the layout container when the spa attribute is set', () => {
            const { panel } = setup(SpaHostComponent);
            expect(panel.$page).toBe(layout.$element);
            expect(cls(layout.$element, 'left-panel-collapsed-container')).toBe(true);
        });

        it('marks the panel for tablet apps', () => {
            app.isTabletApplicationType = true;
            const { panel } = setup();
            expect(cls(panel.nativeElement, 'wm-tablet-app-left-panel')).toBe(true);
        });

        it('collapses when the route changes', () => {
            const { panel } = setup();
            const collapse = jest.spyOn(panel, 'collapse');
            routerEvents.next({ type: 'other' });
            expect(collapse).not.toHaveBeenCalled();
            routerEvents.next(new NavigationStart(1, '/x'));
            expect(collapse).toHaveBeenCalled();
        });
    });

    describe('collapse / expand', () => {
        it('expands: updates classes, notifies and registers keyboard collapsing', () => {
            const { panel } = setup();
            panel.expand();
            expect(panel.expanded).toBe(true);
            expect(panel.isVisible()).toBe(true);
            expect(cls(panel.nativeElement, 'left-panel-expanded')).toBe(true);
            expect(cls(page.$element, 'left-panel-expanded-container')).toBe(true);
            expect(page.notify).toHaveBeenCalledWith('wmLeftPanel:expand');
            expect(document.querySelector('.app-header-action')!.getAttribute('aria-expanded')).toBe('true');
        });

        it('collapses again with Escape, restoring focus to the toggle button', () => {
            const { panel } = setup();
            panel.expand();
            panel.$element.trigger($.Event('keydown', { key: 'Escape' }));
            expect(panel.expanded).toBe(false);
            jest.advanceTimersByTime(100);
            expect(page.notify).toHaveBeenCalledWith('wmLeftPanel:collapse');
            expect(document.querySelector('.app-header-action')!.getAttribute('aria-expanded')).toBe('false');
        });

        it('ignores other keys inside the panel', () => {
            const { panel } = setup();
            panel.expand();
            panel.$element.trigger($.Event('keydown', { key: 'a' }));
            expect(panel.expanded).toBe(true);
        });

        it('collapses when tabbing out of the first (shift+tab) and last (tab) focusable element', () => {
            const { panel } = setup();
            panel.nativeElement.innerHTML = '<button id="first">a</button><button id="last">b</button>';
            panel.expand();
            $('#first').trigger($.Event('keydown', { key: 'Tab', shiftKey: false }));
            expect(panel.expanded).toBe(true);
            $('#first').trigger($.Event('keydown', { key: 'Tab', shiftKey: true }));
            expect(panel.expanded).toBe(false);
            panel.expand();
            $('#last').trigger($.Event('keydown', { key: 'Tab' }));
            expect(panel.expanded).toBe(false);
        });

        it('hides the collapsed panel on mobile', () => {
            const { panel } = setup();
            const ua = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 10) Mobile');
            panel.collapse();
            ua.mockRestore();
            expect(panel.expanded).toBe(false);
        });

        it('shifts the page for slide-in panels on expand and collapse', () => {
            const { panel } = setup();
            panel.animation = AnimationType.SLIDE_IN;
            panel.columnwidth = 3;
            panel.xscolumnwidth = 4;
            panel.expand();
            expect(cls(page.$element, 'left-panel-container-md-9')).toBe(true);
            expect(cls(page.$element, 'left-panel-container-xs-8')).toBe(true);
            panel.collapse();
            expect(cls(page.$element, 'left-panel-container-md-9')).toBe(false);
            expect(cls(page.$element, 'left-panel-container-xs-8')).toBe(false);
        });

        it('does not register the click-away listener for slide-in panels on tablets', () => {
            app.isTabletApplicationType = true;
            const { panel } = setup();
            panel.animation = AnimationType.SLIDE_IN;
            panel.expand();
            expect((panel as any)._destroyCollapseActionListener).toBeUndefined();
        });

        it('toggles through clicks on the page, ignoring clicks inside the panel', () => {
            const { panel } = setup();
            const toggle = jest.spyOn(panel, 'toggle').mockImplementation(() => {});
            panel.expand();
            panel.$ele.trigger('click.leftNavToggle');
            page.$element.trigger('click.leftNavToggle');
            expect(toggle).not.toHaveBeenCalled();
            page.$element.trigger('click.leftNavToggle');
            expect(toggle).toHaveBeenCalledTimes(1);
            panel.collapse(); // removes the listeners
            page.$element.trigger('click.leftNavToggle');
            expect(toggle).toHaveBeenCalledTimes(1);
        });

        it('uses the layout for notifications in spa mode', () => {
            const { panel } = setup(SpaHostComponent);
            panel.expand();
            panel.collapse();
            expect(layout.notify).toHaveBeenCalledWith('wmLeftPanel:expand');
            expect(layout.notify).toHaveBeenCalledWith('wmLeftPanel:collapse');
        });
    });

    describe('toggle and gestures', () => {
        it('uses the swipe animation on non-tablet apps', () => {
            const { panel } = setup();
            const swipe = jest.fn();
            panel.$ele = { swipeAnimation: swipe } as any;
            panel.toggle();
            expect(swipe).toHaveBeenCalledWith('gotoUpper');
            panel.expanded = true;
            panel.toggle();
            expect(swipe).toHaveBeenCalledWith('gotoLower');
        });

        it('expands and collapses directly on tablets', () => {
            app.isTabletApplicationType = true;
            const { panel } = setup();
            const expand = jest.spyOn(panel, 'expand').mockImplementation(() => { panel.expanded = true; });
            const collapse = jest.spyOn(panel, 'collapse').mockImplementation(() => { panel.expanded = false; });
            panel.toggle();
            jest.advanceTimersByTime(60);
            expect(expand).toHaveBeenCalled();
            panel.toggle();
            jest.advanceTimersByTime(60);
            expect(collapse).toHaveBeenCalled();
        });

        it('reports whether gestures are enabled', () => {
            const { panel } = setup();
            panel.gestures = 'on';
            expect(panel.isGesturesEnabled()).toBe(true);
            panel.gestures = 'off';
            expect(panel.isGesturesEnabled()).toBe(false);
        });
    });

    describe('onPropertyChange', () => {
        it('animation: slide-in sets page classes and widths, and creates the animator', () => {
            const { panel } = setup();
            panel.columnwidth = 3;
            panel.xscolumnwidth = 4;
            panel.onPropertyChange('animation', AnimationType.SLIDE_IN, AnimationType.SLIDE_OVER);
            expect(cls(page.$element, 'slide-in-left-panel-container')).toBe(true);
            expect(cls(page.$element, 'left-panel-container-md-9')).toBe(true);
            expect((panel as any)._leftPanelAnimator).toBeInstanceOf(LeftPanelAnimator);
            expect($.fn.swipeAnimation).toHaveBeenCalled();
        });

        it('animation: slide-over swaps the page classes', () => {
            const { panel } = setup();
            page.$element.addClass('slide-in-left-panel-container');
            panel.onPropertyChange('animation', AnimationType.SLIDE_OVER, AnimationType.SLIDE_IN);
            expect(cls(page.$element, 'slide-over-left-panel-container')).toBe(true);
            expect(cls(page.$element, 'slide-in-left-panel-container')).toBe(false);
        });

        it('animation: other values only create the animator', () => {
            const { panel } = setup();
            panel.onPropertyChange('animation', 'none', 'x');
            expect((panel as any)._leftPanelAnimator).toBeDefined();
        });

        it('columnwidth and xscolumnwidth swap the column classes and page offsets for slide-in', () => {
            const { panel } = setup();
            panel.animation = AnimationType.SLIDE_IN;
            panel.onPropertyChange('columnwidth', 3, 2);
            expect(cls(panel.nativeElement, 'col-md-3')).toBe(true);
            expect(cls(page.$element, 'left-panel-container-md-9')).toBe(true);
            panel.onPropertyChange('columnwidth', 4, 3);
            expect(cls(panel.nativeElement, 'col-md-3')).toBe(false);
            panel.onPropertyChange('xscolumnwidth', 5, 4);
            expect(cls(panel.nativeElement, 'col-xs-5')).toBe(true);
            expect(cls(page.$element, 'left-panel-container-xs-7')).toBe(true);
        });

        it('columnwidth and xscolumnwidth do not move the page for other animations', () => {
            const { panel } = setup();
            panel.animation = AnimationType.SLIDE_OVER;
            panel.onPropertyChange('columnwidth', 5, 0);
            panel.onPropertyChange('xscolumnwidth', 5, 0);
            expect(cls(panel.nativeElement, 'col-md-5')).toBe(true);
            expect(cls(page.$element, 'left-panel-container-md-7')).toBe(false);
            expect(cls(page.$element, 'left-panel-container-xs-7')).toBe(false);
        });

        it('expanded toggles the state classes', () => {
            const { panel } = setup();
            panel.onPropertyChange('expanded', true, false);
            expect(cls(panel.nativeElement, 'left-panel-expanded')).toBe(true);
            panel.onPropertyChange('expanded', false, true);
            expect(cls(panel.nativeElement, 'left-panel-collapsed')).toBe(true);
        });

        it('delegates unknown properties to the base widget', () => {
            const { panel } = setup();
            expect(() => panel.onPropertyChange('class', 'x', '')).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('releases listeners and references', () => {
            const { fixture, panel } = setup();
            panel.expand();
            const off = jest.spyOn(panel.$ele, 'off');
            (panel as any)._leftPanelAnimator = {};
            fixture.destroy();
            expect(off).toHaveBeenCalled();
            expect(panel.$ele).toBeNull();
            expect(panel.$page).toBeNull();
        });

        it('is safe without listeners or animator', () => {
            const { fixture } = setup();
            expect(() => fixture.destroy()).not.toThrow();
        });
    });

    describe('leftover branches', () => {
        afterEach(() => (wmCore.isMobile as jest.Mock).mockClear());

        it('applies the column width given in markup on construction', () => {
            const { panel } = setup(WideHostComponent);
            expect(cls(panel.nativeElement, 'col-md-3')).toBe(true);
        });

        it('hides the panel when it collapses on a mobile device', () => {
            const { panel } = setup();
            (wmCore.isMobile as jest.Mock).mockReturnValue(true);
            panel.collapse();
            expect(cls(panel.nativeElement, 'hidden')).toBe(true);
        });

        it('leaves the page alone when a non slide-in panel expands and collapses', () => {
            const { panel } = setup();
            panel.animation = AnimationType.SLIDE_OVER;
            panel.expand();
            panel.collapse();
            expect(panel.expanded).toBe(false);
        });

        it('keeps the panel open when another key is pressed on the last focusable element', () => {
            const { panel } = setup();
            panel.nativeElement.innerHTML = '<button id="first2">a</button><button id="last2">b</button>';
            panel.expand();
            $('#last2').trigger($.Event('keydown', { key: 'a' }));
            expect(panel.expanded).toBe(true);
        });

        it('ignores an empty column width', () => {
            const { panel } = setup();
            panel.onPropertyChange('columnwidth', 0, 0);
            expect(cls(panel.nativeElement, 'col-md-0')).toBe(false);
        });

        it('destroys cleanly when the animator was already released', () => {
            const { fixture, panel } = setup();
            (panel as any)._leftPanelAnimator = null;
            expect(() => fixture.destroy()).not.toThrow();
        });
    });
});

describe('LeftPanelAnimator', () => {
    const make = (overrides: any = {}) => {
        const $ele = $('<div></div>');
        const $page = $('<div></div>');
        $ele.width = jest.fn(() => 200) as any;
        $page.width = jest.fn(() => 1000) as any;
        const leftPanel: any = {
            $ele,
            $page,
            animation: AnimationType.SLIDE_OVER,
            expanded: false,
            isGesturesEnabled: jest.fn(() => true),
            app: { isTabletApplicationType: false },
            collapse: jest.fn(),
            expand: jest.fn(),
            ...overrides
        };
        ($ as any).fn.swipey = { DIRECTIONS: { HORIZONTAL: 'h' } };
        ($ as any).fn.swipeAnimation = jest.fn();
        return { animator: new LeftPanelAnimator(leftPanel), leftPanel };
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('initialises the swipe animation on the panel', () => {
        make();
        expect($.fn.swipeAnimation).toHaveBeenCalled();
    });

    describe('bounds', () => {
        it('returns closed-state bounds', () => {
            const { animator, leftPanel } = make();
            expect(animator.bounds(undefined, 0)).toEqual({ center: 0, upper: 200 });
            expect(leftPanel.isGesturesEnabled).toHaveBeenCalled();
        });

        it('uses the page width as the animation width for slide-in', () => {
            const { animator } = make({ animation: AnimationType.SLIDE_IN });
            animator.bounds(undefined, 0);
            expect((animator.context() as any).w).toBe(1000);
        });

        it('returns open-state bounds', () => {
            const { animator } = make({ expanded: true });
            expect(animator.bounds(undefined, 0)).toEqual({ center: 200, lower: -200 });
        });

        it('applies the tablet offset', () => {
            const { animator } = make({ app: { isTabletApplicationType: true } });
            expect((animator.bounds(undefined, 0) as any).upper).toBeCloseTo(146.68);
        });

        it('is strict for gestures that start far from the edge', () => {
            const { animator } = make();
            expect(animator.bounds({ pageX: 500 }, 0)).toEqual({ strict: true });
            expect(animator.bounds({ touches: [{ pageX: 500 }] }, 0)).toEqual({ strict: true });
            expect(animator.bounds({ pageX: 10 }, 0)).toEqual({ center: 0, upper: 200 });
        });
    });

    describe('context', () => {
        it('exposes the measurements and a limit function', () => {
            const { animator } = make();
            animator.bounds(undefined, 0);
            const ctx: any = animator.context();
            expect(ctx).toEqual(expect.objectContaining({ pageW: 1000, leftW: 200, maxX: 20 }));
            expect(ctx.limit(0, -5, 10)).toBe(0);
            expect(ctx.limit(0, 15, 10)).toBe(10);
            expect(ctx.limit(0, 5, 10)).toBe(5);
        });
    });

    describe('animation', () => {
        it('slides the panel over the page', () => {
            const { animator } = make();
            expect(animator.animation()).toHaveProperty('transform');
        });

        it('slides both panel and page for slide-in', () => {
            const { animator } = make({ animation: AnimationType.SLIDE_IN });
            const defs: any = animator.animation();
            expect(defs).toHaveLength(2);
            expect(defs[0].css.transform).toContain('translate3d(-100%');
        });

        it('uses tablet-specific animation for slide-in on tablets', () => {
            const { animator } = make({ animation: AnimationType.SLIDE_IN, app: { isTabletApplicationType: true } });
            const defs: any = animator.animation();
            expect(defs[1].css.width).toContain('pageW');
        });
    });

    describe('callbacks', () => {
        it('collapses and resets the transition on lower', () => {
            const { animator, leftPanel } = make({ animation: AnimationType.SLIDE_IN });
            const css = jest.spyOn((animator as any)._$animatedElements, 'css');
            animator.onLower();
            expect(leftPanel.collapse).toHaveBeenCalled();
            jest.advanceTimersByTime(150);
            expect(css).toHaveBeenCalledWith({ transform: '', opacity: '', 'z-index': '', width: '' });
        });

        it('expands on upper', () => {
            const { animator, leftPanel } = make();
            animator.onUpper();
            expect(leftPanel.expand).toHaveBeenCalled();
        });

        it('does not reset when there are no animated elements', () => {
            const { animator } = make();
            (animator as any)._$animatedElements = undefined;
            expect(() => { animator.onLower(); jest.advanceTimersByTime(150); }).not.toThrow();
        });
    });
});
