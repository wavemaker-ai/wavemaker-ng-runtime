import { Subject } from 'rxjs';

const mockDigest = jest.fn();
jest.mock('@wm/core', () => ({ ...jest.requireActual('@wm/core'), $appDigest: (...a) => mockDigest(...a) }));

import { LoginDialogDirective } from './login-dialog.directive';

declare const $;

describe('LoginDialogDirective', () => {
    let contexts: any[];
    let dialogRef: any;
    let shown: Subject<any>;
    let directive: any;
    let message: any;

    beforeEach(() => {
        jest.useFakeTimers();
        mockDigest.mockClear();
        shown = new Subject();
        contexts = [{}];
        dialogRef = { bsModal: { onShown: shown }, $element: $('<div><input class="app-textbox"></div>'), eventsource: { invoke: jest.fn() } };
        directive = new LoginDialogDirective(contexts, dialogRef);
        message = { hideMessage: jest.fn(), showMessage: jest.fn() };
        directive.msgCmp = message;
        directive.formCmp = { first: { dataoutput: { j_username: 'u', j_password: 'p' } } };
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('exposes doLogin on the dialog context', () => {
        const spy = jest.spyOn(directive, 'doLogin').mockImplementation(() => {});
        contexts[0].doLogin();
        expect(spy).toHaveBeenCalled();
    });

    describe('messages', () => {
        it('shows and hides messages through the message component', () => {
            directive.showLoading();
            expect(message.showMessage).toHaveBeenCalledWith('Loading...', 'loading');
            directive.showError('bad');
            expect(message.showMessage).toHaveBeenCalledWith('bad', 'error');
            directive.onError('worse');
            expect(message.showMessage).toHaveBeenCalledWith('worse', 'error');
            directive.onSuccess();
            expect(message.hideMessage).toHaveBeenCalled();
        });

        it('tolerates a missing message component', () => {
            directive.msgCmp = undefined;
            expect(() => { directive.hideMsg(); directive.showError('x'); directive.showLoading(); directive.onSuccess(); directive.onError(); }).not.toThrow();
        });
    });

    describe('doLogin', () => {
        it('reads the login details from the first form', () => {
            expect(directive.getLoginDetails()).toEqual({ j_username: 'u', j_password: 'p' });
        });

        it('invokes the login action with success and error handlers', () => {
            directive.doLogin();
            expect(message.showMessage).toHaveBeenCalledWith('Loading...', 'loading');
            const [args, onSuccess, onError] = dialogRef.eventsource.invoke.mock.calls[0];
            expect(args).toEqual({ loginInfo: { j_username: 'u', j_password: 'p' } });
            onSuccess();
            expect(message.hideMessage).toHaveBeenCalled();
            onError('nope');
            expect(message.showMessage).toHaveBeenCalledWith('nope', 'error');
        });

        it.each([
            ['no username', { j_password: 'p' }],
            ['no password', { j_username: 'u' }]
        ])('does nothing with %s', (_n, output) => {
            directive.formCmp = { first: { dataoutput: output } };
            directive.doLogin();
            expect(dialogRef.eventsource.invoke).not.toHaveBeenCalled();
        });

        it('does nothing without an event source', () => {
            dialogRef.eventsource = undefined;
            directive.doLogin();
            expect(message.showMessage).not.toHaveBeenCalled();
        });
    });

    describe('enter key handling', () => {
        it('submits the login form on Enter after the dialog is shown', () => {
            const doLogin = jest.spyOn(directive, 'doLogin').mockImplementation(() => {});
            directive.ngAfterViewInit();
            shown.next(null);
            jest.advanceTimersByTime(10);
            const input = dialogRef.$element.find('.app-textbox');
            input.trigger($.Event('keypress', { which: 65 }));
            expect(doLogin).not.toHaveBeenCalled();
            const enter = $.Event('keypress', { which: 13 });
            input.trigger(enter);
            expect(doLogin).toHaveBeenCalledTimes(1);
            expect(mockDigest).toHaveBeenCalled();
            expect(enter.isPropagationStopped()).toBe(true);
        });

        it('stops listening for dialog events on destroy', () => {
            directive.ngAfterViewInit();
            expect(shown.observed).toBe(true);
            directive.ngOnDestroy();
            expect(shown.observed).toBe(false);
        });
    });
});
