import { ScriptLoaderService, ScriptStore } from './script-loader.service';

jest.mock('../utils/utils', () => ({
    _WM_APP_PROJECT: { cdnUrl: '', ngDest: 'ng-bundle/' }
}));

describe('ScriptLoaderService: coverage gaps', () => {
    let el: any;

    const mockElement = (extra: any = {}) => {
        el = { type: '', async: true, src: '', ...extra };
        jest.spyOn(document, 'createElement').mockReturnValue(el);
        jest.spyOn(document, 'getElementsByTagName').mockReturnValue([{ appendChild: jest.fn() }] as any);
    };

    afterEach(() => {
        ScriptStore.length = 0;
        jest.restoreAllMocks();
    });

    it('registers scripts from the ScriptStore on construction and loads them', async () => {
        ScriptStore.push({ name: 'lib', src: 'http://host/lib.js' });
        const svc: any = new ScriptLoaderService({} as any);
        expect(svc.scripts.lib).toEqual({ loaded: false, src: 'http://host/lib.js' });
        mockElement();
        const p = svc.loadScript('lib');
        expect(el.src).toBe('http://host/lib.js');
        el.onload();
        await expect(p).resolves.toEqual({ script: 'lib', loaded: true });
        expect(svc.scripts.lib.loaded).toBe(true);
    });

    it('resolves immediately for an already loaded script', async () => {
        const svc: any = new ScriptLoaderService({} as any);
        svc.scripts.done = { loaded: true, src: 'done.js' };
        const create = jest.spyOn(document, 'createElement');
        await expect(svc.loadScript('done')).resolves.toEqual({ script: 'done', loaded: true });
        expect(create).not.toHaveBeenCalled();
    });

    it('falls back to ngDest when cdnUrl is empty', () => {
        const svc: any = new ScriptLoaderService({} as any);
        mockElement();
        svc.loadScript('app.js');
        expect(el.src).toBe('ng-bundle/app.js');
        expect(el.async).toBe(false);
    });

    it('waits for the loaded/complete readyState on legacy browsers', async () => {
        const svc: any = new ScriptLoaderService({} as any);
        mockElement({ readyState: 'loading' });
        const p = svc.loadScript('legacy.js');
        el.onreadystatechange();
        expect(svc.scripts['legacy.js'].loaded).toBe(false);
        el.readyState = 'complete';
        el.onreadystatechange();
        await expect(p).resolves.toEqual({ script: 'legacy.js', loaded: true });
        expect(el.onreadystatechange).toBeNull();
    });
});
