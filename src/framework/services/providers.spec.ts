jest.mock('@wm/runtime/base', () => ({
    AppExtensionProvider: class AppExtensionProvider {},
    AppJSProvider: class AppJSProvider {},
    AppVariablesProvider: class AppVariablesProvider {},
    PrefabConfigProvider: class PrefabConfigProvider {},
    CustomwidgetConfigProvider: class CustomwidgetConfigProvider {}
}));

import { registerCustomWidgetConfig, registerPrefabConfig } from '../util/page-util';
import { AppExtensionProviderService } from './app-extension.service';
import { AppJSProviderService } from './app-js-provider.service';
import { AppVariablesProviderService } from './app-variables-provider.service';
import { CustomwidgetConfigProviderService } from './customwidget-config-provider.service';
import { PrefabConfigProviderService } from './prefab-config-provider.service';
import { initScript } from '../../app/app.component.script';
import { variables } from '../../app/app.component.variables';

describe('framework providers', () => {
    describe('AppExtensionProviderService', () => {
        afterEach(() => {
            delete (global as any).WM_CUSTOM_FORMATTERS;
            jest.restoreAllMocks();
        });

        it('passes the generated custom formatters to the callback', () => {
            (global as any).WM_CUSTOM_FORMATTERS = { f: 1 };
            const cb = jest.fn();
            new AppExtensionProviderService().loadFormatterConfigScript(cb);
            expect(cb).toHaveBeenCalledWith({ f: 1 });
        });

        it('warns when the formatters are not available', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const cb = jest.fn();
            new AppExtensionProviderService().loadFormatterConfigScript(cb);
            expect(cb).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledWith('Error while loading the formatters.js file');
        });
    });

    it('AppJSProviderService returns the generated app script function', async () => {
        await expect(new AppJSProviderService().getAppScriptFn()).resolves.toBe(initScript);
        expect(initScript({}, {}, {})).toBeUndefined();
    });

    it('AppVariablesProviderService returns the generated app variables', async () => {
        await expect(new AppVariablesProviderService().getAppVariables()).resolves.toBe(variables);
    });

    it('PrefabConfigProviderService resolves registered prefab configs', async () => {
        registerPrefabConfig('providerPf', { c: 1 });
        const service = new PrefabConfigProviderService();
        await expect(service.getConfig('providerPf')).resolves.toEqual({ c: 1 });
        await expect(service.getConfig('missing')).resolves.toBeUndefined();
    });

    it('CustomwidgetConfigProviderService resolves registered widget configs', async () => {
        registerCustomWidgetConfig('providerW', { d: 1 });
        const service = new CustomwidgetConfigProviderService();
        await expect(service.getConfig('providerW')).resolves.toEqual({ d: 1 });
        await expect(service.getConfig('missing')).resolves.toBeUndefined();
    });
});
