import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import type { InferenceEntry } from '../types.js';

export interface XraySessionFile {
  sessionId: string;
  timestamp: string;
  problems?: string[];
  approaches?: string[];
  wrongTurns?: string[];
  solutions?: string[];
  patterns?: Array<{ type: string; description: string }>;
}

export interface XraySessionIngesterOptions {
  sourceDir: string;
  targetDir?: string;
  signalsManager?: CuratedSignalsManager;
}

export class XraySessionIngester {
  private readonly sourceDir: string;
  private readonly targetDir: string;
  private readonly signalsManager: CuratedSignalsManager;

  constructor(options: XraySessionIngesterOptions) {
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

    const existingIds = this.loadExistingSessionIds();
    let imported = 0;
    let skipped = 0;

    const files = readdirSync(this.sourceDir).filter(
      (f) => f.startsWith('session-') && f.endsWith('.json'),
    );

    for (const file of files) {
      try {
        const session = JSON.parse(
          readFileSync(join(this.sourceDir, file), 'utf8'),
        ) as XraySessionFile;

        if (!session.sessionId || existingIds.has(session.sessionId)) {
          skipped++;
          continue;
        }

        const entry = this.sessionToInferenceEntry(session);
        const targetFile = join(this.targetDir, `${session.timestamp.split('T')[0]}.jsonl`);
        appendFileSync(targetFile, JSON.stringify(entry) + '\n');

        existingIds.add(session.sessionId);
        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private sessionToInferenceEntry(session: XraySessionFile): InferenceEntry {
    const inferenceParts = [
      `Session: ${session.sessionId}`,
      session.problems?.length ? `Problems: ${session.problems.join('; ')}` : '',
      session.wrongTurns?.length ? `Wrong turns: ${session.wrongTurns.join('; ')}` : '',
      session.solutions?.length ? `Solutions: ${session.solutions.join('; ')}` : '',
      session.patterns?.length
        ? `Patterns: ${session.patterns.map((p) => `${p.type}: ${p.description}`).join('; ')}`
        : '',
    ].filter(Boolean);

    const inference = inferenceParts.join('\n');

    return {
      timestamp: session.timestamp,
      source: 'xray',
      session_id: session.sessionId,
      inference,
    };
  }

  private loadExistingSessionIds(): Set<string> {
    const ids = new Set<string>();
    if (!existsSync(this.targetDir)) return ids;

    for (const file of readdirSync(this.targetDir).filter((f) => f.endsWith('.jsonl'))) {
      const lines = readFileSync(join(this.targetDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const e = JSON.parse(line) as InferenceEntry;
          if (e.session_id) ids.add(e.session_id);
        } catch {
          // skip
        }
      }
    }
    return ids;
  }
}