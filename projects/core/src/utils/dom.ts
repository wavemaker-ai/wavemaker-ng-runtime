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
     if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const insertBefore = (node: HTMLElement, ref: HTMLElement, sync: boolean = true) => {
    const task = () => ref.parentNode.insertBefore(node, ref);
     if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const insertAfter = (node: HTMLElement, ref: HTMLElement, sync: boolean = true) => {
    const task = () => ref.parentNode.insertBefore(node, ref.nextSibling);
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const removeNode = (node: HTMLElement, sync: boolean = true) => {
    const task = () => node.remove();
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const removeClass = (node: HTMLElement, ov: string, sync: boolean = true) => {
    ov = ov || '';
    const task = c => node.classList.remove(c);
    ov.split(' ').forEach(c => {
        if (c.length) {
            if (sync) {
                task(c);
            } else {
                invokeLater(() => task(c));
            }
        }
    });
};

export const addClass = (node: HTMLElement, nv: string, sync: boolean = true) => {
    nv = nv || '';
    const task = c => node.classList.add(c);
    nv.split(' ').forEach(c => {
        if (c.length) {
            if (sync) {
                task(c);
            } else {
                invokeLater(() => task(c));
            }
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
    const task = () => node.style[cssName] = val;
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const setCSSFromObj = (node: HTMLElement, cssObj: unknown, sync: boolean = true) => {
    const keys = Object.keys(cssObj || {});
    keys.forEach(key => setCSS(node, key, cssObj[key], sync));
};

export const setProperty = (node: HTMLElement, propName: string, val: unknown, sync: boolean = true) => {
    const task = () => node[propName] = val;
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const setAttr = (node: HTMLElement, attrName: string, val: string, sync: boolean = true) => {
    const task = () => node instanceof Element && node.setAttribute(attrName, val);
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const setHtml = (node: HTMLElement, html: string, sync: boolean = true) => {
    const task = () => node.innerHTML = html;
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const removeAttr = (node: HTMLElement, attrName: string, sync: boolean = true) => {
    const task = () => node.removeAttribute(attrName);
    if (sync) {
        task();
    } else {
        invokeLater(task);
    }
};

export const createElement = (nodeType: string, attrs: unknown, sync: boolean = true): HTMLElement => {
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
    if (v == +v) {
        return `${v}px`;
    }
    return v;
};
