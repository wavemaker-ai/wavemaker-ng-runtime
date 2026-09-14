import { MemorySample, BuildResourceReport } from '../types.js';
export declare class ProcessMonitor {
    private intervalId;
    private samples;
    private currentPhase;
    private peakRssMB;
    private startTime;
    private roleAccByPhase;
    start(pid: number, intervalMs?: number): void;
    setPhase(phaseName: string): void;
    stop(): {
        peakRssMB: number;
        samples: MemorySample[];
        durationSec: number;
    };
    /**
     * @param baselinePeakRssMB Peak RSS measured from a prior *unpatched* build of the same
     *   project, if one was actually run. Only then can memory "saved" be reported — otherwise
     *   a low peak RSS just means the project is small, not that the patches did anything.
     */
    generateReport(projectName: string, initialLimitMB?: number, baselinePeakRssMB?: number): BuildResourceReport;
}
