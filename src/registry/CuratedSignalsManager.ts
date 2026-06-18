import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type {
  CuratedSignal,
  CuratedSignalsFile,
  SignalMatch,
  SignalPriority,
} from '../types.js';

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

  private createEmptyFile(): CuratedSignalsFile {
    return {
      description: 'Curated high-signal primitives for Repertoire',
      schema_version: '1.1',
      last_updated: new Date().toISOString(),
      signals: [],
    };
  }
}