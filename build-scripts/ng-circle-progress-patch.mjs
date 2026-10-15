/**
 * ng-circle-progress patching for the UMD (JIT) bundle.
 *
 * ng-circle-progress 1.7.1 is compiled against Angular 14.2.12 and its partial declaration
 * (ɵɵngDeclareComponent) has no `changeDetection` field. The UMD bundle is not run through the
 * Angular linker, so the browser JIT-compiles that declaration — and Angular 22's JIT path
 * (compileComponentDeclaration) defaults a missing `changeDetection` to OnPush regardless of the
 * library's version (the AOT linker only does that for libraries built with Angular >= 22).
 * As OnPush, <circle-progress> never re-renders when its rxjs animation timer assigns `svg`,
 * so it renders as an empty `<circle-progress><!----></circle-progress>`.
 *
 * Fix: pin `changeDetection: Eager` in the declaration, matching the pre-22 behavior.
 */

const DECLARATION = /(i0\.ɵɵngDeclareComponent\(\{[^}]*?type: CircleProgressComponent, )/;

export function ngCircleProgressPatchPlugin() {
    return {
        name: 'ng-circle-progress-patch',
        transform(code, id) {
            if (!id.includes('ng-circle-progress') || !code.includes('ɵɵngDeclareComponent')) {
                return null;
            }
            if (/type: CircleProgressComponent, [^\n]*changeDetection:/.test(code)) {
                return null;
            }
            if (!DECLARATION.test(code)) {
                throw new Error('[ng-circle-progress-patch] CircleProgressComponent declaration not found — '
                    + 'ng-circle-progress output changed, re-check whether the Eager pin is still needed.');
            }
            console.log('  ✅ ng-circle-progress: pinned CircleProgressComponent changeDetection to Eager');
            return {
                code: code.replace(DECLARATION, '$1changeDetection: i0.ChangeDetectionStrategy.Eager, '),
                map: null
            };
        }
    };
}
