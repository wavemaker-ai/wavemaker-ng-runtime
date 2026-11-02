import { Subject } from 'rxjs';

jest.mock('@wm/components/prefab', () => ({ PrefabDirective: class PrefabDirective {} }));
jest.mock('../directives/prefab.directive', () => ({ PrefabDirective: class PrefabLoader {} }));
jest.mock('../services/prefab-manager.service', () => ({ PrefabManagerService: class PrefabManagerService {} }));

import { PrefabPreviewComponent } from './prefab-preview.component';

describe('PrefabPreviewComponent', () => {
    let comp: any;
    let manager: any;
    let top: jest.SpyInstance;
    let readyState: Subject<any>;
    const flush = () => new Promise(r => setTimeout(r));
    const send = (data: any) => window.dispatchEvent(new MessageEvent('message', { data }));
    const posted = (action: string) => top.mock.calls.map(c => c[0]).filter(d => d.action === action);

    beforeEach(() => {
        manager = { getConfig: jest.fn(() => Promise.resolve({ properties: {} })) };
        top = jest.spyOn(window.top, 'postMessage').mockImplementation(() => {});
        readyState = new Subject();
        comp = new PrefabPreviewComponent(manager);
        comp.prefabInstance = { readyState, widget: {} };
    });

    afterEach(() => {
        comp.ngOnDestroy();
        top.mockRestore();
    });

    describe('message handling', () => {
        it('ignores messages for other contexts and without data', () => {
            const init = jest.spyOn(comp, 'init');
            send({ context: 'OTHER', action: 'init' });
            send(null);
            expect(init).not.toHaveBeenCalled();
        });

        it('routes actions to their handlers', () => {
            const init = jest.spyOn(comp, 'init').mockImplementation(() => {});
            const setProperty = jest.spyOn(comp, 'setProperty').mockImplementation(() => {});
            const outbound = jest.spyOn(comp, 'getOutboundProps').mockImplementation(() => {});
            const invoke = jest.spyOn(comp, 'invokeScript').mockImplementation(() => {});

            send({ context: 'PREFAB', action: 'init' });
            send({ context: 'PREFAB', action: 'set-property', payload: { name: 'a', value: 1 } });
            send({ context: 'PREFAB', action: 'get-outbound-properties' });
            send({ context: 'PREFAB', action: 'invoke-script', payload: { script: '1' } });
            send({ context: 'PREFAB', action: 'unknown' });

            expect(init).toHaveBeenCalledTimes(1);
            expect(setProperty).toHaveBeenCalledWith({ name: 'a', value: 1 });
            expect(outbound).toHaveBeenCalledTimes(1);
            expect(invoke).toHaveBeenCalledWith({ script: '1' });
        });
    });

    describe('postMessage / event forwarding', () => {
        it('posts to the top window with the prefab context', () => {
            comp.postMessage('act', { p: 1 });
            expect(top).toHaveBeenCalledWith({ context: 'PREFAB', action: 'act', payload: { p: 1 } }, '*');
        });

        it('forwards prefab events as event-log messages', () => {
            comp.setupEventListeners();
            comp.prefabInstance.invokeEventCallback('click', { x: 1 });
            comp.prefabInstance.invokeEventCallback('load');
            expect(posted('event-log')).toEqual([
                { context: 'PREFAB', action: 'event-log', payload: { name: 'click', data: { x: 1 } } },
                { context: 'PREFAB', action: 'event-log', payload: { name: 'load', data: {} } }
            ]);
        });
    });

    describe('init', () => {
        it('posts the config once the prefab is ready', async () => {
            const config = { properties: { a: {} } };
            manager.getConfig.mockResolvedValue(config);
            comp.init();
            expect(comp.previewMode).toBe(true);
            readyState.next(1);
            readyState.complete();
            await flush();
            expect(manager.getConfig).toHaveBeenCalledWith('__self__');
            expect(posted('config')[0].payload).toBe(config);
            expect(typeof comp.prefabInstance.invokeEventCallback).toBe('function');
        });

        it('ignores readyState errors', async () => {
            comp.init();
            readyState.error('ignored');
            await flush();
            expect(manager.getConfig).not.toHaveBeenCalled();
        });

        it('completes silently on readyState without error handling', async () => {
            comp.init();
            readyState.complete();
            await flush();
            expect(posted('config')).toHaveLength(1);
        });
    });

    describe('properties', () => {
        it('sets properties on the prefab widget', () => {
            comp.setProperty({ name: 'title', value: 'T' });
            expect(comp.prefabInstance.widget.title).toBe('T');
        });

        it.each([
            ['out-bound', true],
            ['in-out-bound', true],
            ['in-bound', false],
            [undefined, false]
        ])('isOutBoundProp(%s) is %s', (bindable, expected) => {
            expect(comp.isOutBoundProp({ bindable })).toBe(expected);
        });

        it('posts only outbound properties', () => {
            comp.config = { properties: { a: { bindable: 'out-bound' }, b: { bindable: 'in-bound' }, c: { bindable: 'in-out-bound' } } };
            comp.prefabInstance.widget = { a: 1, b: 2, c: 3 };
            comp.getOutboundProps();
            expect(posted('outbound-properties')[0].payload).toEqual({ a: 1, c: 3 });
        });

        it('handles configs without properties', () => {
            comp.config = {};
            comp.getOutboundProps();
            expect(posted('outbound-properties')[0].payload).toEqual({});
        });
    });

    describe('invokeScript', () => {
        it('evaluates the script against the prefab and posts the result', () => {
            comp.prefabInstance.method = () => 'out';
            comp.invokeScript({ script: 'Prefab.method()', methodName: 'method' });
            expect(posted('method-output')[0].payload).toEqual({ methodName: 'method', output: 'out' });
        });
    });

    describe('lifecycle', () => {
        it('announces itself after view init', () => {
            comp.ngAfterViewInit();
            expect(posted('init')).toHaveLength(1);
            expect(typeof comp.prefabInstance.invokeEventCallback).toBe('function');
        });

        it('cleans up listeners, subscriptions and references', () => {
            comp.init();
            const remove = jest.spyOn(window, 'removeEventListener');
            comp.ngOnDestroy();
            expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
            expect(comp.prefabInstance).toBeNull();
            expect(comp.config).toBeNull();
            expect(readyState.observed).toBe(false);
            expect(() => comp.ngOnDestroy()).not.toThrow();
            remove.mockRestore();
        });
    });
});
