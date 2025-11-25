# Why Event Registry is Component-Level but Watch Registry is Global

## The Core Difference

| Aspect | Event Registry | Watch Registry |
|--------|---------------|----------------|
| **Trigger** | User interaction (click, change, etc.) | Every Angular change detection cycle |
| **Scope** | Component-level | Global |
| **When Executed** | Only when user interacts with that component | Every time Angular runs change detection |
| **Iteration Need** | No - only one event fires at a time | Yes - must check ALL watchers every cycle |

---

## Why Watch Registry is Global

### 1. **Change Detection is Global**

Angular's change detection runs for the **entire application** on every cycle:

```typescript
// app.component.ts - Line 258
ngDoCheck() {
    $invokeWatchers();  // ← Called ONCE per change detection cycle
}
```

**If watchers were component-level:**
```typescript
// ❌ BAD: Would need to traverse entire component tree
ngDoCheck() {
    // How would we find all components?
    // How would we iterate through all component watchers?
    // We'd need to maintain a list of all components!
    this.traverseComponentTree(component => {
        component.triggerWatchers();  // Inefficient!
    });
}
```

**With global registry:**
```typescript
// ✅ GOOD: Single iteration through all watchers
triggerWatchers() {
    registry.forEach(watchInfo => {  // ← One pass, all watchers
        // Evaluate and check for changes
    });
}
```

### 2. **Single Pass Efficiency**

The watch registry uses a **digest cycle** (like AngularJS) that runs up to 5 passes until no changes are detected:

```typescript
// watcher.ts - Line 123-165
const triggerWatchers = () => {
    let pass = 1;
    let changeDetected;
    
    do {
        changeDetected = false;
        registry.forEach(watchInfo => {  // ← Iterate ALL watchers
            // Check for changes
        });
        pass++;
    } while (changeDetected && pass < 5);
};
```

**Key Point:** This requires iterating through **all watchers** in a single pass. A global Map makes this efficient.

### 3. **Change Detection Frequency**

Watchers are checked **thousands of times per second**:
- Every Angular change detection cycle
- On every user interaction
- On every async operation (timers, HTTP, etc.)
- Potentially 60+ times per second (if change detection runs every frame)

**Performance Impact:**
- Global registry: One `forEach()` call → O(n) where n = total watchers
- Component-level: Would need to traverse component tree → O(n × m) where m = component depth

---

## Why Event Registry is Component-Level

### 1. **Events are Scoped to DOM Elements**

Each widget has its own DOM element, and events are attached to that specific element:

```typescript
// base.component.ts - Line 499
protected handleEvent(node: HTMLElement, eventName: string, ...) {
    this.eventManager.addEventListener(
        node,  // ← Specific DOM element
        eventName,
        handler
    );
}
```

**Natural Scoping:**
- Button click → only that button's handler fires
- Input change → only that input's handler fires
- No need to check other components' events

### 2. **Events Only Fire on User Interaction**

Unlike watchers (checked every cycle), events only fire when:
- User clicks a button
- User types in an input
- User hovers over an element
- **Specific, targeted interactions**

**No Global Iteration Needed:**
```typescript
// When user clicks button:
User clicks → DOM event fires → Specific handler executes
    ↓
widget.eventHandlers.get("click").callback()  // ← Only one event, one component
```

**If events were global:**
```typescript
// ❌ UNNECESSARY: Would need to check all components
onClick(event) {
    // Which component's event handler should fire?
    // Need to find the right component somehow...
    globalEventRegistry.forEach((handlers, componentId) => {
        // Check if this event belongs to this component...
    });
}
```

### 3. **Automatic Cleanup**

Component-level events are automatically cleaned up when the component is destroyed:

```typescript
// Component destroyed
ngOnDestroy() {
    // eventHandlers Map is garbage collected automatically
    // No manual cleanup needed!
}
```

**With global event registry:**
```typescript
// ❌ Would need manual cleanup
ngOnDestroy() {
    // Remove this component's events from global registry
    globalEventRegistry.deleteAllForComponent(this.widgetId);
}
```

### 4. **No Cross-Component Communication Needed**

Events are **local to the component** that owns the DOM element:
- Button's click event → only affects that button's component
- No need to share events across components
- Each component manages its own event handlers

**Watchers, on the other hand:**
- Can watch expressions that span multiple components
- Need to detect changes across the entire app
- Must be evaluated together to detect cascading changes

---

## Real-World Analogy

### Watch Registry (Global) = Security Camera System
- **All cameras** need to be checked regularly
- Security guard walks through **all cameras** in one pass
- Changes in one area might affect others
- **Global monitoring** makes sense

### Event Registry (Component-Level) = Doorbell System
- Each house has its own doorbell
- When someone rings **your** doorbell, only **your** bell rings
- No need to check all doorbells in the neighborhood
- **Local to each house** makes sense

---

## Code Evidence

### Watch Registry: Global Iteration

```typescript
// watcher.ts - Line 135
registry.forEach(watchInfo => {  // ← Iterates ALL watchers
    const nv = watchInfo.fn();   // Evaluate expression
    if (!isEqual(nv, ov)) {      // Check for change
        watchInfo.listener(nv);   // Trigger callback
    }
});
```

**Called from:**
```typescript
// app.component.ts - Line 258
ngDoCheck() {
    $invokeWatchers();  // Triggers global iteration
}
```

### Event Registry: Component-Specific Lookup

```typescript
// base.component.ts - Line 608
public invokeEventCallback(eventName: string, extraLocals?: any) {
    const callbackInfo = this.eventHandlers.get(eventName);  // ← Only THIS component
    if (callbackInfo) {
        callbackInfo.callback();  // Execute handler
    }
}
```

**Called from:**
```typescript
// DOM event fires on specific element
buttonElement.addEventListener("click", (e) => {
    widget.invokeEventCallback("click", {$event: e});  // ← Only this widget
});
```

---

## Performance Comparison

### Watch Registry (Global)
```
Change Detection Cycle:
├─ AppComponent.ngDoCheck()
│  └─ $invokeWatchers()
│     └─ registry.forEach()  ← Single iteration, all watchers
│        ├─ widget-1 watchers (100)
│        ├─ widget-2 watchers (50)
│        ├─ widget-3 watchers (200)
│        └─ ... (22,855 total)
└─ Done in one pass ✅
```

**Efficiency:** O(n) - one iteration through all watchers

### Event Registry (Component-Level)
```
User Clicks Button:
├─ DOM event fires on button element
├─ Find widget that owns element
├─ widget.eventHandlers.get("click")  ← Direct lookup
└─ Execute callback ✅
```

**Efficiency:** O(1) - direct Map lookup, no iteration needed

---

## Summary

| Reason | Watch Registry (Global) | Event Registry (Component-Level) |
|--------|------------------------|----------------------------------|
| **Trigger Frequency** | Every change detection cycle (60+ times/sec) | Only on user interaction |
| **Iteration Required** | Yes - must check ALL watchers | No - only one event fires at a time |
| **Scope of Changes** | Can affect entire app | Local to component |
| **Performance** | Global iteration is efficient | Component lookup is efficient |
| **Cleanup** | Manual via destroy listeners | Automatic (garbage collected) |
| **Design Pattern** | Digest cycle (AngularJS style) | Event delegation (standard DOM) |

**Bottom Line:**
- **Watchers** need to be checked **globally** on every change detection cycle → Global registry
- **Events** only fire **locally** on user interaction → Component-level registry

Both designs are optimal for their use cases! 🎯


