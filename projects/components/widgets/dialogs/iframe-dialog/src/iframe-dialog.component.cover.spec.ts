import { Component, NO_ERRORS_SCHEMA, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IframeDialogComponent } from './iframe-dialog.component';
import { Context, provideAsWidgetRef } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AbstractDialogService, App } from '@wm/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BehaviorSubject } from 'rxjs';

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

@Component({
    standalone: false,
    template: `<div wmIframeDialog class="custom-cls" modal="true" closable="false"></div>`
})
class ModalHostComponent {
    @ViewChild(IframeDialogComponent, { static: true }) wmComponent: IframeDialogComponent;
}

@Component({
    standalone: false,
    template: `<div wmIframeDialog></div>`
})
class DefaultHostComponent {
    @ViewChild(IframeDialogComponent, { static: true }) wmComponent: IframeDialogComponent;
}

describe('IframeDialogComponent cover', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [FormsModule, IframeDialogComponent],
            declarations: [ModalHostComponent, DefaultHostComponent],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                provideAsWidgetRef(IframeDialogComponent),
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: App, useValue: mockApp },
                { provide: BsModalService, useClass: MockBsModalService },
                { provide: AbstractDialogService, useClass: MockAbstractDialogService }
            ]
        });
    });

    it('uses a static backdrop and disables keyboard close when modal attribute is provided', () => {
        const fixture = TestBed.createComponent(ModalHostComponent);
        fixture.detectChanges();
        const dlg: any = fixture.componentInstance.wmComponent;
        expect(dlg.modalOptions.backdrop).toBe('static');
        expect(dlg.modalOptions.keyboard).toBe(false);
        expect(dlg.modalOptions.class).toContain('custom-cls');
        expect(dlg.modalOptions.class).toContain('app-iframe-dialog');
    });

    it('defaults to a closable, non-modal dialog when attributes are absent', () => {
        const fixture = TestBed.createComponent(DefaultHostComponent);
        fixture.detectChanges();
        const dlg: any = fixture.componentInstance.wmComponent;
        expect(dlg.modalOptions.backdrop).toBe(true);
        expect(dlg.modalOptions.keyboard).toBe(true);
    });
});
