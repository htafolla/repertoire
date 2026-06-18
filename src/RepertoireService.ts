import { CuratedSignalsManager } from './registry/CuratedSignalsManager.js';
import { InferenceStateManager } from './registry/InferenceStateManager.js';
import { MetaInferenceEngine } from './synthesis/meta-inference-engine.js';
import { GrooverLogIngester } from './ingestion/groover-log-ingester.js';
import { XraySessionIngester } from './ingestion/xray-session-ingester.js';
import { OrchestratorFeedbackIngester } from './ingestion/orchestrator-feedback-ingester.js';
import { RepertoireOrchestratorBridge } from './orchestrator-bridge/RepertoireOrchestratorBridge.js';
import {
  OntologicalTrapEnforcer,
  type GovernWithSolarFn,
} from './governance/ontological-trap-enforcer.js';
import { DEFAULT_MIN_CONFIDENCE_GATE } from './orchestrator-bridge/confidence-gate.js';
import type {
  AgentCapability,
  CuratedSignal,
  ExecutionPlan,
  InferenceEntry,
  OrchestrationTask,
  OrchestratorFeedbackEntry,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
  SynthesisReport,
  TaskConfidenceContext,
} from './types.js';

export interface RepertoireServiceOptions {
  dataDir?: string;
  logDir?: string;
  signalsPath?: string;
  statePath?: string;
}

export class RepertoireService {
  readonly signalsManager: CuratedSignalsManager;
  readonly stateManager: InferenceStateManager;
  readonly orchestratorBridge: RepertoireOrchestratorBridge;
  readonly metaInference: MetaInferenceEngine;
  readonly feedbackIngester: OrchestratorFeedbackIngester;

  private readonly logDir: string;

  constructor(options: RepertoireServiceOptions = {}) {
    const dataDir = options.dataDir ?? 'data';
    this.logDir = options.logDir ?? 'logs/groover-inference';

    this.signalsManager = new CuratedSignalsManager(
      options.signalsPath ?? `${dataDir}/curated_signals.json`,
    );
    this.stateManager = new InferenceStateManager(
      options.statePath ?? `${dataDir}/inference-state.json`,
    );
    this.orchestratorBridge = new RepertoireOrchestratorBridge(this.signalsManager);
    this.metaInference = new MetaInferenceEngine({
      logDir: this.logDir,
      statePath: options.statePath ?? `${dataDir}/inference-state.json`,
    });
    this.feedbackIngester = new OrchestratorFeedbackIngester();
  }

  // --- Ingestion ---

  ingestGrooverLogs(sourceDir: string): { imported: number; skipped: number; promoted: string[] } {
    const ingester = new GrooverLogIngester({
      sourceDir,
      targetDir: this.logDir,
      signalsManager: this.signalsManager,
    });
    return ingester.ingest();
  }

  ingestXraySessions(sourceDir: string): { imported: number; skipped: number } {
    const ingester = new XraySessionIngester({
      sourceDir,
      targetDir: this.logDir,
      signalsManager: this.signalsManager,
    });
    return ingester.ingest();
  }

  ingestOrchestratorFeedback(entry: OrchestratorFeedbackEntry): string {
    return this.feedbackIngester.ingest(entry);
  }

  // --- Synthesis ---

  async runMetaInference(): Promise<SynthesisReport | null> {
    return this.metaInference.run();
  }

  // --- Orchestrator enrichment (0xRay integration surface) ---

  enhanceCapabilities(
    base: Map<string, AgentCapability>,
  ): Map<string, AgentCapability> {
    return this.orchestratorBridge.enhanceAgentCapabilities(base);
  }

  buildRoutingContext(operation: string): RepertoireRoutingContext {
    return this.orchestratorBridge.buildRoutingContext(operation);
  }

  enrichTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
    return this.orchestratorBridge.injectSignalsIntoTasks(tasks);
  }

  enrichPlan(plan: ExecutionPlan, tasks: OrchestrationTask[]): ExecutionPlan {
    return this.orchestratorBridge.enrichExecutionPlan(plan, tasks);
  }

  buildInheritedContext(tasks: OrchestrationTask[]): RepertoireInheritedContext {
    return this.orchestratorBridge.buildInheritedContext(tasks);
  }

  selectAgent(
    capabilities: Map<string, AgentCapability>,
    requiredCapabilities: string[],
    complexity: number,
    operation: string,
  ): string | null {
    return this.orchestratorBridge.selectAgentForTask(
      capabilities,
      requiredCapabilities,
      complexity,
      operation,
    );
  }

  resolveThinDispatch(
    baseAgent: string,
    operation: string,
    complexityScore: number,
  ) {
    return this.orchestratorBridge.resolveThinDispatchAgent(
      baseAgent,
      operation,
      complexityScore,
    );
  }

  // --- Governance ---

  createTrapEnforcer(governFn: GovernWithSolarFn): OntologicalTrapEnforcer {
    return new OntologicalTrapEnforcer({
      signalsManager: this.signalsManager,
      governFn,
    });
  }

  querySignals(text: string) {
    return this.signalsManager.matchByText(text);
  }

  getHighPrioritySignals() {
    return this.signalsManager.getHighPrioritySignals();
  }

  getHighConfidenceSignals(options: {
    minConfidence?: number;
    tags?: string[];
    limit?: number;
  } = {}): Array<CuratedSignal & { effectiveConfidence: number }> {
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE_GATE;
    const limit = options.limit ?? 20;
    const tagFilter = options.tags?.map((tag) => tag.toLowerCase());

    const signals = this.signalsManager
      .getSignalsAboveConfidence(minConfidence)
      .filter((signal) => {
        if (!tagFilter?.length) return true;
        return signal.tags.some((tag) => tagFilter.includes(tag.toLowerCase()));
      })
      .map((signal) => ({
        ...signal,
        effectiveConfidence: signal.observation_stats?.avg_confidence ?? DEFAULT_MIN_CONFIDENCE_GATE,
      }))
      .sort(
        (a, b) =>
          b.effectiveConfidence - a.effectiveConfidence ||
          (b.observation_stats?.observation_count ?? 0) -
            (a.observation_stats?.observation_count ?? 0),
      )
      .slice(0, limit);

    return signals;
  }

  getTaskConfidence(input: {
    description: string;
    type?: string;
    id?: string;
  }): TaskConfidenceContext {
    const task: OrchestrationTask = {
      id: input.id ?? 'mcp-query',
      description: input.description,
      type: input.type ?? 'general',
    };
    return this.orchestratorBridge.getConfidenceForTask(task);
  }

  searchPrimitives(
    query: string,
    options: { minConfidence?: number; limit?: number } = {},
  ): Array<{
    name: string;
    confidence: number;
    score: number;
    priority: string;
    definition: string;
    tags: string[];
    status?: string;
    observationCount?: number;
  }> {
    const minConfidence = options.minConfidence ?? 0;
    const limit = options.limit ?? 10;
    const matches = this.signalsManager.matchByText(query, 2);

    return matches
      .map((match) => {
        const registryConfidence = match.signal.observation_stats?.avg_confidence;
        const confidence = registryConfidence ?? Math.min(1, match.score / 10);
        return {
          name: match.signal.name,
          confidence,
          score: match.score,
          priority: match.signal.priority,
          definition: match.signal.definition,
          tags: match.signal.tags,
          status: match.signal.status,
          observationCount: match.signal.observation_stats?.observation_count,
        };
      })
      .filter((entry) => entry.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence || b.score - a.score)
      .slice(0, limit);
  }
}