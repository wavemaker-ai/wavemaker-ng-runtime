import { LRUCache } from './lru-cache';

describe('LRUCache coverage', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('uses default maxSize/maxAge when constructed without args', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const cache: any = new LRUCache<string>();
        expect(cache.maxSize).toBe(100);
        expect(cache.maxAge).toBe(60000);
        expect(console.warn).not.toHaveBeenCalled();
        cache.destroy();
    });

    it('evict() with no argument evicts one entry', () => {
        const cache: any = new LRUCache<string>(10, 0);
        cache.set('a', 'A');
        cache.set('b', 'B');
        cache.evict();
        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
    });

    it('interval callback evicts expired entries', () => {
        jest.useFakeTimers();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const onEvict = jest.fn();
        const cache = new LRUCache<string>(10, 10, onEvict);
        cache.set('a', 'A');
        jest.advanceTimersByTime(10001);
        expect(cache.has('a')).toBe(false);
        expect(onEvict).toHaveBeenCalledWith('a', 'A');
        cache.destroy();
    });

    it('destroy is safe to call twice (interval id already null)', () => {
        const cache = new LRUCache<string>(10, 0);
        cache.set('a', 'A');
        cache.destroy();
        expect(cache.size()).toBe(0);
        expect(() => cache.destroy()).not.toThrow();
    });

    it('delete tolerates a cached key missing from the evict queue', () => {
        const onEvict = jest.fn();
        const cache: any = new LRUCache<string>(10, 0, onEvict);
        cache.cache.set('orphan', { instance: 'O', lastAccessedTime: Date.now() });
        cache.delete('orphan');
        expect(cache.has('orphan')).toBe(false);
        expect(onEvict).toHaveBeenCalledWith('orphan', 'O');
    });
});
