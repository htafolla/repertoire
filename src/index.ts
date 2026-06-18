export { RepertoireService } from './RepertoireService.js';
export { CuratedSignalsManager } from './registry/CuratedSignalsManager.js';
export { InferenceStateManager } from './registry/InferenceStateManager.js';
export { MetaInferenceEngine } from './synthesis/meta-inference-engine.js';
export { GrooverLogIngester } from './ingestion/groover-log-ingester.js';
export {
  aggregateWeightedPrimitives,
  formatWeightedPrimitivesSection,
} from './synthesis/primitive-confidence-aggregator.js';
export { XraySessionIngester } from './ingestion/xray-session-ingester.js';
export { OrchestratorFeedbackIngester } from './ingestion/orchestrator-feedback-ingester.js';
export { RepertoireOrchestratorBridge } from './orchestrator-bridge/RepertoireOrchestratorBridge.js';
export {
  getConfidenceForTask,
  DEFAULT_MIN_CONFIDENCE_GATE,
  TRAP_CAPABLE_AGENTS,
} from './orchestrator-bridge/confidence-gate.js';
export { OntologicalTrapEnforcer } from './governance/ontological-trap-enforcer.js';
export * from './types.js';