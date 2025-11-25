# Watch Registry: How It Works & Angular Alternatives

## Overview

The WaveMaker watch registry is a custom change detection system inspired by AngularJS's `$watch` mechanism. It provides a way to monitor expressions and trigger callbacks when their values change.

## How the Watch Registry Works

### 1. **Core Components**

```typescript
const registry = new Map<string, any>();  // Global registry storing all watchers
```

- **Registry**: A `Map` that stores all active watchers
- **Key**: Unique identifier (e.g., `widget-id3_title`)
- **Value**: Watch info object containing:
  - `fn`: Parsed expression function
  - `listener`: Callback function to execute on change
  - `expr`: Original expression string
  - `last`: Previous value (for comparison)
  - `doNotClone`: Whether to clone object values
  - `isMuted`: Function to check if watcher is muted

### 2. **Registering a Watcher**

```typescript
$watch(expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted)
```

**Example from BaseComponent:**
```typescript
$watch(
    expr,                    // Expression to watch: "title"
    viewParent,              // Scope object
    context,                 // Local variables
    nv => {                  // Listener callback
        widget[propName] = nv;
    },
    getWatchIdentifier(widgetId, propName),  // Unique ID
    propName === 'datasource',
    widgetProps.get(propName),
    () => isMuted
)
```

**What happens:**
1. Expression is parsed into a function (`$parseExpr`)
2. Function is bound to scope and locals
3. Watch info is stored in the registry Map
4. Returns an unwatch function for cleanup

### 3. **Change Detection Cycle**

```typescript
triggerWatchers() {
    // Runs up to 5 passes (digest cycles)
    do {
        changeDetected = false;
        registry.forEach(watchInfo => {
            const newValue = watchInfo.fn();  // Evaluate expression
            if (!isEqual(newValue, watchInfo.last)) {
                changeDetected = true;
                watchInfo.last = newValue;
                watchInfo.listener(newValue, oldValue);  // Trigger callback
            }
        });
        pass++;
    } while (changeDetected && pass < 5);
}
```

**Key Features:**
- **Dirty Checking**: Compares current vs previous value using `isEqual`
- **Multiple Passes**: Up to 5 passes to handle cascading changes
- **Debouncing**: Watchers are debounced (100ms) to batch updates
- **Muting**: Can temporarily disable watchers

### 4. **Triggering Watchers**

Watchers are triggered via:
- `$invokeWatchers()`: Manually trigger all watchers
- `$appDigest()`: Triggers Angular change detection after watchers
- **`ngDoCheck()` hook**: Called on EVERY Angular change detection cycle

**Critical Integration Point:**

```typescript
// AppComponent implements DoCheck
ngDoCheck() {
    $invokeWatchers();  // Called on EVERY change detection cycle!
}
```

**What This Means:**
- ✅ **YES** - Watch registry IS triggered on every Angular change detection cycle
- ⚠️ **BUT** - It's debounced (100ms), so multiple cycles are batched together
- ⚠️ **Performance Impact** - With 22K+ watchers, this runs on EVERY change detection cycle

### 5. **Cleanup**

```typescript
$unwatch(identifier)  // Removes watcher from registry
```

Components should call this in `ngOnDestroy` to prevent memory leaks.

## Angular's Alternative: Change Detection

Angular uses a **completely different approach** - it doesn't use a global watch registry.

### 1. **Zone.js Integration**

Angular uses Zone.js to automatically detect async operations:
- DOM events
- HTTP requests
- Timers (setTimeout, setInterval)
- Promises

When any of these occur, Angular automatically triggers change detection.

### 2. **Component Tree Traversal**

Instead of a registry, Angular:
- Traverses the **component tree** from root to leaves
- Checks each component's bindings
- Updates the DOM when values change

### 3. **Change Detection Strategies**

Angular provides different strategies:

**Default Strategy (CheckAlways):**
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.Default
})
```
- Checks all components on every change detection cycle
- Similar to watch registry (checks everything)

**OnPush Strategy:**
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```
- Only checks when:
  - Input references change
  - Events occur in the component
  - Observables emit (with async pipe)
  - Manual trigger via `ChangeDetectorRef.detectChanges()`

### 4. **Angular's Equivalent Mechanisms**

#### A. **Property Binding (One-way)**
```typescript
// Template
<div>{{ title }}</div>

// Angular automatically tracks this
// No manual watcher needed!
```

#### B. **Two-way Binding**
```typescript
// Template
<input [(ngModel)]="name" />

// Angular uses:
// - Property binding: [ngModel]="name"
// - Event binding: (ngModelChange)="name = $event"
```

#### C. **Observables (Reactive)**
```typescript
// Component
name$ = new BehaviorSubject('John');

// Template
<div>{{ name$ | async }}</div>

// Angular automatically subscribes/unsubscribes
```

#### D. **Manual Change Detection**
```typescript
constructor(private cdr: ChangeDetectorRef) {}

updateValue() {
    this.value = 'new';
    this.cdr.detectChanges();  // Manual trigger
    // or
    this.cdr.markForCheck();  // Mark for next cycle
}
```

### 5. **Key Differences**

| Feature | WaveMaker Watch Registry | Angular Change Detection |
|---------|-------------------------|--------------------------|
| **Storage** | Global Map registry | Component tree structure |
| **Triggering** | Manual via `$invokeWatchers()` | Automatic via Zone.js |
| **Scope** | Global - all watchers in one place | Scoped - per component |
| **Performance** | Can have thousands of watchers | Optimized with OnPush strategy |
| **Memory** | Must manually unwatch | Automatic cleanup on destroy |
| **Expression Parsing** | Custom parser (`$parseExpr`) | Template compiler (AOT) |
| **Change Detection** | Dirty checking (value comparison) | Reference checking + OnPush |

## Migration Path: Watch Registry → Angular

### Current Pattern (Watch Registry)
```typescript
// Register watcher
const unwatch = $watch(
    'widget.title',
    this.viewParent,
    this.context,
    (newValue) => {
        this.title = newValue;
    },
    `widget-${this.widgetId}-title`
);

// Cleanup
ngOnDestroy() {
    unwatch();
}
```

### Angular Equivalent (OnPush Strategy)
```typescript
// Component
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent {
    @Input() title: string;
    
    // No manual watcher needed!
    // Angular handles it automatically
}
```

### Angular Equivalent (Observable)
```typescript
// Service
@Injectable()
export class DataService {
    title$ = new BehaviorSubject<string>('Default');
}

// Component
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent {
    title$ = this.dataService.title$;
}

// Template
<div>{{ title$ | async }}</div>
```

## Change Detection Cycle Flow

### How Watch Registry Runs on Every Cycle

```
1. User Action / Async Event (click, HTTP, timer, etc.)
   ↓
2. Zone.js detects the event
   ↓
3. Angular triggers change detection cycle
   ↓
4. Angular traverses component tree (Default strategy)
   ↓
5. AppComponent.ngDoCheck() is called
   ↓
6. $invokeWatchers() is called
   ↓
7. Debounced (100ms) - batches multiple cycles
   ↓
8. triggerWatchers() runs:
   - Loops through ALL watchers in registry (22K+)
   - Evaluates each expression
   - Compares with previous value
   - Triggers listener if changed
   - Runs up to 5 passes if changes cascade
   ↓
9. $appDigest() triggers Angular change detection again
   ↓
10. Cycle repeats if watchers caused changes
```

### Performance Impact

**With 22,855 watchers:**
- Every Angular change detection cycle → calls `ngDoCheck()`
- Every `ngDoCheck()` → calls `$invokeWatchers()`
- Every `$invokeWatchers()` → evaluates ALL 22,855 expressions
- This happens on:
  - Every DOM event (click, input, scroll, etc.)
  - Every HTTP response
  - Every timer tick
  - Every Promise resolution
  - Any async operation

**Debouncing helps but doesn't eliminate:**
- Multiple rapid events are batched (100ms delay)
- But still evaluates ALL watchers after the delay
- With 22K watchers, this is expensive even with debouncing

**Debouncing Mechanism:**
```typescript
// When $invokeWatchers() is called (without force flag):
const debouncedTriggerWatchers = debounce(() => {
    skipWatchers = true;
    ngZone.run(() => triggerWatchers());
}, 100);

// If called multiple times within 100ms:
// - Only the LAST call executes after 100ms
// - All intermediate calls are ignored
// - This batches rapid change detection cycles
```

**However:**
- If change detection runs every 200ms, debouncing doesn't help
- Each cycle still triggers `ngDoCheck()` → `$invokeWatchers()`
- The debounce just delays execution, doesn't prevent it

## Performance Considerations

### Watch Registry Issues
- **Global registry**: All watchers in one Map can become large (22K+ watchers)
- **Dirty checking**: Evaluates all expressions every cycle
- **No optimization**: Can't skip components that haven't changed

### Angular Advantages
- **OnPush strategy**: Only checks changed components
- **Tree shaking**: Unused code is eliminated
- **AOT compilation**: Expressions compiled at build time
- **Zone.js optimization**: Only triggers when needed

## Best Practices

### For Watch Registry (Current)
1. Always unwatch in `ngOnDestroy`
2. Use `isMuted` to prevent unnecessary watchers
3. Minimize watcher count (use computed properties)
4. Use `doNotClone` for large objects

### For Angular (Future)
1. Use OnPush strategy when possible
2. Use Observables with async pipe
3. Avoid manual change detection
4. Use trackBy functions for *ngFor
5. Leverage AOT compilation

## Conclusion

The watch registry is a **custom solution** that provides AngularJS-like behavior. Angular's change detection is **more modern and optimized**, but requires a different architecture. The localhost version showing only 5 watchers suggests optimizations are being applied, possibly moving toward Angular's native change detection mechanisms.

