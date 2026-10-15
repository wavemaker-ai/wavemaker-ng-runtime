import { Subject } from 'rxjs';
import { FragmentMonitor } from './fragment-monitor';

class TestFragmentMonitor extends FragmentMonitor {
    public triggerCleanup() {
        (this as any).cleanupFragmentMonitor();
    }
}

describe('FragmentMonitor', () => {
    it('should mark the view as initialized once viewInit$ completes', () => {
        const monitor = new TestFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        monitor.init();
        expect(monitor.isViewInitialized).toBeFalsy();
        monitor.viewInit$.complete();
        expect(monitor.isViewInitialized).toBe(true);
    });

    it('should not become ready while fragments are still pending', () => {
        const monitor = new TestFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        monitor.registerFragment();
        monitor.init();
        monitor.viewInit$.complete();
        expect(monitor.isViewInitialized).toBe(true);
        expect(monitor.fragments).toBe(1);
    });

    it('should complete fragmentsLoaded$ once the last fragment resolves after the view is initialized', () => {
        const monitor = new TestFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        monitor.registerFragment();
        monitor.init();
        monitor.viewInit$.complete();
        const completeSpy = jest.fn();
        monitor.fragmentsLoaded$.subscribe({ complete: completeSpy });
        monitor.resolveFragment();
        expect(monitor.fragments).toBe(0);
        expect(completeSpy).toHaveBeenCalled();
    });

    it('should become a no-op for further register/resolve calls once ready', () => {
        const monitor = new TestFragmentMonitor();
        monitor.viewInit$ = new Subject<any>();
        monitor.init();
        monitor.viewInit$.complete();
        expect(() => monitor.registerFragment()).not.toThrow();
        expect(monitor.fragments).toBe(0);
    });

    describe('cleanupFragmentMonitor', () => {
        it('should unsubscribe from viewInit$ and complete both subjects', () => {
            const monitor = new TestFragmentMonitor();
            monitor.viewInit$ = new Subject<any>();
            monitor.init();
            const completeSpy = jest.fn();
            monitor.fragmentsLoaded$.subscribe({ complete: completeSpy });
            monitor.triggerCleanup();
            expect(monitor.viewInit$).toBeNull();
            expect(monitor.fragmentsLoaded$).toBeNull();
            expect(completeSpy).toHaveBeenCalled();
        });

        it('should be safe to call when viewInit$ was never assigned', () => {
            const monitor = new TestFragmentMonitor();
            expect(() => monitor.triggerCleanup()).not.toThrow();
        });
    });
});
