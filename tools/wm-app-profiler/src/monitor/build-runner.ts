import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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
export function findBuildCommand(appDir: string): { command: string; args: string[] } {
  const buildScript = path.join(appDir, 'build-scripts', 'build.js');
  if (fs.existsSync(buildScript)) {
    return { command: 'node', args: ['build-scripts/build.js', '--c=production'] };
  }
  return { command: 'npx', args: ['ng', 'build', '--configuration', 'production'] };
}

export async function runMonitoredBuild(
  options: RunBuildOptions,
  monitor: ProcessMonitor,
  baselinePeakRssMB?: number
): Promise<{ success: boolean; report: BuildResourceReport }> {
  const projectName = options.projectName || path.basename(options.appDir);
  const { command, args } = findBuildCommand(options.appDir);

  if (!fs.existsSync(path.join(options.appDir, 'node_modules'))) {
    throw new Error(
      `No node_modules found in '${options.appDir}'. Run 'npm install' in that directory before monitoring a build.`
    );
  }

  monitor.setPhase('Production Build');

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.appDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (child.pid) {
      monitor.start(child.pid);
    }

    let stderrTail = '';
    child.stderr?.on('data', data => {
      stderrTail = (stderrTail + data.toString()).slice(-4000);
    });

    child.on('close', code => {
      const report = monitor.generateReport(projectName, 12288, baselinePeakRssMB);
      if (code === 0) {
        resolve({ success: true, report });
      } else {
        reject(new Error(`Build failed with exit code ${code}. Last output:\n${stderrTail}`));
      }
    });

    child.on('error', err => reject(err));
  });
}
