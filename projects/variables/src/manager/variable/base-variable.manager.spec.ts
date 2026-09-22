import { setDependency } from '../../util/variable/variables.utils';
import { BaseVariableManager } from './base-variable.manager';

describe('BaseVariableManager', () => {
    const manager: any = new (BaseVariableManager as any)();

    describe('initBinding', () => {
        it('should move the dataBinding array aside and reset the binding property to an empty object', () => {
            const variable: any = { dataBinding: undefined, _context: {} };
            manager.initBinding(variable);
            expect(variable.dataBinding).toEqual({});
        });
    });

    describe('notifyInflight', () => {
        it('should notify the app manager with the inflight state, data, and options', () => {
            const notify = jest.fn();
            setDependency('appManager', { notify });
            const variable: any = { name: 'v1' };
            manager.notifyInflight(variable, true, { a: 1 }, { silent: true });
            expect(notify).toHaveBeenCalledWith('toggle-variable-state', {
                variable, active: true, data: { a: 1 }, options: { silent: true },
            });
        });
    });

    describe('setRequestTrackId', () => {
        it('should store the request track id from the response headers', () => {
            const variable: any = {};
            const response = { headers: { get: jest.fn().mockReturnValue('track-123') } };
            manager.setRequestTrackId(response, variable);
            expect(variable._requestTrackId).toBe('track-123');
        });

        it('should do nothing when the response has no track id header', () => {
            const variable: any = {};
            const response = { headers: { get: jest.fn().mockReturnValue(null) } };
            manager.setRequestTrackId(response, variable);
            expect(variable._requestTrackId).toBeUndefined();
        });

        it('should do nothing when the response has no headers', () => {
            const variable: any = {};
            expect(() => manager.setRequestTrackId(undefined, variable)).not.toThrow();
            expect(variable._requestTrackId).toBeUndefined();
        });
    });

    describe('prepareCallbackOptions', () => {
        it('should wrap the xhrObj into an options object', () => {
            const xhrObj = { status: 200 };
            expect(manager.prepareCallbackOptions(xhrObj)).toEqual({ xhrObj });
        });

        it('should merge in additional options when provided', () => {
            const xhrObj = { status: 200 };
            expect(manager.prepareCallbackOptions(xhrObj, { extra: 'x' })).toEqual({ xhrObj, extra: 'x' });
        });
    });
});
