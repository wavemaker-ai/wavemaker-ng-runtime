import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { waitForAsync, ComponentFixture } from '@angular/core/testing';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardComponent } from '../../wizard/src/wizard.component';
import { WizardStepComponent } from '../../wizard/src/wizard-step/wizard-step.component';
import { StepperHeaderComponent } from './stepperheader.component';

/**
 * Integration spec: the header is auto-embedded by the real, unmodified-markup WizardComponent
 * (User Story 1 — nested, backward-compatible). This proves the wizContext handshake resolves
 * through Angular's real injector tree and that the verified runtime click rule (only completed
 * steps navigate) is preserved end-to-end through the new StepperHeaderComponent.
 */
const markup = `
        <div wmWizard name="wizard1" class="wizard-number" show="true">
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
            <form wmWizardStep #wizard_step_id_2="wmWizardStep" name="wizardstep2">
                <ng-template [ngIf]="wizard_step_id_2.isInitialized"></ng-template>
            </form>
            <form wmWizardStep #wizard_step_id_3="wmWizardStep" name="wizardstep3">
                <ng-template [ngIf]="wizard_step_id_3.isInitialized"></ng-template>
            </form>
        </div>
    `;

@Component({
    standalone: false,
    template: markup
})
class WizardWithStepperHeaderWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
}

const testModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, StepperHeaderComponent
    ],
    declarations: [WizardWithStepperHeaderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-stepperheader: nested inside wm-wizard (US1, FR-004/FR-009/FR-018)', () => {
    let wrapperComponent: WizardWithStepperHeaderWrapperComponent;
    let wmComponent: WizardComponent;
    let fixture: ComponentFixture<WizardWithStepperHeaderWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(testModuleDef, WizardWithStepperHeaderWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        wmComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    it('should render exactly one header for the wizard', () => {
        const headers = fixture.nativeElement.querySelectorAll('[wmStepperHeader], div.app-stepperheader');
        expect(headers.length).toBe(1);
    });

    it('should carry the legacy app-wizard-heading compatibility class when nested', () => {
        const header = fixture.nativeElement.querySelector('[wmStepperHeader]');
        expect(header.classList.contains('app-wizard-heading')).toBe(true);
    });

    it('should render one step indicator per wizard step', () => {
        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items.length).toBe(3);
    });

    it('should NOT navigate the wizard body when clicking a current/upcoming step (not yet completed)', () => {
        const secondItem = fixture.nativeElement.querySelectorAll('li.app-wizard-step')[1];
        const before = wmComponent.currentStep;

        secondItem.click();
        fixture.detectChanges();

        expect(wmComponent.currentStep).toBe(before);
    });

    it('should navigate the wizard body when clicking an already-completed step (verified runtime rule)', async () => {
        // Advance so step 1 becomes completed and step 2 becomes current.
        await wmComponent.next();
        fixture.detectChanges();

        const firstItem = fixture.nativeElement.querySelector('li.app-wizard-step[data-stepid]');
        expect(firstItem.classList.contains('finished')).toBe(true);

        firstItem.click();
        fixture.detectChanges();

        expect(wmComponent.currentStepIndex).toBe(0);
    });

    it('should reflect Next() progress in the header indicator classes (FR-011, action-button sync)', async () => {
        await wmComponent.next();
        fixture.detectChanges();

        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items[0].classList.contains('finished')).toBe(true);
        expect(items[1].classList.contains('active')).toBe(true);
    });
});

/**
 * Explicitly authored `<wm-stepperheader>` markup (mirrors how wm-wizardstep/wm-wizardaction are
 * authored) — the widget must be projected as its own selectable/movable instance, NOT replaced
 * by the auto-embedded fallback, and exactly one header must still render (FR-002/FR-018).
 */
const explicitHeaderMarkup = `
        <div wmWizard name="wizard2" class="wizard-number" show="true">
            <div wmStepperHeader name="stepperheader1" class="wizard-number"></div>
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
            <form wmWizardStep #wizard_step_id_2="wmWizardStep" name="wizardstep2">
                <ng-template [ngIf]="wizard_step_id_2.isInitialized"></ng-template>
            </form>
        </div>
    `;

@Component({
    standalone: false,
    template: explicitHeaderMarkup
})
class WizardWithExplicitStepperHeaderWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
    @ViewChild(StepperHeaderComponent, { static: true }) headerComponent: StepperHeaderComponent;
}

const explicitHeaderTestModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, StepperHeaderComponent
    ],
    declarations: [WizardWithExplicitStepperHeaderWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-stepperheader: explicitly authored as a wizard child (FR-002 selectability)', () => {
    let wmComponent: WizardComponent;
    let headerComponent: StepperHeaderComponent;
    let fixture: ComponentFixture<WizardWithExplicitStepperHeaderWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(explicitHeaderTestModuleDef, WizardWithExplicitStepperHeaderWrapperComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        headerComponent = fixture.componentInstance.headerComponent;
        fixture.detectChanges();
    }));

    it('should resolve the explicit header as the wizard ContentChild (not the auto-embedded fallback)', () => {
        expect(wmComponent.explicitHeader).toBe(headerComponent);
    });

    it('should render exactly one header even though one was explicitly authored', () => {
        const headers = fixture.nativeElement.querySelectorAll('[wmStepperHeader]');
        expect(headers.length).toBe(1);
    });

    it('should render the explicit header with its own authored name attribute (selectable/movable identity)', () => {
        const header = fixture.nativeElement.querySelector('[wmStepperHeader]');
        expect(header.getAttribute('name')).toBe('stepperheader1');
    });

    it('should NOT carry the legacy compatibility class on an explicitly authored header (only the auto-fallback does)', () => {
        const header = fixture.nativeElement.querySelector('[wmStepperHeader]');
        expect(header.classList.contains('app-wizard-heading')).toBe(false);
    });

    it('should still render step indicators and stay in sync with the wizard via the explicit header', () => {
        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items.length).toBe(2);
    });

    it('should navigate the wizard body when clicking an already-completed step via the EXPLICIT header', async () => {
        await wmComponent.next();
        fixture.detectChanges();

        const firstItem = fixture.nativeElement.querySelector('li.app-wizard-step[data-stepid]');
        expect(firstItem.classList.contains('finished')).toBe(true);

        firstItem.click();
        fixture.detectChanges();

        expect(wmComponent.currentStepIndex).toBe(0);
    });

    it('should reflect Next() progress in the EXPLICIT header indicator classes (FR-011)', async () => {
        await wmComponent.next();
        fixture.detectChanges();

        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items[0].classList.contains('finished')).toBe(true);
        expect(items[1].classList.contains('active')).toBe(true);
    });
});
