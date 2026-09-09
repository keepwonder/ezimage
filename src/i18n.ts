/**
 * Lightweight runtime i18n for EzImage.
 *
 * We intentionally do NOT use `vscode.l10n` (VS Code's built-in locale
 * bundle loader) because:
 *   1. vsce's l10n flow requires a nls pseudo-string rewrite step at build
 *      time (the `%key%` -> `bundle.key` rewrite). That works, but we want
 *      a simpler model where we can also unit-test translations without a
 *      VS Code host.
 *   2. We only have two locales right now; a hand-rolled lookup is simpler
 *      to maintain than the @vscode/l10n-bundler toolchain.
 *
 * If/when we add more locales, swap this for vscode.l10n.
 */
import * as fs from 'fs';
import * as path from 'path';

import en from '../l10n/bundle.json';
import zhCN from '../l10n/zh-CN.bundle.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportedLocale = 'en' | 'zh-CN';
export type LanguagePreference = 'auto' | SupportedLocale;

type Bundle = Record<string, string>;

const BUNDLES: Record<SupportedLocale, Bundle> = {
    'en': en as unknown as Bundle,
    'zh-CN': zhCN as unknown as Bundle,
};

// ---------------------------------------------------------------------------
// Locale resolution
// ---------------------------------------------------------------------------

/**
 * Map VS Code's display language string to one of our supported locales.
 * Falls back to `'en'` for anything we don't translate yet.
 */
export function mapVSCodeLocale(vscodeLocale: string): SupportedLocale {
    // Strip region tag for matching (e.g. zh-TW -> zh, en-US -> en).
    const primary = vscodeLocale.toLowerCase().split('-')[0];
    if (primary === 'zh') return 'zh-CN';
    if (primary === 'en') return 'en';
    return 'en';
}

let cachedPreference: LanguagePreference | null = null;
let cachedVSCodeLocale: string | null = null;

export function configureI18n(preference: LanguagePreference, vscodeLocale: string): void {
    cachedPreference = preference;
    cachedVSCodeLocale = vscodeLocale;
}

function currentLocale(): SupportedLocale {
    if (cachedPreference === null || cachedVSCodeLocale === null) {
        // No host has called configureI18n yet (e.g. unit tests) — default
        // to English so we never accidentally leak Chinese text in CI logs.
        return 'en';
    }
    if (cachedPreference === 'auto') {
        return mapVSCodeLocale(cachedVSCodeLocale);
    }
    return cachedPreference;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Look up `key` in the active bundle and interpolate `{0}`, `{1}` placeholders.
 * If the key is missing, falls back to the English bundle; if still missing,
 * returns the key itself so the bug is visible (instead of an empty string).
 */
export function t(key: string, ...args: Array<string | number>): string {
    const locale = currentLocale();
    let template = BUNDLES[locale][key];
    if (template === undefined) {
        template = BUNDLES.en[key];
    }
    if (template === undefined) {
        return key;
    }
    return interpolate(template, args);
}

/** Same as t() but returns the resolved locale (useful for diagnostics). */
export function tWithLocale(key: string, ...args: Array<string | number>): { text: string; locale: SupportedLocale } {
    return { text: t(key, ...args), locale: currentLocale() };
}

/**
 * Replace `{N}` placeholders with the corresponding positional argument.
 * Plain string concatenation — no regex, no escaping, no JS evaluation.
 */
function interpolate(template: string, args: Array<string | number>): string {
    return template.replace(/\{(\d+)\}/g, (_match, index) => {
        const i = Number(index);
        const value = args[i];
        return value === undefined ? `{${i}}` : String(value);
    });
}

/**
 * Diagnostic: list keys present in `en` that are missing from `locale`.
 * Used by the CI validator to keep bundles in sync.
 */
export function findMissingKeys(locale: SupportedLocale): string[] {
    const enKeys = Object.keys(BUNDLES.en).filter((k) => !k.startsWith('%'));
    return enKeys.filter((k) => !(k in BUNDLES[locale]));
}

/**
 * Diagnostic: list extra keys in `locale` that aren't in `en`.
 */
export function findExtraKeys(locale: SupportedLocale): string[] {
    const enKeys = new Set(Object.keys(BUNDLES.en).filter((k) => !k.startsWith('%')));
    return Object.keys(BUNDLES[locale])
        .filter((k) => !k.startsWith('%'))
        .filter((k) => !enKeys.has(k));
}

// ---------------------------------------------------------------------------
// Bundle loader (optional hot-reload during dev — not used in production)
// ---------------------------------------------------------------------------

/**
 * Reload bundles from disk. Useful for iterating on translations without
 * having to restart the extension host. Called automatically by the test
 * suite; production code never invokes this.
 */
export function reloadBundlesForTesting(rootDir: string = path.join(__dirname, '..', 'l10n')): void {
    const enRaw = fs.readFileSync(path.join(rootDir, 'bundle.json'), 'utf-8');
    const zhRaw = fs.readFileSync(path.join(rootDir, 'zh-CN.bundle.json'), 'utf-8');
    BUNDLES.en = JSON.parse(enRaw);
    BUNDLES['zh-CN'] = JSON.parse(zhRaw);
}
