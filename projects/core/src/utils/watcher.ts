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

/**
 * Detects if an expression is static (doesn't change during runtime)
 * Static expressions can be evaluated once and don't need to be watched
 */
const isStaticExpression = (expr: string): boolean => {
    if (typeof expr !== 'string') {
        return false;
    }
    
    const trimmedExpr = expr.trim();
    
    // appLocale expressions are static (localization strings)
    if (trimmedExpr.startsWith('appLocale') && 
        (trimmedExpr.length === 9 || trimmedExpr[9] === '.' || trimmedExpr[9] === '[')) {
        return true;
    }
    
    // Static property names (simple identifiers without dots, functions, or operators)
    const staticPropertyNames = [
        'canceltext', 'iconclass', 'message', 
        'directionlinks', 'navControls', 
        'iconposition', 'iconwidth'
    ];
    if (staticPropertyNames.includes(trimmedExpr)) {
        return true;
    }
    
    // Simple literal strings (no variables, functions, operators, or special syntax)
    // Check for dynamic indicators
    if (trimmedExpr.includes('Variables.') || 
        trimmedExpr.includes('()') || 
        trimmedExpr.includes('row.') || 
        trimmedExpr.includes('?') || 
        trimmedExpr.includes('|') ||
        trimmedExpr.includes('notification.') ||
        trimmedExpr.includes('Actions.') ||
        trimmedExpr.includes('[') ||
        trimmedExpr.includes('(')) {
        return false; // Contains dynamic indicators
    }
    
    // Simple identifier without special characters - likely static
    // But only if it's a single word (no dots, brackets, etc.)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmedExpr)) {
        return true;
    }
    
    return false; // Default to dynamic
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
    // OPTIMIZATION: Evaluate static expressions once and skip registry
    // Static expressions (appLocale, static properties) don't change during runtime
    if (typeof expr === 'string' && isStaticExpression(expr)) {
        // Evaluate once immediately
        const fn = $parseExpr(expr);
        try {
            const value = fn($scope, $locals);
            // Call listener to set the value (triggers initial update)
            listener(value, FIRST_TIME_WATCH);
            // Return no-op unwatch function (nothing to unwatch, not added to registry)
            return () => {};
        } catch (e) {
            console.warn(`error in evaluating static expression: '${expr}'`, e);
            // If evaluation fails, fall through to normal watch registration
            // This ensures the app doesn't break if expression evaluation fails
        }
    }
    
    // Normal flow for dynamic expressions (non-static)
    if (expr.indexOf('[$i]') !== -1) {
        let watchInfo = getUpdatedWatcInfo(expr, config && (config.arrayType || config.isList), listener);
        expr = watchInfo.expr;
        listener = watchInfo.listener;
    }
    const fn = $parseExpr(expr);

    registry.set(identifier, {
        fn: fn.bind(expr, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted: isMuted
    });

    return () => $unwatch(identifier);
};

export const $unwatch = identifier => {
    // MEMORY LEAK FIX: Clear watchInfo contents before deleting from registry
    const watchInfo = registry.get(identifier);
    if (watchInfo) {
        watchInfo.last = null;        // Clear large cloned objects
        watchInfo.fn = null;          // Release $scope/$locals references
        watchInfo.listener = null;    // Clear callback
        watchInfo.isMuted = null;     // Clear isMuted function
    }
    return registry.delete(identifier);
};

let changedByWatch = false;

const $RAF = window.requestAnimationFrame;

let ngZone;

const triggerWatchers = (ignoreMuted?: boolean) => {

    if (muted && !ignoreMuted) {
        return;
    }

    const limit = 5;
    let pass = 1;
    let changeDetected;

    do {
        changeDetected = false;
        registry.forEach(watchInfo => {
            if(watchInfo.isMuted && watchInfo.isMuted()) {
                return;
            }
            const fn = watchInfo.fn;
            const listener = watchInfo.listener;
            const ov = watchInfo.last;
            let nv;

            try {
                nv = fn();
            } catch (e) {
                console.warn(`error in executing expression: '${watchInfo.expr}'`);
            }

            if (!isEqual(nv, ov)) {
                changeDetected = true;
                changedByWatch = true;
                watchInfo.last = nv;

                // @ts-ignore
                if (isObject(nv) && !watchInfo.doNotClone && nv.__cloneable__ !== false) {
                    watchInfo.last = clone(nv);
                }
                listener(nv, ov);
                resetChangeFromWatch();
            }
        });
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

(<any>window).watchRegistry = registry;

let skipWatchers;

const debouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    ngZone.run(() => triggerWatchers());
}, 100);

export const $invokeWatchers = (force?: boolean, ignoreMuted?: boolean) => {
    if (force) {
        triggerWatchers(ignoreMuted);
    } else {

        if (skipWatchers) {
            skipWatchers = false;
            return;
        }
        debouncedTriggerWatchers();
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
