
export const EVENTS_MAP = new Map<string, string>([
    // ['enterkeypress', 'keypress.enter']
   ['tap', 'click']
]);

/**
 * DOM events that fire continuously (mouse move, scroll, pointer events).
 * For these, forcing a digest on every event is prohibitively expensive,
 * so we throttle watcher execution in the base widget layer.
 */
export const HIGH_FREQUENCY_DOM_EVENTS = new Set<string>([
    'mousemove',
    'mouseover',
    'mouseout',
    'mouseenter',
    'mouseleave',
    'mousewheel',
    'wheel',
    'scroll',
    'touchmove',
    'touchstart',
    'touchend',
    'pointermove',
    'pointerover',
    'pointerout',
    'pointerenter',
    'pointerleave'
]);

// Milliseconds between forced digests for high frequency events.
export const HIGH_FREQ_DIGEST_INTERVAL = 80;


// TODO: Implement touch events for the mobile

export const DISPLAY_TYPE = {
    BLOCK: 'block',
    INLINE_BLOCK: 'inline-block',
    INLINE: 'inline'
};

// set of boolean attrs
const BOOLEAN_ATTRS = new Set([
    'readonly', 'autofocus', 'disabled', 'startchecked', 'multiple',
    'selected', 'required', 'controls', 'autoplay', 'loop', 'muted', 'show'
]);

/**
 * Returns true if the provided key is a boolean attribute
 * @param {string} key
 * @returns {boolean}
 */
export const isBooleanAttr = (key: string): boolean => BOOLEAN_ATTRS.has(key);

const DIMENSION_PROPS = new Set([
    'width',
    'height',
    'iconheight',
    'iconwidth',
    'popoverwidth',
    'popoverheight',
    'imagewidth',
    'imageheight'
]);

export const isDimensionProp = (key: string): boolean => DIMENSION_PROPS.has(key);

export const DEBOUNCE_TIMES = {
    PAGINATION_DEBOUNCE_TIME : 250
};
