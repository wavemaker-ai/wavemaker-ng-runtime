# Angular Signals Migration Plan V2: Bind Expression to Signals

## Executive Summary

This migration plan replaces **only** the bind expression evaluation system (`processBindAttr`) with Angular Signals, while keeping all other watcher functionality (events, manual watches) unchanged. The migration is transparent to developers - no feature flags, no opt-in required.

**Key Clarifications:**
- Current watcher.ts has **NO dependency tracking** - it's a simple poll-all digest loop
- Migration targets **ONLY** bind expressions (`.bind` attributes)
- Event expressions (`.event` attributes) remain with watchers
- Manual `$watch()` calls remain unchanged
- The change is internal to the framework - no API changes

---

## Current Architecture: What Actually Happens

### 1. Watcher Registry - The Actual Implementation

```typescript
// watcher.ts - Current implementation
const registry = new Map<string, WatchInfo>();

interface WatchInfo {
    fn: Function;           // Expression function
    listener: Function;     // Callback to update widget property
    expr: string;          // Original expression string
    last: any;             // Last value (for dirty checking)
    doNotClone: boolean;
    isMuted?: () => boolean;
}

// The digest loop - Executes ALL watchers, no optimization
function executeWatchers(ignoreMuted: boolean) {
    ngZone.runOutsideAngular(() => {
        let pass = 1;
        let changeDetected: boolean;

        do {
            changeDetected = false;

            // 🔥 THIS IS THE PROBLEM: Executes EVERY watcher
            registry.forEach(watchInfo => {
                if (watchInfo.isMuted && watchInfo.isMuted()) return;

                const nv = watchInfo.fn();  // Execute expression

                if (!_.isEqual(nv, watchInfo.last)) {  // Deep equality check
                    changeDetected = true;
                    watchInfo.last = nv;
                    watchInfo.listener(nv, ov);  // Update property
                }
            });

            pass++;
        } while (changeDetected && pass < MAX_PASSES);
    });

    // Trigger Angular change detection if changes detected
    if (actuallyChanged) {
        ngZone.run(() => {});
    }
}
```

**Pain Point**: With 1000 watchers, every change detection cycle:
- Executes 1000 expression functions
- Performs 1000 deep equality checks
- Results in 50-100ms+ per cycle

### 2. Bind Expression Flow - Current Implementation

```html
<!-- Template -->
<div name.bind="Variables.userData.firstName"></div>
```

```typescript
// Step 1: Attribute is parsed by processAttr()
protected processAttr(attrName: string, attrValue: string) {
    const {0: propName, 1: type} = attrName.split('.');

    if (type === 'bind') {
        // attrName = 'name.bind'
        // propName = 'name'
        // attrValue = 'Variables.userData.firstName'
        this.processBindAttr(propName, attrValue);
    } else if (type === 'event') {
        this.processEventAttr(propName, attrValue);
    }
}

// Step 2: processBindAttr registers a watcher
protected processBindAttr(propName: string, expr: string) {
    const unwatch = $watch(
        expr,                              // 'Variables.userData.firstName'
        this.viewParent,                   // Page context
        this.context,                      // Local context
        nv => this.widget[propName] = nv,  // Listener
        getWatchIdentifier(this.widgetId, propName)  // 'widget-123-name'
    );

    this.registerDestroyListener(unwatch);
}

// Step 3: $watch adds entry to registry
export const $watch = (expr, $scope, $locals, listener, identifier) => {
    const fn = $parseExpr(expr);  // Get compiled expression function

    registry.set(identifier, {
        fn: fn.bind(expr, $scope, $locals),
        listener,
        expr,
        last: FIRST_TIME_WATCH,
        doNotClone: false
    });

    return () => $unwatch(identifier);
};
```

**Key Insight**: The watcher registry is used for:
1. **Bind expressions** (from `.bind` attributes) - **MIGRATE THESE**
2. **Event expressions** (from `.event` attributes) - **KEEP AS IS**
3. **Manual watches** (explicit `$watch()` calls) - **KEEP AS IS**

---

## Signal-Based Architecture: How It Will Work

### Core Concept: Making Variables Observable

The fundamental challenge is that WaveMaker variables are **plain objects**:

```typescript
// Current state
Variables.userData = {
    firstName: 'John',
    lastName: 'Doe',
    dataSet: [...]
};

// When you do: Variables.userData.firstName = 'Jane'
// → Watchers don't know until next digest cycle
```

**Solution**: Wrap variable properties with Signals while maintaining backward compatibility

```typescript
// After Signal migration (transparent to user code)
Variables.userData = {
    get firstName() { return firstNameSignal(); },
    set firstName(v) { firstNameSignal.set(v); },
    // ... same for other properties
};

// Now when you do: Variables.userData.firstName = 'Jane'
// → Signal updates immediately
// → Effects subscribed to firstName() automatically re-run
```

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Widget Component                        │
│  <div name.bind="Variables.userData.firstName"></div>    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│        processAttr() - Routes by attribute type          │
├─────────────────────────────────────────────────────────┤
│  • name.bind  → processBindAttr()       [MIGRATE]       │
│  • click.event → processEventAttr()     [KEEP]          │
│  • name        → initState.set()         [KEEP]         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         processBindAttr() - NEW Implementation           │
│                                                          │
│  1. Parse expression dependencies                        │
│  2. Create computed Signal from expression               │
│  3. Create effect() to update widget property            │
│  4. NO watcher registry entry                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Signal Expression Engine                    │
│                                                          │
│  • Wraps Variables/Widgets with Signal proxies           │
│  • Maintains computed Signal cache                       │
│  • Manages effect lifecycles                             │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Component 1: Signal Proxy for Variables

The key insight is that we need to make variable properties reactive **without breaking existing code**.

```typescript
// projects/core/src/signals/signal-proxy.ts

import { signal, WritableSignal, Signal } from '@angular/core';

/**
 * Wraps an object to make its properties reactive Signals
 * while maintaining normal object access syntax
 */
export class SignalProxy {
    private signals = new Map<string, WritableSignal<any>>();
    private proxy: any;

    constructor(private target: any, private path: string = '') {
        this.proxy = this.createProxy(target);
    }

    private createProxy(obj: any, currentPath: string = this.path): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        return new Proxy(obj, {
            get: (target, prop: string) => {
                const fullPath = currentPath ? `${currentPath}.${prop}` : prop;
                const value = target[prop];

                // If this property is already a Signal, return its value
                if (this.signals.has(fullPath)) {
                    return this.signals.get(fullPath)!();
                }

                // If value is an object, wrap it recursively
                if (value !== null && typeof value === 'object') {
                    return this.createProxy(value, fullPath);
                }

                // Primitive value - create a Signal for it
                const sig = signal(value);
                this.signals.set(fullPath, sig);
                return sig();
            },

            set: (target, prop: string, value) => {
                const fullPath = currentPath ? `${currentPath}.${prop}` : prop;

                // Update or create Signal
                if (this.signals.has(fullPath)) {
                    this.signals.get(fullPath)!.set(value);
                } else {
                    const sig = signal(value);
                    this.signals.set(fullPath, sig);
                }

                // Also set on target for backward compatibility
                target[prop] = value;
                return true;
            }
        });
    }

    /**
     * Get Signal for a property path
     */
    getSignal(path: string): Signal<any> | undefined {
        return this.signals.get(path);
    }

    /**
     * Get or create a WritableSignal for a property path
     */
    getOrCreateSignal(path: string): WritableSignal<any> {
        if (this.signals.has(path)) {
            return this.signals.get(path)!;
        }

        // Navigate the path to get current value
        const value = this.getValueByPath(this.proxy, path);
        const sig = signal(value);
        this.signals.set(path, sig);
        return sig;
    }

    private getValueByPath(obj: any, path: string): any {
        return path.split('.').reduce((o, key) => o?.[key], obj);
    }

    getProxy(): any {
        return this.proxy;
    }
}

// Usage in page initialization
export function wrapVariablesWithSignals(variables: any): any {
    const proxy = new SignalProxy(variables, 'Variables');
    return proxy.getProxy();
}
```

**Key Points:**
- The proxy intercepts property access and returns Signal values
- Setting properties updates both the Signal and the original object (backward compatibility)
- Nested properties are handled recursively
- Existing code like `Variables.userData.firstName = 'Jane'` still works

### Component 2: Signal Expression Compiler

```typescript
// projects/core/src/signals/signal-expression-compiler.ts

import { computed, Signal, effect, EffectRef } from '@angular/core';
import { $parseExpr } from '../utils/expression-parser';

export interface SignalBinding {
    expr: string;
    signal: Signal<any>;
    effectRef: EffectRef;
    dependencies: string[];
}

export class SignalExpressionCompiler {
    private bindings = new Map<string, SignalBinding>();
    private signalProxy: SignalProxy;

    constructor(signalProxy: SignalProxy) {
        this.signalProxy = signalProxy;
    }

    /**
     * Create a binding from expression to widget property
     * This replaces $watch() for bind expressions
     */
    createBinding(
        identifier: string,          // 'widget-123-name'
        expr: string,                // 'Variables.userData.firstName'
        listener: (value: any) => void  // nv => widget.name = nv
    ): () => void {
        // Step 1: Parse expression dependencies
        const dependencies = this.extractDependencies(expr);

        // Step 2: Get the compiled expression function
        const exprFn = $parseExpr(expr);

        // Step 3: Create computed Signal
        // The computed() will automatically track Signal dependencies
        const computedSignal = computed(() => {
            // When we evaluate the expression, it reads from Signal proxies
            // Angular's computed() automatically tracks these reads
            return exprFn(this.context, this.locals);
        });

        // Step 4: Create effect to update widget property
        const effectRef = effect(() => {
            const value = computedSignal();
            listener(value);
        });

        // Store binding
        this.bindings.set(identifier, {
            expr,
            signal: computedSignal,
            effectRef,
            dependencies
        });

        // Return cleanup function (compatible with $watch API)
        return () => this.removeBinding(identifier);
    }

    removeBinding(identifier: string): void {
        const binding = this.bindings.get(identifier);
        if (binding) {
            binding.effectRef.destroy();
            this.bindings.delete(identifier);
        }
    }

    /**
     * Extract dependency paths from expression
     * 'Variables.userData.firstName' => ['Variables.userData.firstName']
     * 'Widgets.table1.dataset[$i].name' => ['Widgets.table1.dataset']
     */
    private extractDependencies(expr: string): string[] {
        // Simple implementation: extract property paths
        // More sophisticated: parse AST and extract all property reads
        const deps: string[] = [];

        // Match: Variables.xxx.yyy or Widgets.xxx.yyy
        const regex = /(Variables|Widgets|Actions)\.[\w.]+/g;
        let match;
        while ((match = regex.exec(expr)) !== null) {
            deps.push(match[0]);
        }

        return deps;
    }
}
```

### Component 3: Enhanced processBindAttr

```typescript
// projects/components/base/src/widgets/common/base/base.component.ts

import { inject } from '@angular/core';
import { SignalExpressionCompiler } from '@wm/core/signals';

export abstract class BaseComponent {
    private signalCompiler = inject(SignalExpressionCompiler, { optional: true });

    /**
     * Process bind attribute
     * NOW uses Signals instead of watchers
     */
    protected processBindAttr(propName: string, expr: string, child?: any) {
        if (!child) {
            this.initState.delete(propName);
        }

        const viewParent = child ? child.widget.viewParent.viewParent : this.viewParent;
        const context = child ? child.widget.context : this.context;
        const widget = child ? child.widget : this.widget;
        const widgetId = child ? child.widget.widgetId : this.widgetId;

        // Use Signals if compiler is available, otherwise fallback to watchers
        if (this.signalCompiler) {
            // NEW: Signal-based binding
            const unsubscribe = this.signalCompiler.createBinding(
                getWatchIdentifier(widgetId, propName),
                expr,
                nv => {
                    if (propName.startsWith('base-') && widget.updateData) {
                        widget.updateData(propName, nv);
                    }
                    widget[propName] = nv;
                }
            );

            this.registerDestroyListener(unsubscribe);
        } else {
            // FALLBACK: Watcher-based binding (existing code)
            const unwatch = $watch(
                expr,
                viewParent,
                context,
                nv => {
                    if (propName.startsWith('base-') && widget.updateData) {
                        widget.updateData(propName, nv);
                    }
                    widget[propName] = nv;
                },
                getWatchIdentifier(widgetId, propName),
                propName === 'datasource',
                {},
                () => child ? child.widget.isMuted : this.isMuted
            );

            this.registerDestroyListener(unwatch);
        }
    }
}
```

**Key Points:**
- Same API signature - no breaking changes
- Automatically uses Signals if available, otherwise watchers
- Cleanup is identical for both paths
- Event attributes continue to use watchers

---

## Migration Path: How Variables Become Reactive

### Question: How does 'Variables.userData.firstName' become a Signal?

#### Step 1: Page Initialization

```typescript
// In BasePageComponent.init()
init() {
    muteWatchers();

    // ... existing initialization ...

    // NEW: Wrap Variables with Signal proxy
    if (isSignalMigrationEnabled()) {
        this.Variables = wrapVariablesWithSignals(this.Variables);
        this.Widgets = wrapWidgetsWithSignals(this.Widgets);
    }

    this.registerExpressions();
    this.registerWidgets();
    this.initVariables();

    // ... rest of initialization ...
}
```

#### Step 2: Variable Creation

```typescript
// When Variables.userData is created by VariablesService
const userData = {
    firstName: 'John',
    lastName: 'Doe',
    dataSet: []
};

// WITHOUT Signals (current)
Variables.userData = userData;
// Variables.userData.firstName => 'John' (plain value)

// WITH Signals (after migration)
Variables.userData = signalProxy.wrap(userData);
// Variables.userData.firstName => Signal value
// Internally: firstNameSignal() is called
```

#### Step 3: Bind Expression Evaluation

```html
<div name.bind="Variables.userData.firstName"></div>
```

```typescript
// processBindAttr is called with expr = 'Variables.userData.firstName'

// Signal compiler creates computed:
const nameComputed = computed(() => {
    // This reads: Variables.userData.firstName
    // Because Variables is a Signal proxy:
    //   1. Variables.userData returns a proxy
    //   2. .firstName triggers the proxy getter
    //   3. Getter returns firstNameSignal()
    //   4. computed() tracks this Signal as a dependency
    return $parseExpr('Variables.userData.firstName')(viewParent, context);
});

// Effect updates widget property:
effect(() => {
    const value = nameComputed();  // Subscribes to nameComputed
    widget.name = value;           // Updates widget property
});
```

#### Step 4: Variable Update

```typescript
// User code updates variable (in page script or action)
Variables.userData.firstName = 'Jane';

// What happens:
// 1. Proxy intercepts the set operation
// 2. Updates the Signal: firstNameSignal.set('Jane')
// 3. Angular detects Signal change
// 4. All computed() that depend on firstNameSignal re-evaluate
// 5. All effect() that depend on those computed() re-run
// 6. widget.name is updated automatically
// 7. Angular change detection runs (once)

// OLD WAY (watchers):
// 1. Variable updated directly
// 2. Wait for next $invokeWatchers() call
// 3. Execute ALL watchers (1000+)
// 4. Deep equality check for each
// 5. Update changed widgets
// 6. Angular change detection runs
```

### Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  User Code: Variables.userData.firstName = 'Jane'            │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Signal Proxy: intercepts set operation                       │
│  ├─ firstNameSignal.set('Jane')                              │
│  └─ Update backing object (backward compat)                  │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Angular Signal System: Propagates change                     │
│  ├─ Computed signals that read firstName re-evaluate         │
│  └─ Effects that depend on computed signals re-run           │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Effect: widget.name = computedValue                          │
│  └─ Updates widget property directly                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Angular Change Detection: Runs once                          │
│  └─ Updates DOM if needed                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Why No Feature Flags?

You correctly pointed out that feature flags are unnecessary. Here's why:

### 1. Transparent Implementation

```typescript
// The migration is internal - developers don't need to know
processBindAttr(propName, expr) {
    // Always works the same way from outside
    // Implementation detail changes from watcher to Signal
}
```

### 2. Automatic Fallback

```typescript
// If Signal system not initialized, use watchers
if (this.signalCompiler) {
    // Use Signals
} else {
    // Use watchers (existing code)
}
```

### 3. Selective Migration

```typescript
// Only bind: expressions migrate
processAttr(attrName: string, attrValue: string) {
    const {0: propName, 1: type} = attrName.split('.');

    if (type === 'bind') {
        // MIGRATES TO SIGNALS
        this.processBindAttr(propName, attrValue);
    } else if (type === 'event') {
        // STAYS WITH WATCHERS
        this.processEventAttr(propName, attrValue);
    }
}
```

### 4. Gradual Rollout via Module Inclusion

```typescript
// Phase 1: Don't include Signal module → Everything uses watchers
// Phase 2: Include Signal module → Bind expressions use Signals
// Phase 3: Remove watcher code for bind expressions

// projects/runtime-base/src/runtime-base.module.ts
@NgModule({
    providers: [
        // Add when ready
        SignalProxyService,
        SignalExpressionCompiler
    ]
})
export class RuntimeBaseModule {}
```

---

## What Stays with Watchers

### 1. Event Expressions

```html
<button click.event="Variables.userData.invoke()"></button>
```

**Reason**: Events are one-time invocations, not continuous bindings. No performance benefit from Signals.

### 2. Manual Watches

```typescript
// In widget or page logic
$watch('Variables.userData.dataSet', scope, locals, () => {
    // Custom logic
}, 'custom-watch-id');
```

**Reason**: Explicit $watch() calls for custom logic should continue working.

### 3. Conditional Watches in Widget Code

```typescript
// Inside widget implementation
if (this.someCondition) {
    $watch('expression', ...);
}
```

**Reason**: Complex widget-specific logic may rely on watcher API.

---

## Phased Implementation

### Phase 1: Foundation (Weeks 1-2)

#### Deliverables
- [ ] `SignalProxy` class with property interception
- [ ] `SignalExpressionCompiler` service
- [ ] Unit tests for Signal proxy
- [ ] Unit tests for expression compiler

#### Acceptance Criteria
- Signal proxy correctly intercepts get/set
- Nested properties work
- Backward compatibility maintained (can read/write normally)

### Phase 2: Integration (Weeks 3-4)

#### Deliverables
- [ ] Modify `BasePageComponent.init()` to wrap Variables
- [ ] Modify `processBindAttr()` to use Signal compiler
- [ ] Add fallback to watchers if Signal system not available
- [ ] Integration tests

#### Acceptance Criteria
- Existing tests pass
- New Signal-based bindings work identically to watchers
- No breaking changes

### Phase 3: Validation (Weeks 5-6)

#### Deliverables
- [ ] Performance benchmarks (Signal vs Watcher)
- [ ] Test with real application (1000+ bindings)
- [ ] Memory profiling
- [ ] Bug fixes

#### Acceptance Criteria
- 50%+ reduction in change detection time
- No memory leaks
- No regressions

### Phase 4: Rollout (Weeks 7-8)

#### Deliverables
- [ ] Enable Signal system in build
- [ ] Monitor production applications
- [ ] Documentation updates
- [ ] Deprecate watcher code for bind expressions

#### Acceptance Criteria
- Production applications running smoothly
- Performance improvements confirmed
- No rollbacks needed

---

## Performance Expectations

### Before (Watchers)

```
1000 bind expressions × every change detection cycle
= 1000 expression evaluations
= 1000 _.isEqual() comparisons
= 50-100ms per cycle
```

### After (Signals)

```
Property change updates 1 Signal
→ Only dependent computed() re-evaluate (maybe 5-10)
→ Only dependent effect() re-run (maybe 5-10)
= 2-5ms per cycle

**90-95% reduction in evaluation time**
```

### Measurement

```typescript
// Add performance monitoring
export class SignalPerformanceMonitor {
    measureChangeDetection() {
        const start = performance.now();
        // Trigger change
        Variables.userData.firstName = 'Jane';
        const end = performance.now();

        return {
            duration: end - start,
            signalsUpdated: this.getSignalUpdateCount(),
            effectsRun: this.getEffectRunCount()
        };
    }
}
```

---

## Risks & Mitigations

### Risk 1: Proxy Performance Overhead

**Risk**: Proxy interception may be slower than direct property access

**Mitigation**:
- Benchmark proxy vs direct access
- Consider caching Signal references
- Optimize hot paths

### Risk 2: Complex Expression Handling

**Risk**: Some expressions may not work with Signal proxies

**Mitigation**:
- Comprehensive test suite
- Fallback to watchers for edge cases
- Gradual migration (page by page if needed)

### Risk 3: Memory Leaks from Effects

**Risk**: Effects not cleaned up properly

**Mitigation**:
- Unified cleanup in `registerDestroyListener`
- Memory profiling in tests
- Effect lifecycle tracking

### Risk 4: Backward Compatibility

**Risk**: Existing code breaks due to proxy behavior

**Mitigation**:
- Proxy maintains object semantics
- Backing object still updated (dual write)
- Extensive regression testing

---

## Summary

**What Changes:**
- Internal implementation of `processBindAttr()`
- Variables/Widgets wrapped with Signal proxies
- Bind expressions use computed Signals instead of watchers

**What Stays the Same:**
- Template syntax (`.bind` attributes)
- API signatures
- Event expressions (`.event` attributes)
- Manual `$watch()` calls
- Developer-facing APIs

**Performance Gains:**
- 90-95% reduction in change detection time for bind expressions
- Eliminates polling overhead
- Scales better with large datasets

**Developer Impact:**
- Zero API changes
- No migration required for existing code
- Automatic performance improvement

---

## Next Steps

1. **Review Plan**: Team review and approval
2. **Prototype**: Build SignalProxy and basic compiler
3. **Benchmark**: Measure overhead and performance gain
4. **Iterate**: Refine based on results
5. **Roll Out**: Gradual deployment to production

---

## Appendix: Code Examples

### Example: Simple Bind Expression

**Template:**
```html
<label caption.bind="Variables.userData.firstName"></label>
```

**Current (Watcher):**
```typescript
// Creates watcher
$watch('Variables.userData.firstName', scope, locals,
    nv => widget.caption = nv,
    'widget-123-caption'
);

// On every change detection:
const nv = Variables.userData.firstName;  // Reads plain value
if (!_.isEqual(nv, lastValue)) {
    widget.caption = nv;
}
```

**New (Signal):**
```typescript
// Creates computed Signal
const captionSignal = computed(() => {
    return Variables.userData.firstName;  // Reads from Signal
});

// Creates effect (runs automatically when Signal changes)
effect(() => {
    widget.caption = captionSignal();
});

// On property change:
Variables.userData.firstName = 'Jane';
// → Signal updates → computed re-evaluates → effect runs → widget updates
```

### Example: Complex Expression with Array

**Template:**
```html
<label caption.bind="Variables.userData.dataSet[$i].name + ' - ' + Widgets.form1.status"></label>
```

**Dependencies Extracted:**
- `Variables.userData.dataSet`
- `Widgets.form1.status`

**Signal Creation:**
```typescript
const captionSignal = computed(() => {
    const dataSet = Variables.userData.dataSet;  // Reads dataSet Signal
    const status = Widgets.form1.status;         // Reads status Signal
    const item = dataSet[context.$i];
    return item ? `${item.name} - ${status}` : '';
});

effect(() => {
    widget.caption = captionSignal();
});
```

**Performance:**
- Watcher: Executes on EVERY change detection (even if dataSet/status unchanged)
- Signal: Only executes when dataSet or status actually changes
