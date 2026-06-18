import type {
  AgentCapability,
  ExecutionPlan,
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
  TaskConfidenceContext,
} from '../types.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import { CapabilityEnhancer } from './capability-enhancer.js';
import { getConfidenceForTask, TRAP_CAPABLE_AGENTS } from './confidence-gate.js';
import { SignalInjector } from './signal-injector.js';

export class RepertoireOrchestratorBridge {
  private readonly enhancer: CapabilityEnhancer;
  private readonly injector: SignalInjector;

  constructor(private readonly signalsManager: CuratedSignalsManager) {
    this.enhancer = new CapabilityEnhancer(signalsManager);
    this.injector = new SignalInjector(signalsManager);
  }

  enhanceAgentCapabilities(
    baseCapabilities: Map<string, AgentCapability>,
  ): Map<string, AgentCapability> {
    return this.enhancer.enhance(baseCapabilities);
  }

  buildRoutingContext(operation: string): RepertoireRoutingContext {
    return this.injector.buildRoutingContext(operation);
  }

  getConfidenceForTask(task: OrchestrationTask): TaskConfidenceContext {
    return getConfidenceForTask(task, this.signalsManager);
  }

  injectSignalsIntoTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
    return this.injector.matchSignalsForTasks(tasks);
  }

  buildInheritedContext(tasks: OrchestrationTask[]): RepertoireInheritedContext {
    return this.injector.buildInheritedContext(tasks);
  }

  enrichExecutionPlan(
    plan: ExecutionPlan,
    tasks: OrchestrationTask[],
  ): ExecutionPlan {
    const enrichedTasks = this.injectSignalsIntoTasks(tasks);
    return {
      ...plan,
      tasks: enrichedTasks,
      repertoireContext: this.buildInheritedContext(enrichedTasks),
    };
  }

  selectAgentForTask(
    capabilities: Map<string, AgentCapability>,
    requiredCapabilities: string[],
    complexity: number,
    operationDescription: string,
    task?: OrchestrationTask,
  ): string | null {
    const syntheticTask: OrchestrationTask = task ?? {
      id: 'routing-op',
      description: operationDescription,
      type: requiredCapabilities[0] ?? 'general',
    };

    const confidenceContext = getConfidenceForTask(syntheticTask, this.signalsManager);
    const repertoireContext = this.buildRoutingContext(operationDescription);
    let bestAgent: string | null = null;
    let bestScore = -1;

    for (const [agent, caps] of capabilities) {
      if (complexity > caps.complexityThreshold) continue;

      const score = this.injector.scoreAgent(
        agent,
        caps,
        requiredCapabilities,
        repertoireContext,
        confidenceContext,
      );

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    if (confidenceContext.highConfidenceTrapPresent && bestAgent) {
      const trapAgent = TRAP_CAPABLE_AGENTS.find((agent) => capabilities.has(agent));
      if (trapAgent && capabilities.get(trapAgent)) {
        const trapCaps = capabilities.get(trapAgent)!;
        if (complexity <= trapCaps.complexityThreshold) {
          return trapAgent;
        }
      }
    }

    return bestAgent;
  }

  resolveThinDispatchAgent(
    baseAgent: string,
    operation: string,
    complexityScore: number,
  ): { agent: string; adjustedScore: number; repertoireContext: RepertoireRoutingContext } {
    const syntheticTask: OrchestrationTask = {
      id: 'thin-dispatch',
      description: operation,
      type: 'routing',
    };
    const confidenceContext = getConfidenceForTask(syntheticTask, this.signalsManager);
    const repertoireContext = this.buildRoutingContext(operation);
    const adjustedScore = this.injector.adjustComplexityScore(
      complexityScore,
      repertoireContext,
      confidenceContext,
    );

    let agent = baseAgent;
    if (confidenceContext.highConfidenceTrapPresent && adjustedScore >= 26) {
      agent = 'architect';
    } else if (
      repertoireContext.matchedTags.includes('provenance-failure') &&
      adjustedScore < 51
    ) {
      agent = 'bug-triage-specialist';
    }

    return { agent, adjustedScore, repertoireContext };
  }
}