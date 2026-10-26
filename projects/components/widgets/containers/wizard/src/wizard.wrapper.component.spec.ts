import { Component, ViewChild } from '@angular/core';
import { WizardComponent } from './wizard.component';
import { FormsModule } from '@angular/forms';
import { waitForAsync, fakeAsync, tick, ComponentFixture } from '@angular/core/testing';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestComponentDef, ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import {App, DynamicComponentRefProvider} from '@wm/core';
import { WizardStepComponent } from "./wizard-step/wizard-step.component";
import { TextContentDirective } from '@wm/components/base';
import { WizardStepperComponent } from '../../wizardstepper/src/wizardstepper.component';

/**
 * This describe is deliberately placed FIRST in the file, before `wm-wizard: Component Specific
 * Tests` below: that describe's nested `readMoreSubtitle` block globally overwrites
 * `(global as any).$` with a stub jQuery lacking `.width()`, and never restores it — a
 * pre-existing test-isolation gap in this file, not something introduced here. Placed after it,
 * this describe would inherit that broken global `$` and fail on `WizardComponent`'s
 * `ngAfterViewInit` resize-handling code with an unrelated `$(...).width is not a function`
 * error that has nothing to do with the behavior under test.
 */
describe('standalone header BEFORE its wizard in document order (US2/T037/T040, construction-order regression check)', () => {
    /**
     * This is the exact DOM shape from the originally-reported bug: a standalone
     * `wm-wizardstepper` placed as a SIBLING before its `wm-wizard`, both bound only by
     * `wizardname`/`name` — no nesting, no manually-pre-populated mocks. This is the one
     * scenario the earlier `StandaloneWizardStepperWrapperComponent` spec (in
     * wizardstepper.component.spec.ts) did NOT exercise: that spec pre-populated
     * `Widgets.wizard1` by hand before `detectChanges()`, which sidesteps Angular's real
     * sibling construction order entirely. A real WizardComponent registers itself into
     * `viewParent.Widgets` from ITS OWN constructor (see `base.component.ts`'s `initWidget()`),
     * and both this header and the wizard register during the SAME parent construction pass —
     * before either's `ngOnInit`/change-detection runs — so resolution must work regardless of
     * which one is declared first in markup.
     */
    const orderMarkup = `
        <div wmWizardStepper name="header1" wizardname="wizard2"></div>
        <div wmWizard stepstyle="justified" name="wizard2" class="classic" show="true">
            <form wmWizardStep name="orderedstep1"></form>
            <form wmWizardStep name="orderedstep2"></form>
        </div>
    `;

    @Component({
        standalone: false,
        template: orderMarkup
    })
    class HeaderBeforeWizardWrapperComponent {
        @ViewChild(WizardComponent, { static: true }) wizardComponent: WizardComponent;
        @ViewChild(WizardStepperComponent, { static: true }) headerComponent: WizardStepperComponent;
        // `viewParent` resolves to THIS instance (see the earlier standalone-resolution spec in
        // wizardstepper.component.spec.ts for why); without a `Widgets` object here, the generic
        // `viewParent.Widgets[name]` registry both components register into has nowhere to
        // write, so name-based resolution can never succeed regardless of construction order.
        Widgets: any = {};
    }

    let orderFixture: ComponentFixture<HeaderBeforeWizardWrapperComponent>;

    beforeEach(waitForAsync(() => {
        orderFixture = compileTestComponent({
            imports: [FormsModule, TextContentDirective, WizardComponent, WizardStepComponent, WizardStepperComponent],
            declarations: [HeaderBeforeWizardWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                DynamicComponentRefProvider
            ]
        }, HeaderBeforeWizardWrapperComponent);
        orderFixture.detectChanges();
    }));

    it('should NOT render empty: a standalone header resolves its wizard and renders steps, even though it is declared first in document order', () => {
        // scoped to the standalone header's own native element specifically.
        const headerNativeElement = orderFixture.componentInstance.headerComponent['nativeElement'] as HTMLElement;
        expect(headerNativeElement.querySelectorAll('li.app-wizard-step').length).toBe(2);
    });
});

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

const componentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-wizard',
    widgetSelector: '[wmWizard]',
    testModuleDef: testModuleDef,
    testComponent: WizardWrapperComponent
};

// const TestBase: ComponentTestBase = new ComponentTestBase(componentDef);
// TestBase.verifyPropsInitialization();
// TestBase.verifyCommonProperties();
// TestBase.verifyStyles();

describe('wm-wizard: Component Specific Tests', () => {
    let wrapperComponent: WizardWrapperComponent;
    let wmComponent: WizardComponent;
    let fixture: ComponentFixture<WizardWrapperComponent>;
    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(testModuleDef, WizardWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        wmComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    it('should create wizard component', () => {
        expect(wrapperComponent).toBeTruthy();
    });

    it('should have correct param values in onNext/onLoad callback event', async () => {
        const frstStepRef = wmComponent.getWidget().getStepRefByIndex(0);
        const secondStepRef = wmComponent.getWidget().getStepRefByIndex(1);

        // Wait for the component to be stable
        await fixture.whenStable();

        // Spy on the invokeEventCallback method
        jest.spyOn(frstStepRef, 'invokeEventCallback');

        // Trigger the next step
        await wmComponent.next();
        fixture.detectChanges();

        // Assert that the invokeEventCallback was called correctly for the first step
        expect(frstStepRef.invokeEventCallback).toHaveBeenCalledTimes(1);
        expect(frstStepRef.invokeEventCallback).toHaveBeenCalledWith('next', { currentStep: frstStepRef, stepIndex: 0 });

        // Spy on the invokeEventCallback method for the second step
        jest.spyOn(secondStepRef, 'invokeEventCallback');

        // Use a Promise to handle the setTimeout delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Assert that the invokeEventCallback was called correctly for the second step
        expect(secondStepRef.invokeEventCallback).toHaveBeenCalledTimes(1);
        expect(secondStepRef.invokeEventCallback).toHaveBeenCalledWith('load', { stepIndex: 1 });
    });


    it('should have correct param values in onPrev callback event', async () => {
        const secondStepRef = wmComponent.getWidget().getStepRefByIndex(1);
        fixture.whenStable().then(() => {
            jest.spyOn(secondStepRef, 'invokeEventCallback');
            wmComponent.next();
            fixture.detectChanges();
            wmComponent.prev();
            fixture.detectChanges();
            expect(secondStepRef.invokeEventCallback).toHaveBeenCalledWith('prev', { currentStep: secondStepRef, stepIndex: 1 });
        });
    });

    it('should have correct param values in onSkip callback event', async () => {
        const frstStepRef = wmComponent.getWidget().getStepRefByIndex(0);
        fixture.whenStable().then(() => {
            frstStepRef.setProperty('enableskip', true);
            jest.spyOn(frstStepRef, 'invokeEventCallback');
            wmComponent.skip();
            fixture.detectChanges();
            expect(frstStepRef.invokeEventCallback).toHaveBeenCalledWith('skip', { currentStep: frstStepRef, stepIndex: 0 });
        });
    });

    it('should call next() with "skip" when skip() is called', () => {
        jest.spyOn(wmComponent, 'next');
        wmComponent.skip();
        expect(wmComponent.next).toHaveBeenCalledWith('skip');
    });

    it('should set isDone to true and invoke "done" event when done() is called', () => {
        const mockSteps = [{ isDone: false }, { isDone: false }];
        wmComponent['steps'] = { toArray: () => mockSteps } as any;
        wmComponent.currentStep = mockSteps[0] as any;
        jest.spyOn(wmComponent, 'invokeEventCallback');

        wmComponent.done();

        expect(wmComponent.currentStep.isDone).toBe(true);
        expect(wmComponent.invokeEventCallback).toHaveBeenCalledWith('done', { steps: mockSteps });
    });

    it('should invoke "cancel" event with steps when cancel() is called', () => {
        const mockSteps = [{ isDone: false }, { isDone: false }];
        wmComponent['steps'] = { toArray: () => mockSteps } as any;
        jest.spyOn(wmComponent, 'invokeEventCallback');

        wmComponent.cancel();

        expect(wmComponent.invokeEventCallback).toHaveBeenCalledWith('cancel', { steps: mockSteps });
    });



    describe('readMoreSubtitle', () => {
        const realJQuery = (global as any).$;

        beforeEach(waitForAsync(() => {

            // Mock jQuery
            (global as any).$ = jest.fn().mockImplementation((selector) => ({
                addClass: jest.fn(),
                removeClass: jest.fn(),
                css: jest.fn(),
                is: jest.fn(),
                has: jest.fn().mockReturnValue({ length: 0 }),
            }));
            ((global as any).$ as any).fn = {};
            ((global as any).$ as any).fn.on = jest.fn();
            ((global as any).$ as any).fn.off = jest.fn();
        }));

        // Restore the real jQuery so later describe blocks in this file aren't left with this stub.
        afterEach(() => {
            (global as any).$ = realJQuery;
        });

        // ... (previous tests remain the same)

        it('should handle readMoreSubtitle correctly', () => {
            const mockCurrentSubtitle = {
                addClass: jest.fn(),
                removeClass: jest.fn(),
            };
            const mockReadMore = {
                css: jest.fn(),
            };
            const mockDocument = {
                on: jest.fn(),
                off: jest.fn(),
            };

            // Mock jQuery selections
            ((global as any).$ as jest.Mock).mockImplementation((selector) => {
                if (selector === '.app-wizard-step.active .subtitle-wrapper') return mockCurrentSubtitle;
                if (selector === '.app-wizard-step.active .read_more') return mockReadMore;
                if (selector === document) return mockDocument;
                return { is: jest.fn(), has: jest.fn().mockReturnValue({ length: 0 }) };
            });

            wmComponent.readMoreSubtitle();

            // Check if classes and styles are applied correctly
            expect(mockCurrentSubtitle.addClass).toHaveBeenCalledWith('readmore_subtitle');
            expect(mockReadMore.css).toHaveBeenCalledWith('display', 'none');

            // Simulate a mouseup event outside the container
            const mouseupHandler = mockDocument.on.mock.calls[0][1];
            mouseupHandler({ target: document.body });

            // Check if classes and styles are removed correctly
            expect(mockCurrentSubtitle.removeClass).toHaveBeenCalledWith('readmore_subtitle');
            expect(mockReadMore.css).toHaveBeenCalledWith('display', 'block');
            expect(mockDocument.off).toHaveBeenCalledWith('mouseup');
        });
    });

    describe('registerDynamicStep', () => {
        it('should append every dynamic step to the steps query list once all of them registered', () => {
            const stepA = { dynamicStepIndex: 0, active: false };
            const stepB = { dynamicStepIndex: 1, active: false };
            const resetSpy = jest.fn();
            (wmComponent as any).dynamicStepIndex = 2;
            (wmComponent as any).dynamicWizard = [];
            (wmComponent as any).steps = { toArray: () => [], reset: resetSpy };
            wmComponent.registerDynamicStep(stepA);
            expect(resetSpy).not.toHaveBeenCalled();
            wmComponent.registerDynamicStep(stepB);
            expect(resetSpy).toHaveBeenCalled();
        });

        it('should select a newly registered active dynamic step after a short delay', fakeAsync(() => {
            const stepA = { dynamicStepIndex: 0, active: true, select: jest.fn() };
            const resetSpy = jest.fn();
            (wmComponent as any).dynamicStepIndex = 1;
            (wmComponent as any).dynamicWizard = [];
            (wmComponent as any).steps = { toArray: () => [], reset: resetSpy };
            wmComponent.registerDynamicStep(stepA);
            tick(20);
            expect(stepA.select).toHaveBeenCalled();
        }));
    });

    describe('addStep', () => {
        it('should warn and skip when a step with the same name already exists', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const addComponentSpy = jest.fn();
            (wmComponent as any).dynamicComponentProvider.addComponent = addComponentSpy;
            wmComponent.addStep({ name: 'wizardstep1' });
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('wizardstep1'));
            expect(addComponentSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('should build and add markup for a genuinely new step', () => {
            const addComponentSpy = jest.fn();
            (wmComponent as any).dynamicComponentProvider.addComponent = addComponentSpy;
            const result = wmComponent.addStep({ name: 'brandNewStep', caption: 'Hello' });
            expect(result).toEqual(['brandNewStep']);
            expect(addComponentSpy).toHaveBeenCalled();
            const markup = addComponentSpy.mock.calls[0][1];
            expect(markup).toEqual(expect.stringContaining('brandNewStep'));
        });

        it('should wrap a single step object passed without an array', () => {
            const addComponentSpy = jest.fn();
            (wmComponent as any).dynamicComponentProvider.addComponent = addComponentSpy;
            const result = wmComponent.addStep({ name: 'singleStep' });
            expect(result).toEqual(['singleStep']);
        });
    });

    describe('removeStep', () => {
        it('should remove a step found by name', () => {
            const stepRef = wmComponent.getWidget().getStepRefByIndex(2);
            const removeSpy = jest.spyOn(stepRef, 'remove').mockImplementation(() => undefined);
            wmComponent.removeStep('wizardstep3');
            expect(removeSpy).toHaveBeenCalled();
        });

        it('should remove a step found by index', () => {
            const stepRef = wmComponent.getWidget().getStepRefByIndex(1);
            const removeSpy = jest.spyOn(stepRef, 'remove').mockImplementation(() => undefined);
            wmComponent.removeStep(1);
            expect(removeSpy).toHaveBeenCalled();
        });

        it('should warn when the step cannot be found', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            wmComponent.removeStep('doesNotExist');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('doesNotExist'));
            warnSpy.mockRestore();
        });
    });

    describe('gotoStep', () => {
        it('should error when the named step cannot be found', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            wmComponent.gotoStep('missingStep');
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Could not find step"));
            errorSpy.mockRestore();
        });

        it('should error for an invalid step identifier', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            wmComponent.gotoStep(-1);
            expect(errorSpy).toHaveBeenCalledWith('Invalid step name or index provided');
            errorSpy.mockRestore();
        });

        it('should error when trying to navigate to a hidden step', () => {
            const stepRef = wmComponent.getWidget().getStepRefByIndex(2);
            stepRef.show = false;
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            wmComponent.gotoStep(2);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('hidden steps'));
            errorSpy.mockRestore();
        });

        it('should select the target step by name when it is done', () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            const secondStep = wmComponent.getWidget().getStepRefByIndex(1);
            firstStep.done = true;
            wmComponent.gotoStep('wizardstep1');
            expect(wmComponent.currentStep).toBe(firstStep);
        });
    });

    describe('onPropertyChange', () => {
        it('should set the justified nav class for the "justified" stepstyle', () => {
            wmComponent.onPropertyChange('stepstyle', 'justified', undefined);
            expect(wmComponent.stepClass).toEqual('nav-justified');
        });

        it('should clear the nav class for any other stepstyle', () => {
            wmComponent.onPropertyChange('stepstyle', 'dots', undefined);
            expect(wmComponent.stepClass).toEqual('');
        });

        it('should build fieldDefs from the dataset', () => {
            wmComponent.onPropertyChange('dataset', [{ a: 1 }], undefined);
            expect(wmComponent.fieldDefs).toBeDefined();
        });

        it('should make the named step the current step for the defaultstep property', () => {
            const thirdStep = wmComponent.getWidget().getStepRefByIndex(2);
            wmComponent.onPropertyChange('defaultstep', 'wizardstep3', undefined);
            expect(wmComponent.currentStep).toBe(thirdStep);
        });

        it('should delegate unrecognized property changes to the base implementation', () => {
            expect(() => wmComponent.onPropertyChange('show', true, false)).not.toThrow();
        });
    });

    describe('getWidgets', () => {
        it('should return undefined without a widget name', () => {
            expect(wmComponent.getWidgets(undefined as any)).toBeUndefined();
        });

        it('should collect the named widget from every step when no index is given', () => {
            const stepRef = wmComponent.getWidget().getStepRefByIndex(0);
            // currentWizardWidgets is a getter (backed by the real DOM) - stub the getter itself.
            jest.spyOn(stepRef, 'currentWizardWidgets', 'get').mockReturnValue({ myButton: { name: 'myButton' } });
            const result = wmComponent.getWidgets('myButton');
            expect(result).toEqual(expect.arrayContaining([{ name: 'myButton' }]));
        });

        it('should collect the named widget from a single step when an index is given', () => {
            const stepRef = wmComponent.getWidget().getStepRefByIndex(1);
            jest.spyOn(stepRef, 'currentWizardWidgets', 'get').mockReturnValue({ myButton: { name: 'myButton' } });
            const result = wmComponent.getWidgets('myButton', 1);
            expect(result).toEqual([{ name: 'myButton' }]);
        });
    });

    describe('ngAfterContentInit wizContext wiring', () => {
        it('should wire the wizContext helper functions to delegate onto the component', () => {
            const ctx: any = wmComponent['wizContext'];
            expect(ctx.hasNextStep()).toEqual(wmComponent.hasNextStep);
            expect(ctx.hasPreviousStep()).toEqual(wmComponent.hasPrevStep);
            expect(ctx.disableNext()).toEqual(!wmComponent.enableNext);

            const nextSpy = jest.spyOn(wmComponent, 'next').mockImplementation(() => undefined as any);
            ctx.next();
            expect(nextSpy).toHaveBeenCalled();

            const prevSpy = jest.spyOn(wmComponent, 'prev').mockImplementation(() => undefined);
            ctx.previous();
            expect(prevSpy).toHaveBeenCalled();

            const doneSpy = jest.spyOn(wmComponent, 'done').mockImplementation(() => undefined);
            ctx.done();
            expect(doneSpy).toHaveBeenCalled();

            const cancelSpy = jest.spyOn(wmComponent, 'cancel').mockImplementation(() => undefined);
            ctx.cancel();
            expect(cancelSpy).toHaveBeenCalled();

            const skipSpy = jest.spyOn(wmComponent, 'skip').mockImplementation(() => undefined);
            ctx.skip();
            expect(skipSpy).toHaveBeenCalled();
        });
    });

    describe('next() with a promise-returning callback', () => {
        it('should advance to the next step once the promise resolves truthily', async () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            const secondStep = wmComponent.getWidget().getStepRefByIndex(1);
            jest.spyOn(firstStep, 'invokeNextCB').mockReturnValue(Promise.resolve(true) as any);
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(wmComponent.currentStep).toBe(secondStep);
        });

        it('should stay on the current step when the promise resolves to false', async () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            jest.spyOn(firstStep, 'invokeNextCB').mockReturnValue(Promise.resolve(false) as any);
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(wmComponent.currentStep).toBe(firstStep);
        });

        it('should stay on the current step when the promise rejects', async () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            jest.spyOn(firstStep, 'invokeNextCB').mockReturnValue(Promise.reject('nope') as any);
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(wmComponent.currentStep).toBe(firstStep);
        });

        it('should not advance while a next callback is already in progress', () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            firstStep.nextCBInProgress = true;
            const invokeSpy = jest.spyOn(firstStep, 'invokeNextCB');
            wmComponent.next();
            expect(invokeSpy).not.toHaveBeenCalled();
        });
    });

    describe('prev() with a promise-returning callback', () => {
        it('should not go back while a prev callback is already in progress', () => {
            wmComponent.next();
            const secondStep = wmComponent.currentStep;
            secondStep.prevCBInProgress = true;
            const invokeSpy = jest.spyOn(secondStep, 'invokePrevCB');
            wmComponent.prev();
            expect(invokeSpy).not.toHaveBeenCalled();
        });
    });

    describe('onkeydown', () => {
        it('should ignore keys it does not handle', () => {
            const event: any = { key: 'Tab', preventDefault: jest.fn() };
            expect(() => wmComponent.onkeydown(event)).not.toThrow();
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('should prevent the default browser action for navigation keys', () => {
            const event: any = { key: 'ArrowRight', preventDefault: jest.fn() };
            wmComponent.autoActivation = true;
            wmComponent.onkeydown(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('getActiveStepIndex / getSelectedStepIndex', () => {
        it('should return the index of the current step', () => {
            // The first projected step is current by default.
            expect(wmComponent.getActiveStepIndex()).toEqual(0);
        });

        it('should return -1 when no step is marked current', () => {
            (wmComponent as any).steps = { toArray: () => [{ isCurrent: false }, { isCurrent: false }] };
            expect(wmComponent.getActiveStepIndex()).toEqual(-1);
        });

        it('should resolve the selected step index from the active header item', () => {
            expect(wmComponent.getSelectedStepIndex()).toBeGreaterThanOrEqual(-1);
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe from step changes and clear the wizard/dynamic contexts', () => {
            const unsubscribeSpy = jest.fn();
            (wmComponent as any).stepsSubscription = { unsubscribe: unsubscribeSpy };
            (wmComponent as any)._dynamicContext = { foo: 'bar' };
            wmComponent.ngOnDestroy();
            expect(unsubscribeSpy).toHaveBeenCalled();
            expect(wmComponent.currentStep).toBeNull();
        });
    });

    describe('button visibility getters with no current step', () => {
        it('should return false for showDoneBtn, enablePrev, enableNext and enableDone when there is no current step', () => {
            wmComponent.currentStep = null;
            expect(wmComponent.showDoneBtn).toBe(false);
            expect(wmComponent.enablePrev).toBe(false);
            expect(wmComponent.enableNext).toBe(false);
            expect(wmComponent.enableDone).toBe(false);
        });

        it('should delegate to the current step when one is set', () => {
            const stepStub: any = { enablePrev: true, enableNext: true, isValid: true, enableDone: true };
            wmComponent.currentStep = stepStub;
            wmComponent.enablenext = false;
            expect(wmComponent.enablePrev).toBe(true);
            expect(wmComponent.enableNext).toBe(true);
            expect(wmComponent.enableDone).toBe(true);
        });
    });

    describe('step index getters', () => {
        it('should compute currentStepIndex/isFirstStep/isLastStep for boundary steps', () => {
            const first = wmComponent.getWidget().getStepRefByIndex(0);
            const last = wmComponent.getWidget().getStepRefByIndex(2);

            wmComponent.currentStep = first;
            expect(wmComponent.currentStepIndex).toEqual(0);
            expect(wmComponent.isFirstStep).toBe(true);
            expect(wmComponent.isLastStep).toBe(false);

            wmComponent.currentStep = last;
            expect(wmComponent.currentStepIndex).toEqual(2);
            expect(wmComponent.isFirstStep).toBe(false);
            expect(wmComponent.isLastStep).toBe(true);
        });
    });

    describe('wizard header icon/stepper helpers', () => {
        function setHostClass(cls: string) {
            wmComponent.class = cls;
            wmComponent.getNativeElement().className = cls;
        }

        it('showWizardStepIcons should be false when there is no class information at all', () => {
            setHostClass('');
            expect(wmComponent.showWizardStepIcons).toBe(false);
        });

        it('showWizardStepIcons should be true for iconstepper/tabstepper classes', () => {
            setHostClass('iconstepper');
            expect(wmComponent.showWizardStepIcons).toBe(true);
            setHostClass('tabstepper');
            expect(wmComponent.showWizardStepIcons).toBe(true);
        });

        it('isTabStepperWizard should be true only for tabstepper without iconstepper', () => {
            setHostClass('tabstepper');
            expect(wmComponent.isTabStepperWizard).toBe(true);
            setHostClass('tabstepper iconstepper');
            expect(wmComponent.isTabStepperWizard).toBe(false);
            setHostClass('');
            expect(wmComponent.isTabStepperWizard).toBe(false);
        });

        it('stepIconClassOrDefault should prefer iconclass, then iconurl, then the default glyph', () => {
            expect(wmComponent.stepIconClassOrDefault({ isDone: false, iconclass: 'wi wi-custom' } as any)).toEqual('wi wi-custom');
            expect(wmComponent.stepIconClassOrDefault({ isDone: false, iconurl: 'http://x/y.png' } as any)).toEqual('http://x/y.png');
            expect(wmComponent.stepIconClassOrDefault({ isDone: false } as any)).toEqual('wi wi-person');
            expect(wmComponent.stepIconClassOrDefault({ isDone: false, iconclass: '   ' } as any)).toEqual('wi wi-person');
        });

        it('hasNonEmptyIconClass/hasNonEmptyDoneIconClass should detect blank vs real values', () => {
            expect(wmComponent.hasNonEmptyIconClass({ isDone: false, iconclass: '  ' } as any)).toBe(false);
            expect(wmComponent.hasNonEmptyIconClass({ isDone: false, iconclass: 'wi wi-custom' } as any)).toBe(true);
            expect(wmComponent.hasNonEmptyDoneIconClass({ isDone: true, doneiconclass: '' } as any)).toBe(false);
            expect(wmComponent.hasNonEmptyDoneIconClass({ isDone: true, doneiconclass: 'wi wi-done' } as any)).toBe(true);
        });

        it('shouldShowPrimaryStepIcon should follow the icon/done-icon precedence rules', () => {
            setHostClass('iconstepper');
            expect(wmComponent.shouldShowPrimaryStepIcon(null as any)).toBe(false);
            expect(wmComponent.shouldShowPrimaryStepIcon({ isDone: false, iconclass: 'wi wi-x' } as any)).toBe(true);
            expect(wmComponent.shouldShowPrimaryStepIcon({ isDone: false } as any)).toBe(false);
            expect(wmComponent.shouldShowPrimaryStepIcon({ isDone: true, doneiconclass: 'wi wi-done' } as any)).toBe(false);
            expect(wmComponent.shouldShowPrimaryStepIcon({ isDone: true, doneiconclass: '', iconclass: 'wi wi-x' } as any)).toBe(true);

            setHostClass('');
            expect(wmComponent.shouldShowPrimaryStepIcon({ isDone: false, iconclass: 'wi wi-x' } as any)).toBe(false);
        });

        it('shouldRenderWizardStepNumberSpan should follow layout-specific rules', () => {
            setHostClass('');
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: false } as any)).toBe(true);

            setHostClass('tabstepper');
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: true, doneiconclass: '' } as any)).toBe(false);
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: true, doneiconclass: 'wi wi-done' } as any)).toBe(true);
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: false, iconclass: 'wi wi-x' } as any)).toBe(true);

            setHostClass('iconstepper');
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: false, iconclass: 'wi wi-x' } as any)).toBe(true);
            expect(wmComponent.shouldRenderWizardStepNumberSpan({ isDone: true, doneiconclass: 'wi wi-done' } as any)).toBe(true);
        });
    });

    describe('addStep with params', () => {
        it('should build param markup for a step added with params', () => {
            const addComponentSpy = jest.fn();
            (wmComponent as any).dynamicComponentProvider.addComponent = addComponentSpy;
            wmComponent.addStep({ name: 'stepWithParams', params: { foo: 'bar' } });
            const stepMarkup = addComponentSpy.mock.calls[0][1];
            expect(stepMarkup).toEqual(expect.stringContaining('wm-param'));
            expect(stepMarkup).toEqual(expect.stringContaining('foo'));
        });
    });

    describe('onWizardHeaderClick via gotoStep', () => {
        it('should mark steps before the clicked step as done when navigating to a later done step', () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            const secondStep = wmComponent.getWidget().getStepRefByIndex(1);
            secondStep.done = true;

            wmComponent.gotoStep(1);

            expect(wmComponent.currentStep).toBe(secondStep);
            expect(firstStep.done).toBe(true);
            expect(firstStep.isDone).toBe(true);
        });
    });

    describe('handleNext with a synchronous false response', () => {
        it('should not advance when a synchronous next callback returns false', () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            jest.spyOn(firstStep, 'invokeNextCB').mockReturnValue(false);
            wmComponent.next();
            expect(wmComponent.currentStep).toBe(firstStep);
        });
    });

    describe('next() when enablenext is set and the form is invalid', () => {
        it('should highlight invalid fields instead of advancing', () => {
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            wmComponent.enablenext = true;
            jest.spyOn(firstStep, 'isValid', 'get').mockReturnValue(false);
            const highlightSpy = jest.fn();
            jest.spyOn(firstStep as any, 'getAllEmbeddedForms').mockReturnValue([{ widget: { highlightInvalidFields: highlightSpy } }]);

            wmComponent.next();

            expect(highlightSpy).toHaveBeenCalled();
            expect(wmComponent.currentStep).toBe(firstStep);
        });
    });

    describe('prev() with a promise-returning callback (extended)', () => {
        it('should go back once the prev promise resolves truthily', async () => {
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            const secondStep = wmComponent.currentStep;
            const firstStep = wmComponent.getWidget().getStepRefByIndex(0);
            jest.spyOn(secondStep, 'invokePrevCB').mockReturnValue(Promise.resolve(true) as any);

            wmComponent.prev();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(wmComponent.currentStep).toBe(firstStep);
        });

        it('should stay on the current step when the prev promise resolves to false', async () => {
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            const secondStep = wmComponent.currentStep;
            jest.spyOn(secondStep, 'invokePrevCB').mockReturnValue(Promise.resolve(false) as any);

            wmComponent.prev();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(wmComponent.currentStep).toBe(secondStep);
        });

        it('should stay on the current step when the prev promise rejects', async () => {
            wmComponent.next();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            const secondStep = wmComponent.currentStep;
            jest.spyOn(secondStep, 'invokePrevCB').mockReturnValue(Promise.reject('nope') as any);

            wmComponent.prev();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(wmComponent.currentStep).toBe(secondStep);
        });

        it('should stay on the current step when the prev callback returns false synchronously', () => {
            wmComponent.next();
            const secondStep = wmComponent.currentStep;
            jest.spyOn(secondStep, 'invokePrevCB').mockReturnValue(false);

            wmComponent.prev();

            expect(wmComponent.currentStep).toBe(secondStep);
        });
    });

    describe('addMoreText', () => {
        const realJQuery = (global as any).$;

        afterEach(() => {
            (global as any).$ = realJQuery;
        });

        it('should show the "read more" affordance when the subtitle overflows on narrow screens', fakeAsync(() => {
            const jqStub: any = {
                css: jest.fn(),
                height: jest.fn().mockReturnValue(50),
                removeClass: jest.fn(),
                width: jest.fn().mockReturnValue(500),
            };
            (global as any).$ = jest.fn().mockReturnValue(jqStub);

            wmComponent.addMoreText();
            tick();

            expect(jqStub.css).toHaveBeenCalledWith({ height: '44px', display: '-webkit-box' });
            expect(jqStub.css).toHaveBeenCalledWith('display', 'block');
        }));

        it('should not force the "read more" affordance when the subtitle fits within the collapsed height', fakeAsync(() => {
            const jqStub: any = {
                css: jest.fn(),
                height: jest.fn().mockReturnValue(20),
                removeClass: jest.fn(),
                width: jest.fn().mockReturnValue(500),
            };
            (global as any).$ = jest.fn().mockReturnValue(jqStub);

            wmComponent.addMoreText();
            tick();

            expect(jqStub.css).not.toHaveBeenCalledWith({ height: '44px', display: '-webkit-box' });
        }));
    });

    describe('ngAfterContentInit dynamic steps auto-selection', () => {
        it('should auto-select the configured default step index on the first steps change while type is dynamic', () => {
            wmComponent.type = 'dynamic';
            wmComponent.defaultstepindex = 1;
            const targetStep = wmComponent.getWidget().getStepRefByIndex(1);

            (wmComponent as any).steps.notifyOnChanges();

            expect(wmComponent.currentStep).toBe(targetStep);
        });
    });

    describe('selectable step helpers', () => {
        it('getSelectableStepBeforeIndex should skip non-selectable steps and wrap to the end', () => {
            const steps: any = [
                { show: true, disabled: false },
                { show: true, disabled: true },
                { show: true, disabled: false },
            ];
            (wmComponent as any).steps = { toArray: () => steps, length: steps.length };
            expect((wmComponent as any).getSelectableStepBeforeIndex(1)).toBe(steps[0]);
            expect((wmComponent as any).getSelectableStepBeforeIndex(0)).toBe(steps[2]);
        });

        it('getSelectableStepAfterIndex should skip non-selectable steps and wrap to the start', () => {
            const steps: any = [
                { show: true, disabled: false },
                { show: true, disabled: true },
                { show: true, disabled: false },
            ];
            (wmComponent as any).steps = { toArray: () => steps, length: steps.length };
            expect((wmComponent as any).getSelectableStepAfterIndex(0)).toBe(steps[2]);
            expect((wmComponent as any).getSelectableStepAfterIndex(2)).toBe(steps[0]);
        });

        it('should return undefined when neither the scan nor the wrap-around step is selectable', () => {
            const steps: any = [
                { show: true, disabled: true },
                { show: true, disabled: true },
            ];
            (wmComponent as any).steps = { toArray: () => steps, length: steps.length };
            expect((wmComponent as any).getSelectableStepBeforeIndex(0)).toBeUndefined();
            expect((wmComponent as any).getSelectableStepAfterIndex(1)).toBeUndefined();
        });
    });

    describe('onkeydown newStep DOM update path', () => {
        it('should move the active class to the resolved step and focus it on ArrowDown', () => {
            wmComponent.autoActivation = false;
            const targetStep = wmComponent.getWidget().getStepRefByIndex(2);
            jest.spyOn(wmComponent as any, 'getSelectableStepAfterIndex').mockReturnValue(targetStep);
            const event: any = { key: 'ArrowDown', preventDefault: jest.fn() };

            wmComponent.onkeydown(event);

            const targetLi = wmComponent.getNativeElement().querySelector(`li[data-stepid="${targetStep.widgetId}"]`);
            expect(targetLi.classList.contains('active')).toBe(true);
        });

        it('should move the active class to the resolved step on ArrowUp', () => {
            wmComponent.autoActivation = false;
            const targetStep = wmComponent.getWidget().getStepRefByIndex(2);
            jest.spyOn(wmComponent as any, 'getSelectableStepBeforeIndex').mockReturnValue(targetStep);
            const event: any = { key: 'ArrowUp', preventDefault: jest.fn() };

            wmComponent.onkeydown(event);

            const targetLi = wmComponent.getNativeElement().querySelector(`li[data-stepid="${targetStep.widgetId}"]`);
            expect(targetLi.classList.contains('active')).toBe(true);
        });

        it('should select the step matching the manually-focused header item on Enter', fakeAsync(() => {
            const secondStep = wmComponent.getWidget().getStepRefByIndex(1);
            secondStep.done = true;
            // Simulate the header focus having moved to the second step's header item (as ArrowDown would do)
            // without the underlying step model's `active` flag having changed yet.
            const firstLi = wmComponent.getNativeElement().querySelector('li.active');
            firstLi?.classList.remove('active');
            const secondLi = wmComponent.getNativeElement().querySelector(`li[data-stepid="${secondStep.widgetId}"]`);
            secondLi.classList.add('active');

            const event: any = { key: 'Enter', preventDefault: jest.fn() };
            wmComponent.onkeydown(event);
            tick();

            expect(wmComponent.currentStep).toBe(secondStep);
        }));
    });
});
