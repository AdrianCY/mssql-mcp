import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CLI entrypoint has a shebang and published bin target', async () => {
  const [entrySource, packageJsonText] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);

  const packageJson = JSON.parse(packageJsonText) as {
    bin?: Record<string, string>;
  };

  assert.ok(entrySource.startsWith('#!/usr/bin/env node\n'));
  assert.equal(packageJson.bin?.['mssql-mcp'], './dist/index.js');
});
