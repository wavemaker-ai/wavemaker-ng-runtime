# Signal Proxy Implementation Guide

## Overview

This document provides detailed implementation guidance for the `SignalProxy` - the core component that makes WaveMaker Variables reactive while maintaining backward compatibility.

---

## The Challenge

WaveMaker Variables are plain JavaScript objects that need to become reactive:

```typescript
// Current: Plain object
Variables.userData = {
    firstName: 'John',
    lastName: 'Doe',
    address: {
        city: 'San Francisco',
        zip: '94103'
    },
    dataSet: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
    ]
};

// Problem: Changes don't trigger updates
Variables.userData.firstName = 'Jane';  // No one knows this happened!
```

**Requirements:**
1. **Transparent Reactivity**: Property access must return Signal values
2. **Backward Compatibility**: Existing code must continue working
3. **Nested Object Support**: Deep property paths must work
4. **Array Support**: Array operations must trigger updates
5. **Performance**: Minimal overhead for property access

---

## Solution: JavaScript Proxy + Signals

### Core Concept

Use JavaScript `Proxy` to intercept property access and return/update Signals:

```typescript
Variables.userData = new Proxy(originalObject, {
    get(target, prop) {
        // Return Signal value
        return getSignal(prop)();
    },
    set(target, prop, value) {
        // Update Signal
        getSignal(prop).set(value);
        return true;
    }
});
```

---

## Implementation

### SignalProxy Class

```typescript
// projects/core/src/signals/signal-proxy.ts

import { signal, WritableSignal, Signal, computed } from '@angular/core';

export interface SignalProxyOptions {
    /**
     * Whether to wrap nested objects recursively
     * Default: true
     */
    deep?: boolean;

    /**
     * Whether to make arrays reactive
     * Default: true
     */
    arrays?: boolean;

    /**
     * Path prefix for this proxy (used for nested objects)
     */
    pathPrefix?: string;
}

/**
 * Creates a reactive proxy around an object using Angular Signals
 */
export class SignalProxy<T extends object> {
    private signals = new Map<string, WritableSignal<any>>();
    private nestedProxies = new Map<string, SignalProxy<any>>();
    private proxy: T;
    private options: Required<SignalProxyOptions>;

    constructor(
        private target: T,
        options: SignalProxyOptions = {}
    ) {
        this.options = {
            deep: options.deep ?? true,
            arrays: options.arrays ?? true,
            pathPrefix: options.pathPrefix ?? ''
        };

        this.proxy = this.createProxy(target);
    }

    /**
     * Create the Proxy wrapper
     */
    private createProxy(obj: T): T {
        return new Proxy(obj, {
            get: (target, prop: string | symbol) => {
                // Handle symbols (like Symbol.iterator)
                if (typeof prop === 'symbol') {
                    return Reflect.get(target, prop);
                }

                // Handle special properties
                if (prop === '__isProxy') return true;
                if (prop === '__getSignal') return this.getSignal.bind(this);
                if (prop === '__target') return target;

                return this.handleGet(target, prop);
            },

            set: (target, prop: string | symbol, value) => {
                if (typeof prop === 'symbol') {
                    return Reflect.set(target, prop, value);
                }

                return this.handleSet(target, prop, value);
            },

            // Support Object.keys(), Object.entries(), etc.
            ownKeys: (target) => {
                return Reflect.ownKeys(target);
            },

            getOwnPropertyDescriptor: (target, prop) => {
                return Reflect.getOwnPropertyDescriptor(target, prop);
            }
        });
    }

    /**
     * Handle property read
     */
    private handleGet(target: any, prop: string): any {
        const fullPath = this.getFullPath(prop);
        const value = target[prop];

        // Check if we have a Signal for this property
        if (this.signals.has(fullPath)) {
            return this.signals.get(fullPath)!();
        }

        // If value is null or undefined, create a Signal for it
        if (value === null || value === undefined) {
            const sig = signal(value);
            this.signals.set(fullPath, sig);
            return value;
        }

        // If value is an array and arrays are enabled
        if (this.options.arrays && Array.isArray(value)) {
            return this.createArrayProxy(value, fullPath);
        }

        // If value is an object and deep proxying is enabled
        if (this.options.deep && typeof value === 'object') {
            return this.createNestedProxy(value, fullPath);
        }

        // Primitive value - create Signal
        const sig = signal(value);
        this.signals.set(fullPath, sig);
        return value;
    }

    /**
     * Handle property write
     */
    private handleSet(target: any, prop: string, value: any): boolean {
        const fullPath = this.getFullPath(prop);

        // Update or create Signal
        if (this.signals.has(fullPath)) {
            this.signals.get(fullPath)!.set(value);
        } else {
            const sig = signal(value);
            this.signals.set(fullPath, sig);
        }

        // Update target object (backward compatibility)
        target[prop] = value;

        // Clear nested proxy if property is replaced
        if (this.nestedProxies.has(fullPath)) {
            this.nestedProxies.delete(fullPath);
        }

        return true;
    }

    /**
     * Create nested proxy for object properties
     */
    private createNestedProxy(value: any, path: string): any {
        // Check cache
        if (this.nestedProxies.has(path)) {
            return this.nestedProxies.get(path)!.getProxy();
        }

        // Create new nested proxy
        const nestedProxy = new SignalProxy(value, {
            ...this.options,
            pathPrefix: path
        });

        this.nestedProxies.set(path, nestedProxy);
        return nestedProxy.getProxy();
    }

    /**
     * Create reactive array proxy
     */
    private createArrayProxy(arr: any[], path: string): any[] {
        // Create Signal for the array
        if (!this.signals.has(path)) {
            const sig = signal(arr);
            this.signals.set(path, sig);
        }

        return new Proxy(arr, {
            get: (target, prop: string | symbol) => {
                // Handle array methods that mutate
                if (prop === 'push' || prop === 'pop' || prop === 'shift' ||
                    prop === 'unshift' || prop === 'splice' || prop === 'sort' ||
                    prop === 'reverse') {
                    return (...args: any[]) => {
                        const result = (target[prop as any] as Function).apply(target, args);
                        // Update Signal with new array reference
                        this.signals.get(path)!.set([...target]);
                        return result;
                    };
                }

                return Reflect.get(target, prop);
            },

            set: (target, prop: string | symbol, value) => {
                const result = Reflect.set(target, prop, value);
                // Update Signal when array element changes
                this.signals.get(path)!.set([...target]);
                return result;
            }
        });
    }

    /**
     * Get full property path
     */
    private getFullPath(prop: string): string {
        return this.options.pathPrefix
            ? `${this.options.pathPrefix}.${prop}`
            : prop;
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
        const value = this.getValueByPath(path);
        const sig = signal(value);
        this.signals.set(path, sig);
        return sig;
    }

    /**
     * Get value by dot-separated path
     */
    private getValueByPath(path: string): any {
        const keys = path.split('.');
        let value: any = this.target;

        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
        }

        return value;
    }

    /**
     * Get the proxied object
     */
    getProxy(): T {
        return this.proxy;
    }

    /**
     * Get all registered Signals (for debugging)
     */
    getAllSignals(): Map<string, WritableSignal<any>> {
        return new Map(this.signals);
    }

    /**
     * Cleanup all Signals
     */
    destroy(): void {
        this.signals.clear();
        this.nestedProxies.forEach(proxy => proxy.destroy());
        this.nestedProxies.clear();
    }
}
```

---

## Usage Examples

### Example 1: Simple Properties

```typescript
const userData = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30
};

const proxy = new SignalProxy(userData);
const Variables = { userData: proxy.getProxy() };

// Reading (returns Signal value)
console.log(Variables.userData.firstName);  // 'John'

// Writing (updates Signal)
Variables.userData.firstName = 'Jane';

// In a computed Signal
const fullName = computed(() => {
    return `${Variables.userData.firstName} ${Variables.userData.lastName}`;
});

// In an effect
effect(() => {
    console.log('Name changed:', fullName());
});
```

### Example 2: Nested Objects

```typescript
const userData = {
    firstName: 'John',
    address: {
        city: 'San Francisco',
        zip: '94103'
    }
};

const proxy = new SignalProxy(userData);
const Variables = { userData: proxy.getProxy() };

// Nested property access
console.log(Variables.userData.address.city);  // 'San Francisco'

// Update nested property
Variables.userData.address.city = 'New York';

// In computed
const location = computed(() => {
    return `${Variables.userData.address.city}, ${Variables.userData.address.zip}`;
});
```

### Example 3: Arrays

```typescript
const userData = {
    items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
    ]
};

const proxy = new SignalProxy(userData);
const Variables = { userData: proxy.getProxy() };

// Array access
console.log(Variables.userData.items[0].name);  // 'Item 1'

// Array mutation triggers Signal update
Variables.userData.items.push({ id: 3, name: 'Item 3' });

// In computed
const itemCount = computed(() => {
    return Variables.userData.items.length;
});

// Effect runs when array changes
effect(() => {
    console.log('Items changed:', itemCount());
});
```

### Example 4: Integration with Page

```typescript
// In BasePageComponent.init()
init() {
    muteWatchers();

    // ... existing initialization ...

    // Wrap Variables with Signal proxy
    const variablesProxy = new SignalProxy(this.Variables);
    this.Variables = variablesProxy.getProxy();

    // Wrap Widgets with Signal proxy
    const widgetsProxy = new SignalProxy(this.Widgets);
    this.Widgets = widgetsProxy.getProxy();

    // Store proxies for cleanup
    this.registerDestroyListener(() => {
        variablesProxy.destroy();
        widgetsProxy.destroy();
    });

    this.registerExpressions();
    this.registerWidgets();
    this.initVariables();

    // ... rest of initialization ...
}
```

---

## Performance Considerations

### 1. Signal Creation Overhead

**Problem**: Creating a Signal for every property access could be expensive

**Solution**: Lazy Signal creation - only create when accessed

```typescript
// Only creates Signal when property is first accessed
private handleGet(target: any, prop: string): any {
    if (this.signals.has(fullPath)) {
        return this.signals.get(fullPath)!();  // Reuse existing
    }

    // Create on first access
    const sig = signal(value);
    this.signals.set(fullPath, sig);
    return value;
}
```

### 2. Proxy Performance

**Benchmark**: Proxy vs Direct Access

```typescript
// Direct access
const start1 = performance.now();
for (let i = 0; i < 100000; i++) {
    const value = obj.firstName;
}
const end1 = performance.now();
console.log('Direct:', end1 - start1);  // ~2ms

// Proxy access
const start2 = performance.now();
for (let i = 0; i < 100000; i++) {
    const value = proxy.firstName;
}
const end2 = performance.now();
console.log('Proxy:', end2 - start2);  // ~3-4ms

// Overhead: ~50% slower, but still negligible (microseconds per access)
```

### 3. Memory Usage

**Concern**: Storing Signals for all properties

**Mitigation**:
- Only create Signals for accessed properties (lazy)
- Share Signals across multiple bindings to same property
- Cleanup Signals when components destroy

---

## Testing Strategy

### Unit Tests

```typescript
describe('SignalProxy', () => {
    let proxy: SignalProxy<any>;
    let target: any;

    beforeEach(() => {
        target = {
            firstName: 'John',
            lastName: 'Doe',
            address: {
                city: 'SF'
            },
            items: [1, 2, 3]
        };
        proxy = new SignalProxy(target);
    });

    it('should read property values', () => {
        const obj = proxy.getProxy();
        expect(obj.firstName).toBe('John');
    });

    it('should update property values', () => {
        const obj = proxy.getProxy();
        obj.firstName = 'Jane';
        expect(obj.firstName).toBe('Jane');
    });

    it('should create Signals for properties', () => {
        const obj = proxy.getProxy();
        const _ = obj.firstName;  // Access to create Signal

        const signal = proxy.getSignal('firstName');
        expect(signal).toBeDefined();
        expect(signal!()).toBe('John');
    });

    it('should support nested objects', () => {
        const obj = proxy.getProxy();
        expect(obj.address.city).toBe('SF');

        obj.address.city = 'NYC';
        expect(obj.address.city).toBe('NYC');
    });

    it('should support arrays', () => {
        const obj = proxy.getProxy();
        expect(obj.items.length).toBe(3);

        obj.items.push(4);
        expect(obj.items.length).toBe(4);
    });

    it('should trigger computed when property changes', () => {
        TestBed.runInInjectionContext(() => {
            const obj = proxy.getProxy();
            let computedRuns = 0;

            const fullName = computed(() => {
                computedRuns++;
                return `${obj.firstName} ${obj.lastName}`;
            });

            expect(fullName()).toBe('John Doe');
            expect(computedRuns).toBe(1);

            obj.firstName = 'Jane';
            expect(fullName()).toBe('Jane Doe');
            expect(computedRuns).toBe(2);
        });
    });

    it('should trigger effect when property changes', () => {
        TestBed.runInInjectionContext(() => {
            const obj = proxy.getProxy();
            let effectRuns = 0;
            let lastValue: string;

            effect(() => {
                effectRuns++;
                lastValue = obj.firstName;
            });

            expect(effectRuns).toBe(1);
            expect(lastValue!).toBe('John');

            obj.firstName = 'Jane';

            // Wait for effect to run
            TestBed.flushEffects();

            expect(effectRuns).toBe(2);
            expect(lastValue!).toBe('Jane');
        });
    });
});
```

---

## Advanced Topics

### Handling Special Cases

#### 1. Circular References

```typescript
// Problem: obj.parent points to parent object
const parent = { name: 'Parent' };
const child = { name: 'Child', parent };
parent.children = [child];

// Solution: Detect and handle circular references
private createNestedProxy(value: any, path: string): any {
    // Check if value already has a proxy
    if (value.__isProxy) {
        return value;
    }

    // Check if we're creating circular reference
    if (this.isCircular(value, path)) {
        return value;  // Return original
    }

    // Create proxy
    const nestedProxy = new SignalProxy(value, {
        pathPrefix: path
    });

    return nestedProxy.getProxy();
}
```

#### 2. Function Properties

```typescript
const obj = {
    name: 'John',
    greet() {
        return `Hello, ${this.name}`;
    }
};

// Solution: Preserve function context
private handleGet(target: any, prop: string): any {
    const value = target[prop];

    if (typeof value === 'function') {
        // Return bound function
        return value.bind(target);
    }

    // ... rest of logic
}
```

#### 3. Getters and Setters

```typescript
const obj = {
    _firstName: 'John',
    get firstName() {
        return this._firstName;
    },
    set firstName(value) {
        this._firstName = value;
    }
};

// Solution: Use property descriptors
private handleGet(target: any, prop: string): any {
    const descriptor = Object.getOwnPropertyDescriptor(target, prop);

    if (descriptor?.get) {
        // Call getter with correct context
        return descriptor.get.call(this.proxy);
    }

    // ... rest of logic
}
```

---

## Troubleshooting

### Issue: Signals not updating

**Symptom**: Property changes don't trigger effects

**Cause**: Property set without going through proxy

```typescript
// Wrong: Bypasses proxy
const target = proxy.__target;
target.firstName = 'Jane';  // Signal NOT updated

// Correct: Goes through proxy
const obj = proxy.getProxy();
obj.firstName = 'Jane';  // Signal updated
```

### Issue: Computed not re-evaluating

**Symptom**: Computed Signal returns stale value

**Cause**: Property read doesn't go through proxy

```typescript
// Wrong: Reads from original object
const computed = computed(() => {
    return target.firstName;  // Not reactive!
});

// Correct: Reads from proxy
const computed = computed(() => {
    return obj.firstName;  // Reactive!
});
```

### Issue: Memory leak

**Symptom**: Signals accumulate over time

**Cause**: Proxies not destroyed on component cleanup

```typescript
// Fix: Destroy proxies on component destroy
ngOnDestroy() {
    this.variablesProxy.destroy();
    this.widgetsProxy.destroy();
}
```

---

## Summary

The `SignalProxy` is the foundation of the Signals migration:
- Intercepts property access to provide Signal values
- Maintains backward compatibility with plain object semantics
- Supports nested objects and arrays
- Minimal performance overhead
- Transparent to existing code

Next: See `SIGNAL_EXPRESSION_COMPILER.md` for how expressions are compiled to use these Signals.
