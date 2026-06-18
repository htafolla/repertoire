# Repertoire — Deep Memory, Synthesis & Orchestrator Enrichment

**Subsystem of:** CronOs / 0xRay / Groover stack  
**Status:** Foundation (Phase 1–3 implementable from this document)  
**Canonical primitive registry:** `data/curated_signals.json` (schema v1.1)

---

## 1. Purpose & Vision

Repertoire is the architectural mind and long-term memory of the stack. It digests raw activity from Groover, 0xRay, Dynamo, and Chrono through iterative brain-dumps and capped meta-inference, turning velocity into governed wisdom and coherent evolution.

**North-star outcome:** 0xRay stops being a stateless executor. The orchestrator routes with memory — `curated_signals.json` becomes a first-class input to `thinDispatch`, `AgentCapabilitiesManager`, and `ExecutionPlanner`.

```
Inference (0xRay + Groover)
        ↓
Repertoire (Memory + Deep Synthesis + Primitive Registry)
        ↓
External Governance (Dynamo)
        ↓
Autonomous Engine (0xRay Orchestrator + thinDispatch)
        ↑
        └── Feedback loop (orchestrator decisions + Dynamo outcomes)
```

---

## 2. Code Digest — What Exists Today

### 2.1 Groover (`htafolla/groover`)

| Component | Location | Behavior |
|-----------|----------|----------|
| Inference logging | `deploy/moltbook-engage.ts` | Hermes v2-negative-space-closure → JSONL in `research/groover-inference-logs/` |
| Meta-inference | `research/run-meta-inference.mjs` | `BATCH_SIZE=1`, `MAX_ENTRIES=8`, Hermes batches → 5-section synthesis |
| Primitive registry | `curated_signals.json` | 8 ontological-trap primitives with evaluation criteria + validation experiments |
| State | `.moltbot/inference-state.json` | `processedCommentIds`, `lastRun` |
| Governance | `deploy/moltbook-engage.ts:247` | `govern_with_solar` before reply; skips if `rec !== PASS && resonance < 0.75` |

**Critical finding:** `governWithSolar` returns `null` on fetch failure (line 80–83). Ontological-trap entries often log `Dynamo: N/A` in meta-inference because `dynamo_result` is never written back to JSONL — the governance loop is open at write-time, not just evaluation-time.

**Design invariant (intentional):** `BATCH_SIZE=1` preserves signal integrity. Do not batch Hermes calls.

### 2.2 0xRay Inference (`0xRayAI/xray/src/inference`)

| Component | Location | Behavior |
|-----------|----------|----------|
| Inference cycle | `inference-cycle.ts` | Corpus → proposals → governance votes → apply |
| Session capture | `session-capture.ts` | Git-span structural patterns → `docs/inference/session-*.json` |
| Improvement processor | `inference-improvement-processor.ts` | Triggers multi-agent workflow; writes `workflow-*.json` + agent prompts |
| Semantic patterns | `semantic-patterns.ts` | Recurring problems, wrong turns |

**Gap:** No write path to a shared Repertoire JSONL format. Sessions stay project-local.

### 2.3 0xRay Orchestrator (`0xRayAI/xray/src/mcps/orchestrator` + `src/nucleus`)

Three routing surfaces exist — Repertoire must enrich all three:

#### A. MCP Orchestrator (`mcps/orchestrator/`)

```58:84:xray/src/mcps/orchestrator/config/agent-capabilities.ts
  selectAgentForTask(requiredCapabilities: string[], complexity: number): string | null {
    let bestAgent: string | null = null;
    let bestScore = -1;

    for (const [agent, caps] of this.capabilities) {
      if (complexity > caps.complexityThreshold) continue;

      const matchCount = requiredCapabilities.filter(cap =>
        caps.capabilities.includes(cap)
      ).length;

      const score = matchCount * 10 + caps.concurrentTasks;
      // ...
    }
    return bestAgent;
  }
```

- Scores only on `task.type` vs `capabilities[]` — no primitive awareness.
- `ExecutionPlanner.assignTasksToAgents` passes `[task.type]` only (line 200–202).
- `AsideContextOptions.inheritedContext` exists but is never populated with Repertoire data.

#### B. thinDispatch (`src/nucleus/thin-dispatch.ts`)

```77:85:xray/src/nucleus/thin-dispatch.ts
export function scoreAndRoute(
  operation: string,
  context: unknown,
  thresholds?: ComplexityThresholds
): { score: ComplexityScore; agent: string } {
  const score = scoreComplexity(operation, context, thresholds);
  const agent = routeToAgent(score);
  return { score, agent };
}
```

- `routeToAgent` uses tier → agent map from `complexity-core.ts` (low → code-reviewer, enterprise → architect).
- `context` is opaque — no hook for matched primitives or synthesis reports.

#### C. AgentDelegator (`src/delegation/agent-delegator.ts`)

- Full delegation pipeline with `routingOutcomeTracker`, predictive analytics, keyword routing.
- Separate `AgentCapability` interface from MCP orchestrator — integration must bridge both.

### 2.4 Verifiable Agent Ecosystem (`htafolla/verifiable-agent-ecosystem`)

- `inference-harness/` — TypeScript types for `InferenceRun`, `DynamoTrace`, `GrooverAction` (Phase 5 sketch).
- `brain-dumps/PASS-*` — design passes for harness + 0xRay governance integration.
- **Gap:** Harness not wired to production Groover or 0xRay paths.

---

## 3. Target Architecture

```
repertoire/
├── data/
│   ├── curated_signals.json          # Canonical primitive registry (v1.1)
│   ├── inference-state.json            # Processed ID tracking
│   └── synthesis/                      # Structured reports
├── logs/
│   ├── groover-inference/              # Unified JSONL (Groover + 0xRay)
│   ├── orchestrator-feedback/          # Routing outcomes + Dynamo results
│   └── meta-inference/                 # Append-only synthesis reports
├── schemas/
│   ├── inference-log.schema.json
│   └── curated-signal.schema.json
└── src/
    ├── ingestion/                      # Groover + 0xRay log writers
    ├── synthesis/                      # MetaInferenceEngine (BATCH_SIZE=1)
    ├── registry/                       # CuratedSignalsManager
    ├── governance/                     # Ontological-trap enforcer
    └── orchestrator-bridge/            # Signal injection for 0xRay
```

---

## 4. Data Flow

### 4.1 Current (Observed)

```
Groover (Moltbook replies)
  → inference logs (JSONL, no dynamo_result)
  → run-meta-inference.mjs (Hermes, BATCH_SIZE=1)
  → groover-meta-inference.md
  → curated_signals.json (manual curation)
```

### 4.2 Target (Repertoire)

```
Raw Activity (Groover + 0xRay + Dynamo)
  → Repertoire Ingestion Layer
  → Meta-Inference Engine (BATCH_SIZE=1, MAX=8)
  → Curated Signals Registry (+ auto-extraction)
  → Synthesis Reports
  → ┌─────────────────┬──────────────────────┐
    │ Dynamo          │ 0xRay Orchestrator   │
    │ govern_with_solar│ AgentCapabilities   │
    │                 │ ExecutionPlanner     │
    │                 │ thinDispatch         │
    └─────────────────┴──────────────────────┘
  → Feedback ingestion (routing outcomes → logs)
```

### 4.3 Meta-Inference Pipeline (Preserved Semantics)

```
JSONL Logs
  ↓
Load State (inference-state.json)
  ↓
Filter unprocessed (comment_id / post_id / session_id)
  ↓
Cap at MAX_ENTRIES=8
  ↓
For each entry (BATCH_SIZE=1):
  ├── Hermes meta-inference
  ├── Accumulate Dynamo stats (PASS/REJECT/resonance)
  └── Collect batch result
  ↓
Final Synthesis Prompt (5 mandatory sections)
  ↓
Append synthesis report
  ↓
Extract new primitives → curated_signals.json
  ↓
Update inference-state.json
```

---

## 5. Orchestrator Integration — Deep Specification

This section is the primary integration contract for 0xRay patches.

### 5.1 Type Extensions (0xRay `mcps/orchestrator/types.ts`)

```typescript
export interface AgentCapability {
  capabilities: string[];
  complexityThreshold: number;
  concurrentTasks: number;
  /** Repertoire: primitive names this agent is trusted to handle */
  repertoireSignals?: string[];
  /** Repertoire: tag affinities for fuzzy matching */
  repertoireTags?: string[];
}

export interface OrchestrationTask {
  // ... existing fields ...
  metadata?: {
    repertoireSignals?: string[];
    matchedPrimitives?: string[];
    synthesisContext?: string;
    ontologicalTrapDetected?: boolean;
  };
}

/** Passed via AsideContextOptions.inheritedContext */
export interface RepertoireInheritedContext {
  matchedSignals: Array<{ name: string; definition: string; priority: string }>;
  synthesisExcerpt?: string;
  governanceStats?: { passRate: number; avgResonance: number };
  ontologicalTrapSignals: string[];
}
```

### 5.2 AgentCapabilitiesManager — Signal-Aware Scoring

**Current:** `score = matchCount * 10 + concurrentTasks`

**Target:** Add repertoire dimension:

```typescript
selectAgentForTask(
  requiredCapabilities: string[],
  complexity: number,
  repertoireContext?: RepertoireRoutingContext
): string | null {
  for (const [agent, caps] of this.capabilities) {
    if (complexity > caps.complexityThreshold) continue;

    const capMatch = requiredCapabilities.filter(c => caps.capabilities.includes(c)).length;
    const signalMatch = repertoireContext?.matchedSignals.filter(s =>
      caps.repertoireSignals?.includes(s) ||
      caps.capabilities.includes(s)
    ).length ?? 0;

    const tagMatch = repertoireContext?.matchedTags.filter(tag =>
      caps.repertoireTags?.includes(tag)
    ).length ?? 0;

    // Ontological-trap boost: architect + security-auditor preferred
    const trapBoost = repertoireContext?.ontologicalTrapDetected &&
      ['architect', 'security-auditor', 'researcher'].includes(agent) ? 15 : 0;

    const score = capMatch * 10 + signalMatch * 8 + tagMatch * 5 + trapBoost + caps.concurrentTasks;
    // ...
  }
}
```

**Default signal → agent affinity map** (RepertoireOrchestratorBridge seeds this):

| Signal tag | Primary agents | Rationale |
|------------|----------------|-----------|
| `ontological-trap` | architect, security-auditor, researcher | Boundary/invariant analysis |
| `attestation` | security-auditor, architect | Trust boundary enforcement |
| `consumer-boundary` | architect, code-reviewer | Parser/consumer contract validation |
| `interpretation` | researcher, architect | Hermeneutic gap analysis |
| `provenance-failure` | code-reviewer, bug-triage-specialist | Traceability debugging |

### 5.3 ExecutionPlanner — inheritedContext Injection

**Patch point:** `createExecutionPlan(tasks, executionMode, inheritedContext?)`

Before `assignTasksToAgents`:

1. Call `RepertoireOrchestratorBridge.matchSignalsForTasks(tasks)`.
2. Attach `metadata.repertoireSignals` per task.
3. Pass `repertoireContext` into `selectAgentForTask`.

**AsideContext wiring** (task-handler.ts):

```typescript
await spawnAside({
  description: `Orchestrate: ${description}`,
  sessionId,
  inheritedContext: {
    repertoire: bridge.buildInheritedContext(tasks),
  },
});
```

Synthesis reports inject via `inheritedContext.synthesisExcerpt` — the first 2000 chars of the latest `SYNTHESIS-*.md` section 5 (actionable recommendations).

### 5.4 thinDispatch — Long-Term Coherence Routing

**Patch point:** `scoreComplexity(operation, context, thresholds?)`

Extend `context` to accept `RepertoireRoutingContext`:

```typescript
interface RepertoireRoutingContext {
  matchedSignals: string[];
  matchedTags: string[];
  ontologicalTrapDetected: boolean;
  synthesisAvailable: boolean;
}
```

**Complexity adjustments:**

| Condition | Score delta | Routing effect |
|-----------|-------------|----------------|
| `ontologicalTrapDetected` | +15 | Pushes toward `complex`/`enterprise` tier |
| ≥2 high-priority signals matched | +10 | Prefer architect over code-reviewer |
| `synthesisAvailable` | -5 (confidence) | Better context → slightly lower perceived complexity |
| `provenance-failure` tag | +8 | Route to bug-triage-specialist |

**`routeToAgent` override:** When `ontologicalTrapDetected && score.level >= 'moderate'`, override tier agent to `architect` (not just complexity-core default).

### 5.5 AgentDelegator Bridge

`agent-delegator.ts` maintains its own capability model. Repertoire bridge provides:

```typescript
enrichDelegationAnalysis(
  analysis: DelegationAnalysis,
  operation: string
): DelegationAnalysis {
  const signals = signalsManager.matchByText(operation);
  if (signals.length > 0) {
    analysis.agentDetails = boostAgentsForSignals(analysis.agentDetails, signals);
    analysis.metrics = { ...analysis.metrics, repertoireSignalCount: signals.length };
  }
  return analysis;
}
```

### 5.6 Feedback Loop — Closing the Circuit

**Orchestrator → Repertoire** (`OrchestratorFeedbackIngester`):

Writes to `logs/orchestrator-feedback/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2026-06-17T...",
  "sessionId": "session_...",
  "taskId": "task-1",
  "assignedAgent": "architect",
  "repertoireSignals": ["attestation-as-map"],
  "complexity": 62,
  "success": true,
  "durationMs": 4500,
  "dynamoResult": { "recommendation": "PASS", "resonanceScore": 0.81 }
}
```

Next meta-inference run ingests these entries to measure:
- Signal → agent assignment accuracy
- Governance pass rate by primitive type
- Routing coherence drift over time

---

## 6. Governance Integration

### 6.1 Ontological-Trap Enforcer

When inference contains `TYPE: ontological-trap`:

1. **Always** call `govern_with_solar` with full agent identity (`did:groover:284895bead2ac15b`).
2. **Always** log complete result to JSONL (even `N/A` or `null`).
3. Match inference text against `curated_signals.json` `evaluation_criteria`.
4. Attach matched primitive names to `dynamo_result.matchedPrimitives`.

**Required Groover patch** (`moltbook-engage.ts`):

```typescript
const isOntologicalTrap = /TYPE:\s*ontological-trap/i.test(inference);
const govResult = await governWithSolar(postTitle, govContent, {
  force: isOntologicalTrap,
  agentDid: GROOVER_DID,
  matchedPrimitives: matchCuratedSignals(inference),
});
logEntry.dynamo_result = govResult; // ALWAYS write, even null
```

---

## 7. Schemas

See `schemas/inference-log.schema.json` and `schemas/curated-signal.schema.json`.

### 7.1 Inference Log Entry (Unified)

```typescript
interface InferenceEntry {
  timestamp: string;
  source: 'groover' | 'xray' | 'dynamo' | 'orchestrator';
  post_id?: string;
  comment_id?: string;
  session_id?: string;
  inference: string;
  public_reply?: string;
  inference_type?: 'theoretical' | 'temporal-drift' | 'practical-workflow' | 'ontological-trap' | 'provenance-failure';
  dynamo_result?: {
    result?: { recommendation: string; resonanceScore: number };
    matchedPrimitives?: string[];
  };
  repertoire_signals?: string[];
}
```

### 7.2 Curated Signal (v1.1)

```typescript
interface CuratedSignal {
  name: string;
  definition: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  // optional: example_inference_snippet, batches, first_seen, status
}
```

---

## 8. Implementation Phases

### Phase 1 — Foundation (this repo)
- [x] `data/curated_signals.json` at system level
- [x] `CuratedSignalsManager` with query/match/CRUD
- [x] Unified ingestion (Groover JSONL + 0xRay session)
- [x] `inference-state.json` management

### Phase 2 — Synthesis
- [x] `MetaInferenceEngine` extracted from `run-meta-inference.mjs`
- [x] 5-section `SynthesisPromptBuilder`
- [ ] Auto-primitive extraction → registry (Hermes-assisted)

### Phase 3 — 0xRay Integration
- [ ] Patch `AgentCapabilitiesManager.selectAgentForTask`
- [ ] Patch `ExecutionPlanner.createExecutionPlan`
- [ ] Patch `thinDispatch.scoreComplexity` context handling
- [ ] Wire `AsideContextOptions.inheritedContext`
- [ ] Repertoire MCP server (query primitives + synthesis)

### Phase 4 — Feedback
- [x] `OrchestratorFeedbackIngester` skeleton
- [ ] Subscribe to `routing-outcomes.json` from 0xRay analytics
- [ ] Close Dynamo loop in Groover deploy scripts

---

## 9. Provider Architecture (Multi-Provider)

Repertoire is **one** `MemoryRoutingProvider` — not hardcoded in 0xRay.

**Contract location:** `xray/src/memory-routing/types.ts`  
**Factory export:** `createMemoryRoutingProvider(config?)`  
**Configuration:** `xray/xray/features.json` → `memory_routing`

```json
"memory_routing": {
  "enabled": true,
  "provider": "repertoire",
  "module_path": "../repertoire/dist/provider/memory-routing-provider.js",
  "config": { "signalsPath": "../repertoire/data/curated_signals.json" }
}
```

To add another provider (e.g. Chrono, custom harness):
1. Implement `MemoryRoutingProvider` interface
2. Export `createMemoryRoutingProvider()`
3. Set `provider: "custom"` and `module_path` in features.json

0xRay integration points (all provider-agnostic):
- `AgentCapabilitiesManager` → `getMemoryRoutingProviderSync()`
- `ExecutionPlanner` → `provider.enrichTasks()` / `buildInheritedContext()`
- `thinDispatch.scoreAndRoute()` → `provider.resolveThinDispatch()`
- `TaskHandler` → `provider.ingestFeedback()`

## 10. MCP Server Surface

**Server name:** `repertoire` — run via `npm run mcp` in this package

| Tool | Purpose |
|------|---------|
| `query_signals` | Filter by tag, priority, text match |
| `get_synthesis_report` | Latest or by date |
| `match_primitives` | Text → matched signals with scores |
| `get_routing_context` | Build `RepertoireInheritedContext` for orchestrator |
| `ingest_feedback` | Write orchestrator outcome to feedback log |

---

## 11. Critical Gaps (Tracked)

| Gap | Status | Owner |
|-----|--------|-------|
| `curated_signals.json` not consumed by orchestrator | Spec + bridge ready | 0xRay patch |
| `govern_with_solar` N/A on ontological-trap | Enforcer spec ready | Groover patch |
| Inference harness not in production | Types aligned | verifiable-agent-ecosystem |
| Repertoire isolated in groover/research | **Elevated to this repo** | Done |
| `dynamo_result` not written to JSONL | Documented | Groover patch |
| AsideContext has zero consumers | Wiring spec in §5.3 | 0xRay patch |

---

## 12. Quick Start

```bash
cd repertoire
npm install
npm run build

# Ingest Groover logs
npm run ingest -- --source groover --path ../groover/research/groover-inference-logs

# Run meta-inference (requires hermes CLI)
npm run meta-inference

# Query signals for an operation description
npm run query -- "attestation trust boundary re-validation"
```

---

## 13. References

- Groover meta-inference: `groover/research/run-meta-inference.mjs`
- 0xRay orchestrator: `xray/src/mcps/orchestrator/`
- 0xRay thinDispatch: `xray/src/nucleus/thin-dispatch.ts`
- 0xRay inference cycle: `xray/src/inference/inference-cycle.ts`
- Inference harness types: `verifiable-agent-ecosystem/inference-harness/src/types.ts`
- Primitive registry: `repertoire/data/curated_signals.json`