# Event Registry Explanation

## Overview

Unlike the **watch registry** (which is a **global** Map shared across all components), the **event registry** is **component-level** - each widget instance has its own `eventHandlers` Map.

---

## Structure

### Event Registry Location

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

**Line 155:**
```typescript
private eventHandlers = new Map<string, {callback: Function, locals: any}>();
```

### Data Structure

```typescript
eventHandlers: Map<string, {
    callback: Function,    // The event handler function to execute
    locals: any           // Context/local variables for the event
}>
```

**Key:** Event name (e.g., `"click"`, `"change"`, `"customEvent"`)  
**Value:** Object containing:
- `callback`: The function to execute when the event fires
- `locals`: Context object with variables accessible in the event handler

---

## How Events Are Registered

### Entry Point: `processEventAttr()`

**Location:** Line 522-563

**Flow:**
```typescript
processAttr("click.event", "handleClick()")
    ↓
processEventAttr("click", "handleClick()")
    ↓
1. Parse expression: $parseEvent("handleClick()")
2. Create bound function with context
3. Wrap in eventCallback that:
   - Triggers watchers before execution
   - Handles promises
   - Sets up $event in locals
4. Store in eventHandlers Map
5. Also store on widget as onClick property
6. Queue for DOM attachment after view init
```

### Code Breakdown

```typescript
protected processEventAttr(eventName: string, expr: string, meta?: string, child?: Child) {
    // 1. Parse the event expression (e.g., "handleClick()" → function)
    const fn = $parseEvent(expr);
    
    // 2. Set up context/locals
    const locals = this.context;
    locals.widget = child ? child.widget : this.widget;
    
    // 3. Bind function to view parent and locals
    const boundFn = fn.bind(undefined, 
        child ? this.viewParent.viewParent : this.viewParent, 
        locals
    );

    // 4. Create event callback wrapper
    const eventCallback = () => {
        $invokeWatchers(true);  // ← Trigger watchers before event
        try {
            locals.$event = locals.$event || new window.CustomEvent(eventName);
            boundFnVal = boundFn();
            
            // Handle promises (for async variable calls)
            if (boundFnVal instanceof Promise) {
                return boundFnVal.then(response => response, err => err);
            } else {
                return boundFnVal;
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    // 5. Initialize eventHandlers if needed (for child widgets)
    if(child && !child.widget.eventHandlers)
        child.widget.eventHandlers = new Map<string, {callback: Function, locals: any}>()
    
    // 6. Store in eventHandlers Map
    widget.eventHandlers.set(
        this.getMappedEventName(eventName),  // e.g., "click"
        {callback: eventCallback, locals}
    );
    
    // 7. Also store as widget property (e.g., widget.onClick)
    const onEventName = camelCase(`on-${eventName}`);  // "click" → "onClick"
    widget[onEventName] = eventCallback;
    
    // 8. Queue for DOM attachment after view initialization
    this.toBeSetupEventsQueue.push(() => {
        this.handleEvent(nativeElement, this.getMappedEventName(eventName), eventCallback, locals, meta);
    });
}
```

---

## How Events Are Invoked

### Method: `invokeEventCallback()`

**Location:** Line 608-618

```typescript
public invokeEventCallback(eventName: string, extraLocals?: any) {
    const callbackInfo = this.eventHandlers.get(eventName);
    if (callbackInfo) {
        const fn = callbackInfo.callback;
        const locals = callbackInfo.locals || {};
        
        if (fn) {
            // Merge extra locals (e.g., $event, $data) with existing locals
            return fn(Object.assign(locals, extraLocals));
        }
    }
}
```

**Usage Example:**
```typescript
// From custom widget or programmatic call
widget.invokeEventCallback("click", {$event: mouseEvent, $data: someData});
```

---

## DOM Event Attachment

### Method: `handleEvent()`

**Location:** Line 499-512

After view initialization, events are attached to DOM elements:

```typescript
protected handleEvent(node: HTMLElement, eventName: string, eventCallback: Function, locals: any, meta?: string) {
    this.eventManager.addEventListener(
        node,
        eventName,
        e => {
            locals.$event = e;  // Set the actual DOM event
            if (meta === 'delayed') {
                setTimeout(() => eventCallback(), 150);  // Delayed execution
            } else {
                return eventCallback();  // Immediate execution
            }
        }
    );
}
```

**Note:** Uses `eventManager.addEventListener()` which handles cleanup and event delegation.

---

## Comparison: Event Registry vs Watch Registry

| Aspect | Event Registry | Watch Registry |
|--------|---------------|----------------|
| **Scope** | Component-level (per widget) | Global (shared across all widgets) |
| **Storage** | `widget.eventHandlers: Map<string, {callback, locals}>` | `registry: Map<string, Watcher>` |
| **Trigger** | User interaction (click, change, etc.) | Every Angular change detection cycle |
| **Purpose** | Execute callbacks on user events | Detect and react to data changes |
| **Cleanup** | Automatic (component destroyed) | Manual via `$unwatch()` or destroy listener |
| **Count** | ~1-10 per component | Thousands (22K+ on complex pages) |

---

## Example: Complete Event Flow

### HTML Template
```html
<wm-button click.event="handleClick($event, $data)">
    Click Me
</wm-button>
```

### Processing Flow

#### 1. **Registration Phase** (Component Init)
```typescript
processAttr("click.event", "handleClick($event, $data)")
    ↓
processEventAttr("click", "handleClick($event, $data)")
    ↓
eventHandlers.set("click", {
    callback: eventCallback,
    locals: {widget: this.widget, Variables: ..., Actions: ...}
})
```

#### 2. **DOM Attachment Phase** (After View Init)
```typescript
handleEvent(buttonElement, "click", eventCallback, locals)
    ↓
eventManager.addEventListener(buttonElement, "click", handler)
```

#### 3. **Execution Phase** (User Clicks Button)
```typescript
User clicks button
    ↓
DOM event fires
    ↓
handler(e) {
    locals.$event = e;
    eventCallback();
}
    ↓
eventCallback() {
    $invokeWatchers(true);  // Trigger change detection
    boundFn();  // Execute "handleClick($event, $data)"
}
```

---

## Key Points

1. **Component-Level**: Each widget has its own `eventHandlers` Map
2. **Not Global**: Unlike watch registry, events are not shared across components
3. **Lazy DOM Attachment**: Events are queued and attached after view initialization
4. **Watcher Integration**: Events trigger `$invokeWatchers(true)` before execution
5. **Promise Support**: Handles async variable calls that return promises
6. **Context Preservation**: `locals` object maintains context (Variables, Actions, widget, etc.)
7. **Dual Storage**: Stored both in `eventHandlers` Map and as widget properties (e.g., `widget.onClick`)

---

## Code Locations

| Function | File | Line |
|----------|------|------|
| `eventHandlers` declaration | `base.component.ts` | 155 |
| `processEventAttr()` | `base.component.ts` | 522 |
| `invokeEventCallback()` | `base.component.ts` | 608 |
| `handleEvent()` | `base.component.ts` | 499 |
| Event queue setup | `base.component.ts` | 560 |

---

## Summary

The **event registry** is a **component-level Map** that stores event handlers for each widget. Unlike the global watch registry, it:
- Stores handlers per component instance
- Is triggered by user interactions (not change detection)
- Automatically cleans up when component is destroyed
- Integrates with the watch registry by triggering watchers before event execution


