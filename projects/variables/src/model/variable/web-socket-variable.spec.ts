jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn() },
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { WebSocketVariable } from './web-socket-variable';

describe('WebSocketVariable', () => {
    afterEach(() => jest.clearAllMocks());

    it('should copy variable config properties onto the instance', () => {
        const variable: any = new WebSocketVariable({ name: 'wsVar', url: 'wss://x' });
        expect(variable.name).toBe('wsVar');
        expect(variable.url).toBe('wss://x');
    });

    it('open() should delegate to the websocket manager', () => {
        const manager: any = { open: jest.fn().mockReturnValue('opened') };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        const result = variable.open('success', 'error');
        expect(manager.open).toHaveBeenCalledWith(variable, 'success', 'error');
        expect(result).toBe('opened');
    });

    it('close() should delegate to the websocket manager', () => {
        const manager: any = { close: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        variable.close();
        expect(manager.close).toHaveBeenCalledWith(variable);
    });

    it('update() should delegate to the websocket manager', () => {
        const manager: any = { update: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        variable.update();
        expect(manager.update).toHaveBeenCalledWith(variable);
    });

    it('send() should delegate to the websocket manager with the message', () => {
        const manager: any = { send: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        variable.send('hello');
        expect(manager.send).toHaveBeenCalledWith(variable, 'hello');
    });

    it('cancel() should delegate to close()', () => {
        const manager: any = { close: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        const closeSpy = jest.spyOn(variable, 'close');
        variable.cancel();
        expect(closeSpy).toHaveBeenCalled();
    });

    it('invoke() should delegate to open()', () => {
        const manager: any = { open: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        const openSpy = jest.spyOn(variable, 'open');
        variable.invoke({}, 'success', 'error');
        expect(openSpy).toHaveBeenCalledWith('success', 'error');
    });

    it('init() should initialize the binding', () => {
        const manager: any = { initBinding: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const variable = new WebSocketVariable({});
        variable.init();
        expect(manager.initBinding).toHaveBeenCalledWith(variable);
    });
});
