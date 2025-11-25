# How to Fix Build Errors

## Problem Summary
The build fails because TypeScript path mappings point to `libraries/components/base` which doesn't exist until ng-packagr builds it. This creates a circular dependency issue.

## Root Cause
1. `tsconfig.json` has path mappings pointing to `libraries/components/base`
2. The `libraries/` directory doesn't exist until libraries are built
3. TypeScript compilation fails when trying to resolve `@wm/components/base`
4. This prevents ng-packagr from building the library

## Solution

### Option 1: Build in Stages (Recommended)
The build script already handles this correctly with `ngPackagrBuild` function which builds each library separately. The issue is likely that all TypeScript files are being type-checked at once.

**Fix:** Ensure ng-packagr builds each library in isolation:

```bash
# Build core libraries first (these don't depend on components)
./node_modules/.bin/ng-packagr -p projects/core/ng-package.json -c ./projects/core/tsconfig.lib.prod.json
./node_modules/.bin/ng-packagr -p projects/transpiler/ng-package.json -c ./projects/transpiler/tsconfig.lib.prod.json
./node_modules/.bin/ng-packagr -p projects/swipey/ng-package.json -c ./projects/swipey/tsconfig.lib.prod.json

# Build components-base (this must build successfully before other components)
./node_modules/.bin/ng-packagr -p projects/components/base/ng-package.json -c ./projects/components/base/tsconfig.lib.prod.json

# Then build other component libraries that depend on components-base
./node_modules/.bin/ng-packagr -p projects/components/widgets/input/base-form/ng-package.json -c ./projects/components/widgets/input/base-form/tsconfig.lib.prod.json
```

### Option 2: Add Source Path Mappings (Alternative)
Add path mappings in library tsconfig files to point to source files during compilation:

In `projects/components/widgets/input/base-form/tsconfig.lib.prod.json`:
```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "paths": {
      "@wm/components/base": ["../../base/src/public_api"]
    }
  }
}
```

However, this approach is complex and may cause other issues.

### Option 3: Fix Build Script (Best Long-term Solution)
Modify the build script to ensure libraries are built in the correct order and handle missing dependencies gracefully:

1. Check if library exists before building dependent libraries
2. Use ng-packagr's internal dependency resolution
3. Build libraries one at a time, waiting for each to complete

## Quick Fix Commands

Try building just components-base first:
```bash
cd /Users/bhargavig_500297/projects/wavemaker-studio-frontend/wavemaker-ng-runtime
./node_modules/.bin/ng-packagr -p projects/components/base/ng-package.json -c ./projects/components/base/tsconfig.lib.prod.json
```

If that succeeds, check if the library was created:
```bash
ls -la libraries/components/base/
```

If it exists, try the full build again:
```bash
sh build.sh -f
```

## If Components-Base Build Fails

Check for actual TypeScript errors:
```bash
./node_modules/.bin/tsc -p projects/components/base/tsconfig.lib.prod.json --noEmit 2>&1 | grep "error TS" | head -20
```

Common issues:
1. Missing imports
2. Circular dependencies
3. Type mismatches
4. Missing type definitions

## Expected Behavior

After fixing, the build should:
1. Build core libraries (core, transpiler, swipey, etc.) ✓
2. Build components-base ✓
3. Build component libraries that depend on components-base ✓
4. Build runtime-base and runtime-dynamic ✓
5. Build UMD bundles with Rollup ✓


