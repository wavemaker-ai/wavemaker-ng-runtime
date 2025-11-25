# Table Component & Datatable.js - Optimization & Fix Analysis

## 🔴 CRITICAL ISSUES - Memory Leaks & Bugs

### 1. **Untracked setTimeout in bootstrapGrid()**
**Location:** `table.component.ts:2044`

**Issue:**
- `setTimeout()` is used directly without tracking
- If component is destroyed before timeout fires, the callback will still execute
- Can cause "Cannot read property of destroyed component" errors

**Current Code:**
```typescript
setTimeout(() => {
    if (!this.isDestroyed) {
        this.bootstrapGrid();
    }
}, 100);
```

**Fix Required:**
```typescript
this.trackedSetTimeout(() => {
    if (!this.isDestroyed) {
        this.bootstrapGrid();
    }
}, 100);
```

---

### 2. **Missing pendingTimeouts Initialization in datatable.js**
**Location:** `datatable.js:3860`

**Issue:**
- Code checks `if (this.pendingTimeouts)` but `pendingTimeouts` is never initialized
- If `_destroy()` is called before any timeouts are tracked, this check will fail
- `refreshGridTimeout` is set directly without tracking

**Current Code:**
```javascript
window.clearTimeout(this.refreshGridTimeout);
if (this.pendingTimeouts) {
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts.clear();
}
```

**Fix Required:**
- Initialize `pendingTimeouts` in widget creation
- Track `refreshGridTimeout` in `pendingTimeouts` Set
- Ensure all timeouts are tracked

---

### 3. **Untracked setTimeout Calls in Table Component**
**Locations:** `table.component.ts:416, 693`

**Issue:**
- Lines 416 and 693 use `window.setTimeout` directly
- These timeouts are not tracked in `pendingTimeouts`
- Will not be cleaned up if component is destroyed

**Current Code (line 416):**
```typescript
const timeoutId = window.setTimeout(() => {
    this.pendingTimeouts.delete(timeoutId);
    callback();
}, delay);
this.pendingTimeouts.add(timeoutId);
```

**Analysis:** Line 416 actually DOES track the timeout properly. But line 693 doesn't.

**Fix Required for line 693:**
Use `trackedSetTimeout` helper or manually track.

---

## ⚠️ HIGH PRIORITY - Performance Issues

### 4. **Excessive Watcher Registrations During Row Refresh**
**Location:** `table.component.ts:1298-1386`

**Issue:**
- Watchers are registered on every row refresh/update
- Old watchers are cleaned up, but this happens frequently
- For large tables (1000+ rows), this creates significant overhead

**Current Behavior:**
- `registerRowNgClassWatcher` - called for each row
- `registerColNgClassWatcher` - called for each cell
- `registerCollapseOrExpandTitleWatch` - called for expandable rows

**Optimization:**
- Batch watcher registrations
- Use lazy watcher registration (only when row is visible)
- Cache watcher results when data hasn't changed

---

### 5. **Redundant Row Refresh Queuing**
**Location:** `table.component.ts:399-427`

**Issue:**
- `queueRowRefresh()` can be called multiple times for the same row
- Uses `requestAnimationFrame` but doesn't dedupe by row index efficiently
- Multiple frames scheduled for the same row cause redundant rendering

**Current Code:**
```typescript
private queueRowRefresh(rowIndex: number) {
    // ...
    this.pendingRowRefreshes.add(rowIndex);
    if (this.rowRefreshScheduled) { return; }
    this.rowRefreshScheduled = true;
    if (typeof requestAnimationFrame === 'function') {
        const frameId = requestAnimationFrame(() => {
            // ...
        });
    }
}
```

**Optimization:**
- Batch all pending row refreshes into a single frame
- Use a single `requestAnimationFrame` callback that processes all pending rows
- Clear `pendingRowRefreshes` after processing

---

### 6. **Inefficient Virtual Row Processing**
**Location:** `table.component.ts:232-239, 648-708`

**Issue:**
- IntersectionObserver is used but can trigger many callbacks
- Row virtualization might process invisible rows
- `lazyVisibilityPollHandle` uses `requestAnimationFrame` in a loop

**Optimization:**
- Debounce IntersectionObserver callbacks
- Use `requestIdleCallback` for non-critical row processing
- Batch row visibility checks

---

## ⚠️ MEDIUM PRIORITY - Code Quality

### 7. **Missing Cleanup for Lazy Visibility Observers**
**Location:** `table.component.ts:2303-2306`

**Issue:**
- `disconnectLazyVisibilityObservers()` is called but implementation might be incomplete
- `stopLazyVisibilityFallback()` needs to check all handles

**Fix Required:**
- Ensure all IntersectionObserver instances are disconnected
- Clear all `requestAnimationFrame` handles
- Clear all timeout handles for lazy visibility

---

### 8. **Datatable.js Event Handler Namespace Inconsistency**
**Location:** `datatable.js:2965-2966`

**Issue:**
- Line 2965 removes native event listener
- Line 2966 calls `$htm.off()` which removes ALL handlers
- This might remove handlers from other code

**Current Code:**
```javascript
$htm[0].removeEventListener('click', this.boundRowClickHandlerOnCapture);
$htm.off(); // Removes ALL handlers, not just datatable handlers
$htm[0].addEventListener('click', this.boundRowClickHandlerOnCapture);
```

**Fix Required:**
- Use namespaced handlers: `$htm.off('.datatable')` instead of `$htm.off()`
- Or be more specific about which handlers to remove

---

### 9. **Potential Memory Leak in Custom Expression Cache**
**Location:** `table.component.ts:210, 275-289`

**Issue:**
- `customExprCompiledTl` stores view references
- When rows are removed, cache entries might not be cleared
- Could accumulate over time

**Current Cleanup:**
- `teardownRowResources()` clears per-row expressions
- But if row data changes frequently, cache might grow

**Fix Required:**
- Implement cache size limit (LRU cache)
- Clear old entries when cache exceeds threshold

---

## 📊 LOW PRIORITY - Optimization Opportunities

### 10. **Debounce Grid Redraw**
**Location:** `table.component.ts:875`

**Current:** 
```typescript
redraw = debounce(this._redraw, 150);
```

**Issue:**
- Fixed 150ms debounce might be too aggressive for large tables
- Could use adaptive debouncing based on table size

**Optimization:**
- Dynamic debounce time based on data size
- Use `requestAnimationFrame` for visual updates
- Use longer debounce for data updates

---

### 11. **Optimize Row Object Cloning**
**Location:** `table.component.ts:2407-2429`

**Issue:**
- `getClonedRowObject()` uses `getClonedObject()` which does deep clone
- Called frequently during rendering
- Can be expensive for large row objects

**Optimization:**
- Use shallow clone for row objects
- Only deep clone when necessary
- Cache cloned objects when data hasn't changed

---

### 12. **Reduce jQuery Usage in Datatable.js**
**Location:** `datatable.js` (throughout)

**Issue:**
- Heavy jQuery usage increases bundle size
- Can be replaced with native DOM APIs in many places
- Better performance with native APIs

**Optimization:**
- Replace jQuery selectors with `querySelector/querySelectorAll`
- Replace jQuery event handlers with native `addEventListener`
- Only use jQuery where necessary (widget system integration)

---

## ✅ ALREADY OPTIMIZED (Good Practices Found)

1. ✅ **Watcher Cleanup Maps** - Using Maps to track watchers prevents accumulation
2. ✅ **Animation Frame Tracking** - Properly tracked and cleaned up
3. ✅ **Timeout Tracking** - `trackedSetTimeout` helper exists (just needs to be used consistently)
4. ✅ **IntersectionObserver Cleanup** - Disconnect is called in ngOnDestroy
5. ✅ **Subscription Management** - `selectedItemChangeSubscription` is properly managed
6. ✅ **Row Resource Teardown** - `teardownRowResources()` properly cleans up per-row resources

---

## 🎯 Recommended Fix Priority

### **Immediate (Fix Now):**
1. Fix untracked `setTimeout` in `bootstrapGrid()` (line 2044)
2. Fix untracked `setTimeout` in line 693
3. Initialize and track `pendingTimeouts` in datatable.js

### **High Priority (This Sprint):**
4. Optimize watcher registrations (batch/lazy)
5. Batch row refresh processing
6. Improve row virtualization efficiency

### **Medium Priority (Next Sprint):**
7. Complete lazy visibility observer cleanup
8. Fix jQuery event handler namespace issue
9. Add cache size limit for custom expressions

### **Low Priority (Backlog):**
10. Adaptive debouncing for redraw
11. Optimize row cloning
12. Reduce jQuery dependency

---

## 📝 Summary

**Critical Issues:** 3
**High Priority:** 3
**Medium Priority:** 3
**Low Priority:** 3
**Already Optimized:** 6

**Total Issues to Fix:** 9
**Optimization Opportunities:** 3

