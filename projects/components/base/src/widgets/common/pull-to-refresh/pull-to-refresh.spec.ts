import { PullToRefresh } from './pull-to-refresh';
import { isIos, setCSS } from '@wm/core';

// Mock dependencies
jest.mock('@swipey');
jest.mock('@wm/core', () => ({
  isIos: jest.fn(),
  setCSS: jest.fn()
}));

describe('PullToRefresh', () => {
  let pullToRefresh: PullToRefresh;
  let mockEl: any;
  let mockApp: any;
  let mockOnPullToRefresh: jest.Mock;

  beforeEach(() => {
    // Mock jQuery
    (global as any).$ = jest.fn().mockReturnValue({
      prepend: jest.fn(),
      find: jest.fn().mockReturnValue({
        addClass: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        removeClass: jest.fn(),
        remove: jest.fn(),
      }),
      // Add this line to mock the array-like behavior of jQuery objects
      0: {
        iscroll: {
          y: 0
        }
      }
    });

    mockEl = $('<div>');
    mockApp = {
      subscribe: jest.fn(),
    };
    mockOnPullToRefresh = jest.fn();

    (isIos as jest.Mock).mockReturnValue(false);

    pullToRefresh = new PullToRefresh(mockEl, mockApp, mockOnPullToRefresh);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('constructor initializes properly', () => {
    expect(mockEl.prepend).toHaveBeenCalledWith('<div class="refresh-container"></div>');
    expect(pullToRefresh['infoContainer']).toBeDefined();
  });

  test('threshold returns 10', () => {
    expect(pullToRefresh.threshold()).toBe(10);
  });

  test('direction returns swipey VERTICAL constant', () => {
    ($ as any).fn = { swipey: { DIRECTIONS: { VERTICAL: 'VERTICAL' } } };
    expect(pullToRefresh.direction()).toBe('VERTICAL');
  });


  test('bounds returns correct values when scroll is at top', () => {
    const mockEvent = {} as any;
    const mockD = 0;
    const result = pullToRefresh.bounds(mockEvent, mockD);
    expect(result).toEqual({
      lower: 0,
      center: 0,
      upper: 150,
      strict: true,
    });
  });

  test('bounds returns undefined values when scroll is not at top', () => {
    const mockEvent = {} as any;
    const mockD = 0;

    // Mock scroll position not at top
    (pullToRefresh['$el'][0] as any).iscroll.y = -10;

    const result = pullToRefresh.bounds(mockEvent, mockD);
    expect(result).toEqual({
      lower: undefined,
      upper: undefined,
    });
  });

  test('bounds returns undefined values when $d is negative', () => {
    const mockEvent = {} as any;
    const mockD = -1;

    const result = pullToRefresh.bounds(mockEvent, mockD);
    expect(result).toEqual({
      lower: undefined,
      upper: undefined,
    });
  });

  test('bounds initializes spinner for iOS', () => {
    (isIos as jest.Mock).mockReturnValue(true);
    pullToRefresh = new PullToRefresh(mockEl, mockApp, mockOnPullToRefresh);

    const mockEvent = {} as any;
    const mockD = 0;

    const result = pullToRefresh.bounds(mockEvent, mockD);

    expect(result).toEqual({
      lower: 0,
      center: 0,
      upper: 0,
      strict: false,
    });
    expect(pullToRefresh['spinner']).toBeDefined();
  });

  test('context returns object with spin function', () => {
    const context = pullToRefresh.context();
    expect(context).toHaveProperty('spin');
    expect(typeof context['spin']).toBe('function');
  });

  test('context spin callback doubles the drag delta and forwards it to the spinner', () => {
    const mockSpinner = {
      start: jest.fn(),
      stop: jest.fn(),
      setRotation: jest.fn(),
    };
    pullToRefresh['spinner'] = mockSpinner as any;

    const context = pullToRefresh.context();
    context['spin'](15);

    expect(mockSpinner.setRotation).toHaveBeenCalledWith(30);
  });

  test('animation returns correct object for Android', () => {
    const result = pullToRefresh.animation();
    expect(result).toHaveProperty('target');
    expect(result).toHaveProperty('css');
  });

  test('animation returns correct object for iOS', () => {
    (isIos as jest.Mock).mockReturnValue(true);
    const result = pullToRefresh.animation();
    expect(result).toHaveProperty('css');
    expect(result.css).toHaveProperty('transform');
    expect(result.css).toHaveProperty('spin');
  });

  test('onAnimation starts spinner and calls onPullToRefresh', () => {
    const mockSpinner = {
      start: jest.fn(),
      stop: jest.fn(),
      setRotation: jest.fn(),
    };
    pullToRefresh['spinner'] = mockSpinner;

    pullToRefresh.onAnimation();

    expect(mockSpinner.start).toHaveBeenCalledTimes(1);
    expect(mockOnPullToRefresh).toHaveBeenCalledTimes(1);
  });

  test('stopAnimation stops spinner and hides infoContainer', () => {
    jest.useFakeTimers();

    const mockSpinner = {
      start: jest.fn(),
      stop: jest.fn(),
      setRotation: jest.fn(),
    };
    pullToRefresh['spinner'] = mockSpinner;

    pullToRefresh.stopAnimation();

    jest.runAllTimers();

    expect(mockSpinner.stop).toHaveBeenCalled();
    expect(pullToRefresh['infoContainer'].hide).toHaveBeenCalled();
    expect(setCSS).toHaveBeenCalledTimes(2);
  });

  test('wait sets runAnimation to true', () => {
    pullToRefresh.wait();
    expect(pullToRefresh['runAnimation']).toBe(true);
  });

  describe('subscribe method', () => {
    beforeEach(() => {
      pullToRefresh['animationInProgress'] = false;
      pullToRefresh['count'] = 0;
      pullToRefresh.wait = jest.fn();
      pullToRefresh.stopAnimation = jest.fn();
    });

    test('should set up subscription correctly', () => {
      pullToRefresh['subscribe']();
      expect(mockApp.subscribe).toHaveBeenCalledWith('toggle-variable-state', expect.any(Function));
    });

    test('should increment count and call wait when data.active is true and animation is in progress', () => {
      pullToRefresh['subscribe']();
      const callback = mockApp.subscribe.mock.calls[0][1];

      pullToRefresh['animationInProgress'] = true;
      callback({ active: true });

      expect(pullToRefresh['count']).toBe(1);
      expect(pullToRefresh.wait).toHaveBeenCalled();
    });

    test('should decrement count when data.active is false and count is greater than 0', () => {
      pullToRefresh['subscribe']();
      const callback = mockApp.subscribe.mock.calls[0][1];

      pullToRefresh['count'] = 2;
      callback({ active: false });

      expect(pullToRefresh['count']).toBe(1);
    });

    test('should call stopAnimation when count becomes 0 and animation is in progress', () => {
      pullToRefresh['subscribe']();
      const callback = mockApp.subscribe.mock.calls[0][1];

      pullToRefresh['animationInProgress'] = true;
      pullToRefresh['count'] = 1;
      callback({ active: false });

      expect(pullToRefresh['count']).toBe(0);
      expect(pullToRefresh.stopAnimation).toHaveBeenCalled();
    });

    test('should not call stopAnimation when count is not 0', () => {
      pullToRefresh['subscribe']();
      const callback = mockApp.subscribe.mock.calls[0][1];

      pullToRefresh['animationInProgress'] = true;
      pullToRefresh['count'] = 2;
      callback({ active: false });

      expect(pullToRefresh['count']).toBe(1);
      expect(pullToRefresh.stopAnimation).not.toHaveBeenCalled();
    });

    test('should not call stopAnimation when animation is not in progress', () => {
      pullToRefresh['subscribe']();
      const callback = mockApp.subscribe.mock.calls[0][1];

      pullToRefresh['animationInProgress'] = false;
      pullToRefresh['count'] = 1;
      callback({ active: false });

      expect(pullToRefresh['count']).toBe(0);
      expect(pullToRefresh.stopAnimation).not.toHaveBeenCalled();
    });

    test('should store cancelSubscription function', () => {
      const mockCancelFunction = jest.fn();
      mockApp.subscribe.mockReturnValue(mockCancelFunction);

      pullToRefresh['subscribe']();

      expect(pullToRefresh['cancelSubscription']).toBe(mockCancelFunction);
    });
  });

  describe('Spinner functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('bounds initializes AndroidSpinner when not iOS', () => {
      const mockEvent = {} as any;
      const mockD = 0;

      pullToRefresh.bounds(mockEvent, mockD);

      expect(mockEl.find('.android-spinner')).toBeDefined();
    });

    test('bounds initializes IOSSpinner when iOS', () => {
      (isIos as jest.Mock).mockReturnValue(true);
      pullToRefresh = new PullToRefresh(mockEl, mockApp, mockOnPullToRefresh);

      const mockEvent = {} as any;
      const mockD = 0;

      pullToRefresh.bounds(mockEvent, mockD);

      expect(mockEl.find('.ios-spinner')).toBeDefined();
    });
  });

  describe('context iOS branch', () => {
    test('adds the entry class for iOS', () => {
      (isIos as jest.Mock).mockReturnValue(true);
      pullToRefresh = new PullToRefresh(mockEl, mockApp, mockOnPullToRefresh);
      pullToRefresh.context();
      expect(pullToRefresh['infoContainer'].addClass).toHaveBeenCalledWith('entry');
    });
  });

  describe('onAnimation timeout behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      pullToRefresh['spinner'] = { start: jest.fn(), stop: jest.fn(), setRotation: jest.fn() } as any;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('calls stopAnimation when runAnimation is not set', () => {
      const stopSpy = jest.spyOn(pullToRefresh, 'stopAnimation').mockImplementation(() => undefined);
      pullToRefresh['runAnimation'] = false;
      pullToRefresh.onAnimation();
      jest.runAllTimers();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('does not call stopAnimation when runAnimation is true', () => {
      const stopSpy = jest.spyOn(pullToRefresh, 'stopAnimation').mockImplementation(() => undefined);
      pullToRefresh['runAnimation'] = true;
      pullToRefresh.onAnimation();
      jest.runAllTimers();
      expect(stopSpy).not.toHaveBeenCalled();
    });

    test('does not throw when onPullToRefresh callback is not provided', () => {
      const instance = new PullToRefresh(mockEl, mockApp, undefined as any);
      instance['spinner'] = { start: jest.fn(), stop: jest.fn(), setRotation: jest.fn() } as any;
      expect(() => instance.onAnimation()).not.toThrow();
      jest.runAllTimers();
    });
  });

  describe('destroy', () => {
    test('cleans up subscription, animation, spinner and infoContainer', () => {
      const cancelSpy = jest.fn();
      pullToRefresh['cancelSubscription'] = cancelSpy;
      pullToRefresh['animationInProgress'] = true;
      const stopAnimationSpy = jest.spyOn(pullToRefresh, 'stopAnimation').mockImplementation(() => undefined);
      const mockSpinner = { start: jest.fn(), stop: jest.fn(), setRotation: jest.fn() };
      pullToRefresh['spinner'] = mockSpinner as any;
      const infoContainerRef = pullToRefresh['infoContainer'];

      pullToRefresh.destroy();

      expect(cancelSpy).toHaveBeenCalled();
      expect(pullToRefresh['cancelSubscription']).toBeNull();
      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(pullToRefresh['spinner']).toBeNull();
      expect(infoContainerRef.remove).toHaveBeenCalled();
      expect(pullToRefresh['infoContainer']).toBeNull();
    });

    test('is a no-op safe call when nothing is set', () => {
      pullToRefresh['cancelSubscription'] = null;
      pullToRefresh['animationInProgress'] = false;
      pullToRefresh['spinner'] = null;
      pullToRefresh['infoContainer'] = null;
      expect(() => pullToRefresh.destroy()).not.toThrow();
    });
  });

  describe('Spinner internal behavior with real jQuery', () => {
    let realJQuery: any;
    let hostEl: any;
    let realPullToRefresh: PullToRefresh;

    beforeEach(() => {
      realJQuery = require('jquery');
      (global as any).$ = realJQuery;
      hostEl = realJQuery('<div></div>');
      document.body.appendChild(hostEl[0]);
      mockApp = { subscribe: jest.fn() };
      mockOnPullToRefresh = jest.fn();
    });

    afterEach(() => {
      hostEl.remove();
    });

    test('AndroidSpinner start/setRotation/stop manipulate the DOM', () => {
      (isIos as jest.Mock).mockReturnValue(false);
      realPullToRefresh = new PullToRefresh(hostEl, mockApp, mockOnPullToRefresh);
      realPullToRefresh.bounds({} as any, 0);
      const spinner: any = realPullToRefresh['spinner'];
      expect(spinner).toBeDefined();

      jest.useFakeTimers();
      spinner.start();
      expect(hostEl.find('.android-spinner').hasClass('spin')).toBe(true);
      jest.advanceTimersByTime(500);
      spinner.stop();
      expect(hostEl.find('.android-spinner').hasClass('spin')).toBe(false);
      jest.useRealTimers();
    });

    test('IOSSpinner start/setRotation/stop manipulate the DOM', () => {
      (isIos as jest.Mock).mockReturnValue(true);
      realPullToRefresh = new PullToRefresh(hostEl, mockApp, mockOnPullToRefresh);
      realPullToRefresh.bounds({} as any, 0);
      const spinner: any = realPullToRefresh['spinner'];
      expect(spinner).toBeDefined();

      jest.useFakeTimers();
      spinner.start();
      expect(hostEl.find('.ios-spinner svg line').length).toBeGreaterThan(0);
      jest.advanceTimersByTime(100);
      spinner.stop();
      jest.useRealTimers();
    });

    test('AndroidSpinner setRotation updates the arc path directly and reuses an existing initialization', () => {
      (isIos as jest.Mock).mockReturnValue(false);
      realPullToRefresh = new PullToRefresh(hostEl, mockApp, mockOnPullToRefresh);
      realPullToRefresh.bounds({} as any, 0);
      const spinner: any = realPullToRefresh['spinner'];

      // First call initializes the spinner (small arc, <= 180 degrees).
      spinner.setRotation(90);
      const pathEl = hostEl.find('.android-spinner path');
      const firstD = pathEl.attr('d');
      expect(firstD).toContain('M');
      expect(hostEl.find('.android-spinner').length).toBe(1);

      // Second call must hit the "already initialized" guard in init() instead of
      // appending another svg/container, while still updating the path (large arc, > 180 degrees).
      spinner.setRotation(200);
      const secondD = pathEl.attr('d');
      expect(secondD).not.toBe(firstD);
      expect(hostEl.find('.android-spinner').length).toBe(1);
    });

    test('AndroidSpinner start() interval traverses the large-arc and wrap-around branches', () => {
      (isIos as jest.Mock).mockReturnValue(false);
      realPullToRefresh = new PullToRefresh(hostEl, mockApp, mockOnPullToRefresh);
      realPullToRefresh.bounds({} as any, 0);
      const spinner: any = realPullToRefresh['spinner'];
      const describeArcSpy = jest.spyOn(spinner, 'describeArc');

      jest.useFakeTimers();
      spinner.start();
      // interval = (1800 * 10) / 360 = 50ms; 80 ticks pushes i past both the
      // ">360" (720 - i) branch and the ">720" (wrap back to 0) branch.
      jest.advanceTimersByTime(50 * 80);
      spinner.stop();
      jest.useRealTimers();

      const endAngles = describeArcSpy.mock.calls.map((call: any[]) => call[4]);

      // The "720 - i" branch (i > 360) counts back down to 0 as i keeps climbing,
      // producing a strictly decreasing run of angles - proof that branch executed.
      expect(endAngles.some((deg, idx) => idx > 0 && deg < endAngles[idx - 1])).toBe(true);

      // Angle 0 is reachable two different ways: once when the countdown above hits
      // exactly 0 (i === 720), and again on the very next tick when i > 720 wraps
      // back to 0. Seeing it at least twice proves the wrap-around branch also ran
      // (a single occurrence would mean only the countdown branch fired).
      expect(endAngles.filter(deg => deg === 0).length).toBeGreaterThanOrEqual(2);

      // Both the small-arc (<=180) and large-arc (>180) paths of describeArc's
      // sweep-flag ternary were exercised while counting up/down through 180-360.
      expect(endAngles.some(deg => deg > 0 && deg <= 180)).toBe(true);
      expect(endAngles.some(deg => deg > 180)).toBe(true);
    });
  });
});