# AGENTS.md — Repertoire + 0xRay Consumer Template

**Version**: 3.1.0  
**Updated**: 2026-06-18

## What is Repertoire?

Repertoire is the deep-memory spine for the 0xRay/Groover stack. It provides curated signal registry, trap-aware routing consult, and orchestrator feedback ingest via `MemoryRoutingProvider`.

## Memory Routing

Configured in `.xray/features.json` → `memory_routing`:

- **Provider**: `repertoire`
- **Consult**: `buildRoutingContext`, `getTaskConfidence`, `selectAgent`
- **Feedback**: `ingestFeedback` → `logs/orchestrator-feedback/YYYY-MM-DD.jsonl` + registry nudge

## Available MCP Servers

| Server | Purpose |
|--------|---------|
| `repertoire-mcp` | Signal consult + feedback ingest (`repertoire__*` tools) |
| `xray-orchestrator` | Multi-agent orchestration with memory routing bridge |
| `xray-governance` | Proposal governance, codex snapshot |
| `xray-enforcer` | Codex compliance enforcement |

## CLI Commands

```
npm run ingest -- --source groover|xray --path <dir>
npm run feedback-cycle
npm run pipeline
npx 0xray status
npx 0xray health
```

## File Organization

| File Type | Save To |
|-----------|---------|
| Curated signals | `data/curated_signals.json` |
| Groover inference logs | `logs/groover-inference/` |
| Orchestrator feedback | `logs/orchestrator-feedback/` |
| Reflections | `docs/reflections/` |
| Config | `.xray/` |