export interface TreeProcessStats {
    pid: number;
    command: string;
    role: string;
    rssMB: number;
}
/**
 * Groups a full command line into a human-readable role for the memory breakdown, so "where is
 * the memory going" reads as e.g. "Terser/webpack worker" and "Angular CLI (ng build)" rather
 * than a wall of PIDs that all report the same bare "node" executable name.
 */
export declare function deriveProcessRole(command: string): string;
export interface TreeMemorySnapshot {
    totalRssMB: number;
    processCount: number;
    processes: TreeProcessStats[];
}
/** Returns rootPid plus every live descendant PID (children, grandchildren, ...). */
export declare function getDescendantPids(rootPid: number): Promise<number[]>;
/**
 * Samples RSS across the root PID and every one of its current descendants, so the reported
 * total reflects the whole build process tree (main process + Terser/webpack worker children),
 * not just whichever single PID happened to be spawned first.
 */
export declare function sampleProcessTree(rootPid: number): Promise<TreeMemorySnapshot>;
