import {
    AfterContentInit,
    AfterViewInit,
    ElementRef,
    Inject,
    inject,
    Injectable,
    Injector,
    OnDestroy,
    OnInit,
    Optional,
    ViewContainerRef
} from '@angular/core';
import {EventManager} from '@angular/platform-browser';

import {ReplaySubject, Subject, Subscription} from 'rxjs';

import {
    $invokeWatchers,
    $parseEvent,
    $unwatch,
    $watch,
    addClass,
    App,
    findParent,
    isDefined,
    removeAttr,
    removeClass,
    setAttr,
    setCSS,
    setCSSFromObj,
    switchClass,
    removeNode
} from '@wm/core';

import {getWidgetPropsByType} from '../../framework/widget-props';
import {isStyle} from '../../framework/styler';
import {register, renameWidget} from '../../framework/widget-registry';
import {ChangeListener, Context, IWidgetConfig, WidgetConfig} from '../../framework/types';
import {widgetIdGenerator} from '../../framework/widget-id-generator';
import {DISPLAY_TYPE, EVENTS_MAP} from '../../framework/constants';
import {WidgetProxyProvider} from '../../framework/widget-proxy-provider';
import {getWatchIdentifier} from '../../../utils/widget-utils';
import {camelCase, extend, forEach, isArray, isObject, join, last, map} from "lodash-es";

declare const $;

// Gets list of classes to add and remove and applies on the $el
const updateClasses = (toAdd, toRemove, el) => {
    if (toRemove && toRemove.length) {
        removeClass(el, join(toRemove, ' '));
    }
    if (toAdd && toAdd.length) {
        addClass(el, join(toAdd, ' '));
    }
};

// To add and remove styles on the $el
const updateStyles = (nv, ov, el) => {
    if (ov && isObject(ov)) {
        const keys = Object.keys(ov || {});
        keys.forEach(function(key) {
            setCSS(el, key, '');
        });
    }
    if (nv && isObject(nv)) {
        setCSSFromObj(el, nv, true);
    }

};

interface Child {
    widget: any,
    nativeElement: any
}

@Injectable()
export abstract class BaseComponent implements OnDestroy, OnInit, AfterViewInit, AfterContentInit {

    /**
     * unique identifier for the widget
     */
    public readonly widgetId: any;

    public isDestroyed: boolean;

    public isAttached = false;

    /**
     * jQuery nativeElement reference of the component root
     */
    public get $element() {
        return $(this.nativeElement);
    }

    /**
     * DOM node reference of the component root
     */
    public readonly nativeElement: HTMLElement;

    /**
     * Type of the component
     */
    protected readonly widgetType: string;

    /**
     * Most of the cases it is same as widgetType
     * for specific widgets like charts widgetType can be wm-chart where as the subtype can be wm-bar-chart
     */
    protected readonly widgetSubType: string;

    /**
     * Proxy for the component instance.
     */
    protected widget: any;
    private widgetProxyRevoke: () => void = () => {};

    /**
     * View parent component
     * eg, Page, Partial, Prefab
     */
    protected viewParent: any;

    protected hostClass?: string;

    /**
     * EventManger to add/remove events
     */
    protected readonly eventManager: EventManager;

    /**
     * App Locale
     */
    public readonly appLocale: any;

    /**
     * Style change subject and observable
     */
    private readonly styleChange = new ReplaySubject();

    /**
     * Property change subject and observable
     */
    private readonly propertyChange = new Subject();

    /**
     * On Ready State change subject and observable
     */
    private readonly readyState = new Subject();

    /**
     * Component destroy subject and observable
     */
    private readonly destroy = new Subject();

    /**
     * Map of event handler callbacks
     */
    private eventHandlers = new Map<string, {callback: Function, locals: any}>();

    /**
     * Array to track destroy listener subscriptions
     * CRITICAL FIX: Store subscriptions to prevent memory leaks
     * Without this, subscription objects linger even after destroy.complete()
     */
    private destroySubscriptions: Array<any> = [];
    
    // MEMORY LEAK FIX: Track pending timeouts for cleanup.
    // Marked as protected so derived components can reuse the same
    // tracking Set instead of declaring their own, which breaks
    // TypeScript's inheritance rules for private fields.
    protected pendingTimeouts: Set<number> = new Set();

    /**
     * context of the widget
     * when the widget is preset inside a repeater this context will have the repeater related properties
     */
    public context: any;

    /**
     * Initial state of the widget.
     * Will be undefined once the initial properties are set on to the component
     */
    private initState: Map<string, any>;

    /**
     * Internal flag to determine whether to wait for the widget initialization or not
     * If the initPromise is provided in the construction wait till the promise is resolved
     * If the initPromise is not provided proceed with the initialization, which is the default behavior.
     */
    private readonly delayedInit: boolean;

    /**
     * Display type of the component. eg, block(Default), inline-block, inline etc
     */
    private readonly displayType: string;

    /**
     * Holds the event registration functions.
     * these functions needs to be executed after onViewInit
     */
    private toBeSetupEventsQueue: Array<Function> = [];

    public __cloneable__ = false;

    public widgetProps: Map<string, any>;

    private $attrs = new Map<string, string>();

    private isMuted = false;

    public viewContainerRef: ViewContainerRef;
    public viewParentApp: App;
    /**
     * To avoid re-rendering of widget, passing unique id as contextKey to createCustomInjector
     * (for List, Dynamic Tabs, Accordion, Nav, Carousel)
     */
    public trackId: string;

    customWidgetSubType: string;

    protected constructor(
        protected inj: Injector,
        @Inject(WidgetConfig) config: IWidgetConfig,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext?: any,
        initPromise?: Promise<any> // Promise on which the initialization has to wait
    ) {
        const elementRef = inj.get(ElementRef);
        this.nativeElement = elementRef.nativeElement;
        //making the code compatible in both the JIT and AOT modes
        this.viewParentApp = inj ? inj.get(App) : inject(App);
        this.widgetType = config.widgetType;
        this.widgetSubType = config.widgetSubType || config.widgetType;
        this.viewContainerRef = inj.get(ViewContainerRef);
        // this.viewParent = (inj as any).view.component;
        // this.viewParent = (this.viewContainerRef as any).parentInjector._lView[8];
        // this.viewParent = _viewParent || (this.viewContainerRef as any).parentInjector._lView[8];
        // https://github.com/angular/angular/blob/main/packages/core/src/render3/interfaces/view.ts

        let lView = (this.inj as any)._lView;
        this.viewParent = findParent(lView, this.viewParentApp);
        //console.log("---*************--context--*************---", lView[8]);
        this.context = (this.inj as any)._lView[8];

        this.displayType = config.displayType || DISPLAY_TYPE.BLOCK;
        // this.context = (inj as any).view.context;
        // this.context = (this.viewContainerRef as any)._hostLView.debug.context;
        // let hasImplicitContext = (this.viewContainerRef as any)._hostLView.find(t => t && !!t.$implicit);
        // when $implicit is not available, this object contains some ngFor context or listitem context of the widget then
        // we use the direct parent for example: nav component is the parent for anchor => anchor gets viewParent as Nav
        // In other case, where we have implicitContext there we can make use of page/app level context hence viewParent.viewParent to get page level context
        /*if (hasImplicitContext && this.viewParent.viewParent) {
            if (this.viewParent.widgetType !== 'wm-card' && this.viewParent.widgetType !== 'wm-iframedialog'
                && this.viewParent.widgetType !== 'wm-partialdialog') {
                this.viewParent = this.viewParent.viewParent;
            }
        }
        if (!hasImplicitContext || (!this.viewParent.widgetType)) {
            this.context = (this.viewContainerRef as any)._hostLView.find(t => t && !!t.$implicit);
        } else {
            this.context = (this.viewContainerRef as any).parentInjector._lView[8];
        }*/

        /*if(_viewParent && !hasImplicitContext) {
            this.context = (this.viewContainerRef as any)._hostLView[8];
        } else {
            this.context = hasImplicitContext;
        }*/
        // if (['wm-list', 'wm-nav'].includes(this.viewParent.widgetType) || ['wm-carousel-template', 'wm-card'].includes(this.widgetType)) {
        //     this.context = (this.viewContainerRef as any)._hostLView.debug.context;
        // } else {
        //     this.context = (this.viewContainerRef as any).parentInjector._lView[8];
        // }
        this.widget = this.createProxy();
        this.eventManager = inj.get(EventManager);
        (this.nativeElement as any).widget = this.widget;

        this.appLocale = inj.get(App).appLocale || {};

        this.initContext();

        this.hostClass = config.hostClass;

        if (this.hostClass) {
            addClass(this.nativeElement, this.hostClass);
        }

        this.widgetId = this.generateWidgetId();
        this.trackId = this.generateWidgetId();
        setAttr(this.nativeElement, 'widget-id', this.widgetId, true);

        // register default property change handler and style change handler
        this.registerStyleChangeListener(this.onStyleChange, this);
        this.registerPropertyChangeListener(this.onPropertyChange, this);

        // if the initPromise is provided, wait till the promise is resolved to proceed with the widget initialization
        if (!initPromise) {
            this.initWidget();
        } else {
            this.delayedInit = true;
            initPromise.then((resolveFn) => {
                let formFieldCW = this.widgetSubType === 'wm-form-field-custom-widget',
                    cw          = this.widgetSubType.startsWith('wm-custom-');
                if( formFieldCW || cw ) {
                    this.customWidgetSubType = formFieldCW ? 'wm-form-field-' + last(this["formWidget"].config.widgetType.split('-')) : this["config"].widgetType;
                }

                this.initWidget();
                this.setInitProps();
                resolveFn && resolveFn()
            });
        }
        if(explicitContext) {
            extend(this.context, explicitContext);
        }
    }

    public getNativeElement(): HTMLElement {
        return this.nativeElement;
    }

    public getWidgetType(): string {
        return this.widgetType;
    }

    public getWidgetSubType(): string {
        return this.widgetSubType;
    }

    public getWidget(): any {
        return this.widget;
    }

    public setProperty(propName, propValue) {
        this.widget[propName] = propValue;
    }

    public getViewParent(): any {
        return this.viewParent;
    }

    public notifyStyleChange(key: string, nv: any, ov: any) {
        this.styleChange.next({key, nv, ov});
    }

    public notifyPropertyChange(key: string, nv: any, ov: any) {
        this.propertyChange.next({key, nv, ov});
    }

    private styleChangeSubscription: Subscription;
    public registerStyleChangeListener(fn: ChangeListener, ctx?: any) {
        if (ctx) {
            fn = fn.bind(ctx);
        }
        this.styleChangeSubscription = this.styleChange.subscribe(({key, nv, ov}) => fn(key, nv, ov));
    }

    private readyStateSubscription: Subscription;
    public registerReadyStateListener(fn: Function, ctx?: any) {
        if (ctx) {
            fn = fn.bind(ctx);
        }
        if (this.readyState.isStopped) {
            fn();
            return;
        }
        this.readyStateSubscription = this.readyState.subscribe(() => fn());
    }

    private propertyChangeSubscription: Subscription;
    public registerPropertyChangeListener(fn: ChangeListener, ctx?: any) {
        if (ctx) {
            fn = fn.bind(ctx);
        }
        this.propertyChangeSubscription = this.propertyChange.subscribe(({key, nv, ov}) => fn(key, nv, ov));
    }

    private destroySubscription: Subscription
    public registerDestroyListener(fn: any, ctx?: any) {
        if (!fn) {
            return;
        }

        let cleanup: () => void;

        if (typeof fn === 'function') {
            cleanup = ctx ? fn.bind(ctx) : fn;
        } else if (fn && typeof fn.unsubscribe === 'function') {
            cleanup = () => fn.unsubscribe();
        } else if (fn && typeof fn.destroy === 'function') {
            cleanup = () => fn.destroy();
        }

        if (!cleanup) {
            return;
        }

        if (this.destroy.isStopped) {
            cleanup();
            return;
        }

        // CRITICAL FIX: Store subscription to prevent memory leaks
        // The subscription object itself can retain memory even after destroy.complete()
        // By storing and explicitly unsubscribing, we ensure proper cleanup
        const subscription = this.destroy.subscribe(() => {}, () => {}, () => cleanup());
        this.destroySubscriptions.push(subscription);
    }

    public getDisplayType(): string {
        return this.displayType;
    }

    protected createProxy(): any {
        const { proxy, revoke } = WidgetProxyProvider.create(this, this.widgetSubType, getWidgetPropsByType(this.widgetSubType));
        this.widgetProxyRevoke = revoke || (() => {});
        return proxy;
    }

    protected initContext() {
        // const context = (this.inj as any).view.context;
        const context = this.context || {};

        const parentContexts = this.inj.get(Context, {});

        // assign the context property accordingly
        if (this.viewParent !== context) {
            this.context = context;
        } else {
            this.context = {};
        }

        if (parentContexts) {
            let parentContextObj = {};
            if (isArray(parentContexts)) {
                forEach(parentContexts, (contextObj) => {
                    Object.assign(parentContextObj, contextObj);
                });
            } else {
                parentContextObj = parentContexts;
            }
            this.context = Object.assign({}, parentContextObj, this.context);
        }
    }

    /**
     * set the value on the proxy object ie, widget
     * setting the property on the proxy will invoke the change listeners
     * @param {string} key
     * @param value
     */
    public setWidgetProperty(key: string, value: any) {
        this.widget[key] = value;
    }

    public getAttr(attrName: string): string {
        return this.$attrs.get(attrName);
    }

    /**
     * returns app instance
     * @returns {App}
     */
    public getAppInstance() {
        return this.inj.get(App);
    }

    /**
     * Generates a unique id
     * Default pattern is `widget-id-${id}`
     * Components can override this method to generate a different id eg, bar-chart-1
     */
    protected generateWidgetId(): string {
        return widgetIdGenerator.nextUid();
    }

    /**
     * Handles the common functionality across the components
     * eg,
     *  1. value of the class property will be applied on the host element
     *  2. based on the value of show property component is shown/hidden
     *
     * @param {string} key
     * @param nv
     * @param ov
     */
    protected onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'show') {
            this.nativeElement.hidden = !nv;
        } else if (key === 'hint') {
            setAttr(this.nativeElement, 'title', nv, true);
        } else if (key === 'class') {
            switchClass(this.nativeElement, nv, ov);
        } else if (key === 'name' || key === 'tabindex') {
            setAttr(this.nativeElement, key, nv, true);
            if (key === 'name' && nv) {
                renameWidget(this.viewParent, this.widget, nv, ov);
            }
        } else if (key === 'conditionalclass') {
            // update classes if old and nv value are different
            updateClasses(nv.toAdd, nv.toRemove, this.nativeElement);
        } else  if (key === 'autoplay') {
            const tagName = this.widgetType === 'wm-audio' ? 'audio' : 'video';
            // Trigger media(audio/video) element load method after changing autoplay property
            this.nativeElement.querySelector(tagName).load();
        } else if (key === 'conditionalstyle') {
            // update styles if old and nv value are different
            updateStyles(nv, ov, this.nativeElement);
        } else if (key === 'animation') {
            // update styles if old and nv value are different
            addClass(this.nativeElement, "animated " + nv);
        }  else if (key === 'disabled') {
            // WMS-19321: In IE, widget is in disabled state when disabled="false" attribute is present
            (nv === true) ? setAttr(this.nativeElement, 'disabled', 'true', true) : removeAttr(this.nativeElement, 'disabled', true);
        } else if (key === "autofocus") {
            if (nv) {
                this.focus();
            }
        }
    }

    /**
     * Default style change handler
     */
    protected onStyleChange(k: string, nv: any, ov?: any) {}

    /**
     * Register the widget with the widgetRegistry
     */
    protected registerWidget(widgetName: string) {
        // CRITICAL FIX: Don't attempt registration if parent is destroyed
        // This prevents hundreds of warnings during async template compilation
        // when parent components are destroyed before child widgets finish initializing
        if (!this.viewParent || !this.viewParent.Widgets) {
            // Parent was destroyed during async initialization - skip registration silently
            // Widget will be garbage collected with its DOM element
            return;
        }
        
        this.registerDestroyListener(register(this.widget, this.viewParent, this.widgetId, widgetName));
    }

    /**
     * override the
     */
    protected getMappedEventName(eventName) {
        return EVENTS_MAP.get(eventName) || eventName;
    }

    /**
     * invoke the event handler
     * Components can override this method to execute custom logic before invoking the user callback
     */
    protected handleEvent(node: HTMLElement, eventName: string, eventCallback: Function, locals: any, meta?: string) {
        // CRITICAL FIX: Store the cleanup function returned by eventManager.addEventListener
        // This is the BASE component - ALL widgets inherit this method
        // Without storing cleanup, every event listener in every component leaks memory
        const removeListener = this.eventManager.addEventListener(
            node,
            eventName,
            e => {
                locals.$event = e;
                if (meta === 'delayed') {
                   // MEMORY LEAK FIX: Track timeout for cleanup
                   const timeoutId = window.setTimeout(() => {
                       this.pendingTimeouts.delete(timeoutId);
                       eventCallback();
                   }, 150);
                   this.pendingTimeouts.add(timeoutId);
                } else {
                    return eventCallback();
                }
            }
        );
        // Register cleanup to be called in ngOnDestroy
        this.registerDestroyListener(removeListener);
        return removeListener;
    }

    /**
     * parse the event expression and save reference to the function inside eventHandlers map
     * If the component provides a override for an event through @Event decorator invoke that
     * else invoke the resolved function
     *
     * @param {string} eventName
     * @param {string} expr
     */
    protected processEventAttr(eventName: string, expr: string, meta?: string, child?: Child) {
        const fn = $parseEvent(expr);
        let locals = this.context;
        locals.widget = child ? child.widget : this.widget;
        let boundFn = fn.bind(undefined, child ? this.viewParent.viewParent : this.viewParent, locals);

        let widget          = child ? child.widget : this,
            nativeElement   = child ? child.nativeElement : this.nativeElement;

        const eventCallback = () => {
            let boundFnVal;
            $invokeWatchers(true);
            try {
                locals.$event = locals.$event || new window.CustomEvent(eventName);
                // If the event is bound directly to the variable then we need to internally handle
                // the promise returned by the variable call.
                boundFnVal = boundFn();
                if (boundFnVal instanceof Promise) {
                    return boundFnVal.then( response => response, err => err);
                } else {
                    return boundFnVal;
                }
            } catch (e) {
                console.error(e);
            }
        };
        if(child && !child.widget.eventHandlers)
            child.widget.eventHandlers = new Map<string, {callback: Function, locals: any}>()

        widget.eventHandlers.set(this.getMappedEventName(eventName), {callback: eventCallback, locals});
        // prepend eventName with on and convert it to camelcase.
        // eg, "click" ---> onClick
        const onEventName = camelCase(`on-${eventName}`);
        // save the eventCallback in widgetScope.

        widget[onEventName] = eventCallback;

        // events needs to be setup after viewInit
        this.toBeSetupEventsQueue.push(() => {
            const unsubscribeHandleEvent = this.handleEvent(nativeElement, this.getMappedEventName(eventName), eventCallback, locals, meta)
            this.registerDestroyListener(() => {
                unsubscribeHandleEvent();
                widget[onEventName] = undefined;
                widget.eventHandlers.clear()
                boundFn = undefined;
                locals = undefined;
            });
        });
    }

    /**
     * Process the bound property
     * Register a watch on the bound expression
     */
    protected processBindAttr(propName: string, expr: string, child ?: any) {
        if(!child)
            this.initState.delete(propName);
        let viewParent  = child ? child.widget.viewParent.viewParent : this.viewParent,
            context     = child ? child.widget.context : this.context,
            widget      = child ? child.widget : this.widget,
            widgetProps = child ? child.widget.widgetProps : this.widgetProps,
            widgetId    = child ? child.widget.widgetId : this.widgetId;
        
        // CRITICAL FIX: Don't create closure for isMuted check
        // Arrow function () => isMuted captures entire scope (viewParent, context, widget, widgetProps)
        // Instead, reference the widget property directly to minimize closure scope
        const widgetRef = child ? child.widget : this;
        
        this.registerDestroyListener(
            $watch(
                expr,
                viewParent,
                context,
                nv => {
                    if(propName.startsWith('base-') && widget.updateData)
                        widget.updateData(propName, nv);
                    widget[propName] = nv
                },
                getWatchIdentifier(widgetId, propName),
                propName === 'datasource',
                widgetProps.get(propName),
                () => widgetRef.isMuted  // Only captures widgetRef, not all local variables
            )
        );
    }

    /**
     * Remove watch on the bound property
     */
    protected removePropertyBinding(propName: string) {
        $unwatch(getWatchIdentifier(this.widgetId, propName));
    }

    /**
     * invoke the event callback method
     * @param {string} eventName
     * @param extraLocals
     */
    public invokeEventCallback(eventName: string, extraLocals?: any) {
        const callbackInfo = this.eventHandlers.get(eventName);
        if (callbackInfo) {
            const fn = callbackInfo.callback;
            const locals = callbackInfo.locals || {};

            if (fn) {
                return fn(Object.assign(locals, extraLocals));
            }
        }
    }
    /**
     * Process the attribute
     * If the attribute is an event expression, generate a functional representation of the expression
     *      and keep in eventHandlers
     * If the attribute is a bound expression, register a watch on the expression
     */
    protected processAttr(attrName: string, attrValue: string, child?: Child) {
         // console.log("====attrName=====", attrName, "=====typeof attrname=====", typeof attrName, "-----attrValue----", attrValue);
        const {0: propName, 1: type, 2: meta, length} = attrName.split('.');
        if (type === 'bind') {
            // if the show property is bound, set the initial value to false
            if (propName === 'show' && !this.widgetSubType.startsWith('wm-custom-')) {
                this.nativeElement.hidden = true;
            }
            this.processBindAttr(propName, attrValue, child);
        } else if (type === 'event' && !this.nativeElement.hasAttribute('wmwidgetcontainer')) {
            this.processEventAttr(propName, attrValue, meta, child);
        } else if (length === 1) {
            // remove class and name attributes. Component will set them on the proper node
            if (attrName === 'class') {
                removeClass(this.nativeElement, attrValue);
            } else if (attrName === 'tabindex' || attrName === 'name') {
                removeAttr(this.nativeElement, attrName, true);
            }

            this.initState.set(propName, attrValue);
        } else {
            // custom attributes provided on elDef;
        }
    }

    /**
     * This is required as the native element attributes are case insensitive(camelcase) like customExpressions becomes customexpression
     * and our logic to check like these changes will fail. Before IVY changes, angular maintains a separate object with these attributes
     * as it is like in the camelcase. With IVY all those are gone. So need to maintain a separate list with the camelcasing of attributes
     * @private
     * _tNode.attrs attributes are stored in array(even index: key, odd index: value)
     */
    protected getAttributes() {
        let _tNodeAttrs = (this.inj as any)._tNode.attrs, actualAttrs = Array.from(this.nativeElement.attributes).map(attr => attr.name);
        if(_tNodeAttrs === null) {
            return actualAttrs.sort();
        }
        forEach(_tNodeAttrs, (attr, i: any) => {
            if (typeof attr === 'number') {
                return false;
            }
            if(typeof attr === 'string' && i % 2 == 0) {
                let lowerCaseAttr = attr.toLowerCase();
                if (actualAttrs.includes(lowerCaseAttr)) {
                    let index = actualAttrs.indexOf(lowerCaseAttr)
                    actualAttrs[index] = attr;
                }
            }
        });

        /*
        Sorting attributes as properties like placeholder is not working when it is bound.
        placeholder and placeholder.bind two properties are coming in Array.
        When array is not sorted, initially placeholder.bind value is set then placeholder default value is updated.
        If array is sorted, placeholder.bind value will be set finally.
        This is caused because of the way we are storing attribute names in watcher registry map
         */
        return actualAttrs.sort();
    }

    /**
     * Process the attributes
     */
    private processAttrs() {
        map(this.getAttributes(), (attrName: string) => {
            let attrValue = this.nativeElement.attributes[attrName].value
            this.$attrs.set(attrName, attrValue);
            this.processAttr(attrName, attrValue);
        });
    }

    /**
     * Update the initState with the default property values and the values provided in the markup
     * Process the attributes
     * Register the widget
     */
    protected initWidget() {
        this.initState = new Map<string, any>();

        // get the widget properties
        const widgetProps: Map<string, any> = getWidgetPropsByType(this.widgetSubType);
        if(this.customWidgetSubType) {
            const customWidgetProps: Map<string, any> = getWidgetPropsByType(this.customWidgetSubType);
            customWidgetProps.forEach((v, k) => {
                widgetProps.set(k, v);
            });
        }
        (widgetProps || []).forEach((v, k) => {
            if (isDefined(v.value)) {
                this.initState.set(k, v.value);
            }
        });

        this.widgetProps = widgetProps;

        this.processAttrs();

        if (this.hostClass) {
            addClass(this.nativeElement, this.hostClass);
        }

       this.registerWidget(this.initState.get('name'));
    }

    /**
     * Update the default properties and the properties provided in the markup in component
     * Invoking this method will result in invocation of propertyChange handlers on the component for the first time
     */
    protected setInitProps() {
        if (this.initState.get('name')) {
            this.widget.name = this.initState.get('name');
        }
        this.initState.forEach((v, k) => {
            // name is already set, ignore name
            // if the key is part of to be ignored attributes list do not set it on the component instance
            if (((this.widgetProps || new Map()).get(k) || isStyle(k)) && k !== 'name') {
                this.widget[k] = v;
            }
        });
        this.initState.clear();
        this.initState = undefined;

        this.readyState.next(null);
        this.readyState.complete();
    }

    /**
     * Returns true, if a listener registered for the given event on this widget markup.
     * @param eventName
     * @returns {boolean}
     */
    protected hasEventCallback(eventName): boolean {
        return this.eventHandlers.has(eventName);
    }

    /**
     * Sets the focus on the widget
     */
    protected focus(): void {
        /**
         * Check for the nodes having focus-target attribute inside the element
         * If found, focus the first node (eg, date widget)
         * else, focus the element (eg, text widget)
         */
        let $target = this.$element[0].querySelector('[focus-target]');
        if (!$target) {
            $target = this.$element[0];
        }
        $target.focus();
    }

    // Defining the execute method on BaseComponent. If dataset is binded to widgets ouptut then datasource.execute will be defined
    protected execute(operation, options): any {

    }

    public mute() {
        this.isMuted = true;
    }

    public unmute() {
        this.isMuted = false;
    }

    private customInjectorMap: any = {};

    /**
     * After the Angular 17 upgrade, Angular is no longer sending ngTemplateContext to components in ng-template.
     * Wavemaker widgets inside ng-template require context to evaluate bind expressions.
     * So we're creating an injectionToken that returns the context as a value.
     * We are passing the injectionToken to the ngTemplateOutletInjector.
     * This injects the context into each widget in the ng-template.
     * In the widget component constructor we are getting the injectionToken using dependency injection.
     * If injectionToken is present, we extend the component context with the value of injectionToken.
     * @param contextKey
     * @param context
     * @returns injector
     */
    createCustomInjector(contextKey: string, context: any) {
        if(this.customInjectorMap[contextKey]) {
            return this.customInjectorMap[contextKey].injector;
        }
        const injector = Injector.create({
            providers: [{ provide: 'EXPLICIT_CONTEXT', useFactory: () => context }]
        });
        this.customInjectorMap[contextKey] = { context, injector };
        return injector;
    }

    /**
     * After the host page is attached from cache, this function is called.
     */
    public ngOnAttach() {
        this.isAttached = true;
    }

    /**
     * Before the host page is detached from dom and stored in cache,  this function is called.
     */
    public ngOnDetach() {
        this.isAttached = false;
    }

    /**
     * nativeElement will be available by this time
     * if the delayInit is false, properties meta will be available by this time
     * Invoke the setInitProps if the delayInit is false
     */
    ngOnInit() {
        if (!this.delayedInit) {
            this.setInitProps();
        }
    }

    /**
     * Register the events
     */
    ngAfterViewInit() {
        if (this.toBeSetupEventsQueue.length) {
            for (const fn of this.toBeSetupEventsQueue) {
                fn();
            }
        }
        this.toBeSetupEventsQueue.length = 0;
        this.isAttached = true;
    }

    ngAfterContentInit() {}

    ngOnDestroy() {
        this.isDestroyed = true;

        this.widget = Object.create(null);
        this.widgetProxyRevoke = () => {};
        this.styleChange.complete();
        this.propertyChange.complete();
        // Notify destroy listeners BEFORE tearing down subscriptions
        this.destroy.next(undefined);
        this.destroy.complete();
        
        // CRITICAL FIX: Unsubscribe all destroy listeners AFTER completion
        // Completion triggers registered cleanup callbacks; once they run, we can safely unsubscribe.
        if (this.destroySubscriptions && this.destroySubscriptions.length > 0) {
            this.destroySubscriptions.forEach(sub => {
                if (sub && typeof sub.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            });
            this.destroySubscriptions = [];
        }
        
        this.isAttached = false;
        
        // CRITICAL FIX: Unsubscribe individual subscriptions
        this.styleChangeSubscription?.unsubscribe();
        this.readyStateSubscription?.unsubscribe();
        this.propertyChangeSubscription?.unsubscribe();
        
        // MEMORY LEAK FIX: Clear all pending timeouts
        this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingTimeouts.clear();
        
        // CRITICAL FIX: Clear all references to enable garbage collection
        // Without clearing these, components remain in memory even after destruction
        // This prevents the "$0" DevTools reference issue where detached elements retain memory
        this.customInjectorMap = {};
        this.eventHandlers.clear();
        (this.nativeElement as any).widget = null;
        // MEMORY LEAK FIX: removeNode already calls node.remove(), no need to call it twice
        // Also, removeNode now has defensive checks for test environments
        if (this.nativeElement && this.nativeElement.parentNode) {
            removeNode(this.nativeElement, true);
        }
        this.context = null;
        this.viewContainerRef?.clear();
        (this as any).viewParent = null;
        this.viewParentApp = null;
        (this as any).eventManager = null;
        (this as any).inj = null;
    }
}
