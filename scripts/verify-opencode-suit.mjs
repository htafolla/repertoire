#!/usr/bin/env node
/**
 * Verify OpenCode suit bridge for this consumer repo.
 * Run: node scripts/verify-opencode-suit.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { REPERTOIRE_MCP, XRAY_MCP_SERVERS } from './suit-bridge-shared.mjs';

const root = resolve(import.meta.dirname, '..');
let failed = 0;

function pass(name, detail = '') {
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. OpenCode CLI
try {
  const opencodePath = execSync('which opencode', { encoding: 'utf8' }).trim();
  pass('opencode cli', opencodePath);
} catch {
  fail('opencode cli', 'not on PATH');
}

// 2. Bridge artifacts
const pluginPath = join(root, '.opencode', 'plugin', 'xray-codex-injection.js');
existsSync(pluginPath) ? pass('codex injection plugin', pluginPath) : fail('codex injection plugin', 'run: npx 0xray opencode install --force');

const skillsDir = join(root, '.opencode', 'skills', 'orchestrator', 'SKILL.md');
existsSync(skillsDir) ? pass('orchestrator skill synced') : fail('orchestrator skill synced', 'missing');

// 3. opencode.json MCP entries
try {
  const config = JSON.parse(readFileSync(join(root, 'opencode.json'), 'utf8'));
  const mcp = config.mcp ?? {};
  const xrayEntries = XRAY_MCP_SERVERS.filter((s) => {
    const entry = mcp[s.name];
    return entry?.type === 'local' && entry?.enabled === true && Array.isArray(entry.command);
  });
  if (xrayEntries.length === 7) pass('opencode.json xray mcp', '7/7 enabled local');
  else fail('opencode.json xray mcp', `${xrayEntries.length}/7`);

  const rep = mcp[REPERTOIRE_MCP.name];
  if (rep?.enabled === true && rep?.type === 'local') pass('opencode.json repertoire mcp');
  else fail('opencode.json repertoire mcp', 'missing or disabled');
} catch (e) {
  fail('opencode.json mcp', e.message);
}

// 4. Plugin loaded in resolved config
try {
  const debug = execSync('opencode debug config 2>&1', { cwd: root, encoding: 'utf8', timeout: 15000 });
  if (debug.includes('xray-codex-injection.js')) pass('plugin in resolved config');
  else fail('plugin in resolved config', 'xray-codex-injection.js not found');
} catch (e) {
  fail('opencode debug config', e.message?.slice(0, 160));
}

// 5. opencode mcp list (runtime registry)
try {
  const listed = execSync('opencode mcp list 2>&1', { cwd: root, encoding: 'utf8', timeout: 20000 });
  const xrayListed = XRAY_MCP_SERVERS.filter((s) => listed.includes(s.name));
  if (xrayListed.length === 7) pass('opencode mcp list xray', '7/7');
  else fail('opencode mcp list xray', `${xrayListed.length}/7 — ${listed.slice(0, 200)}`);
  listed.includes(REPERTOIRE_MCP.name)
    ? pass('opencode mcp list repertoire')
    : fail('opencode mcp list repertoire', 'not listed');
} catch (e) {
  fail('opencode mcp list', e.message?.slice(0, 160));
}

// 6. Skills discoverable via OpenCode CLI (output can exceed 64KB — pipe to rg)
try {
  execSync('opencode debug skill 2>&1 | rg -q "orchestrator/SKILL.md"', {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    shell: '/bin/bash',
  });
  pass('opencode skills', 'orchestrator present');
} catch (e) {
  fail('opencode skills', e.message?.slice(0, 160));
}

// 7. .xray contract
for (const f of ['codex.json', 'features.json', 'config.json']) {
  existsSync(join(root, '.xray', f)) ? pass(`.xray/${f}`) : fail(`.xray/${f}`, 'missing');
}

// 8. MCP stdio probe
try {
  const init = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'verify-opencode-suit', version: '1.0' },
    },
  });
  const out = execSync(
    `printf '%s\\n' '${init.replace(/'/g, "'\\''")}' | timeout 12 npx 0xray mcp skills 2>/dev/null | head -1`,
    { cwd: root, encoding: 'utf8', shell: '/bin/bash' },
  );
  if (out.includes('serverInfo')) pass('MCP skills stdio probe');
  else fail('MCP skills stdio probe', out.slice(0, 120));
} catch (e) {
  fail('MCP skills stdio probe', e.message?.slice(0, 160));
}

// 9. npx 0xray health from consumer
try {
  execSync('npx 0xray health', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  pass('npx 0xray health');
} catch {
  fail('npx 0xray health');
}

console.log('\n' + (failed === 0 ? '🎉 OpenCode suit wearable.' : `⚠️  ${failed} OpenCode check(s) failed.`));
process.exit(failed === 0 ? 0 : 1);