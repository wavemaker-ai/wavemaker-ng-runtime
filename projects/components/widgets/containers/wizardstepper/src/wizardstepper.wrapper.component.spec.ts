import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { waitForAsync, ComponentFixture } from '@angular/core/testing';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardComponent } from '../../wizard/src/wizard.component';
import { WizardStepComponent } from '../../wizard/src/wizard-step/wizard-step.component';
import { WizardStepperComponent } from './wizardstepper.component';

/**
 * Integration spec: a real, explicitly authored `<div wmWizardStepper>` nested inside the
 * WizardComponent (User Story 1). This proves the wizContext handshake resolves through
 * Angular's real injector tree and that the verified runtime click rule (only completed steps
 * navigate) is preserved end-to-end through the new WizardStepperComponent.
 */
const markup = `
        <div wmWizard name="wizard1" class="wizard-number" show="true">
            <div wmWizardStepper name="wizardstepper0" class="wizard-number"></div>
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
class WizardWithWizardStepperWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
}

const testModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, WizardStepperComponent
    ],
    declarations: [WizardWithWizardStepperWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-wizardstepper: nested inside wm-wizard (US1, FR-004/FR-009/FR-018)', () => {
    let wrapperComponent: WizardWithWizardStepperWrapperComponent;
    let wmComponent: WizardComponent;
    let fixture: ComponentFixture<WizardWithWizardStepperWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(testModuleDef, WizardWithWizardStepperWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        wmComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    it('should render exactly one header for the wizard', () => {
        const headers = fixture.nativeElement.querySelectorAll('[wmWizardStepper], div.app-wizardstepper');
        expect(headers.length).toBe(1);
    });

    it('should carry the app-wizard-heading class and role="tab" on a real nested header (FR-016)', () => {
        const header = fixture.nativeElement.querySelector('[wmWizardStepper]');
        expect(header.classList.contains('app-wizard-heading')).toBe(true);
        expect(header.getAttribute('role')).toBe('tab');
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
 * Explicitly authored `<wm-wizardstepper>` markup (mirrors how wm-wizardstep/wm-wizardaction are
 * authored) — the widget must be projected as its own selectable/movable instance, and exactly
 * one header must render (FR-002/FR-018).
 */
const explicitHeaderMarkup = `
        <div wmWizard name="wizard2" class="wizard-number" show="true">
            <div wmWizardStepper name="wizardstepper1" class="wizard-number"></div>
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
class WizardWithExplicitWizardStepperWrapperComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
    @ViewChild(WizardStepperComponent, { static: true }) headerComponent: WizardStepperComponent;
}

const explicitHeaderTestModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent, WizardStepperComponent
    ],
    declarations: [WizardWithExplicitWizardStepperWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};

describe('wm-wizardstepper: explicitly authored as a wizard child (FR-002 selectability)', () => {
    let wmComponent: WizardComponent;
    let headerComponent: WizardStepperComponent;
    let fixture: ComponentFixture<WizardWithExplicitWizardStepperWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(explicitHeaderTestModuleDef, WizardWithExplicitWizardStepperWrapperComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        headerComponent = fixture.componentInstance.headerComponent;
        fixture.detectChanges();
    }));

    it('should resolve the explicit header as the wizard ContentChild', () => {
        expect(wmComponent.explicitHeader).toBe(headerComponent);
    });

    it('should render exactly one header even though one was explicitly authored', () => {
        const headers = fixture.nativeElement.querySelectorAll('[wmWizardStepper]');
        expect(headers.length).toBe(1);
    });

    it('should render the explicit header with its own authored name attribute (selectable/movable identity)', () => {
        const header = fixture.nativeElement.querySelector('[wmWizardStepper]');
        expect(header.getAttribute('name')).toBe('wizardstepper1');
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
