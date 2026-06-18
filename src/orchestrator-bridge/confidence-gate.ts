import {
  CuratedSignalsManager,
  DEFAULT_PROMOTION_MIN_CONFIDENCE,
} from '../registry/CuratedSignalsManager.js';
import type { OrchestrationTask, TaskConfidenceContext } from '../types.js';

export const DEFAULT_MIN_CONFIDENCE_GATE = DEFAULT_PROMOTION_MIN_CONFIDENCE;
export const TRAP_CAPABLE_AGENTS = ['architect', 'security-auditor', 'researcher'] as const;

export function resolveSignalConfidence(
  signalName: string,
  signalsManager: CuratedSignalsManager,
  metadataConfidence?: number,
): number | null {
  if (typeof metadataConfidence === 'number') {
    return metadataConfidence;
  }

  const signal = signalsManager.getByName(signalName);
  if (signal?.observation_stats?.avg_confidence !== undefined) {
    return signal.observation_stats.avg_confidence;
  }

  return null;
}

export function getConfidenceForTask(
  task: OrchestrationTask,
  signalsManager: CuratedSignalsManager,
): TaskConfidenceContext {
  const text = `${task.description} ${task.type}`;
  const textMatches = signalsManager.matchByText(text, 2);
  const trapDetected =
    /TYPE:\s*ontological-trap/i.test(text) ||
    Boolean(task.metadata?.ontologicalTrapDetected) ||
    textMatches.some((match) => match.signal.tags.includes('ontological-trap'));

  const metadataConfidences = task.metadata?.memorySignalConfidences ?? {};
  const signals = textMatches
    .map((match) => {
      const confidence = resolveSignalConfidence(
        match.signal.name,
        signalsManager,
        metadataConfidences[match.signal.name],
      );
      if (confidence === null) return null;

      return {
        name: match.signal.name,
        confidence,
        source: 'registry' as const,
        matchedVia: match.matchedOn,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter((entry) => entry.confidence >= DEFAULT_MIN_CONFIDENCE_GATE);

  const trapSignals = signals.filter((entry) =>
    signalsManager.getByName(entry.name)?.tags.includes('ontological-trap'),
  );

  const highConfidenceTrapPresent =
    trapDetected &&
    trapSignals.some((entry) => entry.confidence >= DEFAULT_MIN_CONFIDENCE_GATE);

  const avgConfidence =
    signals.length > 0
      ? signals.reduce((sum, entry) => sum + entry.confidence, 0) / signals.length
      : 0;
  const maxConfidence = signals.length > 0 ? Math.max(...signals.map((entry) => entry.confidence)) : 0;

  let complexityBoost = 0;
  if (highConfidenceTrapPresent) {
    complexityBoost += Math.round(10 + maxConfidence * 10);
  }

  const highConfidenceCount = signals.length;
  if (highConfidenceCount >= 2) complexityBoost += 5;

  return {
    signals,
    matchedSignals: signals.map((entry) => entry.name),
    avgConfidence,
    maxConfidence,
    highConfidenceTrapPresent,
    ontologicalTrapDetected: trapDetected,
    minConfidenceGate: DEFAULT_MIN_CONFIDENCE_GATE,
    complexityBoost,
    recommendedAgent: highConfidenceTrapPresent ? 'architect' : null,
  };
}

export function confidenceWeightedAgentBoost(
  agent: string,
  context: TaskConfidenceContext,
): number {
  if (!context.highConfidenceTrapPresent) return 0;
  if (!TRAP_CAPABLE_AGENTS.includes(agent as (typeof TRAP_CAPABLE_AGENTS)[number])) {
    return 0;
  }
  return Math.round(12 + context.maxConfidence * 10);
}

export function applyConfidenceComplexityBoost(
  baseComplexity: number,
  context: TaskConfidenceContext,
): number {
  return Math.min(Math.max(Math.round(baseComplexity + context.complexityBoost), 1), 100);
}