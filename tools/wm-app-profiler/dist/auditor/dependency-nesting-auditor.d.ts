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
/**
 * Scans a project's `node_modules` and `.yalc` directories for packages whose own directory tree
 * recursively nests itself (see `findRepeatingBlock` above). Only descends into real package
 * roots — one level for unscoped packages, two for `@scope/pkg` — rather than walking every
 * installed package's full tree from the container root, and skips nested `node_modules`
 * entirely, so this stays fast on a normal-sized install.
 */
export declare function detectSelfNestedPackages(projectRoot: string): SelfNestedPackageFinding[];
