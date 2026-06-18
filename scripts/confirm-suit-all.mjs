#!/usr/bin/env node
/**
 * Unified 0xRay suit wear matrix — all 4 plugin environments.
 *
 * Usage:
 *   node scripts/confirm-suit-all.mjs              # verify all bridges (no install)
 *   node scripts/confirm-suit-all.mjs --install    # native 0xray install + verify
 *   node scripts/confirm-suit-all.mjs --grok-harness  # include Grok Layer 2a/2c harness
 *   node scripts/confirm-suit-all.mjs --only=hermes,opencode
 *
 * npm scripts:
 *   verify:suit:all   — matrix verify only
 *   confirm:suit:all  — build + install all + verify + Grok harness + trap-routing test
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { HERMES_PLUGIN_DIR, readInstalledXrayVersion } from './suit-bridge-shared.mjs';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);

const flags = {
  install: args.includes('--install'),
  grokHarness: args.includes('--grok-harness'),
  verifyOnly: args.includes('--verify-only'),
};
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlySet = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim().toLowerCase()))
  : null;

/** Hermes last — consumer root marker must win over any stale npx-cache path. */
const BRIDGES = [
  {
    id: 'grok',
    label: 'Grok Build',
    cli: null,
    installCmd: 'npx 0xray grok install --force',
    verifyScript: 'verify-grok-suit.mjs',
    harnessScript: 'confirm-suit-harness.mjs',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    cli: 'opencode',
    installCmd: 'npx 0xray opencode install --force',
    verifyScript: 'verify-opencode-suit.mjs',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    cli: 'openclaw',
    installCmd: 'npx 0xray openclaw install --force',
    verifyScript: 'verify-openclaw-suit.mjs',
  },
  {
    id: 'hermes',
    label: 'Hermes',
    cli: 'hermes',
    installCmd: 'npx 0xray hermes install --force',
    verifyScript: 'verify-hermes-suit.mjs',
  },
];

function ensureHermesConsumerRoot() {
  const markerPath = join(HERMES_PLUGIN_DIR, 'xray-consumer-root.txt');
  if (!existsSync(markerPath)) return;
  const marked = readFileSync(markerPath, 'utf8').trim();
  if (marked === root) return;
  if (!cliAvailable('hermes')) return;
  console.log(`⚠  Hermes consumer root drift (${marked}) — re-running hermes install\n`);
  runInstall('npx 0xray hermes install --force');
}

function bridgeEnabled(bridge) {
  return !onlySet || onlySet.has(bridge.id);
}

function cliAvailable(cmd) {
  if (!cmd) return true;
  try {
    execSync(`which ${cmd}`, { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function runScript(scriptName, { inheritOutput = true } = {}) {
  const scriptPath = join(root, 'scripts', scriptName);
  if (!existsSync(scriptPath)) {
    return { ok: false, status: 'error', detail: `${scriptName} missing` };
  }
  const result = spawnSync('node', [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: inheritOutput ? 'inherit' : ['inherit', 'pipe', 'pipe'],
  });
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const failCount = (combined.match(/❌/g) ?? []).length;
  return {
    ok: result.status === 0,
    status: result.status === 0 ? 'green' : 'red',
    detail: result.status === 0 ? 'wearable' : `${failCount || 1} check(s) failed`,
    exitCode: result.status ?? 1,
  };
}

function runInstall(cmd) {
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e.message?.slice(0, 120) ?? 'install failed' };
  }
}

console.log('═══ 0xRay Suit Wear Matrix (4 plugin environments) ═══\n');
console.log(`0xray@${readInstalledXrayVersion()} · consumer ${root}\n`);

if (flags.install) {
  console.log('Phase 0 — Native bridge install (--install)\n');
  for (const bridge of BRIDGES) {
    if (!bridgeEnabled(bridge)) continue;
    if (bridge.cli && !cliAvailable(bridge.cli)) {
      console.log(`⏭  ${bridge.label} install skipped — ${bridge.cli} not on PATH`);
      continue;
    }
    console.log(`→ ${bridge.installCmd}`);
    const install = runInstall(bridge.installCmd);
    if (!install.ok) {
      console.error(`❌ ${bridge.label} install failed — ${install.detail}`);
    }
  }
  ensureHermesConsumerRoot();
  console.log('');
}

const matrix = [];

console.log('Phase 1 — Per-bridge verification\n');
for (const bridge of BRIDGES) {
  if (!bridgeEnabled(bridge)) continue;

  if (bridge.cli && !cliAvailable(bridge.cli)) {
    matrix.push({
      id: bridge.id,
      label: bridge.label,
      status: 'skip',
      detail: `${bridge.cli} not on PATH`,
    });
    console.log(`⏭  ${bridge.label} — skipped (${bridge.cli} not installed)\n`);
    continue;
  }

  console.log(`── ${bridge.label} (${bridge.verifyScript}) ──\n`);
  const verify = runScript(bridge.verifyScript);
  matrix.push({
    id: bridge.id,
    label: bridge.label,
    status: verify.status,
    detail: verify.detail,
  });
  console.log('');
}

let grokHarnessOk = null;
if (flags.grokHarness && bridgeEnabled(BRIDGES[0])) {
  console.log('Phase 2 — Grok harness (Layer 2a + 2c stdio probes)\n');
  const harnessResult = spawnSync(
    'node',
    [join(root, 'scripts', 'confirm-suit-harness.mjs'), '--skip-layer1'],
    { cwd: root, encoding: 'utf8', stdio: 'inherit' },
  );
  const harness = {
    ok: harnessResult.status === 0,
    detail: harnessResult.status === 0 ? 'automated probes pass' : 'harness probe(s) failed',
  };
  grokHarnessOk = harness.ok;
  if (!harness.ok) {
    matrix.push({
      id: 'grok-harness',
      label: 'Grok harness (2a/2c)',
      status: 'red',
      detail: harness.detail,
    });
  } else {
    matrix.push({
      id: 'grok-harness',
      label: 'Grok harness (2a/2c)',
      status: 'green',
      detail: 'automated probes pass',
    });
  }
  console.log('');
}

// ── Wear matrix verdict ─────────────────────────────────────────────────────
console.log('Suit wear matrix\n');
const statusIcon = { green: '✅', red: '❌', skip: '⏭ ' };
for (const row of matrix) {
  const icon = statusIcon[row.status] ?? '?';
  console.log(`  ${icon} ${row.label.padEnd(22)} ${row.detail}`);
}

const verified = matrix.filter((r) => r.status !== 'skip');
const allGreen = verified.length > 0 && verified.every((r) => r.status === 'green');
const anyRed = verified.some((r) => r.status === 'red');
const skipped = matrix.filter((r) => r.status === 'skip').length;

console.log(`
Summary
  Green:   ${verified.filter((r) => r.status === 'green').length}/${verified.length}
  Skipped: ${skipped} (CLI not on PATH)
  0xray:   ${readInstalledXrayVersion()}

Verdict
  FULL    = all enabled bridges green${flags.grokHarness ? ' + Grok harness green' : ''}
  PARTIAL = Grok green + ≥1 other bridge red/skipped
  BROKEN  = Grok red OR core MCP surface unreachable

Grok Layer 2b (harness CallMcpTool) is agent-verified after reboot — see confirm-suit-harness.mjs.
`);

if (anyRed) {
  console.error('❌ Suit wear matrix FAILED — fix red bridges before operating.');
  process.exit(1);
}

if (flags.grokHarness && grokHarnessOk === false) {
  console.error('❌ Grok harness FAILED — memory routing / stdio probes not ready.');
  process.exit(1);
}

console.log('✅ Suit wear matrix PASS — all verified bridges wearable.');
process.exit(0);