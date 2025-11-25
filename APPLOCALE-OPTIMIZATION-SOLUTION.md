# Optimizing appLocale Expressions: Evaluate Once and Remove from Registry

## Problem

Expressions starting with `appLocale` (e.g., `appLocale.LABEL_OK`, `appLocale.MESSAGE_ERROR`) are static localization strings that don't change during runtime. Currently, they're being watched continuously, wasting resources.

## Solution

Evaluate `appLocale` expressions **once** and **remove them from the registry** immediately.

---

## Approach 1: Modify `$watch` Function (Recommended)

### Implementation

**File:** `projects/core/src/utils/watcher.ts`

```typescript
export const $watch = (expr, $scope, $locals, listener, identifier = watchIdGenerator.nextUid(), doNotClone = false, config:any={}, isMuted?: () => boolean) => {
    // OPTIMIZATION: Check if expression starts with appLocale
    if (typeof expr === 'string' && expr.trim().startsWith('appLocale')) {
        // Evaluate once immediately
        const fn = $parseExpr(expr);
        try {
            const value = fn.call(expr, $scope, $locals);
            // Call listener with the value
            listener(value, FIRST_TIME_WATCH);
            // Return a no-op unwatch function (nothing to unwatch)
            return () => {};
        } catch (e) {
            console.warn(`error in evaluating appLocale expression: '${expr}'`);
            // If evaluation fails, still return no-op (don't add to registry)
            return () => {};
        }
    }
    
    // Normal flow for non-appLocale expressions
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
```

### How It Works

1. **Detection**: Checks if expression string starts with `'appLocale'`
2. **Immediate Evaluation**: Parses and evaluates the expression once
3. **Listener Call**: Calls the listener with the evaluated value
4. **Skip Registry**: Returns a no-op function instead of adding to registry
5. **Error Handling**: If evaluation fails, still skips registry (no-op unwatch)

### Benefits

- ✅ **Single Point of Change**: All appLocale expressions handled in one place
- ✅ **Automatic**: Works for all appLocale bindings without component changes
- ✅ **Safe**: If evaluation fails, doesn't break the app (just logs warning)
- ✅ **No Registry Pollution**: appLocale watchers never enter the registry

---

## Approach 2: Modify `processBindAttr` (Alternative)

### Implementation

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
protected processBindAttr(propName: string, expr: string, child ?: any) {
    if(!child)
        this.initState.delete(propName);
    let viewParent  = child ? child.widget.viewParent.viewParent : this.viewParent,
        context     = child ? child.widget.context : this.context,
        widget      = child ? child.widget : this.widget,
        isMuted     = child ? child.widget.isMuted : this.isMuted,
        widgetProps = child ? child.widget.widgetProps : this.widgetProps,
        widgetId    = child ? child.widget.widgetId : this.widgetId;
    
    // OPTIMIZATION: Check if expression starts with appLocale
    if (typeof expr === 'string' && expr.trim().startsWith('appLocale')) {
        // Evaluate once immediately
        const fn = $parseExpr(expr);
        try {
            const value = fn.call(expr, viewParent, context);
            // Set widget property directly
            if(propName.startsWith('base-') && widget.updateData)
                widget.updateData(propName, value);
            widget[propName] = value;
            // Don't register watcher - return early
            return;
        } catch (e) {
            console.warn(`error in evaluating appLocale expression: '${expr}'`);
            // If evaluation fails, fall through to normal watch registration
        }
    }
    
    // Normal flow for non-appLocale expressions
    this.registerDestroyListener(
        $watch(
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
        )
    );
}
```

### How It Works

1. **Detection**: Checks if expression starts with `'appLocale'` before calling `$watch`
2. **Immediate Evaluation**: Evaluates and sets widget property directly
3. **Early Return**: Skips `$watch` registration entirely
4. **Fallback**: If evaluation fails, falls through to normal watch registration

### Benefits

- ✅ **Component-Level Control**: Can add component-specific logic if needed
- ✅ **Explicit**: Makes the optimization visible at the binding level
- ❌ **Requires Component Changes**: Need to modify BaseComponent

---

## Approach 3: Hybrid - Check in Both Places

### Implementation

**Best of both worlds**: Check in `processBindAttr` for early detection, but also in `$watch` as a safety net.

```typescript
// In processBindAttr - early detection
if (typeof expr === 'string' && expr.trim().startsWith('appLocale')) {
    // Evaluate and set immediately
    // ...
    return; // Skip $watch
}

// In $watch - safety net (if somehow appLocale expression reaches here)
if (typeof expr === 'string' && expr.trim().startsWith('appLocale')) {
    // Evaluate once and return no-op
    // ...
    return () => {};
}
```

---

## Expression Patterns to Match

### Supported Patterns

```typescript
// Direct property access
'appLocale.LABEL_OK'
'appLocale.MESSAGE_ERROR'

// With spaces
' appLocale.LABEL_OK'  // Trimmed, still matches

// Nested properties
'appLocale.LABELS.BUTTON.SUBMIT'

// In template strings (if parsed)
`${appLocale.LABEL_OK}`  // Would be parsed as expression
```

### Detection Logic

```typescript
// Simple check
expr.trim().startsWith('appLocale')

// More robust (handles edge cases)
const trimmedExpr = typeof expr === 'string' ? expr.trim() : '';
const isAppLocale = trimmedExpr.startsWith('appLocale') && 
                    (trimmedExpr.length === 9 || trimmedExpr[9] === '.' || trimmedExpr[9] === '[');
```

---

## Testing the Optimization

### Before Optimization

```typescript
// Check registry size
console.log('Watchers:', registry.size);  // e.g., 22,855

// Check for appLocale watchers
let appLocaleCount = 0;
registry.forEach((watchInfo, id) => {
    if (watchInfo.expr && watchInfo.expr.startsWith('appLocale')) {
        appLocaleCount++;
    }
});
console.log('appLocale watchers:', appLocaleCount);  // e.g., 150
```

### After Optimization

```typescript
// Check registry size
console.log('Watchers:', registry.size);  // e.g., 22,705 (150 fewer)

// Verify no appLocale watchers
let appLocaleCount = 0;
registry.forEach((watchInfo, id) => {
    if (watchInfo.expr && watchInfo.expr.startsWith('appLocale')) {
        appLocaleCount++;
    }
});
console.log('appLocale watchers:', appLocaleCount);  // Should be 0
```

---

## Performance Impact

### Before

- **Registry Size**: 22,855 watchers
- **Change Detection**: All watchers checked every cycle
- **appLocale Watchers**: ~150 watchers checked unnecessarily

### After

- **Registry Size**: ~22,705 watchers (150 fewer)
- **Change Detection**: 150 fewer watchers to check
- **appLocale Expressions**: Evaluated once at initialization

### Estimated Savings

- **Per Change Detection Cycle**: 150 fewer evaluations
- **At 60 FPS**: 9,000 fewer evaluations per second
- **Memory**: 150 fewer Map entries + watch info objects

---

## Edge Cases to Consider

### 1. Dynamic appLocale Changes

**Question**: What if appLocale changes at runtime (locale switch)?

**Answer**: If locale switching is supported, you may want to:
- Keep appLocale watchers in registry
- OR trigger re-evaluation when locale changes
- OR use a different optimization strategy

**Current Assumption**: appLocale is static after initialization

### 2. Expressions with appLocale in Middle

```typescript
// These would NOT be optimized (by design)
'Variables.userName + appLocale.LABEL_OK'  // Mixed expression
'widget.title || appLocale.DEFAULT'        // Fallback pattern
```

**Reason**: These expressions may change when other parts change, so they need watching.

### 3. Error Handling

```typescript
try {
    const value = fn.call(expr, $scope, $locals);
    listener(value, FIRST_TIME_WATCH);
} catch (e) {
    console.warn(`error in evaluating appLocale expression: '${expr}'`);
    // Option A: Fall through to normal watch (safer)
    // Option B: Return no-op (current approach - assumes static)
}
```

**Recommendation**: Use Option A (fall through) if you want to be extra safe.

---

## Implementation Steps

### Step 1: Add Detection Logic

Choose your approach (1, 2, or 3) and add the detection check.

### Step 2: Test Locally

1. Build the application
2. Check registry size before/after
3. Verify appLocale bindings still work
4. Test edge cases (errors, mixed expressions)

### Step 3: Verify Behavior

1. Check that appLocale values are set correctly
2. Verify no console errors
3. Confirm registry size reduction
4. Test with different appLocale expressions

### Step 4: Monitor Performance

1. Measure change detection cycles
2. Check memory usage
3. Verify no regressions

---

## Code Example: Complete Implementation (Approach 1)

```typescript
// projects/core/src/utils/watcher.ts

export const $watch = (expr, $scope, $locals, listener, identifier = watchIdGenerator.nextUid(), doNotClone = false, config:any={}, isMuted?: () => boolean) => {
    // OPTIMIZATION: Handle appLocale expressions (static, evaluate once)
    if (typeof expr === 'string') {
        const trimmedExpr = expr.trim();
        if (trimmedExpr.startsWith('appLocale') && 
            (trimmedExpr.length === 9 || trimmedExpr[9] === '.' || trimmedExpr[9] === '[')) {
            // Evaluate once immediately
            const fn = $parseExpr(expr);
            try {
                const value = fn.call(expr, $scope, $locals);
                // Call listener with the value (triggers initial update)
                listener(value, FIRST_TIME_WATCH);
                // Return no-op unwatch function (nothing to unwatch)
                return () => {};
            } catch (e) {
                console.warn(`error in evaluating appLocale expression: '${expr}'`, e);
                // If evaluation fails, fall through to normal watch registration
                // This ensures the app doesn't break if appLocale is not available
            }
        }
    }
    
    // Normal flow for non-appLocale expressions
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
```

---

## Summary

**Recommended Approach**: **Approach 1** (modify `$watch`)

**Why:**
- Single point of change
- Automatic for all appLocale bindings
- No component-level changes needed
- Centralized optimization logic

**Key Changes:**
1. Detect expressions starting with `'appLocale'`
2. Evaluate once immediately
3. Call listener with the value
4. Return no-op unwatch function (skip registry)

**Result:**
- Fewer watchers in registry
- Faster change detection cycles
- Lower memory usage
- Same functionality (appLocale values still set correctly)



