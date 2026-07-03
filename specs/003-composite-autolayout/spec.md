# Feature Specification: AutoLayout Support for Composite Widget

**Feature Branch**: `003-composite-autolayout`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Add autolayout ability to wm-composite widget using the autolayout decorator."

## Clarifications

### Session 2026-07-02

- Q: When does AutoLayout affect the Composite — design-time (Prism) only, or also at runtime? → A: Design-time (Prism) only; runtime rendering of the generated app is unchanged (all layout effects gated on `app.isPrism`).
- Q: How should flex-arrangement props coexist with the existing `captionposition` behavior? → A: When flex-arrangement props are explicitly set by the designer, they override `captionposition` arrangement; `captionposition` remains authoritative only when no AutoLayout flex-arrangement props are set.
- Q: Decorator configuration — defaults vs custom `targetSelector`/`bindParent`? → A: Defaults, `@AutoLayout()` — the host `div[wmComposite]` is the layout target and binds resolve via the standard `viewParent` (no `targetSelector` or `bindParent`).

## User Scenarios *(mandatory)*

### User Story 1 - Composite arranges its content with flex layout props (Priority: P1)

The Composite widget gains the shared AutoLayout property set so it can act as a flex layout container for its own content. When flex-arrangement properties (direction, wrap, alignment, gap, columngap) are set on the Composite, its inner content (caption and input control) is arranged accordingly.

**Why this priority**: This is the core value of the feature. The whole point of adding AutoLayout to the Composite is to let it expose and honor the flex layout properties (direction, gap, alignment, etc.) that arrange its content, rather than relying on fixed built-in layout.

---

### User Story 2 - Composite is positioned and sized with layout props (Priority: P2)

The Composite widget honors the position/size portion of the AutoLayout property set (position, positionvalue, width, height, padding, overflow, zindex, clipcontent) so it can be placed and sized relative to its parent using the same layout properties as other AutoLayout-aware widgets.

**Why this priority**: Flex arrangement (P1) delivers the primary value first; honoring the position/size props rounds out the widget so it participates in layout the same way other AutoLayout widgets do.

---

### User Story 3 - Existing Composite behavior is preserved (Priority: P1)

Adding AutoLayout to the Composite does not change its existing behavior: caption positioning (`captionposition` toggling `caption-left`/`caption-right`/`caption-top`/`caption-floating`) and propagation of `required` to child input controls continue to work exactly as before, and a Composite with no AutoLayout property values set renders identically to before the feature.

**Why this priority**: The Composite is used to structure form fields across applications. A regression in caption positioning or required propagation would break existing forms, so preserving current behavior is as critical as the new capability itself.

---

### Edge Cases

- What happens when a layout property is unset or left at its default value? The Composite uses its default layout behavior without error, identical to before the feature.
- How does the system handle the Composite's existing `captionposition` behavior (which toggles `caption-left`/`caption-right`/`caption-top`/`caption-floating` classes)? The `captionposition` class switching MUST continue to work when no AutoLayout flex-arrangement props are set. When the designer explicitly sets flex-arrangement props (direction, wrap, alignment, gap, columngap), those take precedence over `captionposition` arrangement (design-time/Prism only).
- How does the system handle the Composite's `required` propagation to child input controls? AutoLayout must not interfere with propagation of the `required` flag to sub-components.
- What happens when a layout property receives an invalid or unsupported value? The widget ignores the invalid value and falls back to its default for that property.
- What happens when an AutoLayout property key overlaps with a property the Composite already declares (e.g. `class`)? The overlap must be resolved so the intended behavior is preserved and no property is silently lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Composite widget MUST opt in to the shared AutoLayout property set (direction, wrap, alignment, gap, columngap, clipcontent, position, overflow, zindex, padding, width, height, positionvalue, class, conditionalclass, conditionalstyle) so it exposes and honors these layout properties.
- **FR-002**: The Composite widget MUST honor the flex-arrangement properties (direction, wrap, alignment, gap, columngap) by applying them to arrange its content.
- **FR-003**: The Composite widget MUST honor the position/size properties (position, positionvalue, width, height, padding, overflow, zindex, clipcontent) by applying them to itself.
- **FR-004**: The Composite widget MUST reuse the shared AutoLayout property set rather than redefining the individual layout properties.
- **FR-005**: Default values for each layout property MUST result in the Composite's existing default appearance, so that opting in without setting any values changes nothing.
- **FR-006**: Integrating AutoLayout MUST NOT remove or regress the Composite's existing `captionposition` class-switching behavior or its `required`-to-subcomponent propagation. When no AutoLayout flex-arrangement props are set, `captionposition` remains authoritative for caption/control arrangement; when the designer explicitly sets flex-arrangement props (direction, wrap, alignment, gap, columngap), those props take precedence over the `captionposition`-driven arrangement (design-time/Prism only). Any overlap between existing props and the AutoLayout property set MUST be resolved so the intended behavior is preserved.
- **FR-007**: AutoLayout MUST target the Composite widget's host element (the `div[wmComposite]` host), consistent with the default decorator configuration.
- **FR-008**: All AutoLayout layout effects on the Composite MUST be gated on `app.isPrism` so they apply only in the design-time (Prism) canvas; runtime rendering in the generated app MUST remain unchanged.

### Key Entities *(include if feature involves data)*

- **AutoLayout Property Set**: The shared, reusable collection of layout attributes (direction, wrap, alignment, gap, columngap, clipcontent, position, overflow, zindex, padding, width, height, positionvalue, class, conditionalclass, conditionalstyle) with types and defaults.
- **Composite Widget**: The `wm-composite` markup widget (registered as `wm-form-group`, mounted on the `div[wmComposite]` host) that opts into the AutoLayout Property Set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Composite widget exposes and honors the full shared AutoLayout property set (all listed layout properties are recognized, not ignored).
- **SC-002**: In the design-time (Prism) canvas, setting flex-arrangement properties (direction, wrap, alignment, gap, columngap) on a Composite arranges its content accordingly.
- **SC-003**: In the design-time (Prism) canvas, setting position/size properties (position, positionvalue, width, height, padding) on a Composite places and sizes it accordingly.
- **SC-004**: A Composite with no AutoLayout property values set renders identically to before the feature (0 visual differences).
- **SC-005**: Existing `captionposition` and `required` behavior on the Composite remains functional after AutoLayout is integrated (0 regressions) when no AutoLayout flex-arrangement props are set; when flex-arrangement props are explicitly set, they take precedence over `captionposition` arrangement.

## Assumptions

- The shared AutoLayout property set (`AUTO_LAYOUT_PROPS`) and the `@AutoLayout` decorator already exist in the runtime and are reused as-is; this feature only wires them into the Composite widget.
- The `@AutoLayout()` decorator is applied with defaults, targeting the widget host element (no custom `targetSelector` or `bindParent`), since the Composite mounts directly on its `div[wmComposite]` host.
- The default value of every layout property is chosen so that an opted-in Composite with no explicit values renders exactly as it did before opting in.
- The Composite widget currently extends the standard stylable/container base and applies container styling; this feature adds only the layout property set on top of that.
- Coordination with the design canvas metadata (studio) so the properties are surfaced in the properties panel is handled separately in the `wavemaker-ng-studio` repo (autolayout-studio skill); this spec covers only the runtime widget behavior.
