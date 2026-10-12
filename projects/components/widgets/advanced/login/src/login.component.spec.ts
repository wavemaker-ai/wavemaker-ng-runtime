import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractI18nService, App } from '@wm/core';
import { mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { LoginComponent } from './login.component';

const makeButton = (attrs: Record<string, string> = {}, classes: string[] = []) => {
    const el = document.createElement('button');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.classList.add(...classes);
    return { getNativeElement: () => el, el } as any;
};

const makeForm = (valid = true, dataoutput: any = { username: 'u', password: 'p' }) => {
    const el = document.createElement('form');
    return { getNativeElement: () => el, el, ngform: { valid }, dataoutput } as any;
};

describe('LoginComponent', () => {
    let fixture: ComponentFixture<LoginComponent>;
    let login: any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [LoginComponent],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService }
            ]
        });
        fixture = TestBed.createComponent(LoginComponent);
        login = fixture.componentInstance;
        // no change detection here: the content queries (form, buttons) would be reset to
        // undefined, so the lifecycle hooks are driven manually from the tests
        login.formCmp = makeForm();
        login.buttonComponents = { forEach: () => {} };
        login.appLocale = { LABEL_INVALID_USERNAME_OR_PASSWORD: 'Invalid credentials' };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    it('creates the login widget with a message component', () => {
        expect(login.messageCmp).toBeDefined();
        expect(login.nativeElement).toBeDefined();
    });

    describe('callbacks', () => {
        it('fires the success event', () => {
            const spy = jest.spyOn(login, 'invokeEventCallback');
            login.onSuccessCB();
            expect(spy).toHaveBeenCalledWith('success');
        });

        it('shows an error message, preferring the configured message, then the error, then the default', () => {
            const show = jest.spyOn(login.messageCmp, 'showMessage').mockImplementation(() => {});
            const spy = jest.spyOn(login, 'invokeEventCallback');

            login.errormessage = 'Configured';
            login.onErrorCB('From server');
            expect(show).toHaveBeenLastCalledWith('Configured', 'error');

            login.errormessage = undefined;
            login.onErrorCB('From server');
            expect(show).toHaveBeenLastCalledWith('From server', 'error');

            login.onErrorCB();
            expect(show).toHaveBeenLastCalledWith('Invalid credentials', 'error');
            expect(login.loginMessage).toEqual({ type: 'error', caption: 'Invalid credentials', show: true });
            expect(spy).toHaveBeenCalledWith('error');
        });

        it('returns the form output as login details', () => {
            expect(login.getLoginDetails()).toEqual({ username: 'u', password: 'p' });
        });
    });

    describe('doLogin', () => {
        it('invokes the login action with the details when the form is valid', () => {
            const invoke = jest.fn();
            login.eventsource = { invoke };
            login.doLogin();
            expect(invoke).toHaveBeenCalledWith({ loginInfo: { username: 'u', password: 'p' } }, expect.any(Function), expect.any(Function));
            const [, onSuccess, onError] = invoke.mock.calls[0];
            const success = jest.spyOn(login, 'invokeEventCallback');
            onSuccess();
            expect(success).toHaveBeenCalledWith('success');
            jest.spyOn(login.messageCmp, 'showMessage').mockImplementation(() => {});
            onError('boom');
            expect(success).toHaveBeenCalledWith('error');
        });

        it('does not invoke the action for an invalid form', () => {
            const invoke = jest.fn();
            login.eventsource = { invoke };
            login.formCmp = makeForm(false);
            login.doLogin();
            expect(invoke).not.toHaveBeenCalled();
        });

        it('warns when there is no login action', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            login.eventsource = undefined;
            login.doLogin();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('loginAction'));
        });
    });

    describe('login button wiring', () => {
        const wire = (buttons: any[]) => {
            login.buttonComponents = { forEach: (fn: (b: any) => void) => buttons.forEach(fn) };
            login.ngAfterViewInit();
        };

        it('prevents the default form submission', () => {
            wire([]);
            const evt = new Event('submit', { cancelable: true });
            login.formCmp.el.dispatchEvent(evt);
            expect(evt.defaultPrevented).toBe(true);
        });

        it('finds the login button by name or class and only wires the first match', () => {
            const byName = makeButton({ name: 'loginButton' });
            const byClass = makeButton({}, ['app-login-button']);
            const other = makeButton({ name: 'other' });
            wire([other, byName, byClass]);
            expect(login.loginBtnCmp).toBe(byName);
        });

        it('wires a class-matched button too', () => {
            const byClass = makeButton({}, ['app-login-button']);
            wire([byClass]);
            expect(login.loginBtnCmp).toBe(byClass);
        });

        it('runs the default login on click when no custom handler is attached', () => {
            const btn = makeButton({ name: 'loginButton' });
            const doLogin = jest.spyOn(login, 'doLogin').mockImplementation(() => {});
            wire([btn]);
            btn.el.click();
            expect(doLogin).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['the login widget has a submit event', (btn: any) => login.nativeElement.setAttribute('submit.event', 'x')],
            ['the button has a click event', (btn: any) => btn.el.setAttribute('click.event', 'x')],
            ['the button has a tap event', (btn: any) => btn.el.setAttribute('tap.event', 'x')]
        ])('skips the default login when %s', (_name, attach) => {
            const btn = makeButton({ name: 'loginButton' });
            const doLogin = jest.spyOn(login, 'doLogin').mockImplementation(() => {});
            wire([btn]);
            attach(btn);
            btn.el.click();
            expect(doLogin).not.toHaveBeenCalled();
            login.nativeElement.removeAttribute('submit.event');
        });
    });

    describe('destroy', () => {
        it('removes listeners and releases references', () => {
            const btn = makeButton({ name: 'loginButton' });
            login.buttonComponents = { forEach: (fn: any) => fn(btn) };
            login.ngAfterViewInit();
            const removeBtn = jest.spyOn(btn.el, 'removeEventListener');
            const removeForm = jest.spyOn(login.formCmp.el, 'removeEventListener');
            fixture.destroy();
            expect(removeBtn).toHaveBeenCalledWith('click', expect.any(Function));
            expect(removeForm).toHaveBeenCalledWith('submit', expect.any(Function));
            expect(login.loginBtnCmp).toBeNull();
            expect(login.formCmp).toBeNull();
            expect(login.messageCmp).toBeNull();
        });

        it('is safe when nothing was wired', () => {
            login.formCmp = undefined;
            expect(() => fixture.destroy()).not.toThrow();
        });
    });
});
