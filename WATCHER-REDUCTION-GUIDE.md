# Effective Watcher Count Reduction Guide

**Current State:** 22,850 watchers for 6 tables with 648 rows  
**Target:** Reduce to < 15,000 watchers (30-40% reduction)

---

## 🔍 Where Watchers Come From

### 1. **Table Component Watchers** (Main Source)

For **each row** in the table:
- **Row ng-class watcher:** 1 watcher per row (if `rowngclass` is set)
  - 648 rows × 1 = **648 watchers**
- **Column ng-class watchers:** N watchers per row (if `col-ng-class` is set per column)
  - 648 rows × 8 columns = **5,184 watchers** (if all columns have col-ng-class)
- **Title watchers:** 1-2 watchers per row (if expandable/collapsible)
  - 648 rows × 2 = **1,296 watchers**

**Total from tables alone: ~7,000+ watchers**

### 2. **Base Component Property Bindings**

For **each widget** (including nested widgets in table cells):
- Each bound property creates 1 watcher via `processBindAttr()`
- Common properties: `datasource`, `class`, `style`, `visible`, `enabled`, etc.
- With 648 rows × multiple widgets per row = **thousands of watchers**

### 3. **Custom Expressions**

- Each custom expression in table cells may create embedded views
- Each embedded view may contain widgets with property bindings
- **Estimated: 5,000-10,000 watchers**

---

## 🎯 Strategy 1: Lazy Watcher Registration (HIGHEST IMPACT)

**Only register watchers for visible rows.**

### Implementation in `table.component.ts`:

```typescript
// Add visibility tracking
private visibleRowRange = { start: 0, end: 50 }; // Only first 50 rows visible
private rowVisibilityMap = new Map<number, boolean>(); // Track which rows are visible

// Modify registerRowNgClassWatcher
registerRowNgClassWatcher: (rowData, index) => {
    if (!this.rowngclass) {
        return;
    }
    
    // ✅ LAZY REGISTRATION: Only register if row is visible
    if (!this.isRowVisible(index)) {
        // Store row data for later registration when row becomes visible
        this.pendingWatcherRows.set(index, rowData);
        return;
    }
    
    const row = this.getClonedRowObject(rowData);
    const watchName = `${this.widgetId}_rowNgClass_${index}`;
    
    const oldCleanup = this.rowWatcherCleanups.get(watchName);
    if (oldCleanup) {
        oldCleanup();
        this.rowWatcherKeyIndex.delete(index);
    }
    
    const cleanup = $watch(this.rowngclass, this.viewParent, {row}, (nv, ov) => {
        this.callDataGridMethod('applyRowNgClass', getConditionalClasses(nv, ov), index);
    }, watchName);
    
    this.rowWatcherCleanups.set(watchName, cleanup);
    this.rowWatcherKeyIndex.set(index, watchName);
},

// Add method to check row visibility
private isRowVisible(rowIndex: number): boolean {
    return rowIndex >= this.visibleRowRange.start && 
           rowIndex <= this.visibleRowRange.end;
}

// Register watchers when row becomes visible (on scroll)
private registerWatchersForVisibleRows() {
    for (let i = this.visibleRowRange.start; i <= this.visibleRowRange.end; i++) {
        if (this.pendingWatcherRows.has(i)) {
            const rowData = this.pendingWatcherRows.get(i);
            this.gridOptions.registerRowNgClassWatcher(rowData, i);
            this.pendingWatcherRows.delete(i);
        }
    }
}

// Unregister watchers when row becomes invisible
private unregisterWatchersForInvisibleRows() {
    this.rowWatcherCleanups.forEach((cleanup, watchName) => {
        const rowIndex = this.getRowIndexFromWatchName(watchName);
        if (rowIndex !== -1 && !this.isRowVisible(rowIndex)) {
            cleanup(); // Unregister watcher
            this.rowWatcherCleanups.delete(watchName);
            this.rowWatcherKeyIndex.delete(rowIndex);
        }
    });
}
```

**Expected Reduction:** 60-70% of table watchers (4,200-4,900 watchers saved)

---

## 🎯 Strategy 2: Conditional Watcher Registration

**Only register watchers if the expression actually needs watching.**

### Implementation:

```typescript
// In processBindAttr - only register if expression is dynamic
protected processBindAttr(propName: string, expr: string, child?: any) {
    if (!child) {
        this.initState.delete(propName);
    }
    
    // ✅ CONDITIONAL REGISTRATION: Check if expression is static
    if (this.isStaticExpression(expr)) {
        // Evaluate once, don't watch
        const value = this.evaluateExpression(expr);
        const widget = child ? child.widget : this.widget;
        widget[propName] = value;
        return; // No watcher needed!
    }
    
    // ... existing watcher registration code
}

// Check if expression is static (no variables, no functions)
private isStaticExpression(expr: string): boolean {
    // Simple check: if expression doesn't contain common variable patterns
    const dynamicPatterns = [
        /\$[a-zA-Z]/,           // $scope variables
        /\[.*\]/,                // Array access
        /\./,                    // Object property access
        /\(.*\)/,                // Function calls
        /bind:/                  // Binding expressions
    ];
    
    return !dynamicPatterns.some(pattern => pattern.test(expr));
}
```

**Expected Reduction:** 10-15% of property binding watchers (1,000-2,000 watchers saved)

---

## 🎯 Strategy 3: Watcher Deduplication

**Share watchers for identical expressions.**

### Implementation:

```typescript
// In watcher.ts - add expression cache
const expressionWatcherCache = new Map<string, string>(); // expr -> watchId

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    // ✅ DEDUPLICATION: Check if identical expression already has a watcher
    const cacheKey = `${expr}_${$scope?.constructor?.name || 'global'}`;
    const existingWatchId = expressionWatcherCache.get(cacheKey);
    
    if (existingWatchId && registry.has(existingWatchId)) {
        // Reuse existing watcher, just add listener
        const existingWatch = registry.get(existingWatchId);
        const originalListener = existingWatch.listener;
        
        // Create combined listener
        existingWatch.listener = (nv, ov) => {
            originalListener?.(nv, ov);
            listener(nv, ov);
        };
        
        // Return cleanup that removes only this listener
        return () => {
            existingWatch.listener = originalListener;
            if (!existingWatch.listener) {
                // No more listeners, remove watcher
                expressionWatcherCache.delete(cacheKey);
                registry.delete(existingWatchId);
            }
        };
    }
    
    // ... existing watcher creation code
    expressionWatcherCache.set(cacheKey, identifier);
    // ...
};
```

**Expected Reduction:** 20-30% for repeated expressions (2,000-3,000 watchers saved)

---

## 🎯 Strategy 4: Virtual Scrolling Integration

**Virtual scrolling naturally reduces watcher count by limiting visible rows.**

### Implementation:

```typescript
// In table.component.ts - integrate with virtual scrolling
private virtualScrollEnabled = true;
private visibleRowBuffer = 10; // Render 10 extra rows above/below viewport

private updateVisibleRowRange() {
    if (!this.virtualScrollEnabled) {
        this.visibleRowRange = { start: 0, end: this.gridOptions.data.length };
        return;
    }
    
    const scrollTop = this.getScrollPosition();
    const viewportHeight = this.getViewportHeight();
    const rowHeight = 40; // Approximate row height
    
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - this.visibleRowBuffer);
    const end = Math.min(
        this.gridOptions.data.length - 1,
        Math.ceil((scrollTop + viewportHeight) / rowHeight) + this.visibleRowBuffer
    );
    
    const oldRange = { ...this.visibleRowRange };
    this.visibleRowRange = { start, end };
    
    // Unregister watchers for rows that are now invisible
    this.unregisterWatchersForInvisibleRows();
    
    // Register watchers for rows that are now visible
    this.registerWatchersForVisibleRows();
}

// Call on scroll
private onTableScroll = () => {
    this.updateVisibleRowRange();
    // ... existing scroll handling
};
```

**Expected Reduction:** 80-90% of table watchers (5,600-6,300 watchers saved)

---

## 🎯 Strategy 5: Batch Watcher Registration

**Register watchers in batches for non-critical updates.**

### Implementation:

```typescript
// In table.component.ts - batch watcher registration
private pendingWatcherRegistrations: Array<() => void> = [];
private watcherRegistrationScheduled = false;

private scheduleWatcherRegistration(registrationFn: () => void) {
    this.pendingWatcherRegistrations.push(registrationFn);
    
    if (!this.watcherRegistrationScheduled) {
        this.watcherRegistrationScheduled = true;
        requestIdleCallback(() => {
            // Register all pending watchers in batch
            this.pendingWatcherRegistrations.forEach(fn => fn());
            this.pendingWatcherRegistrations = [];
            this.watcherRegistrationScheduled = false;
        });
    }
}

// Use in registerRowNgClassWatcher
registerRowNgClassWatcher: (rowData, index) => {
    if (!this.rowngclass) {
        return;
    }
    
    // ✅ BATCH REGISTRATION: Schedule instead of immediate
    this.scheduleWatcherRegistration(() => {
        // ... existing registration code
    });
}
```

**Expected Reduction:** Reduces CPU spikes during initial load, doesn't reduce count but improves performance

---

## 🎯 Strategy 6: Aggressive Watcher Cleanup

**Ensure all watchers are cleaned up when rows are removed.**

### Implementation:

```typescript
// In table.component.ts - improve cleanup
private clearAllRowWatchers() {
    // ✅ AGGRESSIVE CLEANUP: Clear all row watchers
    this.rowWatcherCleanups.forEach((cleanup, watchName) => {
        cleanup();
    });
    this.rowWatcherCleanups.clear();
    this.rowWatcherKeyIndex.clear();
    this.rowColumnWatcherIndex.clear();
    this.rowTitleWatcherIndex.clear();
    this.pendingWatcherRows.clear();
}

// Call on data refresh
ngOnChanges(changes: SimpleChanges) {
    if (changes['datasource']) {
        // Clear all watchers before refreshing
        this.clearAllRowWatchers();
        // ... existing refresh code
    }
}
```

**Expected Reduction:** Prevents watcher accumulation, ensures count stays stable

---

## 🎯 Strategy 7: Expression Result Caching

**Cache expression results to avoid re-evaluation.**

### Implementation:

```typescript
// In watcher.ts - add result caching
const expressionResultCache = new Map<string, { value: any, timestamp: number }>();
const CACHE_TTL = 100; // 100ms cache

export const $watch = (expr, $scope, $locals, listener, identifier, doNotClone, config, isMuted) => {
    const fn = $parseExpr(expr);
    
    // ✅ CACHING: Check cache before evaluating
    const cacheKey = `${expr}_${JSON.stringify($scope)}`;
    const cached = expressionResultCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // Use cached value, don't create watcher if value hasn't changed
        listener(cached.value, cached.value);
        return () => {}; // No-op cleanup
    }
    
    // ... existing watcher creation
    // Update cache on value change
    const watchInfoObj = {
        fn: fn.bind(expr, $scope, $locals),
        listener: (nv, ov) => {
            expressionResultCache.set(cacheKey, { value: nv, timestamp: Date.now() });
            listener(nv, ov);
        },
        // ...
    };
};
```

**Expected Reduction:** 5-10% for frequently evaluated expressions

---

## 📊 Combined Impact Estimate

| Strategy | Watchers Saved | Implementation Effort |
|----------|----------------|----------------------|
| **1. Lazy Registration** | 4,200-4,900 | Medium |
| **2. Conditional Registration** | 1,000-2,000 | Low |
| **3. Watcher Deduplication** | 2,000-3,000 | Medium |
| **4. Virtual Scrolling** | 5,600-6,300 | High |
| **5. Batch Registration** | 0 (performance only) | Low |
| **6. Aggressive Cleanup** | Prevents growth | Low |
| **7. Expression Caching** | 500-1,000 | Medium |
| **TOTAL** | **13,300-17,200** | - |

**Target Reduction:** 22,850 → **5,650-9,550 watchers** (58-75% reduction)

---

## 🚀 Implementation Priority

### **Phase 1: Quick Wins (1-2 days)**
1. ✅ **Strategy 6: Aggressive Cleanup** - Prevents accumulation
2. ✅ **Strategy 2: Conditional Registration** - Easy to implement
3. ✅ **Strategy 5: Batch Registration** - Reduces CPU spikes

**Expected:** 1,000-2,000 watchers saved + performance improvement

### **Phase 2: High Impact (3-5 days)**
4. ✅ **Strategy 1: Lazy Registration** - Biggest impact
5. ✅ **Strategy 4: Virtual Scrolling** - Natural watcher reduction

**Expected:** 9,800-11,200 watchers saved

### **Phase 3: Optimization (2-3 days)**
6. ✅ **Strategy 3: Watcher Deduplication** - Further reduction
7. ✅ **Strategy 7: Expression Caching** - Performance boost

**Expected:** 2,500-4,000 additional watchers saved

---

## 💡 Code Example: Complete Lazy Registration

```typescript
// In table.component.ts

// Add properties
private visibleRowRange = { start: 0, end: 50 };
private pendingWatcherRows = new Map<number, any>();
private scrollHandler: () => void;

// Modify registerRowNgClassWatcher
registerRowNgClassWatcher: (rowData, index) => {
    if (!this.rowngclass) {
        return;
    }
    
    // ✅ Only register if visible
    if (!this.isRowVisible(index)) {
        this.pendingWatcherRows.set(index, rowData);
        return;
    }
    
    // ... existing registration code
},

// Add helper methods
private isRowVisible(rowIndex: number): boolean {
    return rowIndex >= this.visibleRowRange.start && 
           rowIndex <= this.visibleRowRange.end;
}

private registerWatchersForVisibleRows() {
    for (let i = this.visibleRowRange.start; i <= this.visibleRowRange.end; i++) {
        if (this.pendingWatcherRows.has(i)) {
            const rowData = this.pendingWatcherRows.get(i);
            this.gridOptions.registerRowNgClassWatcher(rowData, i);
            this.pendingWatcherRows.delete(i);
        }
    }
}

private unregisterWatchersForInvisibleRows() {
    this.rowWatcherCleanups.forEach((cleanup, watchName) => {
        const match = watchName.match(/_rowNgClass_(\d+)$/);
        if (match) {
            const rowIndex = parseInt(match[1], 10);
            if (!this.isRowVisible(rowIndex)) {
                cleanup();
                this.rowWatcherCleanups.delete(watchName);
                this.rowWatcherKeyIndex.delete(rowIndex);
            }
        }
    });
}

// Setup scroll handler
ngAfterViewInit() {
    // ... existing code
    
    // ✅ Setup scroll handler for lazy registration
    if (this._tableElement?.nativeElement) {
        const tableEl = this._tableElement.nativeElement;
        const tbody = tableEl.querySelector('tbody');
        
        if (tbody) {
            this.scrollHandler = () => {
                this.updateVisibleRowRange();
            };
            tbody.addEventListener('scroll', this.scrollHandler);
        }
    }
}

private updateVisibleRowRange() {
    const tbody = this._tableElement?.nativeElement?.querySelector('tbody');
    if (!tbody) return;
    
    const scrollTop = tbody.scrollTop;
    const viewportHeight = tbody.clientHeight;
    const rowHeight = 40; // Approximate
    
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
    const end = Math.min(
        this.gridOptions.data.length - 1,
        Math.ceil((scrollTop + viewportHeight) / rowHeight) + 10
    );
    
    const oldStart = this.visibleRowRange.start;
    const oldEnd = this.visibleRowRange.end;
    
    this.visibleRowRange = { start, end };
    
    // Only update if range changed significantly
    if (Math.abs(start - oldStart) > 5 || Math.abs(end - oldEnd) > 5) {
        this.unregisterWatchersForInvisibleRows();
        this.registerWatchersForVisibleRows();
    }
}

ngOnDestroy() {
    // ✅ Cleanup scroll handler
    if (this.scrollHandler && this._tableElement?.nativeElement) {
        const tbody = this._tableElement.nativeElement.querySelector('tbody');
        if (tbody) {
            tbody.removeEventListener('scroll', this.scrollHandler);
        }
    }
    
    // ... existing cleanup
}
```

---

## ✅ Verification

After implementing, verify:

- [ ] Watcher count reduced from 22,850 to < 15,000
- [ ] Watchers only registered for visible rows
- [ ] Watchers unregistered when rows become invisible
- [ ] No memory leaks (watcher count doesn't grow unbounded)
- [ ] Performance improved (faster initial load, smoother scrolling)
- [ ] Functionality preserved (all features still work)

---

## 📝 Notes

1. **Start with Strategy 6 (Cleanup)** - Prevents accumulation, easiest to implement
2. **Then Strategy 1 (Lazy Registration)** - Biggest impact, medium effort
3. **Add Strategy 4 (Virtual Scrolling)** - Natural reduction, requires UI changes
4. **Optimize with Strategies 2, 3, 7** - Further reductions

**Expected Timeline:** 1-2 weeks for full implementation  
**Expected Result:** 22,850 → 8,000-10,000 watchers (56-65% reduction)

