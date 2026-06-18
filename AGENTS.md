# Repertoire — 0xRay Memory Routing Provider

Quick reference for the **@0xray/repertoire** package — deep memory, synthesis, and orchestrator enrichment for the 0xRay/Groover stack.

**v0.1.0** · integrates with **0xRay v3.4.1** (7 MCP servers · 68 codex terms)

## Role in the stack

Repertoire is the default `memory_routing` provider when enabled in `xray/features.json`. It enriches:

| Surface | Integration |
|---------|-------------|
| **ExecutionPlanner** | `getTaskConfidence`, complexity boost, trap-aware `selectAgent` |
| **thinDispatch** | `resolveThinDispatch` score adjustment |
| **Researcher** | `MEMORY_ROUTING:` block in governance output |
| **AsideContext** | `inheritedContext.memoryRouting` on orchestrator `spawnAside` |
| **Feedback loop** | Per-task `ingestFeedback` |

## MCP Servers

### Repertoire (this package)

```bash
npx @0xray/repertoire mcp    # stdio — configure in host .mcp.json
```

| Tool | Purpose |
|------|---------|
| `repertoire__get_task_confidence` | Trap detection, complexity boost, `recommendedAgent` |
| `repertoire__search_primitives` | Text search against `curated_signals.json` |
| `repertoire__get_high_confidence_signals` | Validated signals above threshold |
| `repertoire__ingest_feedback` | Record orchestrator outcomes |

### 0xRay (consumer framework)

When installed via `npm install 0xray`, seven MCP servers are wired via `npx -y 0xray mcp <cmd>`:

| Server | Role |
|--------|------|
| `xray-governance` | Proposal governance, codex snapshot |
| `xray-skills` | 45 knowledge skills |
| `xray-orchestrator` | thinDispatch, AsideContext, confidence gate |
| `xray-enforcer` | Codex compliance |
| `xray-researcher` | Codebase exploration + memory routing |
| `xray-code-review` | Code review deliberation |
| `xray-architect-tools` | Architecture decisions |

## Configuration

In sibling `xray/features.json` (or `.xray/features.json` in consumer projects):

```json
"memory_routing": {
  "enabled": true,
  "provider": "repertoire",
  "module_path": "../repertoire/dist/provider/memory-routing-provider.js",
  "config": {
    "dataDir": "../repertoire/data",
    "signalsPath": "../repertoire/data/curated_signals.json",
    "logDir": "../repertoire/logs/groover-inference"
  }
}
```

## CLI / Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run ingest` | Ingest Groover inference logs |
| `npm run meta-inference` | Run capped meta-inference batches |
| `npm run query` | Ad-hoc confidence query |
| `npm run mcp` | Start stdio MCP server |
| `npm test` | Vitest unit tests |
| `npm run test:mcp` | MCP stdio smoke test |

## File Organization

| File Type | Save To |
|-----------|---------|
| Primitive registry | `data/curated_signals.json` |
| Inference logs | `logs/groover-inference/` |
| Reflections | `docs/reflections/` |
| Provider source | `src/provider/` |
| MCP server | `src/mcp/server.ts` |
| Skills | `skills/<name>/SKILL.md` — see [SKILLS.md](SKILLS.md) |

## Documentation

| Topic | Path |
|-------|------|
| Vision & phases | [REPERTOIRE.md](REPERTOIRE.md) |
| System diagram | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Provider contract | [docs/MEMORY-ROUTING-PROVIDER.md](docs/MEMORY-ROUTING-PROVIDER.md) |
| Skills catalog | [SKILLS.md](SKILLS.md) |
| 0xRay docs | https://0xrayai.github.io/xray/docs/guides/repertoire |