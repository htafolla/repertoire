import { readFileSync, existsSync } from 'node:fs';
import type {
  OrchestrationTask,
  RepertoireInheritedContext,
  RepertoireRoutingContext,
} from '../types.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';

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
      matches.some((m) => m.signal.tags.includes('ontological-trap'));

    return {
      matchedSignals: matches.map((m) => m.signal.name),
      matchedTags: [...new Set(matches.flatMap((m) => m.signal.tags))],
      ontologicalTrapDetected,
      synthesisAvailable: existsSync(this.synthesisReportPath),
      signalMatches: matches,
    };
  }

  matchSignalsForTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
    return tasks.map((task) => {
      const ctx = this.buildRoutingContext(`${task.description} ${task.type}`);
      return {
        ...task,
        metadata: {
          ...task.metadata,
          repertoireSignals: ctx.matchedSignals,
          matchedPrimitives: ctx.matchedSignals,
          ontologicalTrapDetected: ctx.ontologicalTrapDetected,
          synthesisContext: ctx.synthesisAvailable
            ? this.getSynthesisExcerpt(500)
            : undefined,
        },
      };
    });
  }

  buildInheritedContext(tasks: OrchestrationTask[]): RepertoireInheritedContext {
    const allText = tasks.map((t) => `${t.description} ${t.type}`).join(' ');
    const matches = this.signalsManager.matchByText(allText, 2);

    const trapSignals = matches
      .filter((m) => m.signal.tags.includes('ontological-trap'))
      .map((m) => m.signal.name);

    return {
      matchedSignals: matches.slice(0, 8).map((m) => ({
        name: m.signal.name,
        definition: m.signal.definition,
        priority: m.signal.priority,
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
  ): number {
    const capMatch = requiredCapabilities.filter((c) => caps.capabilities.includes(c)).length;

    const signalMatch = repertoireContext.matchedSignals.filter(
      (s) => caps.repertoireSignals?.includes(s) || caps.capabilities.includes(s),
    ).length;

    const tagMatch = repertoireContext.matchedTags.filter((t) =>
      caps.repertoireTags?.includes(t),
    ).length;

    const trapBoost =
      repertoireContext.ontologicalTrapDetected &&
      ['architect', 'security-auditor', 'researcher'].includes(agent)
        ? 15
        : 0;

    return capMatch * 10 + signalMatch * 8 + tagMatch * 5 + trapBoost + caps.concurrentTasks;
  }

  /**
   * Complexity adjustment for thinDispatch when Repertoire context is present.
   */
  adjustComplexityScore(baseScore: number, context: RepertoireRoutingContext): number {
    let adjusted = baseScore;

    if (context.ontologicalTrapDetected) adjusted += 15;
    if (context.matchedSignals.length >= 2) adjusted += 10;
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