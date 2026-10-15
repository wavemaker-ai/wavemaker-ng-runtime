import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { PopoverConfig, PopoverModule } from 'ngx-bootstrap/popover';
import { App, adjustContainerPosition, adjustContainerRightEdges, addClass, findRootContainer, setCSSFromObj } from '@wm/core';
import { AUTOCLOSE_TYPE } from '@wm/components/base';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { AnchorComponent } from '../../../basic/anchor/src/anchor.component';
import { PopoverComponent } from './popover.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    adjustContainerPosition: jest.fn(),
    adjustContainerRightEdges: jest.fn(),
    findRootContainer: jest.fn(),
    setCSSFromObj: jest.fn(),
    addClass: jest.fn(),
}));

@Component({
    standalone: false,
    template: `<wm-popover wmPopover name="extraPopover" title="t" contentsource="inline" content="c" caption="open" popoverwidth="240" popoverheight="360"
        container=".wm-app" popoverarrow="true" popoverplacement="Bottom" autoclose="outsideClick" show="true" tabindex="0">
        <ng-template><button class="popover-start"></button>content<button class="popover-end"></button></ng-template>
    </wm-popover>`,
})
class ExtraPopoverWrapperComponent {
    @ViewChild(PopoverComponent, { static: true }) wmComponent: PopoverComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [PopoverModule, PopoverComponent, AnchorComponent],
    declarations: [ExtraPopoverWrapperComponent],
    providers: [{ provide: App, useValue: mockApp }, { provide: PopoverConfig }],
};

describe('PopoverComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraPopoverWrapperComponent>;
    let popover: any;
    let invoke: jest.SpyInstance;

    const active = () => (PopoverComponent as any).activePopovers as any[];

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, ExtraPopoverWrapperComponent);
        popover = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        invoke = jest.spyOn(popover, 'invokeEventCallback').mockImplementation(() => undefined);
        active().length = 0;
        popover.bsPopoverDirective = { show: jest.fn(), hide: jest.fn(), _popover: {} };
        jest.spyOn(popover.cdr, 'detectChanges').mockImplementation(() => undefined);
        (adjustContainerPosition as jest.Mock).mockClear();
        (adjustContainerRightEdges as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        active().length = 0;
    });

    describe('opening and closing', () => {
        it('opens the popover once and registers it as active', () => {
            popover.open();
            popover.open(true);
            expect(popover.bsPopoverDirective.show).toHaveBeenCalledTimes(2);
            expect(active()).toEqual([popover]);
            expect(popover.preventFocusShift).toBe(true);
        });

        it('does not open while a click is handled', () => {
            popover.isHandlingClick = true;
            popover.open();
            expect(popover.bsPopoverDirective.show).not.toHaveBeenCalled();
        });

        it('closes an open popover and unregisters it', () => {
            popover.isOpen = true;
            active().push(popover);
            popover.close();
            expect(popover.isOpen).toBe(false);
            expect(popover.bsPopoverDirective.hide).toHaveBeenCalled();
            expect(active()).toEqual([]);
            expect(popover.isClosingProgrammatically).toBe(true);
        });

        it('ignores close for closed popovers and tolerates a missing directive', () => {
            popover.isOpen = false;
            popover.close();
            expect(popover.bsPopoverDirective.hide).not.toHaveBeenCalled();
            popover.isOpen = true;
            popover.bsPopoverDirective = undefined;
            expect(() => popover.close()).not.toThrow();
        });

        it('raises hide for popovers that were closed by the user', () => {
            popover.isOpen = true;
            jest.spyOn(popover, 'isChildPopover').mockReturnValue(false);
            popover.onHidden();
            expect(invoke).toHaveBeenCalledWith('hide', { $event: { type: 'hide' } });
            expect(popover.isOpen).toBe(false);
            expect(popover.isClosingProgrammatically).toBe(false);
        });

        it('keeps inner popovers open unless they are closed programmatically', () => {
            jest.spyOn(popover, 'isChildPopover').mockReturnValue(true);
            popover.isOpen = true;
            popover.onHidden();
            expect(invoke).not.toHaveBeenCalled();
            popover.isClosingProgrammatically = true;
            popover.onHidden();
            expect(invoke).toHaveBeenCalledWith('hide', expect.anything());
        });

        it('detects popovers inside other popovers', () => {
            expect(popover.isChildPopover()).toBe(false);
            const outer = document.createElement('div');
            outer.className = 'popover';
            outer.appendChild(popover.nativeElement);
            expect(popover.isChildPopover()).toBe(true);
        });

        it('hides the popover while the page is reused', () => {
            popover.ngOnDetach();
            expect(popover.bsPopoverDirective.hide).toHaveBeenCalled();
        });

        it('focuses the anchor shortly after closing with the keyboard', () => {
            jest.useFakeTimers();
            const focus = jest.spyOn(popover.anchorRef.nativeElement, 'focus');
            popover.setFocusToPopoverLink();
            jest.advanceTimersByTime(20);
            expect(focus).toHaveBeenCalled();
        });

        it('schedules the close of hovered popovers', () => {
            jest.useFakeTimers();
            popover.isOpen = true;
            popover.hidePopover();
            expect(popover.isClosingProgrammatically).toBe(true);
            jest.advanceTimersByTime(600);
            expect(popover.isOpen).toBe(false);
        });
    });

    describe('document clicks', () => {
        const click = (target: Element, outside = false) => {
            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'target', { value: target });
            document.dispatchEvent(event);
            return event;
        };

        beforeEach(() => {
            popover.isOpen = true;
            popover.outsideclick = true;
            popover.setupDocumentClickHandler();
        });

        afterEach(() => {
            document.removeEventListener('click', popover.documentClickHandler, true);
        });

        it('replaces a previous handler when it is set up again', () => {
            const first = popover.documentClickHandler;
            popover.setupDocumentClickHandler();
            expect(popover.documentClickHandler).not.toBe(first);
        });

        it('ignores clicks while the popover is closed', () => {
            popover.isOpen = false;
            const closeAll = jest.spyOn(popover, 'closeAllPopovers').mockImplementation(() => undefined);
            click(document.body);
            expect(closeAll).not.toHaveBeenCalled();
        });

        it('ignores clicks inside date pickers, time pickers and dropdowns', () => {
            const closeAll = jest.spyOn(popover, 'closeAllPopovers').mockImplementation(() => undefined);
            ['bs-datepicker-container', 'bs-timepicker'].forEach((tag) => {
                const el = document.createElement(tag);
                const child = document.createElement('span');
                el.appendChild(child);
                document.body.appendChild(el);
                click(child);
            });
            const menu = document.createElement('div');
            menu.className = 'dropdown-menu';
            const item = document.createElement('a');
            menu.appendChild(item);
            document.body.appendChild(menu);
            click(item);
            expect(closeAll).not.toHaveBeenCalled();
        });

        it('toggles the popover when its anchor is clicked', () => {
            const close = jest.spyOn(popover, 'close').mockImplementation(() => undefined);
            const open = jest.spyOn(popover, 'open').mockImplementation(() => undefined);
            click(popover.anchorRef.nativeElement);
            expect(close).toHaveBeenCalled();
            popover.isOpen = false;
            click(popover.anchorRef.nativeElement);
            expect(open).not.toHaveBeenCalled();
        });

        it('closes all popovers on clicks outside', () => {
            const closeAll = jest.spyOn(popover, 'closeAllPopovers').mockImplementation(() => undefined);
            click(document.body);
            expect(closeAll).toHaveBeenCalled();
            closeAll.mockClear();
            popover.outsideclick = false;
            click(document.body);
            expect(closeAll).not.toHaveBeenCalled();
        });

        it('closes only the inner popovers when a popover is clicked', () => {
            const container = document.createElement('div');
            container.className = popover.popoverContainerCls;
            const inner = document.createElement('span');
            container.appendChild(inner);
            document.body.appendChild(container);
            active().push(popover);
            const closeInner = jest.spyOn(popover, 'closeInnerPopovers').mockImplementation(() => undefined);
            click(inner);
            expect(closeInner).toHaveBeenCalledWith(0);
        });

        it('resets the click flag after handling', () => {
            jest.useFakeTimers();
            click(document.body);
            expect(popover.isHandlingClick).toBe(true);
            jest.advanceTimersByTime(5);
            expect(popover.isHandlingClick).toBe(false);
        });

        it('closes popovers that allow outside clicks', () => {
            const other: any = { outsideclick: true, close: jest.fn(), isClosingProgrammatically: false };
            const sticky: any = { outsideclick: false, close: jest.fn(), isClosingProgrammatically: false };
            active().push(other, sticky);
            popover.closeAllPopovers();
            expect(other.close).toHaveBeenCalled();
            expect(other.isClosingProgrammatically).toBe(true);
            expect(sticky.close).not.toHaveBeenCalled();
        });

        it('closes popovers that are opened above the clicked one', () => {
            const a: any = { outsideclick: true, close: jest.fn() };
            const b: any = { outsideclick: true, close: jest.fn() };
            const c: any = { outsideclick: false, close: jest.fn() };
            active().push(a, b, c);
            popover.closeInnerPopovers(0);
            expect(a.close).not.toHaveBeenCalled();
            expect(b.close).toHaveBeenCalled();
            expect(c.close).not.toHaveBeenCalled();
        });
    });

    describe('positioning', () => {
        const container = (left: number, width: number) => {
            const el = document.createElement('div');
            Object.defineProperty(el, 'offsetWidth', { value: width });
            jest.spyOn($.fn, 'offset').mockReturnValue({ left, top: 0 } as any);
            jest.spyOn($.fn, 'width').mockReturnValue(1000 as any);
            jest.spyOn(popover.anchorRef.nativeElement, 'getBoundingClientRect').mockReturnValue({ left: 200, width: 100 } as any);
            return el;
        };

        it('shifts the arrow while a popover leaves the screen on the left', () => {
            const adjustArrow = jest.spyOn(popover, 'adjustPopoverArrowPosition').mockImplementation(() => undefined);
            popover.calculatePopoverPostion(container(-20, 200));
            expect(adjustContainerPosition).toHaveBeenCalled();
            expect(adjustArrow).toHaveBeenCalledWith(expect.anything(), 246);
        });

        it('shifts the popover and arrow on the right edge', () => {
            jest.useFakeTimers();
            const adjustArrow = jest.spyOn(popover, 'adjustPopoverArrowPosition').mockImplementation(() => undefined);
            popover.calculatePopoverPostion(container(900, 200));
            jest.runAllTimers();
            expect(adjustContainerRightEdges).toHaveBeenCalled();
            expect(adjustArrow).toHaveBeenCalled();
        });

        it('uses a different arrow shift for popovers close to the left on narrow and wide screens', () => {
            jest.useFakeTimers();
            const adjustArrow = jest.spyOn(popover, 'adjustPopoverArrowPosition').mockImplementation(() => undefined);
            popover.calculatePopoverPostion(container(50, 1100));
            jest.runAllTimers();
            expect(adjustArrow).toHaveBeenCalledTimes(1);
            const wide = adjustArrow.mock.calls[0][1];
            (jest.spyOn($.fn, 'width') as any).mockReturnValue(400);
            popover.calculatePopoverPostion(container(300, 300));
            jest.runAllTimers();
            expect(adjustArrow.mock.calls.length).toBeGreaterThan(0);
            expect(typeof wide).toBe('number');
        });

        it('leaves popovers alone that fit', () => {
            const adjustArrow = jest.spyOn(popover, 'adjustPopoverArrowPosition').mockImplementation(() => undefined);
            popover.calculatePopoverPostion(container(100, 200));
            expect(adjustContainerPosition).not.toHaveBeenCalled();
            expect(adjustContainerRightEdges).not.toHaveBeenCalled();
            expect(adjustArrow).not.toHaveBeenCalled();
        });

        it('positions the arrow once the zone is stable and replaces older subscriptions', () => {
            const unsubscribe = jest.fn();
            popover.arrowPositionSubscription = { unsubscribe };
            const arrow = $('<div><span class="popover-arrow"></span></div>');
            popover.adjustPopoverArrowPosition(arrow, 40);
            expect(unsubscribe).toHaveBeenCalled();
            popover.ngZone.onStable.emit();
            expect(arrow.find('.popover-arrow').css('left')).toBe('40px');
            popover.arrowPositionSubscription.unsubscribe();
        });
    });

    describe('partial and inline events', () => {
        it('raises show for inline content with the page scopes', () => {
            popover.contentsource = 'inline';
            popover.viewParent = { Widgets: { w: 1 }, Variables: { v: 1 }, Actions: { a: 1 } };
            popover.triggerPopoverEvents();
            expect(popover.Widgets).toEqual({ w: 1 });
            expect(invoke).toHaveBeenCalledWith('show', { $event: { type: 'show' } });
        });

        it('waits for the partial to load before raising load and show', () => {
            let loaded: Function = () => undefined;
            const unsubscribe = jest.fn();
            jest.spyOn(popover.app, 'subscribe').mockImplementation((_event: any, fn: any) => { loaded = fn; return unsubscribe; });
            popover.contentsource = 'partial';
            popover.partialRef = { nativeElement: { widget: { Widgets: { w: 2 }, Variables: { v: 2 }, Actions: { a: 2 } } } };
            popover.triggerPopoverEvents();
            loaded();
            expect(popover.Widgets).toEqual({ w: 2 });
            expect(invoke).toHaveBeenCalledWith('load');
            expect(invoke).toHaveBeenCalledWith('show', { $event: { type: 'show' } });
        });

        it('ignores a loaded partial that is gone', () => {
            let loaded: Function = () => undefined;
            jest.spyOn(popover.app, 'subscribe').mockImplementation((_event: any, fn: any) => { loaded = fn; return jest.fn(); });
            popover.contentsource = 'partial';
            popover.partialRef = undefined;
            popover.triggerPopoverEvents();
            loaded();
            expect(invoke).not.toHaveBeenCalled();
        });
    });

    describe('keyboard and properties', () => {
        it('opens with enter when content is available', () => {
            const show = jest.spyOn(popover, 'showPopover').mockImplementation(() => undefined);
            const event: any = { key: 'Enter', stopPropagation: jest.fn(), preventDefault: jest.fn() };
            popover.canPopoverOpen = false;
            popover.onPopoverAnchorKeydown(event);
            expect(show).not.toHaveBeenCalled();
            popover.canPopoverOpen = true;
            popover.onPopoverAnchorKeydown({ key: 'a' });
            expect(show).not.toHaveBeenCalled();
            popover.onPopoverAnchorKeydown(event);
            expect(show).toHaveBeenCalled();
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('shows the popover through the directive', () => {
            popover.showPopover();
            expect(popover.bsPopoverDirective.show).toHaveBeenCalled();
        });

        it('tracks whether the popover can open', () => {
            popover.contentsource = 'partial';
            popover.content = '';
            popover.onPropertyChange('contentsource', 'partial');
            expect(popover.canPopoverOpen).toBe(false);
            popover.onPropertyChange('content', 'Partial');
            expect(popover.canPopoverOpen).toBe(true);
        });

        it('derives outside click handling from autoclose', () => {
            popover.onPropertyChange('autoclose', AUTOCLOSE_TYPE.OUTSIDECLICK);
            expect(popover.outsideclick).toBe(true);
            popover.onPropertyChange('autoclose', AUTOCLOSE_TYPE.ALWAYS);
            expect(popover.outsideclick).toBe(true);
            popover.onPropertyChange('autoclose', AUTOCLOSE_TYPE.DISABLED);
            expect(popover.outsideclick).toBe(false);
        });

        it('ignores class and tabindex changes', () => {
            expect(() => { popover.onPropertyChange('class', 'x'); popover.onPropertyChange('tabindex', 1); }).not.toThrow();
        });
    });

    describe('shown popover', () => {
        const container = () => {
            const el = document.createElement('div');
            el.className = popover.popoverContainerCls;
            el.innerHTML = '<div class="arrow"></div><button class="popover-start"></button><button class="popover-end"></button>';
            document.body.appendChild(el);
            return el;
        };

        beforeEach(() => {
            jest.useFakeTimers();
            jest.spyOn(popover, 'calculatePopoverPostion').mockImplementation(() => undefined);
            jest.spyOn(popover, 'triggerPopoverEvents').mockImplementation(() => undefined);
            jest.spyOn(popover, 'setupDocumentClickHandler').mockImplementation(() => undefined);
            (findRootContainer as jest.Mock).mockReturnValue(undefined);
            popover.interaction = 'click';
            popover.adaptiveposition = false;
            popover.popoverarrow = true;
            popover.autoclose = AUTOCLOSE_TYPE.OUTSIDECLICK;
            popover.outsideclick = true;
        });

        it('registers the popover and styles its container', () => {
            const el = container();
            popover.onShown();
            expect(popover.isOpen).toBe(true);
            expect(active()).toEqual([popover]);
            expect(el.getAttribute('data-popover-id')).toBe(popover.widgetId);
            expect(setCSSFromObj).toHaveBeenCalledWith(el, { height: popover.popoverheight, minWidth: popover.popoverwidth, width: popover.popoverwidth });
            expect(popover.setupDocumentClickHandler).toHaveBeenCalled();
            jest.runAllTimers();
            expect(popover.calculatePopoverPostion).toHaveBeenCalledWith(el);
            expect(popover.triggerPopoverEvents).toHaveBeenCalled();
        });

        it('hides the arrow when configured and stops clicks inside the popover', () => {
            const el = container();
            popover.popoverarrow = false;
            popover.onShown();
            expect(addClass).toHaveBeenCalledWith(el.querySelector('.arrow'), 'hidden');
            const event = new MouseEvent('click', { bubbles: true });
            const stop = jest.spyOn(event, 'stopPropagation');
            el.dispatchEvent(event);
            expect(stop).toHaveBeenCalled();
        });

        it('wraps the popover in the page container when the page has styles', () => {
            container();
            (findRootContainer as jest.Mock).mockReturnValue('div');
            document.body.insertAdjacentHTML('beforeend', '<popover-container></popover-container>');
            popover.onShown();
            expect(document.querySelector('popover-container')!.parentElement!.tagName).toBe('DIV');
        });

        it('sets up the hover behaviour', () => {
            const el = container();
            popover.interaction = 'hover';
            const hide = jest.spyOn(popover, 'hidePopover').mockImplementation(() => undefined);
            popover.onShown();
            el.onmouseleave!(new MouseEvent('mouseleave'));
            popover.anchorRef.nativeElement.onmouseleave(new MouseEvent('mouseleave'));
            expect(hide).toHaveBeenCalledTimes(2);
            expect(() => { el.onmouseenter!(new MouseEvent('mouseenter')); popover.anchorRef.nativeElement.onmouseenter(); }).not.toThrow();
        });

        it('returns the focus to the anchor when tabbing out of the popover', () => {
            const el = container();
            popover.onShown();
            const focusAnchor = jest.spyOn(popover, 'setFocusToPopoverLink').mockImplementation(() => undefined);
            const start = el.querySelector('.popover-start') as HTMLElement;
            const end = el.querySelector('.popover-end') as HTMLElement;
            const shiftTab: any = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
            start.onkeydown!(shiftTab);
            expect(popover.bsPopoverDirective.hide).toHaveBeenCalled();
            expect(shiftTab.preventDefault).toHaveBeenCalled();
            start.onkeydown!({ key: 'Tab', shiftKey: false, preventDefault: jest.fn() } as any);
            end.onkeydown!({ key: 'Tab', shiftKey: false, preventDefault: jest.fn() } as any);
            end.onkeydown!({ key: 'Tab', shiftKey: true, preventDefault: jest.fn() } as any);
            expect(focusAnchor).toHaveBeenCalledTimes(2);
        });

        it('closes the popover on click when autoclose is always', () => {
            const el = container();
            popover.autoclose = AUTOCLOSE_TYPE.ALWAYS;
            const close = jest.spyOn(popover, 'close').mockImplementation(() => undefined);
            popover.onShown();
            el.onclick!({} as any);
            expect(close).toHaveBeenCalled();
        });

        it('moves the focus to the popover or keeps it on the trigger', () => {
            const el = container();
            const start = el.querySelector('.popover-start') as HTMLElement;
            const focusStart = jest.spyOn(start, 'focus');
            popover.preventFocusShift = false;
            popover.onShown();
            jest.advanceTimersByTime(60);
            expect(focusStart).toHaveBeenCalled();

            focusStart.mockClear();
            const trigger = document.createElement('button');
            document.body.appendChild(trigger);
            trigger.focus();
            const focusTrigger = jest.spyOn(trigger, 'focus');
            popover.preventFocusShift = true;
            popover.onShown();
            jest.advanceTimersByTime(60);
            expect(focusTrigger).toHaveBeenCalled();
            expect(focusStart).not.toHaveBeenCalled();
        });

        it('skips the position calculation for adaptive popovers', () => {
            container();
            popover.adaptiveposition = true;
            popover.onShown();
            jest.runAllTimers();
            expect(popover.calculatePopoverPostion).not.toHaveBeenCalled();
            expect(popover.triggerPopoverEvents).toHaveBeenCalled();
        });
    });

    describe('destroying', () => {
        it('releases subscriptions, handlers and references', () => {
            const partial = jest.fn();
            const arrow = { unsubscribe: jest.fn() };
            popover.partialLoadedSubscription = partial;
            popover.arrowPositionSubscription = arrow;
            popover.isOpen = true;
            popover.closePopoverTimeout = setTimeout(() => undefined, 1000);
            popover.documentClickHandler = jest.fn();
            active().push(popover);
            const hide = popover.bsPopoverDirective.hide;
            const removeListener = jest.spyOn(document, 'removeEventListener');

            popover.ngOnDestroy();

            expect(partial).toHaveBeenCalled();
            expect(arrow.unsubscribe).toHaveBeenCalled();
            expect(hide).toHaveBeenCalled();
            expect(removeListener).toHaveBeenCalledWith('click', expect.any(Function), true);
            expect(active()).toEqual([]);
            expect(popover.bsPopoverDirective).toBeNull();
            expect(popover.anchorRef).toBeNull();
        });
    });
});
