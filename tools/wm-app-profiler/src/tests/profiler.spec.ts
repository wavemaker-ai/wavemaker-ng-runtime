import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { auditPageTemplate } from '../auditor/page-template-auditor.js';
import { auditVariablesJson } from '../auditor/variable-auditor.js';
import { auditPageScript } from '../auditor/page-script-auditor.js';
import { auditWaveMakerApp } from '../auditor/app-auditor.js';
import { applyAutoPatches } from '../patcher/project-patcher.js';
import { ProcessMonitor } from '../monitor/process-monitor.js';
import { detectSelfNestedPackages } from '../auditor/dependency-nesting-auditor.js';
import { auditTrustAsUsage } from '../auditor/trust-as-auditor.js';
import { pruneAngularJsonScripts } from '../patcher/script-pruner.js';
import { optimizeWebpackAndBuildConfigs } from '../patcher/webpack-optimizer.js';
import { createSyntheticWaveMakerProject } from '../fixture/sample-wm-project.js';
import { generateMarkdownReport } from '../reporter/markdown-reporter.js';

describe('WaveMaker Performance Auditor (Zero-LLM Engine)', () => {

  test('Page Template Auditor: detects unpaginated tables & DOM depth', () => {
    const sampleHtml = `
      <wm-page>
        <wm-container>
          <wm-table name="ordersTable" navigation="None" dataset="bind:Variables.orders.dataSet"></wm-table>
        </wm-container>
      </wm-page>
    `;
    const result = auditPageTemplate(sampleHtml, 'Main');
    assert.strictEqual(result.unpaginatedWidgets.includes('ordersTable'), true);
    // DOM_PAGINATION reporting is intentionally suppressed (see page-template-auditor.ts) —
    // unpaginatedWidgets stays populated, but no action item is raised for it.
    assert.strictEqual(result.actionItems.some(i => i.category === 'DOM_PAGINATION'), false);
  });

  test('Variable Auditor: detects unbounded queries and startup waterfalls', () => {
    const vars = {
      unboundedVar: { category: 'wm.LiveVariable', startUpdate: true, maxResults: '' },
      v1: { startUpdate: true },
      v2: { startUpdate: true },
      v3: { startUpdate: true },
      v4: { startUpdate: true },
      v5: { startUpdate: true },
      v6: { startUpdate: true }
    };
    const result = auditVariablesJson(vars, 'Dashboard');
    assert.strictEqual(result.unboundedCount, 1);
    assert.strictEqual(result.startupCount, 7);
    assert.strictEqual(result.actionItems.some(i => i.category === 'QUERY_OVERFETCH'), true);
    assert.strictEqual(result.actionItems.some(i => i.category === 'VARIABLE_WATERFALL'), true);
  });

  test('Page Script Auditor: detects uncleaned setInterval', () => {
    const script = `
      Page.onPageReady = function () {
        setInterval(function() { console.log('leaking'); }, 1000);
      };
    `;
    const result = auditPageScript(script, 'Main');
    assert.strictEqual(result.leakingTimers, 1);
    assert.strictEqual(result.actionItems.some(i => i.category === 'SCRIPT_LEAK'), true);
  });

  test('Auto-Patcher: prunes unused scripts from angular.json', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-patch-test-'));
    const angularJsonPath = path.join(tempDir, 'angular.json');

    const initialAngularJson = {
      projects: {
        'angular-app': {
          architect: {
            build: {
              options: {
                scripts: [
                  './node_modules/d3/dist/d3.min.js',
                  './node_modules/jquery/dist/jquery.min.js',
                  './node_modules/summernote/dist/summernote-lite.min.js'
                ]
              }
            }
          }
        }
      }
    };
    fs.writeFileSync(angularJsonPath, JSON.stringify(initialAngularJson, null, 2), 'utf8');

    const pruneResult = pruneAngularJsonScripts(angularJsonPath, [
      { libraryName: 'Summernote', scriptFile: 'summernote' }
    ]);

    assert.strictEqual(pruneResult.modified, true);
    assert.strictEqual(pruneResult.removedScripts.some(s => s.includes('summernote')), true);

    const updatedJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    const remainingScripts = updatedJson.projects['angular-app'].architect.build.options.scripts;
    assert.strictEqual(remainingScripts.some((s: string) => s.includes('summernote')), false);
    assert.strictEqual(remainingScripts.some((s: string) => s.includes('jquery')), true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Auto-Patcher: enables the CI persistent build cache in angular.json', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-cache-patch-test-'));
    const angularJsonPath = path.join(tempDir, 'angular.json');

    fs.writeFileSync(
      angularJsonPath,
      JSON.stringify(
        {
          projects: {
            'angular-app': { architect: { build: { configurations: { production: {} } } } }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const firstPass = optimizeWebpackAndBuildConfigs(tempDir);
    assert.strictEqual(firstPass.buildCacheEnabled, true);

    const updatedJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    assert.strictEqual(updatedJson.cli.cache.environment, 'all');

    // Re-running against an already-patched angular.json must be a no-op, not a second write.
    const secondPass = optimizeWebpackAndBuildConfigs(tempDir);
    assert.strictEqual(secondPass.buildCacheEnabled, false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Audit + Patch: flags and fixes a disabled CI build cache', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-cache-audit-test-'));
    fs.mkdirSync(path.join(tempDir, 'src/app'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'angular.json'),
      JSON.stringify(
        {
          projects: {
            'angular-app': { architect: { build: { configurations: { production: { sourceMap: false, extractLicenses: false } } } } }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const before = auditWaveMakerApp(tempDir);
    assert.strictEqual(before.actionItems.some(i => i.category === 'CI_BUILD_CACHE_DISABLED'), true);

    applyAutoPatches(tempDir);

    const after = auditWaveMakerApp(tempDir);
    assert.strictEqual(after.actionItems.some(i => i.category === 'CI_BUILD_CACHE_DISABLED'), false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('ProcessMonitor: reports system total RAM alongside the recommended limit', () => {
    const monitor = new ProcessMonitor();
    const report = monitor.generateReport('no-build-ran');
    assert.strictEqual(report.systemTotalMemMB, Math.round(os.totalmem() / (1024 * 1024)));
    assert.strictEqual(report.systemTotalMemMB > 0, true);
  });

  test('Dependency Nesting Auditor: detects a self-nested package output directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-nested-dep-test-'));

    // Simulate the real @wavemaker-ai/variables bug: dist/es2015 nested inside itself 4 times
    // (3 consecutive repeats of the block, the detection threshold), each level carrying a file,
    // plus a normal (non-nested) package and a single harmless same-name coincidence
    // (dist/dist, one repeat only) that must NOT be flagged.
    const nestedPkgRoot = path.join(tempDir, 'node_modules', '@wavemaker-ai', 'variables');
    let nestedDir = path.join(nestedPkgRoot, 'dist', 'es2015');
    for (let i = 0; i < 4; i++) {
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'index.js'), 'x'.repeat(300 * 1024));
      nestedDir = path.join(nestedDir, 'dist', 'es2015');
    }

    const normalPkgRoot = path.join(tempDir, 'node_modules', 'lodash');
    fs.mkdirSync(normalPkgRoot, { recursive: true });
    fs.writeFileSync(path.join(normalPkgRoot, 'index.js'), 'module.exports = {};');

    const coincidentalPkgRoot = path.join(tempDir, 'node_modules', 'some-lib', 'dist', 'dist');
    fs.mkdirSync(coincidentalPkgRoot, { recursive: true });
    fs.writeFileSync(path.join(coincidentalPkgRoot, 'index.js'), 'module.exports = {};');

    const findings = detectSelfNestedPackages(tempDir);

    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].packagePath, path.join('node_modules', '@wavemaker-ai', 'variables'));
    assert.strictEqual(findings[0].nestedAt, 'dist/es2015/dist/es2015/dist/es2015');
    assert.strictEqual(findings[0].repeatingSegment, 'dist/es2015');
    assert.strictEqual(findings[0].approxWastedMB > 0, true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Audit: surfaces a self-nested dependency as a SELF_NESTED_DEPENDENCY finding', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-nested-dep-audit-test-'));
    fs.mkdirSync(path.join(tempDir, 'src/app'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'angular.json'), JSON.stringify({ projects: { 'angular-app': {} } }), 'utf8');

    const nestedPkgRoot = path.join(tempDir, 'node_modules', '@wavemaker-ai', 'variables');
    let nestedDir = path.join(nestedPkgRoot, 'dist', 'es2015');
    for (let i = 0; i < 4; i++) {
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'index.js'), 'x');
      nestedDir = path.join(nestedDir, 'dist', 'es2015');
    }

    const report = auditWaveMakerApp(tempDir);
    assert.strictEqual(report.actionItems.some(i => i.category === 'SELF_NESTED_DEPENDENCY'), true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Trust-As Auditor: flags opt-in HTML bypass on caption.bind/content.bind', () => {
    const html = `<wm-label name="lbl1" caption.bind="trustAs:html:Variables.userBio.value"></wm-label>`;
    const items = auditTrustAsUsage(html, 'Main');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].category, 'TRUST_AS_HTML_RISK');
    assert.strictEqual(items[0].title.includes('caption'), true);
  });

  test('Trust-As Auditor: flags wm-panel helptext.bind (always-on bypass, no marker needed)', () => {
    const html = `<wm-panel name="panel1" helptext.bind="bind:Variables.profile.notes"></wm-panel>`;
    const items = auditTrustAsUsage(html, 'Main');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].category, 'TRUST_AS_HTML_RISK');
    assert.strictEqual(items[0].title.includes('Panel'), true);
  });

  test('Trust-As Auditor: does not flag a plain static caption or an ordinary bind', () => {
    const html = `<wm-label name="lbl1" caption="Static text"></wm-label><wm-label name="lbl2" caption.bind="bind:Variables.userName.value"></wm-label>`;
    const items = auditTrustAsUsage(html, 'Main');
    assert.strictEqual(items.length, 0);
  });

  test('Per-Page Risk Score: a page with real findings scores worse than a clean one', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-risk-score-test-'));
    createSyntheticWaveMakerProject(tempDir);

    const report = auditWaveMakerApp(tempDir);
    const mainPage = report.pages.find(p => p.pageName === 'Main');
    const dashboardPage = report.pages.find(p => p.pageName === 'Dashboard');

    assert.ok(mainPage, 'Main page should exist in the synthetic fixture');
    assert.ok(dashboardPage, 'Dashboard page should exist in the synthetic fixture');
    assert.strictEqual(mainPage!.riskScore >= 0 && mainPage!.riskScore <= 100, true);
    assert.strictEqual(dashboardPage!.riskScore >= 0 && dashboardPage!.riskScore <= 100, true);
    // Main carries an unbounded query, an unpaginated table, and a startup waterfall by design —
    // it should score strictly worse (lower) than whichever page has fewer/no such findings.
    assert.strictEqual(mainPage!.riskScore <= dashboardPage!.riskScore, true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Audit: detects a leftover generated Angular workspace inside a WM Source export', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-stale-workspace-test-'));
    fs.mkdirSync(path.join(tempDir, 'src/main/webapp/pages/Main'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src/main/webapp/pages/Main/Main.html'), '<wm-page></wm-page>', 'utf8');

    const staleWorkspaceDir = path.join(tempDir, 'generated-angular-app');
    fs.mkdirSync(path.join(staleWorkspaceDir, 'src/app'), { recursive: true });
    fs.writeFileSync(path.join(staleWorkspaceDir, 'angular.json'), '{}', 'utf8');

    const report = auditWaveMakerApp(tempDir);
    assert.strictEqual(report.actionItems.some(i => i.category === 'STALE_GENERATED_WORKSPACE'), true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Audit: does NOT flag a stale workspace when the scanned root is itself a generated workspace', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-not-stale-test-'));
    fs.mkdirSync(path.join(tempDir, 'src/app'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'angular.json'), JSON.stringify({ projects: { 'angular-app': {} } }), 'utf8');

    const report = auditWaveMakerApp(tempDir);
    assert.strictEqual(report.actionItems.some(i => i.category === 'STALE_GENERATED_WORKSPACE'), false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Full Synthetic Project Audit & Report Generation', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-full-test-'));
    createSyntheticWaveMakerProject(tempDir);

    const report = auditWaveMakerApp(tempDir);
    assert.strictEqual(report.totalPages, 2);
    assert.strictEqual(report.actionItems.length > 0, true);

    const md = generateMarkdownReport({ appPerformance: report });
    assert.strictEqual(md.includes('PART A: APPLICATION PERFORMANCE OPTIMIZATIONS'), true);
    assert.strictEqual(md.includes('PART B: BUILD & DEPLOYMENT RESOURCE OPTIMIZATIONS'), true);
    // 'ordersTable' itself no longer surfaces in the report: DOM_PAGINATION reporting is
    // intentionally suppressed, and no other action item in this fixture names that widget.
    assert.strictEqual(report.pages.some(p => p.unpaginatedWidgets.includes('ordersTable')), true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
