# Phase 0 Research: AutoLayout Support for Composite Widget

**Feature**: `003-composite-autolayout` | **Date**: 2026-07-02

All clarifications from `spec.md` are resolved (Prism-only, flex-precedence-over-captionposition,
decorator defaults). No `NEEDS CLARIFICATION` markers remain. The user directive for this plan is:
*"Use existing way of adding autolayout implementation like in wm-container. No new dependencies."*
Research below confirms the reference approach and the exact adaptation for the composite package.

> **Scope note**: Testing is intentionally excluded from this plan per user request. No new tests
> are authored and the existing `composite.directive.spec.ts` is left unmodified; validation is
> manual / in the Prism canvas (see `quickstart.md`).

---

## Decision 1 — Reuse the shared `@AutoLayout` decorator + `AUTO_LAYOUT_PROPS` (mirror `wm-container`)

**Decision**: Apply `@AutoLayout()` (defaults) above the `@Directive` on `CompositeDirective`, and
spread `...AUTO_LAYOUT_PROPS` as the last entries of the `wm-form-group` registration Map — the
same two-touchpoint pattern `wm-container` uses.

**Rationale**:
- `wm-container` (`projects/components/base/src/widgets/common/container/container.directive.ts`)
  is the canonical reference: `@AutoLayout()` on the class, `...AUTO_LAYOUT_PROPS` last in
  `container.props.ts`, `public app?: App` on the constructor.
- The decorator already implements all flex/position/size/overflow/padding behavior and is fully
  Prism-gated, so no per-widget layout code is needed.
- Zero new dependencies: both symbols already ship from `@wm/components/base`
  (`public_api.ts` lines 142–143 export `./decorators/autolayout.decorator` and
  `./decorators/autolayout.props`).

**Alternatives considered**:
- *Hand-rolling layout logic in the composite* — rejected: duplicates decorator logic, violates
  FR-004 (MUST reuse the shared set) and the DRY intent of Principle VI.
- *Adding individual layout props manually to `composite.props.ts`* — rejected: diverges from the
  shared set, risks drift, and FR-004 forbids it.

---

## Decision 2 — Import path: `@wm/components/base` alias (not relative decorator path)

**Decision**: In `composite.directive.ts` import `AutoLayout` from `@wm/components/base`
(extend the existing `@wm/components/base` import line). In `composite.props.ts` import
`AUTO_LAYOUT_PROPS` from `@wm/components/base` (extend the existing import line).

**Rationale**:
- `wm-container` lives *inside* `@wm/components/base`, so it uses relative paths
  (`../../../decorators/autolayout.decorator`). The composite lives in the widget package
  `projects/components/widgets/input/composite`, which already imports `StylableComponent`,
  `styler`, `provideAsWidgetRef`, etc. from the `@wm/components/base` package alias.
- `composite.props.ts` already imports `register`, `PROP_*` from `@wm/components/base`; adding
  `AUTO_LAYOUT_PROPS` there is a one-token extension.

**Alternatives considered**:
- *Relative import into base* — rejected: crosses the package boundary with a fragile relative
  path and is not how sibling widget packages consume base exports.

---

## Decision 3 — Decorator options: defaults `@AutoLayout()` (no `targetSelector`, no `bindParent`)

**Decision**: Use `@AutoLayout()` with no options.

**Rationale** (confirms spec clarification Q3):
- `composite.build.ts` emits a single host `<div wmComposite wmCaptionPosition …>`; the caption and
  input control are **direct children** of that host — there is no inner wrapper element, so the
  host itself is the correct flex/layout target (default behavior). No `targetSelector` needed.
- The composite resolves `bind:` expressions through the standard `inst.viewParent`; it is not
  rendered inside another widget's `*ngFor` scope, so no `bindParent` override is needed.

**Alternatives considered**:
- `targetSelector: '…'` — rejected: no inner layout container exists.
- `bindParent: '…'` — rejected: standard `viewParent` scope applies.

---

## Decision 4 — Constructor gains `private app: App` (decorator gating convention)

**Decision**: Add `private app: App` as a constructor parameter property (immediately after
`inj: Injector`) and ensure `App` is imported from `@wm/core`.

**Rationale**:
- The decorator gates every path on `const app = this['app'] || this['injector']?.get(App)`. The
  repo convention (and `wm-container` / `page-content`) is to expose `App` on the constructor so
  `this.app` resolves directly. The autolayout-runtime skill mandates this (Step 3).
- The composite currently has `constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext)`.
  Insert-only change; do not reorder the existing `explicitContext` param.

**Alternatives considered**:
- *Rely solely on the `injector.get(App)` fallback* — works, but deviates from the mandated
  convention and the `wm-container` reference; rejected for consistency.

---

## Decision 5 — Interaction with `captionposition` and `required` (no reconciliation code)

**Decision**: Do not add any special reconciliation logic. Keep the composite's existing
`onPropertyChange` (handling `captionposition` via `switchClass`, and `required` propagation) exactly
as-is; the decorator wraps it and delegates.

**Rationale**:
- The decorator replaces `proto.onPropertyChange` with a wrapper that records AutoLayout keys into
  its store (Prism-only) and then calls the original composite `onPropertyChange`. Non-layout keys
  (`captionposition`, `required`, `name`, `show`) are untouched by the decorator and fall through to
  the composite's own handler / `super`. → FR-006 preserved.
- Clarification Q2 (flex props override captionposition when explicitly set) is satisfied *for free*:
  when a designer sets `direction`/`alignment`/etc. in Prism, the decorator writes inline flex styles
  to the host `$element`, and inline styles win over the class-based `caption-*` layout. When no
  flex-arrangement props are set, the decorator applies nothing and the `caption-*` classes remain
  authoritative. → SC-005 preserved.
- `required` propagation runs in `ngAfterViewInit`/`onPropertyChange`; the decorator's
  `ngAfterViewInit` override calls the original after its Prism-only work, so propagation is intact.

**Alternatives considered**:
- *Explicitly clearing `caption-*` classes when flex props set* — rejected: unnecessary (inline
  styles already override) and risks regressing default rendering.

---

## Decision 6 — Property-registration overlap (`class`/`conditionalclass`/`conditionalstyle`)

**Decision**: Spread `...AUTO_LAYOUT_PROPS` as the **last** entries of the Map. The composite's own
Map currently declares `captionposition`, `name`, `required`, `show` — none of which overlap
`AUTO_LAYOUT_PROPS`. `class`/`conditionalclass`/`conditionalstyle` come solely from the spread.

**Rationale**:
- Mirrors `wm-container.props.ts`, which lists `class`/`conditionalclass`/`conditionalstyle`
  *before* the spread; because `new Map` keeps the last write, spreading last is the safe,
  deterministic ordering. Since the composite doesn't pre-declare these keys, there is no conflict —
  the deferred registration-order detail from clarify is resolved by the "spread last" rule.

**Alternatives considered**:
- *Spread first* — rejected: any future local key matching an AUTO_LAYOUT key would silently lose;
  spread-last is the repo convention.

---

## Summary of resolved unknowns

| Unknown | Resolution |
|---------|------------|
| How to add AutoLayout | Reuse `@AutoLayout()` decorator + `...AUTO_LAYOUT_PROPS`, mirroring `wm-container` |
| Import path | `@wm/components/base` alias (composite is a widget package) |
| Decorator options | Defaults — no `targetSelector`/`bindParent` |
| App injection | Add `private app: App` after `inj: Injector`; import `App` from `@wm/core` |
| Preserve caption/required | No reconciliation code; decorator delegates to existing handler |
| Prop overlap | Spread `...AUTO_LAYOUT_PROPS` last; no actual key conflict |
| New dependencies | None |
