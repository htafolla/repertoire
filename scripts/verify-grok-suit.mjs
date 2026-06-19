#!/usr/bin/env node
/**
 * Verify 0xRay suit is fully wearable in Grok Build for this repo.
 * Run: npm run build && node scripts/verify-grok-suit.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mcpStdioInitializeProbe } from './suit-bridge-shared.mjs';

function resolveVerifyRoot() {
  if (process.env.SUIT_VERIFY_ROOT) return resolve(process.env.SUIT_VERIFY_ROOT);
  if (existsSync(join(process.cwd(), '.xray', 'features.json'))) return process.cwd();
  return resolve(import.meta.dirname, '..');
}

function resolveMemoryProviderPath(projectRoot) {
  const local = join(projectRoot, 'dist/provider/memory-routing-provider.js');
  if (existsSync(local)) return local;
  const installed = join(
    projectRoot,
    'node_modules/@0xray/repertoire/dist/provider/memory-routing-provider.js',
  );
  if (existsSync(installed)) return installed;
  return local;
}

const root = resolveVerifyRoot();
let failed = 0;

function pass(name, detail = '') {
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function resolveLiveHook(name) {
  const candidates = [
    join(root, 'node_modules/0xray/dist/integrations/grok/hooks', name),
    join(homedir(), 'dev/xray/dist/integrations/grok/hooks', name),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function tailActivityLog(workspace, tailBytes = 32768) {
  const logFile = join(workspace, 'logs', 'framework', 'activity.log');
  if (!existsSync(logFile)) return '';
  const stat = statSync(logFile);
  const start = Math.max(0, stat.size - tailBytes);
  const buf = readFileSync(logFile).subarray(start);
  return buf.toString('utf8');
}

function runHook(hookPath, fixture, env = {}) {
  const payload = JSON.stringify(fixture);
  return execSync(`printf '%s' '${payload.replace(/'/g, "'\\''")}' | node "${hookPath}"`, {
    encoding: 'utf8',
    env: { ...process.env, GROK_WORKSPACE_ROOT: root, ...env },
  });
}

// 1. .xray layout
for (const f of ['codex.json', 'features.json', 'config.json']) {
  const p = join(root, '.xray', f);
  existsSync(p) ? pass(`.xray/${f}`) : fail(`.xray/${f}`, 'missing');
}

// 2. features.json contract
try {
  const features = JSON.parse(readFileSync(join(root, '.xray/features.json'), 'utf8'));
  let installedXrayVersion = 'unknown';
  try {
    const xrayPkg = JSON.parse(
      readFileSync(join(root, 'node_modules/0xray/package.json'), 'utf8'),
    );
    installedXrayVersion = xrayPkg.version ?? 'unknown';
  } catch {
    /* optional */
  }
  if (features.version === installedXrayVersion) {
    pass('features.json version', installedXrayVersion);
  } else {
    fail('features.json version', `got ${features.version}, expected ${installedXrayVersion}`);
  }
  if (features.inference_governance?.enabled) pass('inference_governance');
  else fail('inference_governance', 'not enabled');
  if (features.memory_routing?.enabled) pass('memory_routing');
  else fail('memory_routing', 'not enabled');
} catch (e) {
  fail('features.json parse', e.message);
}

// 3. Memory provider built (local dist or installed @0xray/repertoire)
const provider = resolveMemoryProviderPath(root);
existsSync(provider)
  ? pass('memory-routing-provider.js')
  : fail('memory-routing-provider.js', 'npm install @0xray/repertoire or npm run build');

// 4. .mcp.json — 7 xray + repertoire
try {
  const mcp = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'));
  const servers = Object.keys(mcp.mcpServers || {});
  const xrayCount = servers.filter((s) => s.startsWith('xray-')).length;
  if (xrayCount === 7) pass('.mcp.json xray servers', '7/7');
  else fail('.mcp.json xray servers', `${xrayCount}/7`);
  servers.includes('repertoire') ? pass('.mcp.json repertoire') : fail('.mcp.json repertoire', 'missing');
  const mcpRaw = readFileSync(join(root, '.mcp.json'), 'utf8');
  if (/\/Users\/[^"'\s]+/.test(mcpRaw)) {
    fail('.mcp.json portable paths', 'absolute /Users/ path in committed .mcp.json');
  } else {
    pass('.mcp.json portable paths');
  }
} catch (e) {
  fail('.mcp.json', e.message);
}

// 5. Grok plugin + UserPromptSubmit boot hook
const grokPlugin = join(homedir(), '.grok/plugins/0xray');
const grokHooks = join(grokPlugin, 'hooks/hooks.json');
existsSync(grokPlugin) ? pass('Grok plugin', grokPlugin) : fail('Grok plugin', 'run: npx 0xray grok install --force');
if (existsSync(grokHooks)) {
  const hooksRaw = readFileSync(grokHooks, 'utf8');
  hooksRaw.includes('session-start.js')
    ? pass('SessionStart hook')
    : fail('SessionStart hook', 're-run: npx 0xray grok install --force');
  hooksRaw.includes('pre-tool-use.js')
    ? pass('PreToolUse hook (live Grok path)')
    : fail('PreToolUse hook', 'missing from hooks.json');
  hooksRaw.includes('UserPromptSubmit')
    ? pass('UserPromptSubmit boot hook')
    : fail('UserPromptSubmit boot hook', 'add session-start.js — npx 0xray grok install --force');
} else {
  fail('Grok hooks.json', 'missing');
}

try {
  const features = JSON.parse(readFileSync(join(root, '.xray/features.json'), 'utf8'));
  if (features.multi_agent_orchestration?.lead_dev_mode) pass('lead_dev_mode in features.json');
  else fail('lead_dev_mode', 'not enabled');
  if (features.multi_agent_orchestration?.no_new_surface !== false) pass('no_new_surface in features.json');
  else fail('no_new_surface', 'disabled');
} catch (e) {
  fail('lead_dev_mode', e.message);
}

try {
  const codex = JSON.parse(readFileSync(join(root, '.xray/codex.json'), 'utf8'));
  if (codex.terms?.['69']) pass('codex term 69 (no new surface)');
  else fail('codex term 69', 'missing');
} catch (e) {
  fail('codex term 69', e.message);
}

// 6. 0xray package xray field (server-config-registry — no fallback)
try {
  const xrayPkg = JSON.parse(
    readFileSync(join(root, 'node_modules/0xray/package.json'), 'utf8'),
  );
  if (xrayPkg.xray?.mcpServersPath || xrayPkg.xray?.dist) pass('0xray package.json xray field');
  else fail('0xray package.json xray field', 'missing — npm link ~/dev/xray && rebuild');
} catch (e) {
  fail('0xray package.json xray field', e.message);
}

// 7. CLI health
try {
  execSync('npx 0xray health', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  pass('npx 0xray health');
} catch {
  fail('npx 0xray health');
}

const preToolHook = resolveLiveHook('pre-tool-use.js');
const sessionHook = resolveLiveHook('session-start.js');
if (!preToolHook) fail('Live PreToolUse hook path', 'not found in node_modules/0xray');
else pass('Live PreToolUse hook path', preToolHook);

if (!sessionHook) fail('Live SessionStart hook path', 'not found');
else pass('Live SessionStart hook path', sessionHook);

// 8. SessionStart → session-boot.json + activity.log
const bootPath = join(root, '.xray', 'state', 'session-boot.json');
const activityBefore = tailActivityLog(root);
if (sessionHook) {
  try {
    runHook(
      sessionHook,
      {
        hookEventName: 'session_start',
        sessionId: 'verify-suit-probe',
        workspaceRoot: root,
        cwd: root,
      },
      { GROK_HOOK_EVENT: 'session_start', GROK_SESSION_ID: 'verify-suit-probe' },
    );
    if (existsSync(bootPath)) {
      const boot = JSON.parse(readFileSync(bootPath, 'utf8'));
      if (boot.lead_dev_mode === true) pass('session-boot.json written', 'lead_dev_mode=true');
      else fail('session-boot.json', 'lead_dev_mode not true');
    } else {
      fail('session-boot.json', 'missing after SessionStart hook');
    }
    const activityAfter = tailActivityLog(root);
    if (/grok-session-start.*session-boot-written/.test(activityAfter)) {
      pass('SessionStart logged to activity.log');
    } else {
      fail('SessionStart activity.log', 'no grok-session-start entry');
    }
  } catch (e) {
    fail('SessionStart hook probe', e.message?.slice(0, 160));
  }
}

// 9. PreToolUse deny + activity.log (same path Grok uses live)
if (preToolHook) {
  try {
    const out = runHook(preToolHook, {
      toolName: 'search_replace',
      workspaceRoot: root,
      toolInput: { path: 'src/mcps/new-thing.server.ts', new_string: 'export {}' },
    });
    if (/"decision"\s*:\s*"deny"/.test(out)) pass('PreToolUse deny (live hook path)');
    else fail('PreToolUse deny', `got: ${out.slice(0, 120)}`);

    const activity = tailActivityLog(root);
    if (/grok-pre-tool-use.*deny/.test(activity)) {
      pass('PreToolUse deny logged to activity.log');
    } else {
      fail('PreToolUse activity.log', 'no grok-pre-tool-use deny entry');
    }
  } catch (e) {
    fail('PreToolUse hook probe', e.message?.slice(0, 160));
  }
}

// 10. MCP enforcer stdio + no server-config-registry fallback (Node probe — no GNU timeout)
const activityBeforeEnforcer = tailActivityLog(root);
try {
  await mcpStdioInitializeProbe({
    cwd: root,
    command: 'npx',
    args: ['0xray', 'mcp', 'enforcer'],
    timeoutMs: 6000,
  });
  pass('MCP enforcer stdio');

  const activityNew = tailActivityLog(root).slice(activityBeforeEnforcer.length);
  if (/using-fallback-path/.test(activityNew)) {
    fail('server-config-registry', 'using-fallback-path in activity.log after enforcer boot');
  } else {
    pass('server-config-registry resolved (no fallback warning)');
  }
} catch (e) {
  fail('MCP enforcer stdio', e.message?.slice(0, 120));
}

// 11. Orchestrator behavior assertions (0xray@3.4.10+)
const behaviorScript = join(root, 'node_modules/0xray/scripts/mjs/verify-orchestrator-behavior.mjs');
if (!existsSync(behaviorScript)) {
  fail('Orchestrator behavior assertions', 'missing script — npm install 0xray@^3.4.10');
} else {
  try {
    execSync(`node "${behaviorScript}"`, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    pass('Orchestrator behavior assertions');
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || '').toString().slice(0, 160);
    fail('Orchestrator behavior assertions', detail);
  }
}

console.log('\n' + (failed === 0 ? '🎉 Suit wearable — operate within 0xRay.' : `⚠️  ${failed} check(s) failed — fix before tuning.`));
process.exit(failed === 0 ? 0 : 1);