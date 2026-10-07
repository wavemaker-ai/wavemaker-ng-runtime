import { VariablesService } from './variables.service';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => 'watch-handle'),
    $invokeWatchers: jest.fn(),
}));

const createService = () => new VariablesService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

describe('VariablesService.processBindExp: static values', () => {
    it('does not track internal bound nodes when the target is the variable root', () => {
        const variable: any = { name: 'v', category: 'wm.ServiceVariable', dataBinding: {} };
        const result = createService().processBindExp({ target: 'dataBinding', value: { a: 1 } }, {}, variable);
        expect(result).toEqual({ name: 'dataBinding', value: { a: 1 } });
    });

    it('reuses the internal bound node map entry for repeated static bindings of a variable', () => {
        const service = createService();
        const variable: any = { name: 'v2', category: 'wm.ServiceVariable', dataBinding: {} };
        service.processBindExp({ target: 'first', value: 'one' }, {}, variable);
        service.processBindExp({ target: 'second', value: 'two' }, {}, variable);
        expect(variable.dataBinding.first).toBe('one');
        expect(variable.dataBinding.second).toBe('two');
    });
});
