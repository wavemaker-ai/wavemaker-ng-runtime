import { Subject } from 'rxjs';
import { setDependency } from '../../util/variable/variables.utils';
import { BaseVariableManager } from './base-variable.manager';

describe('BaseVariableManager - httpCall already-closed 401 subscription', () => {
    const manager: any = new (BaseVariableManager as any)();

    const setup = () => {
        const source = new Subject<any>();
        setDependency('http', { sendCallAsObservable: jest.fn().mockReturnValue(source), isPlatformSessionTimeout: jest.fn().mockReturnValue(true) });
        setDependency('appManager', { notify: jest.fn() });
        let onNext: any, onErr: any;
        const sub = { closed: true, unsubscribe: jest.fn() };
        const retry = { asObservable: () => ({ subscribe: (n: any, e: any) => { onNext = n; onErr = e; return sub; } }) };
        const promise = manager.httpCall({}, {});
        source.error({ _401Subscriber: retry });
        return { promise, sub, next: (v: any) => onNext(v), fail: (v: any) => onErr(v) };
    };

    it('resolves without unsubscribing a closed subscription', async () => {
        const { promise, sub, next } = setup();
        next('ok');
        await expect(promise).resolves.toBe('ok');
        expect(sub.unsubscribe).not.toHaveBeenCalled();
    });

    it('rejects without unsubscribing a closed subscription', async () => {
        const { promise, sub, fail } = setup();
        fail('bad');
        await expect(promise).rejects.toBe('bad');
        expect(sub.unsubscribe).not.toHaveBeenCalled();
    });
});
