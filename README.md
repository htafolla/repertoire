# @0xray/repertoire

Deep memory, synthesis, and orchestrator enrichment for the [0xRay](https://github.com/0xRayAI/xray) / Groover stack.

**v0.1.0** · integrates with **0xRay v3.3+** memory routing

## Install

```bash
npm install @0xray/repertoire
```

Requires `0xray@^3.2.0` (use **3.4.1** for full memory-routing + MCP bridge support).

## MCP server (Hermes, Grok, OpenCode)

```json
"repertoire": {
  "command": "npx",
  "args": ["-y", "@0xray/repertoire", "mcp"]
}
```

Bundled `data/curated_signals.json` is used by default. Override with env:

| Env | Default |
|-----|---------|
| `CURATED_SIGNALS_PATH` | `<package>/data/curated_signals.json` |
| `REPERTOIRE_DATA_DIR` | `<package>/data` |
| `REPERTOIRE_LOG_DIR` | `<package>/logs/groover-inference` |

### Tools

| Tool | Purpose |
|------|---------|
| `repertoire__get_task_confidence` | Trap detection, complexity boost, `recommendedAgent` |
| `repertoire__search_primitives` | Text search against curated signals |
| `repertoire__get_high_confidence_signals` | Validated signals above threshold |
| `repertoire__ingest_feedback` | Record orchestrator outcomes |

## 0xRay memory routing (in-process)

In `.xray/features.json` or `xray/features.json`:

```json
"memory_routing": {
  "enabled": true,
  "provider": "repertoire",
  "module_path": "node_modules/@0xray/repertoire/dist/provider/memory-routing-provider.js"
}
```

`config` is optional when using the bundled registry. For a project-local registry:

```json
"config": {
  "signalsPath": ".xray/curated_signals.json",
  "logDir": "logs/groover-inference"
}
```

Paths in `config` resolve relative to the consumer project root.

## Programmatic import

```ts
import { createMemoryRoutingProvider } from '@0xray/repertoire/provider/memory-routing-provider';

const provider = createMemoryRoutingProvider();
provider.getTaskConfidence?.({
  id: 'task-1',
  description: 'TYPE: ontological-trap attestation-as-map',
  type: 'governance',
});
```

## Sibling-repo development

```bash
git clone https://github.com/0xRayAI/repertoire
cd repertoire && npm install && npm run build && npm test
```

See [AGENTS.md](./AGENTS.md) for stack integration details.