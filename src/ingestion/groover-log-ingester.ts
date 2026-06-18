import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import { buildInferenceEntryFromGrooverLog } from './groover-log-parser.js';
import type { InferenceEntry } from '../types.js';

export interface GrooverIngesterOptions {
  sourceDir: string;
  targetDir?: string;
  signalsManager?: CuratedSignalsManager;
  promoteAfterIngest?: boolean;
}

export interface GrooverIngestResult {
  imported: number;
  skipped: number;
  promoted: string[];
}

export class GrooverLogIngester {
  private readonly sourceDir: string;
  private readonly targetDir: string;
  private readonly signalsManager: CuratedSignalsManager;
  private readonly promoteAfterIngest: boolean;

  constructor(options: GrooverIngesterOptions) {
    this.sourceDir = options.sourceDir;
    this.targetDir = options.targetDir ?? 'logs/groover-inference';
    this.signalsManager = options.signalsManager ?? new CuratedSignalsManager();
    this.promoteAfterIngest = options.promoteAfterIngest ?? true;
  }

  ingest(): GrooverIngestResult {
    if (!existsSync(this.sourceDir)) {
      return { imported: 0, skipped: 0, promoted: [] };
    }

    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }

    const existingIds = this.loadExistingIds();
    let imported = 0;
    let skipped = 0;

    const files = readdirSync(this.sourceDir).filter((f) => f.endsWith('.jsonl'));

    for (const file of files) {
      const lines = readFileSync(join(this.sourceDir, file), 'utf8').trim().split('\n');

      for (const line of lines) {
        if (!line) continue;
        try {
          const raw = JSON.parse(line) as Record<string, unknown>;
          const id = (raw.comment_id ?? raw.post_id) as string | undefined;
          if (id && existingIds.has(id)) {
            skipped++;
            continue;
          }

          const entry = this.normalizeEntry(raw);
          const targetFile = join(this.targetDir, basename(file));
          appendFileSync(targetFile, JSON.stringify(entry) + '\n');
          this.recordObservations(entry);

          if (id) existingIds.add(id);
          imported++;
        } catch {
          skipped++;
        }
      }
    }

    const promoted = this.promoteAfterIngest
      ? this.signalsManager.promoteQualifiedSignals()
      : [];

    return { imported, skipped, promoted };
  }

  private normalizeEntry(raw: Record<string, unknown>): InferenceEntry {
    const hasGrooverConfidence =
      raw.match_confidence !== undefined ||
      raw.matched_primitives !== undefined ||
      raw.governance_forced !== undefined;

    if (hasGrooverConfidence) {
      return buildInferenceEntryFromGrooverLog(raw);
    }

    const inference = String(raw.inference ?? '');
    const fallbackMatches = this.signalsManager.signalMatchesToPrimitiveMatches(
      this.signalsManager.matchInferenceEntry(inference),
    );

    return buildInferenceEntryFromGrooverLog(raw, fallbackMatches);
  }

  private recordObservations(entry: InferenceEntry): void {
    const matches = (entry.matched_primitives ?? []).map((name) => ({
      name,
      confidence: entry.match_confidence?.[name] ?? 0.5,
    }));

    if (matches.length === 0) return;

    this.signalsManager.recordPrimitiveObservations(matches, {
      governanceForced: entry.governance_forced,
    });
  }

  private loadExistingIds(): Set<string> {
    const ids = new Set<string>();
    if (!existsSync(this.targetDir)) return ids;

    for (const file of readdirSync(this.targetDir).filter((f) => f.endsWith('.jsonl'))) {
      const lines = readFileSync(join(this.targetDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const e = JSON.parse(line) as InferenceEntry;
          const id = e.comment_id ?? e.post_id ?? e.session_id;
          if (id) ids.add(id);
        } catch {
          // skip
        }
      }
    }
    return ids;
  }
}