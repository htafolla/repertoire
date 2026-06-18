---
name: repertoire-trap-handling
description: Query Repertoire MCP tools before governance on ontological-trap tasks. Routes high-confidence traps to architect and injects matched signals as evidence.
author: 0xRay / Repertoire
version: 1.0.0
schema_version: "1.0"
tags: [repertoire, ontological-trap, governance, memory-routing, architect]
capabilities:
  - evaluate_trap_confidence
  - search_primitives
  - route_trap_tasks
dependencies:
  - repertoire-mcp

metadata:
  hermes:
    tags: [Repertoire, OntologicalTrap, Governance, MCP, Architect]
    related_skills: [researcher, security-audit, architect-tools]
  opencode:
    tags: [repertoire, trap, governance]
---

# Repertoire Trap Handling

Use this skill when a task or proposal may involve an **ontological trap** — cases where attestation, closure, or verdict language masks an ongoing validation obligation at a trust boundary.

Repertoire maintains a curated primitive registry (`curated_signals.json`) fed by **enriched Groover logs** (`matched_primitives` + `match_confidence`). The MCP surface is the **primary contract** for LLM agents running in Hermes, OpenCode, Claude Code, or similar hosts.

## When to Activate

Trigger this skill when **any** of the following are true:

- Task or proposal text contains `TYPE: ontological-trap`
- Description mentions ontological-trap primitives (e.g. `attestation-as-map`, consumer-boundary revalidation)
- User asks for governance, architecture review, or researcher analysis on attestation / closure / verdict semantics
- You are about to call `analyze_proposal` on a trap-adjacent inference

Do **not** skip Repertoire on trap-classified work. In-process 0xRay routing may not be available in your host process.

## Required MCP Server

Register `repertoire-mcp` in your host config (see `mcp-config.example.json` in the repertoire repo):

```json
{
  "mcpServers": {
    "repertoire": {
      "command": "node",
      "args": ["/absolute/path/to/repertoire/dist/mcp/server.js"],
      "env": {
        "CURATED_SIGNALS_PATH": "/absolute/path/to/repertoire/data/curated_signals.json"
      }
    }
  }
}
```

Build first: `cd repertoire && npm run build`

Optional companion servers for governance follow-through:

- `xray-researcher` — `analyze_proposal` from a codebase/history perspective
- `xray-architect-tools` — architecture-level trap remediation
- `xray-code-review` / `xray-governance` — committee votes

## Workflow

### Step 1 — Evaluate task confidence

Call `repertoire__get_task_confidence` with the full task or proposal text.

```
repertoire__get_task_confidence({
  description: "<title + description + relevant context>",
  type: "governance",
  taskId: "<optional-id>"
})
```

**Example description:**

```
TYPE: ontological-trap
Attestation-as-map requires consumer-side revalidation at the trust boundary.
```

### Step 2 — Interpret the response

The tool returns JSON `TaskConfidenceContext`. Key fields:

| Field | Meaning |
|-------|---------|
| `highConfidenceTrapPresent` | Trap detected **and** at least one trap signal has confidence ≥ 0.55 |
| `ontologicalTrapDetected` | Trap language or tags matched (may be true without high confidence) |
| `matchedSignals` | Primitive names that passed the confidence gate |
| `signals` | `{ name, confidence, source }` details |
| `complexityBoost` | Suggested complexity increase for routing (orchestrator use) |
| `recommendedAgent` | `"architect"` when `highConfidenceTrapPresent`; otherwise `null` |
| `minConfidenceGate` | Threshold used (default `0.55`) |

### Step 3 — Act on high-confidence traps

If `highConfidenceTrapPresent === true`:

1. **Route preference:** Prefer `architect` (or `recommendedAgent` if set). Trap-capable agents: `architect`, `security-auditor`, `researcher`.
2. **Evidence:** Include `matchedSignals` and per-signal confidences in your reasoning and any governance evidence array.
3. **Complexity:** Treat the task as elevated complexity (`complexityBoost` is advisory for orchestrator routing).
4. **Do not flatten the trap:** Avoid approving language that treats attestation as a terminating verdict when the registry says consumer revalidation is required.

If `ontologicalTrapDetected === true` but `highConfidenceTrapPresent === false`:

- Proceed with caution; registry may lack enriched observations yet.
- Note that confidence is below the promotion gate — do not treat as validated memory.

### Step 4 — Optional primitive search

For additional registry context:

```
repertoire__search_primitives({
  query: "attestation-as-map ontological-trap",
  minConfidence: 0.55,
  limit: 5
})
```

Use results for definitions, tags, `observationCount`, and `confidence` in your analysis. Only signals with `observation_stats` appear — no text-score fallbacks.

### Step 5 — Governance / analysis

Proceed with your governance or analysis tools, **referencing Repertoire explicitly**:

```
repertoire__get_task_confidence → highConfidenceTrapPresent: true
matchedSignals: attestation-as-map (0.90)
recommendedAgent: architect
→ calling xray-researcher analyze_proposal with signals as evidence
```

**Researcher example:**

```
xray-researcher.analyze_proposal({
  proposalTitle: "Attestation boundary review",
  proposalDescription: "TYPE: ontological-trap ...",
  proposalType: "governance",
  evidence: [
    "Repertoire: attestation-as-map (confidence 0.90)",
    "Repertoire recommendedAgent: architect",
    "Repertoire complexityBoost: 19"
  ]
})
```

When the researcher response includes a `MEMORY_ROUTING:` block, preserve it in summaries — it is the auditable signal trail.

### Step 6 — Feedback (orchestrated runs only)

After task completion in an orchestrated session, record outcomes:

```
repertoire__ingest_feedback({
  sessionId: "<session>",
  taskId: "<task>",
  assignedAgent: "architect",
  memorySignals: ["attestation-as-map"],
  complexity: 45,
  success: true,
  durationMs: 12000
})
```

## Decision Checklist

Before finalizing a trap-classified governance vote:

- [ ] Called `repertoire__get_task_confidence`
- [ ] Checked `highConfidenceTrapPresent`
- [ ] If true: noted `matchedSignals`, `recommendedAgent`, `complexityBoost`
- [ ] Included Repertoire evidence in reasoning
- [ ] Routed to architect (or trap-capable agent) when recommended
- [ ] Did not treat low-confidence trap detection as validated memory

## Example: Full trap flow

**User task:** Review a proposal that closes an attestation loop without consumer revalidation.

**Agent actions:**

1. `repertoire__get_task_confidence({ description: "TYPE: ontological-trap attestation-as-map ...", type: "governance" })`
2. Response: `highConfidenceTrapPresent: true`, `matchedSignals: ["attestation-as-map"]`, `recommendedAgent: "architect"`
3. `repertoire__search_primitives({ query: "attestation-as-map", minConfidence: 0.55 })` — read definition
4. Invoke `architect` or `xray-researcher analyze_proposal` with Repertoire evidence
5. Vote/recommend **reject** or **request revision** if proposal treats attestation as final without consumer boundary checks

## What This Skill Does Not Do

- **In-process MemoryRoutingProvider** — used by 0xRay `ExecutionPlanner` / `thinDispatch` inside the orchestrator process only. LLM hosts should use MCP tools.
- **Legacy log ingest** — unstructured Groover logs without `match_confidence` are skipped; empty registry → low confidence is expected until enriched logs land.
- **Replace architect judgment** — Repertoire supplies signal-backed context; the LLM still reasons and votes.

## Related Documentation

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — deployment model, internal vs MCP surfaces
- [mcp-config.example.json](../../mcp-config.example.json) — MCP server registration
- [docs/MEMORY-ROUTING-PROVIDER.md](../../docs/MEMORY-ROUTING-PROVIDER.md) — in-process provider (0xRay orchestrator only)