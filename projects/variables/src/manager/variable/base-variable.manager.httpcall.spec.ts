import { Subject } from 'rxjs';
import { setDependency } from '../../util/variable/variables.utils';
import { BaseVariableManager } from './base-variable.manager';

describe('BaseVariableManager - httpCall', () => {
    const manager: any = new (BaseVariableManager as any)();
    let sendCallAsObservable: jest.Mock;
    let isPlatformSessionTimeout: jest.Mock;
    let notify: jest.Mock;

    beforeEach(() => {
        sendCallAsObservable = jest.fn();
        isPlatformSessionTimeout = jest.fn().mockReturnValue(false);
        notify = jest.fn();
        setDependency('http', { sendCallAsObservable, isPlatformSessionTimeout });
        setDependency('appManager', { notify });
    });

    const response = (type: any, track?: string) => ({ type, headers: { get: jest.fn().mockReturnValue(track) } });

    it('resolves with typed responses and remembers the request track id', async () => {
        const source = new Subject<any>();
        sendCallAsObservable.mockReturnValue(source);
        const variable: any = {};
        const promise = manager.httpCall({ url: '/x' }, variable, { p: 1 });
        expect(sendCallAsObservable).toHaveBeenCalledWith({ url: '/x' }, { p: 1 });
        expect(variable._observable).toBeDefined();
        source.next({ noType: true });
        const res = response(4, 'track-1');
        source.next(res);
        await expect(promise).resolves.toBe(res);
        expect(variable._requestTrackId).toBe('track-1');
    });

    it('rejects errors that are not session timeouts', async () => {
        const source = new Subject<any>();
        sendCallAsObservable.mockReturnValue(source);
        const variable: any = {};
        const promise = manager.httpCall({}, variable);
        const err = { headers: { get: jest.fn().mockReturnValue('track-2') } };
        source.error(err);
        await expect(promise).rejects.toBe(err);
        expect(variable._requestTrackId).toBe('track-2');
        expect(notify).not.toHaveBeenCalled();
    });

    describe('session timeouts', () => {
        const timeout = () => {
            const retry = new Subject<any>();
            const source = new Subject<any>();
            sendCallAsObservable.mockReturnValue(source);
            isPlatformSessionTimeout.mockReturnValue(true);
            const variable: any = { name: 'v' };
            const promise = manager.httpCall({}, variable);
            const err: any = { _401Subscriber: retry };
            source.error(err);
            return { retry, promise, variable, err };
        };

        it('notifies the app and resolves with the retried response', async () => {
            const { retry, promise, err } = timeout();
            expect(notify).toHaveBeenCalledWith('toggle-variable-state', expect.objectContaining({ active: false, data: err }));
            retry.next('retried');
            await expect(promise).resolves.toBe('retried');
        });

        it('rejects when the retry fails', async () => {
            const { retry, promise } = timeout();
            retry.error('still failing');
            await expect(promise).rejects.toBe('still failing');
        });
    });

    it('builds callback options with extra info', () => {
        expect(manager.prepareCallbackOptions({ a: 1 })).toEqual({ xhrObj: { a: 1 } });
        expect(manager.prepareCallbackOptions({ a: 1 }, { b: 2 })).toEqual({ xhrObj: { a: 1 }, b: 2 });
    });
});
