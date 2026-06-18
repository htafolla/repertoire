# Implementing a Custom MemoryRoutingProvider

0xRay loads memory routing providers dynamically. Repertoire is the reference implementation.

## Contract

Export from your package:

```typescript
export function createMemoryRoutingProvider(
  config?: Record<string, unknown>
): MemoryRoutingProvider
```

Interface (mirror of `xray/src/memory-routing/types.ts`):

| Method | Purpose |
|--------|---------|
| `isAvailable()` | Whether provider data is reachable |
| `buildRoutingContext(operation)` | Match signals/tags for an operation |
| `enhanceAgentCapabilities(map)` | Add memory dimensions to agents |
| `enrichTasks(tasks)` | Attach metadata before planning |
| `buildInheritedContext(tasks)` | Context for AsideContext |
| `selectAgent(...)` | Signal-aware agent selection |
| `resolveThinDispatch(...)` | Adjust score + agent override |
| `ingestFeedback?(entry)` | Close feedback loop |

## 0xRay Configuration

In `xray/features.json` or `.xray/features.json`:

```json
"memory_routing": {
  "enabled": true,
  "provider": "custom",
  "module_path": "../your-provider/dist/memory-routing-provider.js",
  "config": {}
}
```

Set `provider: "null"` to disable without removing config.

## Repertoire as Provider

```json
"memory_routing": {
  "enabled": true,
  "provider": "repertoire",
  "module_path": "../repertoire/dist/provider/memory-routing-provider.js",
  "config": {
    "signalsPath": "../repertoire/data/curated_signals.json"
  }
}
```