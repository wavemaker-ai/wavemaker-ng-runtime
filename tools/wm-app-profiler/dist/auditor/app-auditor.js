import fs from 'fs';
import path from 'path';
import { auditPageTemplate } from './page-template-auditor.js';
import { auditVariablesJson } from './variable-auditor.js';
import { auditPageScript } from './page-script-auditor.js';
import { auditDuplication } from './duplication-auditor.js';
import { auditPageImages, auditDeadPageNames } from './image-auditor.js';
import { auditPageStructure } from './structural-auditor.js';
import { scanServiceOperationSizeParams } from './service-def-scanner.js';
/**
 * Replaces the old `100 - 12*criticals - 5*warnings, clamped to [0,100]` formula, which had a real
 * problem reported directly by a user: it collapses to a flat 0 for almost any real project (past
 * ~9 criticals or ~20 warnings alone) and, once there, is completely insensitive to further
 * change — a patch that measurably reduced warnings (e.g. 4750 -> 4593, a genuine ~3% cut) still
 * showed "0/100 -> 0/100", making it look like the patch did nothing even though it did.
 *
 * This version does two things differently: (1) normalizes by page count, so a big project isn't
 * penalized just for having more surface area to scan — an issue-per-page density is what's
 * actually comparable across projects of different sizes (the same normalization already used for
 * the "Findings Rate Per Page" report table); (2) uses a smooth reciprocal decay
 * (`100 / (1 + density)`) instead of a hard linear subtraction with a floor — it asymptotically
 * approaches but never truly flattens at 0, so any real reduction in issues is always reflected,
 * even for a project with thousands of findings. Kept to one decimal place specifically so a small
 * real improvement (like the 3% warning reduction above) doesn't get rounded away to "no change".
 */
function computeHealthScore(actionItems, totalPages) {
    let weighted = 0;
    for (const item of actionItems) {
        if (item.severity === 'CRITICAL')
            weighted += 3;
        else if (item.severity === 'WARNING')
            weighted += 1;
        else
            weighted += 0.3;
    }
    const density = weighted / Math.max(totalPages, 1);
    const score = 100 / (1 + density);
    return Math.round(score * 10) / 10;
}
import { auditVariableReuse } from './variable-reuse-auditor.js';
import { auditIndexHtml, auditRenderBlockingCss } from './index-html-auditor.js';
import { detectSelfNestedPackages } from './dependency-nesting-auditor.js';
import { auditTrustAsUsage } from './trust-as-auditor.js';
/**
 * A *generated* Angular workspace (ng-codegen output) has `angular.json` plus a
 * component-based `src/app` tree; the original WM Source project instead lays pages out
 * under `src/main/webapp`. Widget-tag-based Part A checks only understand the Source dialect.
 */
export function isGeneratedAngularWorkspace(projectRoot) {
    const resolvedRoot = path.resolve(projectRoot);
    return fs.existsSync(path.join(resolvedRoot, 'angular.json')) && fs.existsSync(path.join(resolvedRoot, 'src/app'));
}
export function auditWaveMakerApp(projectRoot) {
    const resolvedRoot = path.resolve(projectRoot);
    const projectName = path.basename(resolvedRoot);
    const generatedAngularWorkspace = isGeneratedAngularWorkspace(resolvedRoot);
    // If the project root itself can't be read (permission-restricted, etc.), every scan below
    // will silently find nothing — 0 pages, 0 widgets, a "clean" 100/100 score. That's actively
    // misleading: it looks identical to a genuinely trivial project. Detect it up front and mark
    // the report clearly instead of quietly lying about "no issues found".
    let rootReadError;
    try {
        fs.readdirSync(resolvedRoot);
    }
    catch (err) {
        rootReadError = err?.message || String(err);
    }
    // Helper to find directories (handles both WM Source and generated Angular app)
    function findDirectories(dir, targetNames, depth = 0) {
        if (depth > 4)
            return [];
        const results = [];
        // Check immediate well-known locations first
        for (const name of targetNames) {
            const p1 = path.join(dir, 'src/main/webapp', name);
            if (fs.existsSync(p1))
                results.push(p1);
            const p2 = path.join(dir, 'src/app', name);
            if (fs.existsSync(p2))
                results.push(p2);
            const p3 = path.join(dir, name);
            if (fs.existsSync(p3))
                results.push(p3);
        }
        if (results.length > 0)
            return Array.from(new Set(results));
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
                    const sub = path.join(dir, entry.name);
                    // Real client exports commonly ship a stale `generated-angular-app`/similar build
                    // artifact sitting right next to the WM Source project (confirmed on a real project:
                    // src/main/webapp/pages had 138 real pages, and a colocated generated-angular-app/
                    // src/app/pages had 60 more — the SAME pages, regenerated, under a different dialect).
                    // Recursing into it double-audits every page it contains: once correctly from the real
                    // source, once again from the stale generated copy (whose .component.script.js/.variables.ts
                    // files are real enough to pass every file-lookup check here), inflating totalPages and
                    // corrupting the cross-page duplication check (which would see the same page's JS twice
                    // and report it as "duplicated across 2 pages"). Skip any subtree that is itself a
                    // generated Angular workspace root, the same way node_modules/dist are skipped above.
                    if (isGeneratedAngularWorkspace(sub))
                        continue;
                    const found = findDirectories(sub, targetNames, depth + 1);
                    results.push(...found);
                }
            }
        }
        catch { }
        return Array.from(new Set(results));
    }
    // Real WM Source resource paths (backgroundimage="resources/images/...") are relative to this
    // root. Only meaningful for the WM Source dialect, same scoping as every other Part A check.
    const webappRoot = path.join(resolvedRoot, 'src/main/webapp');
    const hasWebappRoot = fs.existsSync(webappRoot);
    // Computed once, used by every QUERY_OVERFETCH check below to tell "maxResults genuinely works
    // on this ServiceVariable" apart from "the underlying operation has no size param at all" —
    // see service-def-scanner.ts for why this distinction matters.
    const operationSizeParamMap = scanServiceOperationSizeParams(resolvedRoot);
    const pageDirs = findDirectories(resolvedRoot, ['pages']);
    const partialDirs = findDirectories(resolvedRoot, ['partials', 'prefabs']);
    const pageDetails = [];
    const allActionItems = [];
    // Collected across both the page scan and the partial/prefab scan below, then handed once to
    // auditDuplication() after both loops finish — that check is inherently project-wide (it
    // compares content ACROSS sources), so it can't run per-folder the way every other check here does.
    const duplicationSources = [];
    const variableReuseSources = [];
    let anyChartsFound = false;
    let anyRichTextFound = false;
    let anyTreeFound = false;
    let totalWidgets = 0;
    let totalVariables = 0;
    // Process a folder containing page or partial subdirectories. Real projects can contain
    // unreadable entries (permission-restricted directories, broken symlinks, OS cruft) — one bad
    // subfolder should be skipped, not crash the whole audit with an uncaught EPERM/EACCES.
    function processFolder(folderPath, isPartial = false) {
        if (!fs.existsSync(folderPath))
            return;
        let subfolders;
        try {
            subfolders = fs
                .readdirSync(folderPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        }
        catch {
            return;
        }
        for (const name of subfolders) {
            try {
                let itemDir = path.join(folderPath, name);
                // A real Studio-exported prefab (WEB-INF/prefabs/<PrefabName>) doesn't lay its page files
                // directly under <PrefabName>/ — its one entry page (always named "Main") lives 3 levels
                // deeper at <PrefabName>/webapp/pages/Main/. Without this redirect, every prefab's html/
                // variables/script lookups below silently find nothing (0 widgets, 0 variables) and every
                // prefab in the project goes completely unaudited — confirmed on a real 207-prefab export
                // where every single "[Partial] <PrefabName>" row came back empty. `name` is kept as the
                // prefab's own folder name for labeling (pageDetails/action items), even though the actual
                // file inside is named "Main.*" — every prefab's inner page is literally named "Main", so
                // relabeling to that would make every prefab's findings indistinguishable from each other.
                const prefabMainDir = path.join(itemDir, 'webapp', 'pages', 'Main');
                if (isPartial && fs.existsSync(prefabMainDir)) {
                    itemDir = prefabMainDir;
                }
                // Locate HTML template (.html or .component.html)
                let htmlPath = path.join(itemDir, `${name}.html`);
                if (!fs.existsSync(htmlPath)) {
                    htmlPath = path.join(itemDir, `${name}.component.html`);
                }
                if (!fs.existsSync(htmlPath)) {
                    const htmls = fs.readdirSync(itemDir).filter(f => f.endsWith('.html'));
                    if (htmls.length > 0)
                        htmlPath = path.join(itemDir, htmls[0]);
                }
                // Locate Variables (.variables.json or .component.variables.ts)
                let varPath = path.join(itemDir, `${name}.variables.json`);
                if (!fs.existsSync(varPath)) {
                    varPath = path.join(itemDir, `${name}.component.variables.ts`);
                }
                if (!fs.existsSync(varPath)) {
                    const vars = fs.readdirSync(itemDir).filter(f => f.includes('variables'));
                    if (vars.length > 0)
                        varPath = path.join(itemDir, vars[0]);
                }
                // Locate Script (.js or .component.script.js)
                let jsPath = path.join(itemDir, `${name}.js`);
                if (!fs.existsSync(jsPath)) {
                    jsPath = path.join(itemDir, `${name}.component.script.js`);
                }
                if (!fs.existsSync(jsPath)) {
                    const scripts = fs.readdirSync(itemDir).filter(f => f.includes('script.js') || (f.endsWith('.js') && !f.includes('spec')));
                    if (scripts.length > 0)
                        jsPath = path.join(itemDir, scripts[0]);
                }
                // Locate CSS (.css or .component.css)
                let cssPath = path.join(itemDir, `${name}.css`);
                if (!fs.existsSync(cssPath)) {
                    cssPath = path.join(itemDir, `${name}.component.css`);
                }
                if (!fs.existsSync(cssPath)) {
                    const cssFiles = fs.readdirSync(itemDir).filter(f => f.endsWith('.css'));
                    if (cssFiles.length > 0)
                        cssPath = path.join(itemDir, cssFiles[0]);
                }
                const htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
                const varContent = fs.existsSync(varPath) ? fs.readFileSync(varPath, 'utf8') : '';
                const jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
                const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
                // Audit HTML Template
                const templateAudit = auditPageTemplate(htmlContent, name);
                totalWidgets += templateAudit.widgetCount;
                if (templateAudit.widgetsPresent.charts)
                    anyChartsFound = true;
                if (templateAudit.widgetsPresent.richText)
                    anyRichTextFound = true;
                if (templateAudit.widgetsPresent.tree)
                    anyTreeFound = true;
                // Audit Script first so its declared function names are available to check whether
                // variables' onError handlers actually point at something real.
                const scriptAudit = auditPageScript(jsContent, name);
                // Audit Variables
                const variableAudit = auditVariablesJson(varContent, name, scriptAudit.declaredFunctionNames, operationSizeParamMap);
                totalVariables += variableAudit.totalVariables;
                allActionItems.push(...templateAudit.actionItems);
                allActionItems.push(...variableAudit.actionItems);
                allActionItems.push(...scriptAudit.actionItems);
                // Combined payload weight for this page — a known contributor to FCP/LCP, since all of
                // it must download, parse and compile before the page is usable.
                const fileSizesBytes = {
                    html: Buffer.byteLength(htmlContent, 'utf8'),
                    script: scriptAudit.scriptSizeBytes,
                    variablesJson: Buffer.byteLength(varContent, 'utf8')
                };
                const combinedPayloadBytes = fileSizesBytes.html + fileSizesBytes.script + fileSizesBytes.variablesJson;
                if (combinedPayloadBytes > 1_500_000) {
                    allActionItems.push({
                        id: `${name}_OVERSIZED_PAYLOAD`,
                        category: 'OVERSIZED_PAYLOAD',
                        severity: 'CRITICAL',
                        page: name,
                        title: `Oversized Page Payload (${(combinedPayloadBytes / 1_000_000).toFixed(2)} MB)`,
                        issueDescription: `Page '${name}''s combined HTML + script + variables.json weighs ${(combinedPayloadBytes / 1_000_000).toFixed(2)} MB. All of this must be downloaded, parsed and compiled before the page is usable, directly delaying First/Largest Contentful Paint.`,
                        studioFix: {
                            location: `Studio Canvas -> Page '${name}'`,
                            stepByStep: [
                                `Split this page's markup/logic into smaller pages or partials loaded on demand.`,
                                `Move rarely-used variables/widgets (e.g. behind a dialog or a tab that isn't open by default) out of this page's initial payload.`
                            ]
                        }
                    });
                }
                else if (combinedPayloadBytes > 500_000) {
                    allActionItems.push({
                        id: `${name}_OVERSIZED_PAYLOAD`,
                        category: 'OVERSIZED_PAYLOAD',
                        severity: 'WARNING',
                        page: name,
                        title: `Large Page Payload (${(combinedPayloadBytes / 1_000_000).toFixed(2)} MB)`,
                        issueDescription: `Page '${name}''s combined HTML + script + variables.json weighs ${(combinedPayloadBytes / 1_000_000).toFixed(2)} MB, on the high side for a single page.`,
                        studioFix: {
                            location: `Studio Canvas -> Page '${name}'`,
                            stepByStep: [`Review whether this page's markup/logic could be split so less needs to download before first paint.`]
                        }
                    });
                }
                const pageLabel = isPartial ? `[Partial] ${name}` : name;
                duplicationSources.push({ name: pageLabel, html: htmlContent, js: jsContent, css: cssContent });
                variableReuseSources.push({ name: pageLabel, variablesContent: varContent });
                if (hasWebappRoot) {
                    allActionItems.push(...auditPageImages(htmlContent, pageLabel, webappRoot));
                }
                allActionItems.push(...auditPageStructure(htmlContent, pageLabel));
                allActionItems.push(...auditTrustAsUsage(htmlContent, pageLabel));
                pageDetails.push({
                    pageName: pageLabel,
                    filePath: htmlPath,
                    widgetCount: templateAudit.widgetCount,
                    maxDomDepth: templateAudit.maxDomDepth,
                    unpaginatedWidgets: templateAudit.unpaginatedWidgets,
                    widgetsPresent: templateAudit.widgetsPresent,
                    variables: {
                        total: variableAudit.totalVariables,
                        startupCount: variableAudit.startupCount,
                        unboundedCount: variableAudit.unboundedCount
                    },
                    scriptIssues: {
                        leakingTimers: scriptAudit.leakingTimers,
                        detachedListeners: scriptAudit.detachedListeners,
                        directDomQueries: scriptAudit.directDomQueries,
                        debuggerStatements: scriptAudit.debuggerStatements
                    },
                    dialogCount: templateAudit.dialogCount,
                    bindingExpressionCount: templateAudit.bindingExpressionCount,
                    nestedRepeaterCount: templateAudit.nestedRepeaterCount,
                    expensiveRowBindingCount: templateAudit.expensiveRowBindingCount,
                    inactivePaneEagerLoadCount: templateAudit.inactivePaneEagerLoadCount,
                    riskScore: 0, // filled in below, once every page's action items across the whole scan are known
                    fileSizesBytes
                });
            }
            catch {
                // Skip this one subfolder (e.g. permission-denied) and keep auditing the rest.
            }
        }
    }
    // Scan all page directories
    for (const dir of pageDirs) {
        processFolder(dir, false);
    }
    // Scan all partial/prefab directories
    for (const dir of partialDirs) {
        processFolder(dir, true);
    }
    // Project-wide duplicated HTML/JS/CSS check — must run after both loops above have populated
    // duplicationSources, since it compares content ACROSS every page/prefab at once.
    const duplicationResult = auditDuplication(duplicationSources);
    allActionItems.push(...auditVariableReuse(variableReuseSources).actionItems);
    allActionItems.push(...duplicationResult.actionItems);
    // Project-wide dead/backup-page-name check — same reasoning, runs once over every collected
    // page/partial name rather than per-folder.
    allActionItems.push(...auditDeadPageNames(pageDetails.map(p => p.pageName)));
    // Audit App-level script (App.js / app.component.script.js) if present. Read before the
    // app-level variables below so its declared function names are available to check whether
    // an app-level variable's onError handler actually points at something real — mirroring the
    // per-page ordering above.
    // index.html is a project-level file, entirely separate from any individual page's own
    // markup/script — patching it (or just reporting on it) never touches page-level widget code.
    const indexHtmlLocations = [
        path.join(resolvedRoot, 'src/main/webapp/index.html'),
        path.join(resolvedRoot, 'index.html')
    ];
    for (const indexHtmlPath of indexHtmlLocations) {
        if (fs.existsSync(indexHtmlPath)) {
            try {
                const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
                allActionItems.push(...auditIndexHtml(indexHtmlContent));
                allActionItems.push(...auditRenderBlockingCss(indexHtmlContent));
            }
            catch {
                // Permission-restricted or otherwise unreadable — skip rather than crash the audit.
            }
            break;
        }
    }
    const appJsLocations = [
        path.join(resolvedRoot, 'src/main/webapp/App.js'),
        path.join(resolvedRoot, 'src/main/webapp/app.js'),
        path.join(resolvedRoot, 'src/app/app.component.script.js'),
        path.join(resolvedRoot, 'app.js')
    ];
    let appDeclaredFunctionNames = [];
    for (const appJsPath of appJsLocations) {
        if (fs.existsSync(appJsPath)) {
            try {
                const appScriptAudit = auditPageScript(fs.readFileSync(appJsPath, 'utf8'), 'App (Global)');
                allActionItems.push(...appScriptAudit.actionItems);
                appDeclaredFunctionNames = appScriptAudit.declaredFunctionNames;
            }
            catch {
                // Permission-restricted or otherwise unreadable — skip rather than crash the audit.
            }
            break;
        }
    }
    // Audit App-level variables if present
    const appVarLocations = [
        path.join(resolvedRoot, 'src/main/webapp/app.variables.json'),
        path.join(resolvedRoot, 'src/app/app.component.variables.ts'),
        path.join(resolvedRoot, 'app.variables.json')
    ];
    for (const appVarPath of appVarLocations) {
        if (fs.existsSync(appVarPath)) {
            try {
                const appVarAudit = auditVariablesJson(fs.readFileSync(appVarPath, 'utf8'), 'App (Global)', appDeclaredFunctionNames, operationSizeParamMap);
                allActionItems.push(...appVarAudit.actionItems);
                totalVariables += appVarAudit.totalVariables;
            }
            catch {
                // Permission-restricted or otherwise unreadable — skip rather than crash the audit.
            }
            break;
        }
    }
    // Inspect angular.json if present in project to see what scripts are actually bundled.
    // ng-codegen's own update-angular-json.js already marks several heavy libraries (d3, nvd3,
    // summernote, the table widget's datatable.js, jquery-ui sortable/droppable/resizable,
    // hammerjs, iscroll) as inject:false/bundleName — Angular CLI still builds them, but does NOT
    // inject a <script> tag for them into index.html; the generated app fetches each one on
    // demand per-page instead (see pages-util.js's getRequiredScripts -> scripts-to-load attribute).
    // zTree is NOT in that lazy list, so it's still injected unconditionally regardless of usage.
    // A library already marked inject:false costs nothing at runtime if unused (never fetched) —
    // only build time/output size — so it shouldn't be reported as a page-load/FCP win the same
    // way a still-eagerly-injected one would be.
    let angularJsonScripts = [];
    const angularJsonLazyScripts = new Set();
    const angularJsonPath = path.join(resolvedRoot, 'angular.json');
    if (fs.existsSync(angularJsonPath)) {
        try {
            const aj = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
            const projects = aj.projects || {};
            const firstProject = Object.keys(projects)[0];
            const scripts = projects[firstProject]?.architect?.build?.options?.scripts || [];
            angularJsonScripts = scripts.map((s) => (typeof s === 'string' ? s : s?.input || ''));
            for (const s of scripts) {
                if (s && typeof s === 'object' && s.inject === false && s.input) {
                    angularJsonLazyScripts.add(s.input);
                }
            }
        }
        catch { }
    }
    const hasAngularJson = angularJsonScripts.length > 0;
    // Two build-config issues `patch`'s optimizeWebpackAndBuildConfigs auto-fixes but which, until
    // now, had no corresponding audit finding at all — invisible to any client who only runs
    // `audit` and never `patch`. Mirrors the exact same `!== false` checks patch itself uses.
    if (fs.existsSync(angularJsonPath)) {
        try {
            const aj = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
            const projects = aj.projects || {};
            const firstProject = Object.keys(projects)[0];
            const prodConfig = projects[firstProject]?.architect?.build?.configurations?.production;
            if (prodConfig) {
                if (prodConfig.sourceMap !== false) {
                    allActionItems.push({
                        id: 'BUILD_VENDOR_SOURCEMAPS_ENABLED',
                        category: 'VENDOR_SOURCEMAPS_ENABLED',
                        severity: 'WARNING',
                        page: 'App (Global)',
                        title: 'Vendor Source Maps Enabled in Production Build',
                        issueDescription: `The production build's \`sourceMap\` config is not explicitly set to \`false\` for vendor code. Generating source maps for the full node_modules dependency tree holds significantly more source content in memory during the build (on top of whatever the compiler already holds), and ships extra debug files into the production bundle.`,
                        studioFix: {
                            location: `angular.json -> projects -> architect.build.configurations.production`,
                            stepByStep: [
                                `Set "sourceMap": { "scripts": false, "styles": false, "vendor": false, "hidden": false } (or simply "sourceMap": false) in the production build configuration.`
                            ]
                        }
                    });
                }
                if (prodConfig.extractLicenses !== false) {
                    allActionItems.push({
                        id: 'BUILD_LICENSE_EXTRACTION_ENABLED',
                        category: 'LICENSE_EXTRACTION_ENABLED',
                        severity: 'INFO',
                        page: 'App (Global)',
                        title: 'License Extraction Enabled in Production Build',
                        issueDescription: `The production build's \`extractLicenses\` is not set to \`false\`. This walks every bundled module's source looking for license banners to assemble a single \`3rdpartylicenses.txt\`, while the compiler already holds the full module graph in memory — avoidable overhead with no functional benefit beyond that one generated file.`,
                        studioFix: {
                            location: `angular.json -> projects -> architect.build.configurations.production`,
                            stepByStep: [
                                `Set "extractLicenses": false in the production build configuration.`
                            ]
                        }
                    });
                }
            }
            // `@angular/build`'s persistent disk cache (`.angular/cache`) defaults to
            // `cli.cache.environment: 'local'`, under which `cacheEnabled = !isCI` — the cache is
            // silently disabled the instant a build runs under `CI=true`, even with a warm cache
            // already on disk. Measured directly (5,049-widget project, cold cache, warm cache
            // present under both conditions): CI default (cache ignored) 88s/2868MB peak RSS vs
            // `environment: 'all'` (cache used) 40s/2491MB — 54% faster, 13% less RAM. Mirrors the
            // exact `!== 'all'` check `patch`'s optimizeWebpackAndBuildConfigs uses.
            if (aj.cli?.cache?.environment !== 'all') {
                allActionItems.push({
                    id: 'BUILD_CI_CACHE_DISABLED',
                    category: 'CI_BUILD_CACHE_DISABLED',
                    severity: 'WARNING',
                    page: 'App (Global)',
                    title: 'Persistent Build Cache Not Enabled Under CI',
                    issueDescription: `\`angular.json\`'s \`cli.cache.environment\` is not set to \`'all'\`. Angular's persistent \`.angular/cache\` disk cache defaults to environment \`'local'\`, which disables itself whenever \`CI=true\` is set — the normal case in real CI pipelines — even if a warm cache from a previous run already exists on disk. Measured on a 5,049-widget project: 88s/2868MB peak RSS (CI default) vs 40s/2491MB (fixed) — a 54% build-time and 13% peak-RAM reduction, provided the CI pipeline actually persists \`.angular/cache\` between runs (most workspace-per-run CI setups don't, in which case this is a no-op rather than a regression).`,
                    studioFix: {
                        location: `angular.json (top level, alongside "projects")`,
                        stepByStep: [
                            `Set "cli": { "cache": { "environment": "all" } } in angular.json.`,
                            `Confirm the CI pipeline persists .angular/cache between runs (e.g. keyed on the lockfile hash) — the config change alone does nothing if the workspace is wiped every run.`
                        ]
                    }
                });
            }
        }
        catch { }
    }
    // A dependency (installed via npm or linked via `.yalc`) whose own build output directory
    // recursively nests itself — see dependency-nesting-auditor.ts for the exact real bug this is
    // modeled on (`@wavemaker-ai/variables`'s `dist/es2015` nesting 14 levels deep, 406MB of pure
    // duplication in one package). Harmless to the build's own correctness (the compiler only ever
    // resolves the package's declared entry point, never the stray nested copies) but real disk/
    // install-time/CI-cache-transfer bloat, and a symptom of a build pipeline that will keep
    // compounding this on every publish until its own clean-step gap is fixed upstream.
    for (const finding of detectSelfNestedPackages(resolvedRoot)) {
        allActionItems.push({
            id: `DEP_SELF_NESTED_${finding.packagePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            category: 'SELF_NESTED_DEPENDENCY',
            severity: 'WARNING',
            page: 'App (Global)',
            title: `Self-Nested Package Output: ${finding.packagePath}`,
            issueDescription: `\`${finding.packagePath}\` recursively nests its own build output inside itself, starting at \`${finding.nestedAt}\` (the \`${finding.repeatingSegment}\` path repeats). This is harmless to what the build actually resolves (only the package's declared entry point is ever read) but wastes an estimated ~${finding.approxWastedMB} MB of disk and inflates install/CI-cache-transfer time. It's a symptom of that package's own build pipeline using its output directory as both the compiler's outDir and its publish source with no clean step in between — whatever was already there from a prior build/publish cycle gets copied into itself and compounds indefinitely.`,
            studioFix: {
                location: `${finding.packagePath}/${finding.nestedAt}`,
                stepByStep: [
                    `Delete the nested copy at ${finding.packagePath}/${finding.nestedAt} (everything from the second occurrence of "${finding.repeatingSegment}" onward) and reinstall/re-link the package fresh.`,
                    `Fix it at the source: add a clean step (e.g. remove the build output directory) before that package's own build/publish step so this can't recur on the next release.`
                ]
            }
        });
    }
    // A leftover, previously-generated Angular workspace sitting inside a WM Source project export
    // (e.g. a stale `generated-angular-app/` folder next to `src/main/webapp`) is pure build output
    // waiting to be regenerated — often a full node_modules-sized copy — and `patch`'s own
    // source-patcher already silently skips scanning inside one specifically to avoid double-
    // counting its files against the real source (see patchWaveMakerSourceProject's findFiles).
    // Surface that same fact as an actual finding instead of only acting on it silently, so a
    // developer knows it's there and safe to delete. Only meaningful when auditing WM Source itself
    // — a generated workspace nested inside another generated workspace isn't a real scenario.
    if (!generatedAngularWorkspace) {
        const staleWorkspaces = [];
        (function findNestedGeneratedWorkspaces(dir, depth) {
            if (depth > 6)
                return;
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git')
                    continue;
                const full = path.join(dir, entry.name);
                if (isGeneratedAngularWorkspace(full)) {
                    staleWorkspaces.push(full);
                    continue; // don't descend further into it — nothing more to learn, and it may be huge
                }
                findNestedGeneratedWorkspaces(full, depth + 1);
            }
        })(resolvedRoot, 0);
        for (const stalePath of staleWorkspaces) {
            const relPath = path.relative(resolvedRoot, stalePath);
            allActionItems.push({
                id: `STALE_WORKSPACE_${relPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                category: 'STALE_GENERATED_WORKSPACE',
                severity: 'WARNING',
                page: 'App (Global)',
                title: `Leftover Generated Angular Workspace: ${relPath}`,
                issueDescription: `'${relPath}' looks like a previously-generated Angular workspace (has angular.json + src/app) sitting inside this WM Source project export. It's build output waiting to be regenerated from source — safe to delete, and actively wasteful to keep around: it's often a full node_modules-sized copy, and this tool's own 'patch' command already skips scanning inside it specifically to avoid double-counting its files against the real source.`,
                studioFix: {
                    location: relPath,
                    stepByStep: [
                        `Delete '${relPath}' — it will be regenerated by ng-codegen from the real WM Source project whenever you next build/deploy.`,
                        `If it needs to be kept for some reason, exclude it from future project exports so it doesn't ship alongside the source.`
                    ]
                }
            });
        }
    }
    // Cross-reference heavy widgets to identify unused global libraries
    const unusedGlobalLibraries = [];
    const checkScriptPresence = (pattern) => {
        if (!hasAngularJson)
            return { present: true, alreadyLazy: false }; // no angular.json (e.g. source project) -> assume default runtime bundle
        const matched = angularJsonScripts.find(s => s.includes(pattern));
        if (!matched)
            return { present: false, alreadyLazy: false };
        return { present: true, alreadyLazy: angularJsonLazyScripts.has(matched) };
    };
    const d3Presence = checkScriptPresence('d3');
    if (!anyChartsFound && d3Presence.present) {
        unusedGlobalLibraries.push({
            libraryName: 'D3 & NVD3 Charts',
            scriptFile: 'd3/dist/d3.min.js & @wavemaker/nvd3/build/nv.d3.min.js',
            savedKB: 660,
            alreadyLazy: d3Presence.alreadyLazy
        });
    }
    const summernotePresence = checkScriptPresence('summernote');
    if (!anyRichTextFound && summernotePresence.present) {
        unusedGlobalLibraries.push({
            libraryName: 'Summernote RichText Editor',
            scriptFile: 'summernote/dist/summernote-lite.min.js',
            savedKB: 220,
            alreadyLazy: summernotePresence.alreadyLazy
        });
    }
    const ztreePresence = checkScriptPresence('ztree');
    if (!anyTreeFound && ztreePresence.present) {
        unusedGlobalLibraries.push({
            libraryName: 'zTree Library',
            alreadyLazy: ztreePresence.alreadyLazy,
            scriptFile: '@ztree/ztree_v3/js/jquery.ztree.all.js',
            savedKB: 140
        });
    }
    // Prefab usage cross-reference. Correction after re-verifying against the actual codegen/
    // runtime source: a prefab's component CODE is not more eagerly loaded than a partial's — both
    // go through the identical loadComponent: () => import(...) lazy mechanism (confirmed via
    // gen-lazy-module-routes.js and lazy-component-ref-provider.service.ts, which treats
    // PARTIAL/PREFAB identically). The real, verified overhead a partial doesn't carry is: (1) its
    // config gets registered eagerly at app bootstrap via initPrefabConfig() for every REFERENCED
    // prefab regardless of how many places use it; (2) it ships its own duplicated service-def JSON
    // rather than sharing the app's existing ones; (3) an extra prefab-specific DI/lifecycle layer
    // (PrefabDirective + PrefabContainerDirective, including a `propsReady` readiness gate) that a
    // plain compiled partial component doesn't have. That overhead is only worth paying when a
    // prefab is actually reused; on a real 207-prefab project, 183 (88%) turned out to be referenced
    // from exactly one place project-wide, and 5 were referenced nowhere at all — every one of those
    // pays the full prefab cost for zero (or no) actual reuse benefit, and would be lighter as a
    // partial (or removed entirely).
    let prefabOverheadSummary;
    const prefabDirRoots = partialDirs.filter(dir => path.basename(dir) === 'prefabs');
    if (prefabDirRoots.length > 0) {
        const prefabNames = new Set();
        for (const dir of prefabDirRoots) {
            try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    if (entry.isDirectory())
                        prefabNames.add(entry.name);
                }
            }
            catch { }
        }
        const usageCounts = new Map();
        for (const name of prefabNames)
            usageCounts.set(name, 0);
        function scanForPrefabUsages(dir, depth = 0) {
            if (depth > 15)
                return;
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                    continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanForPrefabUsages(full, depth + 1);
                }
                else if (entry.isFile() && entry.name.endsWith('.html')) {
                    try {
                        const content = fs.readFileSync(full, 'utf8');
                        const matches = content.matchAll(/\bprefabname\s*=\s*["']([^"']+)["']/g);
                        for (const m of matches) {
                            if (usageCounts.has(m[1]))
                                usageCounts.set(m[1], (usageCounts.get(m[1]) || 0) + 1);
                        }
                    }
                    catch { }
                }
            }
        }
        scanForPrefabUsages(resolvedRoot);
        let neverUsedCount = 0;
        let singleUseCount = 0;
        for (const count of usageCounts.values()) {
            if (count === 0)
                neverUsedCount++;
            else if (count === 1)
                singleUseCount++;
        }
        prefabOverheadSummary = {
            totalPrefabs: usageCounts.size,
            neverUsed: neverUsedCount,
            singleUse: singleUseCount,
            genuinelyReused: usageCounts.size - neverUsedCount - singleUseCount
        };
        for (const [prefabName, count] of usageCounts) {
            if (count === 0) {
                allActionItems.push({
                    id: `${prefabName}_PREFAB_UNUSED`,
                    category: 'PREFAB_OVERHEAD',
                    severity: 'CRITICAL',
                    page: `[Partial] ${prefabName}`,
                    title: `Prefab '${prefabName}' Is Never Used`,
                    issueDescription: `Prefab '${prefabName}' exists in the project but isn't referenced by any page or other prefab. It still ships its own duplicated service-defs and gets built, for zero actual usage.`,
                    studioFix: {
                        location: `Studio -> Prefabs -> '${prefabName}'`,
                        stepByStep: [
                            `Confirm '${prefabName}' is genuinely unused (not referenced dynamically by name).`,
                            `Remove it from the project, or convert it to a partial if it's still needed for a future single use.`
                        ]
                    }
                });
            }
            else if (count === 1) {
                allActionItems.push({
                    id: `${prefabName}_PREFAB_SINGLE_USE`,
                    category: 'PREFAB_OVERHEAD',
                    severity: 'WARNING',
                    page: `[Partial] ${prefabName}`,
                    title: `Prefab '${prefabName}' Used in Only One Place`,
                    issueDescription: `Prefab '${prefabName}' is referenced from exactly one place project-wide. A prefab's duplicated service-defs, eagerly-registered config, and extra prefab-specific DI/lifecycle layer only pay off when it's actually reused across multiple pages/apps — used once, it carries the full prefab overhead for no reuse benefit that a lighter partial wouldn't also give.`,
                    studioFix: {
                        location: `Studio -> Prefabs -> '${prefabName}'`,
                        stepByStep: [
                            `Confirm '${prefabName}' isn't intended for reuse in other projects/apps.`,
                            `If it's only ever needed here, convert it to a partial (Studio -> right-click the prefab -> Convert to Partial, or rebuild its markup as a partial) to drop the service-def duplication, config-registration, and DI/lifecycle overhead.`
                        ]
                    }
                });
            }
        }
    }
    // Per-page risk score: same formula as the project-wide score, scoped to just this page's own
    // action items. Computed once at the end, after every page/prefab/global check has finished
    // pushing into allActionItems, since findings for a given page can come from checks that only
    // run after the per-page loop above (duplication, prefab overhead, variable reuse, etc.).
    for (const page of pageDetails) {
        const pageItems = allActionItems.filter(item => item.page === page.pageName);
        page.riskScore = computeHealthScore(pageItems, 1);
    }
    const score = computeHealthScore(allActionItems, pageDetails.length);
    return {
        projectName,
        projectPath: resolvedRoot,
        analyzedAt: new Date().toISOString(),
        overallScore: score,
        totalPages: pageDetails.length,
        totalWidgets,
        totalVariables,
        rootReadError,
        actionItems: allActionItems,
        pages: pageDetails,
        isGeneratedAngularWorkspace: generatedAngularWorkspace,
        prefabOverheadSummary,
        unusedGlobalLibraries
    };
}
/**
 * Narrows a full-project report down to a single page (case-insensitive match against
 * `PageAuditDetail.pageName`, so it also matches a partial's `[Partial] Name` form). Recomputes
 * totals/score from just that page's data rather than reusing the whole-project numbers.
 * Returns `null` if no page matches, so the caller can list what page names were actually found.
 */
export function filterReportToPage(report, pageName) {
    const needle = pageName.trim().toLowerCase();
    const matchedPage = report.pages.find(p => p.pageName.toLowerCase() === needle || p.pageName.toLowerCase() === `[partial] ${needle}`);
    if (!matchedPage)
        return null;
    const actionItems = report.actionItems.filter(item => item.page.toLowerCase() === matchedPage.pageName.toLowerCase());
    const score = computeHealthScore(actionItems, 1);
    return {
        ...report,
        overallScore: score,
        totalPages: 1,
        totalWidgets: matchedPage.widgetCount,
        totalVariables: matchedPage.variables.total,
        actionItems,
        pages: [matchedPage]
    };
}
