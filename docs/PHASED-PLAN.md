# Repertoire Phased Integration Plan

**Date:** 2026-06-17  
**Lead:** Architect / dev  
**Constraint:** Repertoire → Moltbook engagement integration is **explicitly deferred** (not Phase 1).

---

## Hermes / Grok 4.3 Consultation

**Status:** Blocked — `hermes -z ... --provider xai-oauth --model grok-4.3` requires xAI OAuth (`hermes model` → SuperGrok). Not authenticated in this environment.

**Prompt sent:** Moltbook state, verifiable-agent-ecosystem research repo, Repertoire readiness, enriched logging at `abeafbb`, 710 pre-enrichment JSONL lines, constraint that Moltbook MCP wiring is NOT next.

**Architect alignment (pending live Grok confirmation):** Close the **enrichment → ingest → memory** loop on existing corpus before any new AI-visible surface. Moltbook scripts already emit enriched logs via `governance-helper` on new runs; historical 710 lines need backfill first.

**Phase 1–3 executed (2026-06-18):** Backfill + ingest + pipeline ran successfully without Moltbook integration.

---

## Current State Matrix

| Component | Status | Ref |
|-----------|--------|-----|
| Repertoire repo + MCP | Ready | `2971b06` |
| Enriched logging (Groover) | Done | `abeafbb` — `matched_primitives` + `match_confidence` |
| Repertoire → 0xRay researcher | Done | In-process via `features.json` `memory_routing` |
| Moltbook engagement → Repertoire | **Not integrated** | `moltbook-engage.ts` does not call Repertoire |
| Hermes skill / MCP example | Ready | `hermes-mcp.example.json` — not wired into `moltbook-*.ts` |
| Inference corpus on disk | Pre-enrichment | 710 lines, 0 importable by strict ingest |
| Live Moltbook profile | Active | [groover](https://www.moltbook.com/u/groover) — 232 karma |

---

## Executive Recommendation

**Phase 1–3 first:** Backfill enriched metadata on the 710-line corpus → ingest into Repertoire → run meta-inference pipeline. Prove the memory layer learns from real Groover inference before touching Moltbook behavior.

**Defer:** `repertoire__get_task_confidence` in `moltbook-engage.ts` until ingest shows non-zero promotions and `observation_stats` move on production primitives.

---

## Phase 1: Enrichment Backfill

**Goal:** Make historical Groover JSONL importable by Repertoire strict ingest.

**Why now:** `governance-helper.ts` enriches new entries but 710 on-disk lines predate the envelope. Repertoire correctly skips all of them — the loop is open at the data layer, not the code layer.

**Deliverables:**

- [x] `groover-integration-work/research/backfill-enriched-logs.ts`
- [x] Output: `research/groover-inference-logs-enriched/*.jsonl` (non-destructive)
- [x] Stats report: 710 total → 431 backfilled, 166 no-match, 113 no-inference

**Success criteria:**

- [x] `imported > 0` when Repertoire ingests enriched output (349 after clearing stale logs)
- [x] Every imported line has `matched_primitives` + per-primitive `match_confidence`
- [x] Ontological-trap lines receive trap-tagged primitives per `governance-helper` rules

**Pitfall discovered:** Prior partial ingest wrote entries without `match_confidence` to `logs/groover-inference/`, causing duplicate-ID skips. Clear stale logs before re-ingest.

**Commands:**

```bash
cd groover-integration-work
npx tsx research/backfill-enriched-logs.ts

cd ../repertoire
npm run ingest -- --source groover --path ../groover-integration-work/research/groover-inference-logs-enriched
```

**Deferred:** Live Dynamo re-calls on backfill (use existing `dynamo_result` if present; otherwise null).

---

## Phase 2: Repertoire Ingest + Promotion Verification

**Goal:** Populate `logs/groover-inference/` and promote high-confidence primitives into `data/curated_signals.json`.

**Why now:** First proof that Repertoire memory is fed by production inference, not fixtures.

**Deliverables:**

- [x] Successful ingest: `imported=349`, `skipped=82` (duplicates / no-match)
- [x] 8 primitives promoted to `validated` with `observation_stats` (e.g. `attestation-as-map`: 335 obs, 0.987 avg)
- [x] `npm run query` → `highConfidenceTrapPresent: true`, `recommendedAgent: architect`
- [x] `npm run test:e2e` green (20 tests)

**Success criteria:**

- [x] `getTaskConfidence()` returns `highConfidenceTrapPresent: true` for trap query
- [x] `logs/pipeline-run.json` written with 8 ranked primitives

**Commands:**

```bash
cd repertoire
npm run ingest -- --source groover --path ../groover-integration-work/research/groover-inference-logs-enriched
npm run query -- "ontological-trap attestation"
npm run test && npm run test:e2e
```

**Deferred:** Railway-deployed Repertoire; stdio MCP is sufficient for local loop.

---

## Phase 3: Meta-Inference Pipeline

**Goal:** Run Repertoire synthesis over ingested corpus; produce actionable primitive ladder.

**Why now:** Closes the research loop verifiable-agent-ecosystem PASS-10/19/28 described — inference → meta-inference → registry update.

**Deliverables:**

- [x] `npm run pipeline` completes — 349 stored entries, all with confidence
- [x] Top 8 primitives ranked (weighted = occurrence for this corpus)
- [ ] Hermes meta-inference report (blocked: OAuth) — dry report at `logs/meta-inference/dry-synthesis.md`
- [ ] Gap analysis: Dynamo PASS/REJECT still sparse on historical lines

**Success criteria:**

- [x] Pipeline ranks ≥5 primitives with occurrence counts
- [x] No promotion below 0.55 confidence gate
- [ ] Live Hermes synthesis (requires `hermes model` OAuth)

**Commands:**

```bash
cd repertoire
npm run pipeline -- --source ../groover-integration-work/research/groover-inference-logs-enriched --max-entries 50
npm run meta-inference
```

**Deferred:** Automated scheduled pipeline (cron / heartbeat).

---

## Phase 4: verifiable-agent-ecosystem PASS-29

**Goal:** Document live Moltbook bot as research deliverable; link to Repertoire implementation.

**Why now:** Research repo has PASS-28 tooling sketch; production reality (profile, 710 lines, strict ingest) should be captured while fresh.

**Deliverables:**

- [ ] `verifiable-agent-ecosystem/brain-dumps/PASS-29-MOLTBOOK-LIVE-AND-REPERTOIRE-LOOP.md`
- [ ] Update `verifiable-agent-ecosystem/TODO.md` — mark harness wiring partial, ingest loop status
- [ ] Cross-link from `repertoire/docs/reflections/groover-moltbot-moltbook-cascade-2026-06-17.md`

**Success criteria:**

- PASS-29 cites live API profile stats, enrichment gap (closed in Phase 1), Repertoire commit
- No invented acronyms — use full repo name `verifiable-agent-ecosystem`

**Deferred:** PASS-30 Moltbook ↔ Repertoire MCP integration design.

---

## Phase 5: Orchestrator Feedback Loop

**Goal:** Close routing outcome → memory via `ingestFeedback`.

**Why now:** Memory becomes adaptive, not just archival.

**Deliverables:**

- [x] `CuratedSignalsManager.recordFeedbackOutcome()` — updates `feedback_stats` + nudges `avg_confidence`
- [x] `RepertoireService.ingestOrchestratorFeedback()` — log + registry in one call
- [x] E2E assertion: routing → feedback → confidence nudge
- [x] `npm run feedback-cycle` — production cycle script
- [x] MCP `repertoire__ingest_feedback` returns `{ logPath, updatedSignals }`
- [x] Live 0xRay TaskHandler session — `xray npm run live-feedback-session` PASS (2026-06-18)

**Success criteria:**

- [x] Feedback log contains task_id, outcome, matched primitives
- [x] `feedback_stats` on routed signals (`success_count`, `last_assigned_agent`)
- [x] Successful outcome nudges `avg_confidence` (+0.002); failure penalizes (-0.005)
- [ ] Live xray orchestrator task closes the same loop end-to-end

**Commands:**

```bash
cd repertoire
npm run feedback-cycle
```

**Deferred:** Automated feedback on every Moltbook reply.

---

## Phase 6: Moltbook ↔ Repertoire Integration — PASS-30 SHIPPED

**Goal:** Repertoire influences Moltbook reply generation in real time.

**Status:** Implemented 2026-06-18 — see `verifiable-agent-ecosystem/brain-dumps/PASS-30-MOLTBOOK-REPERTOIRE-CROSS-SYSTEM-INTEGRATION.md`

**Delivered:**

- [x] `deploy/repertoire-confidence.ts` — in-process `getTaskConfidence` (MCP contract)
- [x] `moltbook-engage.ts` + `moltbook-other-engage.ts` wired
- [x] `MEMORY_ROUTING` prompt block injection
- [x] `shouldForceGovernanceWithRepertoire` — trap flag + TYPE text
- [x] `repertoire_routing` field on JSONL entries
- [x] Unit tests (13 passing in groover-integration-work deploy/)

**Pending operational proof:**

- [ ] Live engage run with `MOLTBOOK_API_KEY` — confirm `[Repertoire]` log lines
- [ ] Hermes host MCP wiring via `hermes-mcp.example.json` (separate from deploy scripts)

---

## Phase 7: eX0 Bundle Packaging (DEFERRED)

**Goal:** Single Hermes install path for Groover + Repertoire + 0xRay + Dynamo.

**Deliverables:**

- [ ] `ex0/hermes-mcp.json` template with absolute-path placeholders
- [ ] `ex0/features.json` snippet for consumer projects
- [ ] Skills bundle manifest

**Prerequisite:** Phases 1–5 closed locally once.

---

## Master Todo Checklist

### Now (Phase 1–3) — DONE 2026-06-18

- [x] `research/backfill-enriched-logs.ts` — backfill script
- [x] Run backfill on 710 lines → 431 importable
- [x] `npm run ingest` from enriched dir → 349 imported, 8 promoted
- [x] `npm run pipeline` → 8 primitives ranked
- [x] `npm run test && npm run test:e2e` → 20 passed

### Next (Phase 4–5)

- [x] Repertoire `ingestFeedback` adaptive loop (registry + log)
- [x] `npm run feedback-cycle` on production registry
- [x] PASS-29 in verifiable-agent-ecosystem (`brain-dumps/PASS-29-MOLTBOOK-LIVE-AND-REPERTOIRE-ADAPTIVE-LOOP.md`)
- [ ] Live xray TaskHandler orchestration with memory_routing
- [ ] Update cascade reflection with ingest + feedback results

### Later (Phase 6–7)

- [ ] Moltbook engage → Repertoire MCP
- [ ] eX0 packaging
- [ ] Optional: re-run live engage workers for fresh enriched lines (requires `MOLTBOOK_API_KEY`)

---

## What NOT To Do Yet

| Action | Why defer |
|--------|-----------|
| Wire Repertoire into `moltbook-engage.ts` | Memory empty until Phase 1–2 |
| Soften strict ingest | Would fake learning |
| Deploy Repertoire to Railway | Local stdio loop not proven |
| Invent shortcuts (VAE acronym, etc.) | Use `verifiable-agent-ecosystem` |
| Treat Moltbook karma as memory proof | Engagement ≠ enriched ingest |

---

## Related Docs

| Doc | Path |
|-----|------|
| Moltbook cascade | `docs/reflections/groover-moltbot-moltbook-cascade-2026-06-17.md` |
| Architecture | `ARCHITECTURE.md` |
| Hermes MCP example | `hermes-mcp.example.json` |
| Groover governance helper | `../groover-integration-work/deploy/governance-helper.ts` |