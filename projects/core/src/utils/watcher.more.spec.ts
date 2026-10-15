describe('watcher (more)', () => {
    let watcher: any;
    let ngZone: any;

    const load = () => {
        jest.isolateModules(() => {
            const parser = require('./expression-parser');
            parser.setPipeProvider({
                getPipeNameVsIsPureMap: () => new Map(),
                meta: () => undefined,
                getInstance: () => ({ transform: (v: any) => v }),
            });
            watcher = require('./watcher');
        });
        ngZone = { runOutsideAngular: jest.fn((fn: () => void) => fn()), run: jest.fn((fn: () => void) => fn()) };
        watcher.setNgZone(ngZone);
    };

    beforeEach(() => {
        jest.useFakeTimers();
        (window as any).__zone_symbol__setTimeout = (fn: any, wait: number) => setTimeout(fn, wait);
        (window as any).__zone_symbol__clearTimeout = (id: any) => clearTimeout(id);
        load();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (window as any).__WM_DEBUG_WATCHERS__ = false;
        delete (window as any).__zone_symbol__setTimeout;
        delete (window as any).__zone_symbol__clearTimeout;
    });

    it('forced run stops once the pass limit (5, exclusive) is reached for an ever-changing watcher and warns', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        let n = 0;
        const listener = jest.fn();
        watcher.$watch('next()', { next: () => ++n }, {}, listener);
        watcher.$invokeWatchers(true);
        expect(listener).toHaveBeenCalledTimes(4);
        expect(warn).toHaveBeenCalledWith('Number of watch cycles gone above set limit of: 5 ');
    });

    it('scheduled run is capped at 4 passes per execution for an ever-changing watcher', () => {
        let n = 0;
        const listener = jest.fn();
        watcher.$watch('next()', { next: () => ++n }, {}, listener);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(listener).toHaveBeenCalledTimes(4);
        expect(ngZone.run).toHaveBeenCalledTimes(1);
    });

    it('triggerWatchers skips muted watchers and reports isChangeFromWatch false afterwards', () => {
        const listener = jest.fn();
        watcher.$watch('v', { v: 1 }, {}, listener, 'm', false, {}, () => true);
        watcher.$invokeWatchers(true);
        expect(listener).not.toHaveBeenCalled();
        expect(watcher.isChangeFromWatch()).toBe(false);
    });

    it('triggerWatchers warns for throwing expressions and unwatch removes watchers', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const listener = jest.fn();
        const un = watcher.$watch('boom()', { boom: () => { throw new Error('x'); } }, {}, listener, 'b1');
        watcher.$invokeWatchers(true);
        expect(warn).toHaveBeenCalledWith("error in executing expression: 'boom()'");
        expect(watcher.watchRegistry ?? (window as any).watchRegistry).toBeDefined();
        expect((window as any).watchRegistry.has('b1')).toBe(true);
        un();
        expect((window as any).watchRegistry.has('b1')).toBe(false);
    });

    it('a listener that re-triggers the digest while a run is in progress requests exactly one rerun', () => {
        let n = 0;
        const scope = { val: () => (n < 1 ? 1 : 1) };
        let calls = 0;
        const listener = jest.fn(() => {
            calls++;
            // fire the debounce timer re-entrantly -> executeWatchers sees isRunning
            watcher.$invokeWatchers();
            jest.advanceTimersByTime(250);
        });
        watcher.$watch('val()', scope, {}, listener);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(calls).toBe(1);
        // rerun requested during run is scheduled and executes without changes
        jest.advanceTimersByTime(1000);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops rescheduling after the max consecutive reruns and logs when debug is on', () => {
        (window as any).__WM_DEBUG_WATCHERS__ = true;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        let n = 0;
        const listener = jest.fn(() => {
            // two requests during the run -> second one flags rerunRequested
            watcher.$invokeWatchers();
            watcher.$invokeWatchers();
        });
        watcher.$watch('next()', { next: () => (n++ < 1000 ? n : n) }, {}, listener);
        watcher.$invokeWatchers();
        for (let i = 0; i < 30; i++) {
            jest.advanceTimersByTime(200);
        }
        const messages = logSpy.mock.calls.map(c => String(c[0]));
        expect(messages.some(m => m.includes('executeWatchers'))).toBe(true);
        expect(messages.some(m => m.includes('Scheduling rerun #'))).toBe(true);
        expect(messages.some(m => m.includes('Stopped infinite loop'))).toBe(true);
        expect(messages.some(m => m.includes('DONE (changes detected)'))).toBe(true);
    });

    it('logs "no changes" in debug mode when nothing changed', () => {
        (window as any).__WM_DEBUG_WATCHERS__ = true;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        watcher.$watch('v', { v: 1 }, {}, jest.fn());
        watcher.$invokeWatchers(true);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(logSpy.mock.calls.some(c => String(c[0]).includes('DONE (no changes)'))).toBe(true);
        expect(logSpy.mock.calls.some(c => String(c[0]).includes('triggerWatchers'))).toBe(true);
    });

    it('scheduled run stores a clone of object values so in-place mutation is detected', () => {
        const obj = { a: 1 };
        const listener = jest.fn();
        watcher.$watch('obj', { obj }, {}, listener);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(listener).toHaveBeenCalledTimes(1);
        obj.a = 2;
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenLastCalledWith({ a: 2 }, { a: 1 });
    });
});
