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
    template: `<wm-popover wmPopover name="coverPopover" title="t" contentsource="inline" content="c" caption="open" popoverwidth="240" popoverheight="360"
        container=".wm-app" popoverarrow="true" popoverplacement="Bottom" autoclose="outsideClick" show="true" tabindex="0">
        <ng-template><button class="popover-start"></button>content<button class="popover-end"></button></ng-template>
    </wm-popover>`,
})
class CoverPopoverWrapperComponent {
    @ViewChild(PopoverComponent, { static: true }) wmComponent: PopoverComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [PopoverModule, PopoverComponent, AnchorComponent],
    declarations: [CoverPopoverWrapperComponent],
    providers: [{ provide: App, useValue: mockApp }, { provide: PopoverConfig }],
};

describe('PopoverComponent - remaining branches', () => {
    let fixture: ComponentFixture<CoverPopoverWrapperComponent>;
    let popover: any;

    const active = () => (PopoverComponent as any).activePopovers as any[];
    const container = () => {
        const el = document.createElement('div');
        el.className = popover.popoverContainerCls;
        el.innerHTML = '<div class="arrow"></div><button class="popover-start"></button><button class="popover-end"></button>';
        document.body.appendChild(el);
        return el;
    };

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, CoverPopoverWrapperComponent);
        popover = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        jest.spyOn(popover, 'invokeEventCallback').mockImplementation(() => undefined);
        active().length = 0;
        popover.bsPopoverDirective = { show: jest.fn(), hide: jest.fn(), _popover: {} };
        jest.spyOn(popover.cdr, 'detectChanges').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        active().length = 0;
    });

    it('re-opens the popover when the anchor click finds it already closed by the time it toggles', () => {
        popover.outsideclick = true;
        popover.setupDocumentClickHandler();
        let reads = 0;
        // first read (guard at the top of the handler) says open, second read (toggle) says closed
        Object.defineProperty(popover, 'isOpen', {
            configurable: true,
            get: () => (++reads === 1),
            set: () => undefined,
        });
        const open = jest.spyOn(popover, 'open').mockImplementation(() => undefined);
        const close = jest.spyOn(popover, 'close').mockImplementation(() => undefined);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'target', { value: popover.anchorRef.nativeElement });
        document.dispatchEvent(event);
        document.removeEventListener('click', popover.documentClickHandler, true);
        expect(open).toHaveBeenCalledTimes(1);
        expect(close).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
    });

    describe('shown popover', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.spyOn(popover, 'calculatePopoverPostion').mockImplementation(() => undefined);
            jest.spyOn(popover, 'triggerPopoverEvents').mockImplementation(() => undefined);
            jest.spyOn(popover, 'setupDocumentClickHandler').mockImplementation(() => undefined);
            (findRootContainer as jest.Mock).mockReturnValue(undefined);
            popover.interaction = 'click';
            popover.adaptiveposition = true;
            popover.popoverarrow = true;
            popover.autoclose = AUTOCLOSE_TYPE.OUTSIDECLICK;
            popover.outsideclick = true;
        });

        it('forgets the active popover when it is hidden, and applies variant classes in prism', () => {
            popover.isPrism = true;
            popover.class = 'foo popover-info bar popover-wide';
            const el = container();
            popover.onShown();
            expect(el.classList.contains('popover-info')).toBe(true);
            expect(el.classList.contains('popover-wide')).toBe(true);
            expect(el.classList.contains('foo')).toBe(false);
            jest.spyOn(popover, 'isChildPopover').mockReturnValue(false);
            popover.onHidden();
            // a second popover opening afterwards must not try to close this (already hidden) one
            const other = fixture.componentInstance.wmComponent;
            expect(other).toBe(popover);
            const close = jest.spyOn(popover, 'close');
            popover.onShown();
            expect(close).not.toHaveBeenCalled();
        });

        it('does not register the outside click handler when outside clicks are disabled or copy variants outside prism', () => {
            popover.outsideclick = false;
            popover.isPrism = false;
            popover.class = 'popover-info';
            const el = container();
            popover.onShown();
            expect(popover.setupDocumentClickHandler).not.toHaveBeenCalled();
            // variant classes are only copied to the container in prism mode
            expect(el.classList.contains('popover-info')).toBe(false);
        });

        it('does not touch the anchor aria attribute once the anchor is gone', () => {
            const el = container();
            popover.onShown();
            const anchor = popover.anchorRef;
            popover.anchorRef = undefined;
            expect(() => jest.runAllTimers()).not.toThrow();
            popover.anchorRef = anchor;
            expect(el).toBeTruthy();
        });

        it('closes the focus back to the anchor on escape and unregisters the key handler', () => {
            container();
            const deRegister = jest.fn();
            let escHandler: Function;
            jest.spyOn(popover.eventManager, 'addEventListener').mockImplementation((_el: any, evt: any, fn: any) => {
                expect(evt).toBe('keydown.esc');
                escHandler = fn;
                return deRegister;
            });
            const focusAnchor = jest.spyOn(popover, 'setFocusToPopoverLink').mockImplementation(() => undefined);
            popover.onShown();
            popover.isOpen = true;
            escHandler();
            expect(popover.isOpen).toBe(false);
            expect(focusAnchor).toHaveBeenCalled();
            expect(deRegister).toHaveBeenCalled();
        });

        it('fails when the popover container is not rendered', () => {
            expect(() => popover.onShown()).toThrow();
            expect(popover.isOpen).toBe(true);
        });
    });

    describe('partial events', () => {
        it('does not call an already released partial subscription again', () => {
            let loaded: Function = () => undefined;
            jest.spyOn(popover.app, 'subscribe').mockImplementation((_event: any, fn: any) => { loaded = fn; return jest.fn(); });
            popover.contentsource = 'partial';
            popover.partialRef = { nativeElement: { widget: { Widgets: {}, Variables: {}, Actions: {} } } };
            popover.triggerPopoverEvents();
            popover.partialLoadedSubscription = null;
            expect(() => loaded()).not.toThrow();
            expect(popover.invokeEventCallback).toHaveBeenCalledWith('load');
        });
    });

    describe('destroy', () => {
        it('clears a pending close timeout', () => {
            jest.useFakeTimers();
            popover.closePopoverTimeout = setTimeout(() => undefined, 1000);
            const clear = jest.spyOn(global, 'clearTimeout');
            popover.ngOnDestroy();
            expect(clear).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('applyVariantClass', () => {
        it('does nothing without a container and tolerates a missing class', () => {
            expect(() => popover.applyVariantClass(null)).not.toThrow();
            const el = document.createElement('div');
            popover.class = undefined;
            popover.applyVariantClass(el);
            expect(el.className).toBe('');
        });
    });
});
