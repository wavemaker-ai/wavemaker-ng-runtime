import { Subject } from 'rxjs';
import { SwipeAnimation } from '@swipey';
import { ListAnimator } from './list.animator';

declare const $: any;

// Sizzle caches compiled selectors, so the pseudo function identity must stay stable; toggle via flag.
let visibleFlag = true;
const stableVisible = () => visibleFlag;

describe('ListAnimator', () => {
    let root: HTMLElement;
    let list: any;
    let btnChanges: Subject<any>;
    let origVisible: any;
    let initSpy: jest.SpyInstance;

    const buildDom = (opts: { left?: boolean; right?: boolean; groupby?: boolean } = { left: true, right: true }) => {
        root = document.createElement('div');
        const panel = (cls: string, pos: string, extra = '') =>
            `<div class="${cls}" position="${pos}" ${extra}><button style="background-color: red">A</button><button>B</button></div>`;
        const lis = '<li class="app-list-item" id="li1">one</li><li class="app-list-item" id="li2">two</li><li id="plain">plain</li>';
        let inner = '';
        if (opts.groupby) {
            inner = `<li><ul class="list-group">${opts.left ? panel('app-list-item-left-action-panel', 'left') : ''}${opts.right ? panel('app-list-item-right-action-panel', 'right', 'enablefullswipe="true"') : ''}</ul></li>`;
            // action panels must be direct children of ul.app-livelist-container for the first lookup; groupby variant looks deeper
            root.innerHTML = `<ul class="app-livelist-container">${inner}${lis}</ul>`;
            // jQuery selector '>li > ul.list-group >.panel' is evaluated from $el
        } else {
            inner = `${opts.left ? panel('app-list-item-left-action-panel', 'left', 'enablefullswipe="true"') : ''}${opts.right ? panel('app-list-item-right-action-panel', 'right', 'enablefullswipe="true"') : ''}`;
            root.innerHTML = `<ul class="app-livelist-container">${inner}${lis}</ul>`;
        }
        document.body.appendChild(root);
    };

    const create = () => new ListAnimator(list);
    const evt = (id: string) => ({ target: root.querySelector('#' + id) });

    beforeEach(() => {
        origVisible = $.expr.pseudos.visible;
        visibleFlag = true;
        $.expr.pseudos.visible = stableVisible;
        initSpy = jest.spyOn(SwipeAnimation.prototype as any, 'init').mockImplementation(() => undefined);
        btnChanges = new Subject();
        list = {
            getNativeElement: () => root,
            btnComponents: { changes: btnChanges },
            groupby: '',
            triggerListItemSelection: jest.fn()
        };
    });

    afterEach(() => {
        $.expr.pseudos.visible = origVisible;
        initSpy.mockRestore();
        root?.remove();
    });

    it('does not init swipe when there are no action buttons', () => {
        root = document.createElement('div');
        root.innerHTML = '<ul class="app-livelist-container"></ul>';
        const a = create();
        expect(initSpy).not.toHaveBeenCalled();
        expect(a.$btnSubscription).toBeUndefined();
    });

    it('inits swipe and subscribes to button changes', () => {
        buildDom();
        const a = create();
        expect(initSpy).toHaveBeenCalled();
        const items = [{ id: 1 }];
        btnChanges.next(items);
        expect((a as any).actionItems).toBe(items);
        expect(a.threshold()).toBe(10);
    });

    describe('bounds', () => {
        it('returns default bounds for non list-item target', () => {
            buildDom();
            const a = create();
            expect(a.bounds(evt('plain'), 1)).toEqual({ strictUpper: true, strictLower: true, lower: 0, center: 0, upper: 0 });
        });

        it('returns default bounds when no action template exists', () => {
            buildDom({ left: true });
            const a = create();
            const b: any = a.bounds(evt('li1'), -1); // right panel missing
            expect(b.strictUpper).toBe(true);
            expect((a as any).li).toBeUndefined();
        });

        it('returns default bounds when template has no visible buttons', () => {
            buildDom();
            visibleFlag = false;
            const a = create();
            const b: any = a.bounds(evt('li1'), 1);
            expect(b.strictLower).toBe(true);
        });

        it('opens left panel for positive delta and sets limit/proportions', () => {
            buildDom();
            const a = create();
            const b: any = a.bounds(evt('li1'), 1);
            expect(b).toEqual({ strictUpper: false, lower: 0, center: 0, upper: (a as any).limit });
            expect((a as any).position).toBe('left');
            expect((a as any).li[0].id).toBe('li1');
            expect((a as any).transitionProportions).toHaveLength(2);
            expect((a as any).actionPanel.css('float')).toBe('left');
        });

        it('opens right panel for negative delta', () => {
            buildDom();
            const a = create();
            const b: any = a.bounds(evt('li1'), -1);
            expect(b).toEqual({ strictLower: false, lower: -(a as any).limit, center: 0, upper: 0 });
            expect((a as any).position).toBe('right');
        });

        it('returns reverse bounds when same li is swiped with left panel open', () => {
            buildDom();
            const a = create();
            a.bounds(evt('li1'), 1);
            const limit = (a as any).limit;
            expect(a.bounds(evt('li1'), -1)).toEqual({ strictUpper: false, lower: -limit, center: limit });
        });

        it('returns reverse bounds when same li is swiped with right panel open', () => {
            buildDom();
            const a = create();
            a.bounds(evt('li1'), -1);
            const limit = (a as any).limit;
            expect(a.bounds(evt('li1'), 1)).toEqual({ center: -limit, upper: limit, strictLower: false });
        });

        it('returns default bounds for same li when position is unknown', () => {
            buildDom();
            const a = create();
            a.bounds(evt('li1'), 1);
            (a as any).position = 'none';
            expect((a as any).bounds(evt('li1'), 1).strictUpper).toBe(true);
        });

        it('resets previous state when moving to another li', () => {
            buildDom();
            const a = create();
            a.bounds(evt('li1'), 1);
            const prevLi = (a as any).li;
            const resetSpy = jest.spyOn(a as any, 'resetState');
            a.bounds(evt('li2'), 1);
            expect(resetSpy).toHaveBeenCalled();
            expect(prevLi.css('transform')).toBe('none');
            expect((a as any).li[0].id).toBe('li2');
        });

        it('looks up action panel inside group items when groupby is set', () => {
            buildDom({ left: true, groupby: true });
            // ul.list-group is nested within li, so $el.find('>li > ul.list-group >panel') matches
            list.groupby = 'name';
            const a = create();
            const origFind = $.fn.find;
            // constructor finds nothing at top level, so swipe init is skipped; force init-like state
            (a as any).$el = $(root).find('ul.app-livelist-container').first();
            const b: any = a.bounds(evt('li1'), 1);
            expect(b.strictUpper).toBe(false);
            expect((a as any).position).toBe('left');
            expect($.fn.find).toBe(origFind);
        });

        it('does not look in groups when groupby is not set', () => {
            buildDom({ left: true, groupby: true });
            const a = create();
            (a as any).$el = $(root).find('ul.app-livelist-container').first();
            expect((a.bounds(evt('li1'), 1) as any).strictUpper).toBe(true);
        });
    });

    describe('resetElement/resetState/getChildActionElement', () => {
        it('resetElement ignores falsy and resets css', () => {
            buildDom();
            const a = create();
            expect(() => (a as any).resetElement(null)).not.toThrow();
            const el = $('<div>').css({ transform: 'translateX(5px)' });
            (a as any).resetElement(el);
            expect(el.css('transform')).toBe('none');
        });

        it('resetState without actionPanel does not throw', () => {
            buildDom();
            const a = create();
            (a as any).actionPanel = null;
            (a as any).li = undefined;
            expect(() => (a as any).resetState()).not.toThrow();
        });

        it('getChildActionElement returns first/last/undefined', () => {
            buildDom();
            const a = create();
            const tpl = $('<div><button id="f"></button><button id="l"></button></div>');
            (a as any).position = 'left';
            expect((a as any).getChildActionElement(tpl).attr('id')).toBe('f');
            (a as any).position = 'right';
            expect((a as any).getChildActionElement(tpl).attr('id')).toBe('l');
            expect((a as any).getChildActionElement($('<div></div>'))).toBeUndefined();
        });
    });

    describe('transitions', () => {
        it('computeTransitionProportions handles left and right (reverse) positions', () => {
            buildDom();
            const a = create();
            const el = $('<div><span></span><span></span></div>');
            el.children().each((_i: number, c: any) => jest.spyOn($.fn, 'outerWidth').mockReturnValue(50));
            (a as any).position = 'left';
            expect((a as any).computeTransitionProportions(el)).toEqual([0.5, 1]);
            (a as any).position = 'right';
            expect((a as any).computeTransitionProportions(el)).toEqual([1, 0.5]);
            ($.fn.outerWidth as jest.Mock).mockRestore();
        });

        it('context.computeActionTransition handles within and beyond limit', () => {
            buildDom();
            const a = create();
            (a as any).limit = 100;
            (a as any).transitionProportions = [0.5, 1];
            const fn = a.context().computeActionTransition;
            expect(fn(0, 40)).toBe(20);
            expect(fn(0, 150)).toBe(50 + 0.5 * 100);
            expect(fn(1, -150)).toBe(-50 + -100);
        });

        it('animation targets li and action panel children', () => {
            buildDom();
            const a = create();
            (a as any).li = $('<li>');
            (a as any).actionPanel = $('<div><b></b></div>');
            const anim = a.animation();
            expect(anim).toHaveLength(2);
            expect(anim[0].target()).toBe((a as any).li);
            expect(anim[1].target().length).toBe(1);
            (a as any).actionPanel = null;
            expect(anim[1].target()).toBeUndefined();
        });
    });

    describe('invokeFullSwipeEvt', () => {
        const btn = (pos: string, tap = true) => ({
            getAttr: () => pos,
            $element: { is: () => true },
            hasEventCallback: jest.fn().mockReturnValue(tap),
            invokeEventCallback: jest.fn()
        });

        it('invokes tap on first visible left button', () => {
            buildDom();
            const a = create();
            const b1 = btn('left'), b2 = btn('left'), r = btn('right');
            (a as any).actionItems = [b1, b2, r];
            (a as any).position = 'left';
            (a as any).li = $('<li>');
            const ev = {} as any;
            a.invokeFullSwipeEvt(ev);
            expect(b1.invokeEventCallback).toHaveBeenCalledWith('tap', { $event: ev });
            expect(b2.invokeEventCallback).not.toHaveBeenCalled();
            expect((a as any).li).toBeNull();
        });

        it('invokes tap on last visible right button', () => {
            buildDom();
            const a = create();
            const l = btn('left'), r1 = btn('right'), r2 = btn('right');
            (a as any).actionItems = [l, r1, r2];
            (a as any).position = 'right';
            a.invokeFullSwipeEvt({} as any);
            expect(r2.invokeEventCallback).toHaveBeenCalled();
            expect(r1.invokeEventCallback).not.toHaveBeenCalled();
        });

        it('does not invoke when button has no tap callback or no buttons', () => {
            buildDom();
            const a = create();
            const r = btn('right', false);
            (a as any).actionItems = [r];
            (a as any).position = 'right';
            a.invokeFullSwipeEvt({} as any);
            expect(r.invokeEventCallback).not.toHaveBeenCalled();
            (a as any).actionItems = [];
            expect(() => a.invokeFullSwipeEvt({} as any)).not.toThrow();
        });
    });

    describe('onAnimation', () => {
        const setup = (position: string, fullswipe: string | null) => {
            buildDom();
            const a = create();
            (a as any).position = position;
            (a as any).li = $('<li>');
            jest.spyOn((a as any).li, 'outerWidth').mockReturnValue(300);
            const panel = $('<div><button></button><button></button></div>');
            if (fullswipe !== null) { panel.attr('enablefullswipe', fullswipe); }
            jest.spyOn($.fn, 'width').mockReturnValue(100);
            (a as any).actionPanel = panel;
            (a as any).limit = 200;
            (a as any).transitionProportions = [0.5, 1];
            (a as any).rightChildrenCount = 2;
            return a;
        };

        afterEach(() => { ($.fn.width as any).mockRestore?.(); });

        it('only triggers selection when there is no action panel', () => {
            buildDom();
            const a = create();
            (a as any).actionPanel = null;
            a.onAnimation({} as any, 10);
            expect(list.triggerListItemSelection).toHaveBeenCalled();
        });

        it('does nothing extra when fullswipe is disabled', () => {
            const a = setup('left', 'false');
            const spy = jest.spyOn(a, 'invokeFullSwipeEvt');
            a.onAnimation({} as any, 500);
            expect(spy).not.toHaveBeenCalled();
        });

        it('invokes full swipe when distance exceeds 50% (left)', () => {
            const a = setup('left', 'true');
            const spy = jest.spyOn(a, 'invokeFullSwipeEvt').mockImplementation(() => undefined);
            // 0.5*500*100/(300-200+100)=125
            a.onAnimation({} as any, 500);
            expect(spy).toHaveBeenCalled();
        });

        it('invokes full swipe using right index and negative distance', () => {
            const a = setup('right', 'true');
            const spy = jest.spyOn(a, 'invokeFullSwipeEvt').mockImplementation(() => undefined);
            a.onAnimation({} as any, -300);
            expect(spy).toHaveBeenCalled();
        });

        it('does not invoke when distance is under 50%', () => {
            const a = setup('left', 'true');
            const spy = jest.spyOn(a, 'invokeFullSwipeEvt');
            a.onAnimation({} as any, 10);
            expect(spy).not.toHaveBeenCalled();
        });

        it('skips when action panel has no children', () => {
            const a = setup('left', 'true');
            (a as any).actionPanel = $('<div enablefullswipe="true"></div>');
            const spy = jest.spyOn(a, 'invokeFullSwipeEvt');
            a.onAnimation({} as any, 500);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('onLower / onUpper', () => {
        it('onLower resets only for left', () => {
            buildDom();
            const a = create();
            (a as any).li = $('<li>');
            (a as any).position = 'right';
            a.onLower();
            expect((a as any).li).not.toBeNull();
            (a as any).position = 'left';
            a.onLower();
            expect((a as any).li).toBeNull();
        });

        it('onUpper resets only for right', () => {
            buildDom();
            const a = create();
            (a as any).li = $('<li>');
            (a as any).position = 'left';
            a.onUpper();
            expect((a as any).li).not.toBeNull();
            (a as any).position = 'right';
            a.onUpper();
            expect((a as any).li).toBeNull();
        });
    });
});
