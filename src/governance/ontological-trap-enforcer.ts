import type { CuratedSignal, DynamoResult, InferenceEntry } from '../types.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';

export interface GovernWithSolarParams {
  title: string;
  content: string;
  agentDid: string;
  matchedPrimitives: string[];
  inferenceType?: string;
}

export interface GovernWithSolarFn {
  (params: GovernWithSolarParams): Promise<DynamoResult | null>;
}

export interface OntologicalTrapEnforcerOptions {
  signalsManager?: CuratedSignalsManager;
  governFn: GovernWithSolarFn;
  agentDid?: string;
  minResonanceThreshold?: number;
}

export class OntologicalTrapEnforcer {
  private readonly signalsManager: CuratedSignalsManager;
  private readonly governFn: GovernWithSolarFn;
  private readonly agentDid: string;
  private readonly minResonance: number;

  constructor(options: OntologicalTrapEnforcerOptions) {
    this.signalsManager = options.signalsManager ?? new CuratedSignalsManager();
    this.governFn = options.governFn;
    this.agentDid = options.agentDid ?? 'did:groover:284895bead2ac15b';
    this.minResonance = options.minResonanceThreshold ?? 0.75;
  }

  isOntologicalTrap(inference: string): boolean {
    return /TYPE:\s*ontological-trap/i.test(inference);
  }

  matchPrimitives(inference: string): CuratedSignal[] {
    return this.signalsManager.matchInferenceEntry(inference).map((m) => m.signal);
  }

  /**
   * Always calls govern_with_solar for ontological-trap entries.
   * Returns full result even when governance fetch fails (null → logged as N/A).
   */
  async enforce(entry: InferenceEntry, replyContent: string): Promise<{
    allowed: boolean;
    dynamoResult: DynamoResult | null;
    matchedPrimitives: string[];
    forced: boolean;
  }> {
    const isTrap = this.isOntologicalTrap(entry.inference);
    const matched = this.matchPrimitives(entry.inference);
    const matchedNames = matched.map((s) => s.name);

    const dynamoResult = await this.governFn({
      title: entry.post_title ?? 'Engagement',
      content: replyContent,
      agentDid: this.agentDid,
      matchedPrimitives: matchedNames,
      inferenceType: entry.inference_type ?? (isTrap ? 'ontological-trap' : undefined),
    });

    const rec = dynamoResult?.result?.recommendation;
    const resonance = dynamoResult?.result?.resonanceScore ?? 0;

    // Ontological-trap: always log, but only block on explicit REJECT with low resonance
    const allowed = isTrap
      ? !(dynamoResult && rec !== 'PASS' && resonance < this.minResonance)
      : !(dynamoResult && rec !== 'PASS' && resonance < this.minResonance);

    return {
      allowed,
      dynamoResult,
      matchedPrimitives: matchedNames,
      forced: isTrap,
    };
  }

  enrichLogEntry(
    entry: InferenceEntry,
    dynamoResult: DynamoResult | null,
    matchedPrimitives: string[],
  ): InferenceEntry {
    return {
      ...entry,
      dynamo_result: {
        ...dynamoResult,
        matchedPrimitives,
      },
      repertoire_signals: [
        ...new Set([...(entry.repertoire_signals ?? []), ...matchedPrimitives]),
      ],
    };
  }
}