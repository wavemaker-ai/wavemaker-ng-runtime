# fn vs listener in Watch Registry

## Overview

In the watch registry, each watcher has two key functions:
1. **`fn`** - Evaluates the expression and returns the current value
2. **`listener`** - Callback function that executes when the value changes

---

## `fn` - Expression Evaluator Function

### Purpose
**Evaluates the expression** to get the current value from the scope.

### How It's Created

```typescript
// Line 91: Parse expression string into a function
const fn = $parseExpr(expr);

// Line 94: Bind to scope and locals
fn: fn.bind(expr, $scope, $locals)
```

### What It Does

1. **Input**: Expression string (e.g., `"widget.title"`, `"Variables.user.name"`)
2. **Process**: `$parseExpr()` converts the string into an executable function
3. **Output**: A function that, when called, evaluates the expression and returns the current value

### Example

```typescript
// Expression: "widget.title"
// After $parseExpr(), fn becomes:
function() {
    return $scope.widget.title;  // Evaluates and returns current value
}

// When called:
const currentValue = fn();  // Returns "My Widget Title"
```

### Usage in triggerWatchers()

```typescript
// Line 135: Evaluate expression to get current value
nv = fn();  // nv = new value (current value from expression)
```

**Key Point:** `fn()` is called **every change detection cycle** to get the current value.

---

## `listener` - Change Callback Function

### Purpose
**Executes when the value changes** - performs the action needed when the watched value changes.

### How It's Provided

```typescript
// From BaseComponent.processBindAttr() - Line 580-583
$watch(
    expr,                    // "widget.title"
    viewParent,              // Scope
    context,                 // Locals
    nv => {                  // ← This is the listener
        if(propName.startsWith('base-') && widget.updateData)
            widget.updateData(propName, nv);
        widget[propName] = nv  // Update widget property
    },
    // ... other params
)
```

### What It Does

1. **Input**: New value (`nv`) and old value (`ov`)
2. **Process**: Executes custom logic (update property, call method, etc.)
3. **Output**: None (side effects only)

### Example

```typescript
// Listener provided to $watch:
listener: (nv, ov) => {
    widget.title = nv;  // Update widget property with new value
}

// When value changes from "Old Title" to "New Title":
listener("New Title", "Old Title");  // Updates widget.title = "New Title"
```

### Usage in triggerWatchers()

```typescript
// Line 140: Check if value changed
if (!isEqual(nv, ov)) {
    // Line 149: Call listener with new and old values
    listener(nv, ov);  // Execute callback
}
```

**Key Point:** `listener()` is called **only when the value changes**.

---

## Complete Flow

### Registration (Line 85-100)

```typescript
export const $watch = (expr, $scope, $locals, listener, identifier, ...) => {
    // Step 1: Parse expression string into function
    const fn = $parseExpr(expr);  // "widget.title" → function() { return scope.widget.title; }
    
    // Step 2: Store both in registry
    registry.set(identifier, {
        fn: fn.bind(expr, $scope, $locals),  // Bound evaluator function
        listener,                              // Callback function
        expr,                                  // Original expression string
        last: FIRST_TIME_WATCH,               // Previous value
        // ...
    });
}
```

### Execution (Line 113-160)

```typescript
const triggerWatchers = () => {
    registry.forEach(watchInfo => {
        const fn = watchInfo.fn;           // Get evaluator function
        const listener = watchInfo.listener; // Get callback function
        const ov = watchInfo.last;          // Old value
        
        // Step 1: Evaluate expression to get current value
        const nv = fn();  // ← fn() executes: returns current value
        
        // Step 2: Compare with previous value
        if (!isEqual(nv, ov)) {
            // Step 3: Value changed! Call listener
            listener(nv, ov);  // ← listener() executes: updates widget property
            watchInfo.last = nv;  // Store new value as old for next cycle
        }
    });
}
```

---

## Visual Comparison

### `fn` - The Evaluator

```
┌─────────────────────────────────────┐
│  Expression: "widget.title"         │
│         ↓                            │
│  $parseExpr() converts to function  │
│         ↓                            │
│  fn = function() {                  │
│      return scope.widget.title;     │
│  }                                   │
│         ↓                            │
│  fn() → "My Widget Title"           │
└─────────────────────────────────────┘

Called: Every change detection cycle
Purpose: Get current value
Returns: Current value from expression
```

### `listener` - The Callback

```
┌─────────────────────────────────────┐
│  Listener: (nv, ov) => {            │
│      widget.title = nv;             │
│  }                                   │
│         ↓                            │
│  When value changes:                 │
│  listener("New", "Old")              │
│         ↓                            │
│  widget.title = "New"                │
└─────────────────────────────────────┘

Called: Only when value changes
Purpose: React to change
Returns: Nothing (side effects)
```

---

## Real-World Example

### Scenario: Watching `widget.title`

```typescript
// Registration
$watch(
    "widget.title",           // Expression to watch
    viewParent,               // Scope
    context,                  // Locals
    (nv, ov) => {             // Listener callback
        widget.title = nv;    // Update widget property
    },
    "widget-id3_title"       // Identifier
)
```

### What Gets Stored

```typescript
registry.set("widget-id3_title", {
    // fn: Evaluator function
    fn: function() {
        return viewParent.widget.title;  // Evaluates expression
    },
    
    // listener: Callback function
    listener: function(nv, ov) {
        widget.title = nv;  // Updates property
    },
    
    expr: "widget.title",
    last: FIRST_TIME_WATCH
})
```

### Change Detection Cycle

```typescript
// Cycle 1: Initial
nv = fn();                    // fn() → "Initial Title"
ov = FIRST_TIME_WATCH
isEqual(nv, ov)? → false      // Different!
listener("Initial Title", FIRST_TIME_WATCH);  // Updates widget.title
last = "Initial Title"

// Cycle 2: No change
nv = fn();                    // fn() → "Initial Title"
ov = "Initial Title"
isEqual(nv, ov)? → true       // Same!
// listener NOT called

// Cycle 3: Changed
nv = fn();                    // fn() → "Updated Title"
ov = "Initial Title"
isEqual(nv, ov)? → false      // Different!
listener("Updated Title", "Initial Title");  // Updates widget.title
last = "Updated Title"
```

---

## Key Differences Summary

| Aspect | `fn` | `listener` |
|--------|------|------------|
| **Purpose** | Evaluate expression | React to change |
| **Input** | None (uses bound scope) | `(newValue, oldValue)` |
| **Output** | Current value | Nothing (side effects) |
| **When Called** | Every change detection cycle | Only when value changes |
| **Created By** | `$parseExpr(expr)` | Provided by caller |
| **Bound To** | Scope and locals | Not bound (receives values) |
| **Example** | `function() { return scope.widget.title; }` | `(nv) => { widget.title = nv; }` |

---

## Code Flow Diagram

```
Registration:
  Expression String → $parseExpr() → fn (evaluator)
  Callback Function → listener (callback)
  
  Both stored in registry:
  {
    fn: evaluatorFunction,
    listener: callbackFunction
  }

Execution (every cycle):
  ┌─────────────────┐
  │ triggerWatchers │
  └────────┬─────────┘
           │
           ├─→ For each watcher:
           │
           ├─→ Step 1: fn() 
           │   └─→ Evaluates expression
           │   └─→ Returns current value
           │
           ├─→ Step 2: Compare
           │   └─→ isEqual(newValue, oldValue)?
           │
           └─→ Step 3: If changed
               └─→ listener(newValue, oldValue)
                   └─→ Executes callback
                   └─→ Updates widget property
```

---

## Important Notes

1. **`fn` is called every cycle** - Even if value hasn't changed
   - This is why having 22K watchers is expensive
   - Every cycle evaluates all 22K expressions

2. **`listener` is called only on change** - More efficient
   - Only executes when value actually changes
   - But still needs `fn()` to detect the change

3. **Both are necessary**:
   - `fn` detects changes (by evaluating and comparing)
   - `listener` reacts to changes (by updating properties)

4. **Performance Impact**:
   - `fn()` execution is the expensive part (22K evaluations per cycle)
   - `listener()` execution is less frequent (only on changes)

---

## Conclusion

- **`fn`**: The "detector" - evaluates expression to get current value
- **`listener`**: The "reactor" - executes when value changes

Together they form the watch mechanism: `fn` detects changes, `listener` reacts to them.


