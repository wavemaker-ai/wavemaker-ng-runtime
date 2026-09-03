---
name: autolayout-runtime
description: Apply the AutoLayout decorator to a widget in this wavemaker-ng-runtime repo so its runtime instance honors Prism flex/position/size styles. Use when the user asks to "add autolayout", "apply autolayout decorator", "make a widget autolayout-aware", or "register autolayout props" on any wm-* widget (container, list, listtemplate, page-content, layoutgrid, tile, form, etc.) inside ng-runtime.
---

# AutoLayout (ng-runtime)

Wires the `@AutoLayout` decorator and `AUTO_LAYOUT_PROPS` into a widget so that — when running inside Prism (`app.isPrism`) — flex/position/size/overflow styles are applied based on the widget's `direction`, `wrap`, `alignment`, `gap`, `columngap`, `position`, `positionvalue`, `zindex`, `clipcontent`, `overflow`, `padding`, `width`, `height`, `backgroundimage`, `conditionalclass`, `conditionalstyle` props.

This skill ONLY edits files inside this `wavemaker-ng-runtime` repo. The matching studio-side change lives in the `autolayout-studio` skill inside the `wavemaker-ng-studio` repo — remind the user to run that separately.

## Accepted prompt forms

The user may refer to a widget by any of these. All resolve to the same thing — normalize internally to the markup tag (`wm-foo`):

| Form           | Example                          | Where it appears                                               |
|----------------|----------------------------------|----------------------------------------------------------------|
| Markup tag     | `wm-form`, `wm-container`        | `*.build.ts` `register(...)`, `*.props.ts` `register(...)`     |
| Directive name | `wmForm`, `wmContainer`          | `@Directive({ selector: '[wmForm]' })`, `*.build.ts` template  |
| File name      | `form.directive.ts`              | filesystem                                                     |
| Class name     | `FormComponent`, `FormDirective` | exported class                                                 |

Treat the markup tag (`wm-foo`) as the canonical identifier. If the user gives any other form, use `Grep` to find the matching `register('wm-…'`) in `*.build.ts` to recover the tag.

## Step 0 — MANDATORY customization gate (do not skip)

**This step is a HARD STOP. You MUST ask the user before making ANY edits or running any other tool calls related to the widget. Do not "use defaults" silently even when they look obvious from `build.ts`. The user explicitly wants the option to customize.**

The ONLY exception: the user's prompt already contains an explicit override (e.g. "use defaults", "with no options", "targetSelector: 'ul'", "bindParent: '…'"). In that case, skip the question and use what they said.

Use `AskQuestion` (preferred). Present this exact pair of questions:

1. **Customize decorator options?**
   - `Use defaults — @AutoLayout()`
   - `Customize`
2. (Only if they pick Customize) **Which option(s)?** allow_multiple = true:
   - `targetSelector — inner element that should receive the layout styles (default: the host element itself)`
   - `bindParent — dot-path on the instance for resolving bind: expressions (default: inst.viewParent)`

If the user picks `targetSelector` or `bindParent`, follow up with a free-text question for the value. Then echo back the resulting decorator call (e.g. `@AutoLayout({ targetSelector: 'ul' })`) and wait for confirmation before continuing.

If `AskQuestion` is unavailable, ask conversationally and WAIT for an answer. Do not proceed.

### Decorator option reference

- `targetSelector?: string` — CSS selector (relative to `nativeElement`) of the inner element that should receive the flex/size/overflow styles. Default: the host `$element`.
  - Use this when the host is a wrapper and the actual layout container is a child (e.g. `<ul>` inside `wm-list`).
- `bindParent?: string` — Dot-path on the instance pointing to the scope used for resolving `bind:` expressions on `position`, `positionvalue`, `conditionalclass`, `conditionalstyle`, `zindex`, `backgroundimage`. Default: `inst.viewParent`.
  - Use this for nested widgets that don't have a direct `viewParent`, e.g. `wm-listtemplate` uses `'listComponent.viewParent'`.

### Reference invocations already in the codebase

```typescript
@AutoLayout()                                              // wm-container
@AutoLayout({ targetSelector: 'ul' })                      // wm-list
@AutoLayout({ bindParent: 'listComponent.viewParent' })    // wm-listtemplate
```

### Examples of correct vs incorrect behaviour

**Wrong** — agent skips the gate:
> User: `apply autolayout on wm-form`
> Agent: *(reads build.ts, sees `<form wmForm>`, immediately edits files with `@AutoLayout()`)*

**Right** — agent stops and asks:
> User: `apply autolayout on wm-form`
> Agent: *(reads build.ts to gather context)* "I see `wm-form` mounts on a `<form>` host. Do you want to use defaults `@AutoLayout()` or customize `targetSelector` / `bindParent`?"
> User: `defaults`
> Agent: *(now proceeds with edits)*

**Right** — user already specified, skip gate:
> User: `apply autolayout on wm-form using defaults`
> Agent: *(proceeds with `@AutoLayout()` directly)*

## Step 1 — Locate the files via `*.build.ts`

For widget `wm-foo`, the `*.build.ts` file in `projects/components/transpile/src/...` is the canonical map between the markup tag and the Angular directive applied to the host element. Use it FIRST to learn:

- the **directive selector** (e.g. `wmForm`, `wmContainer`, `wmList`) — emitted in the `pre` template like `` `<form wmForm ...>` `` or `` `<div wmContainer ...>` ``
- the **host HTML tag** the directive sits on (`form`, `div`, `ul`, etc.) — used to decide a sensible `targetSelector` in Step 0 if the user customizes
- any wrapper elements the build emits AROUND the directive — these never receive the decorator

Procedure:

1. `Glob` for `**/<widget-name>.build.ts` (e.g. `**/form.build.ts`). If multiple match, prefer the one under `projects/components/transpile/src`.
2. `Read` it. Note every `register('wm-…', …)` call — one `*.build.ts` may register more than one tag (e.g. `form.build.ts` registers `wm-form`, `wm-liveform`, `wm-livefilter`, all binding to `wmForm` / `wmLiveForm` / `wmLiveFilter`).
3. From the directive selector, derive the widget folder. Standard layout:
   - Component/Directive: `projects/components/widgets/**/<widget>.{component,directive}.ts` (or `projects/components/base/src/widgets/**/<widget>.{component,directive}.ts` for base widgets like `wm-container`).
   - Props file: same folder, `<widget>.props.ts`.
4. `Glob` for `**/<widget>.{component,directive}.ts` and `**/<widget>.props.ts` to confirm exact paths.

> If the user prompted with the directive name (`wmForm`) or a class/file name, use the build.ts grep to recover the markup tag and continue with that.

### `targetSelector` heuristic from build.ts

| Build emits              | Default decoration                          |
|--------------------------|---------------------------------------------|
| `<form wmForm …>`        | `@AutoLayout()` — host IS the layout target |
| `<div wmContainer …>`    | `@AutoLayout()` — host IS the layout target |
| `<div wmList …>` with `<ul>` rendered inside the component template | `@AutoLayout({ targetSelector: 'ul' })` |
| `<ng-template wmListItem …>` inside a parent component | usually `@AutoLayout()`, with `bindParent` set if the directive lives inside another widget's scope |

If the build wraps the directive in extra divs (e.g. liveform's `formlayout='page'` wrapper), those wrappers are irrelevant — the decorator goes on the class whose selector matches the directive on the inner element.

## Step 2 — Edit the component/directive

Add the import and apply the decorator ABOVE `@Component` / `@Directive`.

**If the file is in `projects/components/base/...`** (uses relative imports):

```typescript
import { AutoLayout } from '../../../decorators/autolayout.decorator';
// adjust the relative path to reach projects/components/base/src/decorators/autolayout.decorator.ts

@AutoLayout(/* options from Step 0 */)
@Directive({ ... })
export class FooDirective extends BaseContainerComponent { ... }
```

**If the file is in `projects/components/widgets/...`** (uses the package alias):

```typescript
import { AutoLayout, /* existing imports */ } from '@wm/components/base';

@AutoLayout(/* options from Step 0 */)
@Component({ ... })
export class FooComponent extends StylableComponent { ... }
```

Prefer extending `AutoLayout` onto an existing import line from `@wm/components/base` rather than adding a new line.

## Step 3 — Ensure `private app: App` is in the constructor (MANDATORY)

The decorator's overrides of `ngAfterViewInit`, `onPropertyChange`, and `onStyleChange` do `const app = this['app'] || this['injector']?.get(App)` to gate every code path on `app.isPrism`. The injector fallback works in most cases, but the canonical convention in this repo is to expose `App` as a parameter property on the constructor so `this.app` is available directly. This skill REQUIRES that the decorated class has `private app: App` on its constructor.

Procedure:

1. `Read` the component/directive file you edited in Step 2.
2. Inspect the constructor signature.
   - If `private app: App` (or `public app: App` / `protected app: App`) is already a parameter, do nothing for this step.
   - Otherwise, add `private app: App` as a constructor parameter property AND make sure `App` is imported from `@wm/core`.
3. Place the `private app: App` parameter immediately after `inj: Injector` (the existing convention — see `page-content.component.ts`). Do NOT reorder other parameters; insert only.
4. Use the `private` modifier (parameter property form). Do NOT add a separate body statement that assigns it to `this.app` — the `private` parameter property does that automatically.
5. If the file already imports anything from `@wm/core`, extend that import to include `App`. Otherwise add a new `import { App } from '@wm/core';` line near the other `@wm/core` import block.

### Pattern to follow (from `page-content.component.ts`)

```typescript
import { App } from '@wm/core';
// ...

constructor(inj: Injector, private app: App, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
    super(inj, WIDGET_CONFIG, explicitContext);
    // ...
}
```

### Before / after (insertion-only) example

Before:

```typescript
import { noop, removeAttr } from '@wm/core';
// ...
constructor(
    inj: Injector,
    @Attribute('heading') public heading,
    @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
) {
    super(inj, WIDGET_CONFIG, explicitContext);
}
```

After:

```typescript
import { App, noop, removeAttr } from '@wm/core';
// ...
constructor(
    inj: Injector,
    private app: App,
    @Attribute('heading') public heading,
    @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
) {
    super(inj, WIDGET_CONFIG, explicitContext);
}
```

### Edge cases

- **Class has no explicit constructor** (rare for widgets): add one that calls `super(inj, WIDGET_CONFIG, explicitContext)` matching the parent class's constructor signature, with `inj: Injector, private app: App, ...` parameters. If the parent's constructor signature is unclear, ask the user before fabricating it.
- **The widget already injects `App` differently** (e.g. via `inject(App)` or via `public app: App` / `protected app: App`): leave it alone — any form that exposes `this.app` satisfies this step.
- **Tests / spec files**: if the constructor signature changes, search `**/<widget>.spec.ts` and update the test instantiation to pass an `App` mock. Use `Grep` to find usages.

## Step 4 — Register AUTO_LAYOUT_PROPS

Edit the widget's `*.props.ts` so the layout props are registered with the framework. Spread `...AUTO_LAYOUT_PROPS` as the LAST entry of the `Map`:

**Base widget props file** (`projects/components/base/...`):

```typescript
import { AUTO_LAYOUT_PROPS } from '../../../decorators/autolayout.props';
import { PROP_ANY, PROP_BOOLEAN, PROP_STRING, register } from '../../framework/widget-props';

export const registerProps = () => {
    register(
        'wm-foo',
        new Map([
            // ...existing props...
            ...AUTO_LAYOUT_PROPS
        ])
    );
};
```

**Widget package props file** (`projects/components/widgets/...`):

```typescript
import { AUTO_LAYOUT_PROPS, /* existing imports */ } from '@wm/components/base';

export const registerProps = () => {
    register(
        'wm-foo',
        new Map([
            // ...existing props...
            ...AUTO_LAYOUT_PROPS
        ])
    );
};
```

Do not duplicate keys already in `AUTO_LAYOUT_PROPS`:

```
direction, wrap, alignment, gap, columngap, clipcontent, position, overflow,
zindex, padding, width, height, positionvalue, class, conditionalclass, conditionalstyle
```

If the props Map already declares one of these (e.g. `width`/`height`), remove the local entry so the AUTO_LAYOUT one wins, OR keep the local one and put it AFTER the spread (last spread/value wins in `new Map`). Confirm the desired behavior with the user when there is a conflict.

## Step 5 — Verify

Run `ReadLints` on both edited files (component/directive AND props). Then:

- Confirm the constructor now declares `private app: App` and `App` is imported from `@wm/core`.
- Open `projects/components/base/src/decorators/autolayout.decorator.ts` if you need to confirm what `targetSelector` / `bindParent` actually do.
- Sanity check that the host CSS class still wins over decorator-applied inline styles for non-Prism mode (the decorator is no-op when `!app.isPrism`).

## Step 6 — Tell the user about studio side

The runtime change alone is not enough. Remind the user:

> Now run the **autolayout-studio** skill inside the `wavemaker-ng-studio` repo on the same widget so the studio decorator + `wm.autolayout` parent + properties-panel handling are wired up.

## Files this skill touches (cheat-sheet)

- Decorator: `projects/components/base/src/decorators/autolayout.decorator.ts` (do not modify; reference only)
- Props constant: `projects/components/base/src/decorators/autolayout.props.ts` (do not modify; reference only)
- Build map: `projects/components/transpile/src/**/<widget>.build.ts` (do not modify; READ for tag → directive resolution)
- Per-widget edits:
  - `<widget>.component.ts` / `<widget>.directive.ts` — add `@AutoLayout(...)` + import + ensure `private app: App` in constructor (Step 3)
  - `<widget>.props.ts` — spread `...AUTO_LAYOUT_PROPS` into the registration Map
