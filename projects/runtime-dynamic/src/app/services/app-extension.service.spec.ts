const mockAppend = jest.fn();

jest.mock('@wm/runtime/base', () => ({ AppExtensionProvider: class AppExtensionProvider {} }));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    appendScriptToHead: (...a) => mockAppend(...a)
}));

import { AppExtensionProviderService } from './app-extension.service';

describe('AppExtensionProviderService', () => {
    let service: AppExtensionProviderService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AppExtensionProviderService();
    });

    it('appends the formatter script and passes the callback through', () => {
        const cb = jest.fn();
        service.loadFormatterConfigScript(cb);
        expect(mockAppend).toHaveBeenCalledWith(cb);
    });

    it('warns instead of throwing when appending fails', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockAppend.mockImplementationOnce(() => { throw new Error('x'); });
        expect(() => service.loadFormatterConfigScript(jest.fn())).not.toThrow();
        expect(warn).toHaveBeenCalledWith('Error while loading the formatters.js file');
        warn.mockRestore();
    });
});
