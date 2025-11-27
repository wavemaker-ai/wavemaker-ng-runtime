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

/**
 * Determines if an expression is static (doesn't need to be watched)
 */
const STATIC_EXPRESSION_NAMES = [
    "row.getProperty('investment')",
    "row.getProperty('factsheetLink')",
    "row.getProperty('isRebalanceEligible')"
];

const isStaticExpression = (expr: any): boolean => {
    if (typeof expr !== 'string') {
        return false;
    }

    const trimmedExpr = expr.trim();

    // Expressions that always evaluate to localization strings
    // if (trimmedExpr.includes('appLocale')) {
    //     return true;
    // }

    // Hard-coded static expression names
    if (STATIC_EXPRESSION_NAMES.includes(trimmedExpr)) {
        return true;
    }

    return false;
};

/**
 * Gets the scope type from the scope object
 */
const getScopeType = ($scope: any): ScopeType | null => {
    if (!$scope) {
        return null;
    }

    if ($scope.pageName) return 'Page';
    if ($scope.prefabName) return 'Prefab';
    if ($scope.partialName) return 'Partial';

    // Check for App scope
    if ($scope.Variables !== undefined &&
        $scope.Actions !== undefined &&
        !$scope.pageName &&
        !$scope.prefabName &&
        !$scope.partialName) {
        return 'App';
    }

    if ($scope.constructor?.name === 'AppRef') {
        return 'App';
    }

    return null;
};

/**
 * Gets scope name based on scope type
 */
const getScopeName = ($scope: any, scopeType: ScopeType | null): string | null => {
    if (!scopeType || !$scope) {
        return null;
    }

    switch (scopeType) {
        case 'Prefab': return $scope.prefabName || null;
        case 'Partial': return $scope.partialName || null;
        case 'Page': return $scope.pageName || null;
        default: return null;
    }
};

/**
 * Main watch function
 */
export const $watch = (
    expr: string,
    $scope: any,
    $locals: any,
    listener: any,
    identifier: string = watchIdGenerator.nextUid(),
    doNotClone: boolean = false,
    config: WatchConfig = {},
    isMuted?: () => boolean
) => {
    // Handle array expressions
    if (expr.includes(ARRAY_INDEX_PLACEHOLDER)) {
        const watchInfo = getUpdatedWatchInfo(expr, config.arrayType || config.isList || false, listener);
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

export const $unwatch = identifier => registry.delete(identifier);

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
