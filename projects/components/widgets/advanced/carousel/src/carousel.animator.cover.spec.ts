import { CarouselAnimator } from './carousel.animator';

jest.mock('@swipey', () => ({
    SwipeAnimation: class MockSwipeAnimation {
        init() { }
        bounds() { }
        context() { }
        animation() { }
        onUpper() { }
        onLower() { }
        onAnimation() { }
        threshold() { }
    }
}));

describe('CarouselAnimator onAnimation aria-labels (real DOM)', () => {
    const build = (activeIdx: number) => {
        const root = document.createElement('div');
        root.innerHTML = '<a class="left carousel-control"></a><a class="right carousel-control"></a>' +
            '<div class="carousel-inner"><div class="carousel-item"></div><div class="carousel-item"></div><div class="carousel-item"></div></div>';
        const items = Array.from(root.querySelectorAll('.carousel-item'));
        items[activeIdx].classList.add('active');
        // lodash findIndex(items, element) uses _.matches, so give each element a distinguishing own property
        items.forEach((el: any, i) => (el.__idx = i));
        const carousel: any = { getNativeElement: () => document.createElement('div'), onChangeCB: jest.fn() };
        const animator: any = new CarouselAnimator(carousel, 1000, { runOutsideAngular: (fn: any) => fn() } as any);
        animator._items = items;
        animator._activeIndex = 0;
        animator._oldIndex = 0;
        animator._$el = $(root);
        return { animator, root, carousel };
    };

    it('wraps left label to total count and right label to next position when first item is active', () => {
        const { animator, root, carousel } = build(0);
        animator.onAnimation();
        expect(root.querySelector('.left')!.getAttribute('aria-label')).toBe('3 of 3');
        expect(root.querySelector('.right')!.getAttribute('aria-label')).toBe('2 of 3');
        expect(carousel.onChangeCB).toHaveBeenCalledWith(0, 0);
    });

    it('uses index for left label and wraps right label to 1 when last item is active', () => {
        const { animator, root } = build(2);
        animator.onAnimation();
        expect(root.querySelector('.left')!.getAttribute('aria-label')).toBe('2 of 3');
        expect(root.querySelector('.right')!.getAttribute('aria-label')).toBe('1 of 3');
    });
});
