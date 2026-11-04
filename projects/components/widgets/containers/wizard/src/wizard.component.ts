import {CommonModule} from '@angular/common';
import {
    APPLY_STYLES_TYPE,
    Context,
    createArrayFrom,
    IWidgetConfig,
    provideAsWidgetRef,
    StylableComponent,
    styler,
    TextContentDirective,
    WmAppIconComponent
} from "@wm/components/base";
import {
    AfterContentChecked,
    AfterContentInit,
    AfterViewChecked,
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ContentChild,
    ContentChildren,
    Inject,
    Injector,
    OnDestroy,
    OnInit,
    Optional,
    QueryList,
    Self,
    TemplateRef, ChangeDetectionStrategy
} from '@angular/core';

import {DynamicComponentRefProvider, isDefined, noop} from '@wm/core';
import {WizardStepperComponent} from '@wm/components/containers/wizardstepper';

import {registerProps} from './wizard.props';

import {WizardStepComponent} from "./wizard-step/wizard-step.component";
import {find, findIndex, forEach, get, indexOf, isArray, isNumber, isString} from "lodash-es";

/**
 * Header row shape for icon/tab-stepper helpers. Uses this instead of `WizardStepComponent` on
 * those parameters so TypeScript/ng-packagr does not hit a circular resolution order
 * (wizard-step imports WizardComponent).
 */
type WizardStepHeaderModel = {
    isDone: boolean;
    iconclass?: string;
    iconurl?: string;
    doneiconclass?: string;
    doneiconurl?: string;
};

const DEFAULT_CLS = 'app-wizard panel clearfix';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-wizard',
    hostClass: DEFAULT_CLS
};

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, TextContentDirective, WmAppIconComponent, WizardStepperComponent],
    selector: 'div[wmWizard]',
    templateUrl: './wizard.component.html',
    providers: [
        provideAsWidgetRef(WizardComponent),
        {provide: Context, useFactory: () => { return {} }, multi: true}
    ],
    exportAs: 'wmWizard'
})
export class WizardComponent extends StylableComponent implements OnInit, AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked, OnDestroy {
    static readonly initializeProps = registerProps();

    @ContentChildren(WizardStepComponent) steps: QueryList<WizardStepComponent>;
    @ContentChild('wizardAction', { read: TemplateRef, descendants: false }) wizardAction: TemplateRef<any>;
    /**
     * Explicitly authored `<wm-wizardstepper>` child, if the page markup has one (mirrors how
     * `wm-wizardstep`/`wm-wizardaction` are authored, projected, and selectable on canvas).
     */
    @ContentChild(WizardStepperComponent, { descendants: false }) explicitHeader: WizardStepperComponent;

    public message: {caption: string, type: string};
    public currentStep: WizardStepComponent;

    public stepClass: string;
    public class;
    public name;
    private readonly promiseResolverFn: Function;
    public actionsalignment: any;
    public cancelable: any;
    public enablenext: any;
    public wizContext: any;
    public cancelbtnlabel: any;
    public donebtnlabel: any;
    public previousbtnlabel: any;
    public nextbtnlabel: any;
    public defaultstep;
    public fieldDefs;
    public type;
    public nodatamessage;
    private readonly dynamicComponentProvider;
    private _dynamicContext;
    private dynamicStepIndex;
    public dynamicWizard;
    public defaultstepindex;
    private _isFirstLoad: boolean = true;
    public autoActivation:boolean;
    private stepsSubscription: any; // MEMORY LEAK FIX: Store subscription for cleanup

    get hasPrevStep(): boolean {
        return !this._isFirstStep(this.currentStep);
    }

    get hasNextStep(): boolean {
        return !this._isLastStep(this.currentStep);
    }

    get showDoneBtn(): boolean {
        if (!this.currentStep) {
            return false;
        }
        return !this.hasNextStep && this.currentStep.enableDone;
    }

    get enablePrev(): boolean {
        if (!this.currentStep) {
            return false;
        }
        return this.currentStep.enablePrev;
    }

    get enableNext(): boolean {
        if (!this.currentStep) {
            return false;
        }
        return this.enablenext ? true : (this.currentStep.enableNext && this.currentStep.isValid);
    }

    /**
     * Step header icons (iconclass / doneiconclass): same rules as iconstepper, plus tabstepper
     * (e.g. wizard-tabstepper, tabstepper, tabstepper_vertical). Uses class property + host className
     * so preview stays correct when the DOM is updated before the bound property.
     *
     * Since 002-stepper-header-widget, the appearance variant (number/iconstepper/dottedstepper/
     * ...) is set on the standalone `wm-wizardstepper`'s OWN class, not this wizard's — but this
     * string still gates the template conditionals (`showWizardStepIcons`, `isTabStepperWizard`,
     * `shouldRenderWizardStepNumberSpan`) and `wizContext.getWizardClass()` that decide which
     * per-variant content (digit/dot/icon) the header renders. When a header widget is bound
     * (nested `explicitHeader`, or standalone-by-reference), its class is the SOLE source for
     * these checks — NOT merged with this wizard's own `class`/DOM className. Studio's `wm-wizard`
     * drag-drop templates and its own (separate, legacy) appearance/variant palette still stamp a
     * `wizard-*` class directly onto the wizard element itself; if that stale token were merged in
     * alongside the header's current one, switching the header's appearance (e.g. number ->
     * dottedstepper) would leave both substrings present and fire BOTH variants' content
     * conditionals at once.
     */
    private wizardHostClassString(): string {
        const header = this.explicitHeader || this.resolveStandaloneHeader();
        return header && typeof header.class === 'string' ? header.class : '';
    }

    private resolveStandaloneHeader(): WizardStepperComponent | undefined {
        const widgets = (this.viewParent as any)?.Widgets;
        if (!widgets) {
            return undefined;
        }
        return Object.keys(widgets)
            .map(key => widgets[key])
            .find(w => w && w.widgetType === 'wm-wizardstepper' && w.wizardname === this.name);
    }

    get showWizardStepIcons(): boolean {
        const c = this.wizardHostClassString();
        if (!c) {
            return false;
        }
        return c.includes('iconstepper') || c.includes('tabstepper');
    }

    /** Tab layout only (not icon stepper): omit icon column when step has no icon. */
    get isTabStepperWizard(): boolean {
        const c = this.wizardHostClassString();
        return c.includes('tabstepper') && !c.includes('iconstepper');
    }

    /** Default matches wm-wizardstep props; used for icon stepper when iconclass is empty. */
    stepIconClassOrDefault(step: WizardStepHeaderModel): string {
        const c = step?.iconclass || step?.iconurl;
        return typeof c === 'string' && c.trim() ? c.trim() : 'wi wi-person';
    }

    hasNonEmptyIconClass(step: WizardStepHeaderModel): boolean {
        const ic = step?.iconclass || step?.iconurl;
        return typeof ic === 'string' && ic.trim() !== '';
    }

    /**
     * Primary `app-icon` for icon/tab stepper: only when `iconclass` is set (no default glyph for icon stepper).
     * When `doneiconclass` is set, the done row is shown instead of this primary icon.
     */
    shouldShowPrimaryStepIcon(step: WizardStepHeaderModel): boolean {
        if (!step || !this.showWizardStepIcons) {
            return false;
        }
        if (!step.isDone) {
            return this.hasNonEmptyIconClass(step);
        }
        const d = step.doneiconclass;
        const hasDone = typeof d === 'string' && d.trim() !== '';
        if (hasDone) {
            return false;
        }
        return this.hasNonEmptyIconClass(step);
    }

    /**
     * Tab stepper: no `wizard-step-number` when the step is done but `doneiconclass` is empty.
     * Icon stepper: omit the wrapper when there is no primary icon and no done icon to show.
     * Other layouts: keep the wrapper (numbers, dots, etc.).
     */
    shouldRenderWizardStepNumberSpan(step: WizardStepHeaderModel): boolean {
        if (!this.showWizardStepIcons) {
            return true;
        }
        if (this.isTabStepperWizard) {
            if (step.isDone && !this.hasNonEmptyDoneIconClass(step)) {
                return false;
            }
            return (
                this.shouldShowPrimaryStepIcon(step) ||
                (step.isDone && this.hasNonEmptyDoneIconClass(step))
            );
        }
        if (this.wizardHostClassString().includes('iconstepper')) {
            return (
                this.shouldShowPrimaryStepIcon(step) ||
                (step.isDone && this.hasNonEmptyDoneIconClass(step))
            );
        }
        return true;
    }

    /** Avoid `String()` in templates (strict mode treats it as a component property). */
    hasNonEmptyDoneIconClass(step: WizardStepHeaderModel): boolean {
        const d = step?.doneiconclass || step?.doneiconurl;
        return typeof d === 'string' && d.trim() !== '';
    }

    get enableDone(): boolean {
        if (!this.currentStep) {
            return false;
        }
        return this.currentStep.enableDone && this.currentStep.isValid;
    }

    /**
     * returns current step index of the Wizard's current step
     */
    get currentStepIndex() {
        return this.getStepIndexByRef(this.currentStep);
    }

    /**
     * returns weather the current step is first step or not
     */
    get isFirstStep(): boolean {
        return this._isFirstStep(this.currentStep);
    }

    /**
     * returns weather the current step is last step or not
     */
    get isLastStep(): boolean {
        return this._isLastStep(this.currentStep);
    }

    constructor(inj: Injector, dynamicComponentProvider: DynamicComponentRefProvider, @Self() @Inject(Context) contexts: Array<any>, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        let resolveFn: Function = noop;

        super(inj, WIDGET_CONFIG, explicitContext, new Promise(res => resolveFn = res));
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.SHELL);

        this.promiseResolverFn = resolveFn;

        // initialize the message object with default values
        this.message = {
            caption: '',
            type: ''
        };
        this.wizContext = contexts[0];
        this.dynamicComponentProvider = dynamicComponentProvider;
        this.dynamicWizard = [];
        this.dynamicStepIndex = 0;
    }

    /**
     * This method is used to register the dynamic steps.
     * After all steps are initialzed, update the querylist manually based on index.
     * @param stepRef - refrence of the wizardstep
     */
    public registerDynamicStep(stepRef) {
        this.dynamicWizard.push(stepRef);
        const isLastStep =  this.dynamicWizard.length === this.dynamicStepIndex;
        if (isLastStep) {
            for (let i = 0; i < this.dynamicWizard.length; i++) {
                const newStepRef  = find(this.dynamicWizard, step => step.dynamicStepIndex === i);
                const isStepAlreadyExist = find(this.steps.toArray(), newStepRef);
                if (!isStepAlreadyExist) {
                    this.steps.reset([...this.steps.toArray(), newStepRef]);
                    if (newStepRef.active) {
                        setTimeout(() => {
                            newStepRef.select();
                        }, 20);
                    }
                }
            }
        }
    }

    /**
     * This method is to add the wizard step dynamically
     * @param wizardSteps - list of wizardsteps
     */
    public addStep(wizardSteps) {
        if (!isArray(wizardSteps)) {
            wizardSteps = [wizardSteps];
        }
        const stepNamesList = [];
        forEach(wizardSteps, (step, index) => {
            const isStepAlreadyCreated = find(this.steps.toArray(), {name: step.name});
            const isStepNameExist = indexOf(stepNamesList, step.name);
            // If user tries to add wizardstep with the same name which is already exists then do not create the step
            if (isStepAlreadyCreated || isStepNameExist > 0) {
                console.warn(`The wizard step with name ${step.name} already exists`);
                return;
            }

            let paramMarkup = '';
            let propsTmpl = '';
            this.dynamicStepIndex++;
            const name = step.name ? step.name : `wizardstep${this.steps.toArray().length + (index + 1)}`;
            stepNamesList.push(name);
            const partialParams = get(step, 'params');

            forEach(step, (value, key) => {
                if (key !== 'params') {
                    propsTmpl = `${propsTmpl} ${key}="${value}"`;
                }
            });

            forEach(partialParams, (value, key) => {
                paramMarkup = `${paramMarkup} <wm-param name="${key}" value="${value}"></wm-param>`;
            });
            const markup = `<wm-wizardstep dynamicStepIndex="${this.dynamicStepIndex - 1}" isdynamic="true" name="${name}" ${propsTmpl}>
                            ${paramMarkup}
                        </wm-wizardstep>`;

            if (!this._dynamicContext) {
                this._dynamicContext = Object.create(this.viewParent);
                this._dynamicContext[this.getAttr('wmWizard')] = this;
            }

            this.dynamicComponentProvider.addComponent(this.getNativeElement().querySelector('.app-wizard-body'), markup, this._dynamicContext, {inj: this.inj});

        });
        return stepNamesList;
    }

    /**
     * This method is to remove the wizard step
     * @param step - index or name of the step
     */
    public removeStep(step: number | string) {
        const stepRef = isString(step) ? this.getStepRefByName(step) : isNumber(step)
            ? this.getStepRefByIndex(step) : null;
        stepRef ? stepRef.remove() : console.warn(`Could not find step with name or index '${step}' to remove`);
    }

    /**
     * returns next valid step. the index passed is also checked if its valid step
     * @param index
     * @returns {WizardStepComponent}
     */
    private getNextValidStepFormIndex(index: number): WizardStepComponent {
        for (let i = index; i < this.steps.length; i++) {
            const step = this.getStepRefByIndex(i);
            if (step.show) {
                return step;
            }
        }
    }

    /**
     * returns previous valid step. the index passed is also checked if its valid step
     * @param index
     * @returns {WizardStepComponent}
     */
    private getPreviousValidStepFormIndex(index: number): WizardStepComponent {
        for (let i = index; i >= 0; i--) {
            const step = this.getStepRefByIndex(i);
            if (step.show) {
                return step;
            }
        }
    }

    /**
     * returns current step index value.
     * @returns {number}
     */
    private getCurrentStepIndex(): number {
        return this.getStepIndexByRef(this.currentStep);
    }

    /**
     * returns stepRef when index is passed.
     * @param {number} index
     * @returns {WizardStepComponent}
     */
    private getStepRefByIndex(index: number): WizardStepComponent {
        return this.steps.toArray()[index];
    }

    /**
     * returns the index value of the step.
     * @param {WizardStepComponent} wizardStep
     * @returns {number}
     */
    private getStepIndexByRef(wizardStep: WizardStepComponent): number {
        return this.steps.toArray().indexOf(wizardStep);
    }

    /**
     * gets stepRef by searching on the name property.
     * @param {string} name
     * @returns {WizardStepComponent}
     */
    private getStepRefByName(name: string): WizardStepComponent {
        return this.steps.find(step => step.name === name);
    }

    /**
     * sets default step as current step if configured
     * or finds first valid step and set it as current step.
     * @param {WizardStepComponent} step
     */
    private setDefaultStep(step: WizardStepComponent) {
        // If the default step has show true then only update the currentStep
        if (step?.show) {
            this.currentStep = step;
            step.active = true;
            step.isInitialized = true;
            // Mark all previous step status COMPLETED
            let index = this.getStepIndexByRef(step) - 1;
            while (index >= 0) {
                const prevStep = this.getStepRefByIndex(index);
                prevStep.done = true;
                prevStep.isInitialized = true;
                index--;
            }
        } else {
            // set next valid step as current step
            step = this.getNextValidStepFormIndex(0);
            if (step) {
                this.setDefaultStep(step);
            }
        }
        this.addMoreText();
    }

    /**
     * Selects the associated step when the wizard stepper is clicked.
     * @param $event
     * @param {WizardStepComponent} currentStep
     */
    private onWizardStepperClick($event: Event, currentStep: WizardStepComponent) {
        // select the step if it's status is done
        if (currentStep.done) {
            // set all the next steps status as disabled and previous steps as done
            this.steps.forEach((step, index) => {
                if (index < this.getStepIndexByRef(currentStep)) {
                   step.done = true;
                   step.isDone = true;
                } else {
                    step.disabled = true;
                    step.isDone = false;
                }
            });
            // set the selected step as current step and make it active
            this.currentStep = currentStep;
            this.currentStep.active = true;
            this.addMoreText();
        }
    }

    private readonly isPromise = (obj) => obj instanceof Promise || (obj !== null && typeof obj === 'object' && typeof obj.then === 'function' && typeof obj.catch === 'function');

    // Method to navigate to next step

    private handleNext(value: boolean | Promise<boolean>, currentStep, currentStepIndex) {
        if (this.isPromise(value)) {
            (value as Promise<boolean>).then(response => {
                this.currentStep.nextCBInProgress = false;
                if (response === false) {
                    return;
                }
                this.extendNextFn(currentStep, currentStepIndex);
            }, err => {
                this.currentStep.nextCBInProgress = false;
            })
        } else {
            this.currentStep.nextCBInProgress = false;
            if (value === false) {
                return;
            }
            this.extendNextFn(currentStep, currentStepIndex);
        }
    }

    public next(eventName: string = 'next') {
        if (this.currentStep.nextCBInProgress) {
            return;
        }

        const currentStep = this.currentStep;
        const currentStepIndex = this.getCurrentStepIndex();

        // abort if onSkip method returns false
        if (eventName === 'skip') {
            this.currentStep.nextCBInProgress = true;
            const response =  currentStep.invokeSkipCB(currentStepIndex);
            this.handleNext(response, currentStep, currentStepIndex);
        } else if (this.currentStep.isValid && eventName === 'next') {
            this.currentStep.nextCBInProgress = true;
            const response  =  currentStep.invokeNextCB(currentStepIndex);
            this.handleNext(response, currentStep, currentStepIndex);
        } else if (this.enablenext && !this.currentStep.isValid){
            Array.from((<any>this).currentStep.getAllEmbeddedForms())?.forEach((form:any) => {
                form.widget.highlightInvalidFields();
            });
            const invalidFormInputElement = this.currentStep.nativeElement?.querySelector("input.ng-invalid") as HTMLInputElement;
            invalidFormInputElement?.focus();

        }
    }

    private extendNextFn(currentStep, currentStepIndex) {
        const nextStep: WizardStepComponent = this.getNextValidStepFormIndex(currentStepIndex + 1);
        // If there are any steps which has show then only change state of current step else remain same
        if (nextStep) {
            nextStep.isInitialized = true;
            currentStep.isDone = true;
            currentStep.done = true;
            nextStep.active = true;
            this.currentStep = nextStep;
            // Remove 'active' class from all wizard steps in header
            const allStepItems = this.nativeElement.querySelectorAll('li[data-stepid]');
            allStepItems.forEach((el: Element) => {
                el.classList.remove('active');
                const anchor = el.querySelector('a');
                if (anchor) {
                    anchor.setAttribute('tabindex', '-1');
                }
            });
            // Add 'active' to next step header item
            const newStepLi = this.nativeElement.querySelector(`li[data-stepid="${nextStep.widgetId}"]`);
            const newStepAnchor = newStepLi?.querySelector('a') as HTMLElement;
            if (newStepLi && newStepAnchor) {
                newStepLi.classList.add('active');
                newStepAnchor.setAttribute('tabindex', '0');
                newStepAnchor.focus();
            }
            this.updateStepFocus();
        }
        this.addMoreText();
    }
    // Method to navigate to previous step
    public prev() {
        if (this.currentStep.prevCBInProgress) {
            return;
        }

        const currentStep = this.currentStep;
        const currentStepIndex = this.getCurrentStepIndex();

        this.currentStep.prevCBInProgress = true;
        // abort if onPrev method returns false.
        const response = currentStep.invokePrevCB(currentStepIndex);
        if (this.isPromise(response)) {
            (response as Promise<boolean>).then( response => {
                this.currentStep.prevCBInProgress = false;
                if (response === false) {
                    return;
                }
                this.extendPrevFn(currentStep, currentStepIndex);
            }, err => {
                this.currentStep.prevCBInProgress = false;
            });
        } else {
            this.currentStep.prevCBInProgress = false;
            if (response === false) {
                return;
            }
            this.extendPrevFn(currentStep, currentStepIndex);
        }
    }

    private extendPrevFn(currentStep, currentStepIndex){
        const prevStep: WizardStepComponent = this.getPreviousValidStepFormIndex(currentStepIndex - 1);

        // If there are any steps which has show then only change state of current step else remain same
        if (prevStep) {
            currentStep.isDone = false;
            currentStep.disabled = true;
            prevStep.active = true;
            this.currentStep = prevStep;
            //  Remove 'active' class from all steps
            const allStepItems = this.nativeElement.querySelectorAll('li[data-stepid]');
            allStepItems.forEach((el: Element) => {
                el.classList.remove('active');
                const anchor = el.querySelector('a');
                if (anchor) {
                    anchor.setAttribute('tabindex', '-1');
                }
            });
            // Apply 'active' to prev step
            const prevStepLi = this.nativeElement.querySelector(`li[data-stepid="${prevStep.widgetId}"]`);
            const prevStepAnchor = prevStepLi?.querySelector('a') as HTMLElement;
            if (prevStepLi && prevStepAnchor) {
                prevStepLi.classList.add('active');
                prevStepAnchor.setAttribute('tabindex', '0');
                prevStepAnchor.focus();
            }
            this.updateStepFocus();
        }
        this.addMoreText();
    }

    public skip() {
        this.next('skip');
    }

    /**
     * Navigates to the given step based on step name or step index
     * This will work only if the step is already in done state
     * @param step
     */
    public gotoStep(step: string | number) {
        let gotoStepIndex: number;
        if (isString(step)) {
            gotoStepIndex = this.steps.toArray().map(step => step.name).indexOf(step);
            if (gotoStepIndex === -1) {
                console.error(`Could not find step '${step}'`);
                return;
            }
        } else if (isNumber(step) && step >= 0) {
            gotoStepIndex = step;
        } else {
            console.error("Invalid step name or index provided");
            return;
        }

        const gotoStep: WizardStepComponent = this.getStepRefByIndex(gotoStepIndex);

        if (gotoStep?.show) {
            this.onWizardStepperClick(event, gotoStep);
        } else {
            console.error("The gotoStep function cannot navigate to hidden steps");
        }
    }

    // Method to invoke on-Done event on wizard
    public done() {
        this.currentStep.isDone = true;
        this.invokeEventCallback('done', {steps: this.steps.toArray()});
    }
    // Method to invoke on-Cancel event on wizard
    public cancel () {
        this.invokeEventCallback('cancel', {steps: this.steps.toArray()});
    }
    public addMoreText(){
        setTimeout(() => {


        const newWindowWidth = $(window).width();
        if(newWindowWidth < 768){
        $(".app-wizard-step.active .subtitle-wrapper .step-title").css({"height":"auto","display":"block"});
        const subtitleTextLength = $(".app-wizard-step.active .subtitle-wrapper .step-title").height();
        $(".read_more").css("display","none");
        $(".app-wizard-step.active .subtitle-wrapper").removeClass("readmore_subtitle");

        if(subtitleTextLength>44){
            $(".app-wizard-step.active .subtitle-wrapper .step-title").css({"height":"44px","display":"-webkit-box"});
            $(".app-wizard-step.active .read_more").css("display","block");
            $(".app-wizard-step.finished .read_more").css("display","none");
            $(".app-wizard-step.default .read_more").css("display","none");
            $(".app-wizard-step>a").css("height","100px")
            }
        }
    });

    }
    public readMoreSubtitle(){
        $(".app-wizard-step.active .subtitle-wrapper").addClass("readmore_subtitle");
        $(".app-wizard-step.active .read_more").css("display","none");
        $(document).on("mouseup",function(e:any)
        {
            const container = $(".subtitle-wrapper");
            // if the target of the click isn't the container nor a descendant of the container
            if (!container.is(e.target) && container.has(e.target).length === 0)
            {
                $(".app-wizard-step.active .subtitle-wrapper").removeClass("readmore_subtitle");
                $(".app-wizard-step.active .read_more").css("display","block");
                $(document).off("mouseup");
            }
        });
    }

    private _isFirstStep(stepRef: WizardStepComponent) {
        return this.steps.first === stepRef;
    }

    private _isLastStep(stepRef: WizardStepComponent) {
        return this.steps.last === stepRef;
    }

    private onDataChange(newVal) {
        this.fieldDefs = createArrayFrom(newVal);
    }

    private updateStepFocus() {
        setTimeout(() => {
            const currentStepElement = this.nativeElement.querySelector(".app-wizard-heading li.active a") as HTMLElement;
            currentStepElement?.focus();
        });
    }

    // Define the property change handler. This Method will be triggered when there is a change in the widget property
    onPropertyChange(key: string, nv: any, ov?: any) {
        // Monitoring changes for properties and accordingly handling respective changes

        if (key === 'stepstyle') {
            this.stepClass =  nv === 'justified' ? 'nav-justified' : '';
        } else if (key === 'dataset') {
            this.onDataChange(nv);
        } else if (key === 'defaultstep') {
            this.setDefaultStep(this.getStepRefByName(nv));
        } else if (key === 'actionsalignment') {
            this.nativeElement.querySelector('div.app-wizard-actions')?.classList.replace(ov, nv);
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    ngAfterContentInit() {
        super.ngAfterContentInit();
        this.promiseResolverFn();
        // See `syncNestedHeaderVerticalClass()`'s doc comment: `promiseResolverFn()` above
        // schedules `initWidget()`'s one-time read of the host `class` DOM attribute as a
        // microtask (a `.then()` already attached in the constructor). Queuing our own class
        // application as a FRESH microtask here runs it strictly AFTER that one (microtasks are
        // FIFO), so it can never race that one-time read.
        Promise.resolve().then(() => {
            this.nestedHeaderVerticalClassReady = true;
            this.syncNestedHeaderVerticalClass();
        });
        this.wizContext.hasNextStep = () => this.hasNextStep;
        this.wizContext.hasPreviousStep = () => this.hasPrevStep;
        this.wizContext.hasNoNextStep = () => this.showDoneBtn;
        this.wizContext.cancelable = () => this.cancelable;
        this.wizContext.skippable = () => this.currentStep?.enableskip;
        this.wizContext.next = () => this.next();
        this.wizContext.previous = () => this.prev();
        this.wizContext.done = () => this.done();
        this.wizContext.cancel = () => this.cancel();
        this.wizContext.skip = () => this.skip();
        this.wizContext.nextbtnlabel = () => this.nextbtnlabel;
        this.wizContext.previousbtnlabel = () => this.previousbtnlabel;
        this.wizContext.donebtnlabel = () => this.donebtnlabel;
        this.wizContext.cancelbtnlabel = () => this.cancelbtnlabel;
        this.wizContext.actionsalignment = () => this.actionsalignment;
        this.wizContext.disableNext = () => !this.enableNext;
        this.wizContext.disablePrevious = () => !this.enablePrev;
        this.wizContext.disableDone = () => !this.enableDone;

        // Wizard-header decoupling seam (002-stepper-header-widget): the header reads the live
        // `steps` QueryList reference (mutations via `.reset()` on the same instance stay visible)
        // and proxies through these functions instead of importing WizardComponent directly,
        // so `@wm/components/containers/wizardstepper` has no dependency on this package.
        this.wizContext.steps = this.steps;
        this.wizContext.getWizardClass = () => this.wizardHostClassString();
        this.wizContext.getStepClass = () => this.stepClass;
        this.wizContext.onHeaderClick = (event: Event, step: WizardStepComponent) => this.onWizardStepperClick(event, step);
        this.wizContext.onHeaderKeyDown = (event: KeyboardEvent) => this.onkeydown(event);
        this.wizContext.shouldRenderStepNumberSpan = (step: WizardStepHeaderModel) => this.shouldRenderWizardStepNumberSpan(step);
        this.wizContext.shouldShowPrimaryStepIcon = (step: WizardStepHeaderModel) => this.shouldShowPrimaryStepIcon(step);
        this.wizContext.hasNonEmptyDoneIconClass = (step: WizardStepHeaderModel) => this.hasNonEmptyDoneIconClass(step);
        this.wizContext.stepIconClassOrDefault = (step: WizardStepHeaderModel) => this.stepIconClassOrDefault(step);
        this.wizContext.showWizardStepIcons = () => this.showWizardStepIcons;
        this.wizContext.isTabStepperWizard = () => this.isTabStepperWizard;
        this.wizContext.readMoreSubtitle = () => this.readMoreSubtitle();

        // MEMORY LEAK FIX: Store subscription for cleanup
        this.stepsSubscription = this.steps.changes.subscribe( () => {
            if (this.steps.length > 1 && this.type === 'dynamic' && this._isFirstLoad) {
                this.setDefaultStep(this.getStepRefByIndex(this.defaultstepindex));
                this._isFirstLoad = false;
            }
        });

        // Standalone-by-reference headers (US2/T037/T040): `this.name` and this wizard's entry
        // in `viewParent.Widgets` are populated by the `initPromise`-deferred `setInitProps()`/
        // `initWidget()` call (see the constructor and `base.component.ts`), which resolves via
        // a MICROTASK scheduled by `this.promiseResolverFn()` just above — i.e., strictly AFTER
        // this synchronous `detectChanges()` pass returns, not during it. Angular does not
        // automatically re-check bindings just because a value changed after the fact, so
        // WITHOUT this, `hasExternalHeader` below (and a standalone header's own `wizContext`
        // read elsewhere) would be evaluated against a `name`/registry that hasn't landed yet on
        // the very first render, in an environment with no automatic subsequent CD tick (a bare
        // TestBed harness, or possibly Studio's canvas pipeline — an ordinary bootstrapped
        // Angular app self-corrects via its own zone-driven `ApplicationRef.tick()`, but this
        // must not depend on that). A `setTimeout` macrotask is guaranteed by the JS event loop
        // to run only after ALL pending microtasks (including the one above) have drained,
        // so forcing one more check here is sufficient regardless of the host environment.
        setTimeout(() => {
            const cdr = this.inj.get(ChangeDetectorRef, null);
            if (cdr && !(cdr as any).destroyed) {
                cdr.detectChanges();
            }
        });
    }
    private isSelectableStep(stepRef: WizardStepComponent): boolean {
            return stepRef.show && !stepRef.disabled;
    }
    private getSelectableStepBeforeIndex(index: number): WizardStepComponent {
            for (let i = index - 1; i >= 0; i--) {
                const step = this.getStepRefByIndex(i);
                if (this.isSelectableStep(step)) {
                    return step;
                }
            }
            if (index === 0) {
                const step = this.getStepRefByIndex(this.steps.length - 1);
                if (this.isSelectableStep(step)) {
                    return step;
                }
            }
        }
    private getSelectableStepAfterIndex(index: number): WizardStepComponent {
                for (let i = index + 1; i < this.steps.length; i++) {
                    const step = this.getStepRefByIndex(i);
                    if (this.isSelectableStep(step)) {
                        return step;
                    }
                }
                if (index === this.steps.length - 1) {
                    const step = this.getStepRefByIndex(0);
                     if (this.isSelectableStep(step)) {
                        return step;
                     }
                }
    }

    public getWidgets(widgteName: string, index?: number) {
        let $target;
        const retVal = [];

        if (!widgteName) {
            return;
        }

        if (!isDefined(index)) {
            forEach(this.steps.toArray(), (el) => {
                $target = get(el.currentWizardWidgets, widgteName);
                if ($target) {
                    retVal.push($target);
                }
            });

            return retVal;
        }
        index = +index || 0;

        $target = get(this.steps.toArray(), index);

        if ($target) {
            return [get($target.currentWizardWidgets, widgteName)];
        }
    }


    ngAfterViewInit() {
        super.ngAfterViewInit();
        styler(
            this.nativeElement.querySelector('.panel-body') as HTMLElement,
            this,
            APPLY_STYLES_TYPE.INNER_SHELL
        );
        setTimeout(() => { if($(window).width()<768) {
            $(".app-wizard").removeClass("vertical");
        }
        });
    }
    ngAfterViewChecked() {
        this.nativeElement.querySelectorAll('div.app-wizard-actions').forEach(el => el?.classList.add(this.actionsalignment));
        this.nativeElement.querySelectorAll('div.app-wizard-actions-right').forEach(el => el?.classList.remove('app-container'));
    }
    public getActiveStepIndex(): number {
        return findIndex(this.steps.toArray(), {isCurrent: true});
    }
    onkeydown(event) {
        let newStep;
        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                newStep = this.autoActivation ? null : this.getSelectableStepBeforeIndex(this.getSelectedStepIndex());
                break;

            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                newStep = this.autoActivation ? null : this.getSelectableStepAfterIndex(this.getSelectedStepIndex());
                break;
            case 'Enter':
            case ' ':
            case 'Spacebar':
                event.preventDefault();
                setTimeout(() => {
                    const activeElement  = this.nativeElement.querySelector('li.active');
                    const stepLi = activeElement?.closest('li[data-stepid]');
                    const isInWizardStepper = activeElement?.closest('.app-wizard-heading');

                    if (stepLi && isInWizardStepper) {
                    const stepId = stepLi.getAttribute('data-stepid');
                    const stepIndex = this.steps.toArray().findIndex(step => step.widgetId === stepId);
                    const currentStep = this.steps.toArray()[stepIndex];

                        if (currentStep && currentStep !== this.currentStep) {
                            this.onWizardStepperClick(event, currentStep);

                            // Update tabindex for accessibility
                            const allStepItems = this.nativeElement.querySelectorAll('li[data-stepid]');
                            allStepItems.forEach((el: Element) => {
                            (el as HTMLElement).setAttribute('tabindex', '-1');
                            });

                            const stepAnchor = stepLi.querySelector('a');
                            if (stepAnchor) {
                            stepAnchor.setAttribute('tabindex', '0');
                            stepAnchor.focus();
                            }
                        }
                    }
                }, 0);
                break;
            default:
                return;
        }
       if (newStep) {
            this.nativeElement.querySelector('li.active')?.classList.remove('active');
             this.nativeElement.querySelector(`li[data-stepid="${newStep.widgetId}"]`)?.classList.add('active');
             const stepLi = this.nativeElement.querySelector(".app-wizard-heading li.active a") as HTMLElement;
             const allStepItems = this.nativeElement.querySelectorAll('li[data-stepid] a');
             allStepItems.forEach((el: Element) => {
                (el as HTMLElement).setAttribute('tabindex', '-1');
             });
            stepLi?.setAttribute('tabindex', '0');
            stepLi?.focus();
        }
    }
    getSelectedStepIndex() {
        const index = this.steps.toArray().findIndex(step =>
            this.nativeElement.querySelector(`li[data-stepid="${step.widgetId}"]`)?.classList.contains("active"));
        return index >= 0 ? index : this.getActiveStepIndex();
    }

    /**
     * Standalone-by-reference headers (002-stepper-header-widget, US2): whether some
     * `wm-wizardstepper` elsewhere on the page has its `wizardname` pointing at this wizard —
     * distinguishes an externally-bound header from a nested one (`explicitHeader`), so this
     * wizard's own class/state helpers know which header is authoritative.
     *
     * Deliberately a stateless getter that scans the shared `Widgets` registry on every read,
     * rather than an imperative register/unregister handshake: this component's OWN
     * registration into `viewParent.Widgets` is itself DEFERRED (see the `initPromise` passed to
     * `super()` above — registration only completes once `ngAfterContentInit` resolves it),
     * which fires strictly after `ngOnInit`. A header's one-shot `ngOnInit`-time "register with
     * my wizard" call would therefore always run before this wizard exists in the registry,
     * regardless of which one is declared first in markup — and there is no reliable later hook
     * to retry from. Scanning at READ time sidesteps the ordering question entirely: whatever
     * has registered into `Widgets` by the time this getter is actually evaluated is correct,
     * the same principle already relied on for `wizContext` resolution in
     * `wizardstepper.component.ts`.
     */
    get hasExternalHeader(): boolean {
        const widgets = (this.viewParent as any)?.Widgets;
        if (!widgets) {
            return false;
        }
        // Exclude `explicitHeader` by NAME, not reference: `Widgets[name]` holds the widget's
        // `WidgetProxyProvider` Proxy (see `base.component.ts#createProxy`), which is never
        // `===` to the raw component instance Angular's `@ContentChild` resolves — a nested
        // header is often ALSO authored with a `wizardname` pointing at its own parent
        // (redundant self-reference for robust 002-style association), and without this
        // exclusion that self-reference makes a nested header indistinguishable from a
        // genuinely standalone one bound by reference, permanently short-circuiting
        // `isNestedHeaderVertical` to false below.
        const explicitHeaderName = this.explicitHeader?.name;
        return Object.keys(widgets).some(key => {
            const w = widgets[key];
            return w && (!explicitHeaderName || w.name !== explicitHeaderName) && w.widgetType === 'wm-wizardstepper' && w.wizardname === this.name;
        });
    }

    /**
     * Restores the pre-002 vertical layout for a nested header (contracts/wizard-
     * header-class-hook.md): reflects the active header's `wizardstepper-vertical` class token onto
     * this wizard's host so `wizard.less`'s `.app-wizard.wizardstepper-vertical` grid rule fires
     * again. The token is `wizardstepper-`-prefixed because direction is a wizardstepper-only token
     * (wizard.json defines no variantGroups); it pairs with `wizardstepper-horizontal`.
     *
     * Reads the explicitly-authored nested header's (`explicitHeader`) own `class`.
     *
     * Never derived from a STANDALONE header — the explicit `hasExternalHeader` check
     * structurally guarantees FR-005/FR-006.
     */
    get isNestedHeaderVertical(): boolean {
        if (this.hasExternalHeader) {
            return false;
        }
        const headerClass = this.explicitHeader?.class;
        return !!headerClass?.includes('wizardstepper-vertical');
    }

    /**
     * Deliberately NOT a `@HostBinding` (contracts/wizard-header-class-hook.md's rule is
     * behavioral, not tied to that mechanism): Angular evaluates a component's own host bindings
     * SYNCHRONOUSLY, in the same change-detection pass as `ngAfterContentInit`/
     * `ngAfterContentChecked`, but `this.promiseResolverFn()` (called at the top of
     * `ngAfterContentInit`) only *schedules* `initWidget()` -> `processAttrs()` -> a one-time
     * read of the host element's CURRENT `class` DOM attribute into `this.class` (see
     * `setInitProps()` in `base.component.ts`) as a MICROTASK -- `.then()` callbacks never run
     * synchronously even on an already-resolved promise. A `@HostBinding`, or any synchronous
     * mutation of this same attribute from `ngAfterContentInit`/`ngAfterContentChecked`, would
     * therefore land BEFORE that one-time read on the very first change-detection pass,
     * permanently baking `wizardstepper-vertical` into `this.class` whenever a nested header starts out
     * vertical on first render -- a direct R7 violation. `nestedHeaderVerticalClassReady` gates
     * `ngAfterContentChecked` until the microtask queued alongside `promiseResolverFn()` (FIFO
     * order guarantees it runs after `initWidget()`'s) has actually flipped it, so the very first
     * class application always happens after `this.class` is safely captured; every subsequent
     * change-detection pass is unconditionally safe since that one-time read has already fired.
     */
    private nestedHeaderVerticalClassReady = false;

    private syncNestedHeaderVerticalClass(): void {
        this.nativeElement.classList.toggle('wizardstepper-vertical', this.isNestedHeaderVertical);
    }

    ngAfterContentChecked() {
        if (this.nestedHeaderVerticalClassReady) {
            this.syncNestedHeaderVerticalClass();
        }
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Unsubscribe from steps changes
        if (this.stepsSubscription) {
            this.stepsSubscription.unsubscribe();
            this.stepsSubscription = null;
        }

        // MEMORY LEAK FIX: Remove jQuery event handlers
        $(document).off("mouseup");

        // MEMORY LEAK FIX: Clear wizard context to release references to step data
        if (this.wizContext) {
            Object.keys(this.wizContext).forEach(key => {
                delete this.wizContext[key];
            });
            this.wizContext = null;
        }

        // MEMORY LEAK FIX: Clear dynamic context
        if (this._dynamicContext) {
            Object.keys(this._dynamicContext).forEach(key => {
                delete this._dynamicContext[key];
            });
            this._dynamicContext = null;
        }

        // MEMORY LEAK FIX: Clear dynamic wizard array
        if (this.dynamicWizard) {
            this.dynamicWizard = [];
        }

        // MEMORY LEAK FIX: Clear current step reference
        this.currentStep = null;

        super.ngOnDestroy();
    }
}
