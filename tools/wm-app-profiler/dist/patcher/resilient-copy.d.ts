export interface SkippedEntry {
    /** Path relative to `src` that could not be read/copied. "." means `src` itself. */
    path: string;
    reason: string;
}
export interface ResilientCopyResult {
    skipped: SkippedEntry[];
    /** True when `src` itself couldn't be read/copied at all, meaning `dest` is empty/unusable. */
    rootFailed: boolean;
}
/**
 * Recursively copies `src` to `dest`, skipping any file or directory that can't be read (e.g.
 * permission-restricted, broken symlink) instead of aborting the whole copy — unlike
 * `fs.cpSync`, which throws and gives up entirely on the first unreadable entry anywhere in a
 * large real-world project tree.
 */
export declare function copyDirectoryResilient(src: string, dest: string, excludeNames?: string[]): ResilientCopyResult;
