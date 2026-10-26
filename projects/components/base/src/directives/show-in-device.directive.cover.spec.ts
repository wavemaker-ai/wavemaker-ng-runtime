import { ShowInDeviceDirective } from './show-in-device.directive';
import { isLargeTabletPortrait, isLargeTabletLandscape } from '@wm/core';

jest.mock('@wm/core', () => ({
    isLargeTabletLandscape: jest.fn(),
    isLargeTabletPortrait: jest.fn(),
}));

describe('ShowInDeviceDirective - additional branches', () => {
    let vcr: any;
    let matches: (q: string) => boolean;

    const create = (explicit: any = { a: 1 }) =>
        new ShowInDeviceDirective(vcr, { _lView: [0, 0, 0, 0, 0, 0, 0, 0, { x: 1 }] } as any, {} as any, explicit);

    beforeEach(() => {
        vcr = { createEmbeddedView: jest.fn(() => ({ view: true })), clear: jest.fn() };
        matches = () => false;
        (isLargeTabletLandscape as jest.Mock).mockReturnValue(false);
        (isLargeTabletPortrait as jest.Mock).mockReturnValue(false);
        window.matchMedia = jest.fn((q: string) => ({ matches: matches(q), media: q })) as any;
        // empty css variables -> the default breakpoints are used
        jest.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '' } as any);
    });
    afterEach(() => jest.restoreAllMocks());

    it('falls back to default breakpoints when css variables are missing', () => {
        matches = (q) => q === '(min-width: 1200px)';
        const d = create();
        d.wmShowInDevice = 'lg';
        expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1200px)');
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(1);

        matches = (q) => q === '(min-width: 992px) and (max-width: 1199px)';
        const md = create();
        md.wmShowInDevice = 'md';
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(2);

        matches = (q) => q === '(min-width: 768px) and (max-width: 991px)';
        const sm = create();
        sm.wmShowInDevice = 'sm';
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(3);

        matches = (q) => q === '(max-width: 767px)';
        const xs = create();
        xs.wmShowInDevice = 'xs';
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(4);
        expect(isLargeTabletLandscape).toHaveBeenCalledWith('1366px', '1024px');
    });

    it('shows sm content on a large tablet in portrait even if the media query does not match', () => {
        (isLargeTabletPortrait as jest.Mock).mockReturnValue(true);
        const d = create();
        d.wmShowInDevice = 'sm';
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(1);
    });

    it('does not recreate the view when it already exists', () => {
        const d = create();
        d.wmShowInDevice = 'all';
        (d as any).onResize();
        expect(vcr.createEmbeddedView).toHaveBeenCalledTimes(1);
    });

    it('clears the view when no device matches', () => {
        const d = create();
        d.wmShowInDevice = 'lg';
        expect(vcr.clear).toHaveBeenCalled();
        expect((d as any).embeddedView).toBe('');
    });

    it('cleans up everything on destroy and tolerates a second destroy', () => {
        const remove = jest.spyOn(window, 'removeEventListener');
        const d = create();
        d.wmShowInDevice = 'all';
        expect(Object.keys((d as any).context).sort()).toEqual(['a', 'x']);
        vcr.clear.mockClear();
        d.ngOnDestroy();
        expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
        expect(vcr.clear).toHaveBeenCalledTimes(1);
        expect((d as any).embeddedView).toBeNull();
        expect((d as any).context).toBeNull();
        expect(() => d.ngOnDestroy()).not.toThrow();
        expect(vcr.clear).toHaveBeenCalledTimes(1);
    });
});
