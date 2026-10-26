import { Subject } from 'rxjs';
import { FragmentMonitor } from './fragment-monitor';

class CoverFragmentMonitor extends FragmentMonitor {
    public triggerCleanup() {
        (this as any).cleanupFragmentMonitor();
    }
}

describe('FragmentMonitor cleanup: coverage gaps', () => {
    it('does not complete subjects that were already closed', () => {
        const monitor = new CoverFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        const viewComplete = jest.spyOn(monitor.viewInit$, 'complete');
        const loadedComplete = jest.spyOn(monitor.fragmentsLoaded$, 'complete');
        monitor.viewInit$.unsubscribe();
        monitor.fragmentsLoaded$.unsubscribe();
        monitor.triggerCleanup();
        expect(viewComplete).not.toHaveBeenCalled();
        expect(loadedComplete).not.toHaveBeenCalled();
        expect(monitor.viewInit$).toBeNull();
        expect(monitor.fragmentsLoaded$).toBeNull();
    });

    it('tolerates a missing fragmentsLoaded$ and a missing subscription', () => {
        const monitor = new CoverFragmentMonitor();
        monitor.fragmentsLoaded$ = undefined;
        expect(() => monitor.triggerCleanup()).not.toThrow();
        expect(monitor.fragmentsLoaded$).toBeNull();
    });

    it('completes open subjects and unsubscribes from the init subscription', () => {
        const monitor = new CoverFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        monitor.init();
        const loaded = monitor.fragmentsLoaded$;
        const done = jest.fn();
        loaded.subscribe({ complete: done });
        monitor.triggerCleanup();
        expect(done).toHaveBeenCalled();
        expect((monitor as any).viewInitSubscription).toBeNull();
    });
});
