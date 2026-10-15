import { SpinnerServiceImpl } from './spinner.service';

declare const $;

describe('SpinnerServiceImpl', () => {
    let service: SpinnerServiceImpl;
    let emitted: any[];

    beforeEach(() => {
        service = new SpinnerServiceImpl();
        emitted = [];
        service.getMessageSource().subscribe(v => emitted.push(v));
        document.body.innerHTML = '<div name="ctx"></div><div name="other"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('app spinner', () => {
        it('generates incrementing ids and emits the visible messages', () => {
            expect(service.show('one')).toBe(1);
            expect(service.show('two')).toBe(2);
            expect(emitted[1]).toEqual({ show: true, message: 'two', messages: ['one', 'two'] });
        });

        it('uses the page context explicitly or when none is given, and keeps a supplied id', () => {
            expect(service.show('m', 'my-id', 'cls', 'page')).toBe('my-id');
            expect(emitted[0].messages).toEqual(['m']);
        });

        it('hide removes a message and hides when none are left', () => {
            service.show('one', 'a');
            service.show('two', 'b');
            service.hide('a');
            expect(emitted[emitted.length - 1]).toEqual({ show: true, messages: ['two'] });
            service.hide('b');
            expect(emitted[emitted.length - 1]).toEqual({ show: false, messages: [] });
        });

        it('hide without an id resets the page messages without emitting', () => {
            service.show('one', 'a');
            const count = emitted.length;
            service.hide(undefined);
            expect(emitted.length).toBe(count);
            expect(service.messagesByContext['page']).toEqual({});
        });
    });

    describe('context spinner', () => {
        it('prepends a spinner to the context element', () => {
            expect(service.show('Loading', 'id1', 'cls', 'ctx')).toBe('id1');
            const el = document.querySelector('[name="ctx"]');
            expect(el.querySelector('.app-spinner')).not.toBeNull();
            expect(el.querySelector('.spinner-messages-container').innerHTML).toBe('Loading');
            expect(emitted).toHaveLength(0);
        });

        it('appends further messages to the existing spinner', () => {
            service.show('One', 'id1', '', 'ctx');
            service.show('Two', 'id2', '', 'ctx');
            expect(document.querySelectorAll('[name="ctx"] .app-spinner')).toHaveLength(1);
            expect(document.querySelector('[name="ctx"] .spinner-messages-container').innerHTML).toBe('One Two');
        });

        it('hide removes the spinner and resets the context when only the final message is left', () => {
            service.show('One', 'id1', '', 'ctx');
            service.hide('id1');
            expect(document.querySelector('[name="ctx"] .app-spinner')).toBeNull();
            expect(service.messagesByContext['ctx']).toEqual({});
        });

        it('keeps the context state while other messages remain', () => {
            service.show('One', 'id1', '', 'ctx');
            service.show('Two', 'id2', '', 'ctx');
            service.hide('id1');
            expect(Object.keys(service.messagesByContext['ctx'])).toContain('id2');
        });
    });

    describe('ngOnDestroy', () => {
        it('completes the subject and clears messages', () => {
            const done = jest.fn();
            service.getMessageSource().subscribe({ complete: done });
            service.show('x', 'a');
            service.ngOnDestroy();
            expect(done).toHaveBeenCalled();
            expect(service.messageSource).toBeNull();
            expect(service.messagesByContext).toBeNull();
        });

        it('is safe to call twice', () => {
            service.ngOnDestroy();
            expect(() => service.ngOnDestroy()).not.toThrow();
        });
    });
});
