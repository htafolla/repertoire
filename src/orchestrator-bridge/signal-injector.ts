import { readFileSync, existsSync } from 'node:fs';
import type {
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
} from '../types.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import {
  applyConfidenceComplexityBoost,
  confidenceWeightedAgentBoost,
  DEFAULT_MIN_CONFIDENCE_GATE,
  getConfidenceForTask,
  resolveSignalConfidence,
} from './confidence-gate.js';

export class SignalInjector {
  constructor(
    private readonly signalsManager: CuratedSignalsManager,
    private readonly synthesisReportPath = 'logs/meta-inference/synthesis.md',
  ) {}

  buildRoutingContext(text: string): RepertoireRoutingContext {
    const matches = this.signalsManager.matchByText(text, 2);
    const ontologicalTrapDetected =
      /TYPE:\s*ontological-trap/i.test(text) ||
      /ontological-trap/i.test(text) ||
      matches.some((match) => match.signal.tags.includes('ontological-trap'));

    const signalConfidences = Object.fromEntries(
      matches.map((match) => [
        match.signal.name,
        resolveSignalConfidence(match.signal.name, this.signalsManager, match),
      ]),
    );

    const confidenceValues = Object.values(signalConfidences);
    const avgMatchConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0;

    const trapSignals = matches.filter((match) =>
      match.signal.tags.includes('ontological-trap'),
    );
    const highConfidenceTrapPresent =
      ontologicalTrapDetected &&
      trapSignals.some(
        (match) =>
          (signalConfidences[match.signal.name] ?? 0) >= DEFAULT_MIN_CONFIDENCE_GATE,
      );

    return {
      matchedSignals: matches.map((match) => match.signal.name),
      matchedTags: [...new Set(matches.flatMap((match) => match.signal.tags))],
      ontologicalTrapDetected,
      synthesisAvailable: existsSync(this.synthesisReportPath),
      signalMatches: matches,
      signalConfidences,
      avgMatchConfidence,
      highConfidenceTrapPresent,
    };
  }

  matchSignalsForTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
    return tasks.map((task) => {
      const confidenceContext = getConfidenceForTask(task, this.signalsManager);
      const ctx = this.buildRoutingContext(`${task.description} ${task.type}`);
      const signalConfidences = Object.fromEntries(
        confidenceContext.signals.map((entry) => [entry.name, entry.confidence]),
      );

      return {
        ...task,
        metadata: {
          ...task.metadata,
          repertoireSignals: confidenceContext.signals.map((entry) => entry.name),
          matchedPrimitives: confidenceContext.signals.map((entry) => entry.name),
          ontologicalTrapDetected: confidenceContext.ontologicalTrapDetected,
          memorySignalConfidences: signalConfidences,
          memoryAvgConfidence: confidenceContext.avgConfidence,
          memoryHighConfidenceTrap: confidenceContext.highConfidenceTrapPresent,
          memoryComplexityBoost: confidenceContext.complexityBoost,
          match_confidence: signalConfidences,
          synthesisContext: ctx.synthesisAvailable
            ? this.getSynthesisExcerpt(500)
            : undefined,
        },
      };
    });
  }

  buildInheritedContext(tasks: OrchestrationTask[]): RepertoireInheritedContext {
    const allText = tasks.map((task) => `${task.description} ${task.type}`).join(' ');
    const matches = this.signalsManager.matchByText(allText, 2);

    const trapSignals = matches
      .filter((match) => match.signal.tags.includes('ontological-trap'))
      .map((match) => match.signal.name);

    return {
      matchedSignals: matches.slice(0, 8).map((match) => ({
        name: match.signal.name,
        definition: match.signal.definition,
        priority: match.signal.priority,
      })),
      synthesisExcerpt: this.getSynthesisExcerpt(2000),
      ontologicalTrapSignals: trapSignals,
    };
  }

  /**
   * Signal-aware agent scoring — drop-in replacement logic for AgentCapabilitiesManager.
   */
  scoreAgent(
    agent: string,
    caps: {
      capabilities: string[];
      concurrentTasks: number;
      repertoireSignals?: string[];
      repertoireTags?: string[];
    },
    requiredCapabilities: string[],
    repertoireContext: RepertoireRoutingContext,
    confidenceContext?: ReturnType<typeof getConfidenceForTask>,
  ): number {
    const capMatch = requiredCapabilities.filter((cap) => caps.capabilities.includes(cap)).length;

    const signalMatch = repertoireContext.matchedSignals.reduce((sum, signalName) => {
      if (
        !caps.repertoireSignals?.includes(signalName) &&
        !caps.capabilities.includes(signalName)
      ) {
        return sum;
      }
      const confidence = repertoireContext.signalConfidences[signalName] ?? 0.5;
      return sum + confidence;
    }, 0);

    const tagMatch = repertoireContext.matchedTags.filter((tag) =>
      caps.repertoireTags?.includes(tag),
    ).length;

    const trapBoost = confidenceContext
      ? confidenceWeightedAgentBoost(agent, confidenceContext)
      : repertoireContext.highConfidenceTrapPresent &&
          ['architect', 'security-auditor', 'researcher'].includes(agent)
        ? 15
        : 0;

    return (
      capMatch * 10 +
      signalMatch * 8 +
      tagMatch * 5 +
      trapBoost +
      caps.concurrentTasks
    );
  }

  /**
   * Complexity adjustment for thinDispatch when Repertoire context is present.
   */
  adjustComplexityScore(
    baseScore: number,
    context: RepertoireRoutingContext,
    confidenceContext?: ReturnType<typeof getConfidenceForTask>,
  ): number {
    if (confidenceContext) {
      return applyConfidenceComplexityBoost(baseScore, confidenceContext);
    }

    let adjusted = baseScore;

    if (context.highConfidenceTrapPresent) adjusted += 18;
    else if (context.ontologicalTrapDetected) adjusted += 12;
    if (context.matchedSignals.length >= 2) adjusted += 8;
    if (context.synthesisAvailable) adjusted -= 5;
    if (context.matchedTags.includes('provenance-failure')) adjusted += 8;

    return Math.min(Math.max(Math.round(adjusted), 1), 100);
  }

  private getSynthesisExcerpt(maxChars: number): string | undefined {
    if (!existsSync(this.synthesisReportPath)) return undefined;
    const content = readFileSync(this.synthesisReportPath, 'utf8');
    const section5 = content.split('## 5. Strategic Recommendations')[1];
    const excerpt = section5 ?? content.slice(-maxChars);
    return excerpt.slice(0, maxChars).trim();
  }
}