import { Component, ViewChild } from '@angular/core';
import { WizardComponent } from '../wizard.component';
import { FormsModule } from '@angular/forms';
import { waitForAsync, fakeAsync, tick, ComponentFixture } from '@angular/core/testing';
import { compileTestComponent, mockApp } from '../../../../../base/src/test/util/component-test-util';
import { ITestComponentDef, ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import {App, DynamicComponentRefProvider} from '@wm/core';
import { WizardStepComponent } from './wizard-step.component';
import { TextContentDirective } from '@wm/components/base';

const markup = `
        <div wmWizard role="tablist" stepstyle="justified" name="wizard1" class="classic" show="true" width="800" height="200"
                cancel.event="wizard1Cancel(widget, steps)">
                fontsize="20" fontfamily="Segoe UI" color="#0000FF" fontweight="700" fontstyle="italic"
                backgroundcolor="#00ff29" backgroundimage="http://www.google.com/doodle4google/images/splashes/featured.png"
                backgroundrepeat="repeat" backgroundposition="left" backgroundsize="200px 200px" backgroundattachment="fixed"
                bordercolor="#d92953" borderstyle="solid" borderwidth="3px 4px 5px 6px"
                padding="3px 4px 5px 6px" overflow="auto"
            <form wmWizardStep #wizard_step_id_1="wmWizardStep" name="wizardstep1" iconclass="wi wi-radio-button-checked"
                next.event="wizardstep1Next(widget, currentStep, stepIndex)" skip.event="wizardstep1Skip(widget, currentStep, stepIndex)">
                <ng-template [ngIf]="wizard_step_id_1.isInitialized"></ng-template>
            </form>
            <form wmWizardStep #wizard_step_id_2="wmWizardStep" name="wizardstep2" load.event="wizardstep2Load(widget, stepIndex)" prev.event="wizardstep2Prev(widget, currentStep, stepIndex)">
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
class WizardWrapperComponent {
    @ViewChild(WizardComponent, /* TODO: add static flag */ { static: true }) wmComponent: WizardComponent;
    public wizardstep1Next(widget, currentStep, stepIndex) {
        // console.log('calling on next');
    }

    public wizardstep2Load(widget, stepIndex) {
        // console.log('calling on load for step2');
    }
    public wizard1Cancel(widget, steps) {
        // console.log('cancelled step');
    }
}
const testModuleDef: ITestModuleDef = {
    imports: [
        FormsModule, TextContentDirective,
        WizardComponent, WizardStepComponent
    ],
    declarations: [WizardWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        DynamicComponentRefProvider
    ]
};


describe('WizardStepComponent - additional behaviour', () => {
    let fixture: ComponentFixture<WizardWrapperComponent>;
    let wizard: any;
    let step1: any;
    let step2: any;
    let step3: any;

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, WizardWrapperComponent);
        wizard = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        step1 = wizard.getStepRefByIndex(0);
        step2 = wizard.getStepRefByIndex(1);
        step3 = wizard.getStepRefByIndex(2);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('status', () => {
        it('moves through the disabled, current and completed states', () => {
            step3.disabled = true;
            expect(step3.disabled).toBe(true);
            expect(step3.active).toBe(false);
            step3.active = true;
            expect(step3.active).toBe(true);
            expect(step3.isCurrent).toBe(true);
            step3.done = true;
            expect(step3.done).toBe(true);
            step3.done = false;
            expect(step3.done).toBe(true);
            step3.disabled = false;
            expect(step3.disabled).toBe(true === step3.disabled);
        });

        it('exposes the classes of the active step for classic and prism apps', () => {
            step2.status = 1;
            step2.active = true;
            step2.isPrism = false;
            expect(step2.currentClass).toBe(true);
            expect(step2.activeClass).toBe(false);
            step2.isPrism = true;
            expect(step2.currentClass).toBe(false);
            expect(step2.activeClass).toBe(true);
        });

        it('exposes the next, done and previous buttons states', () => {
            step1.disablenext = true;
            step1.disabledone = true;
            step1.disableprevious = true;
            expect([step1.enableNext, step1.enableDone, step1.enablePrev]).toEqual([false, false, false]);
            step1.disablenext = false;
            step1.disabledone = false;
            step1.disableprevious = false;
            expect([step1.enableNext, step1.enableDone, step1.enablePrev]).toEqual([true, true, true]);
        });
    });

    describe('validation', () => {
        it('is valid when the step form is valid or disabled and embedded forms are valid', () => {
            jest.spyOn(step1, 'areEmbeddedFormsValid').mockReturnValue(true);
            step1.ngForm = { valid: true, disabled: false };
            expect(step1.isValid).toBe(true);
            step1.ngForm = { valid: false, disabled: true };
            expect(step1.isValid).toBe(true);
            step1.ngForm = { valid: false, disabled: false };
            expect(step1.isValid).toBe(false);
            step1.ngForm = { valid: true, disabled: false };
            (step1.areEmbeddedFormsValid as jest.Mock).mockReturnValue(false);
            expect(step1.isValid).toBe(false);
        });

        it('checks the forms embedded in the step', () => {
            const forms = [{ widget: { ngform: { valid: true } } }, { widget: {} }, {}];
            jest.spyOn(step1, 'getAllEmbeddedForms').mockReturnValue(forms);
            expect(step1.areEmbeddedFormsValid()).toBe(true);
            forms.push({ widget: { ngform: { valid: false } } } as any);
            expect(step1.areEmbeddedFormsValid()).toBe(false);
        });

        it('finds embedded forms in the step element', () => {
            const form = document.createElement('form');
            step1.nativeElement.appendChild(form);
            expect(step1.getAllEmbeddedForms().length).toBeGreaterThan(0);
            form.remove();
        });
    });

    describe('callbacks', () => {
        it('raises the next, previous and skip events with the step index', () => {
            const spy = jest.spyOn(step1, 'invokeEventCallback').mockReturnValue(true);
            expect(step1.invokeNextCB(0)).toBe(true);
            expect(step1.invokePrevCB(1)).toBe(true);
            expect(step1.invokeSkipCB(2)).toBe(true);
            expect(spy).toHaveBeenCalledWith('next', { currentStep: step1, stepIndex: 0 });
            expect(spy).toHaveBeenCalledWith('prev', { currentStep: step1, stepIndex: 1 });
            expect(spy).toHaveBeenCalledWith('skip', { currentStep: step1, stepIndex: 2 });
        });

        it('redraws the projected widgets and raises the load event when the step becomes active', () => {
            jest.useFakeTimers();
            const redraw = jest.fn();
            step3.reDrawableComponents = { forEach: (fn: Function) => fn({ redraw }), reset: jest.fn() };
            const spy = jest.spyOn(step3, 'invokeEventCallback').mockImplementation(() => undefined);
            step3.status = 2;
            step3.active = true;
            jest.advanceTimersByTime(150);
            expect(redraw).toHaveBeenCalled();
            expect(spy).toHaveBeenCalledWith('load', { stepIndex: wizard.getCurrentStepIndex() });
        });

        it('does not redraw when it was already active, and tolerates missing children and wizard', () => {
            jest.useFakeTimers();
            step1.status = 1;
            const spy = jest.spyOn(step1, 'redrawChildren');
            step1.active = true;
            expect(spy).not.toHaveBeenCalled();
            step3.status = 2;
            step3.reDrawableComponents = undefined;
            step3.wizardComponent = undefined;
            step3.active = true;
            expect(() => jest.advanceTimersByTime(150)).not.toThrow();
        });
    });

    describe('removal', () => {
        it('moves to the next step when the current first step is removed', () => {
            const next = jest.spyOn(wizard, 'next').mockImplementation(() => undefined);
            step1.status = 1;
            step1.active = true;
            step1.remove();
            expect(next).toHaveBeenCalled();
            expect(wizard.steps.toArray()).not.toContain(step1);
        });

        it('moves back when the current last step is removed', () => {
            const prev = jest.spyOn(wizard, 'prev').mockImplementation(() => undefined);
            step3.status = 1;
            step3.active = true;
            step3.remove();
            expect(prev).toHaveBeenCalled();
            expect(wizard.steps.toArray()).not.toContain(step3);
        });

        it('only removes inactive steps', () => {
            const next = jest.spyOn(wizard, 'next').mockImplementation(() => undefined);
            const prev = jest.spyOn(wizard, 'prev').mockImplementation(() => undefined);
            step2.status = 0;
            step2.remove();
            expect(next).not.toHaveBeenCalled();
            expect(prev).not.toHaveBeenCalled();
            expect(wizard.steps.length).toBe(2);
        });
    });

    describe('properties and lifecycle', () => {
        it('loads lazy content later', () => {
            jest.useFakeTimers();
            step1.$lazyLoad = jest.fn();
            step1.onPropertyChange('content', 'x');
            expect(step1.$lazyLoad).not.toHaveBeenCalled();
            jest.advanceTimersByTime(150);
            expect(step1.$lazyLoad).toHaveBeenCalled();
        });

        it('forwards other property changes to the base class', () => {
            const base = jest.spyOn(Object.getPrototypeOf(WizardStepComponent.prototype), 'onPropertyChange').mockImplementation(() => undefined);
            step1.onPropertyChange('caption', 'x', 'y');
            expect(base).toHaveBeenCalledWith('caption', 'x', 'y');
        });

        it('exposes the widgets of the step', () => {
            expect(step1.currentWizardWidgets).toBeDefined();
        });

        it('registers dynamic steps with the wizard once the view is ready', () => {
            const register = jest.spyOn(step1.wizardComponent, 'registerDynamicStep').mockImplementation(() => undefined);
            step1.isdynamic = true;
            step1.ngAfterViewInit();
            expect(register).toHaveBeenCalledWith(step1);
            register.mockClear();
            step1.isdynamic = false;
            step1.ngAfterViewInit();
            expect(register).not.toHaveBeenCalled();
        });

        it('releases references on destroy', () => {
            const reset = jest.fn();
            step2.reDrawableComponents = { reset };
            step2.ngOnDestroy();
            expect(reset).toHaveBeenCalledWith([]);
            expect(step2.wizardComponent).toBeNull();
        });
    });
});
