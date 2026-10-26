import { Component, Inject, Injector, TemplateRef, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';
import { AbstractDialogService, App } from '@wm/core';
import { Context, register } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { BaseDialog } from './base-dialog';

register('wm-test-dialog', new Map());
let mobile = false;
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: () => mobile
}));

@Component({
    standalone: false,
    selector: 'app-test-base-dialog',
    template: '<ng-template #tpl></ng-template>'
})
class TestDialogComponent extends BaseDialog {
    @ViewChild('tpl', { static: true }) tpl: TemplateRef<any>;
    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') ctx: any) {
        super(inj, { widgetType: 'wm-test-dialog' } as any, { class: 'base' } as any, ctx);
    }
    protected getTemplateRef() {
        return this.tpl;
    }
    // expose protected members
    callOnPropertyChange(k, nv, ov?) {
        this.onPropertyChange(k, nv, ov);
    }
}

describe('BaseDialog cover', () => {
    let bsModal: any;
    let dialogService: any;
    let router: any;
    let fixture;
    let dlg: TestDialogComponent;
    let opened: any[];

    beforeEach(() => {
        jest.useFakeTimers();
        mobile = false;
        opened = [];
        bsModal = {
            show: jest.fn().mockReturnValue({ hide: jest.fn() }),
            onShown: new Subject<any>(),
            onShow: new Subject<any>(),
            onHidden: new Subject<any>(),
            onHide: new Subject<any>()
        };
        dialogService = {
            addToOpenedDialogs: jest.fn((d) => opened.push(d)),
            getOpenedDialogs: jest.fn(() => opened),
            removeFromOpenedDialogs: jest.fn(),
            addToClosedDialogs: jest.fn(),
            removeFromClosedDialogs: jest.fn(),
            register: jest.fn(),
            deRegister: jest.fn(),
            getLastOpenedDialog: jest.fn(() => opened[opened.length - 1]),
            getDialogRefFromClosedDialogs: jest.fn()
        };
        router = { events: new Subject<any>() };
        TestBed.configureTestingModule({
            declarations: [TestDialogComponent],
            providers: [
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: App, useValue: mockApp },
                { provide: BsModalService, useValue: bsModal },
                { provide: AbstractDialogService, useValue: dialogService },
                { provide: Router, useValue: router },
                { provide: 'EXPLICIT_CONTEXT', useValue: null }
            ]
        });
        fixture = TestBed.createComponent(TestDialogComponent);
        dlg = fixture.componentInstance;
    });

    afterEach(() => {
        jest.useRealTimers();
        document.querySelectorAll('[aria-labelledby], bs-modal-backdrop, modal-container').forEach(e => e.remove());
    });

    const addDialogDom = (titleId: string, zIndex?: string) => {
        const el = document.createElement('div');
        el.setAttribute('aria-labelledby', titleId);
        if (zIndex) {
            el.style.zIndex = zIndex;
        }
        el.innerHTML = '<button>ok</button>';
        document.body.appendChild(el);
        return el;
    };

    it('ignores router events other than NavigationEnd', () => {
        const closeSpy = jest.spyOn(dlg, 'close');
        router.events.next(new NavigationStart(1, '/x'));
        expect(closeSpy).not.toHaveBeenCalled();
        router.events.next(new NavigationEnd(1, '/x', '/x'));
        expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('on shown: wraps dialog in the root container, fires opened, focuses first element and stacks z-index over previous dialog', () => {
        // place the widget inside a page so findRootContainer resolves a root tag
        dlg.$element.addClass('app-page');
        const other: any = { titleId: 'other-title' };
        opened.push(other, dlg);
        const otherEl = addDialogDom('other-title', '100');
        const myEl = addDialogDom(dlg.titleId);
        const backdrop = document.createElement('bs-modal-backdrop');
        document.body.appendChild(backdrop);
        const openedSpy = jest.spyOn(dlg, 'invokeEventCallback');
        const wrapSpy = jest.spyOn($.fn, 'wrap');

        bsModal.onShown.next({ id: 'id1' });
        jest.runOnlyPendingTimers();

        expect(openedSpy).toHaveBeenCalledWith('opened', { $event: { type: 'opened' } });
        expect(wrapSpy).toHaveBeenCalled();
        expect(document.activeElement).toBe(myEl.querySelector('button'));
        expect(myEl.style.zIndex).toBe('102');
        expect(backdrop.style.zIndex).toBe('101');
        expect(otherEl.style.zIndex).toBe('100');
        wrapSpy.mockRestore();
    });

    it('on shown: does nothing when the last opened dialog is another instance', () => {
        opened.push({ titleId: 'x' });
        const spy = jest.spyOn(dlg, 'invokeEventCallback');
        bsModal.onShown.next({ id: 'id1' });
        jest.runOnlyPendingTimers();
        expect(spy).not.toHaveBeenCalled();
    });

    it('on hidden: re-stacks the backdrop below the remaining opened dialog', () => {
        const remaining: any = { titleId: 'remaining' };
        const remEl = addDialogDom('remaining', '1050');
        const backdrop = document.createElement('bs-modal-backdrop');
        document.body.appendChild(backdrop);
        opened.push(remaining);
        (dlg as any).dialogId = 'id1';
        const closeCb = jest.fn();
        (dlg as any).closeCallBackFn = closeCb;
        const spy = jest.spyOn(dlg, 'invokeEventCallback');

        bsModal.onHidden.next({ id: 'id1' });

        expect(spy).toHaveBeenCalledWith('close');
        expect(backdrop.style.zIndex).toBe('1049');
        expect(remEl.style.zIndex).toBe('1050');
        expect((dlg as any).dialogId).toBeNull();
        expect(closeCb).toHaveBeenCalled();
    });

    it('on hidden via esc resolves the last opened dialog', () => {
        opened.push(dlg);
        bsModal.onHidden.next('esc');
        expect(dialogService.removeFromOpenedDialogs).toHaveBeenCalledWith(dlg);
    });

    it('open() hides app-root from assistive tech on mobile when it is the only opened dialog', () => {
        mobile = true;
        const appRoot = document.createElement('app-root');
        document.body.appendChild(appRoot);
        dlg.open();
        expect(appRoot.getAttribute('aria-hidden')).toBe('true');
        appRoot.remove();
    });

    it('open() does not touch app-root on desktop', () => {
        const appRoot = document.createElement('app-root');
        document.body.appendChild(appRoot);
        dlg.open();
        expect(appRoot.hasAttribute('aria-hidden')).toBe(false);
        appRoot.remove();
    });

    it('onPropertyChange ignores class/name/tabindex and handles animation swaps', () => {
        const mo = (dlg as any).modalOptions;
        dlg.callOnPropertyChange('class', 'x');
        dlg.callOnPropertyChange('name', 'x');
        dlg.callOnPropertyChange('tabindex', 1);
        expect(mo.class).toBe('base');
        dlg.callOnPropertyChange('animation', 'fadeIn', undefined);
        expect(mo.class).toBe('base animated fadeIn');
        dlg.callOnPropertyChange('animation', '', 'fadeIn');
        expect(mo.class).toBe('base');
    });
});
