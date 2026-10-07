import { Subject } from 'rxjs';
import { PartialContainerDirective } from './partial-container.directive';
import { $appDigest, $invokeWatchers } from '@wm/core';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $appDigest: jest.fn(),
    $invokeWatchers: jest.fn(),
}));

describe('PartialContainerDirective - rendering and lifecycle', () => {
    let host: HTMLElement;
    let params$: Subject<any>;
    let comp: any;
    let propListener: (k: string, nv: any, ov?: any) => void;
    let vcRef: any;
    let app: any;
    let provider: any;
    let partialEl: HTMLElement;
    let directive: any;
    let errorSpy: jest.SpyInstance;

    const build = () => new PartialContainerDirective(comp, vcRef, { nativeElement: host } as any, {} as any, {} as any, app, 'c', provider);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        host = document.createElement('div');
        document.body.appendChild(host);
        params$ = new Subject();
        comp = {
            name: 'partial1',
            content: 'p1',
            params$,
            registerPropertyChangeListener: jest.fn((fn: any) => (propListener = fn)),
            registerDestroyListener: jest.fn(),
            invokeEventCallback: jest.fn(),
        };
        partialEl = document.createElement('section');
        vcRef = { clear: jest.fn(), createComponent: jest.fn(() => ({ instance: {}, location: { nativeElement: partialEl } })) };
        app = { notify: jest.fn() };
        provider = { getComponentFactoryRef: jest.fn().mockResolvedValue(class Foo {}) };
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        directive = build();
    });

    afterEach(() => {
        jest.useRealTimers();
        host.remove();
        errorSpy.mockRestore();
    });

    it('exposes the component name', () => {
        expect(directive.name).toBe('partial1');
    });

    it('does nothing without a partial name', async () => {
        await directive._renderPartial('');
        expect(provider.getComponentFactoryRef).not.toHaveBeenCalled();
        expect(vcRef.clear).not.toHaveBeenCalled();
    });

    it('renders the partial into the host, announces the load and reuses the resolved target', async () => {
        await directive._renderPartial('p1');
        expect($invokeWatchers).toHaveBeenCalledWith(true);
        expect(provider.getComponentFactoryRef).toHaveBeenCalledWith('p1', expect.anything(), { prefab: undefined });
        expect(host.contains(partialEl)).toBe(true);
        expect(directive.contentInitialized).toBe(true);
        expect(comp.invokeEventCallback).not.toHaveBeenCalled();
        jest.advanceTimersByTime(200);
        expect(comp.invokeEventCallback).toHaveBeenCalledWith('load');
        expect(app.notify).toHaveBeenCalledWith('partialLoaded');

        const second = document.createElement('section');
        vcRef.createComponent.mockReturnValue({ instance: {}, location: { nativeElement: second } });
        await directive._renderPartial('p1');
        expect(host.contains(partialEl)).toBe(false);
        expect(host.contains(second)).toBe(true);
    });

    it('prefers the [partial-container-target] element', async () => {
        const target = document.createElement('div');
        target.setAttribute('partial-container-target', '');
        target.innerHTML = '<i>old</i>';
        host.appendChild(target);
        await directive._renderPartial('p1');
        expect(target.contains(partialEl)).toBe(true);
        expect(target.querySelector('i')).toBeNull();
    });

    it('passes the prefab of the enclosing .app-prefab to the partial', async () => {
        const prefab = document.createElement('div');
        prefab.className = 'app-prefab';
        prefab.setAttribute('prefabname', 'pf');
        prefab.appendChild(host);
        document.body.appendChild(prefab);
        const instance: any = {};
        vcRef.createComponent.mockReturnValue({ instance, location: { nativeElement: partialEl } });
        await directive._renderPartial('p1');
        expect(provider.getComponentFactoryRef).toHaveBeenCalledWith('p1', expect.anything(), { prefab: 'pf' });
        expect(instance.prefabName).toBe('pf');
        prefab.remove();
    });

    it('uses the prefab name of the view parent', async () => {
        comp.viewParent = { prefabName: 'vp' };
        await directive._renderPartial('p1');
        expect(provider.getComponentFactoryRef).toHaveBeenCalledWith('p1', expect.anything(), { prefab: 'vp' });
    });

    it('does not set a prefab name on a partial created without a prefab context', async () => {
        const instance: any = {};
        vcRef.createComponent.mockReturnValue({ instance, location: { nativeElement: partialEl } });
        comp.viewParent = {};
        await directive._renderPartial('p1');
        expect('prefabName' in instance).toBe(false);
    });

    it('logs and stops when the partial class cannot be loaded', async () => {
        provider.getComponentFactoryRef.mockResolvedValue(null);
        await directive._renderPartial('missing');
        expect(errorSpy).toHaveBeenCalledWith('Failed to load partial component: missing');
        expect(vcRef.createComponent).not.toHaveBeenCalled();
    });

    it('logs errors raised while rendering', async () => {
        const err = new Error('boom');
        provider.getComponentFactoryRef.mockRejectedValue(err);
        await directive._renderPartial('p1');
        expect(errorSpy).toHaveBeenCalledWith('Error rendering partial p1:', err);
    });

    describe('content property changes', () => {
        beforeEach(() => { directive.renderPartial = jest.fn(); });

        it('ignores other properties', () => {
            propListener('caption', 'x');
            expect(directive.renderPartial).not.toHaveBeenCalled();
        });

        it('renders new content and flags inline content only when no content is given', () => {
            comp.isInlineContent = true;
            propListener('content', 'abc');
            expect(comp.isInlineContent).toBe(false);
            expect(directive.renderPartial).toHaveBeenCalledWith('abc');
            propListener('content', '');
            expect(comp.isInlineContent).toBe(true);
            propListener('content', undefined);
            expect(comp.isInlineContent).toBe(true);
        });

        it('leaves components without an inline flag untouched', () => {
            propListener('content', 'abc');
            expect('isInlineContent' in comp).toBe(false);
        });

        it('defers rendering of lazily loaded partials until they are loaded', () => {
            comp.$lazyLoad = jest.fn();
            propListener('content', 'lazy');
            expect(directive.renderPartial).not.toHaveBeenCalled();
            comp.$lazyLoad();
            expect(directive.renderPartial).toHaveBeenCalledWith('lazy');
            expect(typeof comp.$lazyLoad).toBe('function');
        });
    });

    describe('params changes', () => {
        it('ignores params until the content has been rendered', () => {
            directive.renderPartial = jest.fn();
            params$.next({});
            jest.advanceTimersByTime(300);
            expect(directive.renderPartial).not.toHaveBeenCalled();
            expect($appDigest).not.toHaveBeenCalled();
        });

        it('digests the live partial in place', () => {
            directive.contentInitialized = true;
            directive.instanceRef = { instance: {} };
            directive.renderPartial = jest.fn();
            params$.next({});
            jest.advanceTimersByTime(300);
            expect($appDigest).toHaveBeenCalledWith(true);
            expect(directive.renderPartial).not.toHaveBeenCalled();
        });

        it('renders again when there is no live partial yet', () => {
            directive.contentInitialized = true;
            directive.instanceRef = null;
            directive.renderPartial = jest.fn();
            params$.next({});
            jest.advanceTimersByTime(300);
            expect(directive.renderPartial).toHaveBeenCalledWith('p1');
        });

        it('stops listening when the widget is destroyed', () => {
            const destroy = comp.registerDestroyListener.mock.calls[0][0];
            destroy();
            directive.contentInitialized = true;
            directive.renderPartial = jest.fn();
            params$.next({});
            jest.advanceTimersByTime(300);
            expect(directive.renderPartial).not.toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('releases everything', () => {
            const cancel = jest.fn();
            directive.renderPartial = Object.assign(jest.fn(), { cancel });
            directive.$target = host;
            directive.instanceRef = {};
            directive.contentInitialized = true;
            directive.ngOnDestroy();
            expect(vcRef.clear).toHaveBeenCalled();
            expect(cancel).toHaveBeenCalled();
            expect(directive.renderPartial).toBeNull();
            expect(directive.$target).toBeNull();
            expect(directive.instanceRef).toBeNull();
            expect(directive.contentInitialized).toBe(false);
        });

        it('tolerates a second destroy, a missing view container and a non-cancellable render function', () => {
            directive.ngOnDestroy();
            vcRef.clear.mockClear();
            directive.vcRef = null;
            expect(() => directive.ngOnDestroy()).not.toThrow();
            expect(vcRef.clear).not.toHaveBeenCalled();
            directive.renderPartial = jest.fn();
            expect(() => directive.ngOnDestroy()).not.toThrow();
            expect(directive.renderPartial).toBeNull();
        });
    });
});
