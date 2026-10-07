import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardComponent } from './wizard.component';
import { WizardStepComponent } from './wizard-step/wizard-step.component';

declare const $: any;

const markup = `
    <div wmWizard name="wizc" class="classic">
        <form wmWizardStep #s1="wmWizardStep" name="step1"><ng-template [ngIf]="s1.isInitialized"></ng-template></form>
        <form wmWizardStep #s2="wmWizardStep" name="step2"><ng-template [ngIf]="s2.isInitialized"></ng-template></form>
        <form wmWizardStep #s3="wmWizardStep" name="step3"><ng-template [ngIf]="s3.isInitialized"></ng-template></form>
    </div>`;

@Component({ standalone: false, template: markup })
class CoverWizardHost {
    @ViewChild(WizardComponent, { static: true }) wmComponent: WizardComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TextContentDirective, WizardComponent, WizardStepComponent],
    declarations: [CoverWizardHost],
    providers: [{ provide: App, useValue: mockApp }, DynamicComponentRefProvider]
};

describe('WizardComponent (cover)', () => {
    let fixture: ComponentFixture<CoverWizardHost>;
    let wiz: any;
    let steps: any[];

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CoverWizardHost);
        wiz = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        steps = wiz.steps.toArray();
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        $(document).off('mouseup');
    });

    describe('getters and host class', () => {
        it('enables next when the wizard forces it, regardless of step validity', () => {
            wiz.enablenext = true;
            jest.spyOn(wiz.currentStep, 'isValid', 'get').mockReturnValue(false);
            expect(wiz.enableNext).toBe(true);
        });

        it('reads the host class from SVG-like className objects and falls back to an empty string', () => {
            const orig = wiz.nativeElement;
            wiz.class = undefined;
            Object.defineProperty(wiz, 'nativeElement', { value: { className: { baseVal: 'iconstepper' } }, configurable: true });
            expect(wiz.showWizardStepIcons).toBe(true);
            Object.defineProperty(wiz, 'nativeElement', { value: { className: {} }, configurable: true });
            expect(wiz.showWizardStepIcons).toBe(false);
            Object.defineProperty(wiz, 'nativeElement', { value: orig, configurable: true });
        });
    });

    describe('dynamic steps', () => {
        it('does not re-add a step that already exists in the steps list', () => {
            const existing = steps[0];
            existing.dynamicStepIndex = 0;
            wiz.dynamicWizard = [];
            wiz.dynamicStepIndex = 1;
            const reset = jest.spyOn(wiz.steps, 'reset');
            wiz.registerDynamicStep(existing);
            expect(reset).not.toHaveBeenCalled();
            expect(wiz.steps.length).toBe(3);
        });

        it('adds a list of named steps through the dynamic component provider, reusing the dynamic context', () => {
            const addComponent = jest.fn();
            wiz.dynamicComponentProvider = { addComponent };
            wiz.viewParent = { page: 1 };
            const ctx: any = { preset: true };
            wiz._dynamicContext = ctx;
            const names = wiz.addStep([{ name: 'extra', title: 'T', params: { a: 1 } }, { title: 'noname' }]);
            expect(names).toEqual(['extra', 'wizardstep5']);
            expect(addComponent).toHaveBeenCalledTimes(2);
            expect(addComponent.mock.calls[0][1]).toContain('name="extra"');
            expect(addComponent.mock.calls[0][1]).toContain('<wm-param name="a" value="1">');
            expect(addComponent.mock.calls[0][2]).toBe(ctx);
        });

        it('warns and skips a step whose name already exists', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            wiz.dynamicComponentProvider = { addComponent: jest.fn() };
            expect(wiz.addStep({ name: 'step1' })).toEqual([]);
            expect(warn).toHaveBeenCalled();
        });

        it('warns when removing a step by an unsupported identifier', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            wiz.removeStep(null);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("Could not find step"));
        });
    });

    describe('valid step lookup', () => {
        it('skips hidden steps when looking for the next and previous valid step', () => {
            steps[0].show = false;
            steps[1].show = false;
            expect(wiz.getNextValidStepFormIndex(0)).toBe(steps[2]);
            steps[1].show = false;
            steps[2].show = false;
            steps[0].show = true;
            expect(wiz.getPreviousValidStepFormIndex(2)).toBe(steps[0]);
        });

        it('keeps the current step when no step is visible while setting the default step', () => {
            const current = wiz.currentStep;
            steps.forEach(s => (s.show = false));
            wiz.setDefaultStep(undefined);
            expect(wiz.currentStep).toBe(current);
        });
    });

    it('ignores header clicks on steps that are not done', () => {
        const before = wiz.currentStep;
        steps[2].done = false;
        const add = jest.spyOn(wiz, 'addMoreText').mockImplementation(() => undefined);
        wiz.onWizardHeaderClick({}, steps[2]);
        expect(wiz.currentStep).toBe(before);
        expect(add).not.toHaveBeenCalled();
    });

    describe('promise detection', () => {
        it.each([
            [null, false],
            [5, false],
            [{ then: () => undefined }, false],
            [{ then: () => undefined, catch: () => undefined }, true],
            [Promise.resolve(), true]
        ])('isPromise(%p) is %p', (value, expected) => {
            expect(wiz.isPromise(value)).toBe(expected);
        });
    });

    describe('next', () => {
        it('does nothing for an unknown event on a wizard that does not force next', () => {
            const cb = jest.spyOn(wiz.currentStep, 'invokeNextCB');
            wiz.enablenext = false;
            wiz.next('other');
            expect(cb).not.toHaveBeenCalled();
            expect(wiz.currentStep.nextCBInProgress).toBeFalsy();
        });

        it('stays on the current step when there is no valid next step', () => {
            const current = wiz.currentStep;
            jest.spyOn(wiz, 'getNextValidStepFormIndex').mockReturnValue(undefined);
            const add = jest.spyOn(wiz, 'addMoreText').mockImplementation(() => undefined);
            wiz.extendNextFn(current, 0);
            expect(wiz.currentStep).toBe(current);
            expect(add).toHaveBeenCalled();
        });

        it('handles header items without anchors and next steps without a header item', () => {
            const current = wiz.currentStep;
            wiz.nativeElement.insertAdjacentHTML('beforeend', '<ul><li data-stepid="bare"></li></ul>');
            jest.spyOn(wiz, 'addMoreText').mockImplementation(() => undefined);
            jest.spyOn(wiz, 'updateStepFocus').mockImplementation(() => undefined);
            const fake: any = { widgetId: 'no-such-li' };
            jest.spyOn(wiz, 'getNextValidStepFormIndex').mockReturnValue(fake);
            wiz.extendNextFn(current, 0);
            expect(wiz.currentStep).toBe(fake);
            expect(fake.isInitialized).toBe(true);
            expect(fake.active).toBe(true);
            expect(current.done).toBe(true);
            expect(wiz.nativeElement.querySelector('li[data-stepid="bare"]').hasAttribute('tabindex')).toBe(false);
        });
    });

    describe('prev', () => {
        it('stays on the current step when there is no valid previous step', () => {
            const current = wiz.currentStep;
            jest.spyOn(wiz, 'getPreviousValidStepFormIndex').mockReturnValue(undefined);
            const add = jest.spyOn(wiz, 'addMoreText').mockImplementation(() => undefined);
            wiz.extendPrevFn(current, 0);
            expect(wiz.currentStep).toBe(current);
            expect(add).toHaveBeenCalled();
        });

        it('handles header items without anchors and previous steps without a header item', () => {
            const current = wiz.currentStep;
            wiz.nativeElement.insertAdjacentHTML('beforeend', '<ul><li data-stepid="bare"></li></ul>');
            jest.spyOn(wiz, 'addMoreText').mockImplementation(() => undefined);
            jest.spyOn(wiz, 'updateStepFocus').mockImplementation(() => undefined);
            const fake: any = { widgetId: 'no-such-li' };
            jest.spyOn(wiz, 'getPreviousValidStepFormIndex').mockReturnValue(fake);
            wiz.extendPrevFn(current, 1);
            expect(wiz.currentStep).toBe(fake);
            expect(current.isDone).toBe(false);
            expect(current.disabled).toBe(true);
        });
    });

    describe('responsive helpers', () => {
        it('does not collapse subtitles on wide screens', () => {
            jest.useFakeTimers();
            jest.spyOn($.fn, 'width').mockReturnValue(1200);
            const css = jest.spyOn($.fn, 'css');
            wiz.addMoreText();
            jest.runAllTimers();
            expect(css).not.toHaveBeenCalled();
        });

        it('removes the vertical layout on narrow screens after the view initialises', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('beforeend', '<div class="app-wizard vertical" id="vw"></div>');
            jest.spyOn($.fn, 'width').mockReturnValue(500);
            wiz.ngAfterViewInit();
            jest.runAllTimers();
            expect(document.getElementById('vw').classList.contains('vertical')).toBe(false);
            document.getElementById('vw').remove();
        });

        it('keeps the vertical layout on wide screens', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('beforeend', '<div class="app-wizard vertical" id="vw2"></div>');
            jest.spyOn($.fn, 'width').mockReturnValue(1200);
            wiz.ngAfterViewInit();
            jest.runAllTimers();
            expect(document.getElementById('vw2').classList.contains('vertical')).toBe(true);
            document.getElementById('vw2').remove();
        });

        it('keeps the expanded subtitle while clicking inside the subtitle wrapper', () => {
            document.body.insertAdjacentHTML('beforeend', '<div class="subtitle-wrapper app-wizard-step active"><span id="inner"></span></div>');
            wiz.readMoreSubtitle();
            expect($('.app-wizard-step.active .subtitle-wrapper').length).toBe(0);
            const wrapper = $('.subtitle-wrapper');
            wrapper.addClass('readmore_subtitle');
            $('#inner').trigger('mouseup');
            expect(wrapper.hasClass('readmore_subtitle')).toBe(true);
            wrapper.remove();
        });
    });

    describe('wizard context', () => {
        it('exposes bound helpers on the wizard context', () => {
            const next = jest.spyOn(wiz, 'next').mockImplementation(() => undefined);
            const prev = jest.spyOn(wiz, 'prev').mockImplementation(() => undefined);
            const done = jest.spyOn(wiz, 'done').mockImplementation(() => undefined);
            const cancel = jest.spyOn(wiz, 'cancel').mockImplementation(() => undefined);
            const skip = jest.spyOn(wiz, 'skip').mockImplementation(() => undefined);
            const c = wiz.wizContext;
            wiz.nextbtnlabel = 'N'; wiz.previousbtnlabel = 'P'; wiz.donebtnlabel = 'D'; wiz.cancelbtnlabel = 'C'; wiz.actionsalignment = 'right';
            c.next(); c.previous(); c.done(); c.cancel(); c.skip();
            expect([next, prev, done, cancel, skip].map(s => s.mock.calls.length)).toEqual([1, 1, 1, 1, 1]);
            expect([c.nextbtnlabel(), c.previousbtnlabel(), c.donebtnlabel(), c.cancelbtnlabel(), c.actionsalignment()]).toEqual(['N', 'P', 'D', 'C', 'right']);
            expect(c.hasNextStep()).toBe(wiz.hasNextStep);
            expect(c.hasPreviousStep()).toBe(wiz.hasPrevStep);
            expect(c.hasNoNextStep()).toBe(wiz.showDoneBtn);
            expect(c.cancelable()).toBe(wiz.cancelable);
            expect(c.skippable()).toBe(wiz.currentStep.enableskip);
            expect(c.disableNext()).toBe(!wiz.enableNext);
            expect(c.disablePrevious()).toBe(!wiz.enablePrev);
            expect(c.disableDone()).toBe(!wiz.enableDone);
        });

        it('does not change the default step on steps changes unless the wizard is dynamic', () => {
            const setDefault = jest.spyOn(wiz, 'setDefaultStep').mockImplementation(() => undefined);
            wiz.type = 'static';
            wiz.steps.notifyOnChanges();
            wiz.type = 'dynamic';
            wiz._isFirstLoad = true;
            wiz.steps.notifyOnChanges();
            expect(setDefault).toHaveBeenCalledTimes(1);
        });
    });

    describe('selectable steps', () => {
        it('skips unselectable steps and does not wrap when the index is not the boundary', () => {
            jest.spyOn(wiz, 'isSelectableStep').mockImplementation((st: any) => st.show);
            steps[0].show = false;
            expect(wiz.getSelectableStepBeforeIndex(2)).toBe(steps[1]);
            steps[1].show = false;
            expect(wiz.getSelectableStepBeforeIndex(2)).toBeUndefined();
            expect(wiz.getSelectableStepAfterIndex(0)).toBe(steps[2]);
            steps[2].show = false;
            expect(wiz.getSelectableStepAfterIndex(0)).toBeUndefined();
        });
    });

    it('applies the alignment class to action bars and clears the container class on right actions after view checks', () => {
        wiz.nativeElement.insertAdjacentHTML('beforeend', '<div class="app-wizard-actions"></div><div class="app-wizard-actions-right app-container"></div>');
        wiz.actionsalignment = 'text-right';
        wiz.ngAfterViewChecked();
        expect(wiz.nativeElement.querySelector('div.app-wizard-actions').classList.contains('text-right')).toBe(true);
        expect(wiz.nativeElement.querySelector('div.app-wizard-actions-right').classList.contains('app-container')).toBe(false);
    });

    describe('getWidgets', () => {
        it('treats a non numeric index as 0 and returns nothing for an unknown step', () => {
            jest.spyOn(steps[0], 'currentWizardWidgets', 'get').mockReturnValue({ w: 'W0' });
            expect(wiz.getWidgets('w', 'abc')).toEqual(['W0']);
            expect(wiz.getWidgets('w', 10)).toBeUndefined();
        });
    });

    describe('keyboard navigation', () => {
        const key = (k: string) => ({ key: k, preventDefault: jest.fn() });

        it('moves nowhere with arrows when activation is automatic', () => {
            wiz.autoActivation = true;
            const before = jest.spyOn(wiz, 'getSelectableStepBeforeIndex');
            const e = key('ArrowLeft');
            wiz.onkeydown(e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(before).not.toHaveBeenCalled();
        });

        it('moves to the previous selectable step with ArrowLeft when activation is manual', () => {
            wiz.autoActivation = false;
            jest.spyOn(wiz, 'getSelectedStepIndex').mockReturnValue(1);
            jest.spyOn(wiz, 'getSelectableStepBeforeIndex');
            wiz.onkeydown(key('ArrowLeft'));
            expect(wiz.getSelectableStepBeforeIndex).toHaveBeenCalledWith(1);
        });

        it('ignores unrelated keys', () => {
            const e = key('x');
            wiz.onkeydown(e);
            expect(e.preventDefault).not.toHaveBeenCalled();
        });

        describe('Enter key', () => {
            beforeEach(() => jest.useFakeTimers());

            const run = (html: string) => {
                wiz.nativeElement.innerHTML = html;
                wiz.onkeydown(key('Enter'));
                jest.runAllTimers();
            };

            it('does nothing when the active item is outside the wizard header', () => {
                const click = jest.spyOn(wiz, 'onWizardHeaderClick');
                run(`<ul><li class="active" data-stepid="${steps[1].widgetId}"></li></ul>`);
                expect(click).not.toHaveBeenCalled();
            });

            it('does nothing when the step is unknown or already current', () => {
                const click = jest.spyOn(wiz, 'onWizardHeaderClick');
                run('<div class="app-wizard-heading"><ul><li class="active" data-stepid="unknown"></li></ul></div>');
                run(`<div class="app-wizard-heading"><ul><li class="active" data-stepid="${wiz.currentStep.widgetId}"></li></ul></div>`);
                expect(click).not.toHaveBeenCalled();
            });

            it('selects another step even when its header item has no anchor', () => {
                const click = jest.spyOn(wiz, 'onWizardHeaderClick').mockImplementation(() => undefined);
                const other = steps.find(s => s !== wiz.currentStep);
                run(`<div class="app-wizard-heading"><ul><li class="active" data-stepid="${other.widgetId}"></li></ul></div>`);
                expect(click).toHaveBeenCalledWith(expect.anything(), other);
                expect(wiz.nativeElement.querySelector('li').getAttribute('tabindex')).toBe('-1');
            });
        });
    });

    describe('getSelectedStepIndex', () => {
        it('uses the step whose header item is active', () => {
            wiz.nativeElement.innerHTML = `<ul><li class="active" data-stepid="${steps[2].widgetId}"></li></ul>`;
            expect(wiz.getSelectedStepIndex()).toBe(2);
        });
    });

    it('destroys cleanly when the dynamic wizard list is already gone', () => {
        wiz.dynamicWizard = undefined;
        expect(() => wiz.ngOnDestroy()).not.toThrow();
        expect(wiz.currentStep).toBeNull();
    });
});
