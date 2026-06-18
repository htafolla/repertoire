# 0xRay Orchestrator Patch Guide

Concrete diffs to wire Repertoire into production 0xRay.

## 1. `src/mcps/orchestrator/types.ts`

Add `repertoireSignals` and `repertoireTags` to `AgentCapability`.
Add `metadata` to `OrchestrationTask`.
Add `repertoireContext` to `ExecutionPlan`.

## 2. `src/mcps/orchestrator/config/agent-capabilities.ts`

```typescript
import { RepertoireService } from '@0xray/repertoire'; // or relative path

// In constructor, after DEFAULT_AGENT_CAPABILITIES init:
const repertoire = new RepertoireService();
this.capabilities = repertoire.enhanceCapabilities(this.capabilities);

// Update selectAgentForTask signature:
selectAgentForTask(
  requiredCapabilities: string[],
  complexity: number,
  operationDescription = '',
): string | null {
  const repertoire = new RepertoireService();
  return repertoire.selectAgent(this.capabilities, requiredCapabilities, complexity, operationDescription);
}
```

## 3. `src/mcps/orchestrator/execution/execution-planner.ts`

In `assignTasksToAgents`:

```typescript
const agent = this.capabilitiesManager.selectAgentForTask(
  [task.type, ...(task.metadata?.repertoireSignals ?? [])],
  complexity,
  task.description,
) || 'orchestrator';
```

In `createExecutionPlan`, before return:

```typescript
const repertoire = new RepertoireService();
const enrichedTasks = repertoire.enrichTasks(tasks);
return repertoire.enrichPlan({ tasks: enrichedTasks, strategy, agentAssignments, estimatedDuration }, enrichedTasks);
```

## 4. `src/nucleus/thin-dispatch.ts`

```typescript
import { RepertoireService } from '@0xray/repertoire';

export function scoreAndRoute(operation: string, context: unknown, thresholds?) {
  const score = scoreComplexity(operation, context, thresholds);
  let agent = routeToAgent(score);

  const repertoire = new RepertoireService();
  const resolved = repertoire.resolveThinDispatch(agent, operation, score.score);
  frameworkLogger.log('nucleus-thin-dispatch', 'repertoire-routing', 'info', {
    baseAgent: agent,
    resolvedAgent: resolved.agent,
    adjustedScore: resolved.adjustedScore,
    signals: resolved.repertoireContext.matchedSignals,
  });

  return { score: { ...score, score: resolved.adjustedScore }, agent: resolved.agent };
}
```

## 5. `src/mcps/orchestrator/handlers/task-handler.ts`

Before `createExecutionPlan`:

```typescript
const repertoire = new RepertoireService();
const enrichedTasks = repertoire.enrichTasks(tasks);
const inheritedContext = repertoire.buildInheritedContext(enrichedTasks);

if (deps.asideId) {
  await spawnAside({
    description,
    sessionId,
    inheritedContext: { repertoire: inheritedContext },
  });
}
```

## 6. Feedback loop

After orchestration completes in `task-handler.ts`:

```typescript
for (const [agent, assignedTasks] of executionPlan.agentAssignments) {
  for (const task of assignedTasks) {
    repertoire.ingestOrchestratorFeedback({
      timestamp: new Date().toISOString(),
      sessionId,
      taskId: task.id,
      assignedAgent: agent,
      repertoireSignals: task.metadata?.repertoireSignals ?? [],
      complexity: task.estimatedComplexity ?? 30,
      success: orchestrationResult.success,
      durationMs: orchestrationResult.duration,
    });
  }
}
```