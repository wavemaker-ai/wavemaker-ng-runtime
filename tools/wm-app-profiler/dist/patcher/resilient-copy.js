import fs from 'fs';
import path from 'path';
/**
 * Recursively copies `src` to `dest`, skipping any file or directory that can't be read (e.g.
 * permission-restricted, broken symlink) instead of aborting the whole copy — unlike
 * `fs.cpSync`, which throws and gives up entirely on the first unreadable entry anywhere in a
 * large real-world project tree.
 */
export function copyDirectoryResilient(src, dest, excludeNames = ['node_modules']) {
    const skipped = [];
    function copyEntry(currentSrc, currentDest, relativePath) {
        let stat;
        try {
            stat = fs.lstatSync(currentSrc);
        }
        catch (err) {
            skipped.push({ path: relativePath, reason: err?.message || String(err) });
            return;
        }
        if (stat.isSymbolicLink()) {
            try {
                const target = fs.readlinkSync(currentSrc);
                fs.symlinkSync(target, currentDest);
            }
            catch (err) {
                skipped.push({ path: relativePath, reason: err?.message || String(err) });
            }
            return;
        }
        if (stat.isDirectory()) {
            let entries;
            try {
                entries = fs.readdirSync(currentSrc);
            }
            catch (err) {
                skipped.push({ path: relativePath, reason: err?.message || String(err) });
                return;
            }
            try {
                fs.mkdirSync(currentDest, { recursive: true });
            }
            catch (err) {
                skipped.push({ path: relativePath, reason: err?.message || String(err) });
                return;
            }
            for (const name of entries) {
                if (excludeNames.includes(name))
                    continue;
                copyEntry(path.join(currentSrc, name), path.join(currentDest, name), path.join(relativePath, name));
            }
            return;
        }
        if (stat.isFile()) {
            try {
                fs.copyFileSync(currentSrc, currentDest);
            }
            catch (err) {
                skipped.push({ path: relativePath, reason: err?.message || String(err) });
            }
        }
        // Other entry types (sockets, FIFOs, devices) are silently skipped — not meaningful in a project tree.
    }
    copyEntry(src, dest, '.');
    const rootFailed = skipped.some(s => s.path === '.');
    return { skipped, rootFailed };
}
