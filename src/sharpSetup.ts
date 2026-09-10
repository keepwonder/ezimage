/**
 * Sharp native-module setup.
 *
 * `sharp` is a node-gyp module with a platform-specific prebuilt binary
 * that VS Code's extension host does NOT load directly out of the box.
 * The flow this module implements:
 *
 *   1. `loadSharp()` — lazy `require('sharp')` with one-shot caching so
 *      the load attempt happens exactly once per extension lifetime.
 *      Failures (binary missing, ABI mismatch) surface as `null`.
 *
 *   2. `installSharp()` — runs `npm install sharp` inside the extension
 *      directory, with extra env-stripping so npm picks the binary for
 *      the user's actual Node ABI (not VS Code's Electron ABI).
 *
 *   3. `isSharpPresentOnDisk()` — sanity check for "binary is installed
 *      but won't load", which is the symptom of an ABI mismatch.
 *
 *   4. `ensureSharpReady()` — the high-level gate that callers use
 *      before the first compression attempt. Surfaces the install prompt
 *      and the "view log / don't ask again" ABI mismatch prompt.
 *
 *   5. `probeSharp()` — diagnostic called at activation so the user
 *      sees in Output whether compression is ready or unavailable
 *      BEFORE their first upload, instead of being surprised later.
 *
 * Cross-module deps: this file imports `t()` from `i18n` and `log()` /
 * `showLog()` from `logger`. No dependency on `extension.ts`, which
 * keeps the import graph acyclic and lets `extension.ts` freely import
 * from here.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { log, showLog } from './logger';

// ---------------------------------------------------------------------------
// Module-level state (cached across calls)
// ---------------------------------------------------------------------------

let sharp: any = null;
let sharpLoadAttempted = false;
let sharpLoadError: string | null = null;
let sharpInstallInFlight = false;

/** True when compression is disabled via `ezimage.autoInstallSharp`. */
function getAutoInstallSharpEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('ezimage');
    return config.get<boolean>('autoInstallSharp') ?? true;
}

/** True when the user has dismissed the ABI-mismatch notice. */
function getCompressionNoticeDisabled(): boolean {
    const config = vscode.workspace.getConfiguration('ezimage');
    return config.get<boolean>('disableCompressionNotice') ?? false;
}

// ---------------------------------------------------------------------------
// Lazy load
// ---------------------------------------------------------------------------

/**
 * One-shot loader for `sharp`. Returns the module on success, `null`
 * on failure. The first call attempts `require.resolve('sharp', { paths:
 * [__dirname] })` so the binary is located relative to the extension
 * installation directory (VS Code loads extensions from
 * `~/.vscode/extensions/<id>/`, not from the project root).
 */
export function loadSharp(): any {
    if (sharpLoadAttempted) return sharp;
    sharpLoadAttempted = true;
    try {
        const modulePath = require.resolve('sharp', { paths: [__dirname] });
        sharp = require(modulePath);
        sharpLoadError = null;
    } catch (e: any) {
        sharp = null;
        sharpLoadError = e?.message || String(e);
    }
    return sharp;
}

/** Exposed so activation diagnostics can show why sharp failed to load. */
export function getSharpLoadError(): string | null {
    return sharpLoadError;
}

// ---------------------------------------------------------------------------
// On-disk check
// ---------------------------------------------------------------------------

/**
 * Whether sharp is already present in the extension's `node_modules/`
 * even if `require()` failed. When this is true and `loadSharp()`
 * returns null, the most likely cause is an ABI mismatch between the
 * prebuilt binary and VS Code's Electron runtime.
 */
export function isSharpPresentOnDisk(extensionPath: string): boolean {
    try {
        const pkg = require(path.join(extensionPath, 'node_modules', 'sharp', 'package.json'));
        return pkg?.name === 'sharp';
    } catch (_) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Install prompt gate (the high-level entry point)
// ---------------------------------------------------------------------------

/**
 * Centralised "is sharp usable?" gate.
 *
 * Called from `uploadOne` BEFORE the first compression attempt, so every
 * upload path (clipboard, file picker, batch local-image conversion)
 * gets the same install / ABI-mismatch treatment. Previously this logic
 * lived only inside `uploadAndInsert`, which meant the new
 * "Upload Local Images" command silently skipped compression whenever
 * sharp was missing — the user got no install prompt at all.
 *
 * Returns true when sharp is ready (or compression is disabled), false
 * when compression will be skipped this call. The function itself
 * manages the install prompt and the "don't ask again" suppression
 * state — callers only need to log if it returns false.
 */
export async function ensureSharpReady(compressionEnabled: boolean): Promise<boolean> {
    if (!compressionEnabled) return true;
    if (loadSharp()) return true;

    if (!getAutoInstallSharpEnabled()) return false;

    const ext = vscode.extensions.getExtension('kiang.ezimage');
    const extensionPath = ext?.extensionPath || path.dirname(__dirname);
    const onDisk = isSharpPresentOnDisk(extensionPath);

    if (!onDisk) {
        await promptFreshInstall(extensionPath);
    } else if (!getCompressionNoticeDisabled()) {
        await promptAbiMismatch();
    }
    return false;
}

/**
 * sharp is missing entirely. Offer Install / Skip / Don't ask again.
 * If the user picks Install we run `installSharp` and prompt for a
 * window reload (VS Code can't unload a native module without a reload).
 */
async function promptFreshInstall(extensionPath: string): Promise<void> {
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
}

/**
 * sharp is on disk but `require()` failed — most likely an Electron /
 * Node ABI mismatch. Offer View log / Don't ask again.
 */
async function promptAbiMismatch(): Promise<void> {
    const viewLogLabel = t('sharp.installFailed.action');
    const dismissLabel = t('sharp.notInstalled.abiMismatch.dismiss');
    const choice = await vscode.window.showWarningMessage(
        t('sharp.notInstalled.abiMismatch.title'),
        viewLogLabel,
        dismissLabel,
    );
    if (choice === viewLogLabel) {
        showLog();
    } else if (choice === dismissLabel) {
        await vscode.workspace.getConfiguration('ezimage').update('disableCompressionNotice', true, vscode.ConfigurationTarget.Global);
    }
}

// ---------------------------------------------------------------------------
// Activation probe — diagnostic log
// ---------------------------------------------------------------------------

/**
 * Probe sharp eagerly so any load failure surfaces in Output from the
 * start, rather than waiting for the user's first upload. Called from
 * `activate()`.
 */
export function probeSharp(): void {
    const probe = loadSharp();
    if (probe) {
        log(t('log.compressionReady', probe.versions?.sharp || 'unknown'), 'info');
    } else {
        log(t('log.compressionUnavailable', String(sharpLoadError || 'unknown')), 'error');
        log(t('log.compressionWillFallback'), 'error');
        log(t('log.compressionFallbackHint'), 'info');
    }
}

// ---------------------------------------------------------------------------
// Installer (`npm install sharp` inside the extension directory)
// ---------------------------------------------------------------------------

/**
 * Run `npm install sharp --no-save --no-audit --no-fund` inside the
 * extension installation directory. Returns true on success.
 *
 * VS Code disables native module hot-reload, so on success the caller
 * must prompt the user to restart the extension host (or VS Code).
 *
 * We intentionally strip npm_config_target / npm_config_runtime / etc.
 * so the prebuilt binary selection is driven by the host platform (and
 * the Node ABI reported by the user's npm), not by VS Code's Electron
 * variables.
 */
export function installSharp(extensionPath: string): Promise<boolean> {
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

        // 5 minute timeout — npm install sharp is usually under 30s, but a
        // cold download of the libvips prebuilt can occasionally stretch past 1min.
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

// ---------------------------------------------------------------------------
// npm process helpers (kept private — only used by installSharp)
// ---------------------------------------------------------------------------

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
 * Strip ANSI escape sequences, carriage returns, and progress-bar
 * control characters from npm's output so it reads cleanly inside VS
 * Code's Output channel (which doesn't render ANSI colours or terminal
 * escape codes).
 *
 * The Output channel writes each line individually, so we also split on
 * `\n` and emit one log() call per line. Carriage returns collapse
 * progress-bar updates into a single line with the most recent value.
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
 * Returns [completedLines, trailingPartialLine]. Callers should buffer
 * the trailing partial until the next chunk.
 */
function splitNpmChunk(chunk: string, carry: string): { lines: string[]; carry: string } {
    const combined = carry + chunk;
    const parts = combined.split('\n');
    const lines = parts.slice(0, -1).map((p) => sanitizeNpmLine(p));
    return { lines, carry: parts[parts.length - 1] };
}
