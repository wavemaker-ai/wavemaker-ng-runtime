import fs from 'fs';
import path from 'path';
import { StudioActionItem } from '../types.js';

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|bmp|webp)$/i;
const WARNING_THRESHOLD_BYTES = 300 * 1024; // 300KB
const CRITICAL_THRESHOLD_BYTES = 800 * 1024; // 800KB — confirmed real on a client project (a
// 852KB login-page background, a 1.7MB per-tenant homepage background), both directly delaying
// Largest Contentful Paint on the very first page a user sees.

interface ImageRef {
  relPath: string;
  /** True when the reference is on a widget with width/height both "100%" — a near-certain
   * full-viewport background, i.e. almost always the LCP element for that page. */
  isFullBleedBackground: boolean;
}

/**
 * Extracts statically-resolvable image references from WM Source markup: `backgroundimage="..."`
 * widget attributes and plain `<img src="...">` tags. Deliberately skips anything that isn't a
 * literal path — `bind:` expressions (e.g. AMHome's per-tenant homepage image), `{{ }}`
 * interpolations, `data:` URIs, and external `http(s)://` URLs — since none of those can be
 * resolved to a file on disk without guessing, and this check only reports what it can verify.
 */
function extractImageRefs(html: string): ImageRef[] {
  const refs: ImageRef[] = [];
  const seen = new Set<string>();

  const isStaticLocalPath = (value: string) =>
    value && !value.startsWith('bind:') && !value.includes('{{') && !value.startsWith('data:') && !/^https?:\/\//i.test(value);

  const bgRegex = /<[a-zA-Z][a-zA-Z0-9-]*\b((?:[^>]*?))\bbackgroundimage\s*=\s*"([^"]*)"([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = bgRegex.exec(html)) !== null) {
    const value = m[2];
    if (!isStaticLocalPath(value) || seen.has(value)) continue;
    seen.add(value);
    const attrs = m[1] + m[3];
    const isFullBleed = /\bwidth\s*=\s*"100%"/.test(attrs) && /\bheight\s*=\s*"100%"/.test(attrs);
    refs.push({ relPath: value, isFullBleedBackground: isFullBleed });
  }

  const imgRegex = /<img\b[^>]*\bsrc\s*=\s*"([^"]*)"[^>]*>/gi;
  while ((m = imgRegex.exec(html)) !== null) {
    const value = m[1];
    if (!isStaticLocalPath(value) || seen.has(value)) continue;
    seen.add(value);
    refs.push({ relPath: value, isFullBleedBackground: false });
  }

  return refs;
}

/**
 * Resolves each statically-referenced image against the project's real webapp root and flags
 * ones over 300KB (WARNING) or 800KB (CRITICAL) — sized directly from the file on disk, never
 * estimated. A reference that can't be resolved to a real file is silently skipped rather than
 * guessed at (e.g. a path relative to a prefab's own resource folder instead of the app root).
 */
export function auditPageImages(htmlContent: string, pageName: string, webappRoot: string): StudioActionItem[] {
  const actionItems: StudioActionItem[] = [];
  if (!htmlContent || !webappRoot) return actionItems;

  for (const ref of extractImageRefs(htmlContent)) {
    if (!IMAGE_EXTENSION_RE.test(ref.relPath)) continue;

    const normalized = ref.relPath.replace(/^\.?\//, '');
    const absPath = path.join(webappRoot, normalized);
    let sizeBytes: number;
    try {
      sizeBytes = fs.statSync(absPath).size;
    } catch {
      continue;
    }
    if (sizeBytes < WARNING_THRESHOLD_BYTES) continue;

    const sizeKB = Math.round(sizeBytes / 1024);
    const severity = sizeBytes >= CRITICAL_THRESHOLD_BYTES || ref.isFullBleedBackground ? 'CRITICAL' : 'WARNING';
    const lcpNote = ref.isFullBleedBackground
      ? ` This is set as a full-viewport background (width/height 100%) — almost certainly the Largest Contentful Paint element on this page.`
      : '';

    actionItems.push({
      id: `${pageName}_${normalized.replace(/[^a-zA-Z0-9]/g, '_')}_OVERSIZED_IMAGE`,
      category: 'OVERSIZED_IMAGE',
      severity,
      page: pageName,
      title: `Oversized Image Referenced Directly (${sizeKB} KB)`,
      issueDescription: `Page '${pageName}' references '${ref.relPath}' (${sizeKB} KB) with no resizing/compression applied.${lcpNote} The full file downloads and decodes before it can paint, directly delaying First/Largest Contentful Paint.`,
      studioFix: {
        location: `Studio -> Page '${pageName}' -> the widget using '${ref.relPath}'`,
        stepByStep: [
          `Compress/resize '${ref.relPath}' to the dimensions it's actually rendered at (a full-viewport background rarely needs more than ~1920px wide).`,
          `Convert it to WebP/AVIF if the target browsers support it — typically 25-50% smaller than an equivalent JPEG/PNG at the same visual quality.`,
          `If this image isn't visible on initial load (e.g. below the fold, or behind a tab/dialog), defer loading it instead of fetching it eagerly.`
        ]
      }
    });
  }

  return actionItems;
}

// Studio's "duplicate page" action (and manual copy-paste-rename during testing) leave the copy
// named with one of these tokens as a distinct underscore-delimited segment. Confirmed on a real
// client project: 16 pages named things like 'AMAssetForm_Copy', 'AMHome_OLD',
// 'AMAssetSearch_TEST_Copy' — leftover duplicates from experimentation, never cleaned up, still
// built and routed like any other page. Requires an underscore/start/end boundary around the
// token specifically so this doesn't fire on a real page whose name simply contains the
// substring (e.g. 'OldEquipmentSearch' or 'Testimonials' do NOT match).
const DEAD_PAGE_NAME_RE = /(^|_)(copy\d*|old|bak|backup|deprecated|unused|temp|test)(_|$)/i;

/**
 * Project-wide pass (like PREFAB_OVERHEAD/duplication) over every page/partial name, flagging
 * ones whose name itself signals it's a leftover backup/test copy rather than live content.
 * Advisory only (WARNING) — deletion needs a human to confirm nothing still references it.
 */
export function auditDeadPageNames(pageNames: string[]): StudioActionItem[] {
  const actionItems: StudioActionItem[] = [];
  for (const rawName of pageNames) {
    const isPartial = rawName.startsWith('[Partial] ');
    const baseName = isPartial ? rawName.slice('[Partial] '.length) : rawName;
    if (!DEAD_PAGE_NAME_RE.test(baseName)) continue;

    actionItems.push({
      id: `${rawName}_DEAD_PAGE_CANDIDATE`,
      category: 'DEAD_PAGE_CANDIDATE',
      severity: 'WARNING',
      page: rawName,
      title: `'${baseName}' Looks Like a Leftover Backup/Test Copy`,
      issueDescription: `'${baseName}'s name matches a backup/copy/test naming pattern commonly left behind by Studio's "duplicate page" action or manual experimentation. If it's genuinely abandoned, it's still being built, bundled, and (for a page) routed for zero real use.`,
      studioFix: {
        location: `Studio -> ${isPartial ? 'Partials' : 'Pages'} -> '${baseName}'`,
        stepByStep: [
          `Confirm '${baseName}' isn't linked from navigation, another page, or referenced dynamically by name.`,
          `If it's genuinely unused, delete it to stop shipping its markup/script/variables in every build.`,
          `If it's actually still needed, rename it to reflect its real purpose so it doesn't keep looking like abandoned test content.`
        ]
      }
    });
  }
  return actionItems;
}
