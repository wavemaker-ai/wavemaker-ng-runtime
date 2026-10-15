import { propNameCSSKeyMap } from './styler';

const handler = jest.fn();
jest.mock('./property-change-handler', () => ({ globalPropertyChangeHandler: (...args: any[]) => handler(...args) }));

describe('WidgetProxyProvider without native Proxy support', () => {
    const originalProxy = (window as any).Proxy;
    const originalRaf = window.requestAnimationFrame;
    let frames: Function[];
    let create: (instance: any, subType: string, props: Map<string, any>) => any;

    beforeEach(() => {
        frames = [];
        window.requestAnimationFrame = ((cb: any) => frames.push(cb)) as any;
        jest.isolateModules(() => {
            create = require('./widget-proxy-provider').WidgetProxyProvider.create;
        });
        (window as any).Proxy = undefined;
        handler.mockClear();
    });

    afterEach(() => {
        (window as any).Proxy = originalProxy;
        window.requestAnimationFrame = originalRaf;
    });

    it('exposes style and prop accessors that read the instance and write through the change handler', () => {
        const instance: any = { color: 'red', caption: 'hi' };
        const widget = create(instance, 'wm-x', new Map([['caption', {}]]));
        expect(widget.color).toBe('red');
        expect(widget.caption).toBe('hi');
        widget.color = 'blue';
        widget.caption = 'bye';
        expect(handler).toHaveBeenCalledWith(instance, 'color', 'blue');
        expect(handler).toHaveBeenCalledWith(instance, 'caption', 'bye');
        expect(Object.keys(propNameCSSKeyMap).every((key) => key in widget)).toBe(true);
    });

    it('works without widget props', () => {
        expect(() => create({}, 'wm-x', undefined as any)).not.toThrow();
    });

    it('binds instance methods once the next frame runs, except lifecycle hooks', () => {
        const context: any = { name: 'ctx' };
        const instance: any = {
            name: 'ctx',
            greet() { return this.name; },
            ngOnInit() { return this; },
        };
        const ngOnInit = instance.ngOnInit;
        create(instance, 'wm-x', new Map());
        create(instance, 'wm-y', new Map());
        expect(frames).toHaveLength(1);
        frames[0]();
        const greet = instance.greet;
        expect(greet.call(context)).toBe('ctx');
        expect(instance.ngOnInit).toBe(ngOnInit);
        create(instance, 'wm-z', new Map());
        expect(frames).toHaveLength(2);
    });
});
