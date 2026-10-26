import { Component, NO_ERRORS_SCHEMA, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { Context, provideAsWidgetRef } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
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
    template: `<div wmConfirmDialog class="my-cls" modal="true" closable="false"></div>`
})
class HostComponent {
    @ViewChild(ConfirmDialogComponent, { static: true }) wmComponent: ConfirmDialogComponent;
}

describe('ConfirmDialogComponent - explicit modal/closable attributes', () => {
    it('uses the provided class and disables keyboard dismissal when modal', () => {
        const fixture = compileTestComponent({
            imports: [FormsModule, ConfirmDialogComponent],
            declarations: [HostComponent],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                provideAsWidgetRef(ConfirmDialogComponent),
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: App, useValue: mockApp },
                { provide: BsModalService, useClass: MockBsModalService },
                { provide: AbstractDialogService, useClass: MockAbstractDialogService }
            ]
        }, HostComponent);
        fixture.detectChanges();
        const opts = (fixture.componentInstance.wmComponent as any).modalOptions;
        expect(opts.keyboard).toBe(false);
        expect(opts.backdrop).toBe('static');
        expect(opts.class).toContain('my-cls');
        expect(opts.class).toContain('app-confirm-dialog');
    });
});
