# Watch Registry Architecture

## Current State: Single Global Registry

The watch registry uses **a single global Map** that stores all watchers in the application.

### Current Implementation

**File:** `projects/core/src/utils/watcher.ts`

```typescript
// Line 7: Single global registry
const registry = new Map<string, any>();
```

**All watchers are stored in this single global Map:**
- **Key**: Unique identifier (e.g., `widget-id3_title`)
- **Value**: Watch info object containing:
  - `fn`: Parsed expression function (evaluates expression)
  - `listener`: Callback function (executes on change)
  - `expr`: Original expression string
  - `last`: Previous value (for comparison)
  - `doNotClone`: Whether to clone object values
  - `isMuted`: Function to check if watcher is muted

---

## Architecture

```
┌─────────────────────────────────────┐
│   Global Registry (Map)             │
│   - ALL watchers                     │
│   - Can be iterated ✅               │
│   - Processed by triggerWatchers() ✅│
│   - Cleanup via destroy.complete()   │
└─────────────────────────────────────┘
```

**Key Points:**
- Single source of truth for all watchers
- All watchers are processed during change detection cycles
- Manual cleanup required via `destroy.complete()`

---

## How Cleanup Works

Since there's only one global registry, cleanup happens via:

### Automatic Cleanup

```typescript
// 1. $watch() returns unwatch function
const unwatch = $watch(...);

// 2. Register for cleanup
registerDestroyListener(unwatch);

// 3. ngOnDestroy() triggers cleanup
ngOnDestroy() {
    this.destroy.complete();  // Calls all registered unwatch functions
}
```

**Flow:**
```
$watch() → returns unwatch function
    ↓
registerDestroyListener(unwatch)
    ↓
destroy.subscribe(..., ..., () => unwatch())
    ↓
ngOnDestroy() → destroy.complete()
    ↓
All unwatch functions called → registry.delete(identifier)
```

### Manual Cleanup

```typescript
// Direct call to remove specific watcher
$unwatch(identifier);
```

---

## Registry Structure

### Storage

```typescript
// Global registry
const registry = new Map<string, any>();

// Each entry:
registry.set(identifier, {
    fn: fn.bind(expr, $scope, $locals),  // Evaluator function
    listener,                             // Callback function
    expr,                                 // Original expression
    last: FIRST_TIME_WATCH,              // Previous value
    doNotClone,                           // Clone flag
    isMuted: isMuted                      // Mute check function
});
```

### Processing

```typescript
// triggerWatchers() iterates through all watchers
registry.forEach(watchInfo => {
    const nv = watchInfo.fn();           // Evaluate expression
    if (!isEqual(nv, watchInfo.last)) {  // Compare with previous
        watchInfo.listener(nv, ov);       // Call listener if changed
        watchInfo.last = nv;              // Update previous value
    }
});
```

---

## Best Practices

1. **Always use `registerDestroyListener()`** when creating watchers
   - Ensures automatic cleanup on component destruction
   - Prevents memory leaks

2. **Ensure `ngOnDestroy()` is called**
   - Angular handles this automatically for components
   - Manually call for services or other contexts

3. **Monitor registry size** to detect memory leaks
   - Check `registry.size` during development
   - Should decrease when components are destroyed

4. **Manual cleanup** only when needed
   - Use `$unwatch(identifier)` for specific cases
   - Most cleanup should be automatic

---

## Summary

| Aspect | Current State |
|--------|---------------|
| **Number of Registries** | 1 (Map only) |
| **Storage Type** | `Map<string, any>` |
| **All Watchers Triggered** | ✅ Yes |
| **Cleanup Mechanism** | `destroy.complete()` |
| **Complexity** | Low |
| **Status** | Current Implementation |

**Conclusion:** The watch registry uses a **single global Map** to store all watchers. All watchers are processed during change detection cycles, and cleanup is handled automatically via the `destroy` Subject completion callback.

