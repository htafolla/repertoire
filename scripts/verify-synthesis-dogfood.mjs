#!/usr/bin/env node
/**
 * Dogfood synthesis on repertoire core — provider + xray nucleus + live Grok hook.
 * Run: npm run build && node scripts/verify-synthesis-dogfood.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const xrayRoot = join(root, 'node_modules/0xray');

let failed = 0;
function pass(n, d = '') {
  console.log(`✅ ${n}${d ? ` — ${d}` : ''}`);
}
function fail(n, d = '') {
  failed++;
  console.error(`❌ ${n}${d ? ` — ${d}` : ''}`);
}

const sessionId = 'repertoire-dogfood';

async function main() {
  if (!existsSync(join(root, 'dist/provider/memory-routing-provider.js'))) {
    fail('build', 'run npm run build first');
    process.exit(1);
  }

  const features = JSON.parse(readFileSync(join(root, '.xray/features.json'), 'utf8'));
  if (!features.synthesis?.enabled) fail('synthesis.enabled in features.json');
  else pass('synthesis.enabled in features.json');
  if (!features.memory_routing?.enabled) fail('memory_routing.enabled');
  else pass('memory_routing.enabled', features.memory_routing.provider);

  const { createMemoryRoutingProvider } = await import(
    join(root, 'dist/provider/memory-routing-provider.js')
  );
  const provider = createMemoryRoutingProvider(features.memory_routing.config ?? {});
  if (typeof provider.buildSynthesisContext !== 'function') {
    fail('provider.buildSynthesisContext');
  } else {
    const ctx = provider.buildSynthesisContext({
      projectRoot: root,
      dueReason: 'gate_threshold',
    });
    if (ctx && typeof ctx === 'object') pass('provider.buildSynthesisContext', 'non-null');
    else fail('provider.buildSynthesisContext', 'null');
  }

  if (typeof provider.refreshMetaInference === 'function') {
    try {
      const { refreshed } = await provider.refreshMetaInference();
      pass('provider.refreshMetaInference', String(refreshed));
    } catch (e) {
      fail('provider.refreshMetaInference', e.message);
    }
  } else {
    fail('provider.refreshMetaInference missing');
  }

  if (typeof provider.ingestFeedback === 'function') {
    try {
      const result = provider.ingestFeedback({
        timestamp: new Date().toISOString(),
        sessionId,
        taskId: 'dogfood-1',
        assignedAgent: 'researcher',
        memorySignals: ['synthesis-checkpoint'],
        complexity: 20,
        success: true,
        durationMs: 1200,
      });
      if (result?.logPath) pass('provider.ingestFeedback', result.logPath);
      else fail('provider.ingestFeedback', 'no logPath');
    } catch (e) {
      fail('provider.ingestFeedback', e.message);
    }
  }

  const { recordExecutionSlice, isSynthesisCheckpointDue, loadSynthesisCheckpointState } =
    await import(join(xrayRoot, 'dist/nucleus/synthesis.js'));
  const { evaluatePreToolGate, loadDelegationGateFeatures } = await import(
    join(xrayRoot, 'dist/integrations/hooks/delegation-gate-runtime.mjs'),
  );
  const { prepareSynthesisCollocatedContext } = await import(
    join(xrayRoot, 'dist/nucleus/synthesis-context.js'),
  );

  const tmp = mkdtempSync(join(tmpdir(), 'repertoire-synth-dogfood-'));
  mkdirSync(join(tmp, '.xray', 'state'), { recursive: true });
  const dogFeatures = {
    ...features,
    synthesis: { ...features.synthesis, every_n_gates: 1, every_n_turns: 0, every_n_todos_completed: 0 },
    memory_routing: {
      ...features.memory_routing,
      module_path: join(root, 'dist/provider/memory-routing-provider.js'),
    },
  };
  writeFileSync(join(tmp, '.xray/features.json'), JSON.stringify(dogFeatures, null, 2));

  try {
    recordExecutionSlice('gate', { projectRoot: tmp, sessionId });
    if (isSynthesisCheckpointDue(tmp, sessionId)) pass('nucleus gate slice → synthesis due');
    else fail('nucleus synthesis due');

    const gateFeatures = loadDelegationGateFeatures(tmp);
    const deny = evaluatePreToolGate(
      'search_replace',
      { path: 'src/a.ts', new_string: 'x' },
      { projectRoot: tmp, sessionId, features: gateFeatures, host: 'grok' },
    );
    if (!deny.allow && deny.gate === 'synthesis-checkpoint') {
      pass('evaluatePreToolGate denies write when due');
    } else {
      fail('evaluatePreToolGate deny', JSON.stringify(deny));
    }

    const collation = await prepareSynthesisCollocatedContext(root, 'gate_threshold');
    if (
      collation?.collatedText &&
      !collation.collatedText.includes('Enable memory_routing with Repertoire')
    ) {
      pass('prepareSynthesisCollocatedContext', 'repertoire collation');
    } else {
      fail('prepareSynthesisCollocatedContext', JSON.stringify(collation));
    }

    const cleared = loadSynthesisCheckpointState(tmp);
    if (cleared?.synthesisDue) pass('checkpoint still due before consult completion');
    else fail('checkpoint state');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const preToolHook = join(xrayRoot, 'dist/integrations/grok/hooks/pre-tool-use.js');
  const hookTmp = mkdtempSync(join(tmpdir(), 'repertoire-grok-hook-'));
  mkdirSync(join(hookTmp, '.xray', 'state'), { recursive: true });
  writeFileSync(
    join(hookTmp, '.xray', 'features.json'),
    JSON.stringify({
      synthesis: { enabled: true, every_n_gates: 12, every_n_turns: 0, every_n_todos_completed: 0 },
      multi_agent_orchestration: { enabled: true, lead_dev_mode: true },
    }),
  );
  const now = new Date().toISOString();
  writeFileSync(
    join(hookTmp, '.xray', 'state', 'synthesis-checkpoint.json'),
    JSON.stringify({
      version: 1,
      sessionId,
      slicesSinceLastSynthesis: { gates: 12, turns: 0, todosCompleted: 0 },
      lifetimeSlices: { gates: 12, turns: 0, todosCompleted: 0 },
      synthesisDue: true,
      dueReason: 'gate_threshold',
      lastSynthesisAt: null,
      lastSliceAt: now,
      synthesisCount: 0,
    }),
  );
  try {
    const payload = JSON.stringify({
      toolName: 'search_replace',
      workspaceRoot: hookTmp,
      sessionId,
      toolInput: { path: 'src/a.ts', new_string: 'x' },
    });
    const out = execSync(
      `printf '%s' '${payload.replace(/'/g, "'\\''")}' | node "${preToolHook}"`,
      {
        encoding: 'utf8',
        env: { ...process.env, GROK_WORKSPACE_ROOT: hookTmp, GROK_SESSION_ID: sessionId },
      },
    );
    const parsed = JSON.parse(out.trim());
    if (parsed.decision === 'deny' && parsed.gate === 'synthesis-checkpoint') {
      pass('live Grok pre-tool-use denies write when due');
    } else {
      fail('live Grok hook', JSON.stringify(parsed));
    }
  } finally {
    rmSync(hookTmp, { recursive: true, force: true });
  }

  console.log(
    '\n' +
      (failed === 0
        ? '🎉 Synthesis dogfood passed on repertoire core.'
        : `⚠️  ${failed} dogfood check(s) failed.`),
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});