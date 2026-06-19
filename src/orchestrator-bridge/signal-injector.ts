import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
  SynthesisCollocatedContext,
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
      matches
        .map((match) => {
          const confidence = resolveSignalConfidence(match.signal.name, this.signalsManager);
          return confidence === null ? null : [match.signal.name, confidence];
        })
        .filter((entry): entry is [string, number] => entry !== null),
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
        (match) => (signalConfidences[match.signal.name] ?? 0) >= DEFAULT_MIN_CONFIDENCE_GATE,
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

  buildSynthesisContext(
    projectRoot: string,
    dueReason: string | null = null,
  ): SynthesisCollocatedContext {
    const operation =
      'synthesis checkpoint reflect realign coherence plan codex signals primitives';
    const matches = this.signalsManager.matchByText(operation, 6);
    const signalConfidences = Object.fromEntries(
      matches
        .map((match) => {
          const confidence = resolveSignalConfidence(match.signal.name, this.signalsManager);
          return confidence === null ? null : [match.signal.name, confidence];
        })
        .filter((entry): entry is [string, number] => entry !== null),
    );

    const matchedSignals = matches.map((match) => ({
      name: match.signal.name,
      definition: match.signal.definition,
      priority: match.signal.priority,
      ...(signalConfidences[match.signal.name] !== undefined
        ? { confidence: signalConfidences[match.signal.name] }
        : {}),
    }));

    const codex = this.readCodexExcerpt(projectRoot);
    const planExcerpt = this.readPlanExcerpt(projectRoot);
    const synthesisExcerpt = this.getSynthesisExcerpt(2000);

    const sections = [
      '# Synthesis checkpoint',
      dueReason ? `Due: ${dueReason}` : '',
      matchedSignals.length
        ? `## Matched primitives\n${matchedSignals
            .map((s) => `- ${s.name} (${s.priority}): ${s.definition}`)
            .join('\n')}`
        : '',
      codex.excerpt ? `## Codex (${codex.termCount} terms)\n${codex.excerpt}` : '',
      planExcerpt ? `## Lead-dev plan\n${planExcerpt}` : '',
      synthesisExcerpt ? `## Prior synthesis\n${synthesisExcerpt}` : '',
    ].filter(Boolean);

    return {
      primitive: 'synthesis',
      matchedSignals,
      ...(synthesisExcerpt ? { synthesisExcerpt } : {}),
      codexTermCount: codex.termCount,
      codexExcerpt: codex.excerpt,
      planExcerpt,
      collatedText: sections.join('\n\n'),
    };
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
      const confidence = repertoireContext.signalConfidences[signalName];
      if (confidence === undefined) return sum;
      return sum + confidence;
    }, 0);

    const tagMatch = repertoireContext.matchedTags.filter((tag) =>
      caps.repertoireTags?.includes(tag),
    ).length;

    const trapBoost = confidenceContext
      ? confidenceWeightedAgentBoost(agent, confidenceContext)
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

    return baseScore;
  }

  private getSynthesisExcerpt(maxChars: number): string | undefined {
    if (!existsSync(this.synthesisReportPath)) return undefined;
    const content = readFileSync(this.synthesisReportPath, 'utf8');
    const section5 = content.split('## 5. Strategic Recommendations')[1];
    const excerpt = section5 ?? content.slice(-maxChars);
    return excerpt.slice(0, maxChars).trim();
  }

  private readCodexExcerpt(
    projectRoot: string,
    maxChars = 1200,
  ): { termCount: number; excerpt: string } {
    const codexPath = join(projectRoot, '.xray', 'codex.json');
    if (!existsSync(codexPath)) return { termCount: 0, excerpt: '' };
    try {
      const data = JSON.parse(readFileSync(codexPath, 'utf8')) as {
        terms?: Array<{ id?: number; rule?: string; title?: string }>;
      };
      const terms = data.terms ?? [];
      const lines = terms.slice(0, 12).map((t) => {
        const label = t.title ?? t.rule ?? '';
        return t.id != null ? `${t.id}. ${label}` : label;
      });
      return { termCount: terms.length, excerpt: lines.join('\n').slice(0, maxChars) };
    } catch {
      return { termCount: 0, excerpt: '' };
    }
  }

  private readPlanExcerpt(projectRoot: string, maxChars = 1200): string {
    const planPath = join(projectRoot, '.xray', 'state', 'lead-dev-plan.json');
    if (!existsSync(planPath)) return '';
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
        active?: boolean;
        phases?: Array<{
          id: string;
          name?: string;
          todos: Array<{ id: string; task: string; status: string; subagent?: string }>;
        }>;
      };
      const phases = plan.phases ?? [];
      const lines: string[] = [`active: ${plan.active !== false}`];
      for (const phase of phases) {
        lines.push(`## ${phase.id}${phase.name ? ` — ${phase.name}` : ''}`);
        for (const todo of phase.todos) {
          lines.push(
            `- [${todo.status}] ${todo.id} (${todo.subagent ?? 'agent'}): ${todo.task}`,
          );
        }
      }
      return lines.join('\n').slice(0, maxChars);
    } catch {
      return '';
    }
  }
}