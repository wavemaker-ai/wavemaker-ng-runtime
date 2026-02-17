import {
    Injectable,
    computed,
    effect,
    Signal,
    EffectRef,
    Injector,
    runInInjectionContext
} from '@angular/core';
import { $parseExpr } from '../utils/expression-parser';

export interface SignalBinding {
    /** Unique identifier for this binding */
    identifier: string;

    /** Expression string */
    expr: string;

    /** Computed Signal that evaluates the expression */
    signal: Signal<any>;

    /** Effect that updates widget property */
    effectRef: EffectRef;

    /** Extracted dependencies (for debugging) */
    dependencies?: string[];

    /** Context used for evaluation */
    context: any;

    /** Locals used for evaluation */
    locals: any;
}

@Injectable({
    providedIn: 'root'
})
export class SignalExpressionCompiler {
    private bindings = new Map<string, SignalBinding>();
    private bindingsByExpr = new Map<string, Set<string>>();

    constructor(private injector: Injector) {}

    /**
     * Create a Signal-based binding for a bind expression
     *
     * This is the main entry point that replaces $watch() for bind expressions
     *
     * @param identifier Unique ID for this binding (e.g., 'widget-123-name')
     * @param expr Expression string (e.g., 'Variables.userData.firstName')
     * @param context Evaluation context (usually viewParent/page)
     * @param locals Local variables (e.g., $i for array iteration)
     * @param listener Callback to update widget property
     * @returns Cleanup function (compatible with $watch return type)
     */
    createBinding(
        identifier: string,
        expr: string,
        context: any,
        locals: any,
        listener: (value: any) => void
    ): () => void {
        // Remove existing binding if present
        if (this.bindings.has(identifier)) {
            this.removeBinding(identifier);
        }

        // Create the binding within injection context
        return runInInjectionContext(this.injector, () => {
            // Step 1: Get compiled expression function
            const exprFn = $parseExpr(expr);

            // Step 2: Create computed Signal
            // Angular's computed() will automatically track Signal dependencies
            const computedSignal = computed(() => {
                try {
                    // Evaluate expression
                    // When this reads from Signal proxies, Angular tracks dependencies
                    return exprFn(context, locals);
                } catch (error) {
                    console.warn(`Error evaluating expression "${expr}":`, error);
                    return undefined;
                }
            });

            // Step 3: Create effect to update widget property
            const effectRef = effect(() => {
                try {
                    const value = computedSignal();
                    console.log('Run Effect: ',expr,  value);
                    listener(value);
                } catch (error) {
                    console.error(`Error in effect for expression "${expr}":`, error);
                }
            });

            // Step 4: Store binding
            const binding: SignalBinding = {
                identifier,
                expr,
                signal: computedSignal,
                effectRef,
                context,
                locals
            };

            this.bindings.set(identifier, binding);

            // Track bindings by expression (for debugging)
            if (!this.bindingsByExpr.has(expr)) {
                this.bindingsByExpr.set(expr, new Set());
            }
            this.bindingsByExpr.get(expr)!.add(identifier);

            console.log(`Created Signal Binding: ${identifier} => ${expr}`, this.bindings);

            // Step 5: Return cleanup function (compatible with $watch API)
            return () => this.removeBinding(identifier);
        });
    }

    /**
     * Remove a binding and cleanup resources
     */
    removeBinding(identifier: string): void {
        const binding = this.bindings.get(identifier);
        if (!binding) return;

        // Destroy effect
        binding.effectRef.destroy();

        // Remove from tracking
        this.bindings.delete(identifier);

        const exprBindings = this.bindingsByExpr.get(binding.expr);
        if (exprBindings) {
            exprBindings.delete(identifier);
            if (exprBindings.size === 0) {
                this.bindingsByExpr.delete(binding.expr);
            }
        }
    }

    /**
     * Get binding by identifier (for debugging)
     */
    getBinding(identifier: string): SignalBinding | undefined {
        return this.bindings.get(identifier);
    }

    /**
     * Get all bindings for an expression (for debugging)
     */
    getBindingsForExpression(expr: string): SignalBinding[] {
        const identifiers = this.bindingsByExpr.get(expr);
        if (!identifiers) return [];

        return Array.from(identifiers)
            .map(id => this.bindings.get(id))
            .filter(b => b !== undefined) as SignalBinding[];
    }

    /**
     * Get metrics about Signal bindings
     */
    getMetrics(): {
        totalBindings: number;
        uniqueExpressions: number;
        bindings: Map<string, SignalBinding>;
    } {
        return {
            totalBindings: this.bindings.size,
            uniqueExpressions: this.bindingsByExpr.size,
            bindings: new Map(this.bindings)
        };
    }

    /**
     * Clear all bindings (for testing)
     */
    clear(): void {
        this.bindings.forEach(binding => binding.effectRef.destroy());
        this.bindings.clear();
        this.bindingsByExpr.clear();
    }
}
