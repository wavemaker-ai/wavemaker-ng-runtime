import { Component, NO_ERRORS_SCHEMA, ViewChild, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { Context, provideAsWidgetRef } from '@wm/components/base';
import { By } from '@angular/platform-browser';
import { ITestComponentDef } from 'projects/components/base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AbstractDialogService, App } from '@wm/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BehaviorSubject } from 'rxjs';

// Mock Services
class MockBsModalService {
    show = jest.fn();
    onShown = new BehaviorSubject({ id: 1 });
    onShow = new BehaviorSubject({});
    onHidden = new BehaviorSubject({});
    onHide = new BehaviorSubject({});
}

class MockAbstractDialogService {
    addToOpenedDialogs = jest.fn();
    getOpenedDialogs = jest.fn(() => []);
    removeFromOpenedDialogs = jest.fn();
    addToClosedDialogs = jest.fn();
    removeFromClosedDialogs = jest.fn();
    register = jest.fn();
    deRegister = jest.fn();
    getLastOpenedDialog = jest.fn();
    getDialogRefFromClosedDialogs = jest.fn();
}

const markup = `<div wmConfirmDialog></div>`;

@Component({
    standalone: false,
    template: markup
})
class ConfirmDialogWrapperComponent {
    @ViewChild(ConfirmDialogComponent, { static: true }) wmComponent: ConfirmDialogComponent;
}

const testModuleDef = {
    imports: [FormsModule, ConfirmDialogComponent],
    declarations: [ConfirmDialogWrapperComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
        provideAsWidgetRef(ConfirmDialogComponent),
        { provide: Context, useFactory: () => ({}), multi: true },
        { provide: App, useValue: mockApp },
        { provide: BsModalService, useClass: MockBsModalService },
        { provide: AbstractDialogService, useClass: MockAbstractDialogService }
    ]
};


describe('ConfirmDialogComponent - additional behaviour', () => {
    let fixture: ComponentFixture<ConfirmDialogWrapperComponent>;
    let cmp: any;

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, ConfirmDialogWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('raises the ok and cancel events', () => {
        const spy = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
        const $event = new Event('click');
        cmp.onOk($event);
        cmp.onCancel($event);
        expect(spy).toHaveBeenCalledWith('ok', { $event });
        expect(spy).toHaveBeenCalledWith('cancel', { $event });
    });

    it('ignores the escape key itself', () => {
        expect(cmp.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }))).toBeUndefined();
    });

    it('provides its dialog template', () => {
        expect(cmp.getTemplateRef()).toBe(cmp.dialogTemplate);
        expect(cmp.dialogTemplate).toBeDefined();
    });

    it('registers with its view parent on init', () => {
        const register = jest.spyOn(cmp, 'register').mockImplementation(() => undefined);
        jest.spyOn(Object.getPrototypeOf(ConfirmDialogComponent.prototype), 'ngOnInit').mockImplementation(() => undefined);
        cmp.ngOnInit();
        expect(register).toHaveBeenCalledWith(cmp.viewParent);
    });

    it('releases the dialog template on destroy', () => {
        cmp.ngOnDestroy();
        expect(cmp.dialogTemplate).toBeNull();
    });
});
