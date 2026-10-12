import { of } from 'rxjs';

jest.mock('@wm/runtime/base', () => ({ AppJSProvider: class AppJSProvider {} }));

import { AppJSProviderService } from './app-js-provider.service';

describe('AppJSProviderService', () => {
    it('downloads app.js and wraps it in a function taking App, Utils and Injector', async () => {
        const http: any = { get: jest.fn(() => of('App.result = Utils + Injector;')) };
        const fn: any = await new AppJSProviderService(http).getAppScriptFn();
        expect(http.get).toHaveBeenCalledWith('./app.js', { responseType: 'text' });
        const app: any = {};
        fn(app, 'u', 'i');
        expect(app.result).toBe('ui');
    });
});
