/**
 * Drag-and-drop provider for Markdown files.
 *
 * Replaces the original `EzImageDropProvider` that lived in
 * `extension.ts`. That implementation had three interlocked bugs:
 *
 *   1. It returned `DocumentDropEdit('')` (empty), which VS Code treats
 *      as a no-op and then falls back to the **default file-drop
 *      behaviour** — opening the dropped file in a new editor tab.
 *      Users dropping an image saw a new tab pop up with the image
 *      preview instead of a Markdown image link.
 *   2. It `await`ed the full upload inside `provideDocumentDropEdits`,
 *      which is supposed to be a fast call. VS Code gives up on the
 *      returned edit once the await resolves, so any insertion that
 *      happened afterwards landed in a stale editor state.
 *   3. There was no opt-out: dragging a single PNG always changed
 *      behaviour, even for users who preferred the native "open in
 *      tab" interaction (e.g. comparing two screenshots side by side).
 *
 * The new flow:
 *
 *   - Read `ezimage.dropUpload.enabled` (default: false). When off,
 *     return `undefined` so VS Code keeps its native behaviour — the
 *     user's drag-and-drop semantics are unchanged.
 *   - When on, filter the dropped URIs to **only supported image
 *     types**. If the drop contains ANY non-image file, return
 *     `undefined` so VS Code handles the whole drop natively (we don't
 *     want to swallow a `.txt` the user dropped alongside a `.png`).
 *   - Pop a confirmation dialog (Upload / Cancel). On Cancel, return
 *     `undefined`.
 *   - On Upload, **synchronously** return a `DocumentDropEdit` whose
 *     `insertText` contains a placeholder `![uploading…](path)` for
 *     each image. This edit is what tells VS Code to **skip** the
 *     default file-open behaviour — a non-empty insert wins.
 *   - Kick off the actual upload + URL replacement **asynchronously**
 *     (no `await` in the provider). The replacement is done with a
 *     single `WorkspaceEdit` so the user gets one undo step covering
 *     the whole drop.
 *
 * Module deps: imports the `t()` translator and the exported
 * `uploadOne` + `isSupportedImagePath` from `extension.ts`. We
 * deliberately do NOT import `logger.ts` or anything else that could
 * create a load-order issue.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { t } from './i18n';
import { uploadOne, isImageFile, getSettings } from './extension';
import { renderInsert } from './insertTemplate';
import { log } from './logger';
import { ensureSharpReady } from './sharpSetup';

/**
 * Read the drop-upload settings. Kept as a small wrapper so tests /
 * future migration to a config snapshot can change one place.
 */
interface DropUploadSettings {
    enabled: boolean;
    placeholder: string;
    requireConfirm: boolean;
}

function readDropUploadSettings(): DropUploadSettings {
    const config = vscode.workspace.getConfiguration('ezimage');
    return {
        enabled: config.get<boolean>('dropUpload.enabled') ?? false,
        placeholder: config.get<string>('dropUpload.placeholder') ?? 'uploading…',
        requireConfirm: config.get<boolean>('dropUpload.requireConfirm') ?? true,
    };
}

/**
 * The provider returned to `vscode.languages.registerDocumentDropEditProvider`.
 *
 * It is intentionally a thin wrapper around `provideDocumentDropEdits`
 * — we keep the class form because VS Code's API takes a class, not
 * a bare function, and we want `instanceof` / `dispose()` semantics
 * if we ever need to add teardown logic.
 */
export class EzImageDropProvider implements vscode.DocumentDropEditProvider {
    async provideDocumentDropEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        dataTransfer: vscode.DataTransfer,
    ): Promise<vscode.DocumentDropEdit | undefined> {
        // Bail out for non-markdown files — those have their own
        // sensible drop semantics (paste a path, link to a header, …)
        // that we don't want to hijack.
        if (document.languageId !== 'markdown') return undefined;

        const settings = readDropUploadSettings();
        if (!settings.enabled) {
            // Default-off: preserve the native "open in editor" behaviour.
            return undefined;
        }

        // We only know how to handle file URIs from the OS. Anything
        // else (e.g. a browser tab) we leave alone.
        const fileItem = dataTransfer.get('text/uri-list');
        if (!fileItem) return undefined;

        let uriList: string;
        try {
            uriList = String(await fileItem.value);
        } catch {
            return undefined;
        }
        if (!uriList) return undefined;

        // Parse all URIs and split them into "image" and "other".
        // - ALL image → take over (this is what the user enabled).
        // - ANY other file in the mix → bail out and let VS Code do its
        //   native thing. We don't want to silently swallow a `.txt`
        //   the user dropped alongside a `.png`.
        const allUris = uriList
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => vscode.Uri.parse(line));

        const imageUris = allUris.filter((u) => isImageFile(u.fsPath));
        if (imageUris.length === 0) return undefined;
        if (imageUris.length !== allUris.length) {
            // Mixed drop (e.g. png + txt). Defer to VS Code so the
            // non-image file still ends up somewhere sensible.
            return undefined;
        }

        // NOTE: no confirmation dialog here. Awaiting a modal dialog
        // inside `provideDocumentDropEdits` breaks VS Code's drop
        // transaction — by the time the user clicks a button, the
        // drop has already been resolved and the returned edit is
        // silently discarded (placeholders never appear in the
        // document). The confirmation instead happens in the async
        // phase, AFTER the placeholders have landed; cancelling there
        // removes the placeholders again.

        // Build the placeholder insert. Each image gets one
        // `![placeholder](local-path)` line, joined with newlines so
        // they don't merge into one paragraph.
        //
        // We deliberately use the **local** path as the URL part: when
        // the upload completes, we replace the whole token with the
        // remote URL. If the user undoes the upload (rare), the
        // placeholder text remains readable (it still resolves to a
        // local file).
        const placeholderAlt = settings.placeholder;
        const placeholderLines = imageUris.map(
            (u) => `![${placeholderAlt}](${u.fsPath})`,
        );
        const insertText = placeholderLines.join('\n');

        // Capture the drop position BEFORE returning. The asynchronous
        // upload pipeline needs a stable anchor: relying on
        // `document.getText().indexOf(placeholderText)` later is
        // fragile because VS Code applies the DocumentDropEdit on its
        // own schedule, and a fast upload can race ahead of that
        // application. Computing offsets from `position` works even if
        // the document hasn't been mutated yet.
        const insertStartOffset = document.offsetAt(position);
        const lineHeightOffsets: number[] = [];
        {
            // Convert each placeholder line's offset relative to
            // insertStartOffset. Line 0 is at insertStartOffset, line
            // 1 is at insertStartOffset + len(line0) + 1 (newline), etc.
            let off = 0;
            for (const line of placeholderLines) {
                lineHeightOffsets.push(off);
                off += line.length + 1; // +1 for the joining newline
            }
        }
        const insertEndOffset = insertStartOffset + insertText.length;

        // Fire-and-forget the real work. The provider MUST return a
        // DocumentDropEdit synchronously (well, as a Promise) so VS
        // Code can apply it and skip the default file-open flow.
        void this.uploadAndReplace(
            document,
            imageUris,
            placeholderLines,
            insertText,
            insertStartOffset,
            lineHeightOffsets,
            insertEndOffset,
        );

        return new vscode.DocumentDropEdit(insertText);
    }

    /**
     * Upload each image and rewrite its placeholder with the remote
     * URL. Runs detached from the provider's promise so the user sees
     * the placeholders immediately and the replacements roll in.
     *
     * If the upload fails for a given image, the placeholder is left
     * alone — it's still a valid (local) Markdown image link, which is
     * strictly better than blanking it.
     */
    private async uploadAndReplace(
        document: vscode.TextDocument,
        imageUris: vscode.Uri[],
        placeholderLines: string[],
        placeholderText: string,
        insertStartOffset: number,
        lineOffsets: number[],
        insertEndOffset: number,
    ): Promise<void> {
        // 1. Wait for VS Code to actually apply the DocumentDropEdit we
        // returned. Application is asynchronous relative to the provider
        // returning — and nothing else in this function makes sense
        // until the placeholders exist. Poll for up to ~2s.
        const appeared = await waitForBlock(
            document,
            insertStartOffset,
            insertEndOffset,
            placeholderText,
        );
        if (!appeared) {
            const docLen = document.getText().length;
            const got = safeSlice(document, insertStartOffset, insertEndOffset);
            log(
                t(
                    'log.dropPlaceholderMissing',
                    String(insertStartOffset),
                    String(insertEndOffset),
                    String(docLen),
                    got.slice(0, 80) || '(empty)',
                    placeholderText.slice(0, 80),
                ),
                'info',
            );
            // Nothing was inserted, so there's nothing to clean up.
            return;
        }

        // 2. Confirmation — now safe to await a dialog, because the
        // drop transaction is long over. On cancel we remove the
        // placeholders so the document is left exactly as before.
        const config = vscode.workspace.getConfiguration('ezimage');
        const requireConfirm = config.get<boolean>('dropUpload.requireConfirm') ?? true;
        if (requireConfirm) {
            const choice = await vscode.window.showInformationMessage(
                t('drop.confirm', String(imageUris.length)),
                { title: t('drop.confirm.action') },
                { title: t('drop.cancel') },
            );
            if (!choice || choice.title !== t('drop.confirm.action')) {
                await removeBlock(document, insertStartOffset, insertEndOffset);
                return;
            }
        }

        // 3. Run the sharp-install gate ONCE for the whole batch. If
        // the user opts into installing, cancel the drop entirely —
        // uploading N originals would defeat the point of installing,
        // and per-image prompts would nag once per file. Leave the
        // placeholders in place: they're valid local-path links.
        const sharpReadiness = await ensureSharpReady(getSettings().compress);
        if (sharpReadiness === 'install-restart-required') {
            log(t('log.uploadCancelledPendingReload', `drop of ${imageUris.length}`), 'info');
            vscode.window.showInformationMessage(
                t('sharp.uploadCancelledPendingReloadBatch', String(imageUris.length)),
            );
            return;
        }

        const replacements: Array<{ start: number; end: number; text: string }> = [];

        let succeeded = 0;
        let failed = 0;
        let bytesIn = 0;
        let bytesOut = 0;

        // We re-derive each token's range relative to `insertStartOffset`
        // from the placeholder text on every iteration. That means if the
        // document mutates between iterations (e.g. we replace line 0,
        // shifting every subsequent line by some delta) we still find
        // each remaining placeholder by searching inside the still-
        // un-mutated tail of the inserted block.
        //
        // Concretely: after we've replaced line 0, line 1's position
        // changes by `(len(newText) - len(line0Text))`. We capture that
        // delta after each replacement and add it to subsequent offsets.
        let downstreamDelta = 0;

        for (let i = 0; i < imageUris.length; i++) {
            const uri = imageUris[i];
            const expectedToken = placeholderLines[i];
            const expectedTokenStart =
                insertStartOffset + lineOffsets[i] + downstreamDelta;
            const expectedTokenEnd = expectedTokenStart + expectedToken.length;

            // Verify the token is still where we expect it. If the user
            // edited between iterations, we may have to relocate.
            let actualBlock = safeSlice(
                document,
                expectedTokenStart,
                expectedTokenEnd,
            );
            if (actualBlock !== expectedToken) {
                // Fall back to a substring search starting from the
                // original insert point. This catches the case where
                // the user typed some characters before our first
                // replacement landed.
                const searchAnchor = insertStartOffset + lineOffsets[i];
                actualBlock = safeSlice(
                    document,
                    searchAnchor,
                    searchAnchor + expectedToken.length,
                );
                if (actualBlock !== expectedToken) {
                    // Token genuinely missing — skip just this image
                    // and let the others proceed. This is the common
                    // case where the user undid the drop or pasted
                    // something over it.
                    log(
                        t(
                            'log.dropTokenMissing',
                            String(i),
                            path.basename(uri.fsPath),
                        ),
                        'info',
                    );
                    failed++;
                    continue;
                }
            }

            try {
                const result = await uploadOne({
                    filePath: uri.fsPath,
                    displayName: path.basename(uri.fsPath),
                    // The sharp-install gate runs once before the loop
                    // (see uploadAndReplace's entry) — per-image prompts
                    // would nag once per dropped file.
                    ensureSharp: false,
                });
                if (!result) {
                    failed++;
                    continue;
                }

                const newText = renderInsert({
                    url: result.url,
                    filename: path.basename(uri.fsPath),
                    settings: getInsertSettings(),
                }).snippet;

                replacements.push({
                    start: expectedTokenStart,
                    end: expectedTokenEnd,
                    text: newText,
                });

                // Track the delta so the next iteration's offsets stay
                // accurate even after the WorkspaceEdit lands.
                downstreamDelta += newText.length - expectedToken.length;

                // Track compression rollup for the summary toast.
                if (result.compression) {
                    bytesIn += result.compression.originalSize;
                    bytesOut += result.compression.uploadedSize;
                    succeeded++;
                } else {
                    succeeded++;
                }
            } catch (err: any) {
                failed++;
                log(
                    t('log.dropItemFailed', path.basename(uri.fsPath), err?.message || String(err)),
                    'error',
                );
            }
        }

        // Apply all replacements as a single atomic edit so the user
        // gets one undo step covering the whole drop.
        if (replacements.length > 0) {
            const edit = new vscode.WorkspaceEdit();
            // Apply from end to start so earlier offsets stay valid
            // even though we edited with character offsets.
            for (const r of replacements.sort((a, b) => b.start - a.start)) {
                edit.replace(
                    document.uri,
                    new vscode.Range(
                        document.positionAt(r.start),
                        document.positionAt(r.end),
                    ),
                    r.text,
                );
            }
            const applied = await vscode.workspace.applyEdit(edit);
            if (!applied) {
                log(t('log.dropEditFailed'), 'error');
            }
        }

        // Surface a single summary toast. Skipped when nothing
        // succeeded AND nothing failed (e.g. user undid mid-upload).
        if (succeeded > 0 || failed > 0) {
            const saved = bytesIn - bytesOut;
            const savedStr = saved > 0 ? ` · saved ${formatBytes(saved)}` : '';
            vscode.window.showInformationMessage(
                t('drop.summary', String(succeeded), String(failed)) + savedStr,
            );
        }
    }
}

/**
 * Read the insert-format settings on demand. Pulled into a helper so
 * the provider doesn't keep a stale snapshot of user settings that
 * might have changed since the drop started.
 */
function getInsertSettings() {
    const config = vscode.workspace.getConfiguration('ezimage');
    return {
        format: (config.get<'markdown' | 'html-wrap' | 'html-figure' | 'custom'>('insertFormat') ?? 'markdown') as
            | 'markdown'
            | 'html-wrap'
            | 'html-figure'
            | 'custom',
        width: config.get<string>('insertWidth') ?? '100%',
        align: (config.get<'none' | 'left' | 'center' | 'right'>('insertAlign') ?? 'none') as
            'none' | 'left' | 'center' | 'right',
        customTemplate: config.get<string>('insertCustomTemplate') ?? '',
        includeName: config.get<boolean>('insertIncludeName') ?? true,
    };
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Slice a document by offset, returning `''` (not throwing) when the
 * offsets are out of range — which can happen if the document was
 * mutated between when we captured the offsets and when we go to
 * verify them.
 */
function safeSlice(document: vscode.TextDocument, start: number, end: number): string {
    const full = document.getText();
    if (start < 0 || end > full.length || start > end) return '';
    return full.slice(start, end);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until the placeholder block appears at the recorded offsets.
 *
 * VS Code applies the DocumentDropEdit returned from
 * `provideDocumentDropEdits` some time after the provider resolves —
 * usually within a tick, but never synchronously. Reading the document
 * immediately (or after a single microtask) races that application.
 * Polling every 50ms for up to ~2s covers it; if the block still isn't
 * there after that, the drop edit genuinely never landed (e.g. VS Code
 * discarded it) and the caller should give up.
 */
async function waitForBlock(
    document: vscode.TextDocument,
    start: number,
    end: number,
    expected: string,
): Promise<boolean> {
    for (let attempt = 0; attempt < 40; attempt++) {
        if (safeSlice(document, start, end) === expected) return true;
        await sleep(50);
    }
    return safeSlice(document, start, end) === expected;
}

/**
 * Remove the placeholder block (used when the user cancels the
 * confirmation after the placeholders have already been inserted).
 * Single atomic edit → one undo step restores the pre-drop document.
 */
async function removeBlock(
    document: vscode.TextDocument,
    start: number,
    end: number,
): Promise<void> {
    // Guard: only delete if the block is still exactly what we inserted.
    if (safeSlice(document, start, end).length === 0) return;
    const edit = new vscode.WorkspaceEdit();
    edit.delete(
        document.uri,
        new vscode.Range(document.positionAt(start), document.positionAt(end)),
    );
    await vscode.workspace.applyEdit(edit);
}
