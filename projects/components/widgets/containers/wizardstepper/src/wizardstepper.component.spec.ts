import { Component, ViewChild } from '@angular/core';
import { waitForAsync, ComponentFixture } from '@angular/core/testing';
import { App, DynamicComponentRefProvider } from '@wm/core';
import { Context } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { WizardStepperComponent } from './wizardstepper.component';

/**
 * Isolated unit spec: exercises WizardStepperComponent against a hand-rolled `wizContext`
 * (the same shape WizardComponent populates in ngAfterContentInit), without depending on the
 * real wizard. Nested integration through the real wizard is covered by
 * wizardstepper.wrapper.component.spec.ts.
 */
function makeStep(overrides: Partial<any> = {}) {
    return {
        widgetId: overrides.widgetId ?? 'step1',
        title: overrides.title ?? 'Step Title',
        subtitle: overrides.subtitle ?? '',
        show: overrides.show ?? true,
        active: overrides.active ?? false,
        done: overrides.done ?? false,
        disabled: overrides.disabled ?? false,
        isDone: overrides.isDone ?? false,
        iconclass: overrides.iconclass ?? '',
        iconurl: overrides.iconurl ?? '',
        doneiconclass: overrides.doneiconclass ?? '',
        doneiconurl: overrides.doneiconurl ?? ''
    };
}

function makeWizContext(steps: any[], wizardClass = 'wizard-number') {
    return {
        steps,
        getWizardClass: () => wizardClass,
        getStepClass: () => '',
        onHeaderClick: jest.fn(),
        onHeaderKeyDown: jest.fn(),
        shouldRenderStepNumberSpan: () => true,
        shouldShowPrimaryStepIcon: () => false,
        hasNonEmptyDoneIconClass: () => false,
        stepIconClassOrDefault: () => 'wi wi-person',
        showWizardStepIcons: () => false,
        isTabStepperWizard: () => false,
        readMoreSubtitle: jest.fn()
    };
}

const BOUND_CONTEXT_TOKEN = 'WIZARDSTEPPER_TEST_CONTEXT';

@Component({
    standalone: false,
    template: `<div wmWizardStepper name="header1"></div>`,
    providers: [
        { provide: Context, useFactory: (ctx) => ctx, deps: [BOUND_CONTEXT_TOKEN], multi: true }
    ]
})
class BoundWizardStepperWrapperComponent {
    @ViewChild(WizardStepperComponent, { static: true }) wmComponent: WizardStepperComponent;
}

@Component({
    standalone: false,
    template: `<div wmWizardStepper name="header1"></div>`
})
class UnboundWizardStepperWrapperComponent {
    @ViewChild(WizardStepperComponent, { static: true }) wmComponent: WizardStepperComponent;
}

describe('wm-wizardstepper: bound to a wizContext', () => {
    let wrapperComponent: BoundWizardStepperWrapperComponent;
    let wmComponent: WizardStepperComponent;
    let fixture: ComponentFixture<BoundWizardStepperWrapperComponent>;
    let steps: any[];
    let wizContext: any;

    beforeEach(waitForAsync(() => {
        steps = [makeStep({ widgetId: 's1', title: 'One', done: true }), makeStep({ widgetId: 's2', title: 'Two', active: true }), makeStep({ widgetId: 's3', title: 'Three', disabled: true })];
        wizContext = makeWizContext(steps);

        const testModuleDef: ITestModuleDef = {
            imports: [WizardStepperComponent],
            declarations: [BoundWizardStepperWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                DynamicComponentRefProvider,
                { provide: BOUND_CONTEXT_TOKEN, useValue: wizContext }
            ]
        };

        fixture = compileTestComponent(testModuleDef, BoundWizardStepperWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        wmComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    it('should create the widget and resolve the ancestor wizContext', () => {
        expect(wrapperComponent).toBeTruthy();
        expect(wmComponent.wizContext).toBe(wizContext);
    });

    it('should render one indicator per step, in order', () => {
        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items.length).toBe(3);
        expect(items[0].getAttribute('data-stepid')).toBe('s1');
        expect(items[2].getAttribute('data-stepid')).toBe('s3');
    });

    it('should reflect step state as finished/active/default classes', () => {
        const items = fixture.nativeElement.querySelectorAll('li.app-wizard-step');
        expect(items[0].classList.contains('finished')).toBe(true);
        expect(items[1].classList.contains('active')).toBe(true);
        expect(items[2].classList.contains('default')).toBe(true);
    });

    it('should delegate a step click to wizContext.onHeaderClick', () => {
        const firstItem = fixture.nativeElement.querySelector('li.app-wizard-step');
        firstItem.click();
        expect(wizContext.onHeaderClick).toHaveBeenCalledTimes(1);
        expect(wizContext.onHeaderClick.mock.calls[0][1]).toBe(steps[0]);
    });

    it('should delegate keydown on a step anchor to wizContext.onHeaderKeyDown', () => {
        const anchor = fixture.nativeElement.querySelector('li.app-wizard-step a');
        anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(wizContext.onHeaderKeyDown).toHaveBeenCalledTimes(1);
    });

    it('should carry the app-wizard-heading class and role="tab" when nested (FR-016)', () => {
        const hostEl = fixture.nativeElement.querySelector('[wmWizardStepper]');
        expect(hostEl.classList.contains('app-wizard-heading')).toBe(true);
        expect(hostEl.getAttribute('role')).toBe('tab');
    });
});

/**
 * `viewParent` resolves to the nearest enclosing Page/Partial/Prefab/CustomWidget instance
 * (see `findParent`/`findViewParent` in `@wm/core`), and every named widget registers itself
 * into that instance's OWN `Widgets` object (`widget-registry.ts`'s `register()`), not onto the
 * App. This wrapper stands in for that Page/Partial instance in the test, exposing `Widgets`
 * directly, exactly as production `BasePageComponent.registerWidgets()` does.
 */
@Component({
    standalone: false,
    template: `<div wmWizardStepper name="header1" wizardname="wizard1"></div>`
})
class StandaloneWizardStepperWrapperComponent {
    @ViewChild(WizardStepperComponent, { static: true }) wmComponent: WizardStepperComponent;
    Widgets: any = {};
}

describe('wm-wizardstepper: standalone-by-reference (wizardname -> Widgets[name], US2/T037)', () => {
    let wmComponent: WizardStepperComponent;
    let fixture: ComponentFixture<StandaloneWizardStepperWrapperComponent>;
    let steps: any[];
    let wizContext: any;
    let fakeWizard: any;

    beforeEach(waitForAsync(() => {
        steps = [makeStep({ widgetId: 's1', title: 'One', done: true })];
        wizContext = makeWizContext(steps);
        fakeWizard = { wizContext };

        const testModuleDef: ITestModuleDef = {
            imports: [WizardStepperComponent],
            declarations: [StandaloneWizardStepperWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                DynamicComponentRefProvider
            ]
        };

        fixture = compileTestComponent(testModuleDef, StandaloneWizardStepperWrapperComponent);
        fixture.componentInstance.Widgets.wizard1 = fakeWizard;
        wmComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    it('should resolve the wizard by name from the page widget registry and render its steps', () => {
        expect(wmComponent.wizContext).toBe(wizContext);
        expect(fixture.nativeElement.querySelectorAll('li.app-wizard-step').length).toBe(1);
    });

    it('should NOT carry the app-wizard-heading class or role="tab" (standalone-by-reference, FR-016)', () => {
        const hostEl = fixture.nativeElement.querySelector('[wmWizardStepper]');
        expect(hostEl.classList.contains('app-wizard-heading')).toBe(false);
        expect(hostEl.getAttribute('role')).toBeNull();
    });
});

describe('wm-wizardstepper: standalone with an unresolvable wizardname (FR-015 safe-empty)', () => {
    @Component({
        standalone: false,
        template: `<div wmWizardStepper name="header1" wizardname="doesNotExist"></div>`
    })
    class UnresolvableStandaloneWrapperComponent {
        @ViewChild(WizardStepperComponent, { static: true }) wmComponent: WizardStepperComponent;
    }

    let fixture: ComponentFixture<UnresolvableStandaloneWrapperComponent>;

    beforeEach(waitForAsync(() => {
        const testModuleDef: ITestModuleDef = {
            imports: [WizardStepperComponent],
            declarations: [UnresolvableStandaloneWrapperComponent],
            providers: [
                { provide: App, useValue: { ...mockApp, Widgets: {} } },
                DynamicComponentRefProvider
            ]
        };

        fixture = compileTestComponent(testModuleDef, UnresolvableStandaloneWrapperComponent);
    }));

    it('should not throw and should render no step indicators when the named wizard is not found', () => {
        expect(() => fixture.detectChanges()).not.toThrow();
        expect(fixture.nativeElement.querySelectorAll('li.app-wizard-step').length).toBe(0);
    });
});

describe('wm-wizardstepper: unbound (no ancestor wizard, FR-015 safe-empty)', () => {
    let fixture: ComponentFixture<UnboundWizardStepperWrapperComponent>;

    beforeEach(waitForAsync(() => {
        const testModuleDef: ITestModuleDef = {
            imports: [WizardStepperComponent],
            declarations: [UnboundWizardStepperWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                DynamicComponentRefProvider
            ]
        };

        fixture = compileTestComponent(testModuleDef, UnboundWizardStepperWrapperComponent);
    }));

    it('should not throw and should render no step indicators when no wizContext resolves', () => {
        expect(() => fixture.detectChanges()).not.toThrow();
        expect(fixture.nativeElement.querySelectorAll('li.app-wizard-step').length).toBe(0);
    });
});
