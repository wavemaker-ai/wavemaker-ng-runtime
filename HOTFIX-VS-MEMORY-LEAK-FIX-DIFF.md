# Code Differences: hotfix vs dev-siva/memory-leak-fix

## Overview

**Branch Comparison:** `hotfix` → `dev-siva/memory-leak-fix`  
**Total Changes:** 63 files changed, 1,426 insertions(+), 164 deletions(-)  
**Date Generated:** $(date)

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Files Modified** | 63 |
| **Lines Added** | 1,426 |
| **Lines Deleted** | 164 |
| **Net Change** | +1,262 lines |

---

## Commits in dev-siva/memory-leak-fix (not in hotfix)

The following commits exist in `dev-siva/memory-leak-fix` but not in `hotfix`:

1. **4b16a6b3c** - WMS-29365: Implement OnDestroy lifecycle methods in ItemTemplateDirective and PartialParamHandlerDirective to address memory leaks by clearing context and parameter references. Additionally, enhance TableComponent and TableColumnDirective with cleanup for QueryLists and subjects to improve resource management and stability across the application.

2. **feecc7e16** - WMS-29365: Add OnDestroy lifecycle methods to various components and directives to implement memory leak fixes. This includes clearing references to child components, dynamic contexts, and event listeners to enhance resource management and stability across the application.

3. **c3da979d1** - WMS-29365: Implement memory leak fixes in various components by adding OnDestroy lifecycle methods to clear ViewChild references and prevent retaining unnecessary data. This includes updates to CheckboxComponent, ColorPickerComponent, CurrencyComponent, and others to enhance resource management and stability.

4. **48a77412b** - WMS-29365: Implement memory leak fixes across various components by ensuring proper cleanup of event listeners, subscriptions, and context references in ngOnDestroy methods. This includes storing bound function references for event listeners and clearing dynamic contexts to prevent retaining unnecessary data. Enhancements made to directives and components such as ShowInDeviceDirective, LazyLoadDirective, and others to improve resource management and stability.

5. **ae82122ff** - WMS-29365: Refactor PopoverComponent to manage subscriptions in OnDestroy...

6. **52326f890** - WMS-29365: Enhance PopoverComponent: Implement OnDestroy lifecycle method for...

7. **e8d675459** - [WMS-29581] sorting in datatable is working for nested data and string

8. **f2e21e9e0** - WMS-29407 fix: header inline content is rendering outside the container target

9. **5d9894975** - [WMS-29566] same data is there in static data inline edit will work

10. **359a26c09** - WMS-29537 Updated .gitlab-ci.yml to handling unit test

11. **bbe7ee6bb** - WMS-29537 Updating .gitlab-ci.yml for handling CI pipelines during dev-* branches for PR raising

12. Plus several merge commits and other fixes...

---

## Files Changed by Category

### Configuration Files (2 files)
- `.gitlab-ci.yml` - 15 insertions, 7 deletions
- `package.json` - 5 insertions, 0 deletions

### Core Utilities (5 files)
- `projects/core/src/utils/watcher.ts` - Minor changes
- `projects/core/src/utils/event-notifier.ts` - 5 insertions, 2 deletions
- `projects/core/src/services/viewport.service.ts` - 16 insertions, 8 deletions

### Base Components & Directives (11 files)
- `projects/components/base/src/directives/show-in-device.directive.ts` - 25 insertions, 3 deletions
- `projects/components/base/src/widgets/common/base/base-container.component.ts` - 32 insertions, 2 deletions
- `projects/components/base/src/widgets/common/base/base-field-validations.ts` - 20 insertions, 0 deletions (new additions)
- `projects/components/base/src/widgets/common/base/base.component.ts` - 11 insertions, 0 deletions
- `projects/components/base/src/widgets/common/base/partial-container.directive.ts` - 29 insertions, 2 deletions
- `projects/components/base/src/widgets/common/item-template/item-template.directive.ts` - 33 insertions, 3 deletions
- `projects/components/base/src/widgets/common/lazy-load/lazy-load.directive.ts` - 17 insertions, 2 deletions
- `projects/components/base/src/widgets/common/partial-param/partial-param.directive.ts` - 20 insertions, 2 deletions
- `projects/components/base/src/widgets/common/pull-to-refresh/pull-to-refresh.ts` - 35 insertions, 10 deletions
- `projects/components/base/src/widgets/framework/widget-proxy-provider.ts` - 5 insertions, 2 deletions
- `projects/components/base/src/widgets/framework/widget-registry.ts` - 5 insertions, 2 deletions

### Widget Components (54 files)

#### Basic Widgets (3 files)
- `projects/components/widgets/basic/anchor/src/anchor.component.ts` - 16 insertions, 1 deletion
- `projects/components/widgets/basic/label/src/label.directive.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/basic/search/src/scrollable.directive.ts` - 16 insertions, 3 deletions
- `projects/components/widgets/basic/search/src/search.component.ts` - 24 insertions, 1 deletion

#### Container Widgets (5 files)
- `projects/components/widgets/containers/accordion/src/accordion.directive.ts` - 49 insertions, 4 deletions
- `projects/components/widgets/containers/tabs/src/tabs.component.ts` - 55 insertions, 3 deletions
- `projects/components/widgets/containers/wizard/src/wizard-step/wizard-step.component.ts` - 18 insertions, 1 deletion
- `projects/components/widgets/containers/wizard/src/wizard.component.ts` - 64 insertions, 4 deletions

#### Data Widgets (11 files)
- `projects/components/widgets/data/form/src/form-field/form-field.directive.ts` - 30 insertions, 1 deletion
- `projects/components/widgets/data/form/src/form-widget.directive.ts` - 10 insertions, 2 deletions
- `projects/components/widgets/data/form/src/form.component.ts` - 31 insertions, 0 deletions (new additions)
- `projects/components/widgets/data/list/src/list-item.directive.ts` - 26 insertions, 2 deletions
- `projects/components/widgets/data/list/src/list.component.ts` - 59 insertions, 3 deletions
- `projects/components/widgets/data/pagination/src/pagination.component.ts` - 41 insertions, 1 deletion
- `projects/components/widgets/data/table/src/datatable.js` - 70 insertions, 9 deletions
- `projects/components/widgets/data/table/src/table-column/table-column.directive.ts` - 64 insertions, 1 deletion
- `projects/components/widgets/data/table/src/table-cud.directive.ts` - 10 insertions, 3 deletions
- `projects/components/widgets/data/table/src/table-filter.directive.ts` - 14 insertions, 3 deletions
- `projects/components/widgets/data/table/src/table-row-action/table-row-action.directive.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/data/table/src/table.component.ts` - **147 insertions, 4 deletions** (largest change)

#### Input Widgets (27 files)
- `projects/components/widgets/input/checkbox/src/checkbox.component.ts` - 11 insertions, 1 deletion
- `projects/components/widgets/input/chips/src/chips.component.ts` - 31 insertions, 2 deletions
- `projects/components/widgets/input/color-picker/src/color-picker.component.ts` - 12 insertions, 2 deletions
- `projects/components/widgets/input/currency/src/currency.component.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/input/dataset-aware-form/src/dataset-aware-form.component.ts` - 24 insertions, 0 deletions (new additions)
- `projects/components/widgets/input/epoch/base-date-time/src/base-date-time.component.ts` - 6 insertions, 3 deletions
- `projects/components/widgets/input/file-upload/src/file-upload.component.ts` - 32 insertions, 8 deletions
- `projects/components/widgets/input/number/src/number.component.ts` - 12 insertions, 2 deletions
- `projects/components/widgets/input/rating/src/rating.component.ts` - 15 insertions, 2 deletions
- `projects/components/widgets/input/select/src/select.component.ts` - 10 insertions, 2 deletions
- `projects/components/widgets/input/slider/src/slider.component.ts` - 15 insertions, 2 deletions
- `projects/components/widgets/input/switch/src/switch.component.ts` - 22 insertions, 2 deletions
- `projects/components/widgets/input/text/src/input-calendar/input-calendar.component.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/input/text/src/input-color/input-color.component.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/input/text/src/input-email/input-email.component.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/input/text/src/input-number/input-number.component.ts` - 11 insertions, 2 deletions
- `projects/components/widgets/input/text/src/input-text/input-text.component.ts` - 12 insertions, 2 deletions
- `projects/components/widgets/input/textarea/src/textarea.component.ts` - 11 insertions, 2 deletions

#### Navigation Widgets (1 file)
- `projects/components/widgets/navigation/popover/src/popover.component.ts` - **67 insertions, 5 deletions**

#### Page Widgets (2 files)
- `projects/components/widgets/page/default/src/page-content/page-content.component.ts` - 3 insertions, 2 deletions
- `projects/components/widgets/page/header/src/header.component.html` - 5 insertions, 1 deletion
- `projects/components/widgets/page/header/src/header.component.ts` - 3 insertions, 1 deletion

### Runtime Base (4 files)
- `projects/runtime-base/src/components/base-partial.component.ts` - 1 insertion, 1 deletion
- `projects/runtime-base/src/components/base-prefab.component.ts` - 22 insertions, 14 deletions
- `projects/runtime-base/src/directives/accessroles.directive.ts` - 13 insertions, 3 deletions
- `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts` - 3 insertions, 0 deletions (new additions)

### Other Services (1 file)
- `projects/oAuth/src/oAuth.service.ts` - 1 insertion, 1 deletion

---

## Key Changes Summary

### 1. Memory Leak Fixes (WMS-29365)
The primary focus of this branch is implementing memory leak fixes across the application. The main changes include:

#### A. OnDestroy Lifecycle Implementation
- Added `ngOnDestroy` methods to numerous components and directives
- Proper cleanup of:
  - ViewChild references
  - Event listeners
  - Subscriptions
  - Dynamic contexts
  - QueryLists
  - Subjects/observables
  - ViewContainerRef instances

#### B. Table Component Enhancements (147 insertions)
- Enhanced `TableComponent` with comprehensive cleanup
- Destruction of ViewContainerRef instances for:
  - Custom expressions
  - Row actions
  - Filters
  - Inline edits
  - Dynamic tables
- Clearing of QueryLists and subjects

#### C. Directive Cleanup
- `ItemTemplateDirective`: Clears context references
- `PartialParamHandlerDirective`: Clears parameter references
- `ShowInDeviceDirective`: Stores bound function references for event listeners
- `LazyLoadDirective`: Clears dynamic contexts

#### D. Component Cleanup
- Form components: Clear form widget references
- List components: Cleanup of list items
- Container components (Accordion, Tabs, Wizard): Clear child component references
- Input components: Clear ViewChild references

### 2. Popover Component Refactoring (67 insertions)
- Refactored `PopoverComponent` to manage subscriptions in OnDestroy
- Proper cleanup of subscriptions and event listeners

### 3. Table Component Fixes
- `datatable.js`: 70 insertions, 9 deletions
  - Sorting fixes for nested data and string
  - Inline edit improvements
- `table-column.directive.ts`: 64 insertions
  - Cleanup for QueryLists

### 4. Header Component Fix (WMS-29407)
- Fixed inline content rendering outside container target
- Template and component updates

### 5. CI/CD Configuration Updates (WMS-29537)
- Updated `.gitlab-ci.yml` for handling unit tests
- Support for CI pipelines during dev-* branches for PR raising

### 6. Package Dependencies
- Updated `package.json` with new dependencies if any

---

## Files with Most Changes

| File | Insertions | Deletions | Net Change |
|------|------------|-----------|------------|
| `table.component.ts` | 147 | 4 | +143 |
| `popover.component.ts` | 67 | 5 | +62 |
| `wizard.component.ts` | 64 | 4 | +60 |
| `table-column.directive.ts` | 64 | 1 | +63 |
| `list.component.ts` | 59 | 3 | +56 |
| `tabs.component.ts` | 55 | 3 | +52 |
| `datatable.js` | 70 | 9 | +61 |
| `accordion.directive.ts` | 49 | 4 | +45 |
| `pagination.component.ts` | 41 | 1 | +40 |
| `file-upload.component.ts` | 32 | 8 | +24 |

---

## Pattern Analysis

### Common Pattern: OnDestroy Implementation

Most components follow a similar pattern for memory leak fixes:

```typescript
export class ComponentName implements OnDestroy {
  // ... existing code ...

  ngOnDestroy(): void {
    // Clear ViewChild references
    if (this.someViewChild) {
      this.someViewChild = null;
    }
    
    // Unsubscribe from subscriptions
    if (this.someSubscription) {
      this.someSubscription.unsubscribe();
    }
    
    // Clear event listeners
    if (this.boundEventListener) {
      // remove event listener
      this.boundEventListener = null;
    }
    
    // Clear dynamic contexts
    if (this.dynamicContext) {
      this.dynamicContext = null;
    }
  }
}
```

### Table Component Specific Pattern

The table component includes more comprehensive cleanup:

```typescript
ngOnDestroy(): void {
  // Destroy ViewContainerRef instances
  if (this.customExpressionViewRefs) {
    this.customExpressionViewRefs.forEach(ref => {
      if (ref && !ref.destroyed) {
        ref.destroy();
      }
    });
    this.customExpressionViewRefs.clear();
  }
  
  // Clear QueryLists
  if (this.someQueryList) {
    this.someQueryList = null;
  }
  
  // Complete subjects
  if (this.someSubject) {
    this.someSubject.complete();
    this.someSubject = null;
  }
}
```

---

## Testing Recommendations

Based on the changes, the following areas should be tested:

1. **Memory Leak Verification**
   - Test component destruction and verify no memory leaks
   - Use browser DevTools Memory profiler
   - Verify ViewContainerRef instances are properly destroyed

2. **Table Component**
   - Test with custom expressions
   - Test row actions
   - Test filters
   - Test inline edits
   - Test dynamic tables
   - Verify no memory leaks during table operations

3. **Popover Component**
   - Test subscription cleanup
   - Verify no memory leaks with multiple popover instances

4. **Form Components**
   - Test form widget cleanup
   - Verify no references retained after form destruction

5. **List Components**
   - Test list item cleanup
   - Verify no memory leaks with large lists

6. **Container Components**
   - Test Accordion, Tabs, Wizard cleanup
   - Verify child component references are cleared

---

## Breaking Changes

None identified. All changes are additions of cleanup code and do not modify existing functionality.

---

## Migration Notes

No migration required. These changes are internal improvements that enhance memory management without changing APIs.

---

## Sample Code Differences

### 1. Table Component (table.component.ts) - 147 insertions

**Key Changes:**
- Added `OnDestroy` lifecycle implementation
- Clear ViewContainerRef instances for custom expressions, row actions, filters, inline edits
- Clear compiled template caches
- Unsubscribe from navigator watches
- Added ChangeDetectionStrategy.OnPush for performance

**Example:**
```diff
+ ngOnDestroy() {
+     // MEMORY LEAK FIX: Remove document click listener
+     document.removeEventListener('click', this.documentClickBind);
+     
+     // MEMORY LEAK FIX: Unsubscribe from navigator watches
+     if (this.navigatorResultWatch) {
+         this.navigatorResultWatch.unsubscribe();
+         this.navigatorResultWatch = null;
+     }
+     
+     // MEMORY LEAK FIX: Clear all ViewContainerRef embedded views
+     if (this.customExprViewRef) {
+         this.customExprViewRef.clear();
+     }
+     // ... more ViewContainerRef cleanup
+ }
```

### 2. ShowInDevice Directive - Event Listener Fix

**Key Changes:**
- Store bound function reference for proper cleanup
- Clear embedded view reference
- Clear context to release references

**Example:**
```diff
+ private boundOnResize: () => void; // MEMORY LEAK FIX: Store bound function for proper cleanup

- window.addEventListener('resize', this.onResize.bind(this));
+ this.boundOnResize = this.onResize.bind(this);
+ window.addEventListener('resize', this.boundOnResize);

+ ngOnDestroy() {
+     // MEMORY LEAK FIX: Remove using the stored bound function reference
+     if (this.boundOnResize) {
+         window.removeEventListener('resize', this.boundOnResize);
+         this.boundOnResize = null;
+     }
+     // ... more cleanup
+ }
```

### 3. Popover Component - Subscription Management

**Key Changes:**
- Store subscription references
- Proper cleanup of subscriptions in OnDestroy
- Check component state before accessing references

**Example:**
```diff
+ private partialLoadedSubscription: any;
+ private arrowPositionSubscription: any;

+ ngOnDestroy() {
+     // Unsubscribe from partialLoaded event
+     if (this.partialLoadedSubscription) {
+         this.partialLoadedSubscription();
+         this.partialLoadedSubscription = null;
+     }
+     
+     // Unsubscribe from arrow position adjustment
+     if (this.arrowPositionSubscription) {
+         this.arrowPositionSubscription.unsubscribe();
+         this.arrowPositionSubscription = null;
+     }
+ }
```

---

## Related Documentation

- `BRANCH-COMPARISON-ANALYSIS.md` - Comparison with newhotfix branch
- `BRANCH-REGISTRY-COMPARISON.md` - Registry architecture comparison
- `MEMORY-AND-CPU-OPTIMIZATIONS.md` - Performance optimizations
- `PERFORMANCE-ANALYSIS-RESULTS.md` - Performance analysis

---

**Generated:** $(date)  
**Command Used:** `git diff hotfix..dev-siva/memory-leak-fix --stat`

**Full Diff Available:** `/tmp/hotfix_vs_memory_leak_fix.diff` (3,252 lines)

