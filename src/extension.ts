import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { EzImageSettings, IUploader, InsertFormat } from './types';
import { UploaderFactory } from './uploaders';
import { renderInsert } from './insertTemplate';
import { t, configureI18n } from './i18n';
import { log, initLogger, getOutputChannel } from './logger';
import { ensureSharpReady, probeSharp, loadSharp } from './sharpSetup';

function generateRandom(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

function generateFilePath(originalName: string, template: string): string {
  const now = new Date();
  const ext = path.extname(originalName).slice(1) || 'png';
  const name = path.basename(originalName, path.extname(originalName));
  const random = generateRandom();

  const variables: Record<string, string> = {
    '{timestamp}': Date.now().toString(),
    '{yyyy}': now.getFullYear().toString(),
    '{MM}': String(now.getMonth() + 1).padStart(2, '0'),
    '{dd}': String(now.getDate()).padStart(2, '0'),
    '{hh}': String(now.getHours()).padStart(2, '0'),
    '{mm}': String(now.getMinutes()).padStart(2, '0'),
    '{ss}': String(now.getSeconds()).padStart(2, '0'),
    '{random}': random,
    '{name}': name,
    '{ext}': ext,
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  return result;
}

function getSettings(): EzImageSettings {
  const config = vscode.workspace.getConfiguration('ezimage');
  return {
    provider: config.get<'r2'>('provider') || 'r2',
    r2: {
      accountId: config.get<string>('r2.accountId') || '',
      accessKeyId: config.get<string>('r2.accessKeyId') || '',
      secretAccessKey: config.get<string>('r2.secretAccessKey') || '',
      bucketName: config.get<string>('r2.bucketName') || '',
      publicUrl: config.get<string>('r2.publicUrl') || '',
    },
    pathTemplate: config.get<string>('pathTemplate') || '{yyyy}/{MM}/{timestamp}-{random}.{ext}',
    compress: config.get<boolean>('compress') ?? true,
    maxWidth: config.get<number>('maxWidth') || 1920,
    quality: config.get<number>('quality') || 85,
    insert: {
      format: (config.get<'markdown' | 'html-wrap' | 'html-figure' | 'custom'>('insertFormat') ?? 'markdown'),
      width: config.get<string>('insertWidth') ?? '100%',
      align: (config.get<'none' | 'left' | 'center' | 'right'>('insertAlign') ?? 'none'),
      customTemplate: config.get<string>('insertCustomTemplate') ?? '',
      includeName: config.get<boolean>('insertIncludeName') ?? true,
    },
  };
}

function validateSettings(settings: EzImageSettings): string | null {
  if (settings.provider === 'r2') {
    if (!settings.r2.accountId) return 'Missing R2 Account ID';
    if (!settings.r2.accessKeyId) return 'Missing R2 Access Key ID';
    if (!settings.r2.secretAccessKey) return 'Missing R2 Secret Access Key';
    if (!settings.r2.bucketName) return 'Missing R2 Bucket Name';
  }
  return null;
}

/**
 * What `compressImage` did to the source file. Returning a structured
 * result (instead of a bare path string) lets the caller tell the user
 * whether compression actually happened or whether we fell back to the
 * original — which matters because previously a small source image
 * silently bypassed WebP encoding, leaving users wondering why their
 * `.png` files were still `.png` after upload.
 */
type CompressionOutcome =
  | { kind: 'compressed'; path: string; originalSize: number; compressedSize: number }
  | { kind: 'fallback-larger'; path: string; originalSize: number; compressedSize: number }
  | { kind: 'skipped-unsupported'; path: string }
  | { kind: 'skipped-sharp-missing'; path: string };

async function compressImage(
  filePath: string,
  maxWidth: number,
  quality: number,
): Promise<CompressionOutcome> {
  // Lazy load on first compression attempt; if it fails we surface the error
  // through Output and offer an auto-install path (handled by caller).
  const sharpInstance = loadSharp();
  if (!sharpInstance) {
    return { kind: 'skipped-sharp-missing', path: filePath };
  }

  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];

  if (!supportedFormats.includes(ext)) {
    return { kind: 'skipped-unsupported', path: filePath };
  }

  const tempPath = path.join(os.tmpdir(), `compressed-${Date.now()}-${path.basename(filePath)}.webp`);

  try {
    log(t('log.compressionStarting', path.basename(filePath)), 'info');
    const image = sharpInstance(filePath);
    const metadata = await image.metadata();

    let pipeline: any = image;
    if (metadata.width && metadata.width > maxWidth) {
      pipeline = pipeline.resize(maxWidth, undefined, { withoutEnlargement: true });
    }
    pipeline = pipeline.webp({ quality });

    await pipeline.toFile(tempPath);

    const originalSize = fs.statSync(filePath).size;
    const compressedSize = fs.statSync(tempPath).size;

    if (compressedSize >= originalSize) {
      // Compression made the file larger — fall back to the original
      // rather than shipping a payload that's worse than what we started
      // with. This is intentional behaviour (see analysis in commit
      // history) and is what users have come to expect, so we keep it
      // as the default but now log it explicitly so it's visible.
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return { kind: 'fallback-larger', path: filePath, originalSize, compressedSize };
    }

    return { kind: 'compressed', path: tempPath, originalSize, compressedSize };
  } catch (error) {
    log(t('log.compressionFailed', String(error)), 'error');
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return { kind: 'skipped-unsupported', path: filePath };
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function uploadAndInsert(
  filePath: string,
  editor: vscode.TextEditor,
  isTemp: boolean = false,
  overrideFormat?: InsertFormat,
) {
  const settings = getSettings();
  const error = validateSettings(settings);
  if (error) {
    const configureLabel = t('error.configAction');
    const action = await vscode.window.showErrorMessage(
      t('error.configMissing', error),
      configureLabel,
    );
    if (action === configureLabel) {
      vscode.commands.executeCommand('ezimage.configure');
    }
    return null;
  }

  const originalName = path.basename(filePath);

  try {
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: t('info.uploading', originalName),
      cancellable: false,
    }, () => uploadOne({
      filePath,
      isTemp,
      displayName: originalName,
    }));

    if (!result) return null;

    const position = editor.selection.active;
    const insertSettings = overrideFormat
      ? { ...settings.insert, format: overrideFormat }
      : settings.insert;
    const { snippet, trailingNewlines } = renderInsert({
      url: result.url,
      filename: originalName,
      settings: insertSettings,
    });
    const insertText = snippet + '\n'.repeat(trailingNewlines);

    await editor.edit((editBuilder) => {
      editBuilder.insert(position, insertText);
    });

    // Surface compression outcome inline so a single-image upload also
    // tells the user what landed on the bucket (compressed vs. kept
    // original vs. skipped). Without this, the toast is "Uploaded
    // successfully!" and the user has no idea if WebP actually shipped.
    const note = result.compression ? formatSingleCompressionNote(result.compression) : '';
    vscode.window.showInformationMessage(
      note ? `${t('info.uploaded')} ${note}` : t('info.uploaded'),
    );
    return result.url;
  } catch (err: any) {
    log(t('error.uploadFailed', err.message), 'error');
    vscode.window.showErrorMessage(t('error.uploadFailed', err.message));
    return null;
  }
}

/**
 * Core upload primitive: take a local file, optionally compress, upload to
 * the configured provider, and return the public URL.
 *
 * Used by both `uploadAndInsert` (single-clipboard / single-file flows)
 * and `runLocalImageUpload` (bulk local-image conversion). The caller is
 * responsible for any further editor manipulation — this function does
 * NOT touch the document.
 *
 * Cleans up the compression temp file (if any) and the input file
 * (if `isTemp === true`) on both success and failure paths.
 */
export interface UploadOneCompressionInfo {
  kind: 'compressed' | 'fallback-larger' | 'skipped-unsupported' | 'skipped-sharp-missing' | 'disabled';
  /** Original file size in bytes. Always present. */
  originalSize: number;
  /** Bytes actually uploaded. Same as originalSize for any non-compressed outcome. */
  uploadedSize: number;
}

export interface UploadOneResult {
  url: string;
  key: string;
  /** Compression outcome for this upload; undefined when compress was off. */
  compression?: UploadOneCompressionInfo;
}

async function uploadOne(options: {
  filePath: string;
  isTemp?: boolean;
  /** Used only for progress notification text. */
  displayName?: string;
  /**
   * Whether to invoke `ensureSharpReady` for this call. Single-image
   * paths want this true (per-call check is fine, sharp is cached so
   * the cost is one boolean). Batch callers (runLocalImageUpload) set
   * this false and call `ensureSharpReady` once before the loop, so the
   * user only sees the install prompt once for the whole batch instead
   * of once per image.
   */
  ensureSharp?: boolean;
}): Promise<UploadOneResult | null> {
  const { filePath, isTemp = false, displayName, ensureSharp = true } = options;
  const settings = getSettings();
  const originalName = path.basename(filePath);
  const targetKey = generateFilePath(originalName, settings.pathTemplate);
  const shownName = displayName || originalName;
  const originalSize = (() => {
    try { return fs.statSync(filePath).size; } catch { return 0; }
  })();

  // Centralised "is sharp usable?" gate. When the user has already
  // dismissed the install prompt this returns false and we fall through
  // to the existing "sharp missing" log inside compressImage().
  if (ensureSharp) {
    await ensureSharpReady(settings.compress);
  }

  let processedPath = filePath;
  let compressedPath: string | null = null;
  let compression: UploadOneCompressionInfo | undefined;
  try {
    if (settings.compress) {
      const outcome = await compressImage(filePath, settings.maxWidth, settings.quality);
      processedPath = outcome.path;

      // Log so the user can see in Output whether WebP actually shipped
      // or whether we silently fell back to the original. Without this,
      // users see a `.png` URL after enabling compression and assume the
      // extension is lying.
      if (outcome.kind === 'compressed') {
        compressedPath = outcome.path;
        compression = {
          kind: 'compressed',
          originalSize: outcome.originalSize,
          uploadedSize: outcome.compressedSize,
        };
        const saved = outcome.originalSize - outcome.compressedSize;
        const pct = outcome.originalSize > 0
          ? Math.round((saved / outcome.originalSize) * 100)
          : 0;
        log(
          t(
            'log.compressionDone',
            formatBytes(outcome.originalSize),
            formatBytes(outcome.compressedSize),
            String(pct),
          ),
          'info',
        );
      } else if (outcome.kind === 'fallback-larger') {
        compression = {
          kind: 'fallback-larger',
          originalSize: outcome.originalSize,
          uploadedSize: outcome.originalSize,
        };
        log(
          t(
            'log.compressionFallbackLarger',
            formatBytes(outcome.originalSize),
            formatBytes(outcome.compressedSize),
          ),
          'info',
        );
      } else if (outcome.kind === 'skipped-sharp-missing') {
        compression = {
          kind: 'skipped-sharp-missing',
          originalSize,
          uploadedSize: originalSize,
        };
        log(t('log.compressionSkippedSharpMissing'), 'info');
      } else if (outcome.kind === 'skipped-unsupported') {
        compression = {
          kind: 'skipped-unsupported',
          originalSize,
          uploadedSize: originalSize,
        };
        log(t('log.compressionSkippedUnsupported'), 'info');
      }

      // Only the `compressed` outcome produces a real extension change
      // (.png/.jpg → .webp). All fallback variants keep the original
      // extension, so the cloud key stays aligned with the payload.
    } else {
      compression = {
        kind: 'disabled',
        originalSize,
        uploadedSize: originalSize,
      };
    }

    // The temporary file from `compressImage` is a real `.webp` file —
    // its extension overrides whatever was baked into the path template,
    // otherwise we'd ship a `.png` filename containing WebP bytes.
    let effectiveKey = targetKey;
    if (compressedPath !== null) {
      const realExt = path.extname(processedPath).slice(1);
      if (realExt) {
        effectiveKey = targetKey.replace(/\.[^./]+$/, '') + '.' + realExt;
      }
    }

    const uploader = UploaderFactory.create(settings);
    log(t('log.uploading', String(settings.provider), effectiveKey), 'info');

    const result = await uploader.upload({
      filePath: processedPath,
      originalName: effectiveKey,
    });

    return { url: result.url, key: result.key, compression };
  } catch (err: any) {
    log(t('error.uploadFailed', err.message), 'error');
    throw err;
  } finally {
    // Cleanup compression temp file
    if (compressedPath !== null && compressedPath !== filePath && fs.existsSync(compressedPath)) {
      try { fs.unlinkSync(compressedPath); } catch { /* swallow */ }
    }
    // Cleanup clipboard temp file
    if (isTemp && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* swallow */ }
    }
    void shownName; // currently used only for the outer progress title
  }
}

async function saveClipboardImage(): Promise<string | null> {
  const tempPath = path.join(os.tmpdir(), `ezimage-${Date.now()}.png`);
  try {
    if (process.platform === 'darwin') {
      const { execSync } = require('child_process');
      execSync(`osascript -e 'set theFile to (open for access POSIX file "${tempPath}" with write permission)' -e 'try' -e 'write (the clipboard as «class PNGf») to theFile' -e 'end try' -e 'close access theFile'`);
      if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) return tempPath;
    } else if (process.platform === 'linux') {
      const { execSync } = require('child_process');
      execSync(`xclip -selection clipboard -t image/png -o > "${tempPath}"`);
      if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) return tempPath;
    }
  } catch { }
  return null;
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
}

interface ClipboardFileResult {
  filePath: string | null;
  containsFileReference: boolean;
}

async function getClipboardImageFilePath(): Promise<ClipboardFileResult> {
  // Finder puts a file reference on the pasteboard. Read that reference before
  // asking macOS to coerce the clipboard to PNG; coercing a copied file returns
  // its Finder icon/preview instead of the contents of the image file.
  if (process.platform === 'darwin') {
    try {
      const { execFileSync } = require('child_process');
      const script = [
        "ObjC.import('AppKit');",
        'function run() {',
        '  const pasteboard = $.NSPasteboard.generalPasteboard;',
        '  const result = { path: "", types: ObjC.deepUnwrap(pasteboard.types) || [] };',
        '  try {',
        '    const classes = $.NSArray.arrayWithObject($.NSURL);',
        '    const options = $.NSDictionary.dictionaryWithObjectForKey(',
        '      $.NSNumber.numberWithBool(true),',
        '      $.NSPasteboardURLReadingFileURLsOnlyKey',
        '    );',
        '    const urls = pasteboard.readObjectsForClassesOptions(classes, options);',
        '    if (urls && urls.count > 0) {',
        '      const url = urls.objectAtIndex(0);',
        '      const pathUrl = url.filePathURL;',
        '      result.path = ObjC.unwrap((pathUrl || url).path);',
        '    }',
        '  } catch (_) {}',
        '  if (!result.path) {',
        "    const fileUrl = pasteboard.stringForType('public.file-url');",
        '    if (fileUrl) {',
        '      const url = $.NSURL.URLWithString(fileUrl);',
        '      const pathUrl = url ? url.filePathURL : null;',
        '      result.path = pathUrl ? ObjC.unwrap(pathUrl.path) : ObjC.unwrap(fileUrl);',
        '    }',
        '  }',
        '  if (!result.path) {',
        "    const fileUrlData = pasteboard.dataForType('public.file-url');",
        '    if (fileUrlData) {',
        '      const fileUrlText = $.NSString.alloc.initWithDataEncoding(fileUrlData, $.NSUTF8StringEncoding);',
        '      if (fileUrlText) {',
        '        const url = $.NSURL.URLWithString(fileUrlText);',
        '        const pathUrl = url ? url.filePathURL : null;',
        '        result.path = pathUrl ? ObjC.unwrap(pathUrl.path) : ObjC.unwrap(fileUrlText);',
        '      }',
        '    }',
        '  }',
        '  if (!result.path) {',
        "    const fileNames = pasteboard.propertyListForType('NSFilenamesPboardType');",
        '    if (fileNames && fileNames.count > 0) result.path = ObjC.unwrap(fileNames.objectAtIndex(0));',
        '  }',
        '  return JSON.stringify(result);',
        '}',
      ].join('\n');
      const rawResult = execFileSync('osascript', ['-l', 'JavaScript', '-e', script], { encoding: 'utf8' }).trim();
      const pasteboardResult = JSON.parse(rawResult) as { path?: string; types?: string[] };
      const types = pasteboardResult.types || [];
      log(`Clipboard types: ${types.join(', ') || '(none)'}`, 'info');

      let fileUrl = pasteboardResult.path || '';
      if (!fileUrl) {
        const appleScript = [
          'try',
          'set fileUrl to the clipboard as «class furl»',
          'return POSIX path of fileUrl',
          'on error',
          'return ""',
          'end try',
        ].join('\n');
        fileUrl = execFileSync('osascript', ['-e', appleScript], { encoding: 'utf8' }).trim();
      }

      const filePath = fileUrl.startsWith('file:') ? vscode.Uri.parse(fileUrl).fsPath : fileUrl;
      if (filePath && fs.existsSync(filePath) && isImageFile(filePath)) {
        log(`Using copied image file: ${path.basename(filePath)}`, 'info');
        return { filePath, containsFileReference: true };
      }
      if (fileUrl) {
        log(`Clipboard contains a file, but it is not a supported image: ${fileUrl}`, 'error');
      }

      const containsFileReference = types.some(type => /file-url|filenames|finder|promised-file/i.test(type));
      if (containsFileReference) {
        return { filePath: null, containsFileReference: true };
      }
    } catch (error) {
      log(`Unable to read clipboard file reference: ${error}`, 'error');
    }
  }

  // Also support a path copied as plain text on every platform.
  const clipboardText = (await vscode.env.clipboard.readText()).trim();
  if (clipboardText && fs.existsSync(clipboardText) && isImageFile(clipboardText)) {
    log(`Using image path from clipboard text: ${path.basename(clipboardText)}`, 'info');
    return { filePath: clipboardText, containsFileReference: true };
  }

  return { filePath: null, containsFileReference: false };
}

class EzImageDropProvider implements vscode.DocumentDropEditProvider {
  async provideDocumentDropEdits(document: vscode.TextDocument, position: vscode.Position, dataTransfer: vscode.DataTransfer): Promise<vscode.DocumentDropEdit | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || document.languageId !== 'markdown') return undefined;

    const fileItem = dataTransfer.get('text/uri-list');
    if (!fileItem) return undefined;

    const uriList = await fileItem.value;
    if (typeof uriList !== 'string') return undefined;

    const uris = uriList.split('\r\n').filter(uri => uri.trim().length > 0)
      .map(u => vscode.Uri.parse(u))
      .filter(uri => isImageFile(uri.fsPath));

    if (uris.length === 0) return undefined;

    const choice = await vscode.window.showInformationMessage(`Upload ${uris.length} image(s) via EzImage?`, 'Upload', 'Cancel');
    if (choice !== 'Upload') return undefined;

    for (const uri of uris) {
      await uploadAndInsert(uri.fsPath, editor);
    }

    return new vscode.DocumentDropEdit('');
  }
}

/**
 * Re-read the language setting and push it into the i18n module. Called at
 * activation and on every relevant config change so users see the new
 * language without reloading the window.
 */
function applyI18nSettings(): void {
  const config = vscode.workspace.getConfiguration('ezimage');
  configureI18n(
    config.get<'auto' | 'en' | 'zh-CN'>('language') ?? 'auto',
    vscode.env.language,
  );
}

// ---------------------------------------------------------------------------
// Local-image-to-cloud-URL conversion
// ---------------------------------------------------------------------------

import { scanMarkdownImages, LocalImageMatch } from './localImageScanner';
import { buildReplacementEdit, renderReplacement, Replacement } from './localImageReplacer';

/**
 * Main entry point for the "Upload Local Images" command family.
 *
 *  - `scope: 'document'`       — scan the whole file.
 *  - `scope: 'selection'`      — scan only the active selection (no-op
 *                                 when selection is empty, in which case
 *                                 we fall back to the whole document).
 *
 * Flow:
 *   1. Pre-flight: reject untitled / non-md / missing files.
 *   2. Scan the document text for `![alt](path)` references.
 *   3. Surface a "Found X, Y skipped" confirmation so the user can
 *      abort before any network calls happen.
 *   4. Serial upload via `uploadOne()`, collecting a list of
 *      `{ range, cloudUrl }` for successful items.
 *   5. Apply all replacements in a single WorkspaceEdit so the user
 *      gets ONE undo step covering the whole conversion.
 *   6. Summary notification.
 *
 * Failures are isolated per image: a bad upload does not abort the
 * batch. The summary tells the user how many succeeded and how many
 * failed (with details in the Output channel).
 */
async function runLocalImageUpload(scope: 'document' | 'selection'): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') return;

  const doc = editor.document;

  // Untitled documents don't have a meaningful fsPath; we cannot
  // resolve relative paths from them.
  if (doc.isDirty && doc.uri.scheme === 'untitled') {
    vscode.window.showErrorMessage(t('localUpload.error.unsavedDoc'));
    return;
  }
  if (doc.uri.scheme !== 'file') {
    vscode.window.showErrorMessage(t('localUpload.error.unsupportedScheme'));
    return;
  }

  // Determine scan range + text.
  const hasSelection = !editor.selection.isEmpty;
  const useSelection = scope === 'selection' && hasSelection;
  const scanRange = useSelection ? editor.selection : doc.validateRange(new vscode.Range(0, 0, doc.lineCount, 0));
  const text = doc.getText(scanRange);
  const scanOffset = doc.offsetAt(scanRange.start);
  const baseDir = path.dirname(doc.uri.fsPath);

  // Honour user-controlled behaviour: missing files can either be
  // silently skipped (default) or surfaced as hard skips.
  const config = vscode.workspace.getConfiguration('ezimage');
  const skipNonExistent = config.get<boolean>('localImageUpload.skipNonExistent') ?? true;

  const matches = scanMarkdownImages(text, baseDir, { skipNonExistent });
  const processable = matches.filter((m) => !m.skipReason);
  const skipped = matches.filter((m) => m.skipReason);

  if (processable.length === 0) {
    vscode.window.showInformationMessage(
      skipped.length > 0
        ? t('localUpload.noCandidates.withSkipped', String(skipped.length))
        : t('localUpload.noCandidates'),
    );
    log(
      t(
        'log.localUploadNothingToDo',
        String(matches.length),
        String(skipped.length),
      ),
      'info',
    );
    return;
  }

  // Pre-flight confirmation: gives the user a chance to back out before
  // we start hitting the network. Skipped count is informational.
  const confirmLabel = t('localUpload.confirm.action');
  const choice = await vscode.window.showInformationMessage(
    t(
      'localUpload.confirm',
      String(processable.length),
      String(skipped.length),
    ),
    { title: confirmLabel },
  );
  if (choice?.title !== confirmLabel) return;

  // Validate configuration once before the loop so we don't burn
  // half-way through and then discover R2 is unconfigured.
  const settings = getSettings();
  const settingsError = validateSettings(settings);
  if (settingsError) {
    const configureLabel = t('error.configAction');
    const action = await vscode.window.showErrorMessage(
      t('error.configMissing', settingsError),
      configureLabel,
    );
    if (action === configureLabel) {
      vscode.commands.executeCommand('ezimage.configure');
    }
    return;
  }

  // Single install prompt for the whole batch. Without this gate the
  // user would get an installSharp dialog once per image when sharp is
  // missing — annoying even if "Don't ask again" is honoured.
  await ensureSharpReady(settings.compress);

  const replacements: Replacement[] = [];
  let succeeded = 0;
  let failed = 0;
  // Compression rollup for the summary notification. Empty unless at
  // least one item had compression metadata.
  const compressionRollup = {
    compressed: 0,
    fallback: 0,
    skipped: 0,
    disabled: 0,
    bytesIn: 0,
    bytesOut: 0,
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('localUpload.progressTitle'),
      cancellable: true,
    },
    async (progress, token) => {
      for (let i = 0; i < processable.length; i++) {
        if (token.isCancellationRequested) break;
        const m = processable[i];
        progress.report({
          message: t('localUpload.progressMessage', String(i + 1), String(processable.length)),
          increment: 100 / processable.length,
        });

        try {
          const result = await uploadOne({
            filePath: m.absPath!,
            displayName: path.basename(m.absPath!),
            ensureSharp: false, // already handled once before the loop
          });
          if (!result) {
            failed++;
            continue;
          }
          const newText = renderReplacement({
            match: m,
            cloudUrl: result.url,
            settings: settings.insert,
          });
          replacements.push({
            range: {
              start: m.range.start + scanOffset,
              end: m.range.end + scanOffset,
            },
            newText,
          });
          succeeded++;

          if (result.compression) {
            rollupCompression(compressionRollup, result.compression);
          }
        } catch (err: any) {
          failed++;
          log(
            t('log.localUploadItemFailed', path.basename(m.absPath || m.rawPath), err?.message || String(err)),
            'error',
          );
        }
      }
    },
  );

  // Apply all replacements atomically.
  if (replacements.length > 0) {
    const edit = buildReplacementEdit(doc, replacements);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      log(t('log.localUploadEditFailed'), 'error');
      vscode.window.showErrorMessage(t('localUpload.error.editFailed'));
      return;
    }
  }

  vscode.window.showInformationMessage(
    formatBatchSummary(succeeded, failed, compressionRollup),
  );
  log(
    t(
      'log.localUploadDone',
      String(succeeded),
      String(failed),
      formatCompressionRollupLine(compressionRollup),
    ),
    'info',
  );
}

/**
 * Aggregate one upload's compression metadata into the batch rollup.
 * Buckets are mutually exclusive — each upload lands in exactly one.
 */
function rollupCompression(
  rollup: {
    compressed: number;
    fallback: number;
    skipped: number;
    disabled: number;
    bytesIn: number;
    bytesOut: number;
  },
  info: UploadOneCompressionInfo,
): void {
  switch (info.kind) {
    case 'compressed':
      rollup.compressed++;
      break;
    case 'fallback-larger':
      rollup.fallback++;
      break;
    case 'skipped-unsupported':
    case 'skipped-sharp-missing':
      rollup.skipped++;
      break;
    case 'disabled':
      rollup.disabled++;
      break;
  }
  rollup.bytesIn += info.originalSize;
  rollup.bytesOut += info.uploadedSize;
}

/**
 * Format a per-item compression outcome as a one-liner suitable for
 * appending to the existing `info.uploaded` toast.
 */
function formatSingleCompressionNote(info: UploadOneCompressionInfo): string {
  if (info.kind === 'compressed') {
    const saved = info.originalSize - info.uploadedSize;
    const pct = info.originalSize > 0
      ? Math.round((saved / info.originalSize) * 100)
      : 0;
    return t('info.compression.compressed', formatBytes(info.originalSize), formatBytes(info.uploadedSize), String(pct));
  }
  if (info.kind === 'fallback-larger') {
    return t('info.compression.fallbackLarger', formatBytes(info.originalSize));
  }
  if (info.kind === 'skipped-sharp-missing') {
    return t('info.compression.skippedSharpMissing');
  }
  if (info.kind === 'skipped-unsupported') {
    return t('info.compression.skippedUnsupported');
  }
  // 'disabled' → compression off entirely, no note needed.
  return '';
}

/**
 * Batch summary line. Builds the user-facing notification text from the
 * aggregate counts so a glance is enough to know whether compression
 * actually did work.
 */
function formatBatchSummary(
  succeeded: number,
  failed: number,
  rollup: {
    compressed: number;
    fallback: number;
    skipped: number;
    disabled: number;
    bytesIn: number;
    bytesOut: number;
  },
): string {
  const head = t('localUpload.summary', String(succeeded), String(failed));
  const tail = formatCompressionRollupLine(rollup);
  return tail ? `${head} ${tail}` : head;
}

function formatCompressionRollupLine(rollup: {
  compressed: number;
  fallback: number;
  skipped: number;
  disabled: number;
  bytesIn: number;
  bytesOut: number;
}): string {
  const parts: string[] = [];

  // Compression-enabled buckets: only mention when compress is on AND
  // we actually saw at least one image. `disabled === succeeded` means
  // every upload had compress=false, so the rollup is uninteresting.
  if (rollup.compressed + rollup.fallback + rollup.skipped > 0) {
    parts.push(t(
      'info.compression.batch.compressedAndFallback',
      String(rollup.compressed),
      String(rollup.fallback),
    ));
    const saved = rollup.bytesIn - rollup.bytesOut;
    if (saved > 0) {
      parts.push(t('info.compression.batch.saved', formatBytes(saved)));
    } else if (saved === 0 && rollup.bytesIn > 0) {
      // No savings at all (e.g. all images were fallback-kept).
      parts.push(t('info.compression.batch.noSavings'));
    }
  } else if (rollup.disabled > 0) {
    parts.push(t('info.compression.batch.disabled'));
  }

  return parts.join(' ');
}

export function activate(context: vscode.ExtensionContext) {
  // Wire up the Output channel + i18n, then probe sharp. The order
  // matters: `log()` is a no-op until `initLogger` runs, so anything
  // that calls `log()` during activation (including `probeSharp`) must
  // come after this line.
  initLogger(vscode.window.createOutputChannel('EzImage'));

  // Wire up i18n. The user's `ezimage.language` setting wins; otherwise we
  // track VS Code's display language. The listener below makes language
  // changes take effect immediately, without a window reload.
  applyI18nSettings();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ezimage.language')) {
        applyI18nSettings();
      }
    }),
  );

  log('EzImage is now active', 'info');

  // Probe sharp eagerly so any load failure surfaces in Output from the
  // start, rather than waiting for the user's first upload.
  probeSharp();

  const dropProvider = vscode.languages.registerDocumentDropEditProvider({ language: 'markdown' }, new EzImageDropProvider());

  const uploadClipboardCmd = vscode.commands.registerCommand('ezimage.uploadClipboard', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const clipboardFile = await getClipboardImageFilePath();
    if (clipboardFile.filePath) {
      await uploadAndInsert(clipboardFile.filePath, editor);
      return;
    }
    if (clipboardFile.containsFileReference) {
      vscode.window.showErrorMessage(t('error.invalidFile'));
      return;
    }

    const tempPath = await saveClipboardImage();
    if (!tempPath) {
      vscode.window.showErrorMessage(t('error.noImage'));
      return;
    }

    await uploadAndInsert(tempPath, editor, true);
  });

  /**
   * Same as `uploadClipboard` but always uses a specific insert format
   * for this single invocation, regardless of `ezimage.insertFormat`. Lets
   * users keep their default as Markdown but press a custom shortcut
   * (configured in Keyboard Shortcuts) to get an HTML-centered insert.
   */
  const uploadClipboardAsCmd = vscode.commands.registerCommand('ezimage.uploadClipboardAs', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const formatChoices: { label: string; value: InsertFormat; description: string }[] = [
      { label: t('prompt.chooseFormat.markdown.label'),     value: 'markdown',     description: t('prompt.chooseFormat.markdown.description') },
      { label: t('prompt.chooseFormat.htmlWrap.label'),    value: 'html-wrap',    description: t('prompt.chooseFormat.htmlWrap.description') },
      { label: t('prompt.chooseFormat.htmlFigure.label'),  value: 'html-figure',  description: t('prompt.chooseFormat.htmlFigure.description') },
    ];
    const picked = await vscode.window.showQuickPick(formatChoices, {
      placeHolder: t('prompt.chooseFormat.placeholder'),
      title: t('prompt.chooseFormat.title'),
    });
    if (!picked) return;

    const clipboardFile = await getClipboardImageFilePath();
    if (clipboardFile.filePath) {
      await uploadAndInsert(clipboardFile.filePath, editor, false, picked.value);
      return;
    }
    if (clipboardFile.containsFileReference) {
      vscode.window.showErrorMessage(t('error.invalidFile'));
      return;
    }

    const tempPath = await saveClipboardImage();
    if (!tempPath) {
      vscode.window.showErrorMessage(t('error.noImage'));
      return;
    }

    await uploadAndInsert(tempPath, editor, true, picked.value);
  });

  const uploadFileCmd = vscode.commands.registerCommand('ezimage.uploadFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
    });

    if (uris) {
      for (const uri of uris) {
        await uploadAndInsert(uri.fsPath, editor);
      }
    }
  });

  const configureCmd = vscode.commands.registerCommand('ezimage.configure', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'ezimage');
  });

  const uploadLocalImagesCmd = vscode.commands.registerCommand(
    'ezimage.uploadLocalImages',
    () => runLocalImageUpload('document'),
  );

  const uploadLocalImagesInSelectionCmd = vscode.commands.registerCommand(
    'ezimage.uploadLocalImagesInSelection',
    () => runLocalImageUpload('selection'),
  );

  context.subscriptions.push(
    getOutputChannel()!,
    dropProvider,
    uploadClipboardCmd,
    uploadClipboardAsCmd,
    uploadFileCmd,
    configureCmd,
    uploadLocalImagesCmd,
    uploadLocalImagesInSelectionCmd,
  );
}

export function deactivate() { }
