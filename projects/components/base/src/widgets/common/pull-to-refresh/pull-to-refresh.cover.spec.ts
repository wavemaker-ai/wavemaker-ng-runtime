import { PullToRefresh } from './pull-to-refresh';
import { isIos } from '@wm/core';

jest.mock('@swipey');
jest.mock('@wm/core', () => ({
    isIos: jest.fn(),
    setCSS: jest.fn(),
}));

declare const $: any;

describe('PullToRefresh - cover', () => {
    let app: any;
    let onRefresh: jest.Mock;
    let $el: any;
    let ptr: any;
    let subscribeCb: (data: any) => void;

    const create = (callback: any = onRefresh) => {
        ptr = new PullToRefresh($el, app, callback);
        return ptr;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="host"></div>';
        $el = $('#host');
        onRefresh = jest.fn();
        app = { subscribe: jest.fn((_n: string, cb: any) => { subscribeCb = cb; return jest.fn(); }) };
        (isIos as jest.Mock).mockReturnValue(false);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('creates the spinner and subscribes only on the first bounds call', () => {
        create();
        ptr.bounds({}, 5);
        ptr.bounds({}, 5);
        expect(app.subscribe).toHaveBeenCalledTimes(1);
        expect(ptr.spinner).toBeDefined();
    });

    it('does nothing for variable updates that end when no update is being tracked', () => {
        create();
        ptr.bounds({}, 5);
        const stop = jest.spyOn(ptr, 'stopAnimation').mockImplementation(() => undefined);
        subscribeCb({ active: false });
        expect(ptr.count).toBe(0);
        expect(stop).not.toHaveBeenCalled();
    });

    it('tracks variable updates started during the animation and stops once they all end', () => {
        create();
        ptr.bounds({}, 5);
        const stop = jest.spyOn(ptr, 'stopAnimation').mockImplementation(() => undefined);
        ptr.animationInProgress = true;
        subscribeCb({ active: true });
        expect(ptr.count).toBe(1);
        expect(ptr.runAnimation).toBe(true);
        expect(stop).not.toHaveBeenCalled();
        subscribeCb({ active: false });
        expect(ptr.count).toBe(0);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    it('runs the animation without a pull to refresh callback', () => {
        create(null);
        ptr.bounds({}, 5);
        const stop = jest.spyOn(ptr, 'stopAnimation').mockImplementation(() => undefined);
        ptr.onAnimation();
        expect(ptr.animationInProgress).toBe(true);
        jest.runOnlyPendingTimers();
        expect(stop).toHaveBeenCalledTimes(1);
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it('stops spinners that were never started', () => {
        create();
        ptr.bounds({}, 5);
        ptr.spinner.setRotation(90);
        expect(() => ptr.spinner.stop()).not.toThrow();
        expect(ptr.spinner.intervalId).toBeUndefined();

        (isIos as jest.Mock).mockReturnValue(true);
        const ios = create();
        ios.bounds({}, 5);
        expect(() => ios.spinner.stop()).not.toThrow();
        ios.spinner.setRotation(60);
        expect(ios.spinner.svg.css('transform')).toContain('rotateZ');
        ios.spinner.start();
        jest.advanceTimersByTime(40);
        ios.spinner.stop();
        expect(ios.spinner.intervalId).toBe(0);
    });

    it('does not reset the opacity of the iOS container when the animation stops', () => {
        const { setCSS } = jest.requireMock('@wm/core');
        (isIos as jest.Mock).mockReturnValue(true);
        create();
        ptr.bounds({}, 5);
        setCSS.mockClear();
        ptr.animationInProgress = true;
        ptr.stopAnimation();
        jest.advanceTimersByTime(800);
        expect(ptr.animationInProgress).toBe(false);
        expect(setCSS).toHaveBeenCalledWith(ptr.infoContainer[0], 'transform', 'none');
        expect(setCSS).not.toHaveBeenCalledWith(expect.anything(), 'opacity', 0);
    });
});
