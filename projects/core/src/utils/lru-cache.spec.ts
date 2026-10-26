import { LRUCache } from './lru-cache';

const createCache = <T = any>(maxSize = 100, maxAge = 0, onEvict?: (key: string, value: T) => any) =>
    new LRUCache<T>(maxSize, maxAge, onEvict);

describe('LRUCache', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('set / get / has', () => {
        it('should store and retrieve a value', () => {
            const cache = createCache();
            cache.set('a', 1);
            expect(cache.get('a')).toBe(1);
            expect(cache.has('a')).toBe(true);
        });

        it('should return null for a missing key', () => {
            const cache = createCache();
            expect(cache.get('missing')).toBeNull();
            expect(cache.has('missing')).toBe(false);
        });

        it('should ignore null/undefined values', () => {
            const cache = createCache();
            cache.set('a', null as any);
            cache.set('b', undefined as any);
            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(false);
        });

        it('should overwrite an existing key without duplicating it in the eviction queue', () => {
            const cache = createCache();
            cache.set('a', 1);
            cache.set('a', 2);
            expect(cache.get('a')).toBe(2);
            expect(cache.size()).toBe(1);
        });
    });

    describe('eviction by maxSize', () => {
        it('should evict the least-recently-touched key once maxSize is exceeded', () => {
            const cache = createCache(2);
            cache.set('a', 1);
            cache.set('b', 2);
            cache.set('c', 3);
            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(true);
            expect(cache.has('c')).toBe(true);
        });

        it('should treat a get() as touching the key, protecting it from eviction', () => {
            const cache = createCache(2);
            cache.set('a', 1);
            cache.set('b', 2);
            cache.get('a');
            cache.set('c', 3);
            expect(cache.has('a')).toBe(true);
            expect(cache.has('b')).toBe(false);
            expect(cache.has('c')).toBe(true);
        });

        it('should call onEvict with the evicted key and value', () => {
            const onEvict = jest.fn();
            const cache = createCache(1, 0, onEvict);
            cache.set('a', 1);
            cache.set('b', 2);
            expect(onEvict).toHaveBeenCalledWith('a', 1);
        });
    });

    describe('delete', () => {
        it('should remove an existing key and invoke onEvict', () => {
            const onEvict = jest.fn();
            const cache = createCache(100, 0, onEvict);
            cache.set('a', 1);
            cache.delete('a');
            expect(cache.has('a')).toBe(false);
            expect(onEvict).toHaveBeenCalledWith('a', 1);
        });

        it('should be a no-op for a key that does not exist', () => {
            const onEvict = jest.fn();
            const cache = createCache(100, 0, onEvict);
            expect(() => cache.delete('missing')).not.toThrow();
            expect(onEvict).not.toHaveBeenCalled();
        });

        it('should be a no-op for an empty/falsy key', () => {
            const cache = createCache();
            expect(() => cache.delete('')).not.toThrow();
        });
    });

    describe('size / keys / clear', () => {
        it('should report the number of tracked keys', () => {
            const cache = createCache();
            cache.set('a', 1);
            cache.set('b', 2);
            expect(cache.size()).toBe(2);
        });

        it('should list the tracked keys', () => {
            const cache = createCache();
            cache.set('a', 1);
            cache.set('b', 2);
            expect(Array.from(cache.keys())).toEqual(['a', 'b']);
        });

        it('should evict every entry on clear', () => {
            const onEvict = jest.fn();
            const cache = createCache(100, 0, onEvict);
            cache.set('a', 1);
            cache.set('b', 2);
            cache.clear();
            expect(cache.size()).toBe(0);
            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(false);
            expect(onEvict).toHaveBeenCalledTimes(2);
        });
    });

    describe('maxAge behavior', () => {
        it('should warn when maxAge is a low but positive number of seconds', () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const cache = createCache(100, 10);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('very less'));
            cache.destroy();
            jest.useRealTimers();
        });

        it('should not warn or schedule eviction when maxAge is 0', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const cache = createCache(100, 0);
            expect(warnSpy).not.toHaveBeenCalled();
            cache.destroy();
        });
    });

    describe('destroy', () => {
        it('should clear the eviction interval and empty the cache', () => {
            jest.useFakeTimers();
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            const cache = createCache(100, 60);
            cache.set('a', 1);
            cache.destroy();
            expect(clearIntervalSpy).toHaveBeenCalled();
            expect(cache.size()).toBe(0);
            jest.useRealTimers();
        });

        it('should be safe to call when there was never an eviction interval', () => {
            const cache = createCache(100, 0);
            cache.set('a', 1);
            expect(() => cache.destroy()).not.toThrow();
            expect(cache.size()).toBe(0);
        });
    });
});
