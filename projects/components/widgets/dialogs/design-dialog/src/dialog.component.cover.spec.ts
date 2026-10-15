import { Component, NO_ERRORS_SCHEMA, ViewChild, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { DialogComponent } from './dialog.component';
import { Context, provideAsDialogRef, provideAsWidgetRef } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AbstractDialogService, App } from '@wm/core';
import { BsModalService } from 'ngx-bootstrap/modal';

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
    template: `<div wmDialog class="custom" modal="false" closable="false" sheet="true" sheetposition="right"></div>`
})
class CoverDialogHostComponent {
    @ViewChild(DialogComponent, { static: true }) wmComponent: DialogComponent;
}

const moduleDef = {
    imports: [FormsModule, DialogComponent],
    declarations: [CoverDialogHostComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
        provideAsWidgetRef(DialogComponent),
        provideAsDialogRef(DialogComponent),
        { provide: Context, useFactory: () => ({}), multi: true },
        { provide: App, useValue: mockApp },
        { provide: BsModalService, useClass: MockBsModalService },
        { provide: AbstractDialogService, useClass: MockAbstractDialogService }
    ]
};

describe('DialogComponent: coverage gaps', () => {
    let fixture: ComponentFixture<CoverDialogHostComponent>;
    let dialog: any;

    beforeEach(() => {
        TestBed.configureTestingModule(moduleDef);
        fixture = compileTestComponent(moduleDef, CoverDialogHostComponent);
        dialog = fixture.componentInstance.wmComponent;
        dialog.dialogTemplate = {} as TemplateRef<any>;
        fixture.detectChanges();
    });

    it('honours explicit modal/closable attributes and sheet settings', () => {
        expect(dialog.sheet).toBeTruthy();
        expect(dialog.sheetPosition).toBe('right');
        // modal=false -> backdrop true; closable=false with modal=false -> keyboard true
        expect(dialog.modalOptions.backdrop).toBe(true);
        expect(dialog.modalOptions.keyboard).toBe(true);
        expect(dialog.modalOptions.class).toContain('custom');
    });

    it('exposes a closeDialog context function that closes the dialog', () => {
        const contexts: any[] = fixture.debugElement.children[0].injector.get(Context as any) as any;
        const close = jest.spyOn(dialog, 'close').mockImplementation(() => undefined);
        contexts[0].closeDialog();
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('reacts to sheetposition, sheet and title property changes', () => {
        dialog.onPropertyChange('sheetposition', 'left');
        expect(dialog.sheetPosition).toBe('left');
        dialog.onPropertyChange('sheet', false);
        expect(dialog.sheet).toBe(false);
        dialog.onPropertyChange('title', 'Hello');
        expect(dialog.nativeElement.getAttribute('title')).toBe('Hello');
    });
});
