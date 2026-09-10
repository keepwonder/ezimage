/**
 * Local-image-to-cloud-URL replacer.
 *
 * Companion to `localImageScanner.ts`. After the scanner finds every
 * `![alt](local-path)` and the upload pipeline produces a cloud URL for
 * each one, the replacer:
 *
 *   1. Renders the replacement snippet for each match (honouring the
 *      user's `ezimage.insertFormat` setting so the output looks
 *      identical to a fresh clipboard upload).
 *   2. Wraps the collected edits into a single VS Code `WorkspaceEdit`
 *      so the user gets ONE undo step covering the whole conversion.
 *
 * The replacement is *in place*: we do NOT add a trailing newline,
 * because we're replacing an existing token rather than inserting into
 * empty space. Block-level snippets still get produced verbatim, which
 * may grow the document length — that's acceptable for an explicit
 * opt-in command.
 *
 * Module design note: we use a lazy `require('vscode')` inside
 * `buildReplacementEdit` so the pure rendering function
 * `renderReplacement` can be unit-tested in plain Node without a VS
 * Code runtime.
 */
import { InsertTemplateSettings } from './types';
import { renderPreset, buildVariables, resolveCustomTemplate, substituteVariables } from './insertTemplate';
import type { LocalImageMatch } from './localImageScanner';

export interface Replacement {
    /**
     * Document offsets of the original `![alt](path)` token. Use
     * `{ start, end }` (character offsets) instead of `vscode.Range` so
     * this module can be unit-tested without the VS Code runtime.
     */
    range: { start: number; end: number };
    /** Replacement text (already rendered per `ezimage.insertFormat`). */
    newText: string;
}

export interface ReplacementInput {
    /** Match from the scanner. */
    match: LocalImageMatch;
    /** Cloud URL produced by the uploader. */
    cloudUrl: string;
    /** The user's current insert-template settings. */
    settings: InsertTemplateSettings;
}

/**
 * Build a single WorkspaceEdit that replaces every entry's range with
 * the rendered cloud-URL snippet. VS Code is required lazily here so
 * unit tests can exercise `renderReplacement` without a VS Code host.
 *
 * `WorkspaceEdit` handles ordering internally, so callers don't need to
 * sort replacements by offset.
 */
export function buildReplacementEdit(
    document: any, // vscode.TextDocument
    replacements: Replacement[],
): any /* vscode.WorkspaceEdit */ {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    const edit = new vscode.WorkspaceEdit();
    for (const r of replacements) {
        const range = new vscode.Range(
            document.positionAt(r.range.start),
            document.positionAt(r.range.end),
        );
        edit.replace(document.uri, range, r.newText);
    }
    return edit;
}

/**
 * Render the replacement snippet for a single match.
 *
 * We reuse the same rendering machinery as `renderInsert` (so a
 * "convert local to cloud" operation produces output identical to a
 * fresh upload), with two intentional differences:
 *
 *   - The trailing newline hint is dropped; we're replacing in place.
 *   - We prefer the alt text from the ORIGINAL document rather than
 *     re-deriving it from the filename. This preserves the author's
 *     intent — if they wrote `![hero shot](./foo.png)`, we keep
 *     "hero shot" instead of "foo".
 */
export function renderReplacement(input: ReplacementInput): string {
    const { match, cloudUrl, settings } = input;
    const filename = filenameFromPath(match.absPath);
    const alt = match.altText || filename; // never produce empty alt

    if (settings.format === 'custom') {
        const tpl = resolveCustomTemplate(settings.customTemplate);
        if (tpl === null) {
            return renderPreset('markdown', { url: cloudUrl, alt, width: '', align: 'none' });
        }
        const vars = buildVariables({ url: cloudUrl, filename, settings, customAlt: alt });
        return substituteVariables(tpl, vars).trimEnd();
    }

    return renderPreset(settings.format, {
        url: cloudUrl,
        alt,
        width: settings.width,
        align: settings.align,
    });
}

function filenameFromPath(absPath: string | null): string {
    if (!absPath) return '';
    const parts = absPath.split(/[\\/]/);
    return parts[parts.length - 1] || absPath;
}
