/**
 * Markdown inline-image scanner.
 *
 * Scans a Markdown text for `![alt](path)` references and resolves each
 * path to an absolute filesystem location relative to `baseDir`. Items
 * that are obviously not local (http(s) URLs, data URIs, non-image files,
 * missing files) are returned with a `skipReason` so the caller can show
 * a summary without having to re-classify them.
 *
 * Scope (v1):
 *   - Only Markdown inline images `![alt](path)` are matched.
 *   - Reference-style images `[ref]: path` and HTML `<img>` tags are
 *     intentionally out of scope (see Backlog in the analysis doc).
 *   - Remote workspaces (WSL / SSH / Container) are not supported: we
 *     rely on local `fs.existsSync`, which only works for files on the
 *     local machine. The caller is expected to reject `untitled` docs
 *     before invoking this scanner.
 *
 * The scanner is deliberately pure: no VS Code dependency, no I/O beyond
 * the optional `fs.existsSync` check. That keeps it unit-testable.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Extension whitelist — must match `isImageFile` in extension.ts. */
const IMAGE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
]);

/** Match `![alt](path)` in a Markdown document. */
export interface LocalImageMatch {
    /**
     * Range of the entire `![alt](path)` token (NOT just the path), so the
     * caller can replace the whole reference in one WorkspaceEdit.
     */
    range: { start: number; end: number };
    /** Full original text, e.g. `![My alt](./foo.png "tooltip")`. */
    originalText: string;
    /** Alt text between `![` and `]`. May be empty. */
    altText: string;
    /** Raw path string exactly as it appears between the parens. */
    rawPath: string;
    /** Resolved absolute path, or null if not a local file. */
    absPath: string | null;
    /**
     * Set when the caller should not upload this entry. Stable string keys
     * so the caller can group by reason for the summary notification.
     */
    skipReason?: SkipReason;
}

export type SkipReason =
    | 'remote-url'
    | 'data-uri'
    | 'not-an-image'
    | 'file-not-found';

export interface ScanOptions {
    /**
     * If true (default), missing local files are reported as
     * `skipReason: 'file-not-found'` instead of being kept in the
     * processable queue. Set to false to surface missing files as
     * hard errors.
     */
    skipNonExistent?: boolean;
}

/**
 * Match one Markdown inline image reference.
 *
 * Captures:
 *   1. alt text (between `![` and `]`, may be empty)
 *   2. path string — either `<bracketed path>` (preserves spaces) or a
 *      bare token (no whitespace, no closing paren)
 *   3. optional title in `"double quotes"` immediately after the path
 *
 * Examples that match:
 *   ![alt](./foo.png)
 *   ![](./foo.png "title")
 *   ![](<./my image.png>)
 *   ![alt](./foo.png "with spaces in title")
 *
 * Examples that do NOT match (by design):
 *   - HTML `<img src="...">` (out of scope)
 *   - Reference-style `![alt][ref]` (out of scope)
 *   - Plain links `[text](./img.png)` (no leading `!`)
 */
const INLINE_IMAGE_RE = /!\[([^\]]*)\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"([^"]*)")?\)/g;

export function scanMarkdownImages(
    text: string,
    baseDir: string,
    options: ScanOptions = {},
): LocalImageMatch[] {
    const skipNonExistent = options.skipNonExistent ?? true;
    const matches: LocalImageMatch[] = [];

    // RegExp instances are stateful when used with /g; reset lastIndex
    // before each call so a reused regex would still work (we currently
    // build a fresh regex per call but keep this defensive).
    INLINE_IMAGE_RE.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = INLINE_IMAGE_RE.exec(text)) !== null) {
        const [originalText, altText, bracketedPath, barePath, /* title */] = m;
        const rawPath = bracketedPath ?? barePath ?? '';

        const start = m.index;
        const end = start + originalText.length;

        // --- Classify the path ---
        const lower = rawPath.toLowerCase();
        if (/^https?:\/\//i.test(rawPath)) {
            matches.push(buildSkip(start, end, originalText, altText, rawPath, 'remote-url'));
            continue;
        }
        if (/^data:/i.test(rawPath)) {
            matches.push(buildSkip(start, end, originalText, altText, rawPath, 'data-uri'));
            continue;
        }

        // Resolve to absolute. We deliberately use forward-slash semantics
        // for Markdown: a backslash in a `.md` URL is technically allowed
        // by some renderers but means escape on POSIX. We normalize.
        const normalized = rawPath.replace(/\\/g, '/');
        const absPath = path.isAbsolute(normalized)
            ? path.normalize(normalized)
            : path.resolve(baseDir, normalized);

        const ext = path.extname(absPath).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) {
            matches.push(buildSkip(start, end, originalText, altText, rawPath, 'not-an-image'));
            continue;
        }

        if (skipNonExistent) {
            try {
                if (!fs.existsSync(absPath)) {
                    matches.push(buildSkip(start, end, originalText, altText, rawPath, 'file-not-found'));
                    continue;
                }
            } catch {
                // existsSync can throw on permission errors / odd FS layers.
                // Treat as missing rather than crashing the whole scan.
                matches.push(buildSkip(start, end, originalText, altText, rawPath, 'file-not-found'));
                continue;
            }
        }

        matches.push({
            range: { start, end },
            originalText,
            altText,
            rawPath,
            absPath,
        });
    }

    return matches;
}

function buildSkip(
    start: number,
    end: number,
    originalText: string,
    altText: string,
    rawPath: string,
    reason: SkipReason,
): LocalImageMatch {
    return {
        range: { start, end },
        originalText,
        altText,
        rawPath,
        absPath: null,
        skipReason: reason,
    };
}
