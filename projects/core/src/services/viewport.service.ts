import {Injectable, OnDestroy} from '@angular/core';
import {EventNotifier} from '../utils/event-notifier';
import {isAndroid, isAndroidTablet, isIos} from '../utils/utils';
import {get} from "lodash-es";

let MINIMUM_MOBILE_WIDTH = 480;
let MINIMUM_TAB_WIDTH = 768;
let MINIMUM_LARGE_SCREEN_WIDTH = 1200;

const enum SCREEN_TYPE {
    MOBILE,
    TABLET,
    LARGE_SCREEN_DEVICES
}

export class IViewportService {
    notify: (eventname: ViewportEvent, options?: Array<any>) => void;
    subscribe: (eventname: ViewportEvent, callback: (data: any) => void) => void;
}

export const enum ViewportEvent {
    ORIENTATION_CHANGE = 'orientationchange',
    RESIZE = 'resize'
}

@Injectable({providedIn: 'root'})
export class Viewport implements IViewportService, OnDestroy {
    public orientation = {
        isPortrait: false,
        isLandscape: false
    };
    public isMobileType = false;
    public isTabletType = false;
    private type;
    public _eventNotifier = new EventNotifier(true);
    private screenWidth;
    private screenHeight;
    private selectedViewPort: any;
    private boundResizeFn: (event: Event) => void; // MEMORY LEAK FIX: Store bound function
    private mediaQuery: MediaQueryList; // MEMORY LEAK FIX: Store media query reference for cleanup
    private boundOrientationChange: (event: MediaQueryListEvent) => void; // MEMORY LEAK FIX: Store bound function

    constructor() {
        this.setScreenType();

        // MEMORY LEAK FIX: Store bound function reference for proper removal
        this.boundResizeFn = this.resizeFn.bind(this);
        window.addEventListener(ViewportEvent.RESIZE, this.boundResizeFn);

        this.mediaQuery = window.matchMedia('(orientation: portrait)');
        if (this.mediaQuery.matches) {
            this.orientation.isPortrait = true;
        } else {
            this.orientation.isLandscape = true;
        }

        // Add a media query change listener
        // addEventListener is not supported ios browser
        if (this.mediaQuery.addEventListener) {
            // MEMORY LEAK FIX: Store bound function reference for proper removal
            this.boundOrientationChange = ($event) => this.orientationChange($event, !$event.matches);
            this.mediaQuery.addEventListener('change', this.boundOrientationChange);
        }
    }

    update(selectedViewPort: object) {
        this.selectedViewPort = selectedViewPort;
        this.setScreenType();
    }

    private orientationChange($event, isLandscape) {
        if (isLandscape !== this.orientation.isLandscape) {
            this.orientation.isPortrait = !isLandscape;
            this.orientation.isLandscape = isLandscape;
            this.notify(ViewportEvent.ORIENTATION_CHANGE, { $event, data: {isPortrait: !isLandscape, isLandscape: isLandscape} });
        }
    }

    private resizeFn($event) {
        const $el = document.querySelector('.wm-app');
        if (!$el) {
            return;
        }
        this.setScreenType();
        this.orientationChange($event, this.screenWidth >= this.screenHeight);
        this.notify(ViewportEvent.RESIZE, {$event, data: {screenWidth: this.screenWidth, screenHeight: this.screenHeight}});
    }

    public subscribe(eventName: string, callback: (data: any) => void): () => void {
        return this._eventNotifier.subscribe(eventName, callback);
    }

    public notify(eventName: string, ...data: Array<any>) {
        this._eventNotifier.notify(eventName, ...data);
    }

    private setScreenType() {
        const $el = document.querySelector('.wm-app');
        this.screenWidth = $el.clientWidth;
        this.screenHeight = $el.clientHeight;

        // const minValue = this.screenWidth < this.screenHeight ? this.screenWidth : this.screenHeight;
        // const maxValue = this.screenWidth > this.screenHeight ? this.screenWidth : this.screenHeight;

        this.isTabletType = false;
        this.isMobileType = false;

        if (get(this.selectedViewPort, 'deviceCategory')) {
            const deviceCategory = (this.selectedViewPort as any).deviceCategory;
            if (deviceCategory === 'Tab') {
                this.isTabletType = true;
            } else if (deviceCategory === 'Smartphone') {
                this.isMobileType = true;
            }
        } else {
             MINIMUM_MOBILE_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--screen-xs')) || 480;
             MINIMUM_TAB_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--screen-sm')) || 768;
             MINIMUM_LARGE_SCREEN_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--screen-lg')) || 1200;
            if (this.screenWidth >= MINIMUM_LARGE_SCREEN_WIDTH) {
                this.isTabletType = isAndroid() || isIos() || isAndroidTablet();
                this.isMobileType = false;
            } else if (this.screenWidth >= MINIMUM_TAB_WIDTH) {
                this.type = SCREEN_TYPE.TABLET;
                this.isTabletType = true;
            } else {
                this.type = SCREEN_TYPE.MOBILE;
                this.isMobileType = true;
            }
        }
    }

    ngOnDestroy() {
        this._eventNotifier.destroy();
        
        // MEMORY LEAK FIX: Remove resize event listener using stored bound function reference
        if (this.boundResizeFn) {
            window.removeEventListener('resize', this.boundResizeFn);
            this.boundResizeFn = null;
        }

        // MEMORY LEAK FIX: Remove media query orientation change listener
        if (this.mediaQuery && this.boundOrientationChange && this.mediaQuery.removeEventListener) {
            this.mediaQuery.removeEventListener('change', this.boundOrientationChange);
            this.boundOrientationChange = null;
        }
        this.mediaQuery = null;
    }
}
