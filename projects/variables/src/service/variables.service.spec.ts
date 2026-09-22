import { setDependency } from '../util/variable/variables.utils';
import { Formatter, VariablesService } from './variables.service';

describe('VariablesService', () => {
    const mockDeps = () => ({
        httpService: {} as any,
        metadataService: {} as any,
        navigationService: {} as any,
        routerService: {} as any,
        toasterService: {} as any,
        oAuthService: {} as any,
        securityService: {} as any,
        dialogService: {} as any,
    });

    const createService = () => {
        const deps = mockDeps();
        return new VariablesService(
            deps.httpService, deps.metadataService, deps.navigationService, deps.routerService,
            deps.toasterService, deps.oAuthService, deps.securityService, deps.dialogService
        );
    };

    it('should construct without throwing and wire up dependencies', () => {
        expect(() => createService()).not.toThrow();
    });

    describe('bulkCancel', () => {
        it('should call cancel() on every entry that has a cancel function', () => {
            const service = createService();
            const collection = {
                a: { cancel: jest.fn() },
                b: { cancel: jest.fn() },
                c: { notCancel: true },
            };
            service.bulkCancel(collection);
            expect(collection.a.cancel).toHaveBeenCalled();
            expect(collection.b.cancel).toHaveBeenCalled();
        });
    });

    describe('triggerStartUpdate', () => {
        it('should invoke() only variables with startUpdate true and an invoke function', async () => {
            const service = createService();
            const collection = {
                a: { startUpdate: true, invoke: jest.fn().mockResolvedValue('a-done') },
                b: { startUpdate: false, invoke: jest.fn() },
                c: { startUpdate: true },
            };
            const result = await service.triggerStartUpdate(collection);
            expect(collection.a.invoke).toHaveBeenCalled();
            expect(collection.b.invoke).not.toHaveBeenCalled();
            expect(result).toEqual(['a-done']);
        });
    });

    describe('isVariableSeperated', () => {
        it('should return true for Variable/ServiceVariable/LiveVariable/CrudVariable categories', () => {
            const service = createService();
            const json = {
                v1: { category: 'wm.Variable' },
                v2: { category: 'wm.ServiceVariable' },
                v3: { category: 'wm.LiveVariable' },
                v4: { category: 'wm.CrudVariable' },
                v5: { category: 'wm.NavigationAction' },
            };
            expect(service.isVariableSeperated(json, 'v1')).toBe(true);
            expect(service.isVariableSeperated(json, 'v2')).toBe(true);
            expect(service.isVariableSeperated(json, 'v3')).toBe(true);
            expect(service.isVariableSeperated(json, 'v4')).toBe(true);
            expect(service.isVariableSeperated(json, 'v5')).toBe(false);
        });
    });

    describe('getBindSourceTarget', () => {
        it('should return filterFields for a LiveVariable read operation', () => {
            const service = createService();
            expect(service.getBindSourceTarget({ category: 'wm.LiveVariable', operation: 'read' })).toBe('filterFields');
        });

        it('should return inputFields for a LiveVariable non-read operation', () => {
            const service = createService();
            expect(service.getBindSourceTarget({ category: 'wm.LiveVariable', operation: 'insert' })).toBe('inputFields');
        });

        it('should return dataSet for a ModelVariable', () => {
            const service = createService();
            expect(service.getBindSourceTarget({ category: 'wm.ModelVariable' })).toBe('dataSet');
        });

        it('should default to dataBinding for any other category', () => {
            const service = createService();
            expect(service.getBindSourceTarget({ category: 'wm.ServiceVariable' })).toBe('dataBinding');
        });
    });

    describe('destroy', () => {
        it('should not throw', () => {
            const service = createService();
            expect(() => service.destroy()).not.toThrow();
        });
    });

    describe('registerDependency', () => {
        it('should register the dependency on both dependency stores without throwing', () => {
            const service = createService();
            expect(() => service.registerDependency('appManager', { some: 'ref' })).not.toThrow();
        });
    });

    describe('Formatter', () => {
        it('should delegate to appManager\'s date pipe transform', () => {
            const transform = jest.fn().mockReturnValue('2024-01-01');
            setDependency('appManager', { getPipe: jest.fn().mockReturnValue({ transform }) });
            const formatter = new Formatter();
            expect(formatter.format('2024-01-01T00:00:00Z', 'yyyy-MM-dd')).toBe('2024-01-01');
            expect(transform).toHaveBeenCalledWith('2024-01-01T00:00:00Z', 'yyyy-MM-dd');
        });
    });
});
