# Expression Analysis: Static vs Dynamic

## Overview

This document categorizes the provided expressions as **Static** (don't change during runtime) or **Dynamic** (can change and need watching).

---

## Expression Categories

### ✅ STATIC Expressions (Don't Need Watching)

These expressions evaluate to the same value throughout the app lifecycle and can be optimized.

#### 1. **appLocale Expressions** (Static Localization Strings)

| Expression | Type | Reason |
|------------|------|--------|
| `appLocale.RebalanceAccountInvestments_pageTitle` | ✅ **STATIC** | Localization strings don't change at runtime |
| `appLocale.RebalanceAccountInvestments_wizardStep1Title` | ✅ **STATIC** | Localization strings don't change at runtime |

**Optimization:** These are already handled by the appLocale optimization we just implemented!

---

### 🔄 DYNAMIC Expressions (Need Watching)

These expressions can change during runtime and must be watched.

#### 2. **Variable References** (Change Based on Data/State)

| Expression | Type | Reason |
|------------|------|--------|
| `Variables.stvActivePageBreadCrumb.dataSet` | 🔄 **DYNAMIC** | Variables can change, dataSet is reactive |
| `Variables.stvActivePageBreadCrumb` | 🔄 **DYNAMIC** | Variable value can change |
| `Variables.stvRebalanceOptions.dataSet` | 🔄 **DYNAMIC** | Variable dataSet can change |
| `Variables.tableDataset.dataSet.length > 5 ? 'scrollable-tbody-table' : ''` | 🔄 **DYNAMIC** | Conditional based on variable length |
| `Variables.stvRebalanceAccInvMatchTargetValue.dataSet.dataValue` | 🔄 **DYNAMIC** | Variable dataValue can change |

**Why Dynamic:** Variables are bound to data sources, user input, or computed values that change during app execution.

#### 3. **Function Calls** (Depend on State)

| Expression | Type | Reason |
|------------|------|--------|
| `previousbtnlabel()` | 🔄 **DYNAMIC** | Function result depends on current wizard step |
| `nextbtnlabel()` | 🔄 **DYNAMIC** | Function result depends on current wizard step |
| `hasNoNextStep()` | 🔄 **DYNAMIC** | Function result depends on wizard state |

**Why Dynamic:** These functions likely check the current state (wizard step, navigation) which can change.

#### 4. **Row Data Expressions** (Change Per Row/Data)

| Expression | Type | Reason |
|------------|------|--------|
| `row.getProperty('investment')` | 🔄 **DYNAMIC** | Different for each row, changes with data |
| `row.getProperty('currentBalance') \| toCurrency: commonparams.currencypattern : commonparams.currencyDecimal` | 🔄 **DYNAMIC** | Row data changes, currency formatting applied |
| `row.getProperty('redemptionFee') \| toCurrency: commonparams.currencypattern : commonparams.currencyDecimal` | 🔄 **DYNAMIC** | Row data changes, currency formatting applied |

**Why Dynamic:** Row data is different for each item in a dataset/list/table. These expressions evaluate differently for each row.

#### 5. **Action References** (Can Change Based on Context)

| Expression | Type | Reason |
|------------|------|--------|
| `Actions.loginAction` | 🔄 **DYNAMIC** | Action reference, but action execution is event-based |

**Note:** While the action itself is a static reference, if it's used in a binding context, it might need watching if the action result is used.

#### 6. **Notification Properties** (Can Change)

| Expression | Type | Reason |
|------------|------|--------|
| `notification.alerttype` | 🔄 **DYNAMIC** | Notification properties change when notifications are shown |
| `notification.title` | 🔄 **DYNAMIC** | Notification title changes per notification |

**Why Dynamic:** Notifications are typically shown/hidden and their properties change based on the current notification.

#### 7. **Static Property Values**

| Expression | Type | Reason |
|------------|------|--------|
| `canceltext` | ✅ **STATIC** | Static property value, doesn't change |
| `iconclass` | ✅ **STATIC** | Static property value, doesn't change |
| `message` | ✅ **STATIC** | Static property value, doesn't change |
| `directionlinks` | ✅ **STATIC** | Static property value, doesn't change |
| `navControls` | ✅ **STATIC** | Static property value, doesn't change |
| `iconposition` | ✅ **STATIC** | Static property value, doesn't change |
| `iconwidth` | ✅ **STATIC** | Static property value, doesn't change |

**Why Static:** These are static property values that don't change during runtime. They're set once during initialization and remain constant.

---

## Summary Table

| Category | Count | Examples |
|----------|-------|---------|
| **✅ STATIC** | 9 | `appLocale.*` expressions, static properties |
| **🔄 DYNAMIC** | 13 | Variables, functions, row data, notifications |

---

## Optimization Recommendations

### 1. **Already Optimized** ✅
- `appLocale.*` expressions are now evaluated once and removed from registry

### 2. **Potential Optimizations**

#### A. **Static Property Values** ✅
`canceltext`, `iconclass`, `message`, `directionlinks`, `navControls`, `iconposition`, `iconwidth` are static and don't need watchers.

**Optimization Opportunity:** These could be evaluated once and removed from registry, similar to appLocale expressions.

#### B. **Function Call Results**
If `previousbtnlabel()`, `nextbtnlabel()`, `hasNoNextStep()` return values that rarely change, consider:
- Caching results
- Only re-evaluating when wizard state changes
- Using computed properties instead of function calls

#### C. **Row Data Expressions**
These are inherently dynamic (different per row), but:
- Ensure they're only evaluated when the row data changes
- Consider using `OnPush` change detection strategy
- Avoid unnecessary re-evaluation in change detection cycles

### 3. **No Optimization Needed** (Correctly Dynamic)

These should remain dynamic:
- ✅ All `Variables.*` expressions
- ✅ All `row.getProperty()` expressions
- ✅ Conditional expressions based on data
- ✅ Notification properties

---

## Detection Logic for Static vs Dynamic

### Static Indicators
- ✅ Starts with `appLocale.`
- ✅ Literal string values (no binding)
- ✅ Constant values that never change

### Dynamic Indicators
- 🔄 Starts with `Variables.`
- 🔄 Contains function calls `()`
- 🔄 Contains `row.getProperty()`
- 🔄 Contains conditional operators `? :`
- 🔄 Contains pipes `|`
- 🔄 References to `notification.*`
- 🔄 Bound properties (`.bind` attribute)

---

## Code to Detect Static Expressions

```typescript
function isStaticExpression(expr: string): boolean {
    const trimmedExpr = expr.trim();
    
    // appLocale expressions are static
    if (trimmedExpr.startsWith('appLocale')) {
        return true;
    }
    
    // Static property names (simple identifiers without dots, functions, or operators)
    const staticPropertyNames = [
        'canceltext', 'iconclass', 'message', 
        'directionlinks', 'navControls', 
        'iconposition', 'iconwidth'
    ];
    if (staticPropertyNames.includes(trimmedExpr)) {
        return true;
    }
    
    // Literal strings (no variables, functions, or operators)
    if (!expr.includes('Variables.') && 
        !expr.includes('()') && 
        !expr.includes('row.') && 
        !expr.includes('?') && 
        !expr.includes('|') &&
        !expr.includes('notification.') &&
        !expr.includes('Actions.')) {
        // Simple identifier without special characters - likely static
        return true;
    }
    
    return false; // Dynamic
}
```

---

## Final Categorization

### ✅ STATIC (9)
1. `appLocale.RebalanceAccountInvestments_pageTitle`
2. `appLocale.RebalanceAccountInvestments_wizardStep1Title`
3. `canceltext`
4. `iconclass`
5. `message`
6. `directionlinks`
7. `navControls`
8. `iconposition`
9. `iconwidth`

### 🔄 DYNAMIC (13)
1. `Variables.stvActivePageBreadCrumb.dataSet`
2. `Variables.stvActivePageBreadCrumb`
3. `previousbtnlabel()`
4. `nextbtnlabel()`
5. `hasNoNextStep()`
6. `Variables.stvRebalanceOptions.dataSet`
7. `Variables.tableDataset.dataSet.length > 5 ? 'scrollable-tbody-table' : ''`
8. `Variables.stvRebalanceAccInvMatchTargetValue.dataSet.dataValue`
9. `row.getProperty('investment')` (appears twice)
10. `row.getProperty('currentBalance') | toCurrency: ...`
11. `row.getProperty('redemptionFee') | toCurrency: ...`
12. `notification.alerttype`
13. `notification.title`

### ⚠️ ACTION REFERENCE (1)
1. `Actions.loginAction` - Static reference to an action, but action execution is event-based (not watched)

**Note:** Action references are static, but their execution is triggered by events, not change detection.

