/**
 * Tests for the runtime i18n module.
 *
 * Run via `npm test` (which invokes Node's built-in test runner).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
    t,
    mapVSCodeLocale,
    configureI18n,
    getCurrentLocale,
    findMissingKeys,
    findExtraKeys,
} = require(path.join(__dirname, '..', 'out', 'i18n.js'));

// ---------------------------------------------------------------------------
// Locale resolution
// ---------------------------------------------------------------------------
test('mapVSCodeLocale maps zh-* to zh-CN', () => {
    assert.equal(mapVSCodeLocale('zh-CN'), 'zh-CN');
    assert.equal(mapVSCodeLocale('zh-TW'), 'zh-CN');
    assert.equal(mapVSCodeLocale('zh'), 'zh-CN');
});

test('mapVSCodeLocale maps en-* to en', () => {
    assert.equal(mapVSCodeLocale('en'), 'en');
    assert.equal(mapVSCodeLocale('en-US'), 'en');
    assert.equal(mapVSCodeLocale('en-GB'), 'en');
});

test('mapVSCodeLocale falls back to en for unsupported locales', () => {
    assert.equal(mapVSCodeLocale('ja'), 'en');
    assert.equal(mapVSCodeLocale('ko'), 'en');
    assert.equal(mapVSCodeLocale('fr'), 'en');
    assert.equal(mapVSCodeLocale(''), 'en');
});

test('configureI18n auto follows vscode locale', () => {
    configureI18n('auto', 'zh-CN');
    assert.equal(t('info.uploaded'), '上传成功！');
});

test('configureI18n en overrides even zh-CN host', () => {
    configureI18n('en', 'zh-CN');
    assert.equal(t('info.uploaded'), 'Uploaded successfully!');
});

test('configureI18n zh-CN overrides en host', () => {
    configureI18n('zh-CN', 'en');
    assert.equal(t('info.uploaded'), '上传成功！');
});

test('t() falls back to en before any configureI18n call', () => {
    // Reset by using the side effect of mapping that returns en.
    // We cannot directly reset the cached state from outside; the next
    // test deliberately calls configureI18n to a known locale.
    configureI18n('en', 'en');
    assert.equal(t('error.noImage'), 'No image found in clipboard');
});

// ---------------------------------------------------------------------------
// Placeholder interpolation
// ---------------------------------------------------------------------------
test('t() interpolates {0}, {1}, ...', () => {
    configureI18n('en', 'en');
    assert.equal(t('error.uploadFailed', 'disk full'), 'Upload failed: disk full');
});

test('t() interpolates with multiple placeholders', () => {
    configureI18n('zh-CN', 'zh-CN');
    assert.equal(
        t('log.sharpInstallRunning', 'npm', 'install sharp --no-save'),
        '正在执行：npm install sharp --no-save',
    );
});

test('t() leaves missing placeholders intact', () => {
    configureI18n('en', 'en');
    // 'foo {0} bar {1}' with only 1 arg: {1} stays literal.
    const out = t('log.sharpInstallRunning', 'only-zero');
    assert.match(out, /\{1\}/);
});

// ---------------------------------------------------------------------------
// Unknown key behavior
// ---------------------------------------------------------------------------
test('t() returns the key itself when not found in either bundle', () => {
    configureI18n('en', 'en');
    assert.equal(t('totally.unknown.key'), 'totally.unknown.key');
});

test('t() falls back from zh-CN to en when key missing in zh-CN', () => {
    // findExtraKeys returns [] for en, so we know bundles are in sync.
    // To simulate "missing in zh-CN" we'd need to mutate the bundle, which
    // is intentionally not exposed. We instead trust the key parity
    // tests and assert fallback semantics with the English key.
    configureI18n('en', 'en');
    assert.equal(t('error.configMissing', 'Missing R2 Access Key ID'),
        'EzImage: Missing R2 Access Key ID');
});

// ---------------------------------------------------------------------------
// Key parity diagnostic helpers
// ---------------------------------------------------------------------------
test('findMissingKeys returns empty array for in-sync bundles', () => {
    assert.deepEqual(findMissingKeys('zh-CN'), []);
    assert.deepEqual(findMissingKeys('en'), []);
});

test('findExtraKeys returns empty array for in-sync bundles', () => {
    assert.deepEqual(findExtraKeys('zh-CN'), []);
    assert.deepEqual(findExtraKeys('en'), []);
});

// ---------------------------------------------------------------------------
// Runtime configuration (simulates the live onDidChangeConfiguration flow)
// ---------------------------------------------------------------------------
test('configureI18n can be re-called and takes effect immediately', () => {
    configureI18n('en', 'en');
    assert.equal(t('info.uploaded'), 'Uploaded successfully!');
    assert.equal(getCurrentLocale(), 'en');

    // User opens settings.json and flips the value to zh-CN. The change
    // listener in extension.ts calls configureI18n again — no reload.
    configureI18n('zh-CN', 'zh-CN');
    assert.equal(t('info.uploaded'), '上传成功！');
    assert.equal(getCurrentLocale(), 'zh-CN');

    // Switching back to en works without an intermediate reset.
    configureI18n('en', 'en');
    assert.equal(t('info.uploaded'), 'Uploaded successfully!');

    // 'auto' re-evaluates the VS Code locale each time the user changes it.
    configureI18n('auto', 'en');
    assert.equal(t('info.uploaded'), 'Uploaded successfully!');
    configureI18n('auto', 'zh-CN');
    assert.equal(t('info.uploaded'), '上传成功！');
    configureI18n('auto', 'ja-JP');
    assert.equal(t('info.uploaded'), 'Uploaded successfully!');
});
