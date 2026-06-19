#!/usr/bin/env node
/**
 * Consumer install smoke — verifies the published package layout works
 * without sibling-repo paths or env overrides.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const checks = [];

function assert(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  if (!ok) {
    process.stderr.write(`FAIL: ${label}${detail ? ` — ${detail}` : ''}\n`);
  }
}

assert('package name', pkg.name === '@0xray/repertoire');
assert('version present', typeof pkg.version === 'string' && pkg.version.length > 0);
assert('files field defined', Array.isArray(pkg.files) && pkg.files.length > 0);

const requiredPaths = [
  'dist/index.js',
  'dist/mcp/server.js',
  'dist/provider/memory-routing-provider.js',
  'scripts/verify-grok-suit.mjs',
  'scripts/suit-bridge-shared.mjs',
  'data/curated_signals.json',
  'LICENSE',
  'README.md',
];

for (const rel of requiredPaths) {
  assert(`exists ${rel}`, existsSync(join(repoRoot, rel)));
}

const { createMemoryRoutingProvider } = await import(
  pathToFileURL(join(repoRoot, 'dist/provider/memory-routing-provider.js')).href
);

const provider = createMemoryRoutingProvider();
assert('provider id', provider.id === 'repertoire');
assert('provider available', provider.isAvailable());

const trapTask = {
  id: 'consumer-smoke-trap',
  description: 'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation',
  type: 'governance',
};

const confidence = provider.getTaskConfidence?.(trapTask);
assert('getTaskConfidence returns', confidence != null);
assert(
  'trap detected in bundled registry',
  confidence?.highConfidenceTrapPresent === true,
  `got trap=${confidence?.highConfidenceTrapPresent}`,
);
assert(
  'recommendedAgent is architect',
  confidence?.recommendedAgent === 'architect',
  `got ${confidence?.recommendedAgent}`,
);

const mcpScript = pkg.scripts?.mcp ?? '';
assert('mcp npm script', mcpScript.includes('dist/mcp/server.js'));

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  process.stderr.write(`\n❌ Consumer smoke failed (${failed.length}/${checks.length})\n`);
  process.exit(1);
}

process.stdout.write(`✅ Consumer smoke passed (${checks.length} checks)\n`);