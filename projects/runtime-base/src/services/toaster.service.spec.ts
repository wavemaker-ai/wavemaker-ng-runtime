jest.mock('../components/custom-toaster.component', () => ({ CustomToasterComponent: class CustomToasterComponent {} }));

import { CustomToasterComponent } from '../components/custom-toaster.component';
import { ToasterServiceImpl } from './toaster.service';

describe('ToasterServiceImpl', () => {
    let toastr: any;
    let service: ToasterServiceImpl;

    beforeEach(() => {
        toastr = {
            success: jest.fn(() => 'ok'),
            error: jest.fn(),
            info: jest.fn(),
            warning: jest.fn(),
            show: jest.fn(() => 'shown'),
            clear: jest.fn(),
            toastrConfig: { maxOpened: 5, keep: 'me' }
        };
        service = new ToasterServiceImpl(toastr);
    });

    describe('typed helpers', () => {
        it.each([
            ['success', 'success', 5000],
            ['error', 'error', 0],
            ['info', 'info', 0],
            ['warn', 'warning', 0]
        ])('%s calls toastr.%s with timeOut %d', (method, fn, timeOut) => {
            (service as any)[method]('Title', 'Desc');
            expect(toastr[fn]).toHaveBeenCalledWith('Desc', 'Title', {
                timeOut,
                enableHtml: false,
                positionClass: 'toast-bottom-right',
                toastClass: 'toast'
            });
        });

        it('returns the toastr result', () => {
            expect(service.success('t', 'd')).toBe('ok');
        });
    });

    describe('show', () => {
        it('accepts a numeric timeout as the 4th argument (legacy)', () => {
            service.show('success', 't', 'd', 1234);
            expect(toastr.success.mock.calls[0][2].timeOut).toBe(1234);
        });

        it('applies defaults when no options are given', () => {
            service.show('info', 't', 'd', undefined);
            expect(toastr.info).toHaveBeenCalledWith('d', 't', expect.objectContaining({ timeOut: 0, positionClass: 'toast-bottom-right' }));
        });

        it('keeps supplied position and timeout, and flags html when defined', () => {
            service.show('info', 't', 'd', { timeOut: 10, positionClass: 'toast-top-left', enableHtml: true });
            expect(toastr.info).toHaveBeenCalledWith('d', 't', expect.objectContaining({
                timeOut: 10, positionClass: 'toast-top-left', enableHtml: true
            }));
        });

        it('stringifies object descriptions unless a body output type is given', () => {
            service.show('info', 't', { a: 1 } as any, {});
            expect(toastr.info.mock.calls[0][0]).toBe('{"a":1}');
            const obj = { a: 2 };
            service.show('info', 't', obj as any, { bodyOutputType: 'x' });
            expect(toastr.info.mock.calls[1][0]).toBe(obj);
        });

        it('does nothing without a title and description', () => {
            expect(service.show('info', '', '', {})).toBeUndefined();
            expect(toastr.info).not.toHaveBeenCalled();
        });

        it('shows with only a title or only a description', () => {
            service.show('info', 't', '', {});
            service.show('info', '', 'd', {});
            expect(toastr.info).toHaveBeenCalledTimes(2);
        });

        it('ignores unknown toast types', () => {
            expect(service.show('nope', 't', 'd', {})).toBeUndefined();
        });
    });

    describe('hide', () => {
        it('clears all toasts without an argument', () => {
            service.hide(null);
            expect(toastr.clear).toHaveBeenCalledWith();
        });

        it('clears a specific toast by id', () => {
            service.hide({ toastId: 7 });
            expect(toastr.clear).toHaveBeenCalledWith(7);
        });
    });

    describe('showCustom', () => {
        it('does nothing without a page', () => {
            expect(service.showCustom(null, {})).toBeUndefined();
            expect(toastr.show).not.toHaveBeenCalled();
        });

        it('shows a custom toast component with defaults', () => {
            expect(service.showCustom('Page', undefined)).toBe('shown');
            expect(toastr.show).toHaveBeenCalledWith('Page', '', expect.objectContaining({
                toastComponent: CustomToasterComponent,
                toastClass: 'toast',
                timeOut: 0,
                enableHtml: false,
                positionClass: 'toast-bottom-right'
            }));
        });

        it('keeps supplied options', () => {
            service.showCustom('Page', { timeOut: 9, positionClass: 'toast-top-right', enableHtml: 1 });
            expect(toastr.show.mock.calls[0][2]).toEqual(expect.objectContaining({ timeOut: 9, positionClass: 'toast-top-right', enableHtml: true }));
        });
    });

    describe('setToasterConfig', () => {
        it('merges valid options into the global config', () => {
            service.setToasterConfig({ maxOpened: 1 });
            expect(toastr.toastrConfig).toEqual({ maxOpened: 1, keep: 'me' });
        });

        it('warns for invalid options', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            service.setToasterConfig('bad');
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });
    });
});
