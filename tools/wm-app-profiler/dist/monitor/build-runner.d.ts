import { ProcessMonitor } from './process-monitor.js';
import { BuildResourceReport } from '../types.js';
export interface RunBuildOptions {
    /** Path to a *generated* Angular app directory (has angular.json / build-scripts). */
    appDir: string;
    projectName?: string;
}
/**
 * Picks the same build entry point a real deployment would use: this repo's own
 * `build-scripts/build.js` wrapper if the generated app has one, otherwise falls back to
 * calling the Angular CLI directly. Deliberately does not set `--max-old-space-size` or any
 * other memory cap — the goal here is to observe natural memory usage, not enforce a limit.
 */
export declare function findBuildCommand(appDir: string): {
    command: string;
    args: string[];
};
export declare function runMonitoredBuild(options: RunBuildOptions, monitor: ProcessMonitor, baselinePeakRssMB?: number): Promise<{
    success: boolean;
    report: BuildResourceReport;
}>;
