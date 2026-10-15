import { setDependency } from '../../util/variable/variables.utils';
import { WebSocketVariableManager } from './web-socket-variable.manager';

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, xmlToJson: jest.fn((...a: any[]) => actual.xmlToJson(...a)) };
});
import * as wmCore from '@wm/core';

describe('WebSocketVariableManager: coverage gaps', () => {
    let manager: any;

    beforeEach(() => {
        manager = new WebSocketVariableManager();
        setDependency('appManager', { notify: jest.fn() });
    });

    it('shouldAppendData falls back to the manager itself when no variable is given', () => {
        // manager has no dataUpdateStrategy, which is not "refresh"
        expect(manager.shouldAppendData(undefined)).toBe(true);
    });

    it('stores non-JSON, non-XML message data as is', () => {
        (wmCore.xmlToJson as jest.Mock).mockReturnValueOnce(undefined);
        const variable: any = { dataUpdateStrategy: 'refresh', dataSet: null, _context: {} };
        manager._onSocketMessage(variable, { data: 'plain text' });
        expect(variable.dataSet).toBe('plain text');
    });

    it('converts XML message data to JSON when it is not valid JSON', () => {
        (wmCore.xmlToJson as jest.Mock).mockReturnValueOnce({ root: 1 });
        const variable: any = { dataUpdateStrategy: 'refresh', _context: {} };
        manager._onSocketMessage(variable, { data: '<root>1</root>' });
        expect(variable.dataSet).toEqual({ root: 1 });
    });

    it('does not send anything on open when there is no request body', () => {
        jest.useFakeTimers();
        const send = jest.spyOn(manager, 'send').mockImplementation(() => undefined);
        const variable: any = { startUpdate: true, dataBinding: {}, _context: {} };
        manager._onSocketOpen(variable, {});
        jest.runAllTimers();
        expect(variable._socketConnected).toBe(true);
        expect(send).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('close does nothing when no socket could be obtained', () => {
        jest.spyOn(manager, 'getSocket').mockReturnValue(undefined);
        const free = jest.spyOn(manager, 'freeSocket');
        expect(() => manager.close({ _context: {} })).not.toThrow();
        expect(free).not.toHaveBeenCalled();
    });
});
