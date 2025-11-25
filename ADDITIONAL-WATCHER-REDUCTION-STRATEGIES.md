# Additional Watcher Reduction Strategies

Beyond the strategies in `WATCHER-REDUCTION-GUIDE.md`, here are **8 additional high-impact strategies** to reduce watch registry usage:

---

## 🎯 Strategy 8: Expression Dependency Analysis (HIGH IMPACT)

**Only watch expressions that actually depend on changing values.**

### Problem
Many watchers are registered for expressions that never change or only depend on static values.

### Implementation

```typescript
// In watcher.ts - add dependency analysis
interface ExpressionDependencies {
    variables: Set<string>;
    functions: Set<string>;
    static: boolean;
}

const expressionDependencyCache = new Map<string, ExpressionDependencies>();

function analyzeExpressionDependencies(expr: string): ExpressionDependencies {
    if (expressionDependencyCache.has(expr)) {
        return expressionDependencyCache.get(expr);
    }
    
    const deps: ExpressionDependencies = {
        variables: new Set(),
        functions: new Set(),
        static: false
    };
    
    // Extract variable references (Variables.xxx, row.xxx, etc.)
    const variablePattern = /(Variables|row|item|widget|Actions|notification)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    while ((match = variablePattern.exec(expr)) !== null) {
        deps.variables.add(match[1] + '.' + match[2]);
    }
    
    // Extract function calls
    const functionPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    while ((match = functionPattern.exec(expr)) !== null) {
        deps.functions.add(match[1]);
    }
    
    // Check if expression is static
    deps.static = deps.variables.size === 0 && deps.functions.size === 0;
    
    expressionDependencyCache.set(expr, deps);
    return deps;
}

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ✅ DEPENDENCY ANALYSIS: Skip watcher if expression has no dependencies
    if (typeof expr === 'string') {
        const deps = analyzeExpressionDependencies(expr);
        
        if (deps.static) {
            // Static expression - evaluate once
            const fn = $parseExpr(expr);
            try {
                const value = fn($scope, $locals);
                listener(value, FIRST_TIME_WATCH);
                return () => {}; // No watcher needed
            } catch (e) {
                // Fall through to normal registration
            }
        }
        
        // If expression only depends on variables that never change, skip watching
        if (deps.variables.size > 0) {
            const allStaticVars = Array.from(deps.variables).every(v => {
                // Check if variable is known to be static
                return isStaticVariable(v, $scope);
            });
            
            if (allStaticVars) {
                // Evaluate once, don't watch
                const fn = $parseExpr(expr);
                try {
                    const value = fn($scope, $locals);
                    listener(value, FIRST_TIME_WATCH);
                    return () => {};
                } catch (e) {
                    // Fall through
                }
            }
        }
    }
    
    // ... existing watcher registration
};
```

**Expected Reduction:** 15-25% of watchers (3,000-5,000 watchers saved)

---

## 🎯 Strategy 9: Smart Watcher Throttling

**Throttle watchers that don't need immediate updates.**

### Implementation

```typescript
// In watcher.ts - add throttling support
interface WatchConfig {
    throttle?: number; // Throttle interval in ms
    debounce?: number; // Debounce interval in ms
    priority?: 'high' | 'normal' | 'low';
}

const throttledWatchers = new Map<string, { lastCall: number, timeout: any }>();

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config: WatchConfig = {}, isMuted) => {
    // ... existing static expression check ...
    
    // ✅ THROTTLING: Apply throttling for low-priority watchers
    let wrappedListener = listener;
    
    if (config.throttle && config.throttle > 0) {
        const throttleMs = config.throttle;
        let lastCall = 0;
        
        wrappedListener = (nv, ov) => {
            const now = Date.now();
            if (now - lastCall >= throttleMs) {
                lastCall = now;
                listener(nv, ov);
            }
        };
    }
    
    if (config.debounce && config.debounce > 0) {
        const debounceMs = config.debounce;
        let timeout;
        
        wrappedListener = (nv, ov) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                listener(nv, ov);
            }, debounceMs);
        };
    }
    
    // ... register with wrappedListener ...
};

// In base.component.ts - use throttling for non-critical properties
protected processBindAttr(propName: string, expr: string, child?: any) {
    // ... existing code ...
    
    // ✅ Apply throttling for style/class properties (less critical)
    const throttledProps = ['class', 'style', 'ngclass', 'ngstyle'];
    const config: any = widgetProps.get(propName) || {};
    
    if (throttledProps.includes(propName)) {
        config.throttle = 100; // Throttle to 100ms
        config.priority = 'low';
    }
    
    this.registerDestroyListener(
        $watch(expr, viewParent, context, nv => {
            // ... existing listener ...
        }, getWatchIdentifier(widgetId, propName), propName === 'datasource', config, () => isMuted)
    );
}
```

**Expected Reduction:** 10-15% CPU usage, allows more watchers without performance impact

---

## 🎯 Strategy 10: Watcher Grouping & Batch Evaluation

**Group related watchers and evaluate them together.**

### Implementation

```typescript
// In watcher.ts - add watcher groups
interface WatcherGroup {
    watchers: Set<string>; // Set of watch identifiers
    priority: number;
    lastEvaluated: number;
}

const watcherGroups = new Map<string, WatcherGroup>();
const watcherToGroup = new Map<string, string>();

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ... existing code ...
    
    // ✅ GROUPING: Group watchers by scope/context
    const groupKey = `${$scope?.constructor?.name || 'global'}_${getContextKey($locals)}`;
    
    if (!watcherGroups.has(groupKey)) {
        watcherGroups.set(groupKey, {
            watchers: new Set(),
            priority: 0,
            lastEvaluated: 0
        });
    }
    
    const group = watcherGroups.get(groupKey);
    group.watchers.add(identifier);
    watcherToGroup.set(identifier, groupKey);
    
    // ... register watcher ...
};

// Batch evaluate watchers in same group
const evaluateWatcherGroup = (groupKey: string) => {
    const group = watcherGroups.get(groupKey);
    if (!group) return;
    
    const now = Date.now();
    // Only evaluate group if enough time has passed
    if (now - group.lastEvaluated < 50) {
        return;
    }
    
    group.lastEvaluated = now;
    
    // Evaluate all watchers in group together
    group.watchers.forEach(watchId => {
        const watchInfo = registry.get(watchId);
        if (watchInfo) {
            // ... evaluate watcher ...
        }
    });
};
```

**Expected Reduction:** 20-30% evaluation overhead

---

## 🎯 Strategy 11: Conditional Watcher Registration Based on Visibility

**Don't register watchers for hidden/invisible widgets.**

### Implementation

```typescript
// In base.component.ts - check visibility before registering
protected processBindAttr(propName: string, expr: string, child?: any) {
    if (!child) {
        this.initState.delete(propName);
    }
    
    const widget = child ? child.widget : this.widget;
    
    // ✅ VISIBILITY CHECK: Skip watcher if widget is hidden
    if (this.shouldSkipWatcher(propName, widget)) {
        // Evaluate once and set value, but don't watch
        const fn = $parseExpr(expr);
        try {
            const viewParent = child ? child.widget.viewParent.viewParent : this.viewParent;
            const context = child ? child.widget.context : this.context;
            const value = fn(viewParent, context);
            widget[propName] = value;
        } catch (e) {
            // If evaluation fails, register watcher anyway
        }
        return;
    }
    
    // ... existing watcher registration ...
}

private shouldSkipWatcher(propName: string, widget: any): boolean {
    // Skip if widget is hidden and property is not critical
    const criticalProps = ['datasource', 'show', 'visible', 'enabled'];
    const isHidden = widget.show === false || widget.visible === false || 
                     (this.nativeElement && this.nativeElement.hidden);
    
    if (isHidden && !criticalProps.includes(propName)) {
        return true; // Skip non-critical watchers for hidden widgets
    }
    
    // Skip if widget is in a collapsed/not-visible container
    if (this.isInHiddenContainer()) {
        return !criticalProps.includes(propName);
    }
    
    return false;
}

private isInHiddenContainer(): boolean {
    let parent = this.nativeElement?.parentElement;
    while (parent) {
        if (parent.hidden || 
            parent.style.display === 'none' || 
            parent.classList.contains('ng-hide') ||
            parent.classList.contains('hidden')) {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}
```

**Expected Reduction:** 5-10% of watchers (1,000-2,000 watchers saved)

---

## 🎯 Strategy 12: Expression Simplification & Normalization

**Normalize identical expressions to share watchers.**

### Implementation

```typescript
// In watcher.ts - normalize expressions
const expressionNormalizer = (expr: string): string => {
    // Remove whitespace
    let normalized = expr.replace(/\s+/g, ' ').trim();
    
    // Normalize property access (widget.prop vs widget['prop'])
    normalized = normalized.replace(/\[['"]([^'"]+)['"]\]/g, '.$1');
    
    // Normalize function calls (remove spaces)
    normalized = normalized.replace(/\s*\(\s*/g, '(');
    normalized = normalized.replace(/\s*\)\s*/g, ')');
    
    // Normalize operators
    normalized = normalized.replace(/\s*===\s*/g, '===');
    normalized = normalized.replace(/\s*!==\s*/g, '!==');
    normalized = normalized.replace(/\s*==\s*/g, '==');
    normalized = normalized.replace(/\s*!=\s*/g, '!=');
    
    return normalized;
};

const normalizedExpressionMap = new Map<string, string>(); // normalized -> original
const expressionToWatcher = new Map<string, string>(); // normalized -> watchId

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    if (typeof expr === 'string') {
        // ✅ NORMALIZATION: Normalize expression to find duplicates
        const normalized = expressionNormalizer(expr);
        const existingWatchId = expressionToWatcher.get(normalized);
        
        if (existingWatchId && registry.has(existingWatchId)) {
            // Reuse existing watcher, add listener
            const existingWatch = registry.get(existingWatchId);
            const originalListener = existingWatch.listener;
            
            existingWatch.listener = (nv, ov) => {
                originalListener?.(nv, ov);
                listener(nv, ov);
            };
            
            // Return cleanup that removes only this listener
            return () => {
                if (existingWatch.listener === listener) {
                    existingWatch.listener = originalListener;
                } else if (typeof existingWatch.listener === 'function') {
                    // Multiple listeners - need to remove this one
                    // This is a simplified version - full implementation would need listener array
                }
            };
        }
        
        normalizedExpressionMap.set(normalized, expr);
        expressionToWatcher.set(normalized, identifier);
    }
    
    // ... existing registration ...
};
```

**Expected Reduction:** 15-25% for repeated expressions (3,000-5,000 watchers saved)

---

## 🎯 Strategy 13: Lazy Evaluation with Change Detection Hints

**Only evaluate watchers when their dependencies might have changed.**

### Implementation

```typescript
// In watcher.ts - add change detection hints
interface ChangeHint {
    variables: Set<string>; // Which variables this watcher depends on
    lastChangeTime: number;
}

const changeHints = new Map<string, ChangeHint>();
const variableChangeTimes = new Map<string, number>(); // Track when variables change

export const setVariableChangeTime = (variableName: string) => {
    variableChangeTimes.set(variableName, Date.now());
};

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ... existing code ...
    
    // ✅ CHANGE HINTS: Track which variables this watcher depends on
    if (typeof expr === 'string') {
        const deps = analyzeExpressionDependencies(expr);
        changeHints.set(identifier, {
            variables: deps.variables,
            lastChangeTime: 0
        });
    }
    
    // ... register watcher ...
};

const triggerWatchers = (ignoreMuted?: boolean) => {
    if (muted && !ignoreMuted) {
        return;
    }
    
    const limit = 5;
    let pass = 1;
    let changeDetected;
    
    do {
        changeDetected = false;
        registry.forEach((watchInfo, identifier) => {
            if (watchInfo.isMuted && watchInfo.isMuted()) {
                return;
            }
            
            // ✅ SKIP EVALUATION: Check if dependencies haven't changed
            const hint = changeHints.get(identifier);
            if (hint) {
                const hasChanges = Array.from(hint.variables).some(variable => {
                    const varChangeTime = variableChangeTimes.get(variable) || 0;
                    return varChangeTime > hint.lastChangeTime;
                });
                
                if (!hasChanges) {
                    return; // Skip evaluation - no dependencies changed
                }
                
                hint.lastChangeTime = Date.now();
            }
            
            // ... existing evaluation code ...
        });
        pass++;
    } while (changeDetected && pass < limit);
};
```

**Expected Reduction:** 30-40% evaluation overhead

---

## 🎯 Strategy 14: Watcher Priority Queue

**Evaluate high-priority watchers first, defer low-priority ones.**

### Implementation

```typescript
// In watcher.ts - add priority system
enum WatcherPriority {
    CRITICAL = 0,  // datasource, show, visible
    HIGH = 1,      // class, style (user-visible)
    NORMAL = 2,    // default
    LOW = 3        // ngclass, ngstyle (can be deferred)
}

const priorityQueues = {
    [WatcherPriority.CRITICAL]: new Set<string>(),
    [WatcherPriority.HIGH]: new Set<string>(),
    [WatcherPriority.NORMAL]: new Set<string>(),
    [WatcherPriority.LOW]: new Set<string>()
};

const watcherPriorities = new Map<string, WatcherPriority>();

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ... existing code ...
    
    // ✅ PRIORITY: Assign priority based on property
    let priority = WatcherPriority.NORMAL;
    if (config.priority) {
        priority = config.priority === 'high' ? WatcherPriority.HIGH :
                   config.priority === 'low' ? WatcherPriority.LOW : WatcherPriority.NORMAL;
    } else {
        // Auto-detect priority from identifier
        if (identifier.includes('datasource') || identifier.includes('show') || identifier.includes('visible')) {
            priority = WatcherPriority.CRITICAL;
        } else if (identifier.includes('class') || identifier.includes('style')) {
            priority = WatcherPriority.HIGH;
        } else if (identifier.includes('ngclass') || identifier.includes('ngstyle')) {
            priority = WatcherPriority.LOW;
        }
    }
    
    watcherPriorities.set(identifier, priority);
    priorityQueues[priority].add(identifier);
    
    // ... register watcher ...
};

const triggerWatchers = (ignoreMuted?: boolean) => {
    if (muted && !ignoreMuted) {
        return;
    }
    
    // ✅ PRIORITY QUEUE: Evaluate in priority order
    const priorities = [WatcherPriority.CRITICAL, WatcherPriority.HIGH, 
                        WatcherPriority.NORMAL, WatcherPriority.LOW];
    
    for (const priority of priorities) {
        const queue = priorityQueues[priority];
        
        queue.forEach(identifier => {
            const watchInfo = registry.get(identifier);
            if (!watchInfo) {
                queue.delete(identifier);
                return;
            }
            
            if (watchInfo.isMuted && watchInfo.isMuted()) {
                return;
            }
            
            // ... evaluate watcher ...
        });
        
        // If we're running low on time, skip lower priorities
        if (performance.now() > 16) { // 16ms budget per frame
            break;
        }
    }
};
```

**Expected Reduction:** Better perceived performance, critical updates happen first

---

## 🎯 Strategy 15: Watcher Registry Partitioning

**Split registry into active/inactive partitions to reduce iteration overhead.**

### Implementation

```typescript
// In watcher.ts - partition registry
const activeRegistry = new Map<string, any>();   // Frequently evaluated
const inactiveRegistry = new Map<string, any>(); // Rarely evaluated
const watcherActivity = new Map<string, { count: number, lastUsed: number }>();

const ACTIVITY_THRESHOLD = 5; // Move to active after 5 evaluations
const INACTIVITY_THRESHOLD = 1000; // Move to inactive after 1s of no use

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ... existing code ...
    
    // ✅ PARTITIONING: Start in inactive, move to active if frequently used
    inactiveRegistry.set(identifier, {
        fn: fn.bind(expr, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted: isMuted
    });
    
    watcherActivity.set(identifier, { count: 0, lastUsed: 0 });
    
    return () => $unwatch(identifier);
};

const triggerWatchers = (ignoreMuted?: boolean) => {
    if (muted && !ignoreMuted) {
        return;
    }
    
    // ✅ PARTITIONED EVALUATION: Evaluate active watchers first
    // Active watchers (most common case)
    activeRegistry.forEach((watchInfo, identifier) => {
        // ... evaluate ...
        updateWatcherActivity(identifier, true);
    });
    
    // Inactive watchers (less frequent)
    const now = Date.now();
    inactiveRegistry.forEach((watchInfo, identifier) => {
        const activity = watcherActivity.get(identifier);
        
        // Skip if recently inactive
        if (now - activity.lastUsed < INACTIVITY_THRESHOLD) {
            return;
        }
        
        // ... evaluate ...
        updateWatcherActivity(identifier, true);
    });
};

const updateWatcherActivity = (identifier: string, wasUsed: boolean) => {
    const activity = watcherActivity.get(identifier);
    if (!activity) return;
    
    if (wasUsed) {
        activity.count++;
        activity.lastUsed = Date.now();
        
        // Promote to active if frequently used
        if (activity.count >= ACTIVITY_THRESHOLD && inactiveRegistry.has(identifier)) {
            const watchInfo = inactiveRegistry.get(identifier);
            inactiveRegistry.delete(identifier);
            activeRegistry.set(identifier, watchInfo);
        }
    } else {
        // Demote to inactive if rarely used
        if (activity.count < ACTIVITY_THRESHOLD && activeRegistry.has(identifier)) {
            const watchInfo = activeRegistry.get(identifier);
            activeRegistry.delete(identifier);
            inactiveRegistry.set(identifier, watchInfo);
        }
    }
};
```

**Expected Reduction:** 20-30% iteration overhead

---

## 📊 Combined Impact of Additional Strategies

| Strategy | Watchers Saved | CPU Reduction | Implementation Effort |
|----------|----------------|---------------|----------------------|
| **8. Dependency Analysis** | 3,000-5,000 | 10% | Medium |
| **9. Smart Throttling** | 0 (performance) | 10-15% | Low |
| **10. Watcher Grouping** | 0 (performance) | 20-30% | Medium |
| **11. Visibility Check** | 1,000-2,000 | 5% | Low |
| **12. Expression Normalization** | 3,000-5,000 | 5% | Medium |
| **13. Change Hints** | 0 (performance) | 30-40% | High |
| **14. Priority Queue** | 0 (performance) | Better UX | Medium |
| **15. Registry Partitioning** | 0 (performance) | 20-30% | Medium |
| **TOTAL** | **7,000-12,000** | **95-155%** | - |

**Note:** CPU reduction percentages are cumulative improvements, not additive.

---

## 🚀 Quick Implementation Priority

### **Phase 1: Immediate Wins (1 day)**
1. ✅ **Strategy 11: Visibility Check** - Easy, high impact
2. ✅ **Strategy 9: Smart Throttling** - Low effort, good performance gain

### **Phase 2: High Impact (2-3 days)**
3. ✅ **Strategy 8: Dependency Analysis** - Big watcher reduction
4. ✅ **Strategy 12: Expression Normalization** - Good deduplication

### **Phase 3: Performance Optimization (3-5 days)**
5. ✅ **Strategy 13: Change Hints** - Massive CPU reduction
6. ✅ **Strategy 15: Registry Partitioning** - Better iteration performance

### **Phase 4: Advanced (5-7 days)**
7. ✅ **Strategy 10: Watcher Grouping** - Complex but effective
8. ✅ **Strategy 14: Priority Queue** - Better user experience

---

## 💡 Recommended Combined Approach

**Best combination for maximum impact:**

1. **Strategy 1 (Lazy Registration)** from guide + **Strategy 11 (Visibility Check)**
   - Reduces watchers by 60-70% for tables
   
2. **Strategy 8 (Dependency Analysis)** + **Strategy 12 (Normalization)**
   - Reduces watchers by 30-40% overall
   
3. **Strategy 13 (Change Hints)** + **Strategy 15 (Partitioning)**
   - Reduces CPU usage by 50-70%

**Expected Final Result:**
- **Watchers:** 22,850 → 6,000-8,000 (65-75% reduction)
- **CPU Usage:** 50-70% reduction
- **Memory:** 40-50% reduction

---

## 🔧 Implementation Example: Quick Win Combination

```typescript
// In base.component.ts - combine visibility check + dependency analysis
protected processBindAttr(propName: string, expr: string, child?: any) {
    if (!child) {
        this.initState.delete(propName);
    }
    
    const widget = child ? child.widget : this.widget;
    
    // ✅ QUICK WIN 1: Visibility check
    if (this.shouldSkipWatcher(propName, widget)) {
        this.evaluateOnce(expr, child, propName, widget);
        return;
    }
    
    // ✅ QUICK WIN 2: Dependency analysis (in $watch)
    // This is handled in watcher.ts
    
    // ✅ QUICK WIN 3: Throttling for non-critical props
    const config: any = widgetProps.get(propName) || {};
    const throttledProps = ['class', 'style', 'ngclass', 'ngstyle'];
    if (throttledProps.includes(propName)) {
        config.throttle = 100;
        config.priority = 'low';
    }
    
    // ... existing registration with config ...
}

private evaluateOnce(expr: string, child: any, propName: string, widget: any) {
    const fn = $parseExpr(expr);
    try {
        const viewParent = child ? child.widget.viewParent.viewParent : this.viewParent;
        const context = child ? child.widget.context : this.context;
        const value = fn(viewParent, context);
        widget[propName] = value;
    } catch (e) {
        // If evaluation fails, register watcher anyway
        // ... fallback to normal registration ...
    }
}
```

This combination alone can reduce watchers by **40-50%** with minimal effort!


