#!/usr/bin/env node
/**
 * Verify OpenClaw suit bridge for this consumer repo (native 0xray install).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { REPERTOIRE_MCP, XRAY_MCP_SERVERS, ensureConsumerRootMarker } from './suit-bridge-shared.mjs';

const root = resolve(import.meta.dirname, '..');
const OPENCLAW_STATE = join(homedir(), '.openclaw');
ensureConsumerRootMarker(
  join(OPENCLAW_STATE, 'xray-consumer-root.txt'),
  'npx 0xray openclaw install --force',
);
const OPENCLAW_CONFIG = join(OPENCLAW_STATE, 'openclaw.json');
let failed = 0;

function pass(name, detail = '') {
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. OpenClaw CLI
try {
  const openclawPath = execSync('which openclaw', { encoding: 'utf8' }).trim();
  pass('openclaw cli', openclawPath);
} catch {
  fail('openclaw cli', 'not on PATH');
}

// 2. Consumer integration config
const consumerConfig = join(root, '.xray', 'config', 'openclaw.json');
existsSync(consumerConfig)
  ? pass('consumer openclaw.json', consumerConfig)
  : fail('consumer openclaw.json', 'run npx 0xray openclaw install');

// 3. Consumer root marker
const markerPath = join(OPENCLAW_STATE, 'xray-consumer-root.txt');
if (existsSync(markerPath)) {
  const marked = readFileSync(markerPath, 'utf8').trim();
  marked === root ? pass('consumer root marker', root) : fail('consumer root marker', `got ${marked}`);
} else {
  fail('consumer root marker', 'missing');
}

// 4. xray-orchestrator skill synced
const orchestratorSkill = join(OPENCLAW_STATE, 'skills', 'xray-orchestrator', 'SKILL.md');
existsSync(orchestratorSkill)
  ? pass('xray-orchestrator skill', orchestratorSkill)
  : fail('xray-orchestrator skill', 'missing');

// 5. openclaw mcp list
try {
  const listed = execSync('openclaw mcp list 2>&1', { encoding: 'utf8', timeout: 20000 });
  const xrayListed = XRAY_MCP_SERVERS.filter((s) => listed.includes(s.name));
  if (xrayListed.length === 7) pass('openclaw mcp list xray', '7/7');
  else fail('openclaw mcp list xray', `${xrayListed.length}/7`);
  listed.includes(REPERTOIRE_MCP.name)
    ? pass('openclaw mcp list repertoire')
    : fail('openclaw mcp list repertoire', 'not listed');
} catch (e) {
  fail('openclaw mcp list', e.message?.slice(0, 160));
}

// 6. openclaw.json mcp.servers block
try {
  const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf8'));
  const servers = config.mcp?.servers ?? {};
  const xrayCount = Object.keys(servers).filter((n) => n.startsWith('xray-')).length;
  if (xrayCount === 7) pass('openclaw.json mcp.servers xray', '7/7');
  else fail('openclaw.json mcp.servers xray', `${xrayCount}/7`);
  if (servers[REPERTOIRE_MCP.name]) pass('openclaw.json mcp.servers repertoire');
  else fail('openclaw.json mcp.servers repertoire', 'missing');
  if (servers['xray-enforcer']?.env?.XRAY_ROOT === root) {
    pass('openclaw mcp XRAY_ROOT', root);
  } else {
    fail('openclaw mcp XRAY_ROOT', `got ${servers['xray-enforcer']?.env?.XRAY_ROOT}`);
  }
} catch (e) {
  fail('openclaw.json mcp.servers', e.message?.slice(0, 160));
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
      clientInfo: { name: 'verify-openclaw-suit', version: '1.0' },
    },
  });
  const out = execSync(
    `printf '%s\\n' '${init.replace(/'/g, "'\\''")}' | timeout 12 npx 0xray mcp enforcer 2>/dev/null | head -1`,
    { cwd: root, encoding: 'utf8', shell: '/bin/bash' },
  );
  if (out.includes('serverInfo')) pass('MCP enforcer stdio probe');
  else fail('MCP enforcer stdio probe', out.slice(0, 120));
} catch (e) {
  fail('MCP enforcer stdio probe', e.message?.slice(0, 160));
}

// 9. npx 0xray health
try {
  execSync('npx 0xray health', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  pass('npx 0xray health');
} catch {
  fail('npx 0xray health');
}

console.log('\n' + (failed === 0 ? '🎉 OpenClaw suit wearable.' : `⚠️  ${failed} OpenClaw check(s) failed.`));
process.exit(failed === 0 ? 0 : 1);