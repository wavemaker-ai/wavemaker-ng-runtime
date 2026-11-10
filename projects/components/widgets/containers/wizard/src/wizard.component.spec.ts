import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { waitForAsync, ComponentFixture } from '@angular/core/testing';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardComponent } from './wizard.component';
import { WizardStepComponent } from './wizard-step/wizard-step.component';
import { WizardStepperComponent } from '../../wizardstepper/src/wizardstepper.component';

/**
 * 003-stepper-header-layout-compat: verifies the `isNestedHeaderVertical` host-class binding
 * (contracts/wizard-header-class-hook.md) — the wizard's own `.app-wizard` host element must
 * reflect a NESTED header's `wizardstepper-vertical` class token, and only a nested header's, without
 * ever mutating the wizard's own authored `class` prop (R7).
 */
const nestedMarkup = `
        <div wmWizard name="wizard3" class="wizard-number" show="true">
            <div wmWizardStepper name="wizardstepper3" class="wizard-number wizardstepper-vertical"></div>
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
        </div>
    `;

@Component({
    standalone: false,
    template: nestedMarkup
})
class WizardWithNestedVerticalHeaderWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
    @ViewChild(WizardStepperComponent, { static: true }) headerComponent: WizardStepperComponent;
}

const nestedTestModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, WizardStepperComponent
    ],
    declarations: [WizardWithNestedVerticalHeaderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-wizard: nested header vertical-class host reflection (US1, FR-001-FR-004/FR-007/FR-009/FR-010)', () => {
    let wmComponent: WizardComponent;
    let headerComponent: WizardStepperComponent;
    let fixture: ComponentFixture<WizardWithNestedVerticalHeaderWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(nestedTestModuleDef, WizardWithNestedVerticalHeaderWrapperComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        headerComponent = fixture.componentInstance.headerComponent;
        fixture.detectChanges();
    }));

    it('should reflect the nested header\'s wizardstepper-vertical class onto the wizard host element', () => {
        expect(wmComponent.nativeElement.classList.contains('wizardstepper-vertical')).toBe(true);
    });

    it('should leave the wizard\'s own authored class prop untouched (R7 public-contract stability)', () => {
        expect(wmComponent.class).toBe('wizard-number');
    });

    it('should remove the host class once the nested header\'s class no longer contains wizardstepper-vertical', () => {
        headerComponent.class = 'wizard-number';
        fixture.detectChanges();

        expect(wmComponent.nativeElement.classList.contains('wizardstepper-vertical')).toBe(false);
        expect(wmComponent.class).toBe('wizard-number');
    });
});

/**
 * Standalone header (US2/T037/T040): the `hasExternalHeader` short-circuit in
 * `isNestedHeaderVertical` must keep the wizard host from ever gaining `wizardstepper-vertical` as a
 * result of ANY header's orientation (FR-005/FR-006).
 */
const standaloneMarkup = `
        <div wmWizardStepper name="header4" wizardname="wizard4" class="wizardstepper-vertical"></div>
        <div wmWizard name="wizard4" class="wizard-number" show="true">
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
        </div>
    `;

@Component({
    standalone: false,
    template: standaloneMarkup
})
class WizardWithStandaloneVerticalHeaderWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
    Widgets: any = {};
}

const standaloneTestModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, WizardStepperComponent
    ],
    declarations: [WizardWithStandaloneVerticalHeaderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-wizard: standalone header never triggers wizard repositioning (US2, FR-005/FR-006)', () => {
    let wmComponent: WizardComponent;
    let fixture: ComponentFixture<WizardWithStandaloneVerticalHeaderWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(standaloneTestModuleDef, WizardWithStandaloneVerticalHeaderWrapperComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('should NOT reflect wizardstepper-vertical onto the wizard host when the associated header is standalone', () => {
        expect(wmComponent.explicitHeader).toBeFalsy();
        expect(wmComponent.nativeElement.classList.contains('wizardstepper-vertical')).toBe(false);
    });
});

/**
 * Nested header that ALSO carries a `wizardname` pointing at its own parent wizard — the shape
 * Studio's own generated markup produces for a nested header (redundant self-reference, kept
 * for robust 002-style association). Before this fix, `hasExternalHeader`'s scan matched this
 * self-reference and misclassified the nested header as standalone, permanently short-circuiting
 * `isNestedHeaderVertical` to false and breaking the vertical grid layout for exactly the nested
 * case FR-001-FR-004 exist to support.
 */
const nestedWithSelfWizardnameMarkup = `
        <div wmWizard name="wizard6" class="wizard-number" show="true">
            <div wmWizardStepper name="wizardstepper6" wizardname="wizard6" class="wizard-number wizardstepper-vertical"></div>
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
        </div>
    `;

@Component({
    standalone: false,
    template: nestedWithSelfWizardnameMarkup
})
class WizardWithNestedSelfReferencingHeaderWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
    Widgets: any = {};
}

const nestedWithSelfWizardnameTestModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, WizardStepperComponent
    ],
    declarations: [WizardWithNestedSelfReferencingHeaderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-wizard: nested header with a self-referencing wizardname is not mistaken for standalone', () => {
    let wmComponent: WizardComponent;
    let fixture: ComponentFixture<WizardWithNestedSelfReferencingHeaderWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(nestedWithSelfWizardnameTestModuleDef, WizardWithNestedSelfReferencingHeaderWrapperComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('should NOT treat the nested header as external just because it also carries a matching wizardname', () => {
        expect(wmComponent.explicitHeader).toBeTruthy();
        expect(wmComponent.hasExternalHeader).toBe(false);
    });

    it('should still reflect wizardstepper-vertical onto the wizard host', () => {
        expect(wmComponent.nativeElement.classList.contains('wizardstepper-vertical')).toBe(true);
    });
});
