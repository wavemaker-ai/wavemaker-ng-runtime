# Feature Specification: Chip Selection Group Widget (wm-chipset)

**Feature Branch**: `005-chipset-selection-group`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Create a new WaveMaker runtime form widget: a chip-styled
selection group that lets users pick from a set of options rendered as Material-style chips.
It is the chip-rendered equivalent of the existing wm-radioset and wm-checkboxset widgets,
and is SEPARATE from and must NOT modify the existing wm-chips input widget
(projects/components/widgets/input/chips/), which is only a multi-select tag input. There are
NO assist/filter/input/suggestion chip types. Instead there is a single widget (proposed tag:
wm-chipset) that renders a group of selectable chips and supports BOTH selection modes via a
selection-mode property: single-select (radio-group semantics, mirroring wm-radioset) and
multi-select (checkbox-group semantics, mirroring wm-checkboxset, including zero selected as a
valid state). The widget reuses the same data-driven contract as wm-radioset/wm-checkboxset
(dataset, datafield, displayfield, displayexpression, datavalue, compareby, groupby, orderby,
itemsperrow) and integrates as a WaveMaker form widget. Per-chip appearance includes label,
selected affordance, disabled state (widget and per-option), elevated vs outlined appearance,
and an optional leading icon/avatar. Events follow onBefore*/onEvent conventions (on-change,
on-select, on-deselect, cancelable before-handlers). The widget is keyboard accessible with
radiogroup/radio or group/checkbox ARIA semantics depending on mode, behaves as a single
roving-tabindex composite control, and wraps chips onto multiple lines on overflow. The
feature must include unit tests (*.spec.ts) and wrapper/markup behavior tests
(*.wrapper.component.spec.ts) covering both selection modes and every public property and
event."

## Clarifications

### Session 2026-07-03

- Q: Per-chip (per-option) disabled state is a new capability beyond wm-radioset/wm-checkboxset. How should it be configured? → A: A boolean expression evaluated per record, mirroring `wm-list`'s `disableitem` property.
- Q: When selection-mode is switched at design time while a datavalue is already set, what should happen to that datavalue? → A: Always clear it to the new mode's empty default (unset scalar / empty collection).
- Q: Do on-change/on-select/on-deselect events fire when datavalue is set programmatically (e.g. pre-selecting on page load), or only for direct user taps? → A: Fire for both programmatic datavalue changes and user taps.
- Q: When keyboard focus is on the first/last chip and the user presses Arrow further in that direction, what should happen? → A: Wrap around to the opposite end (last→first, first→last), per the ARIA APG roving-tabindex pattern.
- Q: Is the elevated-vs-outlined chip appearance a single widget-level setting for all chips, or configurable per chip from bound data? → A: A single widget-level property applied uniformly to all chips.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick exactly one option from a set of chips (Priority: P1)

An app builder drops a chip selection group onto a page, binds it to a dataset of options
(e.g. shipping speed: "Standard", "Express", "Overnight"), and sets its selection mode to
single-select. At runtime, the end user sees one chip rendered per option and taps a chip to
choose it; the previously selected chip (if any) automatically becomes unselected, so exactly
one chip is selected at any time, and the app builder can read or pre-set which option is
chosen through the widget's data value the same way they would with an existing radio-button
group.

**Why this priority**: This is the core value proposition of the widget — a chip-styled
drop-in replacement for `wm-radioset` — and by itself is a usable, demoable, data-driven
single-select control that delivers value with no dependency on multi-select behavior.

**Independent Test**: Bind a chip selection group in single-select mode to a dataset of 4+
records with a display field and a value field, verify one chip renders per record, tap
different chips in sequence, and confirm at every point exactly one chip shows the
selected/check affordance and the widget's underlying data value matches that one record —
never zero, never more than one.

**Acceptance Scenarios**:

1. **Given** a single-select chip group bound to a dataset with no chip pre-selected, **When**
   the user taps any chip, **Then** that chip becomes selected and shows a visible
   selected/check affordance, and the widget's data value updates to that chip's underlying
   record value.
2. **Given** a single-select chip group with one chip already selected, **When** the user taps
   a different chip, **Then** the newly tapped chip becomes selected, the previously selected
   chip's affordance is removed, and exactly one chip is selected at all times (never zero or
   more than one as a direct result of a tap).
3. **Given** a single-select chip group, **When** the user taps the chip that is already
   selected, **Then** the widget's selection and data value are unchanged (tapping the current
   selection does not clear it), matching existing radio-group behavior.
4. **Given** a single-select chip group whose data value is pre-set by the app (e.g. on page
   load) to match one of the dataset records, **When** the widget renders, **Then** the chip
   corresponding to that record appears pre-selected without any user interaction.
5. **Given** a single-select chip group marked required and currently unselected, **When** the
   containing form is validated, **Then** the widget reports itself invalid, exactly as an
   equivalent required `wm-radioset` would.

---

### User Story 2 - Pick any number of options from a set of chips (Priority: P2)

An app builder configures the same widget's selection mode to multi-select instead (e.g. a set
of interest tags: "News", "Sports", "Weather", "Tech"). The end user taps any combination of
chips; each tapped chip toggles its own selected/check affordance independently of the others,
any number of chips (including none) can be selected at the same time, and the app builder can
read or pre-set the full collection of chosen options through the widget's data value.

**Why this priority**: Multi-select is the chip-styled equivalent of `wm-checkboxset` and is
the second half of the widget's core contract; it is independently valuable and testable once
single-select (P1) has proven the shared chip-rendering and data-binding foundation.

**Independent Test**: Bind a chip selection group in multi-select mode to a dataset of 4+
records, tap chips in various combinations (including deselecting all of them), and confirm
the set of visually-selected chips always matches the widget's reported collection of selected
values, with zero, one, or many chips selected at once, and that selecting one chip never
deselects another.

**Acceptance Scenarios**:

1. **Given** a multi-select chip group with no chips selected, **When** the user taps a chip,
   **Then** that chip becomes selected and the widget's data value becomes a collection
   containing that chip's underlying record value.
2. **Given** a multi-select chip group with several chips already selected, **When** the user
   taps an additional unselected chip, **Then** the newly tapped chip also becomes selected
   while all previously selected chips remain selected (no chip is deselected as a side
   effect).
3. **Given** a multi-select chip group with a chip currently selected, **When** the user taps
   that same chip again, **Then** it becomes unselected and is removed from the widget's
   selected-values collection, while other selected chips are unaffected.
4. **Given** a multi-select chip group where the user deselects every currently selected chip
   one by one, **Then** the widget reaches a state with zero chips selected and an empty
   selected-values collection, and this is treated as a valid, non-error state.
5. **Given** a multi-select chip group whose data value is pre-set by the app to a collection
   matching two or more dataset records, **When** the widget renders, **Then** exactly those
   chips appear pre-selected without any user interaction.
6. **Given** a multi-select chip group marked required and currently at zero selected chips,
   **When** the containing form is validated, **Then** the widget reports itself invalid,
   exactly as an equivalent required `wm-checkboxset` would; once at least one chip is
   selected, the widget reports itself valid.

---

### User Story 3 - Use the chip group as a standard form field (Priority: P3)

An app builder places the chip selection group inside a `wm-form` alongside other fields
(text inputs, radio sets, checkbox sets) and relies on it participating in the form's
required/readonly/disabled state management and overall form data value the same way any other
form field does, without writing any special-case script for this widget.

**Why this priority**: Form integration is what makes the widget usable in real applications
rather than a standalone demo control; it depends on the selection behaviors from P1/P2
already existing but is independently verifiable as its own contract.

**Independent Test**: Place a chip group (once in single-select mode, once in multi-select
mode) inside a `wm-form` bound to a form data model, toggle the form's readonly and disabled
states, mark the field required, and submit the form; verify the widget's read/disabled
/required states track the form, its value round-trips into the form's data model on submit,
and required validation blocks submission until satisfied.

**Acceptance Scenarios**:

1. **Given** a chip group inside a form set to readonly, **When** the user attempts to tap any
   chip, **Then** the selection does not change and no selection event fires.
2. **Given** a chip group inside a form set to disabled, **When** the user attempts to tap any
   chip or tab into the widget, **Then** the selection does not change and the widget is
   skipped in the tab order.
3. **Given** a chip group configured with a per-record disable expression that evaluates to
   true for one specific record (while the rest of the widget remains enabled), **When** the
   user attempts to tap that record's chip, **Then** that chip's selection state does not
   change and it is skipped when navigating between chips with the keyboard, while the other
   chips remain fully interactive.
4. **Given** a chip group bound as a field of a form's data model, **When** the user changes
   its selection and the form is submitted, **Then** the submitted form data reflects the
   chip group's current data value (a scalar in single-select mode, a collection in
   multi-select mode).

---

### User Story 4 - Operate and navigate the chip group using only the keyboard (Priority: P4)

An end user who relies on the keyboard (or a screen reader) tabs to the chip group once,
uses the arrow keys to move focus between the chips inside it, and uses Enter/Space to select
or toggle the focused chip — for both single-select and multi-select modes — with the
assistive technology announcing each chip's role and selected state correctly.

**Why this priority**: Accessibility is a hard requirement of the feature but is layered on
top of the selection behaviors already covered by P1-P3; it is validated last because it
depends on the chip rendering and selection logic already being correct.

**Independent Test**: Tab into a chip group once, confirm focus lands on one chip and a second
Tab press moves focus past the entire widget (not chip-by-chip); use Arrow keys to move focus
among the chips within the widget; press Enter/Space on a focused chip and confirm the same
selection behavior as a mouse click/tap; verify with an accessibility inspection tool that
single-select mode exposes radiogroup/radio roles and states while multi-select mode exposes
group/checkbox roles and states.

**Acceptance Scenarios**:

1. **Given** a chip group with keyboard focus outside it, **When** the user presses Tab,
   **Then** focus moves to one chip inside the group as a single Tab stop (not one stop per
   chip).
2. **Given** keyboard focus on one chip inside the group, **When** the user presses an Arrow
   key, **Then** focus moves to the adjacent chip within the same group without an additional
   Tab press; **When** focus is on the first (or last) chip and the user presses the Arrow key
   that continues past that end, **Then** focus wraps around to the last (or first) chip in
   the group.
3. **Given** keyboard focus on a chip, **When** the user presses Enter or Space, **Then** the
   same selection/deselection behavior occurs as tapping that chip with a pointer.
4. **Given** a chip group in single-select mode, **When** inspected with assistive technology,
   **Then** the group exposes radiogroup semantics and each chip exposes radio semantics with
   an accurate checked/unchecked state.
5. **Given** a chip group in multi-select mode, **When** inspected with assistive technology,
   **Then** the group exposes an appropriate grouping semantic and each chip exposes checkbox
   semantics with an accurate checked/unchecked state.
6. **Given** a chip group where every chip is disabled, **When** the user tabs toward it,
   **Then** the group is skipped entirely in the tab order without raising an error.

---

### User Story 5 - React to selection changes via events (Priority: P5)

An app builder wires JavaScript handlers to the chip group's events to run custom logic when
the user's selection changes (e.g. update a live preview) or to veto a selection/deselection
under certain conditions (e.g. block deselecting the last required tag).

**Why this priority**: Event wiring is a cross-cutting capability that app builders layer on
top of the already-working selection behavior; it is validated after the core selection
mechanics (P1-P2) are proven correct.

**Independent Test**: Wire an on-change handler, an on-select handler, an on-deselect handler,
and a before-selection-change handler that returns false; verify on-change fires whenever the
widget's overall data value changes (in both modes) — whether from a user tap or from the app
setting the data value programmatically — on-select/on-deselect fire for the specific chip
being selected/deselected, and that returning false from the before-handler prevents the
underlying selection state from changing.

**Acceptance Scenarios**:

1. **Given** a chip group with an on-change handler wired, **When** the user selects or
   deselects any chip (in either selection mode), **Then** the handler fires exactly once per
   user interaction with the widget's updated data value available to it.
2. **Given** a chip group with on-select and on-deselect handlers wired, **When** the user
   selects a previously-unselected chip, **Then** on-select fires for that chip; **When** the
   user deselects a previously-selected chip, **Then** on-deselect fires for that chip.
3. **Given** a chip group with a before-selection-change handler that returns `false`, **When**
   the user attempts to tap a chip to change the selection, **Then** the chip's selection state
   remains unchanged and no on-change/on-select/on-deselect event fires for that interaction.
4. **Given** a chip group with a before-selection-change handler that returns `true` or nothing,
   **When** the user taps a chip, **Then** the selection proceeds normally and the
   corresponding events fire.
5. **Given** a chip group with an on-change handler wired, **When** the app sets the widget's
   data value programmatically (e.g. pre-selecting chip(s) on page load or updating the value
   from a script), **Then** the on-change (and, for the affected chip(s), on-select/on-deselect)
   event(s) fire the same as they would for an equivalent direct user tap.

---

### Edge Cases

- What happens when the bound dataset is empty? The widget MUST render with no chips and MUST
  NOT raise a runtime error, and (in single-select mode) MUST report no selection.
- What happens when a pre-set data value (single scalar or a collection entry) does not match
  any record currently in the dataset? The widget MUST render with that value's chip simply
  not selected/highlighted, rather than raising an error.
- What happens when a dataset refreshes and a previously-selected record's value is no longer
  present? The widget MUST silently drop that value from its current selection (scalar becomes
  unset in single-select mode; removed from the collection in multi-select mode) without
  raising an error.
- What happens when the widget's `selection-mode` is switched at design time after chips
  already exist and a selection is present? The widget MUST re-render using the new mode's
  interaction model and MUST clear the existing data value to that new mode's empty default
  (an unset scalar for single-select, an empty collection for multi-select) rather than
  attempting to convert or leaving a value of the wrong shape.
- What happens when every chip in the group is disabled (via the widget's overall disabled
  state)? The group MUST be fully skipped in keyboard tab order and MUST NOT respond to
  taps, without raising an error.
- What happens when a chip's label (from `displayfield`/`displayexpression`) resolves to an
  empty or missing value for a given record? The chip MUST still render a minimum tappable
  target rather than collapsing to nothing or breaking the layout of neighboring chips.
- What happens when the chip group's total width exceeds the space available in its container?
  The group MUST wrap the overflowing chips onto additional lines (growing vertically) rather
  than clipping chips or introducing horizontal scrolling.
- What happens when a before-select/before-deselect/before-change handler returns `false`?
  The corresponding default selection change MUST be cancelled and the widget MUST remain in
  its prior selection state.
- What happens when a required multi-select chip group has exactly one chip selected and the
  user deselects it? The widget MUST allow reaching the zero-selected state (it is not
  prevented from becoming empty), but MUST then report itself as failing required validation,
  consistent with existing checkbox-group behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a new, distinct chip selection group markup tag
  (proposed: `wm-chipset`) that renders a group of chip-styled, selectable options. This
  widget MUST be entirely separate from, and MUST NOT modify any markup, property, event, or
  behavior of, the existing multi-select tag input widget (`wm-chips`).
- **FR-002**: The widget MUST expose a selection-mode property with exactly two supported
  values — single-select and multi-select — that determines the widget's selection behavior,
  data value shape, and default accessibility roles.
- **FR-003**: In single-select mode, the widget MUST behave like a chip-styled equivalent of
  the existing radio-group widget: selecting a chip MUST deselect any other currently selected
  chip in the same widget so that at most one chip is selected at a time, and re-tapping the
  already-selected chip MUST NOT clear the selection. The widget's data value in this mode
  MUST be a single scalar value corresponding to the selected chip's underlying record.
- **FR-004**: In multi-select mode, the widget MUST behave like a chip-styled equivalent of
  the existing checkbox-group widget: each chip's selected state MUST toggle independently of
  every other chip in the same widget, any number of chips from zero up to all of them MAY be
  selected simultaneously, and a fully deselected (zero-selected) state MUST be a valid,
  non-error state. The widget's data value in this mode MUST be a collection of the values
  corresponding to all currently selected chips' underlying records.
- **FR-005**: The widget MUST support the same data-driven binding contract as the existing
  radio-group/checkbox-group widgets — a bound dataset, a data field, a display field, a
  display expression, a compare-by field, a group-by field, an order-by field, and an
  items-per-row layout control — rendering exactly one chip per dataset record.
- **FR-006**: The widget's data value MUST be both readable (reflecting the current
  selection(s) as underlying record value(s), not merely visual state) and settable by the
  app (to pre-select chip(s) before the user interacts with the widget), in both selection
  modes.
- **FR-007**: Each chip MUST display label text derived from the configured display field or
  display expression, and MUST show a distinct visible selected/check affordance whenever it
  is the selected chip (single-select mode) or one of the selected chips (multi-select mode).
- **FR-008**: The widget MUST support a widget-level disabled state that prevents all
  selection interaction, and MUST additionally support a per-record disable expression
  (evaluated against each dataset record, mirroring the existing per-record `disableitem`
  pattern used elsewhere in the framework) that disables an individual chip's selection
  interaction while leaving the rest of the widget interactive.
- **FR-009**: The widget MUST support at least two chip appearance styles — elevated and
  outlined — as a single widget-level setting applied uniformly to every chip in the group;
  the two styles MUST be visually distinguishable from one another while exposing identical
  selection behavior.
- **FR-010**: The widget MUST support an optional leading icon or avatar per chip, driven from
  the bound data, without this being a requirement for the chip to render or function.
- **FR-011**: The widget MUST integrate as a WaveMaker form widget: it MUST be usable inside a
  form container, MUST support required/readonly/disabled states with the same semantics as
  the existing radio-group/checkbox-group widgets (required fails validation on an empty
  selection in either mode; readonly/disabled block interaction while preserving the current
  value), and MUST participate in the form's overall data value the same way those widgets do.
- **FR-012**: The widget MUST fire an on-change event whenever its overall selection/data
  value changes, in both selection modes, regardless of whether the change originates from
  direct user interaction or from the app setting the widget's data value programmatically
  (e.g. pre-selection).
- **FR-013**: The widget MUST fire an on-select event when an individual chip becomes selected
  and an on-deselect event when an individual chip becomes unselected, in both selection
  modes and regardless of whether the change originates from user interaction or a
  programmatic data value change.
- **FR-014**: The widget MUST support a cancelable before-handler for selection changes; when
  such a handler returns `false`, the widget MUST cancel the corresponding default selection
  change (no selection state change and no on-change/on-select/on-deselect event for that
  interaction).
- **FR-015**: The widget MUST be fully operable using the keyboard alone: it MUST behave as a
  single roving-tabindex composite control (one Tab stop moves focus into the group; a
  subsequent Tab moves focus out of the entire group), Arrow keys MUST move focus among the
  chips within the group and MUST wrap around (moving past the last chip returns focus to the
  first, and moving past the first chip returns focus to the last), and Enter/Space MUST
  activate the focused chip's selection/deselection.
- **FR-016**: The widget MUST expose accessibility roles and states appropriate to its current
  selection mode: radiogroup/radio semantics (including an accurate checked state per chip) in
  single-select mode, and an appropriate group/checkbox semantics (including an accurate
  checked state per chip) in multi-select mode.
- **FR-017**: Disabled state, at both the widget level and the individual-chip level, MUST be
  conveyed to assistive technology and MUST NOT be conveyed through visual styling alone.
- **FR-018**: When the group's chips do not all fit within the available container width, the
  widget MUST wrap the overflowing chips onto additional lines (the group grows vertically)
  rather than clipping chips or introducing horizontal scrolling.
- **FR-019**: The feature MUST ship with automated Jest unit tests (`*.spec.ts`) and
  markup/wrapper behavior tests (`*.wrapper.component.spec.ts`) that exercise both selection
  modes and every public property and event defined by this specification; these tests MUST
  pass before the feature is considered complete.

### Key Entities

- **Chip Selection Group (`wm-chipset`)**: The overall widget instance. Key attributes:
  selection mode (single-select/multi-select), bound dataset and field configuration
  (datafield, displayfield, displayexpression, compareby, groupby, orderby, itemsperrow), data
  value (scalar or collection depending on mode), required/readonly/disabled state, and chip
  appearance (elevated/outlined).
- **Chip (option)**: A single selectable option rendered within the group, generated from one
  dataset record. Key attributes: label (from displayfield/displayexpression), underlying
  data value, selected state, a per-record disabled flag (resolved from the widget's
  disable expression evaluated against that record), and an optional leading icon/avatar.
- **Selection Mode**: The enumerated behavior mode (single-select, multi-select) that
  determines mutual-exclusivity behavior, the shape of the data value, and the default
  accessibility roles applied to the group and its chips.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An app builder can configure either selection behavior (single-select or
  multi-select) purely by setting the selection-mode property and the shared data-binding
  properties, with no custom scripting required to get correct default selection behavior.
- **SC-002**: In single-select mode with 5+ chips, repeated random taps always leave exactly
  one chip selected, with zero mismatches between the visually-selected chip and the widget's
  reported data value across repeated trials.
- **SC-003**: In multi-select mode with 5+ chips, repeated random taps in any combination
  (including reaching zero selected) always leave the visually-selected chips matching the
  widget's reported selected-values collection exactly, with zero mismatches across repeated
  trials.
- **SC-004**: A user relying solely on a keyboard can tab into a chip group, reach any chip in
  it using Arrow keys, and select/deselect it, with no interaction that requires a mouse or
  touch input, in both selection modes.
- **SC-005**: An accessibility review confirms the widget announces radiogroup/radio semantics
  in single-select mode and group/checkbox semantics in multi-select mode, matching the
  announced behavior of the existing radio-group and checkbox-group widgets respectively.
- **SC-006**: A chip group placed inside a form behaves identically, from the form's
  perspective (value round-trip, required validation, readonly/disabled propagation), to an
  equivalent existing radio-group (single-select mode) or checkbox-group (multi-select mode)
  field.
- **SC-007**: 100% of the widget's public properties and events are exercised by automated
  tests, and the full automated test suite passes before the feature is considered complete.

## Assumptions

- The proposed markup tag name is `wm-chipset`; the exact final tag name is confirmed during
  planning but MUST NOT collide with or alter the existing `wm-chips` widget.
- There is a single widget/markup tag for the chip group; there is no separate per-chip
  markup tag and no assist/filter/input/suggestion chip "type" property — the only mode
  distinction is single-select vs multi-select, mirroring the wm-radioset/wm-checkboxset
  split rather than a Material Design chip-type taxonomy.
- Visual styling (chip shape, elevation, outline treatment) follows this project's existing
  design-token conventions; exact token/CSS values are a design/plan-phase decision and are
  not specified here.
- The widget is a form-participating widget in the same category/family as `wm-radioset` and
  `wm-checkboxset`; exact package/category placement is a plan-phase decision.
- RTL mirroring of any leading icon/avatar follows the same convention already used by
  radioset/checkboxset and other data-driven form widgets in this codebase; no new RTL
  behavior is introduced by this feature.
