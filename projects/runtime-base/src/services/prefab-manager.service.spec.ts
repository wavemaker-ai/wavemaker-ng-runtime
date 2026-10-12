const mockLoadScripts = jest.fn(() => Promise.resolve('scripts'));
const mockLoadStyleSheets = jest.fn();
const mockBaseUrl = jest.fn((name: string) => `base/${name}/`);
const mockInPreview = jest.fn(() => false);

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    loadScripts: (...a) => (mockLoadScripts as any)(...a),
    loadStyleSheets: (...a) => mockLoadStyleSheets(...a)
}));
jest.mock('../util/utils', () => ({
    getPrefabBaseUrl: (n) => mockBaseUrl(n),
    isPrefabInPreview: (n) => mockInPreview()
}));

import { PrefabManagerService } from './prefab-manager.service';

describe('PrefabManagerService', () => {
    let metadata: any, provider: any, service: any;
    let n = 0;
    const name = () => `pf${++n}`;

    beforeEach(() => {
        jest.clearAllMocks();
        mockInPreview.mockReturnValue(false);
        metadata = { load: jest.fn(() => Promise.resolve('meta')) };
        provider = { getConfig: jest.fn(() => Promise.resolve({ resources: { styles: [], scripts: [] } })) };
        service = new PrefabManagerService(metadata, provider);
    });

    it('getConfig delegates to the config provider', async () => {
        provider.getConfig.mockResolvedValue({ c: 1 });
        await expect(service.getConfig('x')).resolves.toEqual({ c: 1 });
        expect(provider.getConfig).toHaveBeenCalledWith('x');
    });

    describe('loadServiceDefs', () => {
        it('skips metadata for prefabs in preview', async () => {
            mockInPreview.mockReturnValue(true);
            await expect(service.loadServiceDefs('p')).resolves.toBeUndefined();
            expect(metadata.load).not.toHaveBeenCalled();
        });

        it('loads metadata otherwise', async () => {
            await expect(service.loadServiceDefs('p')).resolves.toBe('meta');
            expect(metadata.load).toHaveBeenCalledWith('p');
        });
    });

    describe('loadStyles', () => {
        it('resolves relative urls against the base, keeps absolute ones and drops the Main page css', async () => {
            await service.loadStyles('p', {
                resources: { styles: ['a.css', 'https://x/b.css', '//cdn/c.css', 'x/pages/Main/Main.css'] }
            });
            expect(mockLoadStyleSheets).toHaveBeenCalledWith(['base/p/a.css', 'https://x/b.css', '//cdn/c.css']);
        });

        it('works without a config argument', async () => {
            await expect(service.loadStyles('p')).resolves.toBeUndefined();
            expect(mockLoadStyleSheets).toHaveBeenCalledWith([]);
        });
    });

    describe('loadScripts', () => {
        it('drops npm:// scripts and resolves the rest against the base url', async () => {
            const res = await service.loadScripts('p', { resources: { scripts: ['a.js', 'npm://lib', 'http://x/b.js'] } });
            expect(mockLoadScripts).toHaveBeenCalledWith(['base/p/a.js', 'http://x/b.js'], true);
            expect(res).toBe('scripts');
        });

        it('works without a config argument', async () => {
            await service.loadScripts('p');
            expect(mockLoadScripts).toHaveBeenCalledWith([], true);
        });
    });

    describe('loadDependencies', () => {
        it('loads styles, scripts and service defs once, then short-circuits', async () => {
            const p = name();
            await service.loadDependencies(p);
            expect(provider.getConfig).toHaveBeenCalledTimes(1);
            expect(metadata.load).toHaveBeenCalledWith(p);
            await expect(service.loadDependencies(p)).resolves.toBeUndefined();
            expect(provider.getConfig).toHaveBeenCalledTimes(1);
        });

        it('shares the in-progress load between concurrent callers', async () => {
            const p = name();
            const first = service.loadDependencies(p);
            const second = service.loadDependencies(p);
            await Promise.all([first, second]);
            expect(provider.getConfig).toHaveBeenCalledTimes(1);
        });
    });

    it('ignores resolving a prefab that is not in progress', () => {
        expect(() => (service as any).resolveInProgress('never-started')).not.toThrow();
    });
});
