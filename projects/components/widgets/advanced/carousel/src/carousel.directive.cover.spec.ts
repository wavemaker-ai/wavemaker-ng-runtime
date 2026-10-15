import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { CarouselModule } from 'ngx-bootstrap/carousel';
import { CarouselDirective } from './carousel.directive';
import { PipeProvider } from '../../../../../runtime-base/src/services/pipe-provider.service';
import { App, setPipeProvider, AbstractI18nService } from '@wm/core';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import '@wm/swipey';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { SanitizePipe } from '@wm/components/base';

@Component({
    standalone: false,
    template: `<div class="app-carousel carousel"><carousel wmCarousel #c="wmCarousel" height="100" animation="none" type="dynamic" name="carousel1" interval="0"></carousel></div>`
})
class CarouselCoverHost {
    @ViewChild('c', { static: true }) carousel: CarouselDirective;
    constructor(_pipeProvider: PipeProvider) {
        setPipeProvider(_pipeProvider);
    }
}

describe('CarouselDirective (cover)', () => {
    let fixture: ComponentFixture<CarouselCoverHost>;
    let dir: any;

    beforeAll(() => {
        ($ as any).fn.swipey = { DIRECTIONS: { HORIZONTAL: 'horizontal', VERTICAL: 'vertical' } };
        ($.fn as any).swipeAnimation = jest.fn().mockReturnValue({ on: jest.fn(), off: jest.fn() });
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [CarouselModule, CarouselDirective],
            declarations: [CarouselCoverHost],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                SanitizePipe
            ]
        });
        fixture = TestBed.createComponent(CarouselCoverHost);
        fixture.detectChanges();
        dir = fixture.componentInstance.carousel;
    });

    afterEach(() => {
        jest.useRealTimers();
        TestBed.resetTestingModule();
    });

    it('does nothing when starting or stopping animation without an animator', () => {
        dir.animator = undefined;
        expect(() => dir.stopAnimation()).not.toThrow();
        dir.animationinterval = 3;
        expect(() => dir.startAnimation()).not.toThrow();
        expect(dir.animator).toBeUndefined();
    });

    it('starts the animator with the interval converted to milliseconds', () => {
        dir.animator = { interval: 0, start: jest.fn(), stop: jest.fn() };
        dir.animationinterval = 3;
        dir.startAnimation();
        expect(dir.animator.interval).toBe(3000);
        expect(dir.animator.start).toHaveBeenCalled();
    });

    it('keeps currentslide and skips creating an animator when there are no slides and no field defs', () => {
        jest.useFakeTimers();
        dir.animator = undefined;
        dir.fieldDefs = [];
        dir.currentslide = 'unchanged';
        dir.onSlidesRender([]);
        jest.advanceTimersByTime(100);
        expect(dir.currentslide).toBe('unchanged');
        expect(dir.animator).toBeUndefined();
    });

    it('destroys cleanly when the subscription and slides are already cleared', () => {
        dir.slidesChangesSubscription = null;
        dir.slides = null;
        expect(() => dir.ngOnDestroy()).not.toThrow();
        expect(dir.animator).toBeNull();
        expect(dir.fieldDefs).toBeNull();
    });
});
