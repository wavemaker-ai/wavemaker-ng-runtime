# Watch Registry Code Locations

## Where the Code is Written

### 1. **AppComponent - Entry Point (ngDoCheck Hook)**

**File:** `projects/runtime-base/src/components/app-component/app.component.ts`

```typescript
// Line 63: Implements DoCheck interface
export class AppComponent implements DoCheck, AfterViewInit, OnDestroy {

    // Line 250-252: Called on EVERY Angular change detection cycle
    ngDoCheck() {
        $invokeWatchers();
    }
}
```

**What it does:**
- `DoCheck` interface ensures `ngDoCheck()` is called on every change detection cycle
- This is the **entry point** that triggers watch registry evaluation

---

### 2. **Watcher Utility - Core Implementation**

**File:** `projects/core/src/utils/watcher.ts`

#### A. **$invokeWatchers() - Public API**

```typescript
// Line 180-191: Public function called from ngDoCheck()
export const $invokeWatchers = (force?: boolean, ignoreMuted?: boolean) => {
    if (force) {
        triggerWatchers(ignoreMuted);  // Immediate execution
    } else {
        if (skipWatchers) {
            skipWatchers = false;
            return;
        }
        debouncedTriggerWatchers();  // Debounced execution (100ms)
    }
};
```

#### B. **debouncedTriggerWatchers() - Debouncing Logic**

```typescript
// Line 173-178: Debounces watcher execution
let skipWatchers;

const debouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    ngZone.run(() => triggerWatchers());
}, 100);
```

**What it does:**
- Debounces rapid calls (100ms delay)
- Runs watchers inside Angular Zone
- Batches multiple change detection cycles together

#### C. **triggerWatchers() - Core Evaluation Logic**

```typescript
// Line 113-160: Evaluates ALL watchers in registry
const triggerWatchers = (ignoreMuted?: boolean) => {
    if (muted && !ignoreMuted) {
        return;
    }

    const limit = 5;
    let pass = 1;
    let changeDetected;

    do {
        changeDetected = false;
        registry.forEach(watchInfo => {  // ← Loops through ALL watchers
            if(watchInfo.isMuted && watchInfo.isMuted()) {
                return;
            }
            const fn = watchInfo.fn;
            const listener = watchInfo.listener;
            const ov = watchInfo.last;
            let nv;

            try {
                nv = fn();  // ← Evaluates expression
            } catch (e) {
                console.warn(`error in executing expression: '${watchInfo.expr}'`);
            }

            if (!isEqual(nv, ov)) {  // ← Compares with previous value
                changeDetected = true;
                changedByWatch = true;
                watchInfo.last = nv;

                if (isObject(nv) && !watchInfo.doNotClone && nv.__cloneable__ !== false) {
                    watchInfo.last = clone(nv);
                }
                listener(nv, ov);  // ← Triggers callback
                resetChangeFromWatch();
            }
        });
        pass++;

    } while (changeDetected && pass < limit);  // ← Up to 5 passes

    if (changeDetected && pass === limit) {
        console.warn(`Number of watch cycles gone above set limit of: ${limit} `);
    }
};
```

**What it does:**
- Loops through **ALL watchers** in the registry (line 125)
- Evaluates each expression (line 135)
- Compares with previous value (line 140)
- Triggers listener if changed (line 149)
- Runs up to 5 passes for cascading changes

#### D. **Registry Storage**

```typescript
// Line 7: Global registry storing all watchers
const registry = new Map<string, any>();
```

---

### 3. **Where Watchers are Registered**

**File:** `projects/components/base/src/widgets/common/base/base.component.ts`

```typescript
// Line 566-591: processBindAttr() registers watchers
protected processBindAttr(propName: string, expr: string, child ?: any) {
    if(!child)
        this.initState.delete(propName);
    let viewParent  = child ? child.widget.viewParent.viewParent : this.viewParent,
        context     = child ? child.widget.context : this.context,
        widget      = child ? child.widget : this.widget,
        isMuted     = child ? child.widget.isMuted : this.isMuted,
        widgetProps = child ? child.widget.widgetProps : this.widgetProps,
        widgetId    = child ? child.widget.widgetId : this.widgetId;
    this.registerDestroyListener(
        $watch(  // ← Registers watcher in registry
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

---

## Complete Flow

```
1. Angular Change Detection Cycle Starts
   ↓
2. projects/runtime-base/src/components/app-component/app.component.ts
   ngDoCheck() { $invokeWatchers(); }
   ↓
3. projects/core/src/utils/watcher.ts
   $invokeWatchers() → debouncedTriggerWatchers() (100ms delay)
   ↓
4. projects/core/src/utils/watcher.ts
   triggerWatchers() → registry.forEach() → evaluates ALL watchers
   ↓
5. Each watcher:
   - Evaluates expression (fn())
   - Compares with previous value
   - Triggers listener if changed
   ↓
6. Up to 5 passes if changes cascade
```

---

## Key Files Summary

| File | Purpose | Key Code |
|------|---------|----------|
| `app.component.ts` | Entry point | `ngDoCheck() { $invokeWatchers(); }` |
| `watcher.ts` | Core implementation | `triggerWatchers()`, `$invokeWatchers()` |
| `base.component.ts` | Watcher registration | `processBindAttr()` → `$watch()` |
| `watcher.ts` | Registry storage | `const registry = new Map()` |

---

## How to Find These Files

```bash
# AppComponent (entry point)
projects/runtime-base/src/components/app-component/app.component.ts

# Watcher implementation
projects/core/src/utils/watcher.ts

# Watcher registration
projects/components/base/src/widgets/common/base/base.component.ts
```


