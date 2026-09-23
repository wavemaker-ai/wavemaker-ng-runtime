// Patches for ngx-bootstrap 20.0.2 source, applied at build time via a rollup transform hook
// (see config/rollup.ngxBootstrap.config.mjs) so they survive `npm install` without touching
// node_modules permanently.
//
// PATCHES.positioning: PositioningService's constructor calls the bare `takeUntilDestroyed()`
// (from '@angular/core/rxjs-interop') INSIDE an `ngZone.runOutsideAngular(() => {...})` callback.
// `takeUntilDestroyed()` with no explicit DestroyRef relies on an implicit `inject(DestroyRef)`,
// which requires an active Angular injection context. Angular's injection-context tracking does
// not survive the Zone.js task boundary created by `runOutsideAngular`, so the implicit inject()
// throws NG0203 ("inject() must be called from an injection context") at runtime.
//
// Fix: capture DestroyRef via `i0.inject(i0.DestroyRef)` at the top of the constructor — while
// still in a valid injection context — and pass it explicitly to `takeUntilDestroyed(__destroyRef)`.

const PATCHES = {
    positioning: {
        match: /constructor\(ngZone, rendererFactory, platformId\) \{\s*this\.update\$\$ = new Subject\(\);\s*this\.positionElements = new Map\(\);\s*this\.isDisabled = false;\s*if \(isPlatformBrowser\(platformId\)\) \{\s*ngZone\.runOutsideAngular\(\(\) => \{/,
        apply(code) {
            if (!PATCHES.positioning.match.test(code)) {
                return { code, applied: false };
            }
            let patched = code.replace(
                PATCHES.positioning.match,
                `constructor(ngZone, rendererFactory, platformId) {\n` +
                `        this.update$$ = new Subject();\n` +
                `        this.positionElements = new Map();\n` +
                `        this.isDisabled = false;\n` +
                `        const __destroyRef = i0.inject(i0.DestroyRef);\n` +
                `        if (isPlatformBrowser(platformId)) {\n` +
                `            ngZone.runOutsideAngular(() => {`
            );
            patched = patched.replace(
                'this.triggerEvent$.pipe(takeUntilDestroyed()).subscribe(',
                'this.triggerEvent$.pipe(takeUntilDestroyed(__destroyRef)).subscribe('
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
                console.log('  [ngx-bootstrap-patch] PositioningService: injected DestroyRef ahead of runOutsideAngular (NG0203 fix)');
            } else if (code.includes('takeUntilDestroyed()')) {
                console.warn('  [ngx-bootstrap-patch] WARN: positioning source did not match expected shape — patch NOT applied, upstream may have changed. Check for NG0203 at runtime.');
            } else {
                console.log('  [ngx-bootstrap-patch] positioning: already patched or upstream fixed — no-op');
            }
            return { code: patched, map: null };
        }
    };
}
