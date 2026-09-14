import fs from 'fs';
import path from 'path';

export interface SelfNestedPackageFinding {
  /** Package root, relative to the scanned project root, e.g. "node_modules/@wavemaker-ai/variables". */
  packagePath: string;
  /** Path to the first detected repeat, relative to the package root, e.g. "dist/es2015/dist/es2015". */
  nestedAt: string;
  /** The repeating segment(s) themselves, e.g. "dist/es2015". */
  repeatingSegment: string;
  /** Approximate size (MB) of everything from the second occurrence onward — the wasted portion. */
  approxWastedMB: number;
}

const MAX_WALK_DEPTH = 40;
const MAX_DIRS_VISITED_PER_PACKAGE = 50000;
const MAX_FILES_FOR_SIZE_ESTIMATE = 20000;

/**
 * Sums file sizes under `dir`, capped so a pathologically large (already-anomalous) subtree can't
 * hang the audit — the point is a representative "~N MB wasted" figure, not an exact byte count.
 */
function sumSizeBytesCapped(dir: string, maxFiles = MAX_FILES_FOR_SIZE_ESTIMATE): number {
  let total = 0;
  let filesSeen = 0;
  const stack = [dir];
  while (stack.length > 0 && filesSeen < maxFiles) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        filesSeen++;
        try {
          total += fs.statSync(full).size;
        } catch {}
        if (filesSeen >= maxFiles) break;
      }
    }
  }
  return total;
}

/**
 * Checks whether `segments` (the path from a package's root down to the directory currently
 * being visited) ends in a 2-4 segment block repeated at least 3 times consecutively — e.g.
 * `dist/es2015` appearing three times in a row as `dist/es2015/dist/es2015/dist/es2015`.
 *
 * This is the exact shape of the real `@wavemaker-ai/variables` bug found in this investigation:
 * `dist/es2015` served as both `tsc`'s own outDir AND the directory a subsequent `yalc publish`
 * step read from and pushed into every consumer, with no clean step between builds — so whatever
 * was already sitting in `dist/es2015` from a prior cycle got copied into itself and compounded
 * indefinitely (grew one real package from ~7MB to 406MB, 14 levels deep). Any package with this
 * "own output dir doubles as its own publish source, no clean step" pattern can hit it, not just
 * that one.
 *
 * Deliberately requires BOTH a multi-segment block AND 3 consecutive repeats, not just 2 — a
 * single generic folder name nesting once (`dist/dist`, `types/types`, `docs/docs`, `fonts/fonts`)
 * is a common, harmless coincidence in real packages, confirmed by running an earlier
 * single-segment/single-repeat version of this check against this very repo's own
 * `node_modules`: it flagged exactly those four cases, none of which were the runaway-duplication
 * bug this exists to catch. A genuine "no clean step" bug compounds far beyond 2 repeats in
 * practice (the real incident hit 14), so requiring 3 is still comfortably sensitive to it while
 * filtering out one-off name collisions.
 */
function findRepeatingBlock(segments: string[]): { blockLen: number; block: string[] } | null {
  for (let blockLen = 2; blockLen <= 4; blockLen++) {
    const minLen = blockLen * 3;
    if (segments.length < minLen) continue;
    const third = segments.slice(-blockLen);
    const second = segments.slice(-blockLen * 2, -blockLen);
    const first = segments.slice(-blockLen * 3, -blockLen * 2);
    if (third.every((seg, i) => seg === second[i]) && second.every((seg, i) => seg === first[i])) {
      return { blockLen, block: third };
    }
  }
  return null;
}

/**
 * Walks one package's own directory tree looking for the first self-nesting repeat, then stops
 * descending into it (a self-similar subtree can be arbitrarily deep/huge — there's nothing more
 * to learn by continuing). Does not descend into a nested `node_modules` — that's a different
 * package's own tree (normal npm dependency nesting), out of scope for this check and covered
 * separately when that package is scanned as its own top-level entry.
 */
function scanPackageForSelfNesting(packageRoot: string): { nestedAt: string; repeatingSegment: string } | null {
  let dirsVisited = 0;

  function walk(currentDir: string, segments: string[]): { nestedAt: string; repeatingSegment: string } | null {
    if (segments.length > MAX_WALK_DEPTH || dirsVisited > MAX_DIRS_VISITED_PER_PACKAGE) return null;
    dirsVisited++;

    const repeat = findRepeatingBlock(segments);
    if (repeat) {
      return {
        nestedAt: segments.join('/'),
        repeatingSegment: repeat.block.join('/')
      };
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const found = walk(path.join(currentDir, entry.name), [...segments, entry.name]);
      if (found) return found;
    }
    return null;
  }

  return walk(packageRoot, []);
}

/** Lists real package root directories directly under a `node_modules`/`.yalc`-style container. */
function collectPackageRoots(containerDir: string): string[] {
  const roots: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(containerDir, { withFileTypes: true });
  } catch {
    return roots;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(containerDir, entry.name);
      let scoped: fs.Dirent[];
      try {
        scoped = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const pkg of scoped) {
        if (pkg.isDirectory()) roots.push(path.join(scopeDir, pkg.name));
      }
    } else {
      roots.push(path.join(containerDir, entry.name));
    }
  }
  return roots;
}

/**
 * Scans a project's `node_modules` and `.yalc` directories for packages whose own directory tree
 * recursively nests itself (see `findRepeatingBlock` above). Only descends into real package
 * roots — one level for unscoped packages, two for `@scope/pkg` — rather than walking every
 * installed package's full tree from the container root, and skips nested `node_modules`
 * entirely, so this stays fast on a normal-sized install.
 */
export function detectSelfNestedPackages(projectRoot: string): SelfNestedPackageFinding[] {
  const findings: SelfNestedPackageFinding[] = [];

  for (const container of ['node_modules', '.yalc']) {
    const containerDir = path.join(projectRoot, container);
    if (!fs.existsSync(containerDir)) continue;

    for (const packageRoot of collectPackageRoots(containerDir)) {
      const result = scanPackageForSelfNesting(packageRoot);
      if (result) {
        const wastedBytes = sumSizeBytesCapped(path.join(packageRoot, result.nestedAt));
        findings.push({
          packagePath: path.relative(projectRoot, packageRoot),
          nestedAt: result.nestedAt,
          repeatingSegment: result.repeatingSegment,
          approxWastedMB: Math.round((wastedBytes / (1024 * 1024)) * 10) / 10
        });
      }
    }
  }

  return findings;
}
