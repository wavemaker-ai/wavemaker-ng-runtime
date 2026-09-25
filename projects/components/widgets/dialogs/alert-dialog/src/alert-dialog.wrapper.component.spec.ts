import { Component, NO_ERRORS_SCHEMA, ViewChild, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { AlertDialogComponent } from './alert-dialog.component';
import { Context, provideAsWidgetRef } from '@wm/components/base';
import { By } from '@angular/platform-browser';
import { ITestComponentDef } from 'projects/components/base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AbstractDialogService, App } from '@wm/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

// Mock Services
class MockBsModalService {
    show = jest.fn();
    onShown = new Subject<{ id: number }>();
    onShow = new Subject<any>();
    onHidden = new Subject<any>();
    onHide = new Subject<any>();
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

class MockRouter {
    events = new Subject<any>();
}

const markup = `<div wmAlertDialog></div>`;
@Component({
    standalone: false,
    template: markup
})
class AlertDialogWrapperComponent {
    @ViewChild(AlertDialogComponent, { static: true }) wmComponent: AlertDialogComponent;
}

const testModuleDef = {
    imports: [FormsModule, AlertDialogComponent],
    declarations: [AlertDialogWrapperComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
        provideAsWidgetRef(AlertDialogComponent),
        { provide: Context, useFactory: () => ({}), multi: true },
        { provide: App, useValue: mockApp },
        { provide: BsModalService, useClass: MockBsModalService },
        { provide: AbstractDialogService, useClass: MockAbstractDialogService },
        { provide: Router, useClass: MockRouter }
    ]
};

const componentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-alert-dialog',
    widgetSelector: '[wmAlertDialog]',
    testModuleDef: testModuleDef,
    testComponent: AlertDialogWrapperComponent,
    inputElementSelector: 'div'
};

describe('AlertDialogComponent', () => {
    let wrapperComponent: AlertDialogWrapperComponent;
    let dialogComponent: AlertDialogComponent;
    let fixture: ComponentFixture<AlertDialogWrapperComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule(testModuleDef)
            .compileComponents()
            .then(() => {
                fixture = compileTestComponent(testModuleDef, AlertDialogWrapperComponent);
                wrapperComponent = fixture.componentInstance;
                dialogComponent = wrapperComponent.wmComponent;
                dialogComponent.dialogTemplate = {} as TemplateRef<any>;
                fixture.detectChanges();
            });
    }));

    it('should create alert dialog component', () => {
        expect(wrapperComponent).toBeTruthy();
        expect(dialogComponent).toBeTruthy();
    });

    it('should render the alert dialog component', () => {
        const dialogElement = fixture.debugElement.query(By.css('[wmAlertDialog]'));
        expect(dialogElement).not.toBeNull();
    });
    it('should initialize properties correctly', () => {
        expect(dialogComponent.dialogTemplate).toBeDefined();
    });
    it('should close the dialog correctly', () => {
        const closeSpy = jest.spyOn(dialogComponent, 'close');
        dialogComponent.close();
        expect(closeSpy).toHaveBeenCalled();
    });
    it('should render the dialog dialog component', () => {
        const dialogElement = fixture.debugElement.query(By.css('[wmAlertDialog]'));
        expect(dialogElement).not.toBeNull();
    });

    describe('BaseDialog: open', () => {
        let dialogService: MockAbstractDialogService;
        let bsModal: MockBsModalService;

        beforeEach(() => {
            dialogService = (dialogComponent as any).dialogService;
            bsModal = (dialogComponent as any).bsModal;
        });

        it('should not open again when this dialog is already in the opened list', () => {
            dialogService.getOpenedDialogs.mockReturnValue([dialogComponent]);
            dialogComponent.open();
            expect(dialogService.addToOpenedDialogs).not.toHaveBeenCalled();
            expect(bsModal.show).not.toHaveBeenCalled();
        });

        it('should register itself as opened and show the modal', () => {
            dialogService.getOpenedDialogs.mockReturnValue([]);
            dialogComponent.open();
            expect(dialogService.addToOpenedDialogs).toHaveBeenCalledWith(dialogComponent);
            expect(bsModal.show).toHaveBeenCalledWith((dialogComponent as any).getTemplateRef(), (dialogComponent as any).modalOptions);
        });

        it('should merge the given initState into the widget context', () => {
            dialogService.getOpenedDialogs.mockReturnValue([]);
            dialogComponent.open({ foo: 'bar' });
            expect((dialogComponent as any).context.foo).toEqual('bar');
        });

        it('should set the aria-labelledby modal option to the dialog title id', () => {
            dialogService.getOpenedDialogs.mockReturnValue([]);
            dialogComponent.open();
            expect((dialogComponent as any).modalOptions.ariaLabelledBy).toEqual(dialogComponent.titleId);
        });
    });

    describe('BaseDialog: close', () => {
        it('should hide the modal and mark the dialog as closed when a dialogRef exists', () => {
            const hide = jest.fn();
            (dialogComponent as any).dialogRef = { hide };
            const dialogService: MockAbstractDialogService = (dialogComponent as any).dialogService;
            dialogComponent.close();
            expect(hide).toHaveBeenCalled();
            expect(dialogService.addToClosedDialogs).toHaveBeenCalledWith(dialogComponent);
        });

        it('should do nothing when there is no open dialogRef', () => {
            (dialogComponent as any).dialogRef = undefined;
            const dialogService: MockAbstractDialogService = (dialogComponent as any).dialogService;
            expect(() => dialogComponent.close()).not.toThrow();
            expect(dialogService.addToClosedDialogs).not.toHaveBeenCalled();
        });

        it('should restore focus to the element that had it before the dialog opened', () => {
            const origin = document.createElement('button');
            document.body.appendChild(origin);
            origin.focus();
            (dialogComponent as any).dialogOriginFocusStack = [origin];
            (dialogComponent as any).dialogRef = { hide: jest.fn() };
            const focusSpy = jest.spyOn(origin, 'focus');
            dialogComponent.close();
            expect(focusSpy).toHaveBeenCalled();
            document.body.removeChild(origin);
        });
    });

    describe('BaseDialog: onPropertyChange', () => {
        it('should ignore class/name/tabindex changes without delegating to the base implementation', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(dialogComponent))), 'onPropertyChange');
            (dialogComponent as any).onPropertyChange('class', 'x', 'y');
            (dialogComponent as any).onPropertyChange('name', 'x', 'y');
            (dialogComponent as any).onPropertyChange('tabindex', 'x', 'y');
            expect(superSpy).not.toHaveBeenCalled();
        });

        it('should append the new animation class and strip the old one', () => {
            (dialogComponent as any).modalOptions.class = 'modal-dialog animated fade';
            (dialogComponent as any).onPropertyChange('animation', 'slide', 'fade');
            expect((dialogComponent as any).modalOptions.class).toEqual(expect.stringContaining('animated slide'));
            expect((dialogComponent as any).modalOptions.class).not.toEqual(expect.stringContaining('animated fade'));
        });

        it('should only strip the old animation class when there is no new value', () => {
            (dialogComponent as any).modalOptions.class = 'modal-dialog animated fade';
            (dialogComponent as any).onPropertyChange('animation', undefined, 'fade');
            expect((dialogComponent as any).modalOptions.class).not.toEqual(expect.stringContaining('animated fade'));
        });

        it('should delegate any other property change to the base implementation', () => {
            expect(() => (dialogComponent as any).onPropertyChange('show', true, false)).not.toThrow();
        });
    });

    describe('BaseDialog: bsModal event wiring', () => {
        let dialogService: MockAbstractDialogService;
        let bsModal: MockBsModalService;

        beforeEach(() => {
            dialogService = (dialogComponent as any).dialogService;
            bsModal = (dialogComponent as any).bsModal;
        });

        it('should invoke the opened callback when this dialog is the last opened one and has no dialogId yet', fakeAsync(() => {
            dialogService.getLastOpenedDialog.mockReturnValue(dialogComponent);
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            const container = document.createElement('div');
            container.setAttribute('aria-labelledby', dialogComponent.titleId);
            const input = document.createElement('input');
            container.appendChild(input);
            document.body.appendChild(container);

            bsModal.onShown.next({ id: 42 });
            tick();

            expect(invokeSpy).toHaveBeenCalledWith('opened', { $event: { type: 'opened' } });
            expect((dialogComponent as any).dialogId).toEqual(42);
            document.body.removeChild(container);
        }));

        it('should not invoke the opened callback when this dialog is not the last opened one', fakeAsync(() => {
            dialogService.getLastOpenedDialog.mockReturnValue(undefined);
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            bsModal.onShown.next({ id: 42 });
            tick();
            expect(invokeSpy).not.toHaveBeenCalledWith('opened', expect.anything());
        }));

        it('should clean up and invoke the close callback when this dialog matches the hidden dialog id', () => {
            (dialogComponent as any).dialogId = 7;
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            const closeCallBackFn = jest.fn();
            (dialogComponent as any).closeCallBackFn = closeCallBackFn;
            bsModal.onHidden.next({ id: 7 });
            expect((dialogComponent as any).dialogId).toBeNull();
            expect(dialogService.removeFromOpenedDialogs).toHaveBeenCalledWith(dialogComponent);
            expect(invokeSpy).toHaveBeenCalledWith('close');
            expect(closeCallBackFn).toHaveBeenCalled();
        });

        it('should resolve the ref via the last opened dialog on an escape/backdrop close', () => {
            (dialogComponent as any).dialogId = undefined;
            dialogService.getLastOpenedDialog.mockReturnValue(dialogComponent);
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            bsModal.onHidden.next('esc');
            expect(invokeSpy).toHaveBeenCalledWith('close');
        });

        it('should do nothing when the hidden dialog does not match this dialog', () => {
            (dialogComponent as any).dialogId = 7;
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            bsModal.onHidden.next({ id: 999 });
            expect(invokeSpy).not.toHaveBeenCalledWith('close');
        });

        it('should close the dialog on router NavigationEnd', () => {
            const router: MockRouter = (dialogComponent as any).inj.get(Router);
            const closeSpy = jest.spyOn(dialogComponent, 'close').mockImplementation(() => undefined);
            router.events.next(new NavigationEnd(1, '/a', '/a'));
            expect(closeSpy).toHaveBeenCalled();
        });
    });

    describe('BaseDialog: ngOnDestroy', () => {
        it('should close the dialog and deregister it', () => {
            const closeSpy = jest.spyOn(dialogComponent, 'close');
            const deRegisterSpy = jest.spyOn(dialogComponent as any, 'deRegister');
            dialogComponent.ngOnDestroy();
            expect(closeSpy).toHaveBeenCalled();
            expect(deRegisterSpy).toHaveBeenCalledWith((dialogComponent as any).viewParent);
        });

        it('should unsubscribe from bsModal/router events and clear opened/closed dialog references', () => {
            const dialogService: MockAbstractDialogService = (dialogComponent as any).dialogService;
            dialogComponent.ngOnDestroy();
            expect(dialogService.removeFromOpenedDialogs).toHaveBeenCalledWith(dialogComponent);
            expect(dialogService.removeFromClosedDialogs).toHaveBeenCalledWith(dialogComponent);
        });

        it('should clear the dialogTemplate ViewChild reference to avoid memory leaks', () => {
            expect(dialogComponent.dialogTemplate).toBeDefined();
            dialogComponent.ngOnDestroy();
            expect(dialogComponent.dialogTemplate).toBeNull();
        });
    });

    describe('AlertDialogComponent: onOk', () => {
        it('should invoke the ok event callback with the originating event', () => {
            const invokeSpy = jest.spyOn(dialogComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            const clickEvent = new Event('click');
            dialogComponent.onOk(clickEvent);
            expect(invokeSpy).toHaveBeenCalledWith('ok', { $event: clickEvent });
        });
    });

    describe('AlertDialogComponent: ngOnInit alerttype mapping', () => {
        // ngOnInit can only run once per instance (base setInitProps clears its one-time
        // initState after first use), so each case gets its own component via a markup
        // attribute rather than re-invoking ngOnInit() on the shared dialogComponent.
        const createWithAlertType = (alerttype: string): AlertDialogComponent => {
            const markupWithAlertType = `<div wmAlertDialog alerttype="${alerttype}"></div>`;

            @Component({
                standalone: false,
                template: markupWithAlertType
            })
            class AlertTypeWrapperComponent {
                @ViewChild(AlertDialogComponent, { static: true }) wmComponent: AlertDialogComponent;
            }

            const alertTypeTestModuleDef = {
                imports: [FormsModule, AlertDialogComponent],
                declarations: [AlertTypeWrapperComponent],
                schemas: [NO_ERRORS_SCHEMA],
                providers: [
                    provideAsWidgetRef(AlertDialogComponent),
                    { provide: Context, useFactory: () => ({}), multi: true },
                    { provide: App, useValue: mockApp },
                    { provide: BsModalService, useClass: MockBsModalService },
                    { provide: AbstractDialogService, useClass: MockAbstractDialogService },
                    { provide: Router, useClass: MockRouter }
                ]
            };

            TestBed.resetTestingModule();
            const alertTypeFixture = compileTestComponent(alertTypeTestModuleDef, AlertTypeWrapperComponent);
            const component = alertTypeFixture.componentInstance.wmComponent;
            component.dialogTemplate = {} as TemplateRef<any>;
            alertTypeFixture.detectChanges();
            return component;
        };

        it('should map a known alerttype to its corresponding style class via alertMap', () => {
            expect(createWithAlertType('information').alerttype).toEqual('info');
        });

        it('should map the success alerttype to the success style class', () => {
            expect(createWithAlertType('success').alerttype).toEqual('success');
        });

        it('should leave an alerttype unchanged when it has no entry in alertMap', () => {
            expect(createWithAlertType('custom-unmapped-type').alerttype).toEqual('custom-unmapped-type');
        });
    });

    describe('AlertDialogComponent: constructor attribute handling (modal/closable/class)', () => {
        const attrMarkup = `<div wmAlertDialog modal="true" closable="false" class="custom-alert-class"></div>`;

        @Component({
            standalone: false,
            template: attrMarkup
        })
        class AlertDialogAttrWrapperComponent {
            @ViewChild(AlertDialogComponent, { static: true }) wmComponent: AlertDialogComponent;
        }

        const attrTestModuleDef = {
            imports: [FormsModule, AlertDialogComponent],
            declarations: [AlertDialogAttrWrapperComponent],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                provideAsWidgetRef(AlertDialogComponent),
                { provide: Context, useFactory: () => ({}), multi: true },
                { provide: App, useValue: mockApp },
                { provide: BsModalService, useClass: MockBsModalService },
                { provide: AbstractDialogService, useClass: MockAbstractDialogService },
                { provide: Router, useClass: MockRouter }
            ]
        };

        let attrFixture: ComponentFixture<AlertDialogAttrWrapperComponent>;
        let attrDialogComponent: AlertDialogComponent;

        beforeEach(waitForAsync(() => {
            TestBed.resetTestingModule();
            TestBed.configureTestingModule(attrTestModuleDef)
                .compileComponents()
                .then(() => {
                    attrFixture = compileTestComponent(attrTestModuleDef, AlertDialogAttrWrapperComponent);
                    attrDialogComponent = attrFixture.componentInstance.wmComponent;
                    attrDialogComponent.dialogTemplate = {} as TemplateRef<any>;
                    attrFixture.detectChanges();
                });
        }));

        it('should set backdrop to static and disable keyboard close when the modal attribute is truthy', () => {
            expect((attrDialogComponent as any).modalOptions.backdrop).toEqual('static');
            expect((attrDialogComponent as any).modalOptions.keyboard).toEqual(false);
        });

        it('should append the provided class attribute onto the dialog class list', () => {
            expect((attrDialogComponent as any).modalOptions.class).toEqual(expect.stringContaining('custom-alert-class'));
        });
    });
});
