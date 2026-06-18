import type {
  AgentCapability,
  ExecutionPlan,
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
} from '../types.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import { CapabilityEnhancer } from './capability-enhancer.js';
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

  injectSignalsIntoTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
    return this.injector.matchSignalsForTasks(tasks);
  }

  buildInheritedContext(tasks: OrchestrationTask[]): RepertoireInheritedContext {
    return this.injector.buildInheritedContext(tasks);
  }

  /**
   * Enriches an execution plan with Repertoire metadata before agent assignment.
   * Intended to be called from ExecutionPlanner.createExecutionPlan (0xRay patch).
   */
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

  /**
   * Select best agent using Repertoire-aware scoring.
   * Mirrors AgentCapabilitiesManager.selectAgentForTask with signal dimensions.
   */
  selectAgentForTask(
    capabilities: Map<string, AgentCapability>,
    requiredCapabilities: string[],
    complexity: number,
    operationDescription: string,
  ): string | null {
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
      );

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * thinDispatch integration: returns agent override when ontological-trap detected.
   */
  resolveThinDispatchAgent(
    baseAgent: string,
    operation: string,
    complexityScore: number,
  ): { agent: string; adjustedScore: number; repertoireContext: RepertoireRoutingContext } {
    const repertoireContext = this.buildRoutingContext(operation);
    const adjustedScore = this.injector.adjustComplexityScore(complexityScore, repertoireContext);

    let agent = baseAgent;
    if (repertoireContext.ontologicalTrapDetected && adjustedScore >= 26) {
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