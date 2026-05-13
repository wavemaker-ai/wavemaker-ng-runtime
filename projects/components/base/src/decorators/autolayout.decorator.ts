import { App, $watch, toBoolean } from '@wm/core';
import { Subject } from 'rxjs';

const ALIGN_MAP: any = {
    'top-left':      { jc: 'flex-start', ai: 'flex-start' },
    'top-center':    { jc: 'center',     ai: 'flex-start' },
    'top-right':     { jc: 'flex-end',    ai: 'flex-start' },
    'middle-left':   { jc: 'flex-start', ai: 'center' },
    'middle-center': { jc: 'center',     ai: 'center' },
    'middle-right':  { jc: 'flex-end',    ai: 'center' },
    'bottom-left':   { jc: 'flex-start', ai: 'flex-end' },
    'bottom-center': { jc: 'center',     ai: 'flex-end' },
    'bottom-right':  { jc: 'flex-end',    ai: 'flex-end' },
    'start':         { jc: 'space-between', ai: 'flex-start' },
    'center':        { jc: 'space-between', ai: 'center' },
    'end':           { jc: 'space-between', ai: 'flex-end' }
};

export function AutoLayout(options: { targetSelector?: string, bindParent?: string } = {}) {
    return function (constructor: Function) {
        const proto = constructor.prototype;
        const _onProp = proto.onPropertyChange;
        const _onStyle = proto.onStyleChange;
        const _onDestroy = proto.ngOnDestroy;
        const _afterViewInit = proto.ngAfterViewInit;

        // --- INTERNAL LOGIC ---

        const hasValue = (val: any) => val !== undefined && val !== null && val !== '';
        const hasValidDir = (val: any) => hasValue(val) && ['row', 'column'].includes(val);

        const formatGap = (val: any): string => {
            if (!hasValue(val) || val === 'auto') return '';
            // If it's a number or a string that's just a number, append 'px'
            return !isNaN(Number(val)) ? `${val}px` : val;
        };

        // --- Getter Method ---
        const getAutolayoutStore = (inst: any) => {
            if (!inst.__al_store) {
                inst.__al_store = {
                    dir: undefined,
                    wrap: undefined,
                    align: undefined,
                    gap: undefined,
                    cg: undefined,
                    z: undefined,
                    pos: undefined,
                    overflow: undefined,
                    clip: undefined,
                    inset: undefined,
                    padding: undefined,
                    width: undefined,
                    height: undefined,
                    isViewInitialized: false,
                    needsFlex: false,
                    needsOverflow: false,
                    needsPosition: false,
                    watches: new Set<string>(), // Track active watches on keys
                    destroySub: new Subject<void>() // Internal decorator lifecylce
                };
            }
            return inst.__al_store;
        };

        // --- Setter Method ---
        const setAutolayoutStore = (inst: any, updates: Partial<any>) => {
            const store = getAutolayoutStore(inst);
            Object.assign(store, updates);
            return store;
        };

        // --- Internal watch registeration ---
        const setupInternalWatch = (inst: any, key: string, expression: string) => {
            const store = getAutolayoutStore(inst);
            
            // prevent duplicate watches
            if (store.watches.has(key)) return;
            store.watches.add(key);

            const cleanExpr = expression.replace('bind:', '');
            const scope = options.bindParent ? options.bindParent.split('.').reduce((o, k) => o?.[k], inst) : inst.viewParent;

            if (scope) {
                const unwatch = $watch(cleanExpr, scope, inst, (nv: any) => {
                    // When value changes, call setProperty again with the real value
                    // This will trigger onPropertyChange again but without the 'bind:' prefix
                    if (inst.setProperty) {
                        inst.setProperty(key, nv);
                    }
                });

                // cleanup
                store.destroySub.subscribe(() => {
                    if (typeof unwatch === 'function') unwatch();
                });
            }
        };

        // --- override for cleanup ---
        proto.ngOnDestroy = function () {
            const store = this.__al_store;
            if (store && store.destroySub) {
                store.destroySub.next();
                store.destroySub.complete();
            }
            // call original ngOnDestroy if it exists
            if (_onDestroy) _onDestroy.apply(this);
        };

        proto.ngAfterViewInit = function () {
            const app = this['app'] || this['injector']?.get(App);
            if (app?.isPrism) {
                const store = getAutolayoutStore(this);
                setAutolayoutStore(this, { isViewInitialized: true });

                // When a targetSelector is used the host carries outer dimensions and the
                // inner element carries flex/overflow/padding. Stretch the inner element to
                // fill the host so that 100% / flex math always resolves against the host.
                if (options.targetSelector) {
                    const inner = getTargetElement(this);
                    if (inner) inner.css({ width: '100%', height: '100%', 'box-sizing': 'border-box' });
                }

                // Sync all stored values to DOM now that target exists
                if (store.needsFlex) applyFlexStyles(this);
                if (store.needsOverflow) applyOverflow(this);
                if (store.needsPosition) applyPosition(this);

                /* Push the applySize call to microtask so that it gets the correct parent display
                    since ngAfterViewInit is resolved from child 1st to parent*/
                Promise.resolve().then(() => {
                    if (hasValue(store.width)) applySize(this, 'width', store.width);
                    if (hasValue(store.height)) applySize(this, 'height', store.height);
                });

                if (hasValue(store.padding)) {
                    const target = getTargetElement(this);
                    if (target) target.css('padding', store.padding);
                }
            }
            if (_afterViewInit) _afterViewInit.apply(this);
        };

        const getTargetElement = (inst: any) => {
            if (options.targetSelector) {
                const target = inst.nativeElement.querySelector(options.targetSelector);
                return target ? $(target) : null;
            }
            return inst.$element;
        };

        const applyFlexStyles = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = getTargetElement(inst);

            if (!target) return;

            const styles: any = {};
            let isFlex = false;

            const shouldApplyFlex = () => isFlex && hasValidDir(store.dir);

            if (hasValidDir(store.dir)) {
                styles['flex-direction'] = store.dir;
                isFlex = true;
                if(store.dir === 'column') setAutolayoutStore(inst, { wrap: false });
            }

            if (hasValue(store.wrap)) {
                styles['flex-wrap'] = store.wrap ? 'wrap' : 'nowrap';
                isFlex = true;
            }

            if (hasValue(store.align)) {
                const m = ALIGN_MAP[store.align] || ALIGN_MAP['top-left'];
                const dir = store.dir || 'row';
                const isR = dir === 'row';
                const directionalJC = isR ? m.jc : m.ai;
                const directionalAI = isR ? m.ai : m.jc;

                if(store.wrap) {
                    styles['justify-content'] = directionalJC;
                    styles['align-items'] = directionalAI;

                    if (store.cg === 'auto' && store.gap === 'auto') {
                        styles['align-content'] = directionalJC;
                    } else if (store.cg === 'auto' && store.gap !== 'auto') {
                        styles['align-content'] = directionalAI;
                    } else if (store.cg !== 'auto' && store.gap === 'auto') {
                        styles['align-content'] = 'space-between';
                    } else {
                        styles['align-content'] = directionalAI;
                    }
                } else {
                    styles['align-content'] = '';
                    if(store.gap === 'auto') {
                        styles['justify-content'] = m.jc;
                        styles['align-items'] = m.ai;
                    } else {
                        styles['justify-content'] = isR ? m.jc : m.ai;
                        styles['align-items'] = isR ? m.ai : m.jc;
                    }
                }
                isFlex = true;
            }

            const hasGap = hasValue(store.gap) || hasValue(store.cg);
            if (hasGap) {
                const g = formatGap(store.gap);
                const cg = formatGap(store.cg);

                setTimeout(() => {
                    if (shouldApplyFlex()) {
                        if (store.wrap) { 
                            target.css({ 'row-gap': g, 'column-gap': cg });
                        } else {
                            target.css({ 'gap': g });
                        }
                    }
                });

                if (g || (store.wrap && cg)) {
                    isFlex = true;
                }
            } else if (store.gap === "" && store.cg === "") {
                target.css({ 'row-gap': '', 'column-gap': '', 'gap': '' });
                isFlex = true;
            }

            if (shouldApplyFlex()) {
                styles['display'] = 'flex';
                target.css(styles);
            }
        };

        const applyOverflow = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = getTargetElement(inst);

            if (!target) return;

            const overflow = store.overflow?.toLowerCase();
            if (store.clip) {
                switch (overflow) {
                    case "vertical":
                        target.css({
                            "overflow-x": "hidden",
                            "overflow-y": "scroll",
                        });
                        break;

                    case "horizontal":
                        target.css({
                            "overflow-x": "scroll",
                            "overflow-y": "hidden",
                        });
                        break;

                    case "both directions":
                        target.css({
                            overflow: "scroll",
                        });
                        break;

                    case "no scrolling":
                        target.css({ overflow: "hidden" });
                        break;

                    default:
                        break;
                }
            } else {
                target.css({ overflow: '' });
            }
        };

        const applyPosition = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = inst?.$element;

            if (!target) return;

            // IF position NOT PROVIDED, CLEAR ANY INLINE POSITION STYLES
            if (!hasValue(store.pos)) {
                target.css({
                    position: "",
                    "z-index": store.z || "",
                    top: "",
                    right: "",
                    bottom: "",
                    left: "",
                });
                return;
            }

            const rawInset =
                store.pos === 'sticky' && !hasValue(store.inset)
                    ? '0px auto auto 0px'
                    : store.inset || '';

            // Parse the inset value into individual sides
            const parts = rawInset.split(/\s+/).filter(Boolean);
            let top, right, bottom, left;

            if (parts.length === 1) {
                top = right = bottom = left = parts[0];
            } else if (parts.length === 2) {
                top = bottom = parts[0];
                right = left = parts[1];
            } else if (parts.length === 3) {
                top = parts[0];
                right = left = parts[1];
                bottom = parts[2];
            } else if (parts.length === 4) {
                top = parts[0];
                right = parts[1];
                bottom = parts[2];
                left = parts[3];
            }

            // Only set sides that have a real value, clear ones that are 'auto'
            const posStyles: any = {
                position: store.pos || "",
                "z-index": store.z || "",
                top: (top && top !== 'auto') ? top : "",
                right: (right && right !== 'auto') ? right : "",
                bottom: (bottom && bottom !== 'auto') ? bottom : "",
                left: (left && left !== 'auto') ? left : "",
            };

            target.css(posStyles);
        };

        const applySize = (inst: any, key: string, nv: any) => {
            // Size always lands on the host element so that fill/hug/fixed
            // resolve against the real parent context (parent autolayout container).
            // The inner targetSelector element is separately stretched to 100%/100%
            // of the host in ngAfterViewInit, so flex/overflow/padding still work.
            const target = inst.$element;
            if (!target) return;

            const styles: any = {};
            const minKey = key === 'width' ? 'min-width' : 'min-height';

            // Determine parent flex context once
            const element = target[0];
            const parent = element?.parentElement;
            const parentStyle = parent ? getComputedStyle(parent) : null;
            const isParentFlex = parentStyle && ['flex', 'inline-flex'].includes(parentStyle.display);

            let isMainAxis = false;
            if (isParentFlex) {
                const flexDir = parentStyle.flexDirection;
                const isRow = ['row', 'row-reverse'].includes(flexDir);
                isMainAxis = (key === 'width' && isRow) || (key === 'height' && !isRow);
            }

            if (nv === 'fill') {
                if (!isParentFlex) {
                    styles[key] = '100%';
                } else {
                    styles[key] = '';
                    if (isMainAxis) {
                        styles['flex-grow'] = '1';
                        styles['flex-shrink'] = '';
                        styles[minKey] = '0';
                    } else {
                        styles['align-self'] = 'stretch';
                    }
                }
            } else {
                if (nv === 'hug') styles[key] = 'fit-content';

                if (isParentFlex) {
                    if (isMainAxis) {
                        styles['flex-grow'] = '';
                        styles['flex-shrink'] = '0';  // intentional — don't shrink fixed sizes
                        styles[minKey] = ''; // Need this because flex items default to min-height: auto, meaning they won't shrink smaller than their content.
                    } else {
                        styles['align-self'] = '';
                    }
                } else {
                    styles['flex-grow'] = '';
                    styles['flex-shrink'] = '0';
                    styles['align-self'] = '';
                    styles[minKey] = '';
                }
            }

            target.css(styles);
        };

        // --- METHOD INTERCEPTION ---

        proto.onPropertyChange = function (key: string, nv: any, ov?: any) {
            const app = this['app'] || this['injector']?.get(App);
            if (app?.isPrism) {
                const store = getAutolayoutStore(this);

                // Set watcher on the binded props
                if (['position', 'positionvalue', 'conditionalclass', 'conditionalstyle'].includes(key) && nv) {
                    // 1. Handle the Case where nv is just a String
                    if (typeof nv === 'string' && nv.startsWith('bind:')) {
                        setupInternalWatch(this, key, nv);
                    } 
                    
                    // 2. Handle the Case where nv is an Object with a toAdd array
                    else if (typeof nv === 'object' && Array.isArray(nv.toAdd)) {
                        nv.toAdd.forEach((item: any) => {
                            if (typeof item === 'string' && item.startsWith('bind:')) {
                                setupInternalWatch(this, key, item);
                            }
                        });
                    }
                }

                switch (key) {
                    case 'direction':
                        setAutolayoutStore(this, { dir: nv, needsFlex: true });
                        break;
                    case 'wrap':
                        setAutolayoutStore(this, { wrap: toBoolean(nv), needsFlex: true });
                        break;
                    case 'alignment':
                        setAutolayoutStore(this, { align: nv, needsFlex: true });
                        break;
                    case 'gap':
                        setAutolayoutStore(this, { gap: nv, needsFlex: true });
                        break;
                    case 'columngap':
                        setAutolayoutStore(this, { cg: nv, needsFlex: true });
                        break;
                    case 'position':
                        setAutolayoutStore(this, { pos: nv, needsPosition: true });
                        break;
                    case 'clipcontent':
                        setAutolayoutStore(this, { clip: toBoolean(nv), needsOverflow: true });
                        break;
                    case 'positionvalue':
                        setAutolayoutStore(this, { inset: nv, needsPosition: true });
                        break;
                }

                /* We need to apply the styles only when the target element is rendered in the dom. 
                   Because onPropertyChange might get triggered before the view has been renndered 
                   and the element might not exist at that time. */
                if (store.isViewInitialized) {
                    if (store.needsFlex) applyFlexStyles(this);
                    if (store.needsOverflow) applyOverflow(this);
                    if (store.needsPosition) applyPosition(this);
                }
            }
            if (_onProp) _onProp.apply(this, [key, nv, ov]);
        };

        proto.onStyleChange = function (key: string, nv: any, ov?: any) {
            const app = this['app'] || this['injector']?.get(App);
            if (app?.isPrism) {
                const store = getAutolayoutStore(this);
                const isReady = store.isViewInitialized;

                switch (key) {
                    case "width":
                    case "height":
                        setAutolayoutStore(this, { [key]: nv });
                        if (isReady) applySize(this, key, nv);
                        break;

                    case "padding":
                        setAutolayoutStore(this, { padding: nv });
                        if (isReady) {
                            const target = getTargetElement(this);
                            if (target) target.css("padding", nv);
                        }
                        break;

                    case "overflow":
                        setAutolayoutStore(this, {
                            overflow: nv,
                            needsOverflow: true,
                        });
                        if (isReady) applyOverflow(this);
                        break;

                    case "zindex":
                        setAutolayoutStore(this, { z: nv });
                        // Always setup watch for bindings immediately
                        if (nv?.startsWith("bind:")) {
                            setupInternalWatch(this, key, nv);
                        }
                        // Only apply to DOM if ready and position exists
                        if (store.pos !== undefined) {
                            setAutolayoutStore(this, { needsPosition: true });

                            if (isReady) applyPosition(this);
                        }
                        break;
                    case "backgroundimage":
                        if (nv?.startsWith("bind:")) {
                            setupInternalWatch(this, key, nv);
                        }
                        break;
                }
            }
            if (_onStyle) _onStyle.apply(this, [key, nv, ov]);
        };
    };
}