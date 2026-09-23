// Patches for ngx-bootstrap source, applied at build time via a rollup transform hook (see
// config/rollup.ngxBootstrap.config.mjs) so they survive `npm install` without touching
// node_modules permanently.
//
// PATCHES.positioning: PositioningService's constructor calls the bare `takeUntilDestroyed()`
// (from '@angular/core/rxjs-interop') INSIDE a Zone.js task boundary. `takeUntilDestroyed()`
// with no explicit DestroyRef relies on an implicit `inject(DestroyRef)`, which requires an
// active Angular injection context. Angular's injection-context tracking does not survive a
// Zone.js task boundary, so the implicit inject() throws NG0203 ("inject() must be called from
// an injection context") at runtime.
//
// Confirmed across two different upstream implementations of the same underlying bug:
//   - ngx-bootstrap 20.0.2: constructor(ngZone, rendererFactory, platformId), boundary is
//     ngZone.runOutsideAngular(() => {...}).
//   - ngx-bootstrap 21.2.2: constructor(rendererFactory, platformId) — ngZone param REMOVED —
//     boundary is runInZoneRootIfPresent(() => {...}) (ngx-bootstrap/utils), which does
//     `zone.root.run(fn)` directly via raw Zone.js instead of through NgZone. Functionally
//     identical hazard (still a Zone.js task boundary), different source shape — the old
//     20.0.2 regex does NOT match 21.2.2's source at all (verified directly against installed
//     node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs, not assumed
//     from the 20.0.2 pattern). Re-check this shape again on every future ngx-bootstrap bump —
//     see patterns/runtime.md §12 for the "don't assume the same regex still matches" precedent.
//
// Fix: capture DestroyRef via `i0.inject(i0.DestroyRef)` at the top of the constructor — while
// still in a valid injection context — and pass it explicitly to `takeUntilDestroyed(__destroyRef)`.

const PATCHES = {
    positioning: {
        // ngx-bootstrap 21.2.2 shape (no ngZone param; runInZoneRootIfPresent wrapper;
        // optional-chained triggerEvent$?.pipe(...)).
        match: /constructor\(rendererFactory, platformId\) \{\s*this\.update\$\$ = new Subject\(\);\s*this\.positionElements = new Map\(\);\s*this\.isDisabled = false;\s*if \(isPlatformBrowser\(platformId\)\) \{[\s\S]*?runInZoneRootIfPresent\(\(\) => \{/,
        apply(code) {
            if (!PATCHES.positioning.match.test(code)) {
                return { code, applied: false };
            }
            let patched = code.replace(
                PATCHES.positioning.match,
                (matched) => {
                    const withDestroyRef = matched.replace(
                        'this.isDisabled = false;',
                        'this.isDisabled = false;\n        const __destroyRef = i0.inject(i0.DestroyRef);'
                    );
                    return withDestroyRef;
                }
            );
            patched = patched.replace(
                'this.triggerEvent$?.pipe(takeUntilDestroyed()).subscribe(',
                'this.triggerEvent$?.pipe(takeUntilDestroyed(__destroyRef)).subscribe('
            );
            const applied = patched !== code;
            return { code: patched, applied };
        }
    }
};

export function ngxBootstrapPatchPlugin() {
    return {
        name: 'ngx-bootstrap-patch',
        transform(code, id) {
            if (!id.includes('ngx-bootstrap-positioning')) {
                return null;
            }
            const { code: patched, applied } = PATCHES.positioning.apply(code);
            if (applied) {
                console.log('  [ngx-bootstrap-patch] PositioningService: injected DestroyRef ahead of runInZoneRootIfPresent (NG0203 fix)');
            } else if (code.includes('takeUntilDestroyed()')) {
                console.warn('  [ngx-bootstrap-patch] WARN: positioning source did not match expected shape — patch NOT applied, upstream may have changed. Check for NG0203 at runtime.');
            } else {
                console.log('  [ngx-bootstrap-patch] positioning: already patched or upstream fixed — no-op');
            }
            return { code: patched, map: null };
        }
    };
}
