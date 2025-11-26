import { IDGenerator } from './id-generator';

import { $parseExpr } from './expression-parser';
import { findValueOf } from './utils';
import {clone, flatten, isArray, isEqual, isObject} from "lodash-es";

const registry = new Map<string, any>();

// Separate registries for scoped expressions - these reference the same watchInfo objects as the main registry
// Grouped by widget ID: widget-id3 => { "iconclass": {}, "message": {}, ... }
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
    if (!window['AppScoped']) {
        window['AppScoped'] = new Map<string, any>();
    }
}

/**
 * Extracts widget ID from identifier (e.g., "widget-id23_eventsource" -> "widget-id23")
 */
const getWidgetId = (identifier: string): string | null => {
    if (!identifier || typeof identifier !== 'string') {
        return null;
    }
    
    // Pattern: widget-id23_eventsource -> widget-id23
    const match = identifier.match(/^(widget-[^_]+)/);
    if (match) {
        return match[1];
    }
    
    // Also check for other patterns
    const altMatch = identifier.match(/^(widget-\w+)/);
    if (altMatch) {
        return altMatch[1];
    }
    
    return null;
};

/**
 * Extracts property name from identifier (e.g., "widget-id23_eventsource" -> "eventsource")
 */
const getPropertyName = (identifier: string): string => {
    if (!identifier || typeof identifier !== 'string') {
        return identifier;
    }
    
    // Pattern: widget-id23_eventsource -> eventsource
    const match = identifier.match(/^widget-[^_]+_(.+)$/);
    if (match) {
        return match[1];
    }
    
    // If no widget ID pattern, return the identifier as-is
    return identifier;
};

/**
 * Gets the total count of watchers in the registry
 * Accounts for both grouped structure (widget-id => { property: watchInfo, ... }) and direct watchInfo
 */
const getTotalWatcherCount = (): number => {
    let count = 0;
    registry.forEach((value) => {
        if (value && typeof value === 'object' && !value.fn) {
            // It's a grouped structure - count properties
            count += Object.keys(value).length;
        } else {
            // Direct watchInfo
            count += 1;
        }
    });
    return count;
};

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
 * Static expressions are evaluated once and don't change during runtime
 * @param expr - The expression to check
 * @returns true if the expression is static, false otherwise
 */
const isStaticExpression = (expr: any): boolean => {
    if (typeof expr !== 'string') {
        return false;
    }
    
    const trimmedExpr = expr.trim();
    
    // appLocale expressions are always static (localization strings don't change at runtime)
    // Examples: appLocale.someKey, Page.appLocale.someKey, Prefab.appLocale.someKey, etc.
    if (trimmedExpr.includes('appLocale.') || trimmedExpr.includes('appLocale')) {
        return true;
    }
    
    // Add other static expression patterns here in the future if needed
    // For example: literal values, constants, etc.
    
    return false;
};

/**
 * Gets the scope type (Page, Prefab, Partial, or App) from the scope object
 */
const getScopeType = ($scope: any): 'Page' | 'Prefab' | 'Partial' | 'App' | null => {
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
    
    // Check for App scope - typically is the App instance itself or has App-specific properties
    // App scope is usually the root scope that doesn't have pageName, prefabName, or partialName
    // but has App-specific properties like Variables, Actions, appLocale, etc.
    if ($scope.Variables !== undefined && $scope.Actions !== undefined && 
        !$scope.pageName && !$scope.prefabName && !$scope.partialName) {
        return 'App';
    }
    
    // Also check if it's explicitly the App instance
    if ($scope.constructor && $scope.constructor.name === 'AppRef') {
        return 'App';
    }
    
    return null;
};

export const $watch = (expr, $scope, $locals, listener, identifier = watchIdGenerator.nextUid(), doNotClone = false, config:any={}, isMuted?: () => boolean) => {
    if (expr.indexOf('[$i]') !== -1) {
        let watchInfo = getUpdatedWatcInfo(expr, config && (config.arrayType || config.isList), listener);
        expr = watchInfo.expr;
        listener = watchInfo.listener;
    }
    
    // Check if expression is static - these should not be watched, but listener should be called once
    if (isStaticExpression(expr)) {
        console.log('🚫 STATIC expression - NOT added to watch registry, but calling listener once:', {
            expr: typeof expr === 'string' ? expr.trim() : expr,
            identifier
        });
        
        // For static expressions, evaluate once and call the listener with the initial value
        try {
            const fn = $parseExpr(expr);
            const staticValue = fn($scope, $locals);
            // Call listener once with the static value
            listener(staticValue, FIRST_TIME_WATCH);
        } catch (e) {
            console.warn(`Error evaluating static expression '${expr}':`, e);
            // Call listener with undefined if evaluation fails
            listener(undefined, FIRST_TIME_WATCH);
        }
        
        // Return a no-op unsubscribe function for static expressions
        return () => {};
    }
    
    const fn = $parseExpr(expr);

    // Extract scope information for cleanup
    const scopeType = $scope ? getScopeType($scope) : null;
    const scopeName = scopeType === 'Prefab' ? $scope?.prefabName : 
                     scopeType === 'Partial' ? $scope?.partialName :
                     scopeType === 'Page' ? $scope?.pageName : null;
    
    const watchInfo = {
        fn: fn.bind(null, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted: isMuted,
        scopeType: scopeType,
        scopeName: scopeName
    };

    // Group by widget ID in the main registry
    const widgetId = getWidgetId(identifier);
    const propertyName = getPropertyName(identifier);
    
    if (widgetId) {
        // Group by widget ID: widget-id3 => { "iconclass": {}, "message": {}, ... }
        if (!registry.has(widgetId)) {
            registry.set(widgetId, {});
        }
        const widgetGroup = registry.get(widgetId);
        widgetGroup[propertyName] = watchInfo;
    } else {
        // If no widget ID, store directly with the identifier (backward compatibility)
        registry.set(identifier, watchInfo);
    }

    // Also add to appropriate scoped registry if it's a scoped expression
    if (typeof expr === 'string' && typeof window !== 'undefined') {
        
        if (expr.startsWith('Page.')) {
            // Group by widget ID in PageScoped registry
            if (widgetId) {
                if (!window['PageScoped'].has(widgetId)) {
                    window['PageScoped'].set(widgetId, {});
                }
                const widgetGroup = window['PageScoped'].get(widgetId);
                widgetGroup[propertyName] = watchInfo;
            } else {
                window['PageScoped'].set(identifier, watchInfo);
            }
            
            console.log('📄 PAGE-SCOPED expression added to registries:', {
                expr,
                identifier,
                widgetId: widgetId || 'no widget',
                propertyName: widgetId ? propertyName : 'N/A',
                mainRegistrySize: registry.size,
                totalWatchers: getTotalWatcherCount(),
                pageScopedSize: window['PageScoped'].size
            });
        } else if (expr.startsWith('Prefab.')) {
            // Group by widget ID in PrefabScoped registry
            if (widgetId) {
                if (!window['PrefabScoped'].has(widgetId)) {
                    window['PrefabScoped'].set(widgetId, {});
                }
                const widgetGroup = window['PrefabScoped'].get(widgetId);
                widgetGroup[propertyName] = watchInfo;
            } else {
                window['PrefabScoped'].set(identifier, watchInfo);
            }
            
            console.log('🧩 PREFAB-SCOPED expression added to registries:', {
                expr,
                identifier,
                widgetId: widgetId || 'no widget',
                propertyName: widgetId ? propertyName : 'N/A',
                mainRegistrySize: registry.size,
                totalWatchers: getTotalWatcherCount(),
                prefabScopedSize: window['PrefabScoped'].size
            });
        } else if (expr.startsWith('Partial.')) {
            // Group by widget ID in PartialScoped registry
            if (widgetId) {
                if (!window['PartialScoped'].has(widgetId)) {
                    window['PartialScoped'].set(widgetId, {});
                }
                const widgetGroup = window['PartialScoped'].get(widgetId);
                widgetGroup[propertyName] = watchInfo;
            } else {
                window['PartialScoped'].set(identifier, watchInfo);
            }
            
            console.log('📋 PARTIAL-SCOPED expression added to registries:', {
                expr,
                identifier,
                widgetId: widgetId || 'no widget',
                propertyName: widgetId ? propertyName : 'N/A',
                mainRegistrySize: registry.size,
                totalWatchers: getTotalWatcherCount(),
                partialScopedSize: window['PartialScoped'].size
            });
        } else if (expr.startsWith('App.')) {
            // Group by widget ID in AppScoped registry
            if (widgetId) {
                if (!window['AppScoped'].has(widgetId)) {
                    window['AppScoped'].set(widgetId, {});
                }
                const widgetGroup = window['AppScoped'].get(widgetId);
                widgetGroup[propertyName] = watchInfo;
            } else {
                window['AppScoped'].set(identifier, watchInfo);
            }
            
            console.log('📱 APP-SCOPED expression added to registries:', {
                expr,
                identifier,
                widgetId: widgetId || 'no widget',
                propertyName: widgetId ? propertyName : 'N/A',
                mainRegistrySize: registry.size,
                totalWatchers: getTotalWatcherCount(),
                appScopedSize: window['AppScoped'].size
            });
        } else {
            // Check if simple identifier resolves to a scoped variable
            const scopeType = $scope ? getScopeType($scope) : null;
            if (scopeType && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
                const scopedExpr = `${scopeType}.${expr}`;
                try {
                    const scopedFn = $parseExpr(scopedExpr);
                    const scopedValue = scopedFn($scope, $locals);
                    // If it resolves, it's a scoped variable - add to appropriate scoped registry
                    const scopedRegistry = window[`${scopeType}Scoped`];
                    if (scopedRegistry) {
                        // Group by widget ID in scoped registry
                        if (widgetId) {
                            if (!scopedRegistry.has(widgetId)) {
                                scopedRegistry.set(widgetId, {});
                            }
                            const widgetGroup = scopedRegistry.get(widgetId);
                            widgetGroup[propertyName] = watchInfo;
                        } else {
                            scopedRegistry.set(identifier, watchInfo);
                        }
                        
                        console.log(`🔍 ${scopeType.toUpperCase()}-SCOPED variable (resolved from simple identifier) added to registries:`, {
                            originalExpr: expr,
                            resolvedExpr: scopedExpr,
                            identifier,
                            widgetId: widgetId || 'no widget',
                            propertyName: widgetId ? propertyName : 'N/A',
                            scopeType: scopeType,
                            mainRegistrySize: registry.size,
                            totalWatchers: getTotalWatcherCount(),
                            scopedRegistrySize: scopedRegistry.size
                        });
                    }
                } catch (e) {
                    // Not a scoped variable, ignore
                }
            }
        }
    }

    return () => $unwatch(identifier);
};

export const $unwatch = identifier => {
    const widgetId = getWidgetId(identifier);
    const propertyName = getPropertyName(identifier);
    
    let watchInfo;
    
    // Get watchInfo from grouped structure
    if (widgetId) {
        const widgetGroup = registry.get(widgetId);
        if (widgetGroup && typeof widgetGroup === 'object' && !widgetGroup.fn) {
            // It's a grouped structure
            watchInfo = widgetGroup[propertyName];
            if (watchInfo) {
                delete widgetGroup[propertyName];
                // Clean up empty widget groups
                if (Object.keys(widgetGroup).length === 0) {
                    registry.delete(widgetId);
                }
            }
        } else {
            // Fallback: try direct lookup
            watchInfo = registry.get(identifier);
            if (watchInfo) {
                registry.delete(identifier);
            }
        }
    } else {
        watchInfo = registry.get(identifier);
    if (watchInfo) {
            registry.delete(identifier);
        }
    }
    
    // Also remove from scoped registries if present
    if (watchInfo && typeof window !== 'undefined' && watchInfo.expr && typeof watchInfo.expr === 'string') {
        if (watchInfo.expr.startsWith('Page.')) {
            if (widgetId) {
                const widgetGroup = window['PageScoped']?.get(widgetId);
                if (widgetGroup && typeof widgetGroup === 'object') {
                    delete widgetGroup[propertyName];
                    if (Object.keys(widgetGroup).length === 0) {
                        window['PageScoped']?.delete(widgetId);
                    }
                }
            } else {
                window['PageScoped']?.delete(identifier);
            }
        } else if (watchInfo.expr.startsWith('Prefab.')) {
            if (widgetId) {
                const widgetGroup = window['PrefabScoped']?.get(widgetId);
                if (widgetGroup && typeof widgetGroup === 'object') {
                    delete widgetGroup[propertyName];
                    if (Object.keys(widgetGroup).length === 0) {
                        window['PrefabScoped']?.delete(widgetId);
                    }
                }
            } else {
                window['PrefabScoped']?.delete(identifier);
            }
        } else if (watchInfo.expr.startsWith('Partial.')) {
            if (widgetId) {
                const widgetGroup = window['PartialScoped']?.get(widgetId);
                if (widgetGroup && typeof widgetGroup === 'object') {
                    delete widgetGroup[propertyName];
                    if (Object.keys(widgetGroup).length === 0) {
                        window['PartialScoped']?.delete(widgetId);
                    }
                }
            } else {
                window['PartialScoped']?.delete(identifier);
            }
        } else if (watchInfo.expr.startsWith('App.')) {
            if (widgetId) {
                const widgetGroup = window['AppScoped']?.get(widgetId);
                if (widgetGroup && typeof widgetGroup === 'object') {
                    delete widgetGroup[propertyName];
                    if (Object.keys(widgetGroup).length === 0) {
                        window['AppScoped']?.delete(widgetId);
                    }
                }
            } else {
                window['AppScoped']?.delete(identifier);
            }
        } else {
            // Check if it's in any scoped registry
            const scopeTypes = ['Page', 'Prefab', 'Partial', 'App'];
            scopeTypes.forEach(scopeType => {
                const scopedRegistry = window[`${scopeType}Scoped`];
                if (widgetId) {
                    const widgetGroup = scopedRegistry?.get(widgetId);
                    if (widgetGroup && typeof widgetGroup === 'object') {
                        delete widgetGroup[propertyName];
                        if (Object.keys(widgetGroup).length === 0) {
                            scopedRegistry?.delete(widgetId);
                        }
                    }
                } else {
                    scopedRegistry?.delete(identifier);
                }
            });
        }
    }
    
    return !!watchInfo;
};

/**
 * Unwatch all watchers for a specific widget ID
 * This is useful for cleaning up all watchers when a component is destroyed
 * @param widgetId - The widget ID (e.g., "widget-id23")
 * @returns The number of watchers that were removed
 */
export const $unwatchAll = (widgetId: string): number => {
    if (!widgetId || typeof widgetId !== 'string') {
        return 0;
    }
    
    let removedCount = 0;
    
    // Get the widget group from main registry
    const widgetGroup = registry.get(widgetId);
    if (widgetGroup && typeof widgetGroup === 'object' && !widgetGroup.fn) {
        // It's a grouped structure - unwatch all properties
        const propertyNames = Object.keys(widgetGroup);
        propertyNames.forEach(propertyName => {
            const identifier = `${widgetId}_${propertyName}`;
            if ($unwatch(identifier)) {
                removedCount++;
            }
        });
    } else {
        // Fallback: try to find all identifiers that start with this widget ID
        const identifiersToRemove: string[] = [];
        registry.forEach((value, key) => {
            if (key.startsWith(widgetId + '_')) {
                identifiersToRemove.push(key);
            }
        });
        identifiersToRemove.forEach(identifier => {
            if ($unwatch(identifier)) {
                removedCount++;
            }
        });
    }
    
    return removedCount;
};

/**
 * Unwatch all watchers for a specific scope (Page, Prefab, Partial, or App)
 * This is useful for cleaning up all watchers when a page/prefab/partial/app is destroyed
 * @param scopeType - The scope type ('Page', 'Prefab', 'Partial', or 'App')
 * @param scopeName - Optional scope name (e.g., page name, prefab name) - if provided, only unwatches watchers for that specific scope
 * @returns The number of watchers that were removed
 */
export const $unwatchAllByScope = (scopeType: 'Page' | 'Prefab' | 'Partial' | 'App', scopeName?: string): number => {
    if (!scopeType || typeof window === 'undefined') {
        return 0;
    }
    
    let removedCount = 0;
    const scopedRegistry = window[`${scopeType}Scoped`] as Map<string, any>;
    
    if (!scopedRegistry) {
        return 0;
    }
    
    // Get all widget groups from the scoped registry
    const identifiersToRemove: string[] = [];
    
    scopedRegistry.forEach((widgetGroup, widgetId) => {
        if (widgetGroup && typeof widgetGroup === 'object') {
            // It's a grouped structure - check each watchInfo
            Object.keys(widgetGroup).forEach(propertyName => {
                const watchInfo = widgetGroup[propertyName];
                // If scopeName is provided, only remove watchers that match that scope name
                if (!scopeName || (watchInfo && watchInfo.scopeName === scopeName)) {
                    const identifier = `${widgetId}_${propertyName}`;
                    identifiersToRemove.push(identifier);
                }
            });
        } else {
            // Direct identifier - check if it matches the scope name
            const watchInfo = widgetGroup;
            if (!scopeName || (watchInfo && watchInfo.scopeName === scopeName)) {
                identifiersToRemove.push(widgetId);
            }
        }
    });
    
    // Unwatch all collected identifiers
    identifiersToRemove.forEach(identifier => {
        if ($unwatch(identifier)) {
            removedCount++;
        }
    });
    
    return removedCount;
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
        registry.forEach((value, key) => {
            // Handle grouped structure (widget-id => { property: watchInfo, ... })
            if (value && typeof value === 'object' && !value.fn) {
                // It's a grouped structure - iterate through properties
                Object.values(value).forEach((watchInfo: any) => {
                    if (!watchInfo || typeof watchInfo !== 'object' || !watchInfo.fn) {
                        return;
                    }
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
                        return;
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
            } else {
                // Direct watchInfo (backward compatibility for non-widget identifiers)
                const watchInfo = value;
                if (!watchInfo || typeof watchInfo !== 'object' || !watchInfo.fn) {
                    return;
                }
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
                    return;
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
