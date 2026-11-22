# Production Bundle Registration (Widget/Library Onboarding)

Every `@wm/*` library under `projects/` (widgets, containers, services) is compiled twice:

1. **As an Angular package**, via `ng-packagr`, into `libraries/<path>/` (ESM/FESM + `.d.ts`). This
   is what `tsconfig.json`'s path mappings (`@wm/...`) resolve to, and what the Angular CLI / Jest
   consume directly.
2. **As a global UMD script**, via a second `rollup` pass over that same `ng-packagr` output, into
   `libraries/<path>/bundles/index.umd.js`. These UMD files are concatenated and minified into the
   single `wm-loader.min.js` served to the runtime app — this is the artifact the *deployed
   application* actually loads in the browser (see `02-architecture.md`).

`ng-packagr`/the Angular CLI/Jest only need path (1). **Path (2) has no automated coverage** — a
library that builds and tests fine can still be silently absent, or silently broken, in the shipped
`wm-loader.min.js`. There is no compiler error for this: broken registration surfaces at runtime, in
the browser, typically as `Cannot read properties of undefined (reading '<SomeExport>')`.

This is a **generic onboarding checklist** — every new `@wm/*` library (widget, container, service)
added under `projects/` must complete all four steps below, regardless of what the library does.

## The four registration points

All four live in `wavemaker-ng-runtime`'s build config, not in the library's own project folder.

### 1. `build.sh` → `ngPackagrBuild` call

Add one line to `buildApp()` invoking `ng-packagr` for the new project:

```sh
ngPackagrBuild <bundle-id> projects/<path/to/project> '@wm/<public-path>'
```

Without this, the library is never compiled at all — every consumer importing `@wm/<public-path>`
fails to resolve it (`TS2307: Cannot find module`).

### 2. `config/rollup.wm-components.config.mjs` → its own UMD entry

Add a rollup input/output pair that turns the `ng-packagr` FESM output into a UMD script:

```js
{
    input: './libraries/<path>/fesm2022/index.mjs',
    external: [ ...rollupExternals ],
    output: {
        file: './libraries/<path>/bundles/index.umd.js',
        format: 'umd',
        name: 'wm.<dotted.path>',
        globals: rollupGlobals
    }
},
```

Without this, `ng-packagr`/Jest/TS all pass, but the library's UMD bundle is never produced —
`build.sh`'s later terser step fails with `ENOENT` trying to read a file that doesn't exist.

### 3. `config/rollup-utils.mjs` → `rollupGlobals` + `rollupExternals`

Add the library's public import path to **both** arrays in this shared file:

```js
// rollupGlobals
'@wm/<public-path>': 'wm.<dotted.path>',   // MUST match the `name:` from step 2 exactly

// rollupExternals
'@wm/<public-path>',
```

This is the step that's easy to skip because **its absence produces no build error, only a build
warning** (`(!) Missing global variable name ... guessing "<somePath>"`) that's easy to read past.
Any *other* library that imports the new one compiles its own UMD bundle against whatever name
rollup guesses (usually a bare, un-namespaced identifier derived from the last path segment) instead
of the real global the new library's own UMD wrapper attaches to (`window.wm.<dotted.path>`, per step
2's `name:`). The mismatch means the consuming bundle's static initializer reads
`window.<guessed-name>.<SomeExport>` — the real thing lives at `window.wm.<dotted.path>.<SomeExport>`
instead. `window.<guessed-name>` is `undefined`, and the app throws
`Cannot read properties of undefined (reading '<SomeExport>')` the moment that consumer's
UMD module evaluates, not at build time.

*(Real existing example of a correctly-wired pair: `projects/components/widgets/navigation/menu` and
`projects/components/widgets/containers/panel`, which imports
`MenuAdapterComponent`/`MenuComponent` from `@wm/components/navigation/menu`. Both are registered in
all four places above, which is why that composition works. Other real multi-library compositions
following the same pattern: `data/table` importing `data/pagination`/`navigation/menu`, and
`data/form` importing `data/list`/`data/table`/`basic/anchor`/`input/button`.)*

### 4. `build.sh` → `bundleWeb()`'s file list, in the right **order**

Add the new UMD file to the big `terser` concatenation list inside `bundleWeb()`:

```sh
./libraries/<path>/bundles/index.umd.js \
```

**Order matters.** These are plain `<script>`-style UMD files concatenated into one file and
executed top-to-bottom on load — there is no module loader resolving dependencies lazily. If library
A imports library B, A's UMD wrapper reads `window.wm.<B's dotted path>` **at script-evaluation
time** (often inside a component's `static { ... }` block, e.g. Angular's declare-component
initializer). If A's line comes before B's line in this list, B's global doesn't exist yet when A
runs, and A throws immediately on page load — even though steps 1–3 above were all done correctly.

**Rule of thumb: place a library's UMD line *after* every other library it imports from, and
*before* every library that imports it.** In the existing file, `navigation/menu`'s line appears
before `containers/panel`'s line, matching panel's dependency on menu.

## Checklist for a new `@wm/*` library

- [ ] `build.sh`: `ngPackagrBuild` line added
- [ ] `config/rollup.wm-components.config.mjs`: UMD input/output entry added, `name:` follows the
      `wm.<dotted.path>` convention
- [ ] `config/rollup-utils.mjs`: entry added to **both** `rollupGlobals` (name matches step 2 exactly)
      and `rollupExternals`
- [ ] `build.sh`: `bundleWeb()` file list updated, positioned after every library it depends on and
      before every library that depends on it
- [ ] Full local verification: `sh build.sh -f` completes with no `ENOENT`/`Cannot find module`
      errors, then load the app in a browser and confirm no console errors — `ng-packagr`/Jest
      passing is **not sufficient** to confirm this feature is complete, since none of steps 2–4 are
      exercised by the Angular CLI or unit tests. See `02-architecture.md` for the full build
      pipeline and `10-constraints.md` for other cross-cutting build constraints.
