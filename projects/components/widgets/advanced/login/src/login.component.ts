import {
    AfterViewInit,
    Component,
    ContentChild,
    ContentChildren,
    Inject,
    Injector,
    Optional,
    OnDestroy,
    QueryList,
    ViewChild, ChangeDetectionStrategy
} from '@angular/core';

import { APPLY_STYLES_TYPE, MessageComponent, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';
import { FormComponent } from '@wm/components/data/form';
import { ButtonComponent } from '@wm/components/input/button';

import { registerProps } from './login.props';
import {includes} from "lodash-es";

const WIDGET_INFO = {widgetType: 'wm-login', hostClass: 'app-login'};

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true, 
    imports: [ MessageComponent ],
    selector: 'div[wmLogin]',
    templateUrl: './login.component.html',
    providers: [
        provideAsWidgetRef(LoginComponent)
    ]
})
export class LoginComponent extends StylableComponent implements AfterViewInit, OnDestroy {
    static readonly initializeProps = registerProps();
    loginBtnCmp: ButtonComponent;

    @ContentChild(FormComponent) formCmp: FormComponent;
    @ContentChildren(ButtonComponent, {descendants: true}) buttonComponents: QueryList<ButtonComponent>;
    @ViewChild(MessageComponent, { static: true }) messageCmp: MessageComponent;

    loginMessage: { type?: string; caption?: any; show?: boolean; };
    errormessage: any;
    eventsource;
    private boundLoginButtonClick: (event: Event) => void;
    private boundFormSubmit: (e: Event) => void;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_INFO, explicitContext);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);
    }

    onSuccessCB() {
        this.invokeEventCallback('success');
    }

    onErrorCB(error?) {
        this.loginMessage = {
            type: 'error',
            caption: this.errormessage || error || this.appLocale.LABEL_INVALID_USERNAME_OR_PASSWORD,
            show: true
        };
        this.messageCmp.showMessage(this.loginMessage.caption, this.loginMessage.type);
        this.invokeEventCallback('error');
    }

    getLoginDetails(): any {
        return this.formCmp.dataoutput;
    }

    doLogin() {
        if (this.eventsource) {
            this.formCmp.ngform.valid && this.eventsource.invoke({loginInfo: this.getLoginDetails()}, this.onSuccessCB.bind(this), this.onErrorCB.bind(this));
        } else {
            console.warn('Default action "loginAction" does not exist. Either create the Action or assign an event to onSubmit of the login widget');
        }
    }

    initLoginButtonActions() {
        // MEMORY LEAK FIX: Store bound function reference
        this.boundLoginButtonClick = (event) => {
            // if no event is attached to the onSubmit of login widget or loginButton inside it, invoke default login action
            if (!this.nativeElement.hasAttribute('submit.event') && !this.loginBtnCmp.getNativeElement().hasAttribute('click.event') && !this.loginBtnCmp.getNativeElement().hasAttribute('tap.event')) {
                this.doLogin();
            }
        };

        this.loginBtnCmp.getNativeElement().addEventListener('click', this.boundLoginButtonClick);
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();

        // MEMORY LEAK FIX: Store bound function reference
        this.boundFormSubmit = (e) => e.preventDefault();
        // suppresses the default form submission (in browsers like Firefox)
        this.formCmp.getNativeElement().addEventListener('submit', this.boundFormSubmit);

        // get login button component
        this.buttonComponents.forEach(cmp => {
            if (cmp.getNativeElement().getAttribute('name') === 'loginButton' || includes(cmp.getNativeElement().classList, 'app-login-button')) {
                if (this.loginBtnCmp) {
                    return;
                }
                this.loginBtnCmp = cmp;
                this.initLoginButtonActions();
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove event listeners using stored bound function references
        if (this.loginBtnCmp && this.boundLoginButtonClick) {
            this.loginBtnCmp.getNativeElement().removeEventListener('click', this.boundLoginButtonClick);
            this.boundLoginButtonClick = null;
        }

        if (this.formCmp && this.boundFormSubmit) {
            this.formCmp.getNativeElement().removeEventListener('submit', this.boundFormSubmit);
            this.boundFormSubmit = null;
        }

        // MEMORY LEAK FIX: Clear QueryList and ViewChild references
        this.buttonComponents = null;
        this.messageCmp = null;
        this.formCmp = null;
        this.loginBtnCmp = null;

        super.ngOnDestroy();
    }
}
