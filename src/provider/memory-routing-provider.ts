/**
 * Repertoire implementation of the 0xRay MemoryRoutingProvider contract.
 *
 * Loaded dynamically by 0xRay via features.json memory_routing.module_path.
 * Other providers can follow the same createMemoryRoutingProvider() export pattern.
 */

import { resolve } from 'node:path';
import { RepertoireService } from '../RepertoireService.js';
import type {
  AgentCapability,
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
} from '../types.js';

/** Mirrors 0xRay memory-routing/types.ts — kept local to avoid compile-time coupling */
export interface MemoryAgentCapability {
  capabilities: string[];
  complexityThreshold: number;
  concurrentTasks: number;
  memorySignals?: string[];
  memoryTags?: string[];
}

export interface MemoryOrchestrationTask {
  id: string;
  description: string;
  type: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[];
  estimatedComplexity?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryTaskConfidence {
  signals: Array<{ name: string; confidence: number }>;
  matchedSignals: string[];
  avgConfidence: number;
  maxConfidence: number;
  highConfidenceTrapPresent: boolean;
  ontologicalTrapDetected: boolean;
  complexityBoost: number;
  recommendedAgent: string | null;
}

export interface MemoryRoutingContext {
  providerId: string;
  matchedSignals: string[];
  matchedTags: string[];
  flags: Record<string, boolean>;
  synthesisAvailable: boolean;
  signalConfidences?: Record<string, number>;
  avgMatchConfidence?: number;
}

export interface MemoryInheritedContext {
  providerId: string;
  matchedSignals: Array<{ name: string; definition: string; priority: string }>;
  synthesisExcerpt?: string;
  flags: Record<string, boolean>;
}

export interface MemoryThinDispatchResult {
  agent: string;
  adjustedScore: number;
  context: MemoryRoutingContext;
}

export interface OrchestratorFeedbackEntry {
  timestamp: string;
  sessionId: string;
  taskId: string;
  assignedAgent: string;
  memorySignals: string[];
  complexity: number;
  success: boolean;
  durationMs: number;
  dynamoResult?: Record<string, unknown>;
}

export interface MemoryRoutingProviderConfig {
  dataDir?: string;
  signalsPath?: string;
  logDir?: string;
  statePath?: string;
}

export interface MemoryRoutingProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  buildRoutingContext(operation: string): MemoryRoutingContext;
  enhanceAgentCapabilities(
    base: Map<string, MemoryAgentCapability>,
  ): Map<string, MemoryAgentCapability>;
  enrichTasks(tasks: MemoryOrchestrationTask[]): MemoryOrchestrationTask[];
  buildInheritedContext(tasks: MemoryOrchestrationTask[]): MemoryInheritedContext;
  selectAgent(
    capabilities: Map<string, MemoryAgentCapability>,
    requiredCapabilities: string[],
    complexity: number,
    operation: string,
  ): string | null;
  resolveThinDispatch(
    baseAgent: string,
    operation: string,
    complexityScore: number,
  ): MemoryThinDispatchResult;
  getTaskConfidence?(task: MemoryOrchestrationTask): MemoryTaskConfidence;
  ingestFeedback?(entry: OrchestratorFeedbackEntry): void;
}

function toRepertoireCaps(caps: MemoryAgentCapability): AgentCapability {
  return {
    capabilities: caps.capabilities,
    complexityThreshold: caps.complexityThreshold,
    concurrentTasks: caps.concurrentTasks,
    repertoireSignals: caps.memorySignals,
    repertoireTags: caps.memoryTags,
  };
}

function fromRepertoireCaps(caps: AgentCapability): MemoryAgentCapability {
  return {
    capabilities: caps.capabilities,
    complexityThreshold: caps.complexityThreshold,
    concurrentTasks: caps.concurrentTasks,
    memorySignals: caps.repertoireSignals,
    memoryTags: caps.repertoireTags,
  };
}

function toRoutingContext(ctx: RepertoireRoutingContext): MemoryRoutingContext {
  return {
    providerId: 'repertoire',
    matchedSignals: ctx.matchedSignals,
    matchedTags: ctx.matchedTags,
    flags: {
      ontologicalTrapDetected: ctx.ontologicalTrapDetected,
      highConfidenceTrap: ctx.highConfidenceTrapPresent,
    },
    synthesisAvailable: ctx.synthesisAvailable,
    signalConfidences: ctx.signalConfidences,
    avgMatchConfidence: ctx.avgMatchConfidence,
  };
}

function toInheritedContext(ctx: RepertoireInheritedContext): MemoryInheritedContext {
  return {
    providerId: 'repertoire',
    matchedSignals: ctx.matchedSignals.map((s) => ({
      name: s.name,
      definition: s.definition,
      priority: s.priority,
    })),
    synthesisExcerpt: ctx.synthesisExcerpt,
    flags: { ontologicalTrapDetected: ctx.ontologicalTrapSignals.length > 0 },
  };
}

export class RepertoireMemoryRoutingProvider implements MemoryRoutingProvider {
  readonly id = 'repertoire';
  readonly name = 'Repertoire (deep memory + primitive registry)';
  private readonly service: RepertoireService;

  constructor(config: MemoryRoutingProviderConfig = {}) {
    const cwd = process.cwd();
    this.service = new RepertoireService({
      dataDir: config.dataDir ? resolve(cwd, config.dataDir) : undefined,
      signalsPath: config.signalsPath ? resolve(cwd, config.signalsPath) : undefined,
      statePath: config.statePath ? resolve(cwd, config.statePath) : undefined,
      logDir: config.logDir ? resolve(cwd, config.logDir) : undefined,
    });
  }

  isAvailable(): boolean {
    try {
      const signals = this.service.signalsManager.load();
      return signals.signals.length > 0;
    } catch {
      return false;
    }
  }

  buildRoutingContext(operation: string): MemoryRoutingContext {
    return toRoutingContext(this.service.buildRoutingContext(operation));
  }

  enhanceAgentCapabilities(
    base: Map<string, MemoryAgentCapability>,
  ): Map<string, MemoryAgentCapability> {
    const repCaps = new Map(
      Array.from(base.entries()).map(([k, v]) => [k, toRepertoireCaps(v)]),
    );
    const enriched = this.service.enhanceCapabilities(repCaps);
    return new Map(
      Array.from(enriched.entries()).map(([k, v]) => [k, fromRepertoireCaps(v)]),
    );
  }

  enrichTasks(tasks: MemoryOrchestrationTask[]): MemoryOrchestrationTask[] {
    const repTasks: OrchestrationTask[] = tasks.map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type,
      priority: t.priority,
      dependencies: t.dependencies,
      estimatedComplexity: t.estimatedComplexity,
      metadata: t.metadata as OrchestrationTask['metadata'],
    }));

    const enriched = this.service.enrichTasks(repTasks);
    return enriched.map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type,
      priority: t.priority,
      dependencies: t.dependencies,
      estimatedComplexity: t.estimatedComplexity,
      metadata: {
        ...t.metadata,
        memoryProviderId: 'repertoire',
        memorySignals: t.metadata?.repertoireSignals,
      },
    }));
  }

  buildInheritedContext(tasks: MemoryOrchestrationTask[]): MemoryInheritedContext {
    const repTasks: OrchestrationTask[] = tasks.map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type,
    }));
    return toInheritedContext(this.service.buildInheritedContext(repTasks));
  }

  selectAgent(
    capabilities: Map<string, MemoryAgentCapability>,
    requiredCapabilities: string[],
    complexity: number,
    operation: string,
  ): string | null {
    const repCaps = new Map(
      Array.from(capabilities.entries()).map(([k, v]) => [k, toRepertoireCaps(v)]),
    );
    return this.service.selectAgent(repCaps, requiredCapabilities, complexity, operation);
  }

  resolveThinDispatch(
    baseAgent: string,
    operation: string,
    complexityScore: number,
  ): MemoryThinDispatchResult {
    const resolved = this.service.resolveThinDispatch(baseAgent, operation, complexityScore);
    return {
      agent: resolved.agent,
      adjustedScore: resolved.adjustedScore,
      context: toRoutingContext(resolved.repertoireContext),
    };
  }

  getTaskConfidence(task: MemoryOrchestrationTask): MemoryTaskConfidence {
    const repTask: OrchestrationTask = {
      id: task.id,
      description: task.description,
      type: task.type,
      priority: task.priority,
      dependencies: task.dependencies,
      estimatedComplexity: task.estimatedComplexity,
      metadata: task.metadata as OrchestrationTask['metadata'],
    };
    const context = this.service.orchestratorBridge.getConfidenceForTask(repTask);
    return {
      signals: context.signals.map((entry) => ({
        name: entry.name,
        confidence: entry.confidence,
      })),
      matchedSignals: context.matchedSignals,
      avgConfidence: context.avgConfidence,
      maxConfidence: context.maxConfidence,
      highConfidenceTrapPresent: context.highConfidenceTrapPresent,
      ontologicalTrapDetected: context.ontologicalTrapDetected,
      complexityBoost: context.complexityBoost,
      recommendedAgent: context.recommendedAgent,
    };
  }

  ingestFeedback(entry: OrchestratorFeedbackEntry): void {
    this.service.ingestOrchestratorFeedback({
      timestamp: entry.timestamp,
      sessionId: entry.sessionId,
      taskId: entry.taskId,
      assignedAgent: entry.assignedAgent,
      repertoireSignals: entry.memorySignals,
      complexity: entry.complexity,
      success: entry.success,
      durationMs: entry.durationMs,
      dynamoResult: entry.dynamoResult,
    });
  }
}

/** Factory export — 0xRay provider-loader calls this by name */
export function createMemoryRoutingProvider(
  config?: MemoryRoutingProviderConfig,
): MemoryRoutingProvider {
  return new RepertoireMemoryRoutingProvider(config);
}