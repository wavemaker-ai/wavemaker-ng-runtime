# Branch Registry Comparison

## Summary

| Branch | Global Registry | Component Registry (WeakMap) | Status |
|--------|----------------|------------------------------|--------|
| **hotfix** | ✅ Yes | ❌ No | Single registry only |
| **newhotfix** | ✅ Yes | ✅ Yes (but broken) | Two registries, WeakMap never triggered |
| **dev-siva/memory-leak-fix** (current) | ✅ Yes | ❌ No (removed) | Single registry, WeakMap removed |

---

## hotfix Branch

**Registry Structure:**
- ✅ **Global Registry (Map)**: `const registry = new Map<string, any>()`
- ❌ **Component Registry (WeakMap)**: Does NOT exist

**Code Evidence:**
```typescript
// projects/core/src/utils/watcher.ts (hotfix branch)
const registry = new Map<string, any>();  // Only one registry

// Line 93: All watchers stored in global registry
registry.set(identifier, {
    fn: fn.bind(expr, $scope, $locals),
    listener,
    expr,
    last: FIRST_TIME_WATCH,
    doNotClone,
    isMuted: isMuted
});

// Line 125: Only global registry is iterated
registry.forEach(watchInfo => {
    // ... evaluate watchers
});
```

**Key Difference from Current Branch:**
- Line 171: `(<any>window).watchRegistry = registry;` is **uncommented** (exposed to window)
- Current branch has this commented out

---

## newhotfix Branch

**Registry Structure:**
- ✅ **Global Registry (Map)**: `const registry = new Map<string, any>()`
- ✅ **Component Registry (WeakMap)**: `const componentWatcherRegistry = new WeakMap<object, Map<string, any>>()`

**Code Evidence:**
```typescript
// projects/core/src/utils/watcher.ts (newhotfix branch)
const registry = new Map<string, any>();

// OPTIMIZATION: WeakMap for component-scoped watchers
const componentWatcherRegistry = new WeakMap<object, Map<string, any>>();

// In $watch():
if (config && config.useWeakMap && $scope && typeof $scope === 'object') {
    let componentWatchers = componentWatcherRegistry.get($scope);
    if (!componentWatchers) {
        componentWatchers = new Map<string, any>();
        componentWatcherRegistry.set($scope, componentWatchers);
    }
    componentWatchers.set(identifier, watchInfoObj);
} else {
    registry.set(identifier, watchInfoObj);
}
```

**Problem:**
- Watchers stored in `componentWatcherRegistry` (WeakMap) are **NEVER processed**
- `triggerWatchers()` only iterates over the global `registry` Map
- WeakMap cannot be iterated in JavaScript
- Watchers registered with `useWeakMap: true` are registered but never trigger

**Status:** Broken implementation - component registry exists but doesn't work

---

## Current Branch (dev-siva/memory-leak-fix)

**Registry Structure:**
- ✅ **Global Registry (Map)**: `const registry = new Map<string, any>()`
- ❌ **Component Registry (WeakMap)**: **REMOVED**

**Code Evidence:**
```typescript
// projects/core/src/utils/watcher.ts (current branch)
const registry = new Map<string, any>();  // Only one registry

// All watchers stored in global registry
registry.set(identifier, {
    fn: fn.bind(expr, $scope, $locals),
    listener,
    expr,
    last: FIRST_TIME_WATCH,
    doNotClone,
    isMuted: isMuted
});

// Line 171: window.watchRegistry is commented out
// (<any>window).watchRegistry = registry;
```

**Why Removed:**
According to `BRANCH-COMPARISON-ANALYSIS.md`:
- WeakMap watchers were never triggered (WeakMap iteration not possible)
- `useWeakMap` option was never used in the codebase
- Added complexity without benefit
- Simplified to single registry with proper cleanup via `destroy.complete()`

---

## Comparison Table

| Feature | hotfix | newhotfix | dev-siva/memory-leak-fix |
|---------|--------|-----------|--------------------------|
| **Global Registry** | ✅ | ✅ | ✅ |
| **Component Registry** | ❌ | ✅ (broken) | ❌ (removed) |
| **All Watchers Triggered** | ✅ | ❌ (WeakMap ignored) | ✅ |
| **window.watchRegistry** | ✅ Exposed | ? | ❌ Commented |
| **Cleanup Mechanism** | Manual | Manual + WeakMap (broken) | destroy.complete() |
| **Complexity** | Low | High | Low |

---

## Key Findings

1. **hotfix branch**: Simple, single global registry, no component-level registry
2. **newhotfix branch**: Has both registries, but WeakMap is broken (watchers never triggered)
3. **Current branch**: Removed WeakMap, simplified to single registry

**Recommendation:**
- Current branch approach is correct - single registry with proper cleanup
- WeakMap approach in newhotfix was a failed optimization attempt
- hotfix branch is also correct (single registry)

---

## Code Differences

### hotfix vs Current Branch

**Only difference:**
```typescript
// hotfix branch (line 171)
(<any>window).watchRegistry = registry;  // Exposed

// Current branch (line 171)
// (<any>window).watchRegistry = registry;  // Commented out
```

### newhotfix vs Others

**Additional code in newhotfix:**
```typescript
// WeakMap registry (doesn't exist in hotfix or current)
const componentWatcherRegistry = new WeakMap<object, Map<string, any>>();

// Conditional registration
if (config && config.useWeakMap && $scope && typeof $scope === 'object') {
    // Store in WeakMap (never triggered!)
    componentWatcherRegistry.set($scope, componentWatchers);
} else {
    // Store in global registry (gets triggered)
    registry.set(identifier, watchInfoObj);
}
```

---

## Conclusion

**hotfix branch**: ✅ **NO component-level registry** - only global registry
**newhotfix branch**: ⚠️ **YES, has component-level registry** but it's broken (never triggered)
**Current branch**: ✅ **NO component-level registry** - removed the broken WeakMap implementation

The hotfix branch is similar to the current branch - both use a single global registry. The newhotfix branch attempted to add a component-level WeakMap registry but it didn't work because WeakMap cannot be iterated.


