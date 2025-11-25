#!/usr/bin/env node
/**
 * Script to analyze components and directives for potential memory leaks
 * Identifies files that need OnDestroy cleanup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all .component.ts and .directive.ts files
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and dist
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'coverage') {
                getAllFiles(filePath, fileList);
            }
        } else if (file.endsWith('.component.ts') || file.endsWith('.directive.ts')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Analyze a file for memory leak patterns
function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    const className = content.match(/export\s+(?:class|abstract\s+class)\s+(\w+)/)?.[1];
    if (!className) return null;
    
    const hasOnDestroy = /implements\s+.*OnDestroy|OnDestroy.*implements/.test(content) || 
                        content.includes('ngOnDestroy()');
    const hasViewChild = /@ViewChild|@ViewChildren|@ContentChild|@ContentChildren/.test(content);
    const hasSubscription = /\.subscribe\(|\.changes\.subscribe/.test(content);
    const hasEventListener = /addEventListener|window\.addEventListener|document\.addEventListener/.test(content);
    const hasRendererListen = /render2\.listen|renderer\.listen/i.test(content);
    const hasQueryList = /QueryList</.test(content);
    const hasViewContainerRef = /ViewContainerRef/.test(content);
    
    // Check if ngOnDestroy exists but might be missing cleanup
    let needsCleanup = false;
    if (hasOnDestroy) {
        const onDestroyMatch = content.match(/ngOnDestroy\([^)]*\)\s*{([^}]*)}/s);
        if (onDestroyMatch) {
            const destroyBody = onDestroyMatch[1];
            // Check if it's empty or only has super call
            if (!destroyBody.trim() || (destroyBody.trim() === 'super.ngOnDestroy();')) {
                if (hasViewChild || hasSubscription || hasEventListener || hasQueryList) {
                    needsCleanup = true;
                }
            }
        }
    }
    
    // Missing OnDestroy but has leak-prone patterns
    if (!hasOnDestroy && (hasViewChild || hasSubscription || hasEventListener || hasQueryList || hasViewContainerRef)) {
        issues.push('MISSING_ONDESTROY');
    }
    
    if (needsCleanup) {
        issues.push('NEEDS_CLEANUP');
    }
    
    if (hasViewChild && !content.includes('= null') && !hasOnDestroy) {
        issues.push('VIEWCHILD_NOT_CLEARED');
    }
    
    if (hasSubscription && !content.includes('unsubscribe') && !content.includes('cancelSubscription')) {
        issues.push('SUBSCRIPTION_NOT_UNSUBSCRIBED');
    }
    
    if ((hasEventListener || hasRendererListen) && !content.includes('removeEventListener')) {
        issues.push('EVENT_LISTENER_NOT_REMOVED');
    }
    
    return {
        file: filePath.replace(process.cwd() + '/', ''),
        className,
        hasOnDestroy,
        issues: issues.length > 0 ? issues : null,
        patterns: {
            hasViewChild,
            hasSubscription,
            hasEventListener,
            hasRendererListen,
            hasQueryList,
            hasViewContainerRef
        }
    };
}

// Main execution
const projectsDir = path.join(process.cwd(), 'projects');
const srcDir = path.join(process.cwd(), 'src');

let allFiles = [];

if (fs.existsSync(projectsDir)) {
    allFiles = getAllFiles(projectsDir);
}

if (fs.existsSync(srcDir)) {
    allFiles = allFiles.concat(getAllFiles(srcDir));
}

console.log(`Analyzing ${allFiles.length} files...\n`);

const results = allFiles
    .map(analyzeFile)
    .filter(result => result && result.issues && result.issues.length > 0)
    .sort((a, b) => {
        // Sort by priority: MISSING_ONDESTROY > NEEDS_CLEANUP > others
        const priorityA = a.issues.includes('MISSING_ONDESTROY') ? 0 : a.issues.includes('NEEDS_CLEANUP') ? 1 : 2;
        const priorityB = b.issues.includes('MISSING_ONDESTROY') ? 0 : b.issues.includes('NEEDS_CLEANUP') ? 1 : 2;
        return priorityA - priorityB;
    });

console.log(`Found ${results.length} files with potential memory leaks:\n`);

results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.file}`);
    console.log(`   Class: ${result.className}`);
    console.log(`   Issues: ${result.issues.join(', ')}`);
    console.log(`   Patterns: ${Object.entries(result.patterns).filter(([_, v]) => v).map(([k]) => k).join(', ')}\n`);
});

// Save results to file
const outputPath = path.join(process.cwd(), 'memory-leak-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults saved to: ${outputPath}`);

