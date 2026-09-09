#!/usr/bin/env node
/**
 * Cross-platform test runner. Node's built-in test runner doesn't expand
 * globs on its own (especially on Windows cmd/PowerShell where the shell
 * never expands them either), so we discover test files ourselves and
 * pass them to node --test as explicit arguments.
 */
'use strict';

const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const testDir = __dirname;
const files = readdirSync(testDir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => join(testDir, f));

if (files.length === 0) {
    console.error(`No .test.js files found in ${testDir}`);
    process.exit(1);
}

console.log(`Running ${files.length} test file(s):`);
for (const f of files) console.log(`  - ${f.replace(`${testDir}/`, '')}`);
console.log('');

const result = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit',
});

process.exit(result.status ?? 1);
