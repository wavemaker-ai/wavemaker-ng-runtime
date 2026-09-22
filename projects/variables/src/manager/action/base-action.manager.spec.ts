import { setDependency } from '../../util/variable/variables.utils';
import { BaseActionManager } from './base-action.manager';

describe('BaseActionManager', () => {
    const manager: any = new (BaseActionManager as any)();

    describe('initBinding', () => {
        it('should move the dataBinding array aside and reset the binding property to an empty object', () => {
            const variable: any = { dataBinding: undefined, _context: {} };
            manager.initBinding(variable);
            expect(variable.dataBinding).toEqual({});
            expect(variable._bindDataBinding).toBeUndefined();
        });

        it('should use the given bind source/target property names', () => {
            const variable: any = { dataSet: undefined, _context: {} };
            manager.initBinding(variable, 'dataSet', 'dataSet');
            expect(variable.dataSet).toEqual({});
        });
    });

    describe('notifyInflight', () => {
        it('should notify the app manager with the variable inflight state', () => {
            const notify = jest.fn();
            setDependency('appManager', { notify });
            const variable: any = { name: 'v1' };
            manager.notifyInflight(variable, true, { rows: [] });
            expect(notify).toHaveBeenCalledWith('toggle-variable-state', {
                variable,
                active: true,
                data: { rows: [] },
            });
        });
    });
});
