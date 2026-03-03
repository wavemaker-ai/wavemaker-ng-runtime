import { App } from '@wm/core';

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

export function AutoLayout(options: { targetSelector?: string } = {}) {
    return function (constructor: Function) {
        const proto = constructor.prototype;
        const _onProp = proto.onPropertyChange;
        const _onStyle = proto.onStyleChange;

        // --- INTERNAL LOGIC ---

        const getAutolayoutStore = (inst: any) => {
            if (!inst.__al_store) {
                inst.__al_store = {
                    dir: "row",
                    wrap: false,
                    align: undefined,
                    gap: undefined,
                    cg: undefined,
                    z: undefined,
                    pos: undefined,
                    overflow: undefined,
                    clip: undefined,
                    top: undefined,
                    right: undefined,
                    bottom: undefined,
                    left: undefined,
                };
            }
            return inst.__al_store;
        };

        const getTargetElement = (inst: any) => {
            if (options.targetSelector) {
                const target = inst.nativeElement.querySelector(options.targetSelector);
                return target ? $(target) : inst.$element;
            }
            return inst.$element;
        };

        // const formatPosVal = (v: any) => {
        // if (v === undefined || v === null || v === '') return '';
        // return (typeof v === 'number') ? `${v}px` : `${v}`;
        // };

        const formatPosVal = (v: any): string => {
            if (v === undefined || v === null || v === "") return "";

            const s = String(v).trim();

            // matches integers, decimals and optional +/-, e.g. "12", "-3.5", ".5", "+0.2"
            const isNumeric = /^[-+]?(?:\d+|\d*\.\d+)$/.test(s);

            return isNumeric ? `${s}px` : s;
        };

        const applyFlexStyles = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = getTargetElement(inst);

            if (!target) return;

            const styles: any = {};
            let isFlex = false;

            if (store.dir !== undefined) {
                styles['flex-direction'] = store.dir;
                isFlex = true;
                if(store.dir === 'column') store.wrap = false;
            }

            if (store.wrap !== undefined) {
                styles['flex-wrap'] = store.wrap ? 'wrap' : 'nowrap';
                isFlex = true;
            }

            if (store.align !== undefined) {
                const m = ALIGN_MAP[store.align] || ALIGN_MAP['top-left'];
                const dir = store.dir || 'row';
                const isR = dir === 'row';
                const directionalJC = isR ? m.jc : m.ai;
                const directionalAI = isR ? m.ai : m.jc;

                if(store.wrap) {
                    if(store.cg === 'auto' && store.gap === 'auto') {
                        styles['justify-content'] = directionalJC;
                        styles['align-content'] = directionalJC;
                    } else if (store.cg === 'auto' && store.gap !== 'auto') {
                        styles['justify-content'] = directionalJC;
                        styles['align-content'] = directionalAI;
                    } else if (store.cg !== 'auto' && store.gap === 'auto') {
                        styles['justify-content'] = directionalJC;
                        styles['align-content'] = "space-between";
                    }
                } else {
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

            const hasGap = store.gap !== undefined || store.cg !== undefined;
            if (hasGap) {
                const g = store.gap !== undefined && store.gap !== 'auto' ? `${store.gap}px` : '';
                const cg = store.cg !== undefined && store.cg !== 'auto' ? `${store.cg}px` : '';
                const gapValue = g ? (cg ? `${g} ${cg}` : g) : cg;
                if (gapValue) {
                    setTimeout(() => {
                        target.css('gap', gapValue);
                    });
                    isFlex = true;
                }
            }

            if (isFlex) {
                styles['display'] = 'flex';
            }

            target.css(styles);
        };

        const applyOverflow = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = getTargetElement(inst);

            if (!target) return;

            const overflow = store.overflow?.toLowerCase();

            switch (overflow) {
                case 'vertical':
                    target.css({
                        'overflow-x': 'hidden',
                        'overflow-y': 'scroll'
                    });
                    break;

                case 'horizontal':
                    target.css({
                        'overflow-x': 'scroll',
                        'overflow-y': 'hidden'
                    });
                    break;

                case 'both directions':
                    target.css({
                        'overflow': 'scroll'
                    });
                    break;

                case 'no scrolling':
                    if (store.clip) {
                        target.css({ 'overflow': 'hidden' });
                    } else {
                        target.css({ 'overflow': '' });
                    }
                    break;

                default:
                    break;
            }

        };

        const applyPosition = (inst: any) => {
            const store = getAutolayoutStore(inst);
            const target = getTargetElement(inst);

            if (!target) return;

            // BUILD NORMALIZED OFFSET VALUES ONCE
            const normalizedOffsets = {
                top: store.top !== undefined && store.top !== "" ? store.top : "",
                right: store.right !== undefined && store.right !== "" ? store.right : "",
                bottom: store.bottom !== undefined && store.bottom !== "" ? store.bottom : "",
                left: store.left !== undefined && store.left !== "" ? store.left : "",
            };

            // IF position NOT PROVIDED, CLEAR ANY INLINE POSITION STYLES
            if (store.pos === undefined) {
                target.css({
                    position: "",
                    top: "",
                    right: "",
                    bottom: "",
                    left: "",
                    "z-index": "",
                });
                return;
            }

            const baseStyle: any = {
                position: store.pos || "",
                "z-index": store.z || "",
            };

            if (store.pos === "sticky") {
                // IF NONE OF THE OFFSETS WERE PROVIDED, APPLY DEFAULTS top:0 left:0
                const allOffsetsEmpty =
                    !normalizedOffsets.top &&
                    !normalizedOffsets.right &&
                    !normalizedOffsets.bottom &&
                    !normalizedOffsets.left;

                const finalOffsets = allOffsetsEmpty
                    ? { top: "0", right: "", bottom: "", left: "0" }
                    : {
                          top: normalizedOffsets.top,
                          right: normalizedOffsets.right,
                          bottom: normalizedOffsets.bottom,
                          left: normalizedOffsets.left,
                      };

                target.css({ ...baseStyle, ...finalOffsets });
            } else {
                // absolute / fixed / relative / etc. - only set offsets provided (others cleared)
                target.css({
                    ...baseStyle,
                    top: normalizedOffsets.top,
                    right: normalizedOffsets.right,
                    bottom: normalizedOffsets.bottom,
                    left: normalizedOffsets.left,
                });
            }
        };

        const applySize = (inst: any, key: string, nv: any) => {
            const target = getTargetElement(inst);
            const styles: any = {};
            if (nv === 'fill') {
                if (key === 'height') {
                    const element = target?.[0];
                    // If element or parent doesn't exist → fallback to 100% height
                    if (!element?.parentElement) {
                        styles[key] = '100%';
                        return;
                    }
                    const parent = element.parentElement;
                        const parentStyle = getComputedStyle(parent);
                        const isParentFlex = ['flex', 'inline-flex'].includes(parentStyle.display);
                        // If parent is flex, use flex stretching
                        if (isParentFlex) {
                            styles['align-self'] = 'stretch';
                            styles['flex-grow'] = '1';
                        } else {
                            // If parent is not flex, flex properties won’t work → fallback to 100% height
                            styles[key] = '100%';
                        } 
                }else if(key === 'width') {
                    styles[key] = '100%';
                }
            } else if (nv === 'hug') {
                styles[key] = 'fit-content';
            } else {
                styles['flex-shrink'] = '0';
            }
            target?.css(styles);
        };

        // --- METHOD INTERCEPTION ---

        proto.onPropertyChange = function (key: string, nv: any, ov?: any) {
            const app = this['app'] || this['injector']?.get(App);
            if (app?.isPrism) {
                const store = getAutolayoutStore(this);
                let needsFlex = false;
                let needsOverflow = false;
                let needsPosition = false;
                switch (key) {
                    case 'direction':
                        store.dir = nv;
                        needsFlex = true;
                        break;
                    case 'wrap':
                        store.wrap = nv;
                        needsFlex = true;
                        break;
                    case 'alignment':
                        store.align = nv;
                        needsFlex = true;
                        break;
                    case 'gap':
                        store.gap = nv;
                        needsFlex = true;
                        break;
                    case 'columngap':
                        store.cg = nv;
                        needsFlex = true;
                        break;
                    case 'position':
                        store.pos = nv;
                        needsPosition = true;
                        break;
                    case 'clipcontent':
                        store.clip = nv;
                        needsOverflow = true;
                        break;
                    case 'top':
                    case 'right':
                    case 'bottom':
                    case 'left':
                    store[key] = formatPosVal(nv);
                    needsPosition = true;
                    break;
                }
                if (needsFlex) applyFlexStyles(this);
                if (needsOverflow) applyOverflow(this);
                if (needsPosition) applyPosition(this);
            }
            if (_onProp) _onProp.apply(this, [key, nv, ov]);
        };

        proto.onStyleChange = function (key: string, nv: any, ov?: any) {
            const app = this['app'] || this['injector']?.get(App);
            if (app?.isPrism) {
                const store = getAutolayoutStore(this);
                if (key === 'width' || key === 'height') {
                    applySize(this, key, nv);
                }
                if (key === 'overflow') {
                    store.overflow = nv;
                    applyOverflow(this);
                }
                if (key === 'zindex') {
                    store.z = nv;
                    if (store.pos !== undefined) applyPosition(this);
                }

                if (key === 'padding') {
                    const target = getTargetElement(this);
                    target.css('padding', nv);
                }
            }
            if (_onStyle) _onStyle.apply(this, [key, nv, ov]);
        };
    };
}