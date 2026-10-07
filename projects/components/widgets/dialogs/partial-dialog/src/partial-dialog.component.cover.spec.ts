import { Component, NO_ERRORS_SCHEMA, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PartialDialogComponent } from './partial-dialog.component';
import { Context, provideAsWidgetRef } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AbstractDialogService, App } from '@wm/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BehaviorSubject } from 'rxjs';

@Component({
    standalone: false,
    template: `<div wmPartialDialog class="my-cls" modal="true" closable="false"></div>`
})
class PartialDialogCoverHost {
    @ViewChild(PartialDialogComponent, { static: true }) wmComponent: PartialDialogComponent;
}

describe('PartialDialogComponent (cover)', () => {
    let cmp: any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [FormsModule, PartialDialogComponent],
            declarations: [PartialDialogCoverHost],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                provideAsWidgetRef(PartialDialogComponent),
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: App, useValue: mockApp },
                { provide: BsModalService, useValue: { show: jest.fn(), onShown: new BehaviorSubject({ id: 1 }), onShow: new BehaviorSubject({}), onHidden: new BehaviorSubject({}), onHide: new BehaviorSubject({}) } },
                { provide: AbstractDialogService, useValue: { addToOpenedDialogs: jest.fn(), getOpenedDialogs: jest.fn(() => []), removeFromOpenedDialogs: jest.fn(), addToClosedDialogs: jest.fn(), removeFromClosedDialogs: jest.fn(), register: jest.fn(), deRegister: jest.fn(), getLastOpenedDialog: jest.fn(), getDialogRefFromClosedDialogs: jest.fn() } }
            ]
        });
        const fixture = TestBed.createComponent(PartialDialogCoverHost);
        fixture.detectChanges();
        cmp = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('uses a static backdrop and disables keyboard close for a modal dialog and keeps the given class', () => {
        expect(cmp.modalOptions.backdrop).toBe('static');
        expect(cmp.modalOptions.keyboard).toBe(false);
        expect(cmp.modalOptions.class).toContain('my-cls');
    });

    it('exposes partial scope members when the partialLoaded event fires and then unsubscribes', () => {
        const unsub = jest.fn();
        let handler: Function;
        cmp.app = { subscribe: jest.fn((evt: string, fn: Function) => { handler = fn; return unsub; }) };
        const widgets = { w: 1 }, variables = { v: 1 }, actions = { a: 1 };
        cmp.partialRef = { nativeElement: { widget: { Widgets: widgets, Variables: variables, Actions: actions } } };
        cmp.setPartialLoadListener();
        expect(cmp.app.subscribe).toHaveBeenCalledWith('partialLoaded', expect.any(Function));
        handler();
        expect(cmp.Widgets).toBe(widgets);
        expect(cmp.Variables).toBe(variables);
        expect(cmp.Actions).toBe(actions);
        expect(unsub).toHaveBeenCalledTimes(1);
        expect(cmp.partialLoadedSubscription).toBeNull();
    });

    it('does not touch scope members or fail when the event fires with no partial and no subscription', () => {
        let handler: Function;
        cmp.app = { subscribe: jest.fn((evt: string, fn: Function) => { handler = fn; return jest.fn(); }) };
        cmp.partialRef = undefined;
        cmp.setPartialLoadListener();
        cmp.partialLoadedSubscription = null;
        expect(() => handler()).not.toThrow();
        expect(cmp.Widgets).toBeUndefined();
    });

    it('releases an existing subscription before registering a new one', () => {
        const old = jest.fn();
        cmp.partialLoadedSubscription = old;
        cmp.app = { subscribe: jest.fn(() => jest.fn()) };
        cmp.setPartialLoadListener();
        expect(old).toHaveBeenCalledTimes(1);
        expect(cmp.app.subscribe).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes on destroy and clears content references', () => {
        const unsub = jest.fn();
        cmp.partialLoadedSubscription = unsub;
        cmp.ngOnDestroy();
        expect(unsub).toHaveBeenCalled();
        expect(cmp.partialRef).toBeNull();
        expect(cmp.dialogContent).toBeNull();
    });
});
