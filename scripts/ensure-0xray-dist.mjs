#!/usr/bin/env node
/**
 * GitHub-sourced 0xray installs ship without dist — build once if missing.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const xrayRoot = join(process.cwd(), 'node_modules', '0xray');
const distHook = join(xrayRoot, 'dist', 'integrations', 'grok', 'hooks', 'post-tool-use.js');

if (existsSync(distHook)) {
  process.exit(0);
}

if (!existsSync(join(xrayRoot, 'package.json'))) {
  console.warn('[ensure-0xray-dist] 0xray not installed — skip');
  process.exit(0);
}

console.log('[ensure-0xray-dist] building 0xray dist...');
execSync('npm run build', { cwd: xrayRoot, stdio: 'inherit' });