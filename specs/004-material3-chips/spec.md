# Feature Specification: Material 3 Chip Widget Family

**Feature Branch**: `004-material3-chips`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Create a new WaveMaker runtime widget that is the equivalent of Material Design 3 \"chips\". This is SEPARATE from and must NOT modify the existing wm-chips input widget (projects/components/widgets/input/chips/), which is only a multi-select tag input. The new widget must support all four Material 3 chip behaviors in a single widget family, selectable via a \"type\" property: Assist, Filter, Input, and Suggestion chips, plus a set/group container (wm-chipset) for filter selection semantics, common chip capabilities, data-driven mode, events, and keyboard/ARIA accessibility. Testing is a required deliverable."

## Clarifications

### Session 2026-07-03

- Q: How should keyboard focus move between chips within a `wm-chipset`? → A: Roving tabindex + arrow keys — the chip set is a single Tab stop; Arrow Left/Right (or Up/Down) moves focus among chips inside it.
- Q: When a chip set's chips don't fit in the available width, what should happen? → A: Wrap onto multiple lines — the chip set grows vertically as needed.
- Q: Can a filter chip set have zero chips selected (all deselected), or must at least one remain selected? → A: Yes — zero selected is allowed (represents "no filter applied"); the widget does not enforce a minimum.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger a one-off action with an Assist chip (Priority: P1)

An app builder drops a chip onto a page, sets its type to "assist", gives it a label and an
icon, and wires it to an action (e.g. "Add to calendar", "Retry"). At runtime, the end user
taps the chip and the configured action fires immediately, the same way a button would,
without the chip remembering any "on/selected" state afterward.

**Why this priority**: This is the simplest chip behavior and establishes the common chip
shell (label, icon, appearance, disabled state, tap event) that every other chip type builds
on. It is the smallest possible slice that proves the new `wm-chip` widget exists and works,
independently of any grouping or data binding.

**Independent Test**: Place a single `wm-chip` with `type="assist"` on a page, bind an
on-tap handler, and verify the handler fires on click/tap/Enter/Space and that the chip
never shows a persisted "selected" look.

**Acceptance Scenarios**:

1. **Given** an assist chip with a label and leading icon, **When** the user taps or
   presses Enter/Space while it is focused, **Then** the chip's tap action fires exactly
   once per activation and the chip's appearance returns to its resting state immediately
   after.
2. **Given** an assist chip marked disabled, **When** the user attempts to tap or activate
   it via keyboard, **Then** no tap action fires and the chip is skipped in keyboard tab
   order.
3. **Given** an assist chip configured as "outlined" vs "elevated" appearance, **When** the
   chip is rendered, **Then** the two appearances are visually distinguishable while
   exposing identical tap behavior.

---

### User Story 2 - Filter a list with a multi-select Filter chip set (Priority: P2)

An app builder places several chips of type "filter" inside a chip set (e.g. "New",
"On Sale", "In Stock") to let end users narrow down a list or grid. The end user taps any
combination of filter chips; each tapped chip shows a selected/check affordance and stays
selected until tapped again, and any number of chips in the set can be selected at the same
time.

**Why this priority**: Filtering is the most common real-world use of chips and is the
primary reason a set/group container is needed; it introduces stateful, multi-select
behavior on top of the common shell from User Story 1.

**Independent Test**: Place 3+ `wm-chip` elements of `type="filter"` inside a `wm-chipset`,
tap several of them in different combinations, and verify the visually-selected chips
always match the set of chips the widget reports as selected, and that selecting one filter
chip never automatically deselects another. Separately, tab into the set once and use Arrow
keys to move focus between chips, confirming the set is a single Tab stop.

**Acceptance Scenarios**:

1. **Given** a filter chip in its unselected state, **When** the user taps it, **Then** it
   switches to a selected state with a visible check/selected affordance and an
   on-select event fires.
2. **Given** a filter chip already selected, **When** the user taps it again, **Then** it
   returns to unselected, its check affordance disappears, and an on-deselect event fires.
3. **Given** a chip set with multiple filter chips, **When** the user selects several of
   them one after another, **Then** all selected chips remain selected simultaneously
   (multi-select), with no limit imposed by the widget itself.
4. **Given** a disabled filter chip, **When** the user taps it, **Then** its selected state
   does not change and no select/deselect event fires.
5. **Given** a chip set with keyboard focus on one of its chips, **When** the user presses
   an Arrow key, **Then** focus moves to the adjacent chip within the same set without
   requiring an additional Tab press.
6. **Given** a chip set where every filter chip is currently selected, **When** the user
   deselects all of them one by one, **Then** the set reaches a fully deselected (zero
   selected) state without error, representing "no filter applied."

---

### User Story 3 - Remove entries with dismissible Input chips (Priority: P3)

An app builder uses chips of type "input" to represent discrete entries the end user has
already chosen (e.g. selected recipients, applied tags), each shown with an optional
leading avatar/icon and a visible remove/close affordance. The end user clicks the remove
affordance (or activates it via keyboard) to dismiss that entry from the set.

**Why this priority**: This adds a distinct interaction (destructive/removal) and a
distinct affordance (close icon) not present in the first two stories, and is commonly
paired with data-driven rendering.

**Independent Test**: Render 3+ `wm-chip` elements of `type="input"`, activate the remove
affordance on one (by click and separately by keyboard), and verify that chip is removed
from the rendered set while the others remain untouched, and that a cancelable
before-remove event can prevent the removal.

**Acceptance Scenarios**:

1. **Given** an input chip with a visible remove affordance, **When** the user clicks it,
   **Then** the chip is removed from the visible set and a removal event fires.
2. **Given** an input chip with a visible remove affordance, **When** the user gives it
   keyboard focus and activates removal without a pointer, **Then** the same removal
   behavior occurs as with a click.
3. **Given** an app handler that cancels the removal (before-remove returns false),
   **When** the user activates remove, **Then** the chip remains visible and no removal
   event fires.
4. **Given** an input chip configured with a leading avatar/icon, **When** it is rendered,
   **Then** the avatar/icon appears alongside the label and does not interfere with the
   separate remove affordance's own tap target.

---

### User Story 4 - Surface recommendations with Suggestion chips (Priority: P4)

An app builder shows one or more chips of type "suggestion" to recommend an action or
value to the end user (e.g. suggested replies, suggested search terms). The end user taps a
suggestion chip to accept it; depending on configuration, the chip may simply fire a
one-time action (like an assist chip) or may additionally switch to a selected look to
indicate the suggestion was accepted.

**Why this priority**: Suggestion chips reuse behavior already covered by Stories 1 and 2
(tap-to-act, optional selected state) and are the least structurally novel of the four
types, so they are validated last.

**Independent Test**: Render a suggestion chip, tap it, and verify its configured action
fires; for a suggestion chip configured as selectable, verify it also visually toggles a
selected state independent of other suggestion chips in the same set.

**Acceptance Scenarios**:

1. **Given** a suggestion chip not configured as selectable, **When** the user taps it,
   **Then** its tap action fires and the chip's appearance returns to its resting state,
   the same as an assist chip.
2. **Given** a suggestion chip configured as selectable, **When** the user taps it,
   **Then** it switches to a selected state and an on-select event fires, independent of
   any other suggestion chip in the same set.
3. **Given** a disabled suggestion chip, **When** the user taps it, **Then** neither the
   tap action nor any select/deselect event fires.

---

### User Story 5 - Render a chip set from bound data (Priority: P5)

An app builder binds a `wm-chipset` to a dataset (e.g. a list of categories or tags) instead
of hand-authoring each chip, using dataset-driven label and value semantics. One chip is
generated per record, and for filter/suggestion chip sets, the set of currently-selected
records can be read from (and initialized from) the underlying data.

**Why this priority**: Data-driven rendering is a cross-cutting capability layered on top
of the four chip behaviors already validated in Stories 1-4, so it is validated once those
behaviors are proven to work with hand-authored chips.

**Independent Test**: Bind a `wm-chipset` of `type="filter"` to a dataset of 5+ records
using a display field for the label and a value field for identity, verify one chip renders
per record with the correct label, and verify that toggling chips updates a
selected-values output the app can read.

**Acceptance Scenarios**:

1. **Given** a chip set bound to a dataset with a configured display field, **When** the
   data loads, **Then** exactly one chip renders per record showing that record's display
   field as its label.
2. **Given** a data-bound filter chip set, **When** the user selects/deselects chips,
   **Then** the widget exposes the corresponding underlying data value(s) as selected,
   not just the visual state.
3. **Given** a data-bound chip set where a previously-selected record's value is no longer
   present in the dataset, **When** the dataset refreshes, **Then** the widget drops that
   value from its selection without raising an error.

---

### Edge Cases

- What happens when a chip has neither a label nor an icon configured? The chip MUST still
  render a minimum tappable target rather than collapsing to nothing or breaking layout.
- What happens when every chip in a chip set is disabled? The set MUST render with nothing
  focusable or selectable, and MUST NOT raise runtime errors.
- What happens when the last input chip in a set is removed? The chip set MUST render as
  empty without layout errors or leftover placeholder space that looks broken.
- What happens when a chip's `type` is changed at design time after chips already exist
  (e.g. filter to input)? The chip MUST re-render with the new type's affordances and MUST
  drop any state that does not apply to the new type (e.g. a selected flag when switching
  to input).
- What happens in a right-to-left (RTL) locale? Leading/trailing icon and remove-affordance
  positions MUST mirror to match the reading direction.
- What happens when an on-before-* handler (remove, select, deselect) returns false? The
  corresponding default action MUST be cancelled and the chip MUST remain in its prior
  state.
- What happens when a filter/suggestion chip's underlying data value no longer exists in a
  refreshed dataset? Selection state for that value MUST be dropped silently rather than
  causing an error.
- What happens when a chip set's chips do not all fit within the available width? The set
  MUST wrap overflowing chips onto additional lines (growing vertically) rather than
  clipping chips or requiring horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a new chip markup tag (`wm-chip`) and a new chip
  set/group markup tag (`wm-chipset`) that are entirely distinct from, and MUST NOT modify
  any markup, property, event, or behavior of, the existing multi-select tag input widget
  (`wm-chips`).
- **FR-002**: `wm-chip` MUST expose a `type` property with exactly four supported values —
  assist, filter, input, suggestion — and changing this value MUST change the chip's
  interaction model and default accessibility role/state accordingly.
- **FR-003**: Every chip, regardless of type, MUST support: label text, a leading
  icon/avatar, a trailing icon, a disabled state, and a choice of elevated vs. outlined
  appearance.
- **FR-004**: An assist chip MUST behave as a stateless, tappable action: activating it
  (click, tap, or keyboard Enter/Space while focused) MUST fire a tap action and MUST NOT
  produce any persisted "selected" visual state.
- **FR-005**: A filter chip MUST support an independent selected/unselected state that
  toggles on activation, MUST display a distinct selected/check affordance while selected,
  and MUST fire a select event when it becomes selected and a deselect event when it
  becomes unselected.
- **FR-006**: When two or more filter chips are grouped in a `wm-chipset`, the set MUST
  support any number of them being selected at the same time (multi-select), from zero up
  to all chips in the set, and selecting one filter chip MUST NOT force any other filter
  chip in the same set to deselect. The widget MUST NOT enforce a minimum-selected-chip
  count; a fully deselected set (zero selected) is a valid state representing "no filter
  applied."
- **FR-007**: An input chip MUST display a visible remove/close affordance, separate from
  the chip's main tap target, and MUST optionally support a leading avatar/icon.
- **FR-008**: Activating an input chip's remove affordance MUST fire a cancelable
  before-remove notification followed by a remove event and MUST remove the chip from the
  rendered set, unless the before-remove notification cancels the action, in which case the
  chip MUST remain unchanged.
- **FR-009**: A suggestion chip MUST support a single-tap action (equivalent to an assist
  chip) and MUST additionally support an optional selectable mode in which activation also
  toggles a selected state and fires select/deselect events, independent of other
  suggestion chips in the same set.
- **FR-010**: `wm-chipset` MUST be able to render a set of chips from a bound dataset,
  generating one chip per record and driving each chip's label from a configured display
  field and each chip's identity from a configured value field.
- **FR-011**: For data-bound filter and suggestion chip sets, the set of currently selected
  records MUST be readable as underlying data value(s) (not only as visual state), and MUST
  be settable to pre-select chips from existing data.
- **FR-012**: Every chip's primary tap target, and an input chip's remove affordance, MUST
  be independently reachable and operable using keyboard alone, with no functionality that
  requires a pointing device. A `wm-chipset` MUST behave as a single roving-tabindex
  composite control: Tab/Shift+Tab moves focus into or out of the set as one stop, Arrow
  keys move focus among the chips within the set, and Enter/Space (or an equivalent
  dedicated key for an input chip's remove affordance) activates the focused chip/
  affordance. A standalone `wm-chip` used outside a `wm-chipset` MUST be its own Tab stop.
- **FR-013**: Each chip type MUST expose accessibility roles and states appropriate to its
  interaction model (e.g., button semantics for assist/suggestion taps, pressed/checked
  semantics for selected filter/suggestion chips, an accessibly labeled control for the
  input chip's remove affordance) so that assistive technology announces behavior
  consistent with what sighted users see.
- **FR-014**: Setting a chip's disabled state MUST prevent all tap, select/deselect, and
  remove interactions on that chip, and MUST be conveyed to assistive technology (not
  conveyed only through visual styling).
- **FR-015**: Chip and chip-set events MUST follow the platform's before/after event
  convention: an on-tap event for all types; on-select and on-deselect events for filter
  chips and selectable suggestion chips; and on-before-remove and on-remove events for
  input chips; a before-event handler returning false MUST cancel the corresponding
  default action.
- **FR-016**: The feature MUST ship with automated unit tests and markup/wrapper behavior
  tests that exercise every chip type (assist, filter, input, suggestion) and every public
  property and event defined by this specification; these tests MUST pass before the
  feature is considered complete.
- **FR-017**: When a `wm-chipset`'s member chips do not all fit within the available width,
  the set MUST wrap the overflowing chips onto additional lines (the set grows vertically)
  rather than clipping chips or introducing horizontal scrolling.

### Key Entities

- **Chip**: A single `wm-chip` instance. Key attributes: type (assist/filter/input/
  suggestion), label, leading icon/avatar, trailing icon, appearance (elevated/outlined),
  disabled flag, selected flag (where the type supports it), and an underlying data value
  when rendered from a dataset.
- **Chip Set**: A `wm-chipset` instance that groups related chips, coordinates independent
  multi-select state across the filter/suggestion chips it contains, and can optionally be
  bound to a dataset to generate its member chips.
- **Chip Type**: The enumerated behavior mode (assist, filter, input, suggestion) that
  determines a chip's interaction model, available affordances, and default accessibility
  role/state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An app builder can configure any of the four chip behaviors (assist, filter,
  input, suggestion) purely by setting the chip's type and common properties, with no
  custom scripting required to get the type-appropriate default interaction working.
- **SC-002**: In a filter chip set of at least five chips, users can select and deselect any
  combination of chips, and the visually-selected chips match the widget-reported selected
  set with zero mismatches across repeated random toggle sequences.
- **SC-003**: A user relying solely on a keyboard can tab into a chip set, use Arrow keys to
  reach any chip in it, and activate, toggle, or remove that chip, with no interaction that
  requires a mouse or touch input.
- **SC-004**: An accessibility review confirms each of the four chip types announces a role
  and state consistent with its documented interaction model (e.g., button vs.
  checkbox/pressed vs. a labeled removable control).
- **SC-005**: Removing an input chip updates the visible chip set within the same
  interaction, with no page reload or manual refresh required.
- **SC-006**: A data-bound chip set correctly reflects dataset changes (records
  added/removed) in the rendered chips without requiring the app builder to manually
  re-render the set.
- **SC-007**: 100% of the widget family's public properties and events are exercised by
  automated tests, and the full automated test suite passes before the feature is
  considered complete.

## Assumptions

- Visual styling follows Material Design 3 chip guidance (shape, elevation, outline) using
  this project's existing design-token conventions; exact token/CSS values are a
  design/plan-phase decision and are not specified here.
- Filter and suggestion chip sets default to multi-select (more than one chip may be
  selected at once); an exclusive/single-select ("radio-like") mode is out of scope for
  this feature and can be considered as a future enhancement.
- Data-driven selection tracking (readable/settable underlying data values) applies to the
  selectable chip types (filter, suggestion). Assist and input chips may still be rendered
  from a dataset for label/icon content but do not carry a persisted selection data value.
- `wm-chip` can be used standalone (a single hand-authored chip) or as a member of a
  `wm-chipset`; a `wm-chipset` is required only when multi-chip selection coordination or
  dataset binding is needed.
- This feature does not modify, deprecate, or provide a migration path from the existing
  `wm-chips` multi-select tag input widget; the two widgets coexist independently and serve
  different purposes.
