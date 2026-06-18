# Repertoire Phased Integration Plan

**Date:** 2026-06-18 (evening refresh)  
**Lead:** Architect / dev  
**Platform context:** `~/dev/0x0/docs/reflections/journey-deep-reflection-2026-06-18.md` · `~/dev/0x0/docs/ROADMAP.md`

---

## Status summary

| Phase | Focus | Status |
|-------|-------|--------|
| **1–3** | Enrich → ingest → pipeline | ✅ Done 2026-06-17/18 |
| **4** | PASS-29 research doc | ✅ Done |
| **5** | Feedback loop | ✅ Done |
| **6** | Moltbook ↔ Repertoire (PASS-30) | ✅ Shipped |
| **7** | eX0 bundle packaging | ⬜ Deferred |
| **Suit** | 4-bridge verify + CI | ✅ Done 2026-06-18 evening |
| **Release** | npm `@0xray/repertoire@0.1.0` + `0xray@^3.4.7` | ✅ Published / pinned |

---

## Hermes / Grok 4.3 Consultation

**Status:** Blocked — `hermes -z ... --provider xai-oauth --model grok-4.3` requires xAI OAuth (`hermes model` → SuperGrok). Not authenticated in this environment.

**Architect alignment:** Close the **enrichment → ingest → memory** loop on existing corpus before any new AI-visible surface. Live Hermes meta-inference remains optional (dry report at `logs/meta-inference/dry-synthesis.md`).

---

## Current State Matrix (June 18 evening)

| Component | Status | Ref |
|-----------|--------|-----|
| Repertoire repo + MCP | **npm 0.1.0** | `@0xray/repertoire` |
| 0xRay dependency | **^3.4.7** | consumer upgrade merge verified |
| Enriched logging (Groover) | Done | `matched_primitives` + `match_confidence` |
| Repertoire → 0xRay researcher | Done | trap routing e2e; MEMORY_ROUTING blocks |
| Repertoire → 0xRay in-process | Done | `memory_routing` in `features.json` |
| Moltbook engage → Repertoire | Done | PASS-30 consult + PASS-31 post-tick feedback |
| 4-bridge suit verify | Done | `confirm-suit-all`, per-bridge scripts, CI |
| GitHub Actions CI | Green | build → test (28) → Grok suit verify |
| Docs | Live | https://0xrayai.github.io/xray/docs/guides/repertoire |
| Announce (primary) | **Posted** 2026-06-18 | https://x.com/Blaze0x1/status/2067704156131934488 |
| Thread + @0xrayai RT | Open | replies 2–7 + quote RT still optional |
| Live auto-ingest on new JSONL | Open | A3.1 (0x0 Phase A) |
| eX0 Hermes bundle | Deferred | Phase 7 |

---

## Phase 1: Enrichment Backfill — ✅

- 710 lines → 431 backfilled → 349 imported
- Strict ingest: `matched_primitives` + `match_confidence` required

---

## Phase 2: Ingest + Promotion — ✅

- 8 primitives promoted (`attestation-as-map`: 335 obs, 0.987 avg)
- `getTaskConfidence()` returns trap context for query

---

## Phase 3: Meta-Inference Pipeline — ✅ (dry); live OAuth optional

- `npm run pipeline` ranks primitives
- Live Hermes synthesis blocked on OAuth

---

## Phase 4: PASS-29 — ✅

- `verifiable-agent-ecosystem/brain-dumps/PASS-29-MOLTBOOK-LIVE-AND-REPERTOIRE-ADAPTIVE-LOOP.md`

---

## Phase 5: Orchestrator Feedback Loop — ✅

- `ingestFeedback` on registry + log
- `npm run feedback-cycle`
- MCP `repertoire__ingest_feedback`
- Live 0xRay TaskHandler session PASS

---

## Phase 6: Moltbook ↔ Repertoire — ✅ SHIPPED

- `deploy/repertoire-confidence.ts`
- `moltbook-engage.ts` + `moltbook-other-engage.ts` via engage-core
- `MEMORY_ROUTING` prompt blocks; `repertoire_routing` on JSONL
- **Pending operational proof:** live engage run with `MOLTBOOK_API_KEY` (A4.3)

---

## Phase 7: eX0 Bundle Packaging — DEFERRED

Single Hermes install path for Groover + Repertoire + 0xRay + Dynamo.

**Prerequisite:** P0.6 live field loop + Jelly P1.

---

## Suit phase (2026-06-18) — ✅ NEW

**Goal:** Prove Repertoire wears the 0xRay suit across all 4 plugin bridges.

| Deliverable | Status |
|-------------|--------|
| `scripts/confirm-suit-all.mjs` — wear matrix | ✅ |
| `scripts/verify-{grok,hermes,opencode,openclaw}-suit.mjs` | ✅ |
| `scripts/suit-bridge-shared.mjs` → `bridge-mcp-wiring.cjs` SSOT | ✅ |
| `npm run confirm:suit:all` / `verify:suit:all` | ✅ |
| `npm run install:bridges` | ✅ |
| Trap routing e2e in `confirm:suit` | ✅ |
| GitHub Actions CI | ✅ |
| `@types/node` for clean CI build | ✅ |

**Commands:**

```bash
npm run verify:suit:all      # verify all bridges (skip if CLI missing)
npm run confirm:suit:all     # install all + Grok harness + trap-routing
npm run install:bridges      # native 0xray bridge install
```

---

## Master Todo Checklist

### Done

- [x] Phases 1–6 (memory organ + field wires)
- [x] `@0xray/repertoire@0.1.0` npm
- [x] `0xray@^3.4.7` pin
- [x] 4-bridge suit matrix + CI
- [x] Announce copy + image (`tweets/`)
- [x] Docs link live
- [x] Primary announce posted — [@Blaze0x1 Jun 18](https://x.com/Blaze0x1/status/2067704156131934488)

### Next (platform — see 0x0 ROADMAP)

- [ ] A3.1 auto-ingest new live JSONL lines
- [ ] A4.3 live JSONL proof on groover production host
- [ ] Thread replies 2–7 + @0xrayai quote RT (optional)
- [ ] Phase 7 eX0 bundle (after Jelly P1)

### Later

- [ ] Live Hermes meta-inference cron (OAuth)
- [ ] Railway-deployed Repertoire (stdio sufficient for now)

---

## What NOT To Do Yet

| Action | Why defer |
|--------|-----------|
| Soften strict ingest | Would fake learning |
| eX0 bundle before live loop | Packaging before proof |
| Deploy Repertoire to Railway | Local stdio + npm sufficient |

---

## Related Docs

| Doc | Path |
|-----|------|
| 0x0 journey reflection | `0x0/docs/reflections/journey-deep-reflection-2026-06-18.md` (private) |
| 0x0 roadmap | `0x0/docs/ROADMAP.md` (private) |
| Memory routing provider | `docs/MEMORY-ROUTING-PROVIDER.md` |
| Architecture | `REPERTOIRE.md` |
| PASS-30 | `~/dev/verifiable-agent-ecosystem/brain-dumps/PASS-30-…` |