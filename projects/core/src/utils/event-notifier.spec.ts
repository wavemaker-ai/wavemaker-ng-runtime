import { EventNotifier } from './event-notifier';

describe('EventNotifier', () => {
    describe('constructor', () => {
        it('should start immediately by default', () => {
            const notifier = new EventNotifier();
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 1, 2);
            expect(cb).toHaveBeenCalledWith(1, 2);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('should not start automatically when constructed with start=false', () => {
            const notifier = new EventNotifier(false);
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 'x');
            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe('notify / start', () => {
        it('should queue events fired before start and flush them once started', () => {
            const notifier = new EventNotifier(false);
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 'queued');
            expect(cb).not.toHaveBeenCalled();
            notifier.start();
            expect(cb).toHaveBeenCalledWith('queued');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('should be a no-op to call start twice', () => {
            const notifier = new EventNotifier(false);
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 'once');
            notifier.start();
            notifier.start();
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('should only notify subscribers listening for the matching event name', () => {
            const notifier = new EventNotifier();
            const cbA = jest.fn();
            const cbB = jest.fn();
            notifier.subscribe('a', cbA);
            notifier.subscribe('b', cbB);
            notifier.notify('a', 1);
            expect(cbA).toHaveBeenCalledWith(1);
            expect(cbA).toHaveBeenCalledTimes(1);
            expect(cbB).not.toHaveBeenCalled();
        });

        it('should support multiple data arguments', () => {
            const notifier = new EventNotifier();
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 1, 'two', { three: 3 });
            expect(cb).toHaveBeenCalledWith(1, 'two', { three: 3 });
            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe('subscribe', () => {
        it('should return a function that unsubscribes the listener', () => {
            const notifier = new EventNotifier();
            const cb = jest.fn();
            const unsubscribe = notifier.subscribe('evt', cb);
            unsubscribe();
            notifier.notify('evt', 1);
            expect(cb).not.toHaveBeenCalled();
        });

        it('should return a no-op function when eventName or callback is missing', () => {
            const notifier = new EventNotifier();
            const unsubscribe1 = notifier.subscribe('', jest.fn());
            const unsubscribe2 = notifier.subscribe('evt', undefined as any);
            expect(() => unsubscribe1()).not.toThrow();
            expect(() => unsubscribe2()).not.toThrow();
        });

        it('should support multiple independent subscribers to the same event', () => {
            const notifier = new EventNotifier();
            const cb1 = jest.fn();
            const cb2 = jest.fn();
            notifier.subscribe('evt', cb1);
            notifier.subscribe('evt', cb2);
            notifier.notify('evt', 'x');
            expect(cb1).toHaveBeenCalledWith('x');
            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledWith('x');
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('destroy', () => {
        it('should complete the subject so direct emissions after destroy are not delivered', () => {
            const notifier = new EventNotifier();
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.destroy();
            (notifier as any)._subject.next({ name: 'evt', data: ['direct'] });
            expect(cb).not.toHaveBeenCalled();
        });

        it('should reset the initialized flag and pending queue', () => {
            const notifier = new EventNotifier();
            notifier.destroy();
            const cb = jest.fn();
            notifier.subscribe('evt', cb);
            notifier.notify('evt', 'queued-after-destroy');
            expect(cb).not.toHaveBeenCalled();
        });
    });
});
