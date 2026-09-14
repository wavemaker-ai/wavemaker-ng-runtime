import { ProcessMonitor } from './process-monitor.js';
import { BuildResourceReport } from '../types.js';
export interface RunCodegenOptions {
    unzippedProjectPath: string;
    targetFolder: string;
    codegenRepoPath?: string;
    projectName?: string;
}
export declare function findCodegenCli(baseDir?: string): string | null;
export declare function runMonitoredCodegen(options: RunCodegenOptions, monitor: ProcessMonitor): Promise<{
    success: boolean;
    generatedAppPath: string;
    report: BuildResourceReport;
}>;
