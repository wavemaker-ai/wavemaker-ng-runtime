# Event Registry: Scope and Locals Explained

## Overview

When event callbacks are registered in the event registry, they receive **two types of context**:
1. **Scope (`viewParent`)**: The parent component/widget used for expression evaluation
2. **Locals (`context`)**: Local variables accessible in the event handler (Variables, Actions, widget, $event, etc.)

---

## Key Concepts

### 1. **Scope (`viewParent`)**

**What it is:**
- The parent component/widget that contains the current widget
- Used as the **scope** for evaluating expressions in event handlers
- Provides access to parent-level properties and methods

**How it's determined:**
```typescript
// base.component.ts - Line 224
this.viewParent = findParent(lView, this.viewParentApp);
```

**Example:**
- If a button is inside a form, `viewParent` = the form component
- If a button is inside a list item, `viewParent` = the list component

### 2. **Locals (`context`)**

**What it is:**
- An object containing **local variables** accessible in event handlers
- Includes: `Variables`, `Actions`, `widget`, `$event`, repeater context, etc.
- Stored in the `eventHandlers` Map and passed to callbacks

**How it's determined:**
```typescript
// base.component.ts - Line 226
this.context = (this.inj as any)._lView[8];
```

**Contents:**
```typescript
context = {
    Variables: {...},      // App variables
    Actions: {...},        // App actions
    widget: this.widget,  // Current widget instance
    $event: {...},        // DOM event (added when event fires)
    // ... repeater context, wizard context, etc.
}
```

---

## How Scope and Locals Are Set Up

### Step-by-Step in `processEventAttr()`

**Location:** `base.component.ts` - Line 522-563

```typescript
protected processEventAttr(eventName: string, expr: string, meta?: string, child?: Child) {
    // STEP 1: Parse the event expression
    const fn = $parseEvent(expr);  // e.g., "handleClick()" → function
    
    // STEP 2: Get locals from component context
    const locals = this.context;  // ← Copy reference to context object
    
    // STEP 3: Add widget to locals
    locals.widget = child ? child.widget : this.widget;
    
    // STEP 4: Determine scope (viewParent)
    const scope = child ? this.viewParent.viewParent : this.viewParent;
    
    // STEP 5: Bind function with scope and locals
    const boundFn = fn.bind(undefined, scope, locals);
    //                    ↑              ↑      ↑
    //                    |              |      └─ Locals (context)
    //                    |              └─ Scope (viewParent)
    //                    └─ First argument (undefined = no 'this' binding)
    
    // STEP 6: Create event callback wrapper
    const eventCallback = () => {
        $invokeWatchers(true);
        try {
            // Add $event to locals when event fires
            locals.$event = locals.$event || new window.CustomEvent(eventName);
            boundFnVal = boundFn();  // ← Executes with scope and locals
            // ... handle promises
        } catch (e) {
            console.error(e);
        }
    };
    
    // STEP 7: Store in eventHandlers Map
    widget.eventHandlers.set(eventName, {
        callback: eventCallback,
        locals: locals  // ← Store locals reference
    });
}
```

---

## Scope Resolution

### Normal Widget (Not in Repeater)

```typescript
// For regular widget
const scope = this.viewParent;
// Example: Button in form → scope = form component
```

### Child Widget (In Repeater/Template)

```typescript
// For child widget (e.g., list item, repeater item)
const scope = this.viewParent.viewParent;
// Example: Button in list item → scope = list component (skip list item)
```

**Why `viewParent.viewParent`?**
- Child widgets are nested deeper in the component tree
- Need to access the parent of the parent to get the correct scope
- Allows expressions to access parent-level Variables/Actions

---

## Locals Object Structure

### Initial Setup

```typescript
// Line 524: Get context
const locals = this.context;

// Line 525: Add widget reference
locals.widget = child ? child.widget : this.widget;

// Result:
locals = {
    Variables: {...},        // From Angular's LView[8]
    Actions: {...},          // From Angular's LView[8]
    widget: this.widget,     // Added manually
    // ... other context properties
}
```

### When Event Fires

```typescript
// handleEvent() - Line 504
e => {
    locals.$event = e;  // ← Add DOM event to locals
    eventCallback();
}
```

**Final locals when callback executes:**
```typescript
locals = {
    Variables: {...},
    Actions: {...},
    widget: this.widget,
    $event: MouseEvent,  // ← Added when event fires
    // ... other context
}
```

---

## How Bound Function Works

### Function Binding

```typescript
// Original parsed function signature:
function(scope, locals, ...args) {
    // Can access:
    // - scope.Variables.userName
    // - scope.Actions.submit
    // - locals.widget
    // - locals.$event
}

// After binding:
const boundFn = fn.bind(undefined, scope, locals);
// Now: boundFn() is equivalent to fn(scope, locals)
```

### Expression Evaluation

When the event fires and `boundFn()` is called:

```typescript
// Event expression: "handleClick($event, Variables.userName)"

// The parsed function receives:
// - scope: viewParent (for Variables, Actions)
// - locals: context (for widget, $event)

// Inside the parsed function:
// - Variables.userName → scope.Variables.userName
// - $event → locals.$event
// - widget → locals.widget
```

---

## Complete Flow Example

### HTML Template
```html
<wm-list>
    <wm-list-item>
        <wm-button click.event="handleClick($event, Variables.userName, widget)">
            Click Me
        </wm-button>
    </wm-list-item>
</wm-list>
```

### Registration Phase

```typescript
// 1. processEventAttr("click", "handleClick($event, Variables.userName, widget)")
const fn = $parseEvent("handleClick($event, Variables.userName, widget)");

// 2. Get locals
const locals = this.context;  // {Variables: {...}, Actions: {...}, ...}

// 3. Add widget
locals.widget = this.widget;  // Button widget instance

// 4. Determine scope (child widget in list item)
const scope = this.viewParent.viewParent;  // List component

// 5. Bind function
const boundFn = fn.bind(undefined, scope, locals);

// 6. Store in eventHandlers
widget.eventHandlers.set("click", {
    callback: eventCallback,
    locals: locals  // Reference stored
});
```

### Execution Phase

```typescript
// User clicks button
// ↓
// DOM event fires
// ↓
// handleEvent() receives event
e => {
    locals.$event = e;  // Add MouseEvent to locals
    eventCallback();
}
// ↓
// eventCallback() executes
eventCallback() {
    $invokeWatchers(true);
    boundFn();  // ← Executes with scope and locals
}
// ↓
// boundFn() evaluates expression
// - $event → locals.$event (MouseEvent)
// - Variables.userName → scope.Variables.userName
// - widget → locals.widget (Button instance)
```

---

## Stored in Event Registry

### Event Registry Entry

```typescript
widget.eventHandlers = Map {
    "click" => {
        callback: eventCallback,  // Function that calls boundFn()
        locals: locals           // Reference to context object
    }
}
```

**Important:** The `locals` object is stored by **reference**, not copied. This means:
- Changes to `locals` (like adding `$event`) are visible to the callback
- The same `locals` object is reused across multiple event fires
- Memory efficient (no copying)

---

## Invoking Events Programmatically

### Method: `invokeEventCallback()`

**Location:** `base.component.ts` - Line 608-618

```typescript
public invokeEventCallback(eventName: string, extraLocals?: any) {
    const callbackInfo = this.eventHandlers.get(eventName);
    if (callbackInfo) {
        const fn = callbackInfo.callback;
        const locals = callbackInfo.locals || {};  // ← Get stored locals
        
        if (fn) {
            // Merge extra locals (e.g., $data) with stored locals
            return fn(Object.assign(locals, extraLocals));
        }
    }
}
```

**Usage:**
```typescript
// Programmatically trigger event
widget.invokeEventCallback("click", {
    $data: someData  // ← Merged into locals
});

// Inside callback, can access:
// - locals.$event (from stored locals or DOM event)
// - locals.$data (from extraLocals)
// - locals.widget (from stored locals)
// - scope.Variables.userName (from bound scope)
```

---

## Scope vs Locals: Key Differences

| Aspect | Scope (`viewParent`) | Locals (`context`) |
|--------|---------------------|-------------------|
| **Purpose** | Expression evaluation context | Local variables for handler |
| **Binding** | Bound to function via `.bind()` | Passed as second argument |
| **Access** | `scope.Variables`, `scope.Actions` | `locals.widget`, `locals.$event` |
| **Storage** | Not stored in registry | Stored in `eventHandlers` Map |
| **Modification** | Fixed at registration time | Can be modified (e.g., add `$event`) |
| **Example** | `Variables.userName` → `scope.Variables.userName` | `$event` → `locals.$event` |

---

## Special Cases

### 1. Child Widgets in Repeaters

```typescript
// For child widgets, use viewParent.viewParent
const scope = child ? this.viewParent.viewParent : this.viewParent;
```

**Why?**
- Child widget's `viewParent` = repeater item component
- Need to skip to parent of repeater item = list component
- Allows access to list-level Variables/Actions

### 2. Delayed Events

```typescript
// handleEvent() - Line 505-506
if (meta === 'delayed') {
    setTimeout(() => eventCallback(), 150);
}
```

**Scope and locals are still preserved** - the `eventCallback` closure captures them.

### 3. Promise Handling

```typescript
// processEventAttr() - Line 539-541
if (boundFnVal instanceof Promise) {
    return boundFnVal.then(response => response, err => err);
}
```

**Scope and locals are available** in promise callbacks because they're captured in the closure.

---

## Memory Considerations

### Locals Reference

```typescript
// Locals is stored by reference, not copied
widget.eventHandlers.set(eventName, {callback, locals});

// This means:
// - Same object reference is reused
// - Changes to locals are visible to callback
// - No memory overhead from copying
```

### Cleanup

```typescript
// ngOnDestroy() - Line 861-866
if (this.context) {
    Object.keys(this.context).forEach(key => {
        delete this.context[key];
    });
    this.context = null;
}
```

**Note:** When component is destroyed, `context` is cleared, which also clears the `locals` reference stored in `eventHandlers`. This helps prevent memory leaks.

---

## Summary

1. **Scope (`viewParent`)**: Bound to the parsed function via `.bind()`, used for expression evaluation
2. **Locals (`context`)**: Stored in `eventHandlers` Map, contains Variables, Actions, widget, $event, etc.
3. **Binding**: Function is bound with `scope` as first argument, `locals` as second argument
4. **Storage**: `locals` reference is stored in `eventHandlers` Map (not copied)
5. **Execution**: When event fires, `$event` is added to `locals`, then `boundFn()` is called
6. **Child Widgets**: Use `viewParent.viewParent` to skip to correct scope level

**Key Takeaway:** Scope is bound at registration time, locals are stored and can be modified when the event fires (e.g., adding `$event`).


