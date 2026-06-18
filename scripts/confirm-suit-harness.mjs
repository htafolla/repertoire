#!/usr/bin/env node
/**
 * Post-reboot harness confirmation protocol.
 * Run after Grok Build session start: npm run confirm:suit
 *
 * Layer 1: filesystem + CLI (verify-grok-suit.mjs)
 * Layer 2a: stdio MCP probes (repertoire memory routing — bypasses harness prefix bug)
 * Layer 2b: harness MCP probes (agent runs CallMcpTool live — documented below)
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readInstalledXrayVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, 'node_modules/0xray/package.json'), 'utf8'),
    );
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function mcpStdioProbe({ serverPath, toolName, args, timeoutMs = 4000 }) {
  return new Promise((resolveProbe, rejectProbe) => {
    const messages = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'confirm-suit-harness', version: '1.0' },
        },
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      },
    ];

    const proc = spawn('node', [serverPath], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      out += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      rejectProbe(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0 && !out.includes('"result"')) {
        rejectProbe(new Error(`exit ${code}: ${out.slice(0, 200)}`));
        return;
      }
      resolveProbe(out);
    });

    for (const msg of messages) {
      proc.stdin.write(`${JSON.stringify(msg)}\n`);
    }
    setTimeout(() => proc.kill('SIGTERM'), timeoutMs - 200);
  });
}

console.log('═══ 0xRay Suit Confirmation Protocol ═══\n');

// ── Layer 1 ──────────────────────────────────────────────────────────────────
console.log('Layer 1 — Local install (automated)\n');
let layer1Ok = false;
try {
  execSync('node scripts/verify-grok-suit.mjs', { cwd: root, stdio: 'inherit' });
  layer1Ok = true;
} catch {
  console.error('\n❌ Layer 1 FAILED — fix before harness probes\n');
  process.exit(1);
}

// ── Layer 2a — stdio probes ──────────────────────────────────────────────────
console.log('\nLayer 2a — Stdio MCP probes (automated)\n');
const layer2a = [];

const repertoireServer = resolve(root, 'dist/mcp/server.js');
if (!existsSync(repertoireServer)) {
  console.error('❌ repertoire stdio — dist/mcp/server.js missing (run npm run build)');
  layer2a.push({ name: 'repertoire stdio', ok: false });
} else {
  try {
    const out = await mcpStdioProbe({
      serverPath: repertoireServer,
      toolName: 'repertoire__get_task_confidence',
      args: { description: 'Confirm 0xRay suit worn after reboot' },
    });
    const ok =
      out.includes('repertoire__get_task_confidence') ||
      out.includes('recommendedAgent') ||
      out.includes('highConfidenceTrapPresent');
    layer2a.push({ name: 'repertoire__get_task_confidence (stdio)', ok });
    console.log(ok ? '✅ repertoire__get_task_confidence (stdio)' : '❌ repertoire stdio — unexpected response');
  } catch (e) {
    layer2a.push({ name: 'repertoire stdio', ok: false });
    console.error(`❌ repertoire stdio — ${e.message}`);
  }
}

// ── Layer 2b — harness checklist (agent-verified) ──────────────────────────
console.log('\nLayer 2b — Harness MCP probes (agent CallMcpTool after reboot)\n');
const harnessProbes = [
  { server: 'xray-enforcer', tool: 'get-enforcement-status', key: 'totalRules' },
  { server: 'xray-enforcer', tool: 'codex-enforcement', key: 'termsValidated', args: { operation: 'suit-probe' } },
  { server: 'xray-skills', tool: 'list-skills', key: 'Skills' },
  { server: 'xray-orchestrator', tool: 'analyze-complexity', key: 'Complexity', args: { tasks: [{ description: 'suit probe', type: 'verification' }] } },
  { server: 'xray-governance', tool: 'get_active_codex', key: 'term_count' },
  { server: 'xray-researcher', tool: 'get_documentation', key: 'Documentation', args: { target: 'RepertoireService' } },
  { server: 'xray-architect-tools', tool: 'context-analysis', key: 'codebaseStructure', args: { query: 'suit probe' } },
  { server: 'xray-code-review', tool: 'check_best_practices', key: 'Compliance', args: { filePath: `${root}/src/mcp/server.ts`, language: 'typescript' } },
  { server: 'Dynamo', tool: 'get_docs', key: 'docs' },
  {
    server: 'repertoire',
    tool: 'get_task_confidence',
    key: 'harness-broken',
    note: 'harness double-prefixes repertoire__ — use Layer 2a stdio instead',
  },
];

for (const p of harnessProbes) {
  const note = p.note ? ` (${p.note})` : '';
  console.log(`  □ ${p.server} → ${p.tool}${note}`);
}

// ── Layer 3 — verdict ────────────────────────────────────────────────────────
const layer2aOk = layer2a.every((c) => c.ok);
console.log(`
Layer 3 — Suit worn verdict (automated portion)
  Layer 1: ${layer1Ok ? 'GREEN' : 'RED'}
  Layer 2a repertoire stdio: ${layer2aOk ? 'GREEN' : 'RED'}

  FULL    = Layer 1 green + Layer 2a green + all Layer 2b harness probes respond
  PARTIAL = Layer 1 green + core harness MCPs live (enforcer, skills, orchestrator, governance, Dynamo)
  BROKEN  = Layer 1 fails OR core MCPs unreachable

Harness note: repertoire tools are registered as repertoire__* — Grok harness prepends
server name again (repertoire__repertoire__*). Memory routing works via stdio (Layer 2a).

Version: npm 0xray@${readInstalledXrayVersion()} from node_modules (no npm link)
`);

if (layer1Ok && layer2aOk) {
  console.log('✅ Automated checks PASS — agent should confirm Layer 2b harness probes for FULL verdict.');
  process.exit(0);
}

console.error('❌ Automated checks FAILED — suit not ready.');
process.exit(1);