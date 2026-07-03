# Phase 1 Data Model: Chip Selection Group Widget (wm-chipset)

**Feature**: `005-chipset-selection-group` | **Date**: 2026-07-03

This feature introduces no persisted/backend data model. The "entities" below are the widget's
property/state contract (in-memory, per widget instance) and the shape of the values it reads
from and writes back to a bound dataset. Everything not explicitly listed as new is inherited
verbatim from `DatasetAwareFormComponent`.

---

## Entity 1 — `ChipsetComponent` widget instance (`wm-chipset`)

Registered via `register('wm-chipset', Map)` + `registerFormWidget(FormWidgetType.CHIPSET,
...)` in `chipset.props.ts`.

### Inherited properties (from `DatasetAwareFormComponent`, reused as-is — FR-005, FR-006, FR-011)

| Property | Type | Meaning |
|----------|------|---------|
| `dataset` | `PROP_ANY` | Bound collection/object the chips are generated from |
| `datafield` | `PROP_STRING` | Field used as each chip's underlying value/identity |
| `displayfield` | `PROP_STRING` | Field used as each chip's label |
| `displayexpression` | `PROP_STRING` | Expression overriding the label |
| `datavalue` | `PROP_ANY` | Selected value(s); scalar in single-select, array in multi-select (shape driven by `multiple`, see State 1) |
| `compareby` | `PROP_STRING` | Field(s) used for object-identity comparison when matching `datavalue` to dataset records |
| `groupby` | `PROP_STRING` | Groups chips under headers (inherited `groupedData` rendering) |
| `orderby` | `PROP_STRING` | Sort order applied to dataset records before chip generation |
| `itemsperrow` | `PROP_STRING` | Layout hint (`xs-N sm-N md-N lg-N`), reused verbatim from radioset/checkboxset's `setListClass` |
| `required` / `readonly` / `disabled` | `PROP_BOOLEAN` | Standard form-widget states (FR-011); semantics unchanged from radioset/checkboxset |
| `name`, `show`, `tabindex`, `usekeys`, `hint` | various | Standard widget-shell properties, unchanged |

### New properties (this feature)

| Property | Type | Default | Meaning | Maps to |
|----------|------|---------|---------|---------|
| `selectionmode` | `PROP_STRING` | `'single'` | `'single'` (radiogroup semantics) or `'multiple'` (group/checkbox semantics); drives `this.multiple` | FR-002, FR-003, FR-004 |
| `disableitem` | `PROP_BOOLEAN` | `false` | Static per-record disable flag (used when no `.bind` expression is supplied) | FR-008 |
| `disableitem.bind` (via `@Attribute('disableitem.bind') binddisableitem`) | attribute | — | Expression evaluated per record (item scope); overrides static `disableitem` when present | FR-008 |
| `appearance` | `PROP_STRING` | `'outlined'` | `'elevated'` \| `'outlined'`; single widget-level chip look, applied to all chips uniformly | FR-009 |
| `displayimagesrc` (+ `.bind` via `binddisplayimagesrc`) | `PROP_STRING` | — | Optional per-chip avatar image; field name/expression resolved per record into `DataSetItem.imgSrc` via the inherited `DatasetAwareFormComponent.initDatasetItems()` pipeline (identical mechanism/property name to `wm-chips`, no new resolution code) | FR-010 |
| `iconclass` | `PROP_STRING` | — | Optional per-chip leading icon; value is a dataset field name resolved per record as `item.dataObject[iconclass]` and rendered via `<wm-app-icon>`, mirroring `wm-switch` | FR-010 |
| `iconurl` | `PROP_STRING` | — | Optional per-chip leading icon/image/SVG; value is a dataset field name resolved per record as `item.dataObject[iconurl]` and rendered via `<wm-app-icon>`, mirroring `wm-switch` | FR-010 |

### New events (this feature)

| Event | Fires when | Cancelable | Maps to |
|-------|-----------|------------|---------|
| `onbeforechange` | Before a user-driven selection change is applied | Yes (`return false` cancels) | FR-014 |
| `onchange` | Whenever `datavalue` changes, from a user tap **or** a programmatic assignment | No | FR-012 |
| `onselect` | A specific chip transitions unselected → selected (user or programmatic) | No | FR-013 |
| `ondeselect` | A specific chip transitions selected → unselected (user or programmatic) | No | FR-013 |

### Invariants

- When `selectionmode === 'single'`: `datavalue` is a scalar (or `undefined`); at most one
  `datasetItems[i].selected === true` at any time (FR-003).
- When `selectionmode === 'multiple'`: `datavalue` is an array (never a bare scalar), and MAY be
  empty (FR-004); any subset of `datasetItems` may have `selected === true` independently.
- Switching `selectionmode` always resets `datavalue` to that mode's empty default
  (`undefined` / `[]`) — never attempts a scalar↔array conversion (spec Clarification 2).
- A chip whose resolved `disableitem` (static or `.bind`-evaluated) is `true` can never
  transition `selected`, regardless of `selectionmode`, and is excluded from the roving-tabindex
  focus order (FR-008, FR-015).
- `appearance` affects only host/chip CSS classes; it has no effect on `datavalue` shape or
  selection behavior (FR-009).
- A chip's leading visual, if any, resolves in priority order: `displayimagesrc`'s resolved
  `imgSrc` (avatar image) takes precedence when present; otherwise `iconclass`/`iconurl` (icon,
  via `<wm-app-icon>`) renders if either resolves for that record; if none of the three resolve,
  the chip renders with no leading visual and is otherwise fully functional — selectable,
  keyboard-navigable, and unaffected in layout (FR-010).

---

## Entity 2 — Chip (rendered per `DataSetItem`, not a separate markup tag)

Each chip is a rendering of one entry from the inherited `datasetItems: DataSetItem[]` array
(already produced by `DatasetAwareFormComponent.initDatasetItems()` — reused as-is). No new
top-level entity/interface is introduced; the following are the *additional* per-item fields
`ChipsetComponent` layers on top of the existing `DataSetItem` shape during rendering:

| Field | Type | Source | Meaning |
|-------|------|--------|---------|
| `key` | inherited | `DataSetItem.key` | Stable per-item identity used by `modelByKey`/roving-tabindex bookkeeping |
| `value` | inherited | `DataSetItem.value` | Underlying record value exposed via `datavalue` |
| `label` | inherited | `DataSetItem.label` | Chip's visible text (from `displayfield`/`displayexpression`) |
| `selected` | inherited | `DataSetItem.selected` | Drives the selected/check affordance (FR-007) |
| `imgSrc` | inherited | `DataSetItem.imgSrc` | Optional per-chip avatar image, populated when `displayimagesrc` is set (identical mechanism to `wm-chips`); renders as a leading `<img>` when present (FR-010) |
| `dataObject` | inherited | `DataSetItem.dataObject` | The raw record; used to resolve `iconclass`/`iconurl` per chip as `dataObject[iconclass]` / `dataObject[iconurl]` (mirrors `wm-switch`) (FR-010) |
| `chipDisabled` | **new**, computed | resolved `disableitem`/`disableitem.bind` for this record | Per-chip disabled state (FR-008); does not mutate the shared `DataSetItem`, computed at render/watch time analogous to `ListItemDirective.disableItem` |
| `isRovingTabStop` | **new**, computed | roving-tabindex controller (Decision 3, research.md) | Whether this chip currently has `tabindex="0"` (exactly one `true` per widget instance at a time, or zero if every chip is disabled) |

---

## State transitions

### State 1 — `selectionmode` switch

```text
selectionmode: 'single' ──user/design-time change──▶ 'multiple'
      │                                                    │
      ▼                                                    ▼
this.multiple = false                              this.multiple = true
datavalue := undefined (cleared)                   datavalue := [] (cleared)
      │                                                    │
      └────────────────▶ re-render chips with new ARIA role
                          (radiogroup → group; radio → checkbox per chip)
                          and new roving-tabindex keyboard model (unchanged mechanism,
                          different activation semantics: exclusive vs. independent toggle)
```

### State 2 — Per-chip selection (single-select)

```text
chip[i] unselected ──tap/Enter/Space (not disabled)──▶ onbeforechange
                                                            │ returns false → no-op, chip stays unselected
                                                            │ returns true/undefined
                                                            ▼
                                          chip[i].selected = true
                                          any previously-selected chip[j].selected = false
                                          datavalue := chip[i].value
                                          ondeselect(chip[j]) [if one existed] → onselect(chip[i]) → onchange
```

### State 3 — Per-chip selection (multi-select)

```text
chip[i] unselected ──tap/Enter/Space (not disabled)──▶ onbeforechange
                                                            │ returns false → no-op
                                                            │ returns true/undefined
                                                            ▼
                                          chip[i].selected = true   (independent of all other chips)
                                          datavalue := [...datavalue, chip[i].value]
                                          onselect(chip[i]) → onchange

chip[i] selected ──tap/Enter/Space (not disabled)──▶ onbeforechange
                                                            │ returns false → no-op
                                                            │ returns true/undefined
                                                            ▼
                                          chip[i].selected = false
                                          datavalue := datavalue.filter(v => v !== chip[i].value)
                                          ondeselect(chip[i]) → onchange
                                          (datavalue MAY become [] — valid, non-error state)
```

### State 4 — Programmatic `datavalue` assignment (either mode)

```text
app sets widget.datavalue = X ──▶ DatasetAwareFormComponent.datavalue setter (inherited, unchanged)
        │
        ▼
selectByValue(X) recomputes datasetItems[*].selected + this._modelByKey
        │
        ▼
ChipsetComponent diffs previous vs. new selected-keys set
        │
        ├─▶ ondeselect(chip) for each key that dropped out
        ├─▶ onselect(chip) for each key that was newly added
        └─▶ onchange (fires unconditionally, inherited from the base setter — Decision 6)

Note: onbeforechange is NOT invoked for this path — before-hooks gate user interaction only,
consistent with every other onBefore* widget in this codebase.
```

### State 5 — Dataset refresh drops a previously-selected value

```text
dataset changes ──▶ initDatasetItems() rebuilds datasetItems ──▶ postDatasetItemsInit()
                                                                        │
                                                                        ▼
                                                        selectByValue(current datavalue)
                                                        (inherited — unchanged): any value with
                                                        no matching record is silently dropped;
                                                        datavalue shrinks accordingly, no error
                                                        (spec Edge Case, FR unaffected — reuses
                                                        existing base-class behavior)
```
