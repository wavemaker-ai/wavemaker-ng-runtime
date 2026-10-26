import { setDependency } from '../../util/variable/variables.utils';
import { ServiceVariableUtils } from '../../util/variable/service-variable.utils';
import { WebSocketVariableManager } from './web-socket-variable.manager';

const sockets: any[] = [];

jest.mock('angular2-websocket/angular2-websocket', () => ({
    $WebSocket: jest.fn().mockImplementation((url: string) => {
        const socket = {
            url,
            onOpen: jest.fn(),
            onError: jest.fn(),
            onMessage: jest.fn(),
            onClose: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
        };
        sockets.push(socket);
        return socket;
    }),
}));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isInsecureContentRequest: jest.fn(() => false),
}));

import { isInsecureContentRequest } from '@wm/core';

describe('WebSocketVariableManager - sockets', () => {
    let manager: any;
    let getByOperationId: jest.Mock;
    const variable = (extra: any = {}): any => ({
        service: 'chat',
        operationId: 'op1',
        dataBinding: { id: 7 },
        getPrefabName: jest.fn(() => ''),
        _context: { Actions: {} },
        ...extra,
    });

    beforeEach(() => {
        sockets.length = 0;
        manager = new WebSocketVariableManager();
        getByOperationId = jest.fn(() => ({ wmServiceOperationInfo: { parameters: [{ name: 'id' }] } }));
        setDependency('appManager', { notify: jest.fn() });
        setDependency('metadata', { getByOperationId });
        jest.spyOn(ServiceVariableUtils, 'constructRequestParams').mockReturnValue({ url: 'ws://host/chat/7' } as any);
        (isInsecureContentRequest as jest.Mock).mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getURL', () => {
        it('builds the url from the operation info with the bound input values', () => {
            const v = variable();
            expect(manager.getURL(v)).toBe('ws://host/chat/7');
            expect(getByOperationId).toHaveBeenCalledWith('op1');
            const [, opInfo, input] = (ServiceVariableUtils.constructRequestParams as jest.Mock).mock.calls[0];
            expect(opInfo.parameters[0].sampleValue).toBe(7);
            expect(opInfo.skipCloakHeaders).toBe(true);
            expect(input).toBe(v.dataBinding);
        });

        it('looks the operation up in the prefab when the variable belongs to one', () => {
            manager.getURL(variable({ getPrefabName: jest.fn(() => 'MyPrefab') }));
            expect(getByOperationId).toHaveBeenCalledWith('op1', 'MyPrefab');
        });

        it('reports request construction errors through the error event', () => {
            (ServiceVariableUtils.constructRequestParams as jest.Mock).mockReturnValue({ error: { message: 'bad params' } });
            const onError = jest.fn();
            const v = variable({ _context: { onError }, onError: 'onError($event)' });
            const spy = jest.spyOn(manager, '_onSocketError');
            expect(manager.getURL(v)).toBeUndefined();
            expect(spy).toHaveBeenCalledWith(v, { data: 'bad params' });
            expect(v._socketConnected).toBe(false);
        });
    });

    describe('getSocket', () => {
        it('creates a socket, registers its handlers and remembers it', () => {
            const v = variable();
            const socket = manager.getSocket(v);
            expect(socket.url).toBe('ws://host/chat/7');
            expect(socket.onOpen).toHaveBeenCalled();
            expect(socket.onError).toHaveBeenCalled();
            expect(socket.onMessage).toHaveBeenCalled();
            expect(socket.onClose).toHaveBeenCalled();
            expect(v._socket).toBe(socket);
            expect(manager.scope_var_socket_map.get(v)).toBe(socket);
        });

        it('reuses the socket of a variable', () => {
            const v = variable();
            expect(manager.getSocket(v)).toBe(manager.getSocket(v));
            expect(sockets).toHaveLength(1);
        });

        it('wires the handlers to the variable', () => {
            const v = variable({ dataUpdateStrategy: 'append', dataSet: [] });
            const socket = manager.getSocket(v);
            socket.onOpen.mock.calls[0][0]({ data: 'x' });
            expect(v._socketConnected).toBe(true);
            socket.onMessage.mock.calls[0][0]({ data: JSON.stringify('hello') });
            expect(v.dataSet).toEqual(['hello']);
            socket.onClose.mock.calls[0][0]({});
            expect(v._socketConnected).toBe(false);
        });

        it('refuses insecure connections', () => {
            (isInsecureContentRequest as jest.Mock).mockReturnValue(true);
            const spy = jest.spyOn(manager, '_onSocketError');
            const v = variable();
            expect(manager.getSocket(v)).toBeUndefined();
            expect(sockets).toHaveLength(0);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('open, send and close with real sockets', () => {
        it('opens a socket and calls success', () => {
            const success = jest.fn();
            const socket = manager.open(variable(), success);
            expect(socket).toBe(sockets[0]);
            expect(success).toHaveBeenCalled();
        });

        it('sends the request body of the variable', () => {
            const v = variable({ dataBinding: { id: 7, RequestBody: { hi: 1 } } });
            manager.send(v);
            expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ hi: 1 }), 0);
        });

        it('lets onBeforeMessageSend replace the message', () => {
            const v = variable({ _context: { before: () => 'replaced' }, onBeforeMessageSend: 'before()' });
            manager.send(v, 'original');
            expect(sockets[0].send).toHaveBeenCalledWith('replaced', 0);
        });

        it('closes the socket and forgets it', () => {
            const v = variable();
            manager.open(v);
            manager.close(v);
            expect(sockets[0].close).toHaveBeenCalled();
            expect(manager.scope_var_socket_map.has(v)).toBe(false);
        });

        it('sends the request body once the connection is open when starting automatically', () => {
            jest.useFakeTimers();
            const v = variable({ startUpdate: true, dataBinding: { id: 7, RequestBody: 'ping' } });
            manager.open(v);
            sockets[0].onOpen.mock.calls[0][0]({});
            jest.runAllTimers();
            expect(sockets[0].send).toHaveBeenCalledWith('ping', 0);
            jest.useRealTimers();
        });

        it('keeps the data set in place when a message handler returns a value for refresh strategy', () => {
            const v = variable({ dataUpdateStrategy: 'refresh', _context: { onMsg: () => 'handled' }, onMessageReceive: 'onMsg($event)' });
            manager._onSocketMessage(v, { data: JSON.stringify({ a: 1 }) });
            expect(v.dataSet).toBe('handled');
        });

        it('creates the data set for the first message of an appending variable', () => {
            const v = variable({ dataUpdateStrategy: 'append' });
            manager._onSocketMessage(v, { data: JSON.stringify({ n: 1 }) });
            expect(v.dataSet).toEqual([{ n: 1 }]);
        });
    });
});
