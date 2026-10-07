import { of } from 'rxjs';
import * as watcher from './watcher';
import {
    addForIdAttributes,
    adjustContainerPosition,
    adjustContainerRightEdges,
    closePopover,
    extendProto,
    getDisplayDateTimeFormat,
    getWebkitTraslationMatrix,
    processFilterExpBindNode,
    setTranslation3dPosition,
    triggerItemAction,
} from './utils';

let watchMock: jest.SpyInstance;

beforeEach(() => {
    watchMock = jest.spyOn(watcher, '$watch').mockReturnValue(jest.fn() as any);
});

afterEach(() => {
    watchMock.mockRestore();
});

describe('core utils - getDisplayDateTimeFormat', () => {
    it('returns the default display format of each type', () => {
        expect(getDisplayDateTimeFormat('date')).toBe('yyyy-MM-dd');
        expect(getDisplayDateTimeFormat('time')).toBe('hh:mm a');
        expect(getDisplayDateTimeFormat('timestamp')).toBe('yyyy-MM-dd hh:mm:ss a');
        expect(getDisplayDateTimeFormat('datetime')).toBe('yyyy-MM-dd hh:mm:ss a');
        expect(getDisplayDateTimeFormat('other')).toBeUndefined();
    });
});

describe('core utils - addForIdAttributes', () => {
    // attributes are written in the next animation frame
    const run = async (root: HTMLElement) => {
        addForIdAttributes(root);
        await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    };

    it('links the label to the focus target through the widget id', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<div widget-id="w1"><label class="control-label">Name</label><input focus-target></div>';
        await run(root);
        expect(root.querySelector('input')!.getAttribute('id')).toBe('w1');
        expect(root.querySelector('label')!.getAttribute('for')).toBe('w1');
    });

    it('falls back to the first input, select or textarea', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<div widget-id="w2"><label class="control-label">Name</label><textarea></textarea></div>';
        await run(root);
        expect(root.querySelector('textarea')!.getAttribute('id')).toBe('w2');
    });

    it('does nothing without a widget id', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<label class="control-label">Name</label><input>';
        await run(root);
        expect(root.querySelector('input')!.hasAttribute('id')).toBe(false);
    });

    it('labels radio and checkbox groups through aria-labelledby', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<label class="control-label">Pick</label><ul role="radiogroup"></ul>';
        await run(root);
        const labelId = root.querySelector('label')!.getAttribute('id')!;
        expect(labelId).toMatch(/^wm-group-label-/);
        expect(root.querySelector('ul')!.getAttribute('aria-labelledby')).toBe(labelId);
    });

    it('also labels generic groups but not other lists', async () => {
        const group = document.createElement('div');
        group.innerHTML = '<label class="control-label">x</label><ul role="group"></ul>';
        await run(group);
        expect(group.querySelector('ul')!.hasAttribute('aria-labelledby')).toBe(true);

        const plain = document.createElement('div');
        plain.innerHTML = '<label class="control-label">x</label><ul role="list"></ul>';
        await run(plain);
        expect(plain.querySelector('ul')!.hasAttribute('aria-labelledby')).toBe(false);
    });
});

describe('core utils - container positioning', () => {
    const originalMatrix = (window as any).WebKitCSSMatrix;

    class FakeMatrix {
        m41 = 0;
        m42 = 0;
        constructor(public value: string) {
            const match = /translate3d\((-?\d+)px, (-?\d+)px/.exec(value) || /matrix\(1, 0, 0, 1, (-?\d+), (-?\d+)\)/.exec(value);
            if (match) {
                this.m41 = Number(match[1]);
                this.m42 = Number(match[2]);
            }
        }
    }

    beforeEach(() => {
        (window as any).WebKitCSSMatrix = FakeMatrix;
    });

    afterEach(() => {
        (window as any).WebKitCSSMatrix = originalMatrix;
    });

    const container = (transform?: string) => {
        const el = document.createElement('div');
        if (transform) {
            el.style.transform = transform;
        }
        document.body.appendChild(el);
        return $(el);
    };

    it('setTranslation3dPosition applies the translation to the element', () => {
        const $el = container();
        setTranslation3dPosition($el, { m41: 12, m42: 34 });
        expect($el[0].style.transform).toBe('translate3d(12px, 34px, 0px)');
    });

    it('getWebkitTraslationMatrix returns null without an element', () => {
        expect(getWebkitTraslationMatrix(undefined)).toBeNull();
        expect(getWebkitTraslationMatrix($())).toBeNull();
    });

    it('getWebkitTraslationMatrix reads the transform of the element', () => {
        const matrix: any = getWebkitTraslationMatrix(container('translate3d(5px, 7px, 0px)'));
        expect(matrix.m41).toBe(5);
        expect(matrix.m42).toBe(7);
    });

    it('getWebkitTraslationMatrix uses an identity matrix when no transform is set', () => {
        const matrix: any = getWebkitTraslationMatrix(container());
        expect(matrix.value).toBe('matrix(1, 0, 0, 1, 0, 0)');
    });

    it('adjustContainerPosition moves a container with a negative left translation back to 0', () => {
        const $el = container('translate3d(-20px, 10px, 0px)');
        adjustContainerPosition($el, document.createElement('div'), {});
        expect($el[0].style.transform).toBe('translate3d(0px, 10px, 0px)');
    });

    it('adjustContainerPosition leaves a visible container alone', () => {
        const $el = container('translate3d(20px, 10px, 0px)');
        adjustContainerPosition($el, document.createElement('div'), {});
        expect($el[0].style.transform).toBe('translate3d(20px, 10px, 0px)');
    });

    it('waits for the zone to become stable when a reference provides one', () => {
        const $el = container('translate3d(-5px, 0px, 0px)');
        adjustContainerPosition($el, document.createElement('div'), { _ngZone: { onStable: of(true) } });
        expect($el[0].style.transform).toBe('translate3d(0px, 0px, 0px)');
        const $other = container('translate3d(-5px, 0px, 0px)');
        adjustContainerPosition($other, document.createElement('div'), { ngZone: { onStable: of(true) } });
        expect($other[0].style.transform).toBe('translate3d(0px, 0px, 0px)');
    });

    describe('adjustContainerRightEdges', () => {
        beforeEach(() => {
            jest.spyOn($.fn, 'width').mockReturnValue(1000 as any);
        });

        afterEach(() => {
            ($.fn.width as unknown as jest.SpyInstance).mockRestore();
        });

        const parent = (right: number, width: number) => ({
            getBoundingClientRect: () => ({ right, width }),
        }) as any;

        it('shifts a container that would overflow the right edge of the viewport', () => {
            const $el = container('translate3d(900px, 10px, 0px)');
            $el.css('width', '300px');
            const viewport = 1000;
            adjustContainerRightEdges($el, parent(viewport - 10, 100), {});
            expect($el[0].style.transform).toBe(`translate3d(${viewport - 10 - 300}px, 10px, 0px)`);
        });

        it('never moves the container left of the viewport', () => {
            const $el = container('translate3d(900px, 10px, 0px)');
            $el.css('width', '5000px');
            adjustContainerRightEdges($el, parent(100, 100), {});
            expect($el[0].style.transform).toBe('translate3d(0px, 10px, 0px)');
        });

        it('keeps a container that fits', () => {
            const $el = container('translate3d(10px, 10px, 0px)');
            $el.css('width', '50px');
            adjustContainerRightEdges($el, parent(100, 100), {});
            expect($el[0].style.transform).toBe('translate3d(10px, 10px, 0px)');
        });

        it('uses the width of the inner element when it is provided', () => {
            const $el = container('translate3d(900px, 10px, 0px)');
            const $inner = $('<div style="width: 400px"></div>');
            const viewport = 1000;
            adjustContainerRightEdges($el, parent(viewport - 10, 100), {}, $inner);
            expect($el[0].style.transform).toBe(`translate3d(${viewport - 10 - 400}px, 10px, 0px)`);
        });

        it('does nothing without a container element', () => {
            expect(() => adjustContainerRightEdges($(), parent(10, 10), {})).not.toThrow();
        });
    });
});

describe('core utils - closePopover', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    const popover = (isOpen: boolean) => {
        const el: any = document.createElement('div');
        el.className = 'app-popover-wrapper';
        el.widget = { isOpen };
        document.body.appendChild(el);
        return el;
    };

    it('closes the open popovers when the element is outside of any popover', () => {
        const open = popover(true);
        const closed = popover(false);
        closePopover($('<div></div>'));
        expect(open.widget.isOpen).toBe(false);
        expect(closed.widget.isOpen).toBe(false);
    });

    it('keeps the popovers open when the element is inside a popover', () => {
        const open = popover(true);
        const inside = $('<div class="app-popover"><span id="inner"></span></div>').find('#inner');
        closePopover(inside);
        expect(open.widget.isOpen).toBe(true);
    });
});

describe('core utils - triggerItemAction', () => {
    it('runs the item action in the user defined execution context', () => {
        const received: any[] = [];
        const scope: any = { userDefinedExecutionContext: { handler: (v: any) => received.push(v) } };
        triggerItemAction(scope, { action: 'handler(1)' });
        expect(received).toEqual([1]);
        expect(typeof scope.itemActionFn).toBe('function');
    });

    it('navigates through the router for internal links', () => {
        const navigate = jest.fn();
        triggerItemAction({ route: { navigate } }, { link: '#/Page?a=1' });
        expect(navigate).toHaveBeenCalledWith(['/Page'], { queryParams: { a: '1' } });
    });

    it('uses the menu reference router when the scope has none', () => {
        const navigate = jest.fn();
        triggerItemAction({ menuRef: { route: { navigate } } }, { link: '#/Other', target: '_self' });
        expect(navigate).toHaveBeenCalledWith(['/Other'], { queryParams: {} });
    });

    it('opens external links and links with a target through window.open', () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        triggerItemAction({}, { link: 'http://x.com' });
        triggerItemAction({}, { link: '#/Page', target: '_blank' });
        expect(open).toHaveBeenNthCalledWith(1, 'http://x.com', '_self');
        expect(open).toHaveBeenNthCalledWith(2, '#/Page', '_blank');
        open.mockRestore();
    });
});

describe('core utils - extendProto', () => {
    it('sets the given proto at the end of the prototype chain', () => {
        class Base {}
        class Child extends Base {}
        const proto = { injected: true };
        const target = new Child();
        extendProto(target, proto);
        expect((target as any).injected).toBe(true);
    });

    it('does nothing when the proto is already part of the chain', () => {
        class Base {}
        class Child extends Base {}
        const target = new Child();
        extendProto(target, Base.prototype);
        expect(Object.getPrototypeOf(Object.getPrototypeOf(target))).toBe(Base.prototype);
    });
});

describe('core utils - processFilterExpBindNode', () => {
    it('watches bound rule values and registers the destroy handler', () => {
        const context = { registerDestroyListener: jest.fn() };
        const expressions = { rules: [{ target: 'name', value: 'bind:Widgets.w.datavalue', matchMode: 'in' }] };
        processFilterExpBindNode(context, expressions);
        expect(watchMock.mock.calls[0][0]).toBe('Widgets.w.datavalue');
        expect(watchMock.mock.calls[0][5]).toBe(false);
        expect(watchMock.mock.calls[0][6]).toEqual({ arrayType: true });
        expect(context.registerDestroyListener).toHaveBeenCalled();
    });

    it('also watches the second value of between rules and nested groups', () => {
        const expressions = {
            rules: [
                { matchMode: 'between', value: 'bind:a', secondvalue: 'bind:b' },
                { rules: [{ matchMode: 'equals', value: 'bind:c' }] },
                { matchMode: 'equals', value: 'static' },
            ],
        };
        processFilterExpBindNode({}, expressions);
        expect(watchMock.mock.calls.map((c) => c[0])).toEqual(['b', 'a', 'c']);
    });

    it('delegates changes to the variable when one is passed', () => {
        const variable = { invokeOnFiltertExpressionChange: undefined as any, invokeOnFiltertExpressionChange_: 0 };
        (variable as any).invokeOnFiltertExpressionChange = jest.fn();
        const rule = { value: 'bind:a' };
        processFilterExpBindNode({}, { rules: [rule] }, variable);
        watchMock.mock.calls[0][3]('new', 'old');
        expect((variable as any).invokeOnFiltertExpressionChange).toHaveBeenCalledWith(rule, 'value', 'new', 'old');
    });

    it('stores the new value on the rule and emits a change', () => {
        const rule: any = { value: 'bind:a', type: 'string' };
        const expressions = { rules: [rule] };
        const emitted: any[] = [];
        processFilterExpBindNode({}, expressions).subscribe((e) => emitted.push(e));

        watchMock.mock.calls[0][3]({ x: 1 }, undefined);

        expect(rule.value).toEqual({ x: 1 });
        expect(emitted[0].filterExpressions).toBe(expressions);
    });

    it('keeps blob values by reference', () => {
        const rule: any = { value: 'bind:a', type: 'blob' };
        const blob = { size: 1 };
        processFilterExpBindNode({}, { rules: [rule] });
        watchMock.mock.calls[0][3](blob, undefined);
        expect(rule.value).toBe(blob);
    });

    it('ignores undefined values that did not change or were reset', () => {
        const rule: any = { value: 'bind:a' };
        processFilterExpBindNode({}, { rules: [rule] });
        watchMock.mock.calls[0][3](undefined, undefined);
        watchMock.mock.calls[0][3](undefined, 'old');
        expect(rule.value).toBe('bind:a');
    });

    it('rebuilds the rules from a complete object bound at dataBinding level', () => {
        const rule: any = { target: 'dataBinding', value: 'bind:a', matchMode: 'exact' };
        const expressions: any = { rules: [rule] };
        processFilterExpBindNode({}, expressions);

        watchMock.mock.calls[0][3]({ name: 'x', age: 3 }, undefined);

        expect(expressions.rules).toEqual([
            { target: 'name', value: 'x', matchMode: 'exact', required: false, type: '' },
            { target: 'age', value: 3, matchMode: 'exact', required: false, type: '' },
        ]);
    });

    it('defaults the match mode of rebuilt rules to startignorecase', () => {
        const rule: any = { target: 'dataBinding', value: 'bind:a' };
        const expressions: any = { rules: [rule] };
        processFilterExpBindNode({}, expressions);
        watchMock.mock.calls[0][3]({ name: 'x' }, undefined);
        expect(expressions.rules[0].matchMode).toBe('startignorecase');
    });

    it('does nothing for expressions without rules', () => {
        expect(() => processFilterExpBindNode({}, {})).not.toThrow();
        expect(watchMock).not.toHaveBeenCalled();
    });
});

describe('core utils - $.cachedScript', () => {
    it('loads each script once, sharing the pending request and remembering finished ones', async () => {
        const deferred = $.Deferred();
        const ajax = jest.spyOn($, 'ajax').mockReturnValue(deferred as any);

        const first = ($ as any).cachedScript('/a.js');
        const second = ($ as any).cachedScript('/a.js');
        expect(second).toBe(first);
        expect(ajax).toHaveBeenCalledTimes(1);
        expect(ajax).toHaveBeenCalledWith({ dataType: 'script', cache: true, url: '/a.js' });

        deferred.resolve();
        await first;
        await expect(($ as any).cachedScript('/a.js')).resolves.toBeUndefined();
        expect(ajax).toHaveBeenCalledTimes(1);
        ajax.mockRestore();
    });
});
