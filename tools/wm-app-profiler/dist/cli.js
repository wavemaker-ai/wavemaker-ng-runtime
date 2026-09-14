#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { auditWaveMakerApp, isGeneratedAngularWorkspace, filterReportToPage } from './auditor/app-auditor.js';
import { generateMarkdownReport } from './reporter/markdown-reporter.js';
import { generateJsonReport } from './reporter/json-reporter.js';
import { applyAutoPatches } from './patcher/project-patcher.js';
import { createSyntheticWaveMakerProject } from './fixture/sample-wm-project.js';
import { ProcessMonitor } from './monitor/process-monitor.js';
import { findCodegenCli, runMonitoredCodegen } from './monitor/codegen-runner.js';
import { runMonitoredBuild } from './monitor/build-runner.js';
import { copyDirectoryResilient } from './patcher/resilient-copy.js';
const program = new Command();
program
    .name('wm-profiler')
    .description('WaveMaker App Performance Auditor, 12GB Build Resource Monitor & Auto-Patcher (Zero-LLM)')
    .version('1.0.0');
import os from 'os';
import AdmZip from 'adm-zip';
function resolveInputPath(rawPath) {
    let p = rawPath;
    if (p.startsWith('~/') || p === '~') {
        p = path.join(os.homedir(), p.slice(1));
    }
    return path.resolve(p);
}
/** Writes a report file, failing with a clear message instead of a raw crash if the path isn't writable. */
function safeWriteFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
    }
    catch (err) {
        console.error(`❌ Failed to write '${filePath}': ${err?.message || err}`);
        process.exit(1);
    }
}
// Command 1: audit
program
    .command('audit <projectPath>')
    .description('Run Zero-LLM static performance audit on a WaveMaker project (directory or .zip)')
    .option('-o, --out <reportPath>', 'Output path for generated markdown report')
    .option('--json', 'Output structured JSON format to stdout or file')
    .option('--page <pageName>', 'Only report findings for a single page (case-insensitive)')
    .action((projectPath, options) => {
    let resolvedPath = resolveInputPath(projectPath);
    // If file doesn't exist, check if .zip was omitted
    if (!fs.existsSync(resolvedPath) && fs.existsSync(resolvedPath + '.zip')) {
        resolvedPath = resolvedPath + '.zip';
    }
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Project path does not exist: ${resolvedPath}`);
        process.exit(1);
    }
    let targetAuditDir = resolvedPath;
    let tempExtractDir = null;
    // Check if input is a ZIP file
    const stat = fs.statSync(resolvedPath);
    if (stat.isFile()) {
        console.log(`📦 Archive detected: ${resolvedPath}. Extracting locally for audit...`);
        tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-audit-zip-'));
        try {
            const zip = new AdmZip(resolvedPath);
            zip.extractAllTo(tempExtractDir, true);
            targetAuditDir = tempExtractDir;
        }
        catch (err) {
            console.error(`❌ Failed to extract zip archive: ${err}`);
            if (tempExtractDir)
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            process.exit(1);
        }
    }
    console.log(`\n🔍 Auditing WaveMaker App at: ${targetAuditDir}\n`);
    const appReport = auditWaveMakerApp(targetAuditDir);
    if (appReport.rootReadError) {
        console.error(`🚨 Could not read '${targetAuditDir}' at all (${appReport.rootReadError}).\n` +
            `   The report below is INVALID — every count/score is 0/100% clean only because nothing could be\n` +
            `   scanned, not because the project has no issues. On macOS, check System Settings → Privacy &\n` +
            `   Security → Files and Folders (or Full Disk Access) for the app running this command.\n`);
    }
    if (appReport.isGeneratedAngularWorkspace) {
        console.log(`⚠️  This looks like a generated Angular workspace (ng-codegen output), not the WM Source project.\n` +
            `   Part A's widget-level checks (pagination, DOM depth, heavy widgets) only recognize WM Source's\n` +
            `   <wm-table> tag-name markup, not ng-codegen's attribute-directive dialect — those findings will\n` +
            `   be incomplete. Re-run against the exported WM Source project for accurate Part A results.\n`);
    }
    // Preserve original project name if extracted from zip
    if (stat.isFile()) {
        appReport.projectName = path.basename(resolvedPath, path.extname(resolvedPath));
        appReport.projectPath = resolvedPath;
    }
    let scopedReport = appReport;
    if (options.page) {
        const filtered = filterReportToPage(appReport, options.page);
        if (!filtered) {
            console.error(`❌ No page named '${options.page}' found. Available pages:\n` +
                appReport.pages.map(p => `   • ${p.pageName}`).join('\n'));
            if (tempExtractDir && fs.existsSync(tempExtractDir))
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            process.exit(1);
        }
        scopedReport = filtered;
    }
    const fullReport = {
        appPerformance: scopedReport
    };
    if (options.json) {
        const jsonOut = generateJsonReport(fullReport);
        if (options.out) {
            safeWriteFile(options.out, jsonOut);
            console.log(`✅ JSON Report written to: ${options.out}`);
        }
        else {
            console.log(jsonOut);
        }
    }
    else {
        const mdOut = generateMarkdownReport(fullReport);
        if (options.out) {
            safeWriteFile(options.out, mdOut);
            console.log(`✅ Audit Report written to: ${options.out}`);
        }
        else {
            console.log(mdOut);
        }
    }
    // Clean up temporary extracted folder if one was created
    if (tempExtractDir && fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
});
// Command 2: patch
//
// `patch` never modifies the input project in place. Its job is to answer "if these patches
// were applied, would the audit's issues actually go away?" — it writes patched output to a
// separate reviewable copy (an "-optimized" sibling directory, or an "-optimized.zip" archive)
// and re-runs the audit against that copy so before/after can be compared directly. Whether to
// actually adopt the optimized copy into the real project is left entirely to the developer.
program
    .command('patch <projectPath>')
    .description('Preview auto-patches for a WaveMaker Source project or Angular app: writes a patched copy ' +
    '(never modifies the original) and reports before/after audit findings so you can decide whether to adopt it')
    .action((projectPath) => {
    let resolvedPath = resolveInputPath(projectPath);
    if (!fs.existsSync(resolvedPath) && fs.existsSync(resolvedPath + '.zip')) {
        resolvedPath = resolvedPath + '.zip';
    }
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Project path does not exist: ${resolvedPath}`);
        process.exit(1);
    }
    console.log(`\n🛠️  Previewing Auto-Patches for: ${resolvedPath}\n`);
    const stat = fs.statSync(resolvedPath);
    const isZip = stat.isFile();
    let sourceDir;
    let tempExtractDir = null;
    if (isZip) {
        console.log(`📦 Archive detected: ${resolvedPath}. Extracting locally...`);
        tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-patch-zip-'));
        try {
            const zip = new AdmZip(resolvedPath);
            zip.extractAllTo(tempExtractDir, true);
            sourceDir = tempExtractDir;
        }
        catch (err) {
            console.error(`❌ Failed to extract zip: ${err}`);
            if (tempExtractDir)
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            process.exit(1);
        }
    }
    else {
        sourceDir = resolvedPath;
    }
    // "Before" picture, straight from the original (untouched) project.
    const beforeReport = auditWaveMakerApp(sourceDir);
    if (beforeReport.rootReadError) {
        console.error(`❌ Could not read '${sourceDir}' at all (${beforeReport.rootReadError}).\n` +
            `   No patch preview can be produced — this usually means the terminal/IDE running this command\n` +
            `   doesn't have permission to access that folder. On macOS, check System Settings → Privacy &\n` +
            `   Security → Files and Folders (or Full Disk Access) for the app you're running this from, and\n` +
            `   grant it access to this location.`);
        if (tempExtractDir)
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        process.exit(1);
    }
    if (beforeReport.isGeneratedAngularWorkspace) {
        console.log(`⚠️  This looks like a generated Angular workspace (ng-codegen output), not the WM Source project.\n` +
            `   Widget-level HTML pagination patching only recognizes WM Source's <wm-table> tag-name markup and\n` +
            `   will be skipped here. angular.json / wm-custom-webpack.config.js patches still apply normally.\n`);
    }
    // Copy the project (excluding node_modules) to a separate "-optimized" location and patch
    // that copy only — the original directory is never written to.
    const optimizedDir = isZip
        ? tempExtractDir
        : path.join(path.dirname(resolvedPath), `${path.basename(resolvedPath)}-optimized`);
    if (!isZip) {
        if (fs.existsSync(optimizedDir)) {
            fs.rmSync(optimizedDir, { recursive: true, force: true });
        }
        const { skipped, rootFailed } = copyDirectoryResilient(resolvedPath, optimizedDir);
        if (rootFailed) {
            const rootReason = skipped.find(s => s.path === '.')?.reason || 'unknown error';
            console.error(`❌ Could not read '${resolvedPath}' at all (${rootReason}).\n` +
                `   No optimized copy could be produced — this usually means the terminal/IDE running this command\n` +
                `   doesn't have permission to access that folder. On macOS, check System Settings → Privacy &\n` +
                `   Security → Files and Folders (or Full Disk Access) for the app you're running this from, and\n` +
                `   grant it access to this location.`);
            if (fs.existsSync(optimizedDir))
                fs.rmSync(optimizedDir, { recursive: true, force: true });
            process.exit(1);
        }
        if (skipped.length > 0) {
            console.log(`⚠️  Skipped ${skipped.length} unreadable file(s)/folder(s) while copying (shown below) — everything else was copied normally:`);
            for (const s of skipped.slice(0, 20))
                console.log(`   • ${s.path} (${s.reason})`);
            if (skipped.length > 20)
                console.log(`   ...and ${skipped.length - 20} more`);
        }
    }
    // Pruning must never remove a script that a page still relies on (e.g. wm-chart -> D3).
    const unusedLibs = beforeReport.unusedGlobalLibraries.map(lib => ({
        libraryName: lib.libraryName,
        scriptFile: lib.scriptFile
    }));
    const patchResult = applyAutoPatches(optimizedDir, unusedLibs);
    console.log(`⚡ Patches that would be applied:`);
    if (patchResult.patchedAngularJson) {
        console.log(`  • angular.json updated: YES (Pruned: ${patchResult.removedScripts.join(', ')})`);
    }
    if (patchResult.sourceMapsOptimized) {
        console.log(`  • Vendor source-maps disabled: YES`);
    }
    if (patchResult.licenseExtractionDisabled) {
        console.log(`  • License extraction disabled: YES`);
    }
    if (patchResult.buildCacheEnabled) {
        console.log(`  • Persistent build cache enabled under CI (cli.cache.environment='all'): YES — measured 54% faster / 13% less RAM on a repeat CI build`);
    }
    if ((patchResult.patchedSourceWidgetsCount || 0) > 0) {
        console.log(`  • Unpaginated Tables/Lists auto-paginated: ${patchResult.patchedSourceWidgetsCount} widgets`);
    }
    if ((patchResult.patchedSourceVariablesCount || 0) > 0) {
        console.log(`  • Unbounded Variables auto-capped (maxResults=20): ${patchResult.patchedSourceVariablesCount} variables`);
    }
    if ((patchResult.patchedDeferloadCount || 0) > 0) {
        console.log(`  • Conditionally-shown prefabs given deferload="true": ${patchResult.patchedDeferloadCount} (only applied where it genuinely takes effect — see 'audit' MISSING_DEFERLOAD notes)`);
    }
    if ((patchResult.patchedDebuggerStatementsCount || 0) > 0) {
        console.log(`  • 'debugger;' statements removed from page scripts: ${patchResult.patchedDebuggerStatementsCount}`);
    }
    if ((patchResult.patchedRenderBlockingScriptsCount || 0) > 0) {
        console.log(`  • Render-blocking <script> tags given 'defer' in index.html: ${patchResult.patchedRenderBlockingScriptsCount}`);
    }
    // "After" picture: re-audit the patched copy to confirm the issues are actually resolved.
    const afterReport = auditWaveMakerApp(optimizedDir);
    const criticalBefore = beforeReport.actionItems.filter(i => i.severity === 'CRITICAL').length;
    const criticalAfter = afterReport.actionItems.filter(i => i.severity === 'CRITICAL').length;
    const warningBefore = beforeReport.actionItems.filter(i => i.severity === 'WARNING').length;
    const warningAfter = afterReport.actionItems.filter(i => i.severity === 'WARNING').length;
    console.log(`\n📊 Before → After (re-audit of the patched copy):`);
    console.log(`  • Performance Health Score: ${beforeReport.overallScore}/100 → ${afterReport.overallScore}/100`);
    console.log(`  • Critical issues: ${criticalBefore} → ${criticalAfter}`);
    console.log(`  • Warnings: ${warningBefore} → ${warningAfter}`);
    if (isZip && tempExtractDir) {
        const parentDir = path.dirname(resolvedPath);
        const baseName = path.basename(resolvedPath, path.extname(resolvedPath));
        const optimizedZipPath = path.join(parentDir, `${baseName}-optimized.zip`);
        const outZip = new AdmZip();
        outZip.addLocalFolder(tempExtractDir);
        outZip.writeZip(optimizedZipPath);
        console.log(`\n📦 Optimized archive written to (original untouched): ${optimizedZipPath}`);
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    else {
        console.log(`\n📁 Optimized copy written to (original untouched): ${optimizedDir}`);
    }
    console.log(`\n🎉 ${patchResult.summary}\n` +
        `   Review the optimized copy above and adopt it into your real project if you want these changes — nothing here was applied automatically.\n`);
});
// Command 3: monitor
//
// Runs the real codegen and/or production-build process while tracking memory usage across the
// WHOLE process tree (main process + Terser/webpack worker children), broken down by phase and
// by process role. Deliberately applies no --max-old-space-size cap — the point is to observe
// where memory is actually going, not to enforce or test against a fixed limit.
function printResourceReport(reports) {
    console.log(`\n📊 Resource Usage Report (no memory cap applied — observed natural usage)\n`);
    for (const report of reports) {
        console.log(`Peak total RSS across process tree: ${report.peakRssMB} MB  (build duration: ${report.buildDurationSec}s)`);
        if (report.measuredMemorySavedMB !== undefined) {
            console.log(`  → Measured RAM saved vs baseline: ${report.measuredMemorySavedMB} MB`);
        }
        console.log(`Recommended Node memory limit: ${report.recommendedNodeLimitMB} MB  (this machine has ${report.systemTotalMemMB} MB total RAM)`);
        if (report.recommendedNodeLimitMB > report.systemTotalMemMB) {
            console.log(`  ⚠️  Recommended limit EXCEEDS this machine's total RAM. If this machine is (or matches) the real build target, ` +
                `provisioning --max-old-space-size alone won't help — the build will OOM-kill the whole system before Node's own limit is reached.`);
        }
        else if (report.recommendedNodeLimitMB > report.systemTotalMemMB * 0.85) {
            console.log(`  ⚠️  Recommended limit is within 15% of this machine's total RAM — little headroom left for the OS and any other concurrent process.`);
        }
        for (const phase of report.phaseBreakdown) {
            console.log(`\n  Phase: ${phase.phase}  —  ${phase.durationSec}s, peak ${phase.peakMemoryMB} MB`);
            for (const role of phase.roleBreakdown) {
                console.log(`    • ${role.role}: peak ${role.peakRssMB} MB across up to ${role.peakConcurrentCount} concurrent process(es)`);
            }
        }
        console.log('');
    }
}
program
    .command('monitor <projectPath>')
    .description('Run codegen and/or a real production build while tracking where memory goes across the ' +
    'whole process tree, broken down by phase and process role — no memory cap applied. By ' +
    'default, auto-patches the generated app (source maps, license extraction, persistent ' +
    'build cache under CI) before building, to measure the build with RAM fixes applied.')
    .option('--codegen-repo <path>', 'Path to the wavemaker-ng-codegen CLI entry, if not auto-discovered')
    .option('-o, --out <reportPath>', 'Output path for the JSON resource report')
    .option('--no-patch', 'Skip auto-patching before the build — measure the raw generated app as-is')
    .option('--compare-baseline', 'Also build once unpatched first, so the report shows the actual measured RAM delta from the fixes')
    .action(async (projectPath, options) => {
    const resolvedPath = resolveInputPath(projectPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Project path does not exist: ${resolvedPath}`);
        process.exit(1);
    }
    const reports = [];
    let appDir = resolvedPath;
    if (!isGeneratedAngularWorkspace(resolvedPath)) {
        console.log(`\n🧬 Running codegen for WM Source project at: ${resolvedPath}\n`);
        const codegenCli = options.codegenRepo || findCodegenCli();
        if (!codegenCli) {
            console.error(`❌ Could not find the wavemaker-ng-codegen CLI. Pass --codegen-repo <path>, or point 'monitor'\n` +
                `   directly at an already-generated Angular app directory instead.`);
            process.exit(1);
        }
        const targetFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-monitor-codegen-'));
        const codegenMonitor = new ProcessMonitor();
        try {
            const { generatedAppPath, report } = await runMonitoredCodegen({ unzippedProjectPath: resolvedPath, targetFolder, codegenRepoPath: options.codegenRepo }, codegenMonitor);
            reports.push(report);
            appDir = generatedAppPath;
            console.log(`✅ Codegen complete. Generated app at: ${appDir}`);
        }
        catch (err) {
            console.error(`❌ Codegen failed: ${err}`);
            process.exit(1);
        }
    }
    else {
        console.log(`\n📁 Target is already a generated Angular workspace: ${resolvedPath}\n`);
    }
    let baselinePeakRssMB;
    if (options.compareBaseline) {
        console.log(`\n🏗️  Running BASELINE production build (unpatched) at: ${appDir}\n` +
            `   (no --max-old-space-size cap applied — observing natural memory usage)\n`);
        const baselineMonitor = new ProcessMonitor();
        try {
            const { report } = await runMonitoredBuild({ appDir, projectName: `${path.basename(appDir)}-baseline` }, baselineMonitor);
            reports.push(report);
            baselinePeakRssMB = report.peakRssMB;
        }
        catch (err) {
            console.error(`❌ Baseline build failed: ${err}`);
            reports.push(baselineMonitor.generateReport(`${path.basename(appDir)}-baseline`));
            printResourceReport(reports);
            if (options.out)
                safeWriteFile(options.out, JSON.stringify(reports, null, 2));
            process.exit(1);
        }
    }
    if (options.patch !== false) {
        console.log(`\n🔧 Auto-patching generated app before build (source maps, license extraction, persistent build cache under CI)...`);
        const patchResult = applyAutoPatches(appDir, []);
        console.log(`   ${patchResult.summary}`);
    }
    console.log(`\n🏗️  Running production build at: ${appDir}\n` +
        `   (no --max-old-space-size cap applied — observing natural memory usage)\n`);
    const buildMonitor = new ProcessMonitor();
    try {
        const { report } = await runMonitoredBuild({ appDir, projectName: options.compareBaseline ? `${path.basename(appDir)}-patched` : path.basename(appDir) }, buildMonitor, baselinePeakRssMB);
        reports.push(report);
    }
    catch (err) {
        console.error(`❌ Build failed: ${err}`);
        reports.push(buildMonitor.generateReport(path.basename(appDir)));
        printResourceReport(reports);
        if (options.out)
            safeWriteFile(options.out, JSON.stringify(reports, null, 2));
        process.exit(1);
    }
    printResourceReport(reports);
    if (options.out) {
        safeWriteFile(options.out, JSON.stringify(reports, null, 2));
        console.log(`✅ JSON resource report written to: ${options.out}`);
    }
});
// Command 4: demo
program
    .command('demo [targetDir]')
    .description('Generate a synthetic WaveMaker test app and run the full audit & patcher demonstration')
    .action((targetDir) => {
    const fixtureDir = path.resolve(targetDir || './tmp-demo-wm-project');
    console.log(`\n🚀 Generating synthetic WaveMaker test fixture at: ${fixtureDir}`);
    createSyntheticWaveMakerProject(fixtureDir);
    console.log(`🔍 Running audit on synthetic project...\n`);
    const appReport = auditWaveMakerApp(fixtureDir);
    const fullReport = {
        appPerformance: appReport
    };
    const mdReport = generateMarkdownReport(fullReport);
    const reportPath = path.join(fixtureDir, 'PERFORMANCE_REPORT.md');
    safeWriteFile(reportPath, mdReport);
    console.log(mdReport);
    console.log(`\n✅ Demonstration Complete! Full report saved to: ${reportPath}\n`);
});
program.parse(process.argv);
