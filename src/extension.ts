import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { EzImageSettings, IUploader } from './types';
import { UploaderFactory } from './uploaders';

// Dynamically import sharp
let sharp: any;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('sharp not available');
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
  if (!sharp) {
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
    const image = sharp(filePath);
    const metadata = await image.metadata();

    let pipeline = image;
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
    log(`Compression failed: ${error}`, 'error');
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return filePath;
  }
}

async function uploadAndInsert(filePath: string, editor: vscode.TextEditor, isTemp: boolean = false) {
  const settings = getSettings();
  const error = validateSettings(settings);
  if (error) {
    const action = await vscode.window.showErrorMessage(`EzImage: ${error}`, 'Configure');
    if (action === 'Configure') {
      vscode.commands.executeCommand('ezimage.configure');
    }
    return null;
  }

  const originalName = path.basename(filePath);
  const targetKey = generateFilePath(originalName, settings.pathTemplate);

  return await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `EzImage: Uploading ${originalName}...`,
    cancellable: false,
  }, async () => {
    let processedPath = filePath;
    try {
      // Compression
      if (settings.compress) {
        processedPath = await compressImage(filePath, settings.maxWidth, settings.quality);
      }

      const uploader = UploaderFactory.create(settings);
      log(`Uploading to ${settings.provider}: ${targetKey}`, 'info');

      const result = await uploader.upload({
        filePath: processedPath,
        originalName: targetKey // Use the generated key as the name for the uploader
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
      const markdown = `![${originalName}](${result.url})`;

      await editor.edit((editBuilder) => {
        editBuilder.insert(position, markdown);
      });

      vscode.window.showInformationMessage(`Uploaded successfully!`);
      return result.url;
    } catch (err: any) {
      log(`Upload failed: ${err.message}`, 'error');
      vscode.window.showErrorMessage(`Upload failed: ${err.message}`);

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

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('EzImage');
  log('EzImage is now active', 'info');

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
      vscode.window.showErrorMessage('EzImage found a copied file but could not read it as a supported image. See Output > EzImage for clipboard details.');
      return;
    }

    const tempPath = await saveClipboardImage();
    if (!tempPath) {
      vscode.window.showErrorMessage('No image found in clipboard');
      return;
    }

    await uploadAndInsert(tempPath, editor, true);
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

  context.subscriptions.push(outputChannel, dropProvider, uploadClipboardCmd, uploadFileCmd, configureCmd);
}

export function deactivate() { }
