import { IDGenerator } from './id-generator';

import { $parseExpr } from './expression-parser';
import { findValueOf } from './utils';
import {clone, flatten, isArray, isEqual, isObject} from "lodash-es";

const registry = new Map<string, any>();

// Separate registries for scoped expressions
if (typeof window !== 'undefined') {
    if (!window['PageScoped']) {
        window['PageScoped'] = new Map<string, any>();
    }
    if (!window['PrefabScoped']) {
        window['PrefabScoped'] = new Map<string, any>();
    }
    if (!window['PartialScoped']) {
        window['PartialScoped'] = new Map<string, any>();
    }
}

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
 * Gets the scope type (Page, Prefab, or Partial) from the scope object
 */
const getScopeType = ($scope: any): 'Page' | 'Prefab' | 'Partial' | null => {
    if (!$scope) {
        return null;
    }
    
    // Check for pageName property (Page scope)
    if ($scope.pageName) {
        return 'Page';
    }
    
    // Check for prefabName property (Prefab scope)
    if ($scope.prefabName) {
        return 'Prefab';
    }
    
    // Check for partialName property (Partial scope)
    if ($scope.partialName) {
        return 'Partial';
    }
    
    return null;
};

/**
 * Detects if an expression is static (doesn't change during runtime)
 * Static expressions can be evaluated once and don't need to be watched
 */
const isStaticExpression = (expr: string, $scope?: any, $locals?: any): boolean => {
    if (typeof expr !== 'string') {
        return false;
    }
    
    const trimmedExpr = expr.trim();
    
    // appLocale expressions are static (localization strings)
    // This includes: appLocale.*, Page.appLocale.*, Prefab.appLocale.*, Partial.appLocale.*
    if (trimmedExpr.includes('appLocale')) {
        // Check if it's appLocale at the start
        if (trimmedExpr.startsWith('appLocale') && 
            (trimmedExpr.length === 9 || trimmedExpr[9] === '.' || trimmedExpr[9] === '[')) {
            return true;
        }
        // Check if it's Page.appLocale.*, Prefab.appLocale.*, or Partial.appLocale.*
        if (trimmedExpr.startsWith('Page.appLocale.') || 
            trimmedExpr.startsWith('Prefab.appLocale.') || 
            trimmedExpr.startsWith('Partial.appLocale.')) {
            return true;
        }
    }
    
    // Literal values are static
    // Check for string literals (single or double quotes)
    if ((trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) ||
        (trimmedExpr.startsWith("'") && trimmedExpr.endsWith("'"))) {
        return true;
    }
    
    // Check for boolean literals
    if (trimmedExpr === 'true' || trimmedExpr === 'false') {
        return true;
    }
    
    // Check for null/undefined
    if (trimmedExpr === 'null' || trimmedExpr === 'undefined') {
        return true;
    }

    const staticExpressionNames = [
        'row.getProperty(\'investment\')',
        'row.getProperty(\'factsheetLink\')',
        'row.getProperty(\'isRebalanceEligible\')'
    ];
    
    // Check if expression is in staticExpressionNames - these are always static
    if (staticExpressionNames.includes(trimmedExpr)) {
        return true;
    }
    
    // Check if expression contains Variables., Actions., Widgets., row., or any dot (.) - these are dynamic and should be watched
    if (trimmedExpr.includes('Variables.') || trimmedExpr.includes('Actions.') || trimmedExpr.includes('Widgets.') || 
        trimmedExpr.includes('row.') || trimmedExpr.includes('.')) {
        // Exception: appLocale expressions are static even with dots
        if (trimmedExpr.includes('appLocale')) {
            return true;
        }
        // console.log('isStaticExpression: Expression contains Variables/Actions/Widgets/row. or dot, returning false (not static)', {
        //     trimmedExpr
        // });
        return false;
    }
    
    // Get scope type if available (after staticExpressionNames check)
    const scopeType = $scope !== undefined ? getScopeType($scope) : null;
    
    // Check for Page/Prefab/Partial scoped expressions (e.g., Page.stvdata, Prefab.smpdata)
    // BUT exclude appLocale expressions which are static (e.g., Prefab.appLocale.*)
    // These should always return false (not static) - they need to be watched dynamically
    if (trimmedExpr.startsWith('Page.') || trimmedExpr.startsWith('Prefab.') || trimmedExpr.startsWith('Partial.')) {
        // Exception: appLocale expressions are static even when scoped
        if (trimmedExpr.includes('.appLocale.')) {
            return true;
        }
        console.log('isStaticExpression: Scoped expression detected, returning false (not static)', {
            trimmedExpr,
            scopeType,
            hasScope: !!$scope,
            scopeKeys: $scope ? Object.keys($scope).slice(0, 10) : []
        });
        return false;
    }
    
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
                console.log('Simple identifier is a scoped variable, returning false (not static):', {
                    trimmedExpr,
                    scopedExpr,
                    scopeType,
                    scopedValue: scopedValue
                });
                return false;
            } catch (scopedE) {
                // If scoped expression doesn't exist, check if the simple identifier itself exists in scope
                // This handles cases where the variable might be directly on the scope (not as Page.xxx)
                try {
                    const fn = $parseExpr(trimmedExpr);
                    const value = fn($scope, $locals);
                    // If it evaluates, it's a variable that can change, so it's not static
                    console.log('Simple identifier exists in scope as a variable, returning false (not static):', {
                        trimmedExpr,
                        scopeType,
                        value: value
                    });
                    return false;
                } catch (e) {
                    // If neither scoped nor direct evaluation works, treat as static (backward compatibility)
                    console.log('Simple identifier does not resolve to any variable, treating as static:', {
                        trimmedExpr,
                        scopeType,
                        scopedExpr,
                        scopedError: scopedE.message,
                        directError: e.message
                    });
                    return true;
                }
            }
        }
        // If no scope information, we can't determine if it's scoped, so treat as static (backward compatibility)
        // But log it for debugging
        console.log('Simple identifier - no scope information available, treating as static:', {
            trimmedExpr
        });
        return true;
    }
    
    // Everything else is dynamic - including:
    // - Component properties (isOpen, content, etc.)
    // - Expressions with dots, brackets, operators, etc.
    // - row.getProperty() calls (data can change)
    // - Variables, Actions, Widgets references
    // - Any expressions with operators, functions, etc.
    
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
    // Debug logging for scoped expressions (Page.*, Prefab.*, Partial.*)
    if (typeof expr === 'string' && (expr.startsWith('Page.') || expr.startsWith('Prefab.') || expr.startsWith('Partial.'))) {
        const isStatic = isStaticExpression(expr, $scope, $locals);
        console.log('$watch called for scoped expression:', {
            expr,
            isStatic,
            willBeAddedToRegistry: !isStatic,
            scopeType: $scope ? getScopeType($scope) : 'no scope'
        });
    }
    
    // OPTIMIZATION: Evaluate static expressions once and skip registry
    // Static expressions (appLocale, static properties) don't change during runtime
    if (typeof expr === 'string' && isStaticExpression(expr, $scope, $locals)) {
        // Check if it's an appLocale expression - these should never be added to registry
        const trimmedExpr = expr.trim();
        const isAppLocale = trimmedExpr.includes('appLocale') || 
                           trimmedExpr.startsWith('Page.appLocale.') || 
                           trimmedExpr.startsWith('Prefab.appLocale.') || 
                           trimmedExpr.startsWith('Partial.appLocale.');
        
        // Evaluate once immediately
        const fn = $parseExpr(expr);
        try {
            const value = fn($scope, $locals);
            // Call listener to set the value (triggers initial update)
            listener(value, FIRST_TIME_WATCH);
            // Return no-op unwatch function (nothing to unwatch, not added to registry)
            if (typeof expr === 'string' && (expr.startsWith('Page.') || expr.startsWith('Prefab.') || expr.startsWith('Partial.')) && !isAppLocale) {
                console.warn('Scoped expression was treated as static and NOT added to registry! This should not happen.', {
                    expr,
                    scopeType: $scope ? getScopeType($scope) : 'no scope'
                });
            }
            return () => {};
        } catch (e) {
            console.warn(`error in evaluating static expression: '${expr}'`, e);
            // If it's an appLocale expression, don't add to registry even if evaluation fails
            if (isAppLocale) {
                console.log('appLocale expression evaluation failed, but not adding to registry (appLocale is always static)', {
                    expr
                });
                return () => {};
            }
            // For other static expressions, if evaluation fails, fall through to normal watch registration
            // This ensures the app doesn't break if expression evaluation fails
        }
    }
    
    // Normal flow for dynamic expressions (non-static)
    if (expr.indexOf('[$i]') !== -1) {
        let watchInfo = getUpdatedWatcInfo(expr, config && (config.arrayType || config.isList), listener);
        expr = watchInfo.expr;
        listener = watchInfo.listener;
    }
    
    // OPTIMIZATION: Apply throttling for low-priority watchers (after array handling)
    let wrappedListener = listener;
    if (config && config.throttle && config.throttle > 0) {
        const throttleMs = config.throttle;
        let lastCall = 0;
        let pendingValue: any = null;
        let pendingOldValue: any = null;
        let timeoutId: any = null;
        
        wrappedListener = (nv, ov) => {
            const now = Date.now();
            pendingValue = nv;
            pendingOldValue = ov;
            
            if (now - lastCall >= throttleMs) {
                lastCall = now;
                listener(nv, ov);
                pendingValue = null;
                pendingOldValue = null;
                if (timeoutId) {
                    window['__zone_symbol__clearTimeout'](timeoutId);
                    timeoutId = null;
                }
            } else if (!timeoutId) {
                // Schedule delayed call if not already scheduled
                const remaining = throttleMs - (now - lastCall);
                timeoutId = window['__zone_symbol__setTimeout'](() => {
                    if (pendingValue !== null) {
                        lastCall = Date.now();
                        listener(pendingValue, pendingOldValue);
                        pendingValue = null;
                        pendingOldValue = null;
                    }
                    timeoutId = null;
                }, remaining);
            }
        };
    }
    const fn = $parseExpr(expr);

    // Debug logging for scoped expressions being added to registry
    if (typeof expr === 'string' && (expr.startsWith('Page.') || expr.startsWith('Prefab.') || expr.startsWith('Partial.'))) {
        console.log('Adding scoped expression to registry:', {
            expr,
            identifier,
            hasFn: !!fn,
            fnType: typeof fn,
            scopeType: $scope ? getScopeType($scope) : 'no scope',
            isStatic: isStaticExpression(expr, $scope, $locals)
        });
    }

    try {
        const boundFn = fn.bind(null, $scope, $locals);
        const watchInfo = {
            fn: boundFn,
            listener: wrappedListener,
            expr,
            last: FIRST_TIME_WATCH,
            doNotClone,
            isMuted: isMuted
        };
        
        registry.set(identifier, watchInfo);
        
        // Also add to appropriate scoped registry if it's a scoped expression
        if (typeof expr === 'string' && typeof window !== 'undefined') {
            const scopeType = $scope ? getScopeType($scope) : null;
            
            if (expr.startsWith('Page.')) {
                window['PageScoped'].set(identifier, watchInfo);
                console.log('📄 PAGE-SCOPED expression added to registry:', {
                    expr,
                    identifier,
                    scopeType: scopeType || 'unknown',
                    registrySize: registry.size,
                    pageScopedSize: window['PageScoped'].size
                });
            } else if (expr.startsWith('Prefab.')) {
                window['PrefabScoped'].set(identifier, watchInfo);
                console.log('🧩 PREFAB-SCOPED expression added to registry:', {
                    expr,
                    identifier,
                    scopeType: scopeType || 'unknown',
                    registrySize: registry.size,
                    prefabScopedSize: window['PrefabScoped'].size
                });
            } else if (expr.startsWith('Partial.')) {
                window['PartialScoped'].set(identifier, watchInfo);
                console.log('📋 PARTIAL-SCOPED expression added to registry:', {
                    expr,
                    identifier,
                    scopeType: scopeType || 'unknown',
                    registrySize: registry.size,
                    partialScopedSize: window['PartialScoped'].size
                });
            } else if (scopeType) {
                // Check if simple identifier (single word, no dots/brackets) resolves to a scoped variable
                // Only check actual simple identifiers, not complex expressions
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
                    const scopedExpr = `${scopeType}.${expr}`;
                    try {
                        const scopedFn = $parseExpr(scopedExpr);
                        const scopedValue = scopedFn($scope, $locals);
                        // If it resolves, it's a scoped variable - add to appropriate scoped registry
                        const scopedRegistry = window[`${scopeType}Scoped`];
                        if (scopedRegistry) {
                            scopedRegistry.set(identifier, watchInfo);
                        }
                        console.log(`🔍 ${scopeType.toUpperCase()}-SCOPED variable (resolved from simple identifier) added to registry:`, {
                            originalExpr: expr,
                            resolvedExpr: scopedExpr,
                            identifier,
                            scopeType: scopeType,
                            registrySize: registry.size,
                            scopedRegistrySize: scopedRegistry ? scopedRegistry.size : 0
                        });
                    } catch (e) {
                        // Not a scoped variable, ignore
                    }
                }
            }
        }
    } catch (e) {
        console.error(`Error adding expression '${expr}' to registry:`, e);
        throw e;
    }

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
        
        // Also remove from scoped registries if present
        if (typeof window !== 'undefined' && watchInfo.expr && typeof watchInfo.expr === 'string') {
            if (watchInfo.expr.startsWith('Page.')) {
                window['PageScoped']?.delete(identifier);
            } else if (watchInfo.expr.startsWith('Prefab.')) {
                window['PrefabScoped']?.delete(identifier);
            } else if (watchInfo.expr.startsWith('Partial.')) {
                window['PartialScoped']?.delete(identifier);
            }
        }
    }
    return registry.delete(identifier);
};

let changedByWatch = false;

const $RAF = window.requestAnimationFrame;

let ngZone;

const shouldProcessWatcher = (watchInfo: any): boolean => {
    if (!watchInfo) {
        return false;
    }
    if (typeof watchInfo.fn !== 'function' || typeof watchInfo.listener !== 'function') {
        return false;
    }
    if (!watchInfo.isMuted) {
        return true;
    }
    if (typeof watchInfo.isMuted === 'function') {
        try {
            return !watchInfo.isMuted();
        } catch (e) {
            console.warn('Error while evaluating watcher mute state:', e);
            return true;
        }
    }
    return false;
};

const triggerWatchers = (ignoreMuted?: boolean) => {

    if (muted && !ignoreMuted) {
        return;
    }

    const limit = 3;
    let pass = 1;
    let changeDetected;

    do {
        changeDetected = false;
        
        // OPTIMIZATION: Filter out muted watchers before iteration
        // This avoids calling isMuted() repeatedly and skips expression evaluation for muted watchers
        const activeWatchers: Array<[string, any]> = [];
        registry.forEach((watchInfo, identifier) => {
            if (shouldProcessWatcher(watchInfo)) {
                activeWatchers.push([identifier, watchInfo]);
            }
        });
        
        // Only iterate through non-muted watchers
        activeWatchers.forEach(([identifier, watchInfo]) => {
            // Guard against watchers being cleaned up (listener/fn set to null by $unwatch)
            // This can happen if $unwatch is called while triggerWatchers is running
            // Check watchInfo exists and has required properties
            if (!shouldProcessWatcher(watchInfo)) {
                return; // Skip this watcher - it's being cleaned up or invalid
            }
            
            const fn = watchInfo.fn;
            const listener = watchInfo.listener;
            const ov = watchInfo.last;
            let nv;

            try {
                nv = fn();
            } catch (e) {
                console.warn(`error in executing expression: '${watchInfo.expr}'`);
                return; // Skip listener call if expression evaluation failed
            }

            if (!isEqual(nv, ov)) {
                changeDetected = true;
                changedByWatch = true;
                watchInfo.last = nv;

                // @ts-ignore
                if (isObject(nv) && !watchInfo.doNotClone && nv.__cloneable__ !== false) {
                    watchInfo.last = clone(nv);
                }
                
                // Final check before calling listener - ensure it's still valid
                // Re-check watchInfo.listener in case it was cleared during execution
                const currentListener = watchInfo.listener;
                if (typeof currentListener === 'function') {
                    try {
                        currentListener(nv, ov);
                    } catch (e) {
                        console.warn(`Error in watcher listener for expression '${watchInfo.expr || identifier}':`, e);
                    }
                } else {
                    // Listener was cleared during execution - log for debugging
                    console.warn(`Watcher listener was cleared during execution for identifier: ${identifier}`);
                }
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
    ngZone.runOutsideAngular(() => triggerWatchers());
}, 300);

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
