import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type {
  CuratedSignal,
  CuratedSignalsFile,
  PrimitiveMatch,
  SignalMatch,
  SignalPriority,
  SignalStatus,
} from '../types.js';

export interface PromotionGateOptions {
  minAvgConfidence?: number;
  minObservations?: number;
  fromStatus?: SignalStatus;
  toStatus?: SignalStatus;
}

export const DEFAULT_PROMOTION_MIN_CONFIDENCE = 0.55;
export const DEFAULT_PROMOTION_MIN_OBSERVATIONS = 2;

export class CuratedSignalsManager {
  private readonly filePath: string;

  constructor(filePath = 'data/curated_signals.json') {
    this.filePath = filePath;
  }

  load(): CuratedSignalsFile {
    if (!existsSync(this.filePath)) {
      return this.createEmptyFile();
    }
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as CuratedSignalsFile;
  }

  save(data: CuratedSignalsFile): void {
    data.last_updated = new Date().toISOString();
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  addSignal(signal: CuratedSignal): void {
    const data = this.load();
    const exists = data.signals.some((s) => s.name === signal.name);
    if (!exists) {
      data.signals.push(signal);
      this.save(data);
    }
  }

  getByName(name: string): CuratedSignal | undefined {
    return this.load().signals.find((s) => s.name === name);
  }

  getByTag(tag: string): CuratedSignal[] {
    const normalized = tag.toLowerCase();
    return this.load().signals.filter((s) =>
      s.tags.some((t) => t.toLowerCase() === normalized),
    );
  }

  getHighPrioritySignals(): CuratedSignal[] {
    return this.load().signals.filter((s) => s.priority === 'high');
  }

  getByPriority(priority: SignalPriority): CuratedSignal[] {
    return this.load().signals.filter((s) => s.priority === priority);
  }

  /**
   * Score text against all signals using name, tags, definition, criteria, and snippet.
   */
  matchByText(text: string, minScore = 2): SignalMatch[] {
    const normalized = text.toLowerCase();
    const matches: SignalMatch[] = [];

    for (const signal of this.load().signals) {
      const matchedOn: SignalMatch['matchedOn'] = [];
      let score = 0;

      if (normalized.includes(signal.name.replace(/-/g, ' ')) || normalized.includes(signal.name)) {
        score += 5;
        matchedOn.push('name');
      }

      for (const tag of signal.tags) {
        if (normalized.includes(tag.toLowerCase())) {
          score += 3;
          matchedOn.push('tag');
          break;
        }
      }

      const definitionWords = signal.definition.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
      const definitionHits = definitionWords.filter((w) => normalized.includes(w)).length;
      if (definitionHits >= 2) {
        score += Math.min(definitionHits, 4);
        matchedOn.push('definition');
      }

      if (signal.evaluation_criteria) {
        const criteriaWords = signal.evaluation_criteria.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
        const criteriaHits = criteriaWords.filter((w) => normalized.includes(w)).length;
        if (criteriaHits >= 2) {
          score += Math.min(criteriaHits, 3);
          matchedOn.push('criteria');
        }
      }

      if (signal.example_inference_snippet) {
        const snippet = signal.example_inference_snippet.toLowerCase().slice(0, 80);
        if (normalized.includes(snippet.slice(0, 40))) {
          score += 4;
          matchedOn.push('snippet');
        }
      }

      if (signal.priority === 'high') score += 1;

      if (score >= minScore) {
        matches.push({ signal, score, matchedOn });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  matchInferenceEntry(inference: string): SignalMatch[] {
    const typeMatch = inference.match(/TYPE:\s*(\S+)/i);
    const type = typeMatch?.[1]?.toLowerCase();

    const matches = this.matchByText(inference, 2);

    if (type === 'ontological-trap') {
      const trapSignals = this.getByTag('ontological-trap');
      for (const signal of trapSignals) {
        if (!matches.some((m) => m.signal.name === signal.name)) {
          matches.push({ signal, score: 3, matchedOn: ['tag'] });
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  recordPrimitiveObservations(
    matches: PrimitiveMatch[],
    options: { governanceForced?: boolean; minConfidence?: number } = {},
  ): string[] {
    const minConfidence = options.minConfidence ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
    const data = this.load();
    const updated: string[] = [];
    const now = new Date().toISOString();

    for (const match of matches) {
      if (match.confidence < minConfidence) continue;

      const signal = data.signals.find((entry) => entry.name === match.name);
      if (!signal) continue;

      const previous = signal.observation_stats;
      const observationCount = (previous?.observation_count ?? 0) + 1;
      const totalConfidence = (previous?.avg_confidence ?? 0) * (observationCount - 1) + match.confidence;

      signal.observation_stats = {
        observation_count: observationCount,
        avg_confidence: totalConfidence / observationCount,
        max_confidence: Math.max(previous?.max_confidence ?? 0, match.confidence),
        last_seen: now,
        governance_forced_count:
          (previous?.governance_forced_count ?? 0) + (options.governanceForced ? 1 : 0),
      };
      updated.push(signal.name);
    }

    if (updated.length > 0) {
      this.save(data);
    }

    return updated;
  }

  shouldPromoteSignal(
    signal: CuratedSignal,
    options: PromotionGateOptions = {},
  ): boolean {
    const minAvgConfidence = options.minAvgConfidence ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
    const minObservations = options.minObservations ?? DEFAULT_PROMOTION_MIN_OBSERVATIONS;
    const fromStatus = options.fromStatus ?? 'proposed';
    const stats = signal.observation_stats;

    if ((signal.status ?? 'proposed') !== fromStatus || !stats) {
      return false;
    }

    return (
      stats.avg_confidence >= minAvgConfidence &&
      stats.observation_count >= minObservations
    );
  }

  promoteQualifiedSignals(options: PromotionGateOptions = {}): string[] {
    const toStatus = options.toStatus ?? 'validated';
    const data = this.load();
    const promoted: string[] = [];

    for (const signal of data.signals) {
      if (this.shouldPromoteSignal(signal, options)) {
        signal.status = toStatus;
        promoted.push(signal.name);
      }
    }

    if (promoted.length > 0) {
      this.save(data);
    }

    return promoted;
  }

  getSignalsAboveConfidence(minAvgConfidence = DEFAULT_PROMOTION_MIN_CONFIDENCE): CuratedSignal[] {
    return this.load().signals.filter(
      (signal) => (signal.observation_stats?.avg_confidence ?? 0) >= minAvgConfidence,
    );
  }

  private createEmptyFile(): CuratedSignalsFile {
    return {
      description: 'Curated high-signal primitives for Repertoire',
      schema_version: '1.1',
      last_updated: new Date().toISOString(),
      signals: [],
    };
  }
}