import { IDGenerator } from './id-generator';
import { $parseExpr } from './expression-parser';
import { findValueOf } from './utils';
import { clone, flatten, isArray, isEqual, isObject } from "lodash-es";

// Constants
const WIDGET_ID_REGEX = /^(widget-[^_]+)/;
const WIDGET_PROPERTY_REGEX = /^widget-[^_]+_(.+)$/;
const ARRAY_INDEX_PLACEHOLDER = '[$i]';
const ARRAY_INDEX_ZERO = '[0]';
const DEBOUNCE_WAIT = 100;
const MAX_WATCH_CYCLES = 5;

const registry = new Map<string, any>();
const watchIdGenerator = new IDGenerator('watch-id-');

export const FIRST_TIME_WATCH = Object.freeze({});

// Type definitions
interface WatchInfo {
    fn: () => any;
    listener: (newVal: any, oldVal: any) => void;
    expr: string;
    last: any;
    doNotClone: boolean;
    isMuted?: () => boolean;
    scopeType: ScopeType | null;
    scopeName: string | null;
    destroyFn?: () => void;
}

type ScopeType = 'Page' | 'Prefab' | 'Partial' | 'App';

interface WatchConfig {
    arrayType?: boolean;
    isList?: boolean;
}

// State
let muted = false;
let changedByWatch = false;
let skipWatchers = false;
let ngZone: any;
let appRef: any;

/********************************************************************
 * CLEANUP SCHEDULER WITH:
 *  - Significant watcher delta trigger (+/-)
 *  - UI stabilization delay (1–2 seconds)
 *  - Cooldown to prevent repeated scheduling
 ********************************************************************/
const CLEANUP_TRIGGER_DELTA = 300;   // watcher change threshold
const CLEANUP_DELAY = 1500;          // delay before running cleanup
const CLEANUP_COOLDOWN = 4000;       // prevent re-scheduling for 4s

let lastWatcherCount = 0;
let scheduledCleanup: any = null;
let lastScheduledTime = 0;

function getWatcherCount(): number {
    let count = 0;
    registry.forEach((value) => {
        // Check if it's a grouped structure (widget groups) or a direct watchInfo
        if (value && typeof value === 'object' && !value.fn) {
            // It's a widget group - count the properties (excluding metadata)
            count += Object.keys(value).filter(k => k !== 'scopeType' && k !== 'scopeName').length;
        } else {
            // It's a direct watchInfo
            count += 1;
        }
    });
    return count;
}

export const cleanupStaleWatchers = (): number => {
    // console.log(".........Cleaning up stale watchers...registry.size....", registry.size);
    // let removed = 0;

    // registry.forEach((bucket, widgetId) => {
    //     if (widgetId.startsWith('widget-id') && !document.querySelector(`[widget-id="${widgetId}"]`)) {
    //         for (const key in bucket) {
    //             if (bucket.hasOwnProperty(key) && key !== "scopeType" && key !== "scopeName" && typeof bucket[key] !== "function") {
    //                 let watchInfo = bucket[key];
    //                 if (watchInfo && watchInfo.destroyFn) {
    //                     watchInfo.destroyFn();
    //                 }
    //             }
    //         }
    //         removed++;
    //         registry.delete(widgetId);
    //         return;
    //     }
    // });
    // return removed;

    return 0;
};

export const scheduleThresholdCleanup = (): void => {
    const now = performance.now();
    let lastTriggerPeriod = now - lastScheduledTime;
    // If a cleanup was scheduled recently, skip scheduling
    if (lastTriggerPeriod < CLEANUP_COOLDOWN) {
        return;
    }

    const current = getWatcherCount();
    const delta = Math.abs(current - lastWatcherCount);  // significant + or -

    // If change not large enough, skip scheduling
    if (delta <= CLEANUP_TRIGGER_DELTA) {
        lastWatcherCount = current;
        return;
    }

    // Prevent re-scheduling: set timestamp early
    lastScheduledTime = now;

    // Clear previous scheduled cleanup (if any)
    if (scheduledCleanup) {
        clearTimeout(scheduledCleanup);
    }

    // Schedule cleanup after UI stabilizes (delay prevents aggressive cleanup)
    scheduledCleanup = setTimeout(() => {
        cleanupStaleWatchers();
        scheduledCleanup = null;
    }, CLEANUP_DELAY);

    lastWatcherCount = current;
};
// Utility functions
export const isFirstTimeChange = (v: any): boolean => v === FIRST_TIME_WATCH;

export const debounce = (fn: Function, wait: number = DEBOUNCE_WAIT) => {
    let timeout: any;
    return (...args: any[]) => {
        window['__zone_symbol__clearTimeout'](timeout);
        timeout = window['__zone_symbol__setTimeout'](() => fn(...args), wait);
    };
};

export const muteWatchers = (): void => {
    muted = true;
};

export const unMuteWatchers = (): void => {
    muted = false;
    triggerWatchers();
};

/**
 * Extracts widget ID from identifier (e.g., "widget-id23_eventsource" -> "widget-id23")
 */
const getWidgetId = (identifier: string): string | null => {
    if (!identifier || typeof identifier !== 'string') {
        return null;
    }
    const match = identifier.match(WIDGET_ID_REGEX);
    return match ? match[1] : null;
};

/**
 * Extracts property name from identifier (e.g., "widget-id23_eventsource" -> "eventsource")
 */
const getPropertyName = (identifier: string): string => {
    if (!identifier || typeof identifier !== 'string') {
        return identifier;
    }
    const match = identifier.match(WIDGET_PROPERTY_REGEX);
    return match ? match[1] : identifier;
};

/**
 * Array consumer wrapper for array-based expressions
 */
const arrayConsumer = (listenerFn: any, restExpr: string, newVal: any, oldVal: any): void => {
    if (!isArray(newVal)) {
        return;
    }

    let formattedData = newVal.map(datum => findValueOf(datum, restExpr));

    // Flatten if result is array of arrays
    if (isArray(formattedData[0])) {
        formattedData = flatten(formattedData);
    }

    listenerFn(formattedData, oldVal);
};

/**
 * Updates watch info for array expressions
 */
const getUpdatedWatchInfo = (expr: string, acceptsArray: boolean, listener: any) => {
    const regex = /\[\$i\]/g;

    if (!acceptsArray) {
        return {
            expr: expr.replace(regex, ARRAY_INDEX_ZERO),
            listener
        };
    }

    const lastIndex = expr.lastIndexOf(ARRAY_INDEX_PLACEHOLDER);
    const baseExpr = expr.substring(0, lastIndex).replace(ARRAY_INDEX_PLACEHOLDER, ARRAY_INDEX_ZERO);
    const restExpr = expr.substring(lastIndex + 5);

    const arrayConsumerFn = restExpr
        ? arrayConsumer.bind(undefined, listener, restExpr)
        : listener;

    return {
        expr: baseExpr,
        listener: arrayConsumerFn
    };
};

/**
 * Determines if an expression is static (doesn't need to be watched)
 */

const isStaticExpression = (expr: any, $scope?: any, $locals?: any): boolean => {
    if (typeof expr !== 'string') {
        return false;
    }

    const trimmedExpr = expr.trim();

    // CRITICAL: Check for function calls FIRST (even if quoted) - these are ALWAYS dynamic
    // Function calls like skippable(), cancelable(), 'disableDone()', etc. need to be watched dynamically
    // because they can return different values on each evaluation
    if (trimmedExpr.includes('(') && trimmedExpr.includes(')')) {
        return false; // Function calls are dynamic (not static), even if quoted
    }

    // CRITICAL: appLocale expressions are ALWAYS static (localization strings)
    // Check FIRST before any other logic to ensure they're never treated as dynamic
    // This includes: appLocale.*, Page.appLocale.*, Prefab.appLocale.*, Partial.appLocale.*, App.appLocale.*
    // Examples: appLocale.transferAmtBtnInv_InfoEquityWashText2, Prefab.appLocale.tabiLine3MsgLabel, etc.
    // Check both quoted and unquoted appLocale expressions
    let exprToCheck = trimmedExpr;
    if ((trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) ||
        (trimmedExpr.startsWith("'") && trimmedExpr.endsWith("'"))) {
        exprToCheck = trimmedExpr.slice(1, -1); // Remove quotes for checking
    }
    
    if (exprToCheck.startsWith('appLocale') || 
        exprToCheck.startsWith('Page.appLocale') || 
        exprToCheck.startsWith('Prefab.appLocale') || 
        exprToCheck.startsWith('Partial.appLocale') ||
        exprToCheck.startsWith('App.appLocale')) {
        return true; // All appLocale expressions are static (even if quoted)
    }

    // CRITICAL: Check for quoted strings - plain quoted strings are static
    // Expressions with dots (.) or function calls inside quotes are dynamic
    // Examples: 'iconclass' -> static, 'some.property' -> dynamic, 'disableDone()' -> dynamic
    if ((trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) ||
        (trimmedExpr.startsWith("'") && trimmedExpr.endsWith("'"))) {
        // If it's a quoted string, check if it contains dots or function calls
        const content = trimmedExpr.slice(1, -1); // Remove quotes
        if (content.includes('.') || content.includes('(') || content.includes(')')) {
            return false; // Quoted expressions with dots or function calls are dynamic
        }
        return true; // Plain quoted strings without dots or function calls are static
    }

    // IMPORTANT: Check for Page/Prefab/Partial/App scoped expressions EARLY
    // These expressions (e.g., Page.abc, Partial.abc, Prefab.abc, App.abc) are ALWAYS dynamic
    // regardless of whether abc is a string, function, variable, or any other type
    // They need to be watched dynamically and should NEVER be treated as static
    // Exception: appLocale expressions are static even when scoped (handled above)
    if (trimmedExpr.startsWith('Page.') || trimmedExpr.startsWith('Prefab.') || trimmedExpr.startsWith('Partial.') || trimmedExpr.startsWith('App.')) {
        // All scoped expressions are dynamic (appLocale already handled above)
        return false;
    }

    // Literal values are static
    if (trimmedExpr === 'true' || trimmedExpr === 'false' || trimmedExpr === 'null' || trimmedExpr === 'undefined') {
        return true;
    }

    // Numeric literals
    if (!isNaN(Number(trimmedExpr)) && trimmedExpr.trim() !== '') {
        return true;
    }

    // Check if expression contains Variables., Actions., Widgets., or row. - these are dynamic and should be watched
    if (trimmedExpr.includes('Variables.') || trimmedExpr.includes('Actions.') || trimmedExpr.includes('Widgets.') || 
        trimmedExpr.includes('row.')) {
        return false;
    }

    // Get scope type if available
    const scopeType = $scope !== undefined ? getScopeType($scope) : null;

    // Simple identifier without special characters
    // Check if it might be a scoped variable (e.g., welcomeMessage -> Page.welcomeMessage)
    // Only check simple identifiers (single word, no dots, brackets, etc.)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmedExpr)) {
        // If we have scope information, check if this identifier resolves to a scoped variable
        if ($scope !== undefined && scopeType) {
            const scopedExpr = `${scopeType}.${trimmedExpr}`;
            try {
                const scopedFn = $parseExpr(scopedExpr);
                const scopedValue = scopedFn($scope, $locals);
                // If the scoped expression evaluates successfully, it's a scoped variable
                // and should return false (not static) - these need to be watched dynamically
                return false;
            } catch (scopedE) {
                // If scoped expression doesn't exist, check if the simple identifier itself exists in scope
                // This handles cases where the variable might be directly on the scope (not as Page.xxx)
                try {
                    const fn = $parseExpr(trimmedExpr);
                    const value = fn($scope, $locals);
                    // If it evaluates, it's a variable that can change, so it's not static
                    return false;
                } catch (e) {
                    // If neither scoped nor direct evaluation works, treat as static (backward compatibility)
                    return true;
                }
            }
        }
        // If no scope information, we can't determine if it's scoped, so treat as static (backward compatibility)
        return true;
    }

    // Everything else is dynamic - including:
    // - Component properties (isOpen, content, etc.)
    // - Expressions with dots, brackets, operators, etc.
    // - row.getProperty() calls (data can change)
    // - Variables, Actions, Widgets references
    // - Any expressions with operators, functions, etc.
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

    // Handle static expressions
    if (isStaticExpression(expr, $scope, $locals)) {
        // Check if it's an appLocale expression - these should never be added to registry
        const trimmedExpr = typeof expr === 'string' ? expr.trim() : '';
        const isAppLocale = trimmedExpr.includes('appLocale') || 
                           trimmedExpr.startsWith('Page.appLocale.') || 
                           trimmedExpr.startsWith('Prefab.appLocale.') || 
                           trimmedExpr.startsWith('Partial.appLocale.') ||
                           trimmedExpr.startsWith('App.appLocale.');
        
        try {
            const fn = $parseExpr(expr);
            const staticValue = fn($scope, $locals);
            listener(staticValue, FIRST_TIME_WATCH);
        } catch (e) {
            console.warn(`Error evaluating static expression '${expr}':`, e);
            // If it's an appLocale expression, don't add to registry even if evaluation fails
            if (isAppLocale) {
                return () => { }; // No-op unsubscribe
            }
            // For other static expressions, if evaluation fails, fall through to normal watch registration
            // This ensures the app doesn't break if expression evaluation fails
        }
        
        // Warn if a scoped expression was treated as static (should not happen)
        if (typeof expr === 'string' && (expr.startsWith('Page.') || expr.startsWith('Prefab.') || expr.startsWith('Partial.') || expr.startsWith('App.')) && !isAppLocale) {
            console.warn('Scoped expression was treated as static and NOT added to registry! This should not happen.', {
                expr,
                scopeType: getScopeType($scope)
            });
        }
        
        return () => { }; // No-op unsubscribe
    }

    // CRITICAL: Double-check for static expressions before adding to registry
    // This is a safety net in case isStaticExpression didn't catch them
    const trimmedExpr = typeof expr === 'string' ? expr.trim() : '';
    
    // IMPORTANT: Check for function calls FIRST (even if quoted) - these are ALWAYS dynamic
    // Function calls like 'disableDone()' should be watched, not treated as static strings
    if (trimmedExpr.includes('(') && trimmedExpr.includes(')')) {
        // Function calls are dynamic - let them proceed to be added to registry
        // Don't return early here
    } else {
        // Check for string literals (quoted strings) - these should NEVER be in the registry
        // Only check if it's NOT a function call (already handled above)
        if ((trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) ||
            (trimmedExpr.startsWith("'") && trimmedExpr.endsWith("'"))) {
            // Check if quoted string contains dots or function calls - these are dynamic
            const content = trimmedExpr.slice(1, -1); // Remove quotes
            if (content.includes('.') || content.includes('(') || content.includes(')')) {
                // Quoted expressions with dots or function calls are dynamic - let them proceed
                // Don't return early here
            } else {
                // Plain string literals should never be in the registry - evaluate once and return
                try {
                    const fn = $parseExpr(expr);
                    const staticValue = fn($scope, $locals);
                    listener(staticValue, FIRST_TIME_WATCH);
                } catch (e) {
                    console.warn(`Error evaluating string literal '${expr}':`, e);
                }
                return () => { }; // No-op unsubscribe
            }
        }
    }
    
    // Check for appLocale expressions (check both quoted and unquoted)
    let exprToCheckForAppLocale = trimmedExpr;
    if ((trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) ||
        (trimmedExpr.startsWith("'") && trimmedExpr.endsWith("'"))) {
        exprToCheckForAppLocale = trimmedExpr.slice(1, -1); // Remove quotes for checking
    }
    
    if (exprToCheckForAppLocale.includes('appLocale')) {
        // Check if it's an appLocale expression (any format, quoted or unquoted)
        const isAppLocaleExpr = exprToCheckForAppLocale.startsWith('appLocale') ||
            exprToCheckForAppLocale.startsWith('Page.appLocale') ||
            exprToCheckForAppLocale.startsWith('Prefab.appLocale') ||
            exprToCheckForAppLocale.startsWith('Partial.appLocale') ||
            exprToCheckForAppLocale.startsWith('App.appLocale');
        
        if (isAppLocaleExpr) {
            // appLocale expressions should never be in the registry - evaluate once and return
            try {
                const fn = $parseExpr(expr);
                const staticValue = fn($scope, $locals);
                listener(staticValue, FIRST_TIME_WATCH);
            } catch (e) {
                console.warn(`Error evaluating appLocale expression '${expr}':`, e);
            }
            return () => { }; // No-op unsubscribe
        }
    }

    const fn = $parseExpr(expr);
    const scopeType = getScopeType($scope);
    const scopeName = getScopeName($scope, scopeType);

    const destroyFn = () => $unwatch(identifier);
    const watchInfo: WatchInfo = {
        fn: fn.bind(null, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted,
        scopeType,
        scopeName,
        destroyFn
    };

    // Store in registry
    const widgetId = getWidgetId(identifier);

    if (widgetId) {
        const propertyName = getPropertyName(identifier);
        if (!registry.has(widgetId)) {
            registry.set(widgetId, {});
        }
        const widgetGroup = registry.get(widgetId);
        widgetGroup[propertyName] = watchInfo;
    } else {
        registry.set(identifier, watchInfo);
    }

    return destroyFn;
};

/**
 * Unwatches a single identifier
 */
export const $unwatch = (identifier: string): boolean => {
    const widgetId = getWidgetId(identifier);

    if (widgetId) {
        const propertyName = getPropertyName(identifier);
        const widgetGroup = registry.get(widgetId);

        //@ts-ignore
        if (widgetGroup && typeof widgetGroup === 'object' && !widgetGroup.fn) {
            const watchInfo = widgetGroup[propertyName];
            if (watchInfo) {
                delete widgetGroup[propertyName];
                // Clean up empty widget groups
                if (Object.keys(widgetGroup).length === 0) {
                    registry.delete(widgetId);
                }
                return true;
            }
        }
    }

    // Fallback to direct lookup
    if (registry.has(identifier)) {
        registry.delete(identifier);
        return true;
    }

    return false;
};

/**
 * Unwatches all watchers for a specific widget ID
 */
export const $unwatchAll = (widgetId: string): number => {
    // if (!widgetId || typeof widgetId !== 'string') {
    //     return 0;
    // }

    // const widgetGroup = registry.get(widgetId);

    // if (widgetGroup && typeof widgetGroup === 'object' && !widgetGroup.fn) {
    //     const count = Object.keys(widgetGroup).length;
    //     registry.delete(widgetId);
    //     return count;
    // }

    // // Fallback: find all identifiers starting with this widget ID
    // let removedCount = 0;
    // const identifiersToRemove: string[] = [];

    // registry.forEach((_, key) => {
    //     if (key.startsWith(widgetId + '_')) {
    //         identifiersToRemove.push(key);
    //     }
    // });

    // identifiersToRemove.forEach(identifier => {
    //     if ($unwatch(identifier)) {
    //         removedCount++;
    //     }
    // });

    return 0;
};

/**
 * Unwatches all watchers for a specific scope (Page, Prefab, Partial, or App)
 * Now works directly with the main registry instead of separate scoped registries
 */
export const $unwatchAllByScope = (scopeType: ScopeType, scopeName?: string): number => {
    // if (!scopeType) {
    //     return 0;
    // }

    // let removedCount = 0;
    // const identifiersToRemove: string[] = [];

    // registry.forEach((value, key) => {
    //     // Handle grouped structure (widget groups)
    //     if (value && typeof value === 'object' && !value.fn) {
    //         Object.entries(value).forEach(([propertyName, watchInfo]: [string, any]) => {
    //             if (watchInfo?.scopeType === scopeType &&
    //                 (!scopeName || watchInfo.scopeName === scopeName)) {
    //                 identifiersToRemove.push(`${key}_${propertyName}`);
    //             }
    //         });
    //     } else {
    //         // Direct watchInfo
    //         const watchInfo = value as WatchInfo;
    //         if (watchInfo?.scopeType === scopeType &&
    //             (!scopeName || watchInfo.scopeName === scopeName)) {
    //             identifiersToRemove.push(key);
    //         }
    //     }
    // });

    // // Unwatch all collected identifiers
    // identifiersToRemove.forEach(identifier => {
    //     if ($unwatch(identifier)) {
    //         removedCount++;
    //     }
    // });

    return 0;
};

/**
 * Processes a single watch info during trigger cycle
 */
const processWatchInfo = (watchInfo: WatchInfo): boolean => {
    if (!watchInfo?.fn || (watchInfo.isMuted?.() ?? false)) {
        return false;
    }

    let newValue: any;
    try {
        newValue = watchInfo.fn();
    } catch (e) {
        console.warn(`Error executing expression: '${watchInfo.expr}'`, e);
        return false;
    }

    if (isEqual(newValue, watchInfo.last)) {
        return false;
    }

    // Change detected
    changedByWatch = true;
    watchInfo.last = isObject(newValue) && !watchInfo.doNotClone
        ? clone(newValue)
        : newValue;

    watchInfo.listener(newValue, watchInfo.last === newValue ? FIRST_TIME_WATCH : watchInfo.last);
    changedByWatch = false;

    return true;
};

/**
 * Triggers all watchers
 */
const triggerWatchers = (ignoreMuted: boolean = false): void => {
    if (muted && !ignoreMuted) {
        return;
    }

    let pass = 1;
    let changeDetected: boolean;

    do {
        changeDetected = false;

        registry.forEach((value) => {
            // Handle grouped structure
            if (value && typeof value === 'object' && !value.fn) {
                Object.values(value).forEach((watchInfo: any) => {
                    if (processWatchInfo(watchInfo)) {
                        changeDetected = true;
                    }
                });
            } else {
                // Direct watchInfo
                if (processWatchInfo(value as WatchInfo)) {
                    changeDetected = true;
                }
            }
        });

        pass++;
    } while (changeDetected && pass < MAX_WATCH_CYCLES);

    // Schedule cleanup after watchers are triggered
    scheduleThresholdCleanup();
    if (changeDetected && pass === MAX_WATCH_CYCLES) {
        // console.warn(`Watch cycles exceeded limit of ${MAX_WATCH_CYCLES}`);
    }
};

// Angular zone integration
export const setNgZone = (zone: any): void => {
    ngZone = zone;
};

export const setAppRef = (ref: any): void => {
    appRef = ref;
};

export const isChangeFromWatch = (): boolean => changedByWatch;
export const resetChangeFromWatch = (): void => {
    changedByWatch = false;
};

// Debounced trigger
const debouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    ngZone.run(() => triggerWatchers());
}, DEBOUNCE_WAIT);

export const $invokeWatchers = (force: boolean = false, ignoreMuted: boolean = false): void => {
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
    const $RAF = window.requestAnimationFrame;

    return (force: boolean = false): void => {
        if (!appRef) {
            return;
        }

        if (force) {
            ngZone.run(() => appRef.tick());
            queued = false;
        } else {
            if (queued) {
                return;
            }
            queued = true;
            $RAF(() => {
                ngZone.run(() => appRef.tick());
                queued = false;
            });
        }
    };
})();

// Export registry for debugging
(window as any).watchRegistry = registry;
