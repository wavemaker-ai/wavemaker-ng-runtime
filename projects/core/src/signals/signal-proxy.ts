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
        console.log('SignalProxy: Creating proxy for', obj);
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
            console.log('SignalProxy: Get', prop, value);
            return this.signals.get(fullPath)!();
        }

        // If value is null or undefined, create a Signal for it
        if (value === null || value === undefined) {
            const sig = signal(value);
            this.signals.set(fullPath, sig);
            console.log('SignalProxy: Get', prop, value);
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
        console.log('SignalProxy: Get', prop, value);
        return sig();
    }

    /**
     * Handle property write
     */
    private handleSet(target: any, prop: string, value: any): boolean {
        const fullPath = this.getFullPath(prop);

        // Update or create Signal
        if (this.signals.has(fullPath)) {
            this.signals.get(fullPath)!.set(value);
            console.log('SignalProxy: Set', fullPath, value);
        } else {
            const sig = signal(value);
            this.signals.set(fullPath, sig);
            console.log('SignalProxy: Create & Set', fullPath, value);
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
        console.log('SignalProxy: Nested proxy created', path, nestedProxy);
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
            sig();
        }

        return new Proxy(arr, {
            get: (target, prop: string | symbol) => {
                console.log('SignalProxy: Array get', prop);
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
                console.log('SignalProxy: Array set', prop, value);
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
