# Where $unwatch is Called

## Overview

`$unwatch` removes watchers from the registry to prevent memory leaks. It's called in two ways:
1. **Automatic cleanup** via `destroy` Subject completion
2. **Manual cleanup** via direct calls

---

## 1. Automatic Cleanup (Primary Mechanism)

### Flow

```
$watch() returns unwatch function
    ↓
registerDestroyListener(unwatchFunction)
    ↓
destroy.subscribe(..., ..., () => unwatchFunction())
    ↓
ngOnDestroy() → destroy.complete()
    ↓.
Unwatch function is called automatically
```

### Code Locations

#### A. **$watch() Returns Unwatch Function**

**File:** `projects/core/src/utils/watcher.ts`

```typescript
// Line 85-103: $watch returns a function that calls $unwatch
export const $watch = (expr, $scope, $locals, listener, identifier = watchIdGenerator.nextUid(), doNotClone = false, config:any={}, isMuted?: () => boolean) => {
    // ... setup code ...
    
    registry.set(identifier, {
        fn: fn.bind(expr, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone,
        isMuted: isMuted
    });

    return () => $unwatch(identifier);  // ← Returns unwatch function
};
```

#### B. **registerDestroyListener() Registers Unwatch**

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
// Line 356-361: Registers cleanup function
public registerDestroyListener(fn: Function, ctx?: any) {
    if (ctx) {
        fn = fn.bind(ctx);
    }
    this.destroy.subscribe(() => {}, () => {}, () => fn());  // ← Completion callback
}
```

#### C. **processBindAttr() Uses registerDestroyListener**

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
// Line 566-591: Registers watcher and cleanup
protected processBindAttr(propName: string, expr: string, child ?: any) {
    // ... setup code ...
    this.registerDestroyListener(
        $watch(  // ← Returns unwatch function
            expr,
            viewParent,
            context,
            nv => {
                if(propName.startsWith('base-') && widget.updateData)
                    widget.updateData(propName, nv);
                widget[propName] = nv
            },
            getWatchIdentifier(widgetId, propName),
            propName === 'datasource',
            widgetProps.get(propName),
            () => isMuted
        )  // ← This unwatch function is registered
    );
}
```

#### D. **ngOnDestroy() Triggers Cleanup**

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
// Line 847-865: Component destruction
ngOnDestroy() {
    this.isDestroyed = true;
    this.widget = Object.create(null);
    this.styleChange.complete();
    this.propertyChange.complete();
    this.destroy.complete();  // ← Triggers all registered unwatch functions
    this.isAttached = false;
    
    // ... context cleanup ...
}
```

**What happens:**
- `destroy.complete()` triggers the completion callback
- All functions registered via `registerDestroyListener()` are called
- Each unwatch function calls `$unwatch(identifier)`
- Watcher is removed from registry

---

## 2. Manual Cleanup (Direct Calls)

### A. **removePropertyBinding() - Explicit Removal**

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
// Line 593-598: Manually remove watcher for a property
protected removePropertyBinding(propName: string) {
    $unwatch(getWatchIdentifier(this.widgetId, propName));  // ← Direct call
}
```

**Usage:** Called when a property binding needs to be removed before component destruction.

### B. **Table Component - Cleanup Specific Watchers**

**File:** `projects/components/widgets/data/table/src/table.component.ts`

```typescript
// Line 676, 688, 697: Remove specific watchers
$unwatch(watchName);  // ← Direct calls for specific watchers
```

**Context:** Table component has specific watchers that need cleanup at certain points.

### C. **Chips Component - Cleanup**

**File:** `projects/components/widgets/input/chips/src/chips.component.ts`

```typescript
// Line 180: Remove watcher for chip items
$unwatch(watchName);  // ← Direct call
```

### D. **Base Field Validations - Cleanup**

**File:** `projects/components/base/src/widgets/common/base/base-field-validations.ts`

```typescript
// Line 266: Remove validation watcher
$unwatch(watchName);  // ← Direct call
```

### E. **Property Change Handler - Cleanup**

**File:** `projects/components/base/src/widgets/framework/property-change-handler.ts`

```typescript
// Line 55: Remove watcher for property changes
$unwatch(getWatchIdentifier(widgetId, key));  // ← Direct call
```

---

## 3. $unwatch Implementation

**File:** `projects/core/src/utils/watcher.ts`

```typescript
// Line 105: Simple deletion from registry
export const $unwatch = identifier => registry.delete(identifier);
```

**What it does:**
- Removes the watcher from the global registry Map
- Prevents further evaluation of that watcher
- Allows garbage collection of watcher data

---

## Summary of Unwatch Locations

| Location | Type | When Called |
|----------|------|-------------|
| `destroy.complete()` callback | Automatic | Every component `ngOnDestroy()` |
| `removePropertyBinding()` | Manual | When property binding is removed |
| `table.component.ts` | Manual | Table-specific cleanup |
| `chips.component.ts` | Manual | Chip item cleanup |
| `base-field-validations.ts` | Manual | Validation cleanup |
| `property-change-handler.ts` | Manual | Property change cleanup |

---

## Important Notes

### ✅ Automatic Cleanup Works Well
- Most watchers are automatically cleaned up via `destroy.complete()`
- No manual intervention needed for standard property bindings

### ⚠️ Potential Issues
1. **If `ngOnDestroy()` is not called:**
   - Watchers remain in registry
   - Memory leak occurs
   - Registry grows over time

2. **If `registerDestroyListener()` is not used:**
   - Watcher must be manually unwatched
   - Easy to forget, causing leaks

3. **Concurrent Access:**
   - If `triggerWatchers()` is running when `$unwatch()` is called
   - Watcher might be evaluated during cleanup
   - Current implementation handles this gracefully

---

## Best Practices

1. **Always use `registerDestroyListener()`** when creating watchers
2. **Don't manually unwatch** unless you have a specific reason
3. **Ensure `ngOnDestroy()` is called** - Angular handles this automatically
4. **Test for memory leaks** - Check registry size doesn't grow over time


