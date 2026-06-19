#!/usr/bin/env node
/**
 * Verify Hermes suit bridge for this consumer repo.
 * Run: node scripts/verify-hermes-suit.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  HERMES_CONFIG_PATH,
  HERMES_PLUGIN_DIR,
  REPERTOIRE_MCP,
  XRAY_MCP_SERVERS,
  ensureConsumerRootMarker,
} from './suit-bridge-shared.mjs';

const root = resolve(import.meta.dirname, '..');
ensureConsumerRootMarker(
  join(HERMES_PLUGIN_DIR, 'xray-consumer-root.txt'),
  'npx 0xray hermes install --force',
);
let failed = 0;

function pass(name, detail = '') {
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. Hermes CLI
try {
  const hermesPath = execSync('which hermes', { encoding: 'utf8' }).trim();
  pass('hermes cli', hermesPath);
} catch {
  fail('hermes cli', 'not on PATH');
}

// 2. Plugin installed
const pluginYaml = join(HERMES_PLUGIN_DIR, 'plugin.yaml');
existsSync(pluginYaml) ? pass('xray-hermes plugin', HERMES_PLUGIN_DIR) : fail('xray-hermes plugin', 'run: npx 0xray hermes install --force');

// 3. Consumer root marker
const markerPath = join(HERMES_PLUGIN_DIR, 'xray-consumer-root.txt');
if (existsSync(markerPath)) {
  const marked = readFileSync(markerPath, 'utf8').trim();
  marked === root ? pass('consumer root marker', root) : fail('consumer root marker', `got ${marked}`);
} else {
  fail('consumer root marker', 'missing');
}

// 4. Plugin enabled
try {
  const plugins = execSync('hermes plugins list 2>&1', { encoding: 'utf8' })
    .replace(/\x1b\[[0-9;]*m/g, '');
  const enabledLine = plugins.split('\n').find((line) => /│\s*0xray-hermes\b/.test(line));
  if (enabledLine?.includes('enabled') && !enabledLine.includes('not enabled')) {
    pass('0xray-hermes plugin enabled');
  } else {
    fail('0xray-hermes plugin enabled', 'run: hermes plugins enable 0xray-hermes');
  }
} catch (e) {
  fail('0xray-hermes plugin enabled', e.message?.slice(0, 120));
}

// 5. Plugin .mcp.json
try {
  const pluginMcp = JSON.parse(readFileSync(join(HERMES_PLUGIN_DIR, '.mcp.json'), 'utf8'));
  const names = Object.keys(pluginMcp.mcpServers ?? {});
  const xrayCount = names.filter((n) => n.startsWith('xray-')).length;
  if (xrayCount === 7) pass('plugin .mcp.json xray servers', '7/7');
  else fail('plugin .mcp.json xray servers', `${xrayCount}/7`);
} catch (e) {
  fail('plugin .mcp.json', e.message);
}

// 6. Hermes config mcp_servers
try {
  const listScript = join(root, 'scripts', 'list-hermes-mcp-servers.py');
  const out = execSync(`python3 "${listScript}" "${HERMES_CONFIG_PATH}"`, { encoding: 'utf8' });
  const { names } = JSON.parse(out.trim());
  const xrayCount = names.filter((n) => n.startsWith('xray-')).length;
  if (xrayCount === 7) pass('config.yaml mcp_servers xray', '7/7');
  else fail('config.yaml mcp_servers xray', `${xrayCount}/7`);
  names.includes(REPERTOIRE_MCP.name)
    ? pass('config.yaml mcp_servers repertoire')
    : fail('config.yaml mcp_servers repertoire', 'missing');
} catch (e) {
  fail('config.yaml mcp_servers', e.message?.slice(0, 160));
}

// 7. Bridge health
try {
  const out = execSync(
    `printf '%s' '{"command":"health"}' | node "${join(HERMES_PLUGIN_DIR, 'bridge.mjs')}" --cwd "${root}"`,
    { encoding: 'utf8', cwd: root, env: { ...process.env, XRAY_ROOT: root } },
  );
  const health = JSON.parse(out.trim());
  if (health.framework === 'loaded') pass('bridge health', 'framework loaded');
  else fail('bridge health', JSON.stringify(health).slice(0, 120));
  if (health.projectRoot === root) pass('bridge projectRoot', root);
  else fail('bridge projectRoot', `got ${health.projectRoot}`);
} catch (e) {
  fail('bridge health', e.message?.slice(0, 160));
}

// 8. .xray contract (shared with Grok)
for (const f of ['codex.json', 'features.json', 'config.json']) {
  existsSync(join(root, '.xray', f)) ? pass(`.xray/${f}`) : fail(`.xray/${f}`, 'missing');
}

// 9. MCP enforcer stdio (same surface Hermes mcp_servers uses)
try {
  const init = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'verify-hermes-suit', version: '1.0' },
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

// 10. Plugin tool surface (plugin.yaml — live session loads on restart)
try {
  const pluginYaml = readFileSync(join(HERMES_PLUGIN_DIR, 'plugin.yaml'), 'utf8');
  const pluginTools = ['xray_validate', 'xray_codex_check', 'xray_health', 'xray_hooks'];
  const found = pluginTools.filter((t) => pluginYaml.includes(t));
  if (found.length === pluginTools.length) pass('plugin tools (plugin.yaml)', pluginTools.join(', '));
  else fail('plugin tools (plugin.yaml)', `found ${found.length}/4`);
} catch (e) {
  fail('plugin tools (plugin.yaml)', e.message?.slice(0, 120));
}

// 11. Delegation gate fixture (0xray@3.5.1+)
const hermesGateScript = join(root, 'node_modules/0xray/scripts/mjs/verify-hermes-delegation-gate.mjs');
if (existsSync(hermesGateScript)) {
  try {
    execSync(`node "${hermesGateScript}"`, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    pass('Hermes delegation gate fixture', '4/4');
  } catch (e) {
    const detail = (e.stdout || e.stderr || e.message || '').split('\n').slice(-3).join(' ').slice(0, 160);
    fail('Hermes delegation gate fixture', detail);
  }
} else {
  fail('Hermes delegation gate fixture', 'missing script — npm install 0xray@^3.5.1');
}

console.log('\n' + (failed === 0 ? '🎉 Hermes suit wearable.' : `⚠️  ${failed} Hermes check(s) failed.`));
process.exit(failed === 0 ? 0 : 1);