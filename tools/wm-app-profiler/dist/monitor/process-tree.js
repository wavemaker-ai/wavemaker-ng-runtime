import { execFile } from 'child_process';
import pidusage from 'pidusage';
/**
 * Groups a full command line into a human-readable role for the memory breakdown, so "where is
 * the memory going" reads as e.g. "Terser/webpack worker" and "Angular CLI (ng build)" rather
 * than a wall of PIDs that all report the same bare "node" executable name.
 */
export function deriveProcessRole(command) {
    if (/jest-worker/.test(command))
        return 'Terser/webpack worker';
    if (/webpack[\\/](?:bin|cli)/.test(command))
        return 'webpack (main)';
    if (/codegen-args-cli/.test(command))
        return 'ng-codegen';
    if (/\bng\b[^&|]*\bbuild\b/.test(command))
        return 'Angular CLI (ng build)';
    if (/node_modules[\\/]\.bin[\\/]ng\b/.test(command))
        return 'Angular CLI (ng)';
    const scriptMatch = command.match(/([\w.-]+\.(?:m?js|cjs))\b/);
    if (scriptMatch)
        return scriptMatch[1];
    return command.trim().slice(0, 40) || 'unknown';
}
/**
 * Lists every PID currently running with its parent PID and command name, via `ps`. A single
 * build-time PID is not the whole picture: `ng build` spawns Terser/webpack worker child
 * processes that each hold their own copy of the AST in memory, so summing only the root PID's
 * RSS would systematically undercount where memory actually goes during a build.
 */
function listProcesses() {
    return new Promise((resolve, reject) => {
        // Full args (not just the short `comm` executable name) so worker child processes spawned
        // by the same `node` binary as their parent (e.g. Terser's jest-worker pool) can still be
        // told apart by the script path they're actually running.
        execFile('ps', ['-Ao', 'pid=,ppid=,args='], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err)
                return reject(err);
            const rows = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
                if (!match)
                    return null;
                return { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] };
            })
                .filter((row) => row !== null);
            resolve(rows);
        });
    });
}
/** Returns rootPid plus every live descendant PID (children, grandchildren, ...). */
export async function getDescendantPids(rootPid) {
    let processes;
    try {
        processes = await listProcesses();
    }
    catch {
        return [rootPid];
    }
    const childrenByParent = new Map();
    for (const p of processes) {
        const siblings = childrenByParent.get(p.ppid) || [];
        siblings.push(p.pid);
        childrenByParent.set(p.ppid, siblings);
    }
    const result = new Set([rootPid]);
    const queue = [rootPid];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const child of childrenByParent.get(current) || []) {
            if (!result.has(child)) {
                result.add(child);
                queue.push(child);
            }
        }
    }
    return Array.from(result);
}
/**
 * Samples RSS across the root PID and every one of its current descendants, so the reported
 * total reflects the whole build process tree (main process + Terser/webpack worker children),
 * not just whichever single PID happened to be spawned first.
 */
export async function sampleProcessTree(rootPid) {
    const pids = await getDescendantPids(rootPid);
    let processes = [];
    try {
        processes = await listProcesses();
    }
    catch {
        // ignore; command names just won't be available below
    }
    const commandByPid = new Map(processes.map(p => [p.pid, p.command]));
    let stats;
    try {
        stats = (await pidusage(pids));
    }
    catch {
        return { totalRssMB: 0, processCount: 0, processes: [] };
    }
    const perProcess = [];
    let totalRssMB = 0;
    for (const pid of pids) {
        const stat = stats[String(pid)];
        if (!stat)
            continue; // process already exited between listing and sampling
        const rssMB = Math.round(stat.memory / 1024 / 1024);
        const command = commandByPid.get(pid) || 'unknown';
        totalRssMB += rssMB;
        perProcess.push({ pid, command, role: deriveProcessRole(command), rssMB });
    }
    return { totalRssMB, processCount: perProcess.length, processes: perProcess };
}
