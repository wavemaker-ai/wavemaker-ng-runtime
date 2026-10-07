import { Viewport, ViewportEvent } from './viewport.service';

describe('Viewport service coverage', () => {
    let app: HTMLElement;
    let mq: any;

    beforeEach(() => {
        mq = {
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        window.matchMedia = jest.fn().mockReturnValue(mq);
        app = document.createElement('div');
        app.className = 'wm-app';
        Object.defineProperty(app, 'clientWidth', { value: 1000, configurable: true });
        Object.defineProperty(app, 'clientHeight', { value: 500, configurable: true });
        document.body.appendChild(app);
    });

    afterEach(() => {
        app.remove();
        jest.restoreAllMocks();
    });

    it('does not notify orientation change when orientation is unchanged', () => {
        const vp: any = new Viewport();
        expect(vp.orientation.isPortrait).toBe(true);
        const spy = jest.spyOn(vp, 'notify');
        vp.orientationChange({}, false); // isLandscape false === current isLandscape false
        expect(spy).not.toHaveBeenCalled();
        vp.orientationChange({}, true);
        expect(spy).toHaveBeenCalledWith(ViewportEvent.ORIENTATION_CHANGE, expect.objectContaining({ data: { isPortrait: false, isLandscape: true } }));
        vp.ngOnDestroy();
    });

    it('resizeFn returns early when .wm-app is absent', () => {
        const vp: any = new Viewport();
        const spy = jest.spyOn(vp, 'notify');
        app.remove();
        vp.resizeFn({});
        expect(spy).not.toHaveBeenCalled();
        vp.ngOnDestroy();
    });

    it('leaves both device flags false for an unknown deviceCategory', () => {
        const vp: any = new Viewport();
        vp.update({ deviceCategory: 'Watch' });
        expect(vp.isTabletType).toBe(false);
        expect(vp.isMobileType).toBe(false);
        vp.ngOnDestroy();
    });

    it('ngOnDestroy is idempotent and tolerates missing media query listeners', () => {
        const vp: any = new Viewport();
        vp.ngOnDestroy();
        expect(mq.removeEventListener).toHaveBeenCalledTimes(1);
        expect(() => vp.ngOnDestroy()).not.toThrow();
        expect(mq.removeEventListener).toHaveBeenCalledTimes(1);

        const vp2: any = new Viewport();
        vp2.mediaQuery = { removeEventListener: undefined };
        vp2.ngOnDestroy();
        expect(vp2.mediaQuery).toBeNull();
    });

    it('skips media query listener when addEventListener is unsupported', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        const vp: any = new Viewport();
        expect(vp.orientation.isLandscape).toBe(true);
        expect(vp.boundOrientationChange).toBeUndefined();
        vp.ngOnDestroy();
    });
});
