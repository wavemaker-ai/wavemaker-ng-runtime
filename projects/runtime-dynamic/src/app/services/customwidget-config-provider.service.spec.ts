jest.mock('@wm/runtime/base', () => ({ CustomwidgetConfigProvider: class CustomwidgetConfigProvider {} }));

import { CustomwidgetConfigProviderService } from './customwidget-config-provider.service';

describe('CustomwidgetConfigProviderService', () => {
    afterEach(() => {
        delete (window as any).resourceCache;
    });

    it('reads the widget config from the resource cache', async () => {
        (window as any).resourceCache = new Map([
            ['./custom-widgets/w1/page.min.json', Promise.resolve({ config: { c: 1 } })]
        ]);
        await expect(new CustomwidgetConfigProviderService().getConfig('w1')).resolves.toEqual({ c: 1 });
    });

    it('also accepts non-promise cache entries', async () => {
        (window as any).resourceCache = new Map([['./custom-widgets/w2/page.min.json', { config: 'plain' }]]);
        await expect(new CustomwidgetConfigProviderService().getConfig('w2')).resolves.toBe('plain');
    });
});
