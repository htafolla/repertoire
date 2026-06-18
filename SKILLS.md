# Repertoire Skills

Repertoire ships **agent skills** that teach LLM hosts (Hermes, OpenCode, Claude Code, etc.) how to use the Repertoire MCP surface for memory-backed routing and ontological-trap governance.

Skills are loaded on demand. They do **not** replace MCP tools — they tell the model **when and how** to call `repertoire__*` before governance or analysis.

---

## Memory & Trap Handling

| Skill | MCP Server | Description |
|-------|------------|-------------|
| `repertoire-trap-handling` | `repertoire` | Query task confidence and primitives before trap-classified governance; route to `architect` when `highConfidenceTrapPresent` |

---

## MCP Tools (skill companions)

These tools are registered via `repertoire-mcp`, not invoked by skill name directly:

| Tool | Purpose |
|------|---------|
| `repertoire__get_task_confidence` | Trap detection, `matchedSignals`, `complexityBoost`, `recommendedAgent` |
| `repertoire__search_primitives` | Text search against registry (`observation_stats` only, default gate 0.55) |
| `repertoire__get_high_confidence_signals` | List validated signals above threshold, optional tag filter |
| `repertoire__ingest_feedback` | Record orchestrator outcomes for the feedback loop |

Full request/response shapes: see [src/mcp/server.ts](src/mcp/server.ts).

---

## When to Use Which Surface

| Host | Use |
|------|-----|
| **Hermes / OpenCode / external LLM** | Skills in this file + MCP tools (`repertoire__*`) |
| **0xRay ExecutionPlanner / thinDispatch** | In-process `MemoryRoutingProvider` — not skills; see [ARCHITECTURE.md](ARCHITECTURE.md) |

---

## Invoking Skills

### Hermes / OpenCode

1. Register MCP servers — [hermes-mcp.example.json](hermes-mcp.example.json) or [mcp-config.example.json](mcp-config.example.json)
2. Attach `repertoire-trap-handling` to the agent (related skill or system prompt reference)
3. On trap-classified tasks, the model should call MCP tools per the skill workflow

**Typical trap flow:**

```
repertoire__get_task_confidence({ description: "TYPE: ontological-trap ...", type: "governance" })
  → highConfidenceTrapPresent?
       → repertoire__search_primitives (optional)
       → xray-researcher analyze_proposal (with matchedSignals as evidence)
       → prefer architect per recommendedAgent
```

### Manual MCP smoke test

```bash
cd repertoire && npm run build
node dist/mcp/server.js   # stdio MCP — configure in host mcpServers
npm run query             # CLI ad-hoc confidence query without MCP host
```

---

## Skill Locations

Each skill has a `SKILL.md` with full workflow, checklists, and examples:

| Skill | Path |
|-------|------|
| `repertoire-trap-handling` | [skills/repertoire-trap-handling/SKILL.md](skills/repertoire-trap-handling/SKILL.md) |

---

## Adding Skills

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `tags`, `dependencies`)
2. Document required MCP servers and tool call sequences
3. Add a row to the table in this file
4. Link from [ARCHITECTURE.md](ARCHITECTURE.md) if the skill reflects a core integration path

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system diagram, enriched-only ingest, internal vs MCP surfaces
- [REPERTOIRE.md](REPERTOIRE.md) — vision and phase planning
- [docs/MEMORY-ROUTING-PROVIDER.md](docs/MEMORY-ROUTING-PROVIDER.md) — 0xRay in-process provider contract