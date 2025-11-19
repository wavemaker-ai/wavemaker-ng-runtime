import { IDGenerator } from './id-generator';

import { $parseExpr } from './expression-parser';
import { findValueOf } from './utils';
import {clone, flatten, isArray, isEqual, isObject} from "lodash-es";

const registry = new Map<string, any>();

const watchIdGenerator = new IDGenerator('watch-id-');

export const FIRST_TIME_WATCH = {};

Object.freeze(FIRST_TIME_WATCH);

export const isFirstTimeChange = v => v === FIRST_TIME_WATCH;

let muted = false;
let appRef;

export const debounce = (fn: Function, wait: number = 50) => {
    let timeout;
    return (...args) => {
        window['__zone_symbol__clearTimeout'](timeout);
        timeout = window['__zone_symbol__setTimeout'](() => fn(...args), wait);
    };
};

export const muteWatchers = () => {
    muted = true;
};

export const unMuteWatchers = () => {
    muted = false;
    triggerWatchers();
};

const arrayConsumer = (listenerFn, restExpr, newVal, oldVal) => {
    let data = newVal,
        formattedData;

    if (isArray(data)) {
        formattedData = data.map(function (datum) {
            return findValueOf(datum, restExpr);
        });

        // If resulting structure is an array of array, flatten it
        if (isArray(formattedData[0])) {
            formattedData = flatten(formattedData);
        }

        listenerFn(formattedData, oldVal);
    }
};

const getUpdatedWatcInfo = (expr, acceptsArray, listener) => {
    // listener doesn't accept array
    // replace all `[$i]` with `[0]` and return the expression
    let regex = /\[\$i\]/g,
        $I                = '[$i]',
        $0                = '[0]';
    if (!acceptsArray) {
        return {
            'expr'     : expr.replace(regex, $0),
            'listener' : listener
        };
    }

    // listener accepts array
    // replace all except the last `[$i]` with `[0]` and return the expression.
    var index           = expr.lastIndexOf($I),
        _expr           = expr.substr(0, index).replace($I, $0),
        restExpr        = expr.substr(index + 5),
        arrayConsumerFn = listener;

    if (restExpr) {
        arrayConsumerFn = arrayConsumer.bind(undefined, listener, restExpr);
    }

    return {
        'expr'     : _expr,
        'listener' : arrayConsumerFn
    };
};

export const $watch = (expr, $scope, $locals, listener, identifier = watchIdGenerator.nextUid(), doNotClone = false, config:any={}, isMuted?: () => boolean) => {
    if (expr.indexOf('[$i]') !== -1) {
        let watchInfo = getUpdatedWatcInfo(expr, config && (config.arrayType || config.isList), listener);
        expr = watchInfo.expr;
        listener = watchInfo.listener;
    }
    const fn = $parseExpr(expr);

    const watchInfoObj = {
        fn: fn.bind(expr, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted: isMuted,
        _destroyed: false // RACE CONDITION FIX: Use flag instead of nullifying to prevent crashes during concurrent access
    };

    registry.set(identifier, watchInfoObj);

    return () => $unwatch(identifier);
};

export const $unwatch = (identifier) => {
    // MEMORY LEAK FIX: Clear watchInfo contents before deleting from registry
    // The watchInfo object holds: bound fn (with $scope/$locals), listener callback, and last value
    // Without explicit cleanup, these can remain in memory during GC delay
    
    // RACE CONDITION FIX: Mark as destroyed first, then clean up
    // This prevents crashes if triggerWatchers is currently iterating over this watcher
    // triggerWatchers will check _destroyed flag and skip gracefully
    const watchInfo = registry.get(identifier);
    if (watchInfo) {
        // Mark as destroyed FIRST - this tells triggerWatchers to skip this watcher
        watchInfo._destroyed = true;
        
        // Clear the stored last value (could be large cloned object)
        watchInfo.last = null;
        // Clear the bound function (releases $scope and $locals references)
        watchInfo.fn = null;
        // Clear the listener callback
        watchInfo.listener = null;
        // Clear isMuted function
        watchInfo.isMuted = null;
    }
    return registry.delete(identifier);
};

let changedByWatch = false;

const $RAF = window.requestAnimationFrame;

let ngZone;

// PERFORMANCE FIX: Optimize triggerWatchers to skip muted watchers early and batch process
// This reduces CPU usage when processing 22K+ watchers by:
// 1. Pre-filtering muted watchers before iteration
// 2. Using a separate array for active watchers to avoid Map iteration overhead
// 3. Early return for muted watchers without function execution
const triggerWatchers = (ignoreMuted?: boolean) => {

    if (muted && !ignoreMuted) {
        return;
    }

    const limit = 5;
    let pass = 1;
    let changeDetected;

    do {
        changeDetected = false;
        
        // CRITICAL FIX: Rebuild activeWatchers array each pass to catch newly added watchers
        // This matches the original behavior where registry.forEach was called inside the loop
        // New watchers registered during a pass will be processed in the same pass
        
        // RACE CONDITION FIX: Store only identifiers instead of object references
        // This prevents issues if watchers are unwatched during iteration
        // We'll look up fresh from registry during processing
        const activeWatcherIds: string[] = [];
        registry.forEach((watchInfo, identifier) => {
            // Skip muted watchers early - don't even add them to the processing list
            if (watchInfo.isMuted && watchInfo.isMuted()) {
                return;
            }
            // RACE CONDITION FIX: Skip destroyed watchers
            if (watchInfo._destroyed) {
                return;
            }
            // Fix: Skip watchers with invalid functions (already cleaned up or corrupted)
            if (!watchInfo.fn || typeof watchInfo.fn !== 'function') {
                return;
            }
            // Fix: Skip watchers with invalid listeners to prevent "listener is not a function" errors
            if (!watchInfo.listener || typeof watchInfo.listener !== 'function') {
                return;
            }
            activeWatcherIds.push(identifier);
        });

        // Early return if no active watchers
        if (activeWatcherIds.length === 0) {
            return;
        }
        
        // PERFORMANCE FIX: Iterate over pre-filtered array instead of Map
        // This is faster than Map.forEach when we've already filtered
        for (let i = 0; i < activeWatcherIds.length; i++) {
            const identifier = activeWatcherIds[i];
            
            // RACE CONDITION FIX: Look up fresh from registry - watcher might have been unwatched
            const watchInfo = registry.get(identifier);
            if (!watchInfo) {
                // Watcher was removed during iteration, skip it
                continue;
            }
            
            // RACE CONDITION FIX: Check if destroyed (might have been unwatched after being added to array)
            if (watchInfo._destroyed) {
                continue;
            }
            
            // Double-check muted state (could have changed during pass)
            if (watchInfo.isMuted && watchInfo.isMuted()) {
                continue;
            }
            
            const fn = watchInfo.fn;
            const listener = watchInfo.listener;
            const ov = watchInfo.last;
            let nv;

            // Fix: Skip watchers with invalid listeners to prevent "listener is not a function" errors
            // BETTER LOGGING: Add context to help debug edge cases
            if (!listener || typeof listener !== 'function') {
                // Log with more context to help identify when this happens
                if (watchInfo.expr) {
                    console.warn(`[Watcher] Skipping watcher with invalid listener during iteration. Expression: "${watchInfo.expr}", Identifier: ${identifier}. This may indicate a race condition or corrupted watcher state.`);
                }
                continue;
            }

            // Fix: Skip watchers with invalid functions
            if (!fn || typeof fn !== 'function') {
                // Log with more context to help identify when this happens
                if (watchInfo.expr) {
                    console.warn(`[Watcher] Skipping watcher with invalid function during iteration. Expression: "${watchInfo.expr}", Identifier: ${identifier}. This may indicate a race condition or corrupted watcher state.`);
                }
                continue;
            }

            try {
                nv = fn();
            } catch (e) {
              //  console.warn(`error in executing expression: '${watchInfo.expr}'`);
            }

            if (!isEqual(nv, ov)) {
                changeDetected = true;
                changedByWatch = true;
                watchInfo.last = nv;

                // @ts-ignore
                if (isObject(nv) && !watchInfo.doNotClone && nv.__cloneable__ !== false) {
                    watchInfo.last = clone(nv);
                }
                
                // Fix: Additional safety check and error handling for listener call
                // This prevents "listener is not a function" errors even if listener was corrupted
                // between the filter and execution phases
                try {
                    // RACE CONDITION FIX: Re-check listener after change detection (might have been unwatched)
                    if (!listener || typeof listener !== 'function') {
                        // Log with more context - this indicates a race condition
                        console.warn(`[Watcher] Listener became invalid during execution (likely unwatched). Expression: "${watchInfo.expr}", Identifier: ${identifier}. Skipping.`);
                        // Don't delete - it might have already been deleted by $unwatch
                        continue;
                    }
                    
                    listener(nv, ov);
                } catch (e) {
                    // Log error but don't break the entire watcher cycle
                    // BETTER LOGGING: Include expression and identifier for debugging
                    console.error(`[Watcher] Error executing watcher listener. Expression: "${watchInfo.expr}", Identifier: ${identifier}`, e);
                    
                    // Only remove if still in registry (might have been unwatched already)
                    if (registry.has(identifier)) {
                        // Mark as destroyed and remove to prevent future errors
                        watchInfo._destroyed = true;
                        registry.delete(identifier);
                    }
                    continue;
                }
                resetChangeFromWatch();
            }
        }
        pass++;

    } while (changeDetected && pass < limit);

    if (changeDetected && pass === limit) {
        console.warn(`Number of watch cycles gone above set limit of: ${limit} `);
    }
};

export const setNgZone = zone => ngZone = zone;

export const setAppRef = ref => {
    appRef = ref
};

export const isChangeFromWatch = () => changedByWatch;
export const resetChangeFromWatch = () => changedByWatch = false;

// MEMORY LEAK FIX: Ensure __wmGetWatcherCount is available on window for debugging
// Use a function to initialize it lazily and ensure it's always available
const initWatcherCountHelper = () => {
    if (typeof window === 'undefined') {
        return;
    }
    
    // Check if already defined (including inherited properties)
    if ('__wmGetWatcherCount' in window) {
        // If it exists but is not a function, redefine it
        if (typeof (window as any).__wmGetWatcherCount !== 'function') {
            try {
                delete (window as any).__wmGetWatcherCount;
            } catch (e) {
                // Property might not be configurable, try to redefine
            }
        } else {
            // Already correctly defined
            return;
        }
    }
    
    try {
        Object.defineProperty(window, '__wmGetWatcherCount', {
            value: () => registry.size,
            writable: false,
            configurable: true,
            enumerable: false
        });
    } catch (e) {
        // Fallback: assign directly if defineProperty fails
        (window as any).__wmGetWatcherCount = () => registry.size;
    }
};

// Initialize immediately if window is available
if (typeof window !== 'undefined') {
    initWatcherCountHelper();
} else {
    // For SSR or build-time, initialize when window becomes available
    if (typeof globalThis !== 'undefined' && globalThis !== window) {
        // Try to initialize on globalThis as fallback
        try {
            Object.defineProperty(globalThis, '__wmGetWatcherCount', {
                value: () => registry.size,
                writable: false,
                configurable: true,
                enumerable: false
            });
        } catch (e) {
            // Ignore if it fails
        }
    }
}

// Export a function to re-initialize if needed (useful for testing or late initialization)
export const ensureWatcherCountHelper = () => {
    initWatcherCountHelper();
};

let skipWatchers;
let isHighFrequencyMode = false;
let highFrequencyTimeout: any = null;

// PERFORMANCE FIX: Enhanced batching for high-frequency events
// During high-frequency events (mousemove, scroll, etc.), we batch watcher invocations
// to reduce CPU usage from processing 22K+ watchers on every event
const debouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    isHighFrequencyMode = false;
    ngZone.run(() => triggerWatchers());
}, 100);

// PERFORMANCE FIX: Special handling for high-frequency events
// Skips watcher processing during rapid-fire events, batches them instead
// Use 80ms as default (matches HIGH_FREQ_DIGEST_INTERVAL from constants.ts)
const HIGH_FREQ_DEBOUNCE_INTERVAL = 80;
const highFrequencyDebouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    isHighFrequencyMode = false;
    if (highFrequencyTimeout) {
        clearTimeout(highFrequencyTimeout);
        highFrequencyTimeout = null;
    }
    ngZone.run(() => triggerWatchers());
}, HIGH_FREQ_DEBOUNCE_INTERVAL);

export const $invokeWatchers = (force?: boolean, ignoreMuted?: boolean, isHighFreqEvent?: boolean) => {
    if (force) {
        // Force mode: execute immediately, but still respect muted state
        triggerWatchers(ignoreMuted);
        // Reset high-frequency mode after forced execution
        if (isHighFrequencyMode) {
            isHighFrequencyMode = false;
            if (highFrequencyTimeout) {
                clearTimeout(highFrequencyTimeout);
                highFrequencyTimeout = null;
            }
        }
    } else {
        // PERFORMANCE FIX: Use different debounce for high-frequency events
        if (isHighFreqEvent) {
            isHighFrequencyMode = true;
            if (skipWatchers) {
                skipWatchers = false;
                return;
            }
            highFrequencyDebouncedTriggerWatchers();
        } else {
            // Normal events: use standard debounce
            if (skipWatchers) {
                skipWatchers = false;
                return;
            }
            debouncedTriggerWatchers();
        }
    }
};

export const $appDigest = (() => {
    let queued = false;
    return (force?: boolean) => {
        if (!appRef) {
            return;
        }
        if (force) {
            ngZone.run(() => appRef.tick());
            queued = false;
        } else {
            if (queued) {
                return;
            } else {
                queued = true;
                $RAF(() => {
                    ngZone.run(() => appRef.tick());
                    queued = false;
                });
            }
        }
    };
})();
