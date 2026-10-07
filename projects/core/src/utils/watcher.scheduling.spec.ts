describe('watcher - scheduled execution', () => {
    let watcher: any;
    let ngZone: { runOutsideAngular: jest.Mock; run: jest.Mock };

    // watcher keeps its state at module level, so every test loads a fresh copy
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
        delete (window as any).__zone_symbol__setTimeout;
        delete (window as any).__zone_symbol__clearTimeout;
    });

    it('runs the watchers once after the debounce time and enters the zone when something changed', () => {
        const scope = { value: 1 };
        const listener = jest.fn();
        watcher.$watch('value', scope, {}, listener);

        watcher.$invokeWatchers();
        expect(listener).not.toHaveBeenCalled();

        jest.advanceTimersByTime(200);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(1, watcher.FIRST_TIME_WATCH);
        expect(ngZone.runOutsideAngular).toHaveBeenCalledTimes(1);
        expect(ngZone.run).toHaveBeenCalledTimes(1);
    });

    it('does not enter the zone when nothing changed', () => {
        const scope = { value: 1 };
        watcher.$watch('value', scope, {}, jest.fn());
        watcher.$invokeWatchers(true);

        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);

        expect(ngZone.run).not.toHaveBeenCalled();
    });

    it('collapses requests made while a run is scheduled into one extra run', () => {
        let evaluations = 0;
        const scope = { tick: () => ++evaluations && 'same' };
        watcher.$watch('tick()', scope, {}, jest.fn());

        watcher.$invokeWatchers();
        watcher.$invokeWatchers();
        watcher.$invokeWatchers();

        jest.advanceTimersByTime(200);
        const afterFirst = evaluations;
        jest.advanceTimersByTime(200);
        const afterSecond = evaluations;
        jest.advanceTimersByTime(2000);

        expect(afterSecond).toBeGreaterThan(afterFirst);
        expect(evaluations).toBe(afterSecond);
    });

    it('skips muted watchers during a scheduled run', () => {
        const listener = jest.fn();
        watcher.$watch('value', { value: 1 }, {}, listener, 'muted-watch', false, {}, () => true);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(listener).not.toHaveBeenCalled();
    });

    it('warns and keeps going when an expression throws during a scheduled run', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        watcher.$watch('boom()', { boom: () => { throw new Error('x'); } }, {}, jest.fn());
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(warn).toHaveBeenCalledWith("error in executing expression: 'boom()'");
        warn.mockRestore();
    });

    it('does not clone values flagged as not cloneable', () => {
        const value = { __cloneable__: false, a: 1 };
        const listener = jest.fn();
        watcher.$watch('value', { value }, {}, listener);
        watcher.$invokeWatchers();
        jest.advanceTimersByTime(200);
        expect(listener).toHaveBeenCalledWith(value, watcher.FIRST_TIME_WATCH);
        expect(watcher.isChangeFromWatch()).toBe(false);
    });

    it('does not run immediately when muted but runs after unmuting', () => {
        const listener = jest.fn();
        watcher.$watch('value', { value: 1 }, {}, listener);
        watcher.muteWatchers();
        watcher.$invokeWatchers(true);
        expect(listener).not.toHaveBeenCalled();

        watcher.unMuteWatchers();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('can force a run even while muted', () => {
        const listener = jest.fn();
        watcher.$watch('value', { value: 1 }, {}, listener);
        watcher.muteWatchers();
        watcher.$invokeWatchers(true, true);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('watcher - array expressions', () => {
    let watcher: any;

    beforeAll(() => {
        jest.isolateModules(() => {
            const parser = require('./expression-parser');
            parser.setPipeProvider({
                getPipeNameVsIsPureMap: () => new Map(),
                meta: () => undefined,
                getInstance: () => ({ transform: (v: any) => v }),
            });
            watcher = require('./watcher');
        });
    });

    it('replaces [$i] with [0] for listeners that do not accept arrays', () => {
        const listener = jest.fn();
        watcher.$watch('list[$i].name', { list: [{ name: 'a' }, { name: 'b' }] }, {}, listener, 'single', false, { isList: false });
        watcher.$invokeWatchers(true);
        expect(listener).toHaveBeenCalledWith('a', watcher.FIRST_TIME_WATCH);
    });

    it('collects the remaining path of every item for listeners that accept arrays', () => {
        const listener = jest.fn();
        watcher.$watch('list[$i].name', { list: [{ name: 'a' }, { name: 'b' }] }, {}, listener, 'multi', false, { isList: true });
        watcher.$invokeWatchers(true);
        expect(listener).toHaveBeenCalledWith(['a', 'b'], watcher.FIRST_TIME_WATCH);
    });

    it('flattens nested arrays collected from the items', () => {
        const listener = jest.fn();
        watcher.$watch('list[$i].tags', { list: [{ tags: ['a', 'b'] }, { tags: ['c'] }] }, {}, listener, 'nested', false, { arrayType: true });
        watcher.$invokeWatchers(true);
        expect(listener).toHaveBeenCalledWith(['a', 'b', 'c'], watcher.FIRST_TIME_WATCH);
    });

    it('passes the array itself when [$i] ends the expression', () => {
        const listener = jest.fn();
        watcher.$watch('list[$i]', { list: [1, 2] }, {}, listener, 'whole', false, { isList: true });
        watcher.$invokeWatchers(true);
        expect(listener).toHaveBeenCalledWith([1, 2], watcher.FIRST_TIME_WATCH);
    });

    it('ignores non array values for array consumers', () => {
        const listener = jest.fn();
        watcher.$watch('list[$i].name', { list: 'not-an-array' }, {}, listener, 'bad', false, { isList: true });
        watcher.$invokeWatchers(true);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('watcher - $appDigest', () => {
    let watcher: any;
    let ngZone: any;
    let appRef: any;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.isolateModules(() => {
            watcher = require('./watcher');
        });
        ngZone = { run: jest.fn((fn: () => void) => fn()), runOutsideAngular: jest.fn((fn: () => void) => fn()) };
        appRef = { tick: jest.fn() };
        watcher.setNgZone(ngZone);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does nothing without an application reference', () => {
        watcher.$appDigest(true);
        expect(ngZone.run).not.toHaveBeenCalled();
    });

    it('ticks the application immediately when forced', () => {
        watcher.setAppRef(appRef);
        watcher.$appDigest(true);
        expect(appRef.tick).toHaveBeenCalledTimes(1);
        expect(ngZone.run).toHaveBeenCalledTimes(1);
    });

    it('queues a single tick on the next animation frame', () => {
        watcher.setAppRef(appRef);
        watcher.$appDigest();
        watcher.$appDigest();
        expect(appRef.tick).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        expect(appRef.tick).toHaveBeenCalledTimes(1);

        watcher.$appDigest();
        jest.advanceTimersByTime(50);
        expect(appRef.tick).toHaveBeenCalledTimes(2);
    });
});
