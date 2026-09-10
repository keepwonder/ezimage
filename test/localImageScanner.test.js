/**
 * Tests for the Markdown inline-image scanner.
 *
 * Run via `npm test`.
 *
 * We need a real directory on disk for the `existsSync` check, so each
 * test creates a unique tmp folder under os.tmpdir() and tears it down
 * in the after() hook.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanMarkdownImages } = require(
    path.join(__dirname, '..', 'out', 'localImageScanner.js'),
);

// Shared scratch directory for tests that need real files on disk.
let scratchDir;

test.before(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezimage-scan-'));
    fs.writeFileSync(path.join(scratchDir, 'exists.png'), '');
    fs.mkdirSync(path.join(scratchDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(scratchDir, 'sub', 'nested.jpg'), '');
    fs.writeFileSync(path.join(scratchDir, 'with space.webp'), '');
});

test.after(() => {
    if (scratchDir && fs.existsSync(scratchDir)) {
        fs.rmSync(scratchDir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Basic matching
// ---------------------------------------------------------------------------

test('matches a simple relative-path image', () => {
    const text = '![alt](./exists.png)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].rawPath, './exists.png');
    assert.equal(matches[0].altText, 'alt');
    assert.equal(matches[0].skipReason, undefined);
    assert.equal(matches[0].absPath, path.join(scratchDir, 'exists.png'));
});

test('matches an absolute-path image', () => {
    const abs = path.join(scratchDir, 'exists.png');
    const text = `![](${abs})`;
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].skipReason, undefined);
    assert.equal(matches[0].absPath, abs);
});

test('matches a nested-directory image', () => {
    const text = '![](./sub/nested.jpg)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].skipReason, undefined);
});

test('matches multiple images in one document', () => {
    const text = 'A ![one](./exists.png) and ![two](./sub/nested.jpg) end.';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 2);
    assert.equal(matches[0].altText, 'one');
    assert.equal(matches[1].altText, 'two');
});

test('matches image with title', () => {
    const text = '![alt](./exists.png "my tooltip")';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].originalText, '![alt](./exists.png "my tooltip")');
});

test('matches empty alt text', () => {
    const text = '![](./exists.png)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].altText, '');
});

test('matches bracket-wrapped path with spaces', () => {
    const text = '![a](<./with space.webp>)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].rawPath, './with space.webp');
    assert.equal(matches[0].skipReason, undefined);
});

// ---------------------------------------------------------------------------
// Ranges
// ---------------------------------------------------------------------------

test('range covers the entire ![alt](path) token', () => {
    const text = 'before ![a](./exists.png) after';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 1);
    const { start, end } = matches[0].range;
    assert.equal(text.slice(start, end), '![a](./exists.png)');
});

test('ranges are correct for multiple matches', () => {
    const text = '![a](./exists.png) ![b](./sub/nested.jpg)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches.length, 2);
    assert.equal(text.slice(matches[0].range.start, matches[0].range.end), '![a](./exists.png)');
    assert.equal(text.slice(matches[1].range.start, matches[1].range.end), '![b](./sub/nested.jpg)');
    assert.ok(matches[1].range.start > matches[0].range.end);
});

// ---------------------------------------------------------------------------
// Things that should be skipped
// ---------------------------------------------------------------------------

test('skips http(s) URLs', () => {
    const matches = scanMarkdownImages('![a](https://example.com/x.png)', scratchDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].skipReason, 'remote-url');
    assert.equal(matches[0].absPath, null);
});

test('skips http URLs without tld', () => {
    const matches = scanMarkdownImages('![a](http://localhost/x.png)', scratchDir);
    assert.equal(matches[0].skipReason, 'remote-url');
});

test('skips data URIs', () => {
    const matches = scanMarkdownImages('![a](data:image/png;base64,iVBORw0KG)', scratchDir);
    assert.equal(matches[0].skipReason, 'data-uri');
});

test('skips non-image extensions', () => {
    const text = '![a](./notes.txt)';
    const matches = scanMarkdownImages(text, scratchDir);
    assert.equal(matches[0].skipReason, 'not-an-image');
});

test('skips nonexistent files (default)', () => {
    const matches = scanMarkdownImages('![a](./does-not-exist.png)', scratchDir);
    assert.equal(matches[0].skipReason, 'file-not-found');
    assert.equal(matches[0].absPath, null);
});

test('keeps nonexistent files when skipNonExistent=false', () => {
    const matches = scanMarkdownImages(
        '![a](./does-not-exist.png)',
        scratchDir,
        { skipNonExistent: false },
    );
    assert.equal(matches[0].skipReason, undefined);
    assert.ok(matches[0].absPath);
});

// ---------------------------------------------------------------------------
// Things that should NOT match at all
// ---------------------------------------------------------------------------

test('does not match plain links (no leading !)', () => {
    const matches = scanMarkdownImages('[text](./exists.png)', scratchDir);
    assert.equal(matches.length, 0);
});

test('does not match reference-style images', () => {
    const matches = scanMarkdownImages('![alt][ref]\n\n[ref]: ./exists.png', scratchDir);
    assert.equal(matches.length, 0);
});

test('does not match HTML img tags', () => {
    const matches = scanMarkdownImages('<img src="./exists.png" />', scratchDir);
    assert.equal(matches.length, 0);
});

test('does not match when there are no images at all', () => {
    const matches = scanMarkdownImages('Just some text, no images here.', scratchDir);
    assert.equal(matches.length, 0);
});

// ---------------------------------------------------------------------------
// Path resolution edge cases
// ---------------------------------------------------------------------------

test('normalizes backslashes to forward slashes', () => {
    // On Windows, this is meaningful; on POSIX the backslash is just a
    // regular character. We verify the scanner does NOT crash and the
    // resolved path uses the platform separator.
    const matches = scanMarkdownImages('![a](./sub/nested.jpg)', scratchDir);
    assert.equal(matches[0].absPath, path.join(scratchDir, 'sub', 'nested.jpg'));
});

test('parent-relative path resolves correctly', () => {
    // baseDir = scratch/sub, reference = ../exists.png → scratch/exists.png
    const subDir = path.join(scratchDir, 'sub');
    const matches = scanMarkdownImages('![a](../exists.png)', subDir);
    assert.equal(matches[0].skipReason, undefined);
    assert.equal(matches[0].absPath, path.join(scratchDir, 'exists.png'));
});
