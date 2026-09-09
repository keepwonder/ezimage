import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { EzImageSettings, IUploader, InsertFormat } from './types';
import { UploaderFactory } from './uploaders';
import { renderInsert } from './insertTemplate';
import { t, configureI18n } from './i18n';

// sharp is a native module with a platform-specific binary; we deliberately
// don't bundle it. Loading is deferred until activate() so we can route any
// load failure through the Output channel and offer a one-click install.
let sharp: any = null;
let sharpLoadAttempted = false;
let sharpLoadError: string | null = null;
let sharpInstallInFlight = false;

function loadSharp(): any {
  if (sharpLoadAttempted) return sharp;
  sharpLoadAttempted = true;
  try {
    // Resolve via createRequire so we can locate sharp inside the extension
    // installation directory (VS Code loads extensions from ~/.vscode/extensions/<id>/).
    const modulePath = require.resolve('sharp', { paths: [__dirname] });
    sharp = require(modulePath);
    sharpLoadError = null;
  } catch (e: any) {
    sharp = null;
    sharpLoadError = e?.message || String(e);
  }
  return sharp;
}

let outputChannel: vscode.OutputChannel;

function log(message: string, type: 'info' | 'error' = 'info') {
  if (outputChannel) {
    const timestamp = new Date().toLocaleTimeString();
    outputChannel.appendLine(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }
}

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

function getPluginSettings(): { autoInstallSharp: boolean; disableCompressionNotice: boolean } {
  const config = vscode.workspace.getConfiguration('ezimage');
  return {
    autoInstallSharp: config.get<boolean>('autoInstallSharp') ?? true,
    disableCompressionNotice: config.get<boolean>('disableCompressionNotice') ?? false,
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

async function compressImage(filePath: string, maxWidth: number, quality: number): Promise<string> {
  // Lazy load on first compression attempt; if it fails we surface the error
  // through Output and offer an auto-install path (handled by caller).
  const sharpInstance = loadSharp();
  if (!sharpInstance) {
    return filePath;
  }

  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];

  if (!supportedFormats.includes(ext)) {
    return filePath;
  }

  const tempPath = path.join(os.tmpdir(), `compressed-${Date.now()}.webp`);

  try {
    log(`Compressing image: ${filePath}`, 'info');
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
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return filePath;
    }

    return tempPath;
  } catch (error) {
    log(t('log.compressionFailed', String(error)), 'error');
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return filePath;
  }
}

/**
 * Detect a usable npm binary on the system PATH.
 * Returns the absolute path or null.
 */
function findNpmBinary(): string | null {
  const candidates = process.platform === 'win32'
    ? ['npm.cmd', 'npm.exe', 'npm']
    : ['npm'];
  for (const name of candidates) {
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = require('child_process').execSync(`${which} ${name}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim().split(/\r?\n/)[0];
      if (result) return result;
    } catch (_) {
      // try next candidate
    }
  }
  return null;
}

/**
 * Strip ANSI escape sequences, carriage returns, and progress-bar control
 * characters from npm's output so it reads cleanly inside VS Code's Output
 * channel (which doesn't render ANSI colours or terminal escape codes).
 *
 * The Output channel writes each line individually, so we also split on \n
 * and emit one log() call per line. Carriage returns collapse progress-bar
 * updates into a single line with the most recent value.
 */
function sanitizeNpmLine(raw: string): string {
  // Remove ANSI escape sequences (CSI + OSC + simple ESC sequences).
  // https://github.com/chalk/ansi-regex/blob/main/index.js
  let s = raw.replace(/\u001b\][^\u0007]*\u0007/g, '');     // OSC ... BEL
  s = s.replace(/\u001b\[(?:\d{1,3}(?:;\d{1,3})*)?[A-Za-z]/g, ''); // CSI ... final-byte
  s = s.replace(/\u001b[@-_][0-?]*[ -/]*[@-~]/g, '');      // other ESC sequences
  // Carriage returns: keep only the last fragment of the line (progress bar update).
  s = s.split('\r').pop() ?? '';
  // Strip braille-pattern spinner glyphs (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) and other
  // misc box-drawing characters npm emits in its progress UI.
  s = s.replace(/[\u2800-\u28FF\u2500-\u259F]/g, '');
  // Tabs to spaces (Output channel can render oddly with literal tabs).
  s = s.replace(/\t/g, '  ');
  return s;
}

/**
 * Splits a chunk of npm output into complete lines, sanitizing each one.
 * Returns [completedLines, trailingPartialLine]. Callers should buffer the
 * trailing partial until the next chunk.
 */
function splitNpmChunk(chunk: string, carry: string): { lines: string[]; carry: string } {
  const combined = carry + chunk;
  const parts = combined.split('\n');
  const lines = parts.slice(0, -1).map((p) => sanitizeNpmLine(p));
  return { lines, carry: parts[parts.length - 1] };
}

/**
 * Run `npm install sharp --no-save --no-audit --no-fund` inside the extension
 * installation directory. Returns true on success.
 *
 * VS Code disables native module hot-reload, so on success the caller must
 * prompt the user to restart the extension host (or VS Code).
 *
 * We intentionally strip npm_config_target / npm_config_runtime / etc. so the
 * prebuilt binary selection is driven by the host platform (and the Node ABI
 * reported by the user's npm), not by VS Code's Electron variables.
 */
function installSharp(extensionPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (sharpInstallInFlight) {
      resolve(false);
      return;
    }
    sharpInstallInFlight = true;

    const npm = findNpmBinary();
    if (!npm) {
      log(t('log.sharpInstallNpmMissing'), 'error');
      sharpInstallInFlight = false;
      resolve(false);
      return;
    }

    // Strip env vars that would make npm install against the wrong ABI.
    const cleanEnv = { ...process.env } as NodeJS.ProcessEnv;
    for (const key of Object.keys(cleanEnv)) {
      if (/^npm_config_(target|runtime|disturl|build_from_source|libc)$/i.test(key)) {
        delete cleanEnv[key];
      }
    }
    cleanEnv.npm_config_update_notifier = 'false';
    cleanEnv.npm_config_fund = 'false';
    cleanEnv.npm_config_audit = 'false';
    // Force plain output so we don't have to strip cursor-movement escape
    // sequences that npm emits when it thinks it's writing to a TTY.
    cleanEnv.npm_config_progress = 'false';
    cleanEnv.npm_config_loglevel = 'info';
    cleanEnv.FORCE_COLOR = '0';
    cleanEnv.NO_COLOR = '1';

    const args = ['install', 'sharp', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts=false', '--loglevel=info', '--no-progress'];
    log(t('log.sharpInstallRunning', npm, args.join(' ')), 'info');
    log(t('log.sharpInstallCwd', extensionPath), 'info');

    const child = spawn(npm, args, {
      cwd: extensionPath,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuf = '';
    let stderrBuf = '';
    let stdoutCarry = '';
    let stderrCarry = '';

    const flushLines = (lines: string[]) => {
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        log(line, 'info');
      }
    };

    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdoutBuf += s;
      const { lines, carry } = splitNpmChunk(s, stdoutCarry);
      stdoutCarry = carry;
      flushLines(lines);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderrBuf += s;
      const { lines, carry } = splitNpmChunk(s, stderrCarry);
      stderrCarry = carry;
      flushLines(lines);
    });

    // 5 minute timeout — npm install sharp is usually under 30s, but a cold
    // download of the libvips prebuilt can occasionally stretch past 1min.
    const timeout = setTimeout(() => {
      log(t('log.sharpInstallTimeout'), 'error');
      child.kill('SIGTERM');
    }, 5 * 60 * 1000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      log(t('log.sharpInstallProcessError', err.message), 'error');
      log(t('log.nodeVersionPrompt'), 'info');
      sharpInstallInFlight = false;
      resolve(false);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      // Flush any trailing partial line.
      if (stdoutCarry) flushLines([sanitizeNpmLine(stdoutCarry)]);
      if (stderrCarry) flushLines([sanitizeNpmLine(stderrCarry)]);
      sharpInstallInFlight = false;
      if (code === 0) {
        log(t('log.sharpInstallSucceeded'), 'info');
        resolve(true);
      } else {
        log(t('log.sharpInstallFailed', String(code)), 'error');
        if (/EACCES|EPERM|EACCES/i.test(stderrBuf)) {
          log(t('log.sharpInstallPermissionHint'), 'info');
        } else if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(stderrBuf)) {
          log(t('log.sharpInstallNetworkHint'), 'info');
        } else if (/404|Not Found/i.test(stderrBuf)) {
          log(t('log.sharpInstallProxyHint'), 'info');
        }
        resolve(false);
      }
    });
  });
}

/**
 * Check whether sharp is already present in the extension's node_modules
 * (i.e. install succeeded previously) even if require() failed — typically
 * because the binary doesn't match the runtime ABI.
 */
function isSharpPresentOnDisk(extensionPath: string): boolean {
  try {
    const pkg = require(path.join(extensionPath, 'node_modules', 'sharp', 'package.json'));
    return pkg?.name === 'sharp';
  } catch (_) {
    return false;
  }
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
  const targetKey = generateFilePath(originalName, settings.pathTemplate);

  // If compression is requested but sharp is missing, give the user a one-shot
  // chance to install it before we silently fall back to the original image.
  const pluginSettings = getPluginSettings();
  if (settings.compress && !loadSharp() && pluginSettings.autoInstallSharp) {
    const ext = vscode.extensions.getExtension('kiang.ezimage');
    const extensionPath = ext?.extensionPath || path.dirname(__dirname);
    const onDisk = isSharpPresentOnDisk(extensionPath);

    if (!onDisk) {
      const installLabel = t('sharp.notInstalled.install');
      const skipLabel = t('sharp.notInstalled.skip');
      const dismissLabel = t('sharp.notInstalled.dismiss');
      const choice = await vscode.window.showWarningMessage(
        t('sharp.notInstalled.title'),
        installLabel,
        skipLabel,
        dismissLabel,
      );
      if (choice === installLabel) {
        const ok = await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: t('log.sharpInstallRunning', 'npm', 'install sharp'),
          cancellable: false,
        }, () => installSharp(extensionPath));
        if (ok) {
          vscode.window.showInformationMessage(
            t('sharp.reloadAfterInstall.title'),
            t('sharp.reloadAfterInstall.action'),
          ).then((action) => {
            if (action === t('sharp.reloadAfterInstall.action')) {
              vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
          });
        } else {
          vscode.window.showErrorMessage(t('sharp.installFailed.title'));
        }
      } else if (choice === dismissLabel) {
        await vscode.workspace.getConfiguration('ezimage').update('autoInstallSharp', false, vscode.ConfigurationTarget.Global);
      }
    } else if (!pluginSettings.disableCompressionNotice) {
      // sharp is on disk but require() failed — most likely an ABI mismatch.
      const viewLogLabel = t('sharp.installFailed.action');
      const dismissLabel = t('sharp.notInstalled.abiMismatch.dismiss');
      const choice = await vscode.window.showWarningMessage(
        t('sharp.notInstalled.abiMismatch.title'),
        viewLogLabel,
        dismissLabel,
      );
      if (choice === viewLogLabel) {
        outputChannel.show();
      } else if (choice === dismissLabel) {
        await vscode.workspace.getConfiguration('ezimage').update('disableCompressionNotice', true, vscode.ConfigurationTarget.Global);
      }
    }
  }

  return await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: t('info.uploading', originalName),
    cancellable: false,
  }, async () => {
    let processedPath = filePath;
    let usedRealExtension = false;
    try {
      // Compression
      if (settings.compress) {
        const before = processedPath;
        processedPath = await compressImage(filePath, settings.maxWidth, settings.quality);
        usedRealExtension = processedPath !== before;
      }

      // If compression produced a real .webp file, use its real extension in
      // the path template instead of the source file's extension (which would
      // leave a .png/.jpg name on a webp payload).
      let effectiveKey = targetKey;
      if (usedRealExtension) {
        const realExt = path.extname(processedPath).slice(1);
        if (realExt) {
          effectiveKey = targetKey.replace(/\.[^./]+$/, '') + '.' + realExt;
        }
      }

      const uploader = UploaderFactory.create(settings);
      log(t('log.uploading', String(settings.provider), effectiveKey), 'info');

      const result = await uploader.upload({
        filePath: processedPath,
        originalName: effectiveKey // Use the generated key as the name for the uploader
      });

      // Cleanup compression temp file
      if (processedPath !== filePath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }

      // Cleanup clipboard temp file
      if (isTemp && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

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

      vscode.window.showInformationMessage(t('info.uploaded'));
      return result.url;
    } catch (err: any) {
      log(t('error.uploadFailed', err.message), 'error');
      vscode.window.showErrorMessage(t('error.uploadFailed', err.message));

      if (processedPath !== filePath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
      if (isTemp && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return null;
    }
  });
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

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('EzImage');

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

  // Probe sharp eagerly so any load failure surfaces in Output from the start,
  // rather than waiting for the user's first upload.
  const probe = loadSharp();
  if (probe) {
    log(t('log.compressionReady', probe.versions?.sharp || 'unknown'), 'info');
  } else {
    log(t('log.compressionUnavailable', String(sharpLoadError || 'unknown')), 'error');
    log(t('log.compressionWillFallback'), 'error');
    log(t('log.compressionFallbackHint'), 'info');
  }

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

  context.subscriptions.push(outputChannel, dropProvider, uploadClipboardCmd, uploadClipboardAsCmd, uploadFileCmd, configureCmd);
}

export function deactivate() { }
