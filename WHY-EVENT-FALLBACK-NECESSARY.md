# Why `locals.$event` Fallback is Necessary

## The Line in Question

```typescript
// base.component.ts - Line 535
locals.$event = locals.$event || new window.CustomEvent(eventName);
```

---

## Why This Fallback Exists

The fallback ensures `$event` is **always available** in event handlers, even when events are triggered **programmatically** (not from DOM).

---

## Two Ways Events Can Be Triggered

### 1. **DOM Event** (User Interaction)

**Flow:**
```typescript
User clicks button
    ↓
DOM event fires
    ↓
handleEvent() receives event (Line 500-511)
    ↓
e => {
    locals.$event = e;  // ← Set actual DOM event (Line 504)
    eventCallback();    // ← Call callback
}
    ↓
eventCallback() {
    locals.$event = locals.$event || new CustomEvent(...);
    //              ↑ Already set, so fallback not used
    boundFn();
}
```

**Result:** `locals.$event` is already set, so fallback is **not used**.

### 2. **Programmatic Call** (Code Execution)

**Flow:**
```typescript
// Option A: Via invokeEventCallback()
widget.invokeEventCallback("click", {$data: someData});
// Note: $event NOT passed in extraLocals

    ↓
invokeEventCallback() (Line 608-618)
    ↓
fn(Object.assign(locals, extraLocals))
//  ↑ Merges extraLocals, but $event not included
    ↓
eventCallback() {
    locals.$event = locals.$event || new CustomEvent(...);
    //              ↑ NOT set, so fallback IS used ✅
    boundFn();
}
```

**OR:**

```typescript
// Option B: Direct widget property access
widget.onClick();  // ← Stored at Line 557: widget[onEventName] = eventCallback

    ↓
eventCallback() {
    locals.$event = locals.$event || new CustomEvent(...);
    //              ↑ NOT set, so fallback IS used ✅
    boundFn();
}
```

**Result:** `locals.$event` is **not set**, so fallback **creates a CustomEvent**.

---

## Why `$event` Must Always Exist

### Event Expressions Reference `$event`

```html
<!-- Template -->
<wm-button click.event="handleClick($event)">
    Click Me
</wm-button>
```

**The parsed expression expects `$event` to exist:**
```typescript
// Parsed function signature:
function(scope, locals) {
    // Expression: "handleClick($event)"
    // Accesses: locals.$event
    handleClick(locals.$event);  // ← Will fail if $event is undefined!
}
```

**Without the fallback:**
```typescript
// If $event is undefined:
handleClick(undefined);  // ❌ Handler receives undefined
// Or worse:
handleClick(locals.$event);  // ❌ ReferenceError if $event doesn't exist
```

**With the fallback:**
```typescript
// Always has a valid event object:
handleClick(locals.$event);  // ✅ Handler receives CustomEvent object
```

---

## Code Flow Comparison

### Scenario 1: DOM Event (Fallback Not Used)

```typescript
// 1. User clicks button
// 2. handleEvent() receives MouseEvent
e => {
    locals.$event = e;  // ← MouseEvent set
    eventCallback();
}

// 3. eventCallback() executes
eventCallback() {
    locals.$event = locals.$event || new CustomEvent("click");
    //              ↑ MouseEvent exists, so || short-circuits
    //                Fallback NOT executed
    boundFn();  // Uses actual MouseEvent
}
```

### Scenario 2: Programmatic Call (Fallback Used)

```typescript
// 1. Code calls widget.onClick()
widget.onClick();

// 2. eventCallback() executes directly
eventCallback() {
    locals.$event = locals.$event || new CustomEvent("click");
    //              ↑ undefined, so || evaluates right side
    //                Fallback IS executed ✅
    // Creates: new CustomEvent("click")
    boundFn();  // Uses CustomEvent
}
```

---

## Real-World Use Cases

### Use Case 1: Testing

```typescript
// In unit tests, trigger events programmatically
widget.invokeEventCallback("click");
// Without fallback: $event would be undefined
// With fallback: $event is CustomEvent("click") ✅
```

### Use Case 2: Custom Widget Integration

```typescript
// Custom widget triggers event programmatically
this.containerWidget.invokeEventCallback("customEvent", {
    $data: someData
    // Note: $event not passed
});
// Without fallback: $event would be undefined
// With fallback: $event is CustomEvent("customEvent") ✅
```

### Use Case 3: Direct Property Access

```typescript
// Event stored as widget property (Line 557)
widget.onClick = eventCallback;

// Can be called directly
widget.onClick();
// Without fallback: $event would be undefined
// With fallback: $event is CustomEvent("click") ✅
```

---

## What Happens Without the Fallback?

### ❌ Without Fallback

```typescript
const eventCallback = () => {
    $invokeWatchers(true);
    try {
        // locals.$event might be undefined!
        boundFnVal = boundFn();  // ← Expression uses locals.$event
        // If expression is "handleClick($event)" and $event is undefined:
        // - Handler receives undefined
        // - Or ReferenceError if expression checks $event properties
    } catch (e) {
        console.error(e);
    }
};
```

**Problems:**
- Event handlers expecting `$event` receive `undefined`
- Code checking `$event.type`, `$event.target`, etc. throws errors
- Inconsistent behavior between DOM events and programmatic calls

### ✅ With Fallback

```typescript
const eventCallback = () => {
    $invokeWatchers(true);
    try {
        locals.$event = locals.$event || new window.CustomEvent(eventName);
        //              ↑ Always ensures $event exists
        boundFnVal = boundFn();  // ← Expression always has valid $event
    } catch (e) {
        console.error(e);
    }
};
```

**Benefits:**
- Event handlers always receive a valid event object
- Consistent behavior regardless of how event is triggered
- No ReferenceErrors from missing `$event`

---

## The Fallback Event Object

### CustomEvent Properties

```typescript
new window.CustomEvent(eventName)
// Creates:
{
    type: "click",        // Event name
    bubbles: false,       // Default
    cancelable: false,    // Default
    detail: null,         // Default
    target: null,         // Not set (no DOM element)
    currentTarget: null,  // Not set
    // ... other Event properties
}
```

**Note:** This is a minimal event object. It doesn't have DOM-specific properties like:
- `target` (DOM element)
- `clientX`, `clientY` (mouse coordinates)
- `keyCode`, `key` (keyboard events)

But it's sufficient for handlers that just need an event object to exist.

---

## Alternative Approaches (Why They're Not Used)

### ❌ Option 1: Always Create CustomEvent

```typescript
// Always create, even for DOM events
locals.$event = new window.CustomEvent(eventName);
```

**Problem:** Overwrites the actual DOM event, losing real properties (target, coordinates, etc.)

### ❌ Option 2: Check Before Using

```typescript
// In event expression evaluation
if (!locals.$event) {
    locals.$event = new CustomEvent(eventName);
}
```

**Problem:** Requires checking in multiple places, error-prone

### ✅ Current Approach: Fallback Pattern

```typescript
// Single line, handles both cases
locals.$event = locals.$event || new window.CustomEvent(eventName);
```

**Benefits:**
- Simple and concise
- Handles both DOM and programmatic calls
- Doesn't overwrite real DOM events
- Ensures `$event` always exists

---

## Summary

| Scenario | `locals.$event` Before | Fallback Used? | Result |
|----------|----------------------|----------------|--------|
| **DOM Event** | Set to MouseEvent | ❌ No | Uses actual DOM event |
| **Programmatic (no $event)** | `undefined` | ✅ Yes | Creates CustomEvent |
| **Programmatic (with $event)** | Set in extraLocals | ❌ No | Uses provided event |

**Key Point:** The fallback ensures `$event` is **always available** for event expressions, regardless of how the event is triggered. This prevents errors and ensures consistent behavior.

---

## Code Locations

| Line | Code | Purpose |
|------|------|---------|
| 504 | `locals.$event = e;` | Set DOM event in `handleEvent()` |
| 535 | `locals.$event = locals.$event \|\| new CustomEvent(...)` | Fallback in `eventCallback()` |
| 615 | `fn(Object.assign(locals, extraLocals))` | Merge extraLocals (may include $event) |

**The fallback is a safety net** that ensures event handlers always have a valid `$event` object, even when events are triggered programmatically without a DOM event.


