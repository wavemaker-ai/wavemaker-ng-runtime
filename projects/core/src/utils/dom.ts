const $RAF = window.requestAnimationFrame;
const $RAFQueue = [];

const invokeLater = fn => {
    if (!$RAFQueue.length) {
        $RAF(() => {
            $RAFQueue.forEach(f => f());
            $RAFQueue.length = 0;
        });
    }
    $RAFQueue.push(fn);
};

export const appendNode = (node: HTMLElement, parent: HTMLElement, sync: boolean = true) => {
    const task = () => parent.appendChild(node);
    sync ? task() : invokeLater(task);
};

export const insertBefore = (node: HTMLElement, ref: HTMLElement, sync: boolean = true) => {
    const task = () => ref.parentNode.insertBefore(node, ref);
    sync ? task() : invokeLater(task);
};

export const insertAfter = (node: HTMLElement, ref: HTMLElement, sync: boolean = true) => {
    const task = () => ref.parentNode.insertBefore(node, ref.nextSibling);
    sync ? task() : invokeLater(task);
};

export const removeNode = (node: HTMLElement, sync: boolean = true) => {
    const task = () => {
        // MEMORY LEAK FIX: Check if node exists and has remove method before calling
        // In test environments or if node is already removed, this prevents errors
        if (node && typeof node.remove === 'function' && node.parentNode) {
            node.remove();
        }
    };
    sync ? task() : invokeLater(task);
};

export const removeClass = (node: HTMLElement, ov: string, sync: boolean = true) => {
    ov = ov || '';
    const task = c => node.classList.remove(c);
    ov.split(' ').forEach(c => {
        if (c.length) {
            sync ? task(c) : invokeLater(() => task(c));
        }
    });
};

export const addClass = (node: HTMLElement, nv: string, sync: boolean = true) => {
    nv = nv || '';
    const task = c => node.classList.add(c);
    nv.split(' ').forEach(c => {
        if (c.length) {
            sync ? task(c) : invokeLater(() => task(c));
        }
    });
};

export const switchClass = (node: HTMLElement, toAdd: string = '', toRemove: string = '', sync: boolean = true) => {
    // After NG15 upgrade ng-invalid class is added even the field is valid, so we are removing the ng-invalid manually
    const isNgUntouchedValid = node.classList.contains('ng-untouched') && node.classList.contains('ng-valid');
    if(isNgUntouchedValid && toAdd.includes('ng-untouched') && toAdd.includes('ng-invalid')) {
        toAdd = toAdd.replace('ng-invalid', '');
    }
    removeClass(node, toRemove, sync);
    addClass(node, toAdd, sync);
};

export const toggleClass = (node: HTMLElement, cls: string, condition: boolean, sync: boolean = true) => {
    if (condition) {
        addClass(node, cls, sync);
    } else {
        removeClass(node, cls, sync);
    }
};

export const setCSS = (node: HTMLElement, cssName: string, val?: string | number, sync: boolean = true) => {
    const task = () => {
        if (!node || !node.style) {
            return;
        }

        const style = node.style as any;
        if (val === undefined || val === null || val === '') {
            // Remove the inline style when value is empty/undefined
            const cssProp = cssName.replace(/([A-Z])/g, '-$1').toLowerCase();
            node.style.removeProperty(cssProp);
            return;
        }

        if (cssName.indexOf('-') > -1) {
            node.style.setProperty(cssName, val as string);
        } else {
            style[cssName] = val;
        }
    };
    sync ? task() : invokeLater(task);
};

export const setCSSFromObj = (node: HTMLElement, cssObj: any, sync: boolean = true) => {
    const keys = Object.keys(cssObj || {});
    keys.forEach(key => setCSS(node, key, cssObj[key], sync));
};

export const setProperty = (node: HTMLElement, propName: string, val: any, sync: boolean = true) => {
    const task = () => node[propName] = val;
    sync ? task() : invokeLater(task);
};

export const setAttr = (node: HTMLElement, attrName: string, val: any, sync: boolean = true) => {
    const task = () => node instanceof Element && node.setAttribute(attrName, val);
    sync ? task() : invokeLater(task);
};

export const setHtml = (node: HTMLElement, html: string, sync: boolean = true) => {
    const task = () => node.innerHTML = html;
    sync ? task() : invokeLater(task);
};

export const removeAttr = (node: HTMLElement, attrName: string, sync: boolean = true) => {
    const task = () => node.removeAttribute(attrName);
    sync ? task() : invokeLater(task);
};

export const createElement = (nodeType: string, attrs: any, sync: boolean = true): HTMLElement => {
    const node = document.createElement(nodeType);

    if (attrs) {
        Object.keys(attrs).forEach(attrName => {
            setAttr(node, attrName, attrs[attrName], sync);
        });
    }
    return node;
};

// for width and height if a numeric value is specified return in px
// else return the same value
export const toDimension = (v: string | number) => {
    // @ts-ignore
    if (v == +v) {
        return `${v}px`;
    }
    return v;
};
