#!/usr/bin/env node
/**
 * Live synthesis checkpoint driver — repertoire core (real .xray/state, not tmp).
 *
 * Usage:
 *   node scripts/run-live-synthesis-checkpoint.mjs seed [--session-id=ID]
 *   node scripts/run-live-synthesis-checkpoint.mjs status
 *   node scripts/run-live-synthesis-checkpoint.mjs complete-todo --id=s.1
 *   node scripts/run-live-synthesis-checkpoint.mjs finish
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const xrayRoot = join(root, 'node_modules/0xray');
const stateDir = join(root, '.xray', 'state');
const checkpointPath = join(stateDir, 'synthesis-checkpoint.json');
const planPath = join(stateDir, 'lead-dev-plan.json');

const DEFAULT_SESSION = 'live-synthesis-repertoire';

function parseSessionId() {
  const arg = process.argv.find((a) => a.startsWith('--session-id='));
  return arg?.split('=')[1] || process.env.GROK_SESSION_ID || DEFAULT_SESSION;
}

function loadFeatures() {
  return JSON.parse(readFileSync(join(root, '.xray/features.json'), 'utf8'));
}

async function loadXray() {
  const synthesis = await import(join(xrayRoot, 'dist/nucleus/synthesis.js'));
  const persistence = await import(join(xrayRoot, 'dist/nucleus/lead-dev-plan-persistence.js'));
  const kernel = await import(join(xrayRoot, 'dist/nucleus/autonomy-kernel.js'));
  return { synthesis, persistence, kernel };
}

async function cmdSeed() {
  const sessionId = parseSessionId();
  const features = loadFeatures();
  const threshold = features.synthesis?.every_n_gates ?? 12;
  if (!features.synthesis?.enabled) {
    console.error('❌ synthesis.enabled is false in .xray/features.json');
    process.exit(1);
  }

  mkdirSync(stateDir, { recursive: true });
  const { synthesis, kernel, persistence } = await loadXray();

  // Reset prior checkpoint for clean live run
  if (existsSync(checkpointPath)) {
    const prior = synthesis.loadSynthesisCheckpointState(root);
    if (prior?.synthesisDue) {
      console.log('ℹ️  Clearing prior due checkpoint for fresh live run');
    }
  }

  let becameDue = false;
  for (let i = 0; i < threshold; i++) {
    const result = synthesis.recordExecutionSlice('gate', { projectRoot: root, sessionId });
    if (result.becameDue) becameDue = true;
  }

  const state = synthesis.loadSynthesisCheckpointState(root);
  const due = synthesis.isSynthesisCheckpointDue(root, sessionId);

  console.log(`📊 sessionId: ${sessionId}`);
  console.log(`📊 gate slices recorded: ${threshold}`);
  console.log(`📊 synthesisDue: ${due}`);
  console.log(`📊 dueReason: ${state?.dueReason ?? 'null'}`);
  console.log(`📊 synthesisCount: ${state?.synthesisCount ?? 0}`);

  if (!due) {
    console.error('❌ Checkpoint not due after seeding');
    process.exit(1);
  }

  // Write session boot marker for hooks
  writeFileSync(
    join(stateDir, 'session-boot.json'),
    JSON.stringify(
      {
        hook: 'live-synthesis-seed',
        lead_dev_mode: true,
        sessionId,
        workspaceRoot: root,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log('\n✅ Live synthesis checkpoint SEEDED');
  console.log('Next: CallMcpTool xray-orchestrator analyze-complexity with sessionId');
  console.log(`      sessionId: "${sessionId}"`);
}

async function cmdStatus() {
  const sessionId = parseSessionId();
  const { synthesis, persistence } = await loadXray();
  const state = synthesis.loadSynthesisCheckpointState(root);
  const due = synthesis.isSynthesisCheckpointDue(root, sessionId);
  const plan = persistence.loadPersistedLeadDevPlan(root);
  const consultTodos = plan ? persistence.getSynthesisConsultTodos(plan) : [];

  console.log(JSON.stringify(
    {
      sessionId,
      synthesisDue: due,
      dueReason: state?.dueReason ?? null,
      synthesisCount: state?.synthesisCount ?? 0,
      planActive: plan?.active ?? false,
      phaseId: plan?.phases?.[0]?.id ?? null,
      consultTodos: consultTodos.map((t) => ({ id: t.id, subagent: t.subagent, status: t.status })),
    },
    null,
    2,
  ));
}

async function cmdCompleteTodo() {
  const todoId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
  if (!todoId) {
    console.error('Usage: complete-todo --id=s.1');
    process.exit(1);
  }
  const { persistence } = await loadXray();
  persistence.updatePlanTodoStatus(todoId, 'completed', root);
  const plan = persistence.loadPersistedLeadDevPlan(root);
  const todos = plan ? persistence.getSynthesisConsultTodos(plan) : [];
  const allDone = todos.length > 0 && todos.every((t) => t.status === 'completed');
  console.log(`✅ Marked ${todoId} completed`);
  console.log(`📊 consult todos: ${todos.map((t) => `${t.id}:${t.status}`).join(', ')}`);
  if (allDone) console.log('🎉 All consult todos complete — checkpoint should clear on next gate eval');
}

async function cmdFinish() {
  const sessionId = parseSessionId();
  const { synthesis } = await loadXray();
  const due = synthesis.isSynthesisCheckpointDue(root, sessionId);
  const state = synthesis.loadSynthesisCheckpointState(root);
  if (due) {
    console.error('❌ Checkpoint still due — complete all consult todos first');
    await cmdStatus();
    process.exit(1);
  }
  console.log('✅ Live synthesis checkpoint CLEARED');
  console.log(`📊 synthesisCount: ${state?.synthesisCount ?? 0}`);
  console.log(`📊 lastSynthesisAt: ${state?.lastSynthesisAt ?? 'null'}`);
}

const cmd = process.argv[2] || 'seed';
const handlers = {
  seed: cmdSeed,
  status: cmdStatus,
  'complete-todo': cmdCompleteTodo,
  finish: cmdFinish,
};

const handler = handlers[cmd];
if (!handler) {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
await handler();