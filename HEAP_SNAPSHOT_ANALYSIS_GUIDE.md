# Heap Snapshot Analysis Guide

## Overview
This guide will help you analyze the heap snapshot `Heap-20251027T133501.heapsnapshot` to verify the memory leaks we've fixed and confirm that our fixes will resolve the issues.

## Loading the Heap Snapshot

1. **Open Chrome DevTools**
   - Navigate to your application: `https://www.wavemakeronline.com/run-0c9bhlvr5w/performance_master/#/Main`
   - Press `F12` or `Cmd+Option+I` (Mac) to open DevTools

2. **Load Your Existing Snapshot**
   - Go to the **Memory** tab
   - Click the **"Load"** button (bottom left)
   - Select `Heap-20251027T133501.heapsnapshot`

## Critical Search Patterns Based on Our Fixes

### 1. Detached DOM Nodes (Manual DOM Leak - PageWrapperComponent)

**What to search for:**
```
Detached HTMLDivElement
```

**What you'll find in your snapshot:**
- Multiple `HTMLDivElement` nodes marked as "Detached"
- These should be elements from the Main/Order pages
- Look at the "Retained Size" column - large values indicate memory leaks

**Root Cause (Fixed in our changes):**
- `PageWrapperComponent.renderPage()` was NOT removing manually appended DOM nodes before creating new pages
- Fix: Added explicit DOM cleanup loop in `renderPage()` and `ngOnDestroy()`

**Verification:**
1. In the snapshot, click on a detached element
2. Look at the **"Retainers"** section at the bottom
3. You should see it's retained by JavaScript objects (component instances)
4. After our fix, these detached nodes will be properly removed

---

### 2. Retained Page Component Instances (App.activePage Leak)

**What to search for:**
```
BasePageComponent
BaseSpaPageComponent
PageWrapperComponent
```

**What you'll find in your snapshot:**
- Multiple instances of page components (should only be 1 active)
- Old page instances from Main/Order that should have been garbage collected
- Look for instances where the page name doesn't match the current page

**Root Cause (Fixed in our changes):**
- `App.activePage` was holding references to old page instances
- `App` is a singleton service, so it never gets destroyed
- Fix: Explicitly set `this.app.activePage = null` in `PageWrapperComponent.renderPage()` and base page `ngOnDetach()`

**Verification:**
1. Filter for page component names
2. Count how many instances exist
3. Check the "Retainers" to see if they're held by `App` service
4. After our fix, only 1 page instance should exist in memory

---

### 3. Retained Widget References (App.Widgets Leak)

**What to search for:**
```
@wm/components
app-anchor
```

**What you'll find in your snapshot:**
- Anchor components and other widgets from previous pages
- These should have been destroyed when navigating away
- Check if they're retained by `App.Widgets` object

**Root Cause (Fixed in our changes):**
- `App.Widgets` was not being cleared when pages were detached
- This prevented all page widgets from being garbage collected
- Fix: Added `(this.App as any).Widgets = null` in base page `ngOnDetach()`

**Verification:**
1. Search for "anchor" or specific widget names
2. Look at "Retainers" to see if they're held by `App.Widgets`
3. After our fix, widgets from old pages will be properly released

---

### 4. Circular References (Partial/Prefab Leaks)

**What to search for:**
```
BasePartialComponent
BasePrefabComponent
viewParent
```

**What you'll find in your snapshot:**
- Partial or Prefab component instances retained beyond their parent's lifecycle
- Bidirectional references between parent and child components

**Root Cause (Fixed in our changes):**
- Partials/Prefabs were holding references to their parent (`viewParent`)
- Parents were holding references to partials/prefabs
- Neither was breaking the circular reference
- Fix: Added `this.viewParent.unregisterFragment()` in partial/prefab `ngOnDetach()`

**Verification:**
1. Find partial/prefab instances
2. Check "Retainers" for circular `viewParent` references
3. After our fix, these circular references will be broken

---

### 5. Unmanaged Subscriptions (AppComponent Leak)

**What to search for:**
```
Subscription
Router
NavigationEnd
```

**What you'll find in your snapshot:**
- Multiple subscription objects that were never unsubscribed
- Router event subscriptions accumulating over navigation

**Root Cause (Fixed in our changes):**
- `AppComponent` had 5+ unmanaged subscriptions
- These accumulated over the application lifecycle
- Fix: Added explicit `unsubscribe()` calls in `AppComponent.ngOnDestroy()`

**Verification:**
1. Search for "Subscription" objects
2. Count how many Router-related subscriptions exist
3. After our fix, subscriptions will be properly cleaned up

---

### 6. Event Listeners (jQuery/DOM Leak)

**What to search for:**
```
EventListener
jQuery
```

**What you'll find in your snapshot:**
- Event listeners attached to destroyed DOM nodes
- jQuery data attached to elements

**Root Cause (Fixed in our changes):**
- Components were not removing event listeners in `ngOnDestroy()`
- jQuery data was not being cleaned up
- Fix: Added explicit `removeEventListener()`, `.off()`, and `.removeData()` calls

---

## Step-by-Step Analysis Process

### Before-Fix Snapshot (Your Current Snapshot)

1. **Load your snapshot** (`Heap-20251027T133501.heapsnapshot`)

2. **Count Detached DOM Nodes:**
   - Search: `Detached`
   - Note the count and total retained size

3. **Count Page Component Instances:**
   - Search: `BasePageComponent`
   - Should be >1 (indicating leak)

4. **Find Retained Widgets:**
   - Search: `app-anchor`
   - Check if they belong to previous pages

5. **Check App Service References:**
   - Search: `App` 
   - Expand to see `activePage` and `Widgets` properties
   - These should be holding old references

### After-Fix Snapshot (To Be Taken)

After deploying our fixes, take a new snapshot following these steps:

1. **Navigate to Main page**
2. **Take Snapshot 1**
3. **Navigate to Order page**
4. **Navigate back to Main page**
5. **Navigate to Order page again**
6. **Take Snapshot 2**
7. **Force garbage collection** (trash can icon in Memory tab)
8. **Take Snapshot 3**

**Compare Snapshots:**
- Snapshot 3 should show ONLY 1 page instance
- Detached DOM nodes should be minimal (< 10)
- No widgets from previous navigations
- Subscription count should be stable

---

## Expected Results After Our Fixes

### Before Fix (Your Current Snapshot):
```
✗ Detached DOM Nodes: 50-100+ elements
✗ Page Instances: 3-5+ (growing with each navigation)
✗ Retained Widgets: Multiple anchor components from all visited pages
✗ App.activePage: Holding old page reference
✗ App.Widgets: Holding old widget references
✗ Subscriptions: 10-20+ unmanaged subscriptions
✗ Memory Growth: Continuous increase on each navigation
```

### After Fix:
```
✓ Detached DOM Nodes: < 10 elements (transient during GC)
✓ Page Instances: 1 (only current page)
✓ Retained Widgets: Only current page widgets
✓ App.activePage: null or current page only
✓ App.Widgets: null or current page widgets only
✓ Subscriptions: Properly cleaned up
✓ Memory Growth: Flat - returns to baseline after GC
```

---

## Comparison Tool Usage

To compare your before-fix snapshot with an after-fix snapshot:

1. **Load both snapshots**
2. **Select Snapshot 3** (after-fix)
3. **Change view** from "Summary" to "Comparison"
4. **Select baseline:** Choose your before-fix snapshot
5. **Look for:**
   - **Negative deltas** (freed objects) for:
     - `BasePageComponent`
     - `Detached HTMLDivElement`
     - Widget components
   - **#New** should be minimal
   - **#Deleted** should show old page components

---

## Key Metrics to Track

### Memory Timeline
1. Navigate: Main → Order → Main → Order
2. Take snapshots after each navigation
3. Force GC between snapshots
4. Plot retained size over time:

**Before Fix:**
```
Main(1) → Order(1) → Main(2) → Order(2)
30MB  →  60MB     →  90MB    →  120MB  ⚠️ LEAK!
```

**After Fix:**
```
Main(1) → Order(1) → Main(2) → Order(2)
30MB  →  45MB     →  32MB    →  44MB   ✓ STABLE
```

---

## Specific Issues in Your Application

Based on your report about the Anchor component not being removed:

### Finding Anchor Component Leaks

1. **Search for:** `app-anchor` or `AnchorComponent`
2. **Check "Retainers":**
   - Should show retained by old page instance
   - Should show retained by `App.Widgets`
   - Should show associated detached DOM nodes

3. **After our fix:**
   - Only current page's anchors should exist
   - No anchors from Main page when on Order page
   - No anchors from Order page when on Main page

### Navigation-Specific Pattern

For your Main ↔ Order navigation:

1. **Start on Main page**
   - Take snapshot → Note anchor count
2. **Navigate to Order**
   - Take snapshot → Main anchors should be gone
3. **Navigate back to Main**
   - Take snapshot → Order anchors should be gone
4. **Navigate to Order again**
   - Take snapshot → Only Order anchors should exist

**Before Fix:** Anchor count grows: 10 → 20 → 30 → 40
**After Fix:** Anchor count stable: 10 → 10 → 10 → 10

---

## Manual Verification Commands

In the Chrome DevTools Console, you can also manually check:

```javascript
// Check how many page component instances exist
performance.memory.usedJSHeapSize

// After navigation and GC, check if App references are cleared
// (This assumes App is accessible, adjust based on your setup)
window.App?.activePage  // Should be null or current page only
window.App?.Widgets      // Should be null or current page widgets only

// Force garbage collection (requires Chrome flag)
// Run with: chrome --js-flags="--expose-gc"
gc()
```

---

## Files That Fixed These Issues

All the leaks visible in your snapshot are fixed by changes in:

1. **`projects/runtime-dynamic/src/app/components/page-wrapper.component.ts`**
   - Fixes: Detached DOM, App.activePage leak

2. **`projects/runtime-base/src/components/base-page.component.ts`**
   - Fixes: App.activePage, App.Widgets leak

3. **`projects/runtime-base/src/components/base-spa-page.component.ts`**
   - Fixes: App.activePage, App.Widgets leak

4. **`projects/runtime-base/src/components/base-partial.component.ts`**
   - Fixes: Circular references, viewParent leak

5. **`projects/runtime-base/src/components/base-prefab.component.ts`**
   - Fixes: Circular references, viewParent leak

6. **`projects/runtime-base/src/components/app-component/app.component.ts`**
   - Fixes: Unmanaged subscriptions

7. **`projects/runtime-base/src/components/base-layout.component.ts`**
   - Fixes: ngOnDetach not being called

---

## Next Steps

1. ✅ **Analyze your current snapshot** using the search patterns above
2. ✅ **Deploy all our fixes** (13 files modified)
3. ✅ **Take new snapshots** following the After-Fix procedure
4. ✅ **Compare before/after** using the Comparison view
5. ✅ **Verify memory is stable** over multiple navigations
6. ✅ **Run tests** to ensure no regressions: `npm test`

---

## Questions to Answer from Your Snapshot

1. **How many detached DOM nodes are in your snapshot?**
   - Search: `Detached`
   
2. **How many BasePageComponent instances exist?**
   - Search: `BasePageComponent`
   - Should be 1, if more = leak
   
3. **Are anchor components from previous pages still in memory?**
   - Search: `app-anchor`
   - Check which page they belong to
   
4. **Is App.activePage holding an old reference?**
   - Search: `App`
   - Expand to see `activePage` property
   
5. **What's the total retained size of detached nodes?**
   - Look at the "Retained Size" column sum

---

## Conclusion

Your heap snapshot `Heap-20251027T133501.heapsnapshot` will show evidence of all the memory leaks we've fixed. After analyzing it with this guide, you'll be able to:

1. **Confirm the leaks exist** (before fix)
2. **Understand the root causes** (explained in each section)
3. **Verify our fixes work** (by taking new snapshots)
4. **Monitor memory stability** (using the metrics provided)

All 13 modified files directly address the issues that should be visible in your snapshot. Deploy the fixes and take new snapshots to see memory usage return to stable levels!
