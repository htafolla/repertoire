import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import type { InferenceEntry } from '../types.js';

export interface GrooverIngesterOptions {
  sourceDir: string;
  targetDir?: string;
  signalsManager?: CuratedSignalsManager;
}

export class GrooverLogIngester {
  private readonly sourceDir: string;
  private readonly targetDir: string;
  private readonly signalsManager: CuratedSignalsManager;

  constructor(options: GrooverIngesterOptions) {
    this.sourceDir = options.sourceDir;
    this.targetDir = options.targetDir ?? 'logs/groover-inference';
    this.signalsManager = options.signalsManager ?? new CuratedSignalsManager();
  }

  ingest(): { imported: number; skipped: number } {
    if (!existsSync(this.sourceDir)) {
      return { imported: 0, skipped: 0 };
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

          if (id) existingIds.add(id);
          imported++;
        } catch {
          skipped++;
        }
      }
    }

    return { imported, skipped };
  }

  private normalizeEntry(raw: Record<string, unknown>): InferenceEntry {
    const inference = String(raw.inference ?? '');
    const matches = this.signalsManager.matchInferenceEntry(inference);
    const inferenceType = this.extractInferenceType(inference);

    return {
      timestamp: String(raw.timestamp ?? new Date().toISOString()),
      source: 'groover',
      post_id: raw.post_id as string | undefined,
      post_title: (raw.post_title ?? raw.postTitle) as string | undefined,
      comment_id: raw.comment_id as string | undefined,
      inference,
      public_reply: (raw.public_reply ?? raw.publicReply) as string | undefined,
      inference_type: inferenceType,
      dynamo_result: raw.dynamo_result as InferenceEntry['dynamo_result'],
      repertoire_signals: matches.map((m) => m.signal.name),
    };
  }

  private extractInferenceType(inference: string): InferenceEntry['inference_type'] {
    const match = inference.match(/TYPE:\s*(\S+)/i);
    const type = match?.[1]?.toLowerCase();
    const valid = [
      'theoretical',
      'temporal-drift',
      'practical-workflow',
      'ontological-trap',
      'provenance-failure',
    ];
    return valid.includes(type ?? '') ? (type as InferenceEntry['inference_type']) : undefined;
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