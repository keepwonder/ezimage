/**
 * Tests for the insert-template engine.
 *
 * Run via `npm test` (Node's built-in test runner; no deps).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
    renderInsert,
    renderPreset,
    resolveCustomTemplate,
    buildVariables,
    findUnknownVariables,
} = require(path.join(__dirname, '..', 'out', 'insertTemplate.js'));

const baseSettings = {
    format: 'markdown',
    width: '100%',
    align: 'none',
    customTemplate: '',
    includeName: true,
};

function render(args) {
    return renderInsert({
        url: 'https://pub.example.com/2026/09/photo-abc123.webp',
        filename: 'photo.png',
        ...args,
    }).snippet;
}

const photoPreset = {
    url: 'https://pub.example.com/2026/09/photo-abc123.webp',
    alt: 'photo',
    width: '100%',
    align: 'none',
};

// ---------------------------------------------------------------------------
// Markdown preset
// ---------------------------------------------------------------------------
test('markdown preset renders ![]()', () => {
    assert.equal(
        render({ settings: { ...baseSettings, format: 'markdown' } }),
        '![photo](https://pub.example.com/2026/09/photo-abc123.webp)'
    );
});

test('markdown always seeds alt from filename (SEO/a11y safety)', () => {
    const out = render({ settings: { ...baseSettings, format: 'markdown', includeName: false } });
    assert.equal(out, '![photo](https://pub.example.com/2026/09/photo-abc123.webp)');
});

// ---------------------------------------------------------------------------
// html-wrap preset — align and width are independent
// ---------------------------------------------------------------------------
test('html-wrap + align:center + width=100% renders wrapped div', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'center', width: '100%' });
    assert.equal(
        out,
        '<div align="center"><img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo" width="100%"></div>'
    );
});

test('html-wrap + align=left renders left-aligned div', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'left', width: '100%' });
    assert.equal(out, '<div align="left"><img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo" width="100%"></div>');
});

test('html-wrap + align=right renders right-aligned div', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'right', width: '100%' });
    assert.match(out, /^<div align="right">/);
});

/** THIS is the bug the user reported: align=none must NOT emit align="none". */
test('html-wrap + align=none drops the <div> wrapper entirely', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'none', width: '100%' });
    assert.equal(
        out,
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo" width="100%">'
    );
    assert.ok(!/div/i.test(out), `should not contain <div> but got: ${out}`);
});

test('html-wrap + align=none + width="" drops both wrapper and width', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'none', width: '' });
    assert.equal(
        out,
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo">'
    );
});

test('html-wrap + align=center + width="" renders div without width', () => {
    const out = renderPreset('html-wrap', { ...photoPreset, align: 'center', width: '' });
    assert.equal(
        out,
        '<div align="center"><img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo"></div>'
    );
});

test('html-wrap escapes special characters in alt and url', () => {
    const out = renderPreset('html-wrap', {
        url: 'https://example.com/?a=1&b="x"',
        alt: 'a < b & "c"',
        width: '100%',
        align: 'center',
    });
    assert.match(out, /alt="a &lt; b &amp; &quot;c&quot;"/);
    assert.match(out, /src="https:\/\/example.com\/\?a=1&amp;b=&quot;x&quot;"/);
});

// ---------------------------------------------------------------------------
// html-figure preset — align is intentionally ignored
// ---------------------------------------------------------------------------
test('html-figure renders figure+figcaption, ignores align', () => {
    const out = renderPreset('html-figure', { ...photoPreset, align: 'center', width: '100%' });
    assert.equal(
        out,
        '<figure><img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo" width="100%"><figcaption>photo</figcaption></figure>'
    );
});

test('html-figure + align=none still renders figure (figure ignores align)', () => {
    const out = renderPreset('html-figure', { ...photoPreset, align: 'none', width: '100%' });
    assert.match(out, /^<figure>/);
    assert.ok(!/align/.test(out));
});

test('html-figure + width="" drops width attribute', () => {
    const out = renderPreset('html-figure', { ...photoPreset, align: 'none', width: '' });
    assert.equal(
        out,
        '<figure><img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo"><figcaption>photo</figcaption></figure>'
    );
});

// ---------------------------------------------------------------------------
// Custom template
// ---------------------------------------------------------------------------
test('custom template with valid variables', () => {
    assert.equal(
        render({
            settings: {
                ...baseSettings,
                format: 'custom',
                customTemplate: '<a href="{url}">{filename}</a>',
            },
        }),
        '<a href="https://pub.example.com/2026/09/photo-abc123.webp">photo.png</a>'
    );
});

test('custom template with empty string falls back to markdown', () => {
    assert.equal(
        render({
            settings: { ...baseSettings, format: 'custom', customTemplate: '' },
        }),
        '![photo](https://pub.example.com/2026/09/photo-abc123.webp)'
    );
    // resolveCustomTemplate is the helper we trust here:
    assert.equal(resolveCustomTemplate(''), null);
    assert.equal(resolveCustomTemplate('   '), null);
    assert.equal(resolveCustomTemplate('  {url}  '), '{url}');
});

test('custom template leaving width blank omits the attribute', () => {
    assert.equal(
        render({
            settings: { ...baseSettings, format: 'custom', width: '', customTemplate: '<img src="{url}">' },
        }),
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp">'
    );
});

test('custom template with explicit width renders width attribute', () => {
    // Bare {width} value — user wraps it in their own attribute.
    assert.equal(
        render({
            settings: { ...baseSettings, format: 'custom', width: '65%', customTemplate: '<img src="{url}" width="{width}">' },
        }),
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp" width="65%">'
    );
});

test('custom template unknown variable is left as-is', () => {
    assert.equal(
        render({
            settings: {
                ...baseSettings,
                format: 'custom',
                customTemplate: '<img src="{url}" title="{typo}">',
            },
        }),
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp" title="{typo}">'
    );
    assert.deepEqual(findUnknownVariables('title={typo} and {alsobad}'), ['{alsobad}', '{typo}']);
});

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
test('buildVariables splits filename correctly for various extensions', () => {
    const v = buildVariables({
        url: 'u',
        filename: 'my.photo.final.JPG',
        settings: baseSettings,
    });
    assert.equal(v['{name}'], 'my.photo.final');
    assert.equal(v['{ext}'], 'JPG');
    assert.equal(v['{filename}'], 'my.photo.final.JPG');
});

test('buildVariables falls back to filename when includeName=false but customAlt empty', () => {
    const v = buildVariables({
        url: 'u',
        filename: 'photo.png',
        settings: { ...baseSettings, includeName: false },
    });
    assert.equal(v['{alt}'], 'photo');
});

test('buildVariables respects explicit customAlt', () => {
    const v = buildVariables({
        url: 'u',
        filename: 'photo.png',
        settings: baseSettings,
        customAlt: 'A scenic mountain view',
    });
    assert.equal(v['{alt}'], 'A scenic mountain view');
});

test('buildVariables exposes bare width and align values', () => {
    // The new contract: variable VALUES are bare, no attribute wrapping.
    // This is what makes custom templates like `<img width="{width}">`
    // work without producing `<img width="width="100%">>`.
    const v = buildVariables({
        url: 'u',
        filename: 'photo.png',
        settings: { ...baseSettings, width: '65%', align: 'center' },
    });
    assert.equal(v['{width}'], '65%');
    assert.equal(v['{align}'], 'center');
});

// ---------------------------------------------------------------------------
// Resolution semantics — full integration
// ---------------------------------------------------------------------------
test('renderInsert picks html-wrap with align=none (end-to-end)', () => {
    const out = render({ settings: { ...baseSettings, format: 'html-wrap', align: 'none', width: '100%' } });
    // The bug case: should NOT contain "align=" or "<div>".
    assert.ok(!/<div/.test(out), `unexpected <div> in: ${out}`);
    assert.ok(!/align=/.test(out), `unexpected align= in: ${out}`);
    assert.match(out, /^<img /);
    assert.match(out, /width="100%"/);
});

test('renderInsert html-wrap + align=center renders the wrapper', () => {
    const out = render({ settings: { ...baseSettings, format: 'html-wrap', align: 'center', width: '100%' } });
    assert.match(out, /^<div align="center">/);
    assert.match(out, /<img /);
});

// ---------------------------------------------------------------------------
// Deprecated alias: html-center is still accepted
// ---------------------------------------------------------------------------
test('html-center is accepted as a deprecated alias for html-wrap', () => {
    const wrap = renderPreset('html-wrap', { ...photoPreset, align: 'center', width: '100%' });
    const center = renderPreset('html-center', { ...photoPreset, align: 'center', width: '100%' });
    assert.equal(center, wrap);
});

test('html-center alias respects align=none (drops wrapper)', () => {
    const center = renderPreset('html-center', { ...photoPreset, align: 'none', width: '100%' });
    assert.equal(
        center,
        '<img src="https://pub.example.com/2026/09/photo-abc123.webp" alt="photo" width="100%">'
    );
});

test('DEPRECATED_FORMAT_ALIASES maps html-center to html-wrap', () => {
    const { DEPRECATED_FORMAT_ALIASES } = require(path.join(__dirname, '..', 'out', 'types.js'));
    assert.equal(DEPRECATED_FORMAT_ALIASES['html-center'], 'html-wrap');
});

test('CANONICAL_INSERT_FORMATS does not include html-center', () => {
    const { CANONICAL_INSERT_FORMATS } = require(path.join(__dirname, '..', 'out', 'types.js'));
    assert.ok(!CANONICAL_INSERT_FORMATS.includes('html-center'));
    assert.ok(CANONICAL_INSERT_FORMATS.includes('html-wrap'));
});
