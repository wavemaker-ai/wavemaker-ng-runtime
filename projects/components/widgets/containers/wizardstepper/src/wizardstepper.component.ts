import {CommonModule} from '@angular/common';
import {
    APPLY_STYLES_TYPE,
    Context,
    IWidgetConfig,
    provideAsWidgetRef,
    StylableComponent,
    styler,
    TextContentDirective,
    WmAppIconComponent
} from '@wm/components/base';
import {ChangeDetectorRef, Component, HostBinding, Inject, Injector, Optional} from '@angular/core';

import {registerProps} from './wizardstepper.props';

const DEFAULT_CLS = 'app-wizardstepper';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-wizardstepper',
    hostClass: DEFAULT_CLS
};

/**
 * Standalone wizard-header widget, extracted from the wizard's inline header.
 *
 * Association seam #1 (nested): an ancestor `WizardComponent` provides a shared `Context`
 * object (`wizContext`) via its own `providers` array. This component injects that SAME
 * token WITHOUT `@Self()` so it resolves the nearest ancestor wizard's context when nested —
 * this mirrors the existing wizard-action seam and avoids a circular package dependency
 * between `@wm/components/containers/wizardstepper` and `@wm/components/containers/wizard`
 * (neither package imports the other's component class).
 *
 * Association seam #2 (standalone-by-reference, 002-stepper-header-widget US2): when there is
 * no ancestor wizard, `wizardname` is resolved against `viewParent.Widgets[wizardname]` — the
 * same page-level widget registry every named widget registers into (see
 * `@wm/components/base`'s `widget-registry.ts`). The wizard's `wizContext` object is read off
 * that resolved instance directly; because this happens in a getter (re-evaluated on every
 * template read), it is immune to component-construction-order races between the header and
 * its wizard — including the wizard's OWN registration into `Widgets` being deliberately
 * deferred to its `ngAfterContentInit` (see `wizard.component.ts`'s `initPromise`). The wizard's
 * own `hasExternalHeader` getter does the mirror-image scan to distinguish an externally-bound
 * header from its own nested one — see `wizard.component.ts` for why that is ALSO a stateless
 * read-time scan rather than an imperative register/unregister call.
 */
@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, WmAppIconComponent],
    selector: 'div[wmWizardStepper]',
    templateUrl: './wizardstepper.component.html',
    providers: [
        provideAsWidgetRef(WizardStepperComponent)
    ],
    exportAs: 'wmWizardStepper'
})
export class WizardStepperComponent extends StylableComponent {
    static initializeProps = registerProps();

    public class;
    public name;
    public show;
    public stepstyle;
    public tabindex;
    public wizardname;

    private readonly nestedWizContext: any;

    constructor(inj: Injector, @Optional() @Inject(Context) contexts: Array<any>, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.SHELL);
        this.nestedWizContext = contexts && contexts[0];
    }

    ngOnInit() {
        super.ngOnInit();
        // Standalone-by-reference (US2): the target wizard's OWN registration into
        // `viewParent.Widgets` (and the `wizContext` properties this component's `steps`/etc.
        // getters read) may be populated via a microtask that resolves strictly AFTER this
        // initial change-detection pass returns (see `wizard.component.ts`'s `initPromise`
        // handling). Force one more check once the JS event loop guarantees that microtask has
        // drained — a `setTimeout` macrotask always runs after ALL pending microtasks — so this
        // renders correctly regardless of whether the host environment automatically re-ticks
        // change detection afterward.
        if (!this.nestedWizContext && this.wizardname) {
            setTimeout(() => {
                const cdr = this.inj.get(ChangeDetectorRef, null);
                if (cdr && !(cdr as any).destroyed) {
                    cdr.detectChanges();
                }
            });
        }
    }

    /**
     * Whether this header is nested inside an ancestor `wm-wizard` (as opposed to a
     * standalone-by-reference header elsewhere on the page, associated only via `wizardname`).
     * Mirrors `wavemaker-react-runtime`'s `WmWizardstepper`, which computes
     * `isNested = !!context` (a React context provided by the ancestor wizard) and applies
     * `app-wizard-heading` only in that case.
     */
    @HostBinding('class.app-wizard-heading')
    get isNested(): boolean {
        return !!this.nestedWizContext;
    }

    /**
     * Legacy accessibility parity: the pre-002 auto-embedded header markup rendered
     * `<div class="app-wizard-heading" role="tab">` for a nested header. A standalone-by-
     * reference header has no such role, since it never was the wizard's own inline markup.
     */
    @HostBinding('attr.role')
    get role(): string | null {
        return this.isNested ? 'tab' : null;
    }

    get wizContext(): any {
        return this.nestedWizContext || this.resolveWizardByName()?.wizContext;
    }

    private resolveWizardByName(): any {
        if (this.nestedWizContext || !this.wizardname) {
            return undefined;
        }
        return (this.viewParent as any)?.Widgets?.[this.wizardname];
    }

    get steps(): any[] {
        return this.wizContext?.steps || [];
    }

    get wizardClass(): string {
        return this.wizContext?.getWizardClass?.() || '';
    }

    // The stepper's own authored stepstyle wins; unset falls back to the wizard's.
    get stepClass(): string {
        if (this.stepstyle) {
            return this.stepstyle === 'justified' ? 'nav-justified' : '';
        }
        return this.wizContext?.getStepClass?.() || '';
    }

    get showWizardStepIcons(): boolean {
        return this.wizContext?.showWizardStepIcons?.() ?? false;
    }

    get isTabStepperWizard(): boolean {
        return this.wizContext?.isTabStepperWizard?.() ?? false;
    }

    onStepClick(event: Event, step: any) {
        this.wizContext?.onHeaderClick?.(event, step);
    }

    onKeyDown(event: KeyboardEvent) {
        this.wizContext?.onHeaderKeyDown?.(event);
    }

    shouldRenderWizardStepNumberSpan(step: any): boolean {
        return this.wizContext?.shouldRenderStepNumberSpan?.(step) ?? true;
    }

    shouldShowPrimaryStepIcon(step: any): boolean {
        return this.wizContext?.shouldShowPrimaryStepIcon?.(step) ?? false;
    }

    hasNonEmptyDoneIconClass(step: any): boolean {
        return this.wizContext?.hasNonEmptyDoneIconClass?.(step) ?? false;
    }

    stepIconClassOrDefault(step: any): string {
        return this.wizContext?.stepIconClassOrDefault?.(step) ?? 'wi wi-person';
    }

    readMoreSubtitle() {
        this.wizContext?.readMoreSubtitle?.();
    }
}
