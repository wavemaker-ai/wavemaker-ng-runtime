import * as core from '@wm/core';
import { BaseAction } from '@wavemaker-ai/variables';
import { VariableFactory } from '../factory/variable.factory';
import { VariablesService } from './variables.service';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => 'watch-handle'),
    $invokeWatchers: jest.fn(),
    $parseEvent: jest.fn((expr: string) => `parsed(${expr})`),
    processFilterExpBindNode: jest.fn(),
}));

jest.mock('../factory/variable.factory', () => ({
    VariableFactory: { create: jest.fn() },
}));

const watchMock = core.$watch as unknown as jest.Mock;
const createMock = VariableFactory.create as unknown as jest.Mock;

const createService = () => new VariablesService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

const fakeVariable = (overrides: any = {}) => ({
    init: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    invokeOnParamChange: jest.fn(),
    name: 'v',
    category: 'wm.ServiceVariable',
    ...overrides,
});

describe('VariablesService - bindings', () => {
    beforeEach(() => {
        watchMock.mockClear();
    });

    describe('processBindExp', () => {
        it('watches a bind: expression and registers the watcher for destruction', () => {
            const service = createService();
            const scope = { registerDestroyListener: jest.fn().mockReturnValue('registered') };
            const variable = fakeVariable();
            const d = { target: 'name', value: 'bind:Widgets.w1.datavalue' };

            const result = service.processBindExp(d, scope, variable);

            expect(watchMock.mock.calls[0][0]).toBe('Widgets.w1.datavalue');
            expect(watchMock.mock.calls[0][1]).toBe(scope);
            expect(watchMock.mock.calls[0][6]).toBe(d);
            expect(scope.registerDestroyListener).toHaveBeenCalledWith('watch-handle');
            expect(result).toEqual({ name: 'name', value: 'registered' });
        });

        it('returns the watch handle itself when the scope cannot register destroy listeners', () => {
            const result = createService().processBindExp({ target: 'a', value: 'bind:x' }, {}, fakeVariable());
            expect(result).toEqual({ name: 'a', value: 'watch-handle' });
        });

        it('reports the muted state of the variable to the watcher', () => {
            const variable = fakeVariable({ isMuted: true });
            createService().processBindExp({ target: 'a', value: 'bind:x' }, {}, variable);
            expect(watchMock.mock.calls[0][7]()).toBe(true);
        });

        it('forwards parameter changes to the variable', () => {
            const variable = fakeVariable();
            const d = { target: 'a', value: 'bind:x' };
            createService().processBindExp(d, {}, variable);
            watchMock.mock.calls[0][3]('new', 'old');
            expect(variable.invokeOnParamChange).toHaveBeenCalledWith(d, 'new', 'old');
        });

        it('uses the first item of an array value', () => {
            createService().processBindExp({ target: 'a', value: ['bind:first', 'bind:second'] }, {}, fakeVariable());
            expect(watchMock.mock.calls[0][0]).toBe('first');
        });

        it('assigns static values to the target', () => {
            const variable: any = { name: 'v', category: 'wm.ServiceVariable', dataBinding: {} };
            const result = createService().processBindExp({ target: 'name', value: 'static' }, {}, variable);
            expect(variable.dataBinding.name).toBe('static');
            expect(result).toEqual({ name: 'name', value: 'static' });
        });

        it('returns an undefined value for an empty binding', () => {
            const result = createService().processBindExp({ target: 'a', value: '' }, {}, fakeVariable());
            expect(result).toEqual({ name: 'a', value: '' });
            expect(watchMock).not.toHaveBeenCalled();
        });
    });

    describe('processSpinnerMessageBinding', () => {
        it('ignores messages that are not bound', () => {
            const variable = fakeVariable({ spinnerMessage: 'Loading' });
            createService().processSpinnerMessageBinding(variable, {});
            expect(variable.spinnerMessage).toBe('Loading');
            expect(watchMock).not.toHaveBeenCalled();
        });

        it('ignores variables without a spinner message', () => {
            createService().processSpinnerMessageBinding(fakeVariable(), {});
            expect(watchMock).not.toHaveBeenCalled();
        });

        it('watches the bound expression and keeps the message in sync', () => {
            const variable = fakeVariable({ spinnerMessage: 'bind:Variables.msg.dataSet' });
            const scope = { registerDestroyListener: jest.fn() };
            createService().processSpinnerMessageBinding(variable, scope);

            expect(watchMock.mock.calls[0][0]).toBe('Variables.msg.dataSet');
            expect(variable.spinnerMessage).toBe('');
            watchMock.mock.calls[0][3]('Please wait');
            expect(variable.spinnerMessage).toBe('Please wait');
            watchMock.mock.calls[0][3](undefined);
            expect(variable.spinnerMessage).toBe('');
            expect(scope.registerDestroyListener).toHaveBeenCalledWith('watch-handle');
        });

        it('works without a destroy listener on the scope', () => {
            const variable = fakeVariable({ spinnerMessage: 'bind:x' });
            expect(() => createService().processSpinnerMessageBinding(variable, {})).not.toThrow();
        });
    });

    describe('processBinding', () => {
        it('stashes the bindings and resets the source object', () => {
            const variable: any = fakeVariable({ dataBinding: [{ target: 'a', value: 'bind:x' }] });
            const bindings = variable.dataBinding;
            createService().processBinding(variable, {});
            expect(variable.dataBinding).toEqual({});
            expect(variable._binddataBinding).toBe(bindings);
            expect(watchMock).toHaveBeenCalledTimes(1);
        });

        it('returns early when the bindings are not an array', () => {
            const variable: any = fakeVariable({ dataBinding: { a: 1 } });
            createService().processBinding(variable, {});
            expect(variable._binddataBinding).toEqual({ a: 1 });
            expect(watchMock).not.toHaveBeenCalled();
        });

        it('tags duplicate service bindings as multi value params', () => {
            const variable: any = fakeVariable({ dataBinding: [{ target: 'q', value: 'bind:a' }, { target: 'q', value: 'bind:b' }] });
            createService().processBinding(variable, {});
            expect(variable._binddataBinding.map((n: any) => n.collectionFormat)).toEqual(['multi', 'multi']);
        });

        it('re-targets dataBinding to dataSet for static variables', () => {
            const variable: any = fakeVariable({ category: 'wm.Variable', dataBinding: [{ target: 'dataBinding', value: 'bind:x' }] });
            createService().processBinding(variable, {});
            expect(variable._binddataBinding[0].target).toBe('dataSet');
        });

        it('reads bindings from a custom source', () => {
            const variable: any = fakeVariable({ dataSet: [{ target: 'a', value: 'bind:x' }] });
            createService().processBinding(variable, {}, 'dataSet');
            expect(variable._binddataSet).toHaveLength(1);
        });
    });
});

describe('VariablesService.register', () => {
    class TestAction extends BaseAction {}

    beforeEach(() => {
        watchMock.mockClear();
        createMock.mockReset();
        (core.$invokeWatchers as jest.Mock).mockClear();
        (core.processFilterExpBindNode as jest.Mock).mockClear();
    });

    const register = (json: any, scope: any = {}) => createService().register('page', json, scope);

    it('creates instances through the factory and groups them into Variables and Actions', () => {
        const variable = fakeVariable({ category: 'wm.ServiceVariable' });
        const action: any = Object.assign(new TestAction(), { init: jest.fn(), subscribe: jest.fn(), category: 'wm.NavigationAction' });
        createMock.mockReturnValueOnce(variable).mockReturnValueOnce(action);

        const result = register({
            svc: { category: 'wm.ServiceVariable' },
            nav: { category: 'wm.NavigationAction' },
        });

        expect(result.Variables).toEqual({ svc: variable });
        expect(result.Actions).toEqual({ nav: action });
        expect(variable.init).toHaveBeenCalled();
        expect(action.init).toHaveBeenCalled();
        expect(typeof result.callback).toBe('function');
    });

    it('wires up the http service, formatter, file download and invoke watchers for service variables', () => {
        const variable: any = fakeVariable({ category: 'wm.ServiceVariable' });
        createMock.mockReturnValue(variable);

        register({ svc: { category: 'wm.ServiceVariable' } });

        expect(variable.httpService).toBeDefined();
        expect(variable.dateFormatter.format).toBeInstanceOf(Function);
        expect(typeof variable.simulateFileDownload).toBe('function');
        expect(variable.subscribe).toHaveBeenCalledWith('afterInvoke', expect.any(Function));
        variable.subscribe.mock.calls[0][1]();
        expect(core.$invokeWatchers).toHaveBeenCalledWith(true);
        expect(variable._eventSubscriptions).toHaveLength(1);
    });

    it('keeps the subscription list that already exists on the variable', () => {
        const existing = jest.fn();
        const variable: any = fakeVariable({ category: 'wm.CrudVariable', _eventSubscriptions: [existing] });
        createMock.mockReturnValue(variable);
        register({ crud: { category: 'wm.CrudVariable' } });
        expect(variable._eventSubscriptions).toHaveLength(2);
        expect(typeof variable.simulateFileDownload).toBe('function');
    });

    it('processes the filter expressions of live read variables only', () => {
        const read: any = fakeVariable({ category: 'wm.LiveVariable', operation: 'read', filterExpressions: { rules: [] }, _context: 'ctx' });
        const write: any = fakeVariable({ category: 'wm.LiveVariable', operation: 'insert' });
        createMock.mockReturnValueOnce(read).mockReturnValueOnce(write);

        register({ r: { category: 'wm.LiveVariable' }, w: { category: 'wm.LiveVariable' } });

        expect(core.processFilterExpBindNode).toHaveBeenCalledTimes(1);
        expect(core.processFilterExpBindNode).toHaveBeenCalledWith('ctx', { rules: [] }, read);
        expect(read.simulateFileDownload).toBeUndefined();
    });

    it('parses the event expressions of variables and timer actions', () => {
        const variable: any = fakeVariable({ category: 'wm.ServiceVariable', onSuccess: 'doIt()', onError: 'fail()' });
        const timer: any = Object.assign(new TestAction(), { init: jest.fn(), subscribe: jest.fn(), category: 'wm.TimerAction', onFire: 'tick()' });
        createMock.mockReturnValueOnce(variable).mockReturnValueOnce(timer);

        register({ svc: { category: 'wm.ServiceVariable' }, timer: { category: 'wm.TimerAction' } });

        expect(variable.onSuccess).toBe('parsed(doIt())');
        expect(variable.onError).toBe('parsed(fail())');
        expect(timer.onFire).toBe('tick()');
    });

    it('does not parse events or bind other actions', () => {
        const action: any = Object.assign(new TestAction(), { init: jest.fn(), subscribe: jest.fn(), category: 'wm.NavigationAction', onSuccess: 'x()' });
        createMock.mockReturnValue(action);
        register({ nav: { category: 'wm.NavigationAction' } });
        expect(action.onSuccess).toBe('x()');
        expect(action.httpService).toBeUndefined();
    });

    it('cancels every variable and action when the scope is destroyed', () => {
        const variable: any = fakeVariable({ cancel: jest.fn() });
        const action: any = Object.assign(new TestAction(), { init: jest.fn(), subscribe: jest.fn(), category: 'wm.NavigationAction', cancel: jest.fn() });
        createMock.mockReturnValueOnce(variable).mockReturnValueOnce(action);
        const scope = { registerDestroyListener: jest.fn() };

        register({ svc: { category: 'wm.ServiceVariable' }, nav: { category: 'wm.NavigationAction' } }, scope);
        scope.registerDestroyListener.mock.calls[scope.registerDestroyListener.mock.calls.length - 1][0]();

        expect(variable.cancel).toHaveBeenCalled();
        expect(action.cancel).toHaveBeenCalled();
    });

    it('runs the start update callback over a collection', async () => {
        const result = register({});
        const invoke = jest.fn().mockResolvedValue('done');
        await expect(result.callback({ a: { startUpdate: true, invoke } })).resolves.toEqual(['done']);
    });
});
