const mockSetPipeProvider = jest.fn();

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    setPipeProvider: (...a) => mockSetPipeProvider(...a)
}));
jest.mock('./pipe-provider.service', () => ({ PipeProvider: class PipeProvider {} }));

import { PipeService } from './pipe.service';

describe('PipeService', () => {
    let provider: any;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = { getInstance: jest.fn(name => ({ pipe: name })) };
    });

    it('registers the pipe provider globally', () => {
        new PipeService(provider, { isApplicationType: false } as any);
        expect(mockSetPipeProvider).toHaveBeenCalledWith(provider);
    });

    it('returns instances of the supported pipes', () => {
        const service = new PipeService(provider, { isApplicationType: false } as any);
        ['toDate', 'toCurrency', 'prefix', 'suffix', 'numberToString', 'stringToNumber', 'timeFromNow', 'trustAs', 'sanitize']
            .forEach(n => expect(service.getPipe(n)).toEqual({ pipe: n }));
    });

    it('supports the custom pipe only for application projects', () => {
        const app = new PipeService(provider, { isApplicationType: true } as any);
        expect(app.getPipe('custom')).toEqual({ pipe: 'custom' });
        const other = new PipeService(provider, { isApplicationType: false } as any);
        expect(() => other.getPipe('custom')).toThrow("The pipe 'custom' could not be found");
    });

    it('throws for unknown pipes', () => {
        const service = new PipeService(provider, { isApplicationType: true } as any);
        expect(() => service.getPipe('nope')).toThrow("The pipe 'nope' could not be found");
    });
});
