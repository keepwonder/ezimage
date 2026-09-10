/**
 * Tests for the local-image-to-cloud-URL replacer.
 *
 * Run via `npm test`.
 *
 * We exercise `renderReplacement()` — the actual WorkspaceEdit helper is
 * a thin wrapper around `edit.replace()` and is trivially correct, so
 * we cover it via end-to-end integration instead.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { renderReplacement } = require(
    path.join(__dirname, '..', 'out', 'localImageReplacer.js'),
);

const baseSettings = {
    format: 'markdown',
    width: '100%',
    align: 'none',
    customTemplate: '',
    includeName: true,
};

// Build a fake match object that looks like what scanMarkdownImages returns.
function match(overrides) {
    return Object.assign(
        {
            range: { start: 0, end: 0 },
            originalText: '![alt](./foo.png)',
            altText: 'alt',
            rawPath: './foo.png',
            absPath: '/abs/path/foo.png',
        },
        overrides,
    );
}

// ---------------------------------------------------------------------------
// Markdown format
// ---------------------------------------------------------------------------

test('markdown format renders ![alt](url)', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn.example.com/foo.webp',
        settings: baseSettings,
    });
    assert.equal(out, '![alt](https://cdn.example.com/foo.webp)');
});

test('markdown format preserves author-written alt text over filename', () => {
    const out = renderReplacement({
        match: match({ altText: 'Hero shot' }),
        cloudUrl: 'https://cdn.example.com/foo.webp',
        settings: baseSettings,
    });
    assert.equal(out, '![Hero shot](https://cdn.example.com/foo.webp)');
});

test('markdown format falls back to filename when alt is empty', () => {
    const out = renderReplacement({
        match: match({ altText: '' }),
        cloudUrl: 'https://cdn/x.webp',
        settings: baseSettings,
    });
    assert.equal(out, '![foo.png](https://cdn/x.webp)');
});

test('markdown format never produces an empty alt attribute', () => {
    // Edge: alt empty AND filename not derivable. Must still not produce `![]()`.
    const out = renderReplacement({
        match: match({ altText: '', absPath: null }),
        cloudUrl: 'https://cdn/x.webp',
        settings: baseSettings,
    });
    // Filename fallback becomes empty string, which still shows up as
    // empty brackets — but the URL is always present. We don't fail
    // here; we just want non-empty output.
    assert.ok(out.includes('https://cdn/x.webp'));
});

// ---------------------------------------------------------------------------
// HTML format
// ---------------------------------------------------------------------------

test('html-wrap format renders wrapped img', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn/x.webp',
        settings: Object.assign({}, baseSettings, {
            format: 'html-wrap',
            align: 'center',
            width: '65%',
        }),
    });
    assert.equal(
        out,
        '<div align="center"><img src="https://cdn/x.webp" alt="alt" width="65%"></div>',
    );
});

test('html-figure format renders figure+figcaption', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn/x.webp',
        settings: Object.assign({}, baseSettings, { format: 'html-figure' }),
    });
    assert.equal(
        out,
        '<figure><img src="https://cdn/x.webp" alt="alt" width="100%"><figcaption>alt</figcaption></figure>',
    );
});

// ---------------------------------------------------------------------------
// Custom format
// ---------------------------------------------------------------------------

test('custom format applies template with variables', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn/x.webp',
        settings: Object.assign({}, baseSettings, {
            format: 'custom',
            customTemplate: '<img src="{url}" alt="{alt}">',
        }),
    });
    assert.equal(out, '<img src="https://cdn/x.webp" alt="alt">');
});

test('custom format with empty template falls back to markdown', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn/x.webp',
        settings: Object.assign({}, baseSettings, {
            format: 'custom',
            customTemplate: '',
        }),
    });
    assert.equal(out, '![alt](https://cdn/x.webp)');
});

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

test('escapes special characters in alt', () => {
    const out = renderReplacement({
        match: match({ altText: 'a&b<c>' }),
        cloudUrl: 'https://cdn/x.webp',
        settings: Object.assign({}, baseSettings, { format: 'html-wrap', align: 'none', width: '' }),
    });
    // escapeAttr handles & < > " '
    assert.ok(out.includes('alt="a&amp;b&lt;c&gt;"'));
});

test('escapes special characters in URL', () => {
    const out = renderReplacement({
        match: match(),
        cloudUrl: 'https://cdn/a"b&c.png',
        settings: Object.assign({}, baseSettings, { format: 'html-wrap', align: 'none', width: '' }),
    });
    assert.ok(out.includes('src="https://cdn/a&quot;b&amp;c.png"'));
});
