import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardComponent } from './wizard.component';
import { WizardStepComponent } from './wizard-step/wizard-step.component';

const markup = `
    <div wmWizard name="wiz" class="classic">
        <form wmWizardStep #s1="wmWizardStep" name="step1"><ng-template [ngIf]="s1.isInitialized"></ng-template></form>
        <form wmWizardStep #s2="wmWizardStep" name="step2"><ng-template [ngIf]="s2.isInitialized"></ng-template></form>
    </div>`;

@Component({ standalone: false, template: markup })
class HostComponent {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TextContentDirective, WizardComponent, WizardStepComponent],
    declarations: [HostComponent],
    providers: [{ provide: App, useValue: mockApp }, DynamicComponentRefProvider]
};

describe('WizardComponent - more', () => {
    let fixture: ComponentFixture<HostComponent>;
    let wizard: WizardComponent;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        wizard = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    afterEach(() => jest.restoreAllMocks());

    it('reports showDoneBtn only on the last step when the step enables done', () => {
        // first step has a next step, so done is hidden
        expect(wizard.showDoneBtn).toBe(false);
        const last: any = wizard.steps.toArray()[1];
        wizard.currentStep = last;
        const enableDone = jest.spyOn(last, 'enableDone', 'get').mockReturnValue(true);
        expect(wizard.showDoneBtn).toBe(true);
        enableDone.mockReturnValue(false);
        expect(wizard.showDoneBtn).toBe(false);
    });

    it('returns false for showDoneBtn when there is no current step', () => {
        wizard.currentStep = undefined as any;
        expect(wizard.showDoneBtn).toBe(false);
    });

    it('always renders the step number span for a default-class wizard', () => {
        expect(wizard.showWizardStepIcons).toBe(false);
        expect(wizard.shouldRenderWizardStepNumberSpan({ isDone: true } as any)).toBe(true);
    });

    it('falls through to rendering the number span when icons are enabled but neither stepper layout matches', () => {
        jest.spyOn(wizard, 'showWizardStepIcons', 'get').mockReturnValue(true);
        expect(wizard.isTabStepperWizard).toBe(false);
        expect(wizard.shouldRenderWizardStepNumberSpan({ isDone: false } as any)).toBe(true);
    });
});
