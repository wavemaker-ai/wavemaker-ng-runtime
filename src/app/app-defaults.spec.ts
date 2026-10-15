import { routes } from './app.routes';
import { initScript } from './app.component.script';
import { variables } from './app.component.variables';
import initWmProjectProperties from './wm-project-properties';
import { WMAppProperties } from './wmProperties';
import { LazyLoadScriptsResolve } from './lazy-load-scripts.resolve';
import { environment as devEnvironment } from '../environments/environment.dev';
import { environment as prodEnvironment } from '../environments/environment.prod';
import { environment } from '../environments/environment';

describe('generated app placeholders', () => {
    it('start out empty until code generation fills them in', () => {
        expect(routes).toEqual([]);
        expect(variables).toEqual({});
        expect(initScript(null, null, null)).toBeUndefined();
        expect(initWmProjectProperties()).toBeUndefined();
    });

    it('exposes sensible default app properties', () => {
        expect(WMAppProperties).toEqual(expect.objectContaining({
            name: 'wavemaker-ng-runtime',
            type: 'APPLICATION',
            platformType: 'WEB',
            languageBundleSources: 'STATIC',
            preferredLanguage: 'en'
        }));
        expect(WMAppProperties.supportedLanguages).toEqual({ en: { moment: 'en' } });
    });

    it('LazyLoadScriptsResolve resolves without doing anything', async () => {
        await expect(new LazyLoadScriptsResolve({} as any).resolve()).resolves.toBeUndefined();
    });

    it('defines environments for development and production', () => {
        expect(environment.production).toBe(false);
        expect(devEnvironment.production).toBe(false);
        expect(prodEnvironment.production).toBe(true);
    });
});
