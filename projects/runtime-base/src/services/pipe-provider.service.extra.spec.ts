import { PipeProvider } from './pipe-provider.service';

describe('PipeProvider extra', () => {
    let provider: PipeProvider;

    beforeEach(() => {
        provider = new PipeProvider({} as any, { get: jest.fn() } as any, {} as any, { getwidgetLocale: jest.fn().mockReturnValue({}) } as any);
    });

    it('throws when the pipe meta has no type reference', () => {
        (provider as any)._pipeMeta.set('broken', { name: 'broken', pure: true, type: { reference: undefined, diDeps: [] } });
        expect(() => provider.getInstance('broken')).toThrow("The pipe 'broken' could not be found");
    });

    it('instantiates a pipe passing its deps as constructor args', () => {
        const ctor = jest.fn();
        (provider as any)._pipeMeta.set('withDeps', { name: 'withDeps', pure: true, type: { reference: ctor, diDeps: ['en', 'dep2'] } });
        const inst = provider.getInstance('withDeps');
        expect(ctor).toHaveBeenCalledWith('en', 'dep2');
        expect(inst).toBeInstanceOf(ctor);
    });

    it('instantiates a pipe without deps', () => {
        const ctor = jest.fn();
        (provider as any)._pipeMeta.set('noDeps', { name: 'noDeps', pure: false, type: { reference: ctor, diDeps: [] } });
        expect(provider.getInstance('noDeps')).toBeInstanceOf(ctor);
        expect(ctor).toHaveBeenCalledWith();
    });

    it('throws for unknown pipe in meta()', () => {
        expect(() => provider.meta('nope')).toThrow("The pipe 'nope' could not be found");
    });
});
