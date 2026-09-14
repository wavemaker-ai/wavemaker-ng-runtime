import os from 'os';
import { sampleProcessTree } from './process-tree.js';
export class ProcessMonitor {
    intervalId = null;
    samples = [];
    currentPhase = 'Init';
    peakRssMB = 0;
    startTime = 0;
    // phase -> role -> peak usage seen for that role while that phase was active
    roleAccByPhase = new Map();
    start(pid, intervalMs = 500) {
        this.samples = [];
        this.peakRssMB = 0;
        this.roleAccByPhase = new Map();
        this.startTime = Date.now();
        this.intervalId = setInterval(async () => {
            try {
                const snapshot = await sampleProcessTree(pid);
                if (snapshot.processCount === 0) {
                    // Root process (and every descendant) has already exited.
                    this.stop();
                    return;
                }
                if (snapshot.totalRssMB > this.peakRssMB)
                    this.peakRssMB = snapshot.totalRssMB;
                this.samples.push({
                    timestamp: Date.now(),
                    phase: this.currentPhase,
                    rssMB: snapshot.totalRssMB,
                    processCount: snapshot.processCount
                });
                // Roll this sample's per-role memory into the current phase's role accumulator, so we
                // can report e.g. "Terser workers peaked at 1.8GB across 2 concurrent processes" instead
                // of just a single opaque total.
                const roleTotals = new Map();
                for (const proc of snapshot.processes) {
                    const entry = roleTotals.get(proc.role) || { rssMB: 0, count: 0 };
                    entry.rssMB += proc.rssMB;
                    entry.count += 1;
                    roleTotals.set(proc.role, entry);
                }
                let roleAcc = this.roleAccByPhase.get(this.currentPhase);
                if (!roleAcc) {
                    roleAcc = new Map();
                    this.roleAccByPhase.set(this.currentPhase, roleAcc);
                }
                for (const [role, totals] of roleTotals) {
                    const acc = roleAcc.get(role) || { peakRssMB: 0, peakConcurrentCount: 0 };
                    if (totals.rssMB > acc.peakRssMB)
                        acc.peakRssMB = totals.rssMB;
                    if (totals.count > acc.peakConcurrentCount)
                        acc.peakConcurrentCount = totals.count;
                    roleAcc.set(role, acc);
                }
            }
            catch {
                this.stop();
            }
        }, intervalMs);
    }
    setPhase(phaseName) {
        this.currentPhase = phaseName;
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        const durationSec = Math.round((Date.now() - this.startTime) / 1000);
        return {
            peakRssMB: this.peakRssMB,
            samples: this.samples,
            durationSec
        };
    }
    /**
     * @param baselinePeakRssMB Peak RSS measured from a prior *unpatched* build of the same
     *   project, if one was actually run. Only then can memory "saved" be reported — otherwise
     *   a low peak RSS just means the project is small, not that the patches did anything.
     */
    generateReport(projectName, initialLimitMB = 12288, baselinePeakRssMB) {
        const durationSec = Math.round((Date.now() - this.startTime) / 1000);
        // Group samples by phase
        const phaseMap = new Map();
        for (const sample of this.samples) {
            const existing = phaseMap.get(sample.phase) || { duration: 0, peak: 0 };
            existing.duration += 0.5;
            if (sample.rssMB > existing.peak)
                existing.peak = sample.rssMB;
            phaseMap.set(sample.phase, existing);
        }
        const phaseBreakdown = Array.from(phaseMap.entries()).map(([phase, data]) => {
            const roleAcc = this.roleAccByPhase.get(phase);
            const roleBreakdown = roleAcc
                ? Array.from(roleAcc.entries())
                    .map(([role, acc]) => ({ role, peakRssMB: acc.peakRssMB, peakConcurrentCount: acc.peakConcurrentCount }))
                    .sort((a, b) => b.peakRssMB - a.peakRssMB)
                : [];
            return {
                phase,
                durationSec: Math.round(data.duration),
                peakMemoryMB: data.peak,
                roleBreakdown
            };
        });
        const measuredMemorySavedMB = baselinePeakRssMB !== undefined ? Math.max(0, baselinePeakRssMB - this.peakRssMB) : undefined;
        return {
            projectName,
            peakRssMB: this.peakRssMB,
            initialNodeLimitMB: initialLimitMB,
            recommendedNodeLimitMB: Math.max(2560, Math.ceil((this.peakRssMB * 1.3) / 512) * 512),
            systemTotalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
            buildDurationSec: durationSec,
            phaseBreakdown,
            vendorSourceMapsDisabled: true,
            measuredMemorySavedMB,
            samples: this.samples
        };
    }
}
