/**
 * Tiny Output channel wrapper.
 *
 * Owns the EzImage VS Code Output channel and the `log()` helper used
 * throughout the extension. Extracted to its own module so that other
 * modules (notably `sharpSetup`) can log without creating a circular
 * dependency on `extension.ts`.
 *
 * `initLogger(channel)` must be called once during extension activation,
 * before any code that might want to log.
 */
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Wire up the Output channel. Called from `activate()`.
 */
export function initLogger(channel: vscode.OutputChannel): void {
    outputChannel = channel;
}

/**
 * Append a timestamped line to the Output channel. Safe to call before
 * `initLogger()` — the line is silently dropped in that case, which
 * matches the historical behaviour (the activation probe used to guard
 * every log call with an `if (outputChannel)` check).
 */
export function log(message: string, type: 'info' | 'error' = 'info'): void {
    if (outputChannel) {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }
}

/**
 * Show the Output channel in the VS Code panel. Used by the "View log"
 * action on the ABI-mismatch prompt.
 */
export function showLog(): void {
    outputChannel?.show();
}

/**
 * Get the underlying OutputChannel so the activation site can register
 * it for disposal on extension deactivation. Returns `undefined` if
 * `initLogger` hasn't run yet (caller should push it only after init).
 */
export function getOutputChannel(): vscode.OutputChannel | undefined {
    return outputChannel;
}
