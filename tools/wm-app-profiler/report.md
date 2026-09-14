# WaveMaker App Performance & Resource Audit Report

**Project Name**: `WMSRMWorkbench`  
**Analyzed At**: 05/09/2026, 16:36:06  
**Overall Performance Health**: 🔴 **0 / 100**  
**Total Pages Scanned**: 1 | **Total Widgets**: 5049 | **Variables**: 239

---

## SUMMARY OF ACTIONABLE FINDINGS

| Audit Pillar | Status | Key Focus |
| :--- | :---: | :--- |
| **Part A: Application Performance (Studio Fixes)** | ⚠️ Action Required | 31 recommendations for WaveMaker Studio developer |
| **Part B: Build & Deployment Resources (12 GB RAM)** | ℹ️ Config Ready | Auto-patch limits Terser workers & prunes unused global scripts |

---

# PART A: APPLICATION PERFORMANCE OPTIMIZATIONS
> **Audience: WaveMaker Studio Low-Code Developer**
> These issues directly affect end-user speed, mobile responsiveness, and memory usage. Follow the exact Studio steps below to resolve them.

### 🚨 Critical Studio Action Items (High Priority)

#### [1] Unpaginated Table Widget 'postWMSMultiOrderAddSPTable1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `postWMSMultiOrderAddSPTable1` 
- **Problem**: Table widget 'postWMSMultiOrderAddSPTable1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'postWMSMultiOrderAddSPTable1'`
  - Select widget 'postWMSMultiOrderAddSPTable1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [2] Unpaginated Table Widget 'stvSPLLInputTable1_1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvSPLLInputTable1_1` 
- **Problem**: Table widget 'stvSPLLInputTable1_1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'stvSPLLInputTable1_1'`
  - Select widget 'stvSPLLInputTable1_1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [3] Unpaginated Table Widget 'viewHoldingsOuterDatatable'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `viewHoldingsOuterDatatable` 
- **Problem**: Table widget 'viewHoldingsOuterDatatable' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'viewHoldingsOuterDatatable'`
  - Select widget 'viewHoldingsOuterDatatable' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [4] Unpaginated Table Widget 'postSolGeneralDetailsTable1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `postSolGeneralDetailsTable1` 
- **Problem**: Table widget 'postSolGeneralDetailsTable1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'postSolGeneralDetailsTable1'`
  - Select widget 'postSolGeneralDetailsTable1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [5] Unpaginated Table Widget 'postSettlementOverviewTable1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `postSettlementOverviewTable1` 
- **Problem**: Table widget 'postSettlementOverviewTable1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'postSettlementOverviewTable1'`
  - Select widget 'postSettlementOverviewTable1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [6] Unpaginated Table Widget 'postHoldingsResponseTable'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `postHoldingsResponseTable` 
- **Problem**: Table widget 'postHoldingsResponseTable' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'postHoldingsResponseTable'`
  - Select widget 'postHoldingsResponseTable' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [7] Unpaginated Table Widget 'stvTestHoldingsTable1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvTestHoldingsTable1` 
- **Problem**: Table widget 'stvTestHoldingsTable1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'stvTestHoldingsTable1'`
  - Select widget 'stvTestHoldingsTable1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [8] Unpaginated Table Widget 'postWMSAvailBalInqTable1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `postWMSAvailBalInqTable1` 
- **Problem**: Table widget 'postWMSAvailBalInqTable1' has Pagination set to 'None' without virtual scrolling. If the bound dataset has many rows, thousands of DOM nodes are rendered at once, freezing the browser.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select Table 'postWMSAvailBalInqTable1'`
  - Select widget 'postWMSAvailBalInqTable1' on the canvas.
  - In the Properties Panel -> find 'Pagination' under Behavior.
  - Change 'Pagination' from 'None' to 'Pager' or 'Basic'.
  - Set 'Page Size' to 15 or 25.

#### [9] Unpaginated List Widget 'stvExcepSuccess'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvExcepSuccess` 
- **Problem**: List widget 'stvExcepSuccess' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvExcepSuccess'`
  - Select 'stvExcepSuccess' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [10] Unpaginated List Widget 'stvPmListList2'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvPmListList2` 
- **Problem**: List widget 'stvPmListList2' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvPmListList2'`
  - Select 'stvPmListList2' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [11] Unpaginated List Widget 'FeeErrorList'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `FeeErrorList` 
- **Problem**: List widget 'FeeErrorList' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'FeeErrorList'`
  - Select 'FeeErrorList' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [12] Unpaginated List Widget 'stvSPLLInputList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvSPLLInputList1` 
- **Problem**: List widget 'stvSPLLInputList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvSPLLInputList1'`
  - Select 'stvSPLLInputList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [13] Unpaginated List Widget 'stvAddDataTableObjectList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvAddDataTableObjectList1` 
- **Problem**: List widget 'stvAddDataTableObjectList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvAddDataTableObjectList1'`
  - Select 'stvAddDataTableObjectList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [14] Unpaginated List Widget 'chkListDtlsList'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `chkListDtlsList` 
- **Problem**: List widget 'chkListDtlsList' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'chkListDtlsList'`
  - Select 'chkListDtlsList' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [15] Unpaginated List Widget 'addtnlDtlsLL1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `addtnlDtlsLL1` 
- **Problem**: List widget 'addtnlDtlsLL1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'addtnlDtlsLL1'`
  - Select 'addtnlDtlsLL1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [16] Unpaginated List Widget 'addtnlDtlsLL'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `addtnlDtlsLL` 
- **Problem**: List widget 'addtnlDtlsLL' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'addtnlDtlsLL'`
  - Select 'addtnlDtlsLL' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [17] Unpaginated List Widget 'stvAddDataTableObjectList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvAddDataTableObjectList1` 
- **Problem**: List widget 'stvAddDataTableObjectList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvAddDataTableObjectList1'`
  - Select 'stvAddDataTableObjectList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [18] Unpaginated List Widget 'list6'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `list6` 
- **Problem**: List widget 'list6' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'list6'`
  - Select 'list6' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [19] Unpaginated List Widget 'list17'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `list17` 
- **Problem**: List widget 'list17' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'list17'`
  - Select 'list17' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [20] Unpaginated List Widget 'stvSPLLInputList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvSPLLInputList1` 
- **Problem**: List widget 'stvSPLLInputList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvSPLLInputList1'`
  - Select 'stvSPLLInputList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [21] Unpaginated List Widget 'PFConfirmModeError'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `PFConfirmModeError` 
- **Problem**: List widget 'PFConfirmModeError' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'PFConfirmModeError'`
  - Select 'PFConfirmModeError' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [22] Unpaginated List Widget 'stvAddDataTableObjectList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvAddDataTableObjectList1` 
- **Problem**: List widget 'stvAddDataTableObjectList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvAddDataTableObjectList1'`
  - Select 'stvAddDataTableObjectList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [23] Unpaginated List Widget 'stvNomineePerList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvNomineePerList1` 
- **Problem**: List widget 'stvNomineePerList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvNomineePerList1'`
  - Select 'stvNomineePerList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [24] Unpaginated List Widget 'stvCifNameList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvCifNameList1` 
- **Problem**: List widget 'stvCifNameList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvCifNameList1'`
  - Select 'stvCifNameList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [25] Unpaginated List Widget 'stvPMSModifyList1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvPMSModifyList1` 
- **Problem**: List widget 'stvPMSModifyList1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvPMSModifyList1'`
  - Select 'stvPMSModifyList1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [26] Unpaginated List Widget 'stvPMSModifyList1_1'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `stvPMSModifyList1_1` 
- **Problem**: List widget 'stvPMSModifyList1_1' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'stvPMSModifyList1_1'`
  - Select 'stvPMSModifyList1_1' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [27] Unpaginated List Widget 'futureErrorDetailsList'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `futureErrorDetailsList` 
- **Problem**: List widget 'futureErrorDetailsList' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'futureErrorDetailsList'`
  - Select 'futureErrorDetailsList' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [28] Unpaginated List Widget 'list3'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `list3` 
- **Problem**: List widget 'list3' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'list3'`
  - Select 'list3' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

#### [29] Unpaginated List Widget 'commonErrorListItem'
- **Target Page**: `pageAddMACEQFU` | **Widget**: `commonErrorListItem` 
- **Problem**: List widget 'commonErrorListItem' has Pagination set to 'None'. Rendering all items simultaneously causes severe scroll lag and memory bloat.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU' -> Select List 'commonErrorListItem'`
  - Select 'commonErrorListItem' on the canvas.
  - In the Properties Panel -> 'Pagination' -> select 'Pager' or 'On Demand'.
  - Or enable 'Virtual Scrolling' (scrollmode="virtual") for continuous smooth scrolling.

### ⚠️ Performance Warnings (Medium Priority)

#### [1] Excessive DOM Hierarchy (Depth: 19)
- **Target Page**: `pageAddMACEQFU`  
- **Problem**: Container elements are nested 19 levels deep on page 'pageAddMACEQFU'. Deep DOM hierarchies slow down style calculation and browser rendering.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio Canvas -> Page 'pageAddMACEQFU'`
  - Open Page 'pageAddMACEQFU' on the Studio canvas.
  - Inspect nested layout containers (wm-layoutgrid -> wm-gridrow -> wm-gridcolumn).
  - Flatten unnecessary wrapper containers by moving child widgets into a single wm-container with flex layout.

#### [2] Page Load Variable Waterfall (29 simultaneous calls)
- **Target Page**: `pageAddMACEQFU`  
- **Problem**: Page 'pageAddMACEQFU' triggers 29 variable calls simultaneously upon page initialization (svAdditionalDetailsSingleAccount, svDividendFetch, svFetchCheckList, svGetCurConvOrdersMF...). This congests the browser's HTTP connection pool.
- **WaveMaker Studio UI Fix**:
  - **Location**: `Studio -> Page 'pageAddMACEQFU' -> Variables Tab`
  - Review the variables configured on Page 'pageAddMACEQFU'.
  - Keep only the critical above-the-fold variable (e.g. user profile / main summary) on page load.
  - For secondary data (tabs, modals, charts), uncheck 'Request data on page load' and invoke them on demand (e.g. on tab select or button click).

### 📋 Page-by-Page Complexity & Risk Matrix

| Page Name | Widgets | Max DOM Depth | Tables/Lists | Variables (Startup/Total) | Leaking Timers |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `pageAddMACEQFU` | 5049 | 19 | 32 | 29 / 239 | 0 |

---

# PART B: BUILD & DEPLOYMENT RESOURCE OPTIMIZATIONS
> **Audience: DevOps, Platform Engineers, and Build Administrators**  
> Resolving the **12 GB RAM compilation bottleneck**, preventing Out-of-Memory (OOM) crashes, and reducing deployment bundle sizes.

### 🛠️ Root Causes of the 12 GB RAM Spike & Automated Patches Applied

| Resource Area | Cause of 12 GB RAM Spike | Auto-Patcher Remediation |
| :--- | :--- | :--- |
| **Terser Minification** | Spawns workers across all CPU cores simultaneously, duplicating ASTs of 10MB+ chunks. | ✅ Capped Terser concurrency to `parallel: 2` in `wm-custom-webpack.config.js` (saves 4-5 GB RAM). |
| **Vendor Source Maps** | Generating full source-maps for node_modules in memory during production build. | ✅ Set `sourceMap.vendor: false` in `angular.json` (saves 3-4 GB RAM). |
| **Unused Global Scripts** | Heavy third-party scripts (D3, Summernote, zTree) loaded globally regardless of usage. | ✅ Pruned unreferenced libraries from `angular.json` scripts. |
| **Node VM Memory Cap** | Studio Maven profile passing `--max-old-space-size=12288`. | ⚙️ **Action**: Reduce `nodeVMArgs` in Studio deployment profile to `--max-old-space-size=3072` (3 GB). |

### 📦 Unused Global Libraries Eligible for Pruning

The following libraries are included in the default bundle but are never used by any page in this project:

- **Summernote RichText Editor** (`summernote/dist/summernote-lite.min.js`): **~220 KB unminified bundle savings**
- **zTree Library** (`@ztree/ztree_v3/js/jquery.ztree.all.js`): **~140 KB unminified bundle savings**


---
*Report generated locally by WaveMaker App Performance & Resource Platform (Zero-LLM, Air-Gapped).*