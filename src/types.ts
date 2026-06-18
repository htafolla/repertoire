export type InferenceSource = 'groover' | 'xray' | 'dynamo' | 'orchestrator';

export type InferenceType =
  | 'theoretical'
  | 'temporal-drift'
  | 'practical-workflow'
  | 'ontological-trap'
  | 'provenance-failure';

export type SignalPriority = 'high' | 'medium' | 'low';

export type SignalStatus = 'proposed' | 'validated' | 'integrated' | 'deprecated';

export interface PrimitiveMatch {
  name: string;
  confidence: number;
}

export interface DynamoResult {
  result?: {
    recommendation?: 'PASS' | 'NEEDS_REVISION' | 'REJECT' | string;
    resonanceScore?: number;
  } | null;
  matchedPrimitives?: string[];
  error?: string;
  status?: number;
}

export interface InferenceEntry {
  timestamp: string;
  source: InferenceSource;
  post_id?: string;
  post_title?: string;
  comment_id?: string;
  session_id?: string;
  inference: string;
  public_reply?: string;
  inference_type?: InferenceType;
  matched_primitives?: string[];
  match_confidence?: Record<string, number>;
  governance_forced?: boolean;
  dynamo_result?: DynamoResult;
  repertoire_signals?: string[];
}

export interface SignalObservationStats {
  observation_count: number;
  avg_confidence: number;
  max_confidence: number;
  last_seen: string;
  governance_forced_count: number;
}

export interface SignalFeedbackStats {
  outcome_count: number;
  success_count: number;
  failure_count: number;
  last_outcome: 'success' | 'failure';
  last_task_id?: string;
  last_assigned_agent?: string;
  last_duration_ms?: number;
  last_seen: string;
}

export interface WeightedPrimitive {
  name: string;
  weightedScore: number;
  avgConfidence: number;
  occurrenceCount: number;
  governanceForcedCount: number;
}

export interface CuratedSignal {
  name: string;
  definition: string;
  example_inference_snippet?: string;
  tags: string[];
  batches?: number[];
  first_seen?: string;
  status?: SignalStatus;
  priority: SignalPriority;
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  observation_stats?: SignalObservationStats;
  feedback_stats?: SignalFeedbackStats;
}

export interface CuratedSignalsFile {
  description: string;
  schema_version: string;
  last_updated: string;
  source?: string;
  implementation_guidance?: {
    how_to_use: string;
    integration_points: string[];
    priority_order: string;
  };
  signals: CuratedSignal[];
}

export interface InferenceState {
  processedCommentIds: string[];
  processedSessionIds: string[];
  lastRun: string | null;
}

export interface SynthesisReport {
  entriesProcessed: number;
  batchResults: string[];
  finalReport: string;
  timestamp: string;
  dynamoStats: {
    pass: number;
    reject: number;
    avgResonance: number | null;
  };
}

export interface SignalMatch {
  signal: CuratedSignal;
  score: number;
  matchedOn: Array<'name' | 'tag' | 'definition' | 'criteria' | 'snippet'>;
}

export interface SignalConfidenceDetail {
  name: string;
  confidence: number;
  source: 'registry' | 'task-metadata';
  matchedVia?: SignalMatch['matchedOn'];
}

export interface TaskConfidenceContext {
  signals: SignalConfidenceDetail[];
  matchedSignals: string[];
  avgConfidence: number;
  maxConfidence: number;
  highConfidenceTrapPresent: boolean;
  ontologicalTrapDetected: boolean;
  minConfidenceGate: number;
  complexityBoost: number;
  recommendedAgent: string | null;
}

export interface RepertoireRoutingContext {
  matchedSignals: string[];
  matchedTags: string[];
  ontologicalTrapDetected: boolean;
  synthesisAvailable: boolean;
  signalMatches: SignalMatch[];
  signalConfidences: Record<string, number>;
  avgMatchConfidence: number;
  highConfidenceTrapPresent: boolean;
}

export interface RepertoireInheritedContext {
  matchedSignals: Array<{ name: string; definition: string; priority: SignalPriority }>;
  synthesisExcerpt?: string;
  governanceStats?: { passRate: number; avgResonance: number };
  ontologicalTrapSignals: string[];
}

export interface OrchestratorFeedbackEntry {
  timestamp: string;
  sessionId: string;
  taskId: string;
  assignedAgent: string;
  repertoireSignals: string[];
  complexity: number;
  success: boolean;
  durationMs: number;
  dynamoResult?: DynamoResult;
}

/** Minimal types mirroring 0xRay orchestrator — kept local to avoid hard dependency */
export interface AgentCapability {
  capabilities: string[];
  complexityThreshold: number;
  concurrentTasks: number;
  repertoireSignals?: string[];
  repertoireTags?: string[];
}

export interface OrchestrationTask {
  id: string;
  description: string;
  type: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[];
  estimatedComplexity?: number;
  metadata?: {
    repertoireSignals?: string[];
    matchedPrimitives?: string[];
    synthesisContext?: string;
    ontologicalTrapDetected?: boolean;
    memorySignalConfidences?: Record<string, number>;
    memoryAvgConfidence?: number;
    memoryHighConfidenceTrap?: boolean;
    memoryComplexityBoost?: number;
    match_confidence?: Record<string, number>;
  };
}

export interface ExecutionPlan {
  tasks: OrchestrationTask[];
  strategy: 'parallel' | 'sequential' | 'optimized';
  agentAssignments: Map<string, OrchestrationTask[]>;
  estimatedDuration: number;
  repertoireContext?: RepertoireInheritedContext;
}