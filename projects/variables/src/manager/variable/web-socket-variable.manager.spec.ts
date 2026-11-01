import { setDependency } from '../../util/variable/variables.utils';
import { WebSocketVariableManager } from './web-socket-variable.manager';

describe('WebSocketVariableManager', () => {
    let manager: any;

    beforeEach(() => {
        manager = new WebSocketVariableManager();
        setDependency('appManager', { notify: jest.fn() });
    });

    describe('shouldAppendData / shouldAppendLast / getDataLimit (private)', () => {
        it('should return true when dataUpdateStrategy is not refresh', () => {
            expect(manager.shouldAppendData({ dataUpdateStrategy: 'append' })).toBe(true);
            expect(manager.shouldAppendData({ dataUpdateStrategy: 'refresh' })).toBe(false);
        });

        it('should return true for shouldAppendLast only when strategy is append', () => {
            expect(manager.shouldAppendLast({ dataUpdateStrategy: 'append' })).toBe(true);
            expect(manager.shouldAppendLast({ dataUpdateStrategy: 'prepend' })).toBe(false);
        });

        it('should return the dataLimit from the variable', () => {
            expect(manager.getDataLimit({ dataLimit: 5 })).toBe(5);
        });
    });

    describe('_onSocketMessage (private)', () => {
        it('should replace dataSet when appendData is false (refresh strategy)', () => {
            const variable: any = { dataUpdateStrategy: 'refresh', dataSet: ['old'], _context: {} };
            manager._onSocketMessage(variable, { data: JSON.stringify({ a: 1 }) });
            expect(variable.dataSet).toEqual({ a: 1 });
        });

        it('should append the new message at the end for the append strategy', () => {
            // evt.data must be valid JSON - getValidJSON() must succeed so the fallback
            // xmlToJson() (which chokes on a bare non-XML string) is never reached.
            const variable: any = { dataUpdateStrategy: 'append', dataSet: ['a'], _context: {} };
            manager._onSocketMessage(variable, { data: JSON.stringify('b') });
            expect(variable.dataSet).toEqual(['a', 'b']);
        });

        it('should prepend the new message at the start for the prepend strategy', () => {
            const variable: any = { dataUpdateStrategy: 'prepend', dataSet: ['a'], _context: {} };
            manager._onSocketMessage(variable, { data: JSON.stringify('b') });
            expect(variable.dataSet).toEqual(['b', 'a']);
        });

        it('should drop the oldest item once dataLimit is reached (append strategy)', () => {
            const variable: any = { dataUpdateStrategy: 'append', dataLimit: 2, dataSet: ['a', 'b'], _context: {} };
            manager._onSocketMessage(variable, { data: JSON.stringify('c') });
            expect(variable.dataSet).toEqual(['b', 'c']);
        });

        it('should drop the newest item once dataLimit is reached (prepend strategy)', () => {
            const variable: any = { dataUpdateStrategy: 'prepend', dataLimit: 2, dataSet: ['a', 'b'], _context: {} };
            manager._onSocketMessage(variable, { data: JSON.stringify('c') });
            expect(variable.dataSet).toEqual(['c', 'a']);
        });
    });

    describe('event handler delegates (private)', () => {
        // Event handler fields (onOpen, onClose, ...) hold a string action expression,
        // evaluated via $parseEvent against variable._context - not a live function reference.
        it('_onBeforeSend should return the onBeforeMessageSend handler result', () => {
            const handler = jest.fn().mockReturnValue('modified');
            const variable: any = { onBeforeMessageSend: 'handler()', _context: { handler } };
            expect(manager._onBeforeSend(variable, 'msg')).toBe('modified');
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('_onBeforeSocketClose should invoke the onBeforeClose handler', () => {
            const handler = jest.fn();
            const variable: any = { onBeforeClose: 'handler()', _context: { handler } };
            manager._onBeforeSocketClose(variable, { data: 'x' });
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('_onBeforeSocketOpen should invoke the onBeforeOpen handler', () => {
            const handler = jest.fn();
            const variable: any = { onBeforeOpen: 'handler()', _context: { handler } };
            manager._onBeforeSocketOpen(variable);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('_onSocketOpen should mark the variable connected and invoke onOpen', () => {
            const handler = jest.fn();
            const variable: any = { onOpen: 'handler()', _context: { handler }, startUpdate: false };
            manager._onSocketOpen(variable, {});
            expect(variable._socketConnected).toBe(true);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('_onSocketOpen should schedule a send of the RequestBody when startUpdate is true', () => {
            jest.useFakeTimers();
            const sendSpy = jest.spyOn(manager, 'send').mockImplementation(() => {});
            const variable: any = { _context: {}, startUpdate: true, dataBinding: { RequestBody: 'hello' } };
            manager._onSocketOpen(variable, {});
            jest.runAllTimers();
            expect(sendSpy).toHaveBeenCalledWith(variable, 'hello');
            jest.useRealTimers();
        });

        it('_onSocketClose should mark disconnected, free the socket and invoke onClose', () => {
            const handler = jest.fn();
            const variable: any = { onClose: 'handler()', _context: { handler } };
            manager.scope_var_socket_map.set(variable, {});
            manager._onSocketClose(variable, {});
            expect(variable._socketConnected).toBe(false);
            expect(manager.scope_var_socket_map.has(variable)).toBe(false);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('_onSocketError should mark disconnected and invoke onError with a default message', () => {
            const handler = jest.fn();
            const variable: any = { onError: 'handler()', _context: { handler }, service: 'MySvc' };
            manager._onSocketError(variable, {});
            expect(variable._socketConnected).toBe(false);
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('freeSocket (private)', () => {
        it('should clear the socket reference and remove the map entry', () => {
            const variable: any = { _socket: {} };
            manager.scope_var_socket_map.set(variable, {});
            manager.freeSocket(variable);
            expect(variable._socket).toBeNull();
            expect(manager.scope_var_socket_map.has(variable)).toBe(false);
        });

        it('should do nothing when there is no tracked socket', () => {
            const variable: any = {};
            expect(() => manager.freeSocket(variable)).not.toThrow();
        });
    });

    describe('open', () => {
        it('should not open the socket when _onBeforeSocketOpen returns false', () => {
            const error = jest.fn();
            const variable: any = { onBeforeOpen: 'blockOpen()', _context: { blockOpen: () => false } };
            const getSocketSpy = jest.spyOn(manager, 'getSocket');
            manager.open(variable, jest.fn(), error);
            expect(error).toHaveBeenCalledTimes(1);
            expect(getSocketSpy).not.toHaveBeenCalled();
        });

        it('should return the socket and call success when allowed to open', () => {
            const success = jest.fn();
            const fakeSocket = {};
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const variable: any = { _context: {} };
            const result = manager.open(variable, success, jest.fn());
            expect(result).toBe(fakeSocket);
            expect(success).toHaveBeenCalledTimes(1);
        });
    });

    describe('close', () => {
        it('should close and free the socket when allowed', () => {
            const fakeSocket = { close: jest.fn() };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const freeSpy = jest.spyOn(manager, 'freeSocket');
            const variable: any = { _context: {} };
            manager.close(variable);
            expect(fakeSocket.close).toHaveBeenCalledTimes(1);
            expect(freeSpy).toHaveBeenCalledWith(variable);
        });

        it('should not close the socket when _onBeforeSocketClose returns false', () => {
            const fakeSocket = { close: jest.fn() };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const variable: any = { onBeforeClose: 'blockClose()', _context: { blockClose: () => false } };
            manager.close(variable);
            expect(fakeSocket.close).not.toHaveBeenCalled();
        });
    });

    describe('send', () => {
        it('should log an error and return when there is no socket', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(manager, 'getSocket').mockReturnValue(undefined);
            const variable: any = { _context: {} };
            manager.send(variable, 'hello');
            expect(errorSpy).toHaveBeenCalledWith('WebSocket connection not established');
            errorSpy.mockRestore();
        });

        it('should warn and return when there is no message to send', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(manager, 'getSocket').mockReturnValue({ send: jest.fn() });
            const variable: any = { _context: {}, dataBinding: {} };
            manager.send(variable);
            expect(warnSpy).toHaveBeenCalledWith('No message to send');
            warnSpy.mockRestore();
        });

        it('should send a plain string message as-is', () => {
            const fakeSocket = { send: jest.fn() };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const variable: any = { _context: {} };
            manager.send(variable, 'hello');
            expect(fakeSocket.send).toHaveBeenCalledWith('hello', 0);
        });

        it('should JSON.stringify an object message before sending', () => {
            const fakeSocket = { send: jest.fn() };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const variable: any = { _context: {} };
            manager.send(variable, { a: 1 } as any);
            expect(fakeSocket.send).toHaveBeenCalledWith(JSON.stringify({ a: 1 }), 0);
        });

        it('should not send when _onBeforeSend returns false', () => {
            const fakeSocket = { send: jest.fn() };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            const variable: any = { onBeforeMessageSend: 'blockSend()', _context: { blockSend: () => false } };
            manager.send(variable, 'hello');
            expect(fakeSocket.send).not.toHaveBeenCalled();
        });

        it('should catch and log a synchronous send error via _onSocketError', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const fakeSocket = { send: jest.fn().mockImplementation(() => { throw new Error('boom'); }) };
            jest.spyOn(manager, 'getSocket').mockReturnValue(fakeSocket);
            // _onSocketError's initiateCallback has no skipDefaultNotification flag, so with no
            // onError handler it falls into the default-notification lookup on _context.Actions.
            const variable: any = { _context: { Actions: {} } };
            expect(() => manager.send(variable, 'hello')).not.toThrow();
            expect(errorSpy).toHaveBeenCalledWith('Error sending message:', expect.any(Error));
            errorSpy.mockRestore();
        });
    });
});
