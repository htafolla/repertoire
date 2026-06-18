import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { OrchestratorFeedbackEntry } from '../types.js';

export class OrchestratorFeedbackIngester {
  constructor(private readonly targetDir = 'logs/orchestrator-feedback') {}

  ingest(entry: OrchestratorFeedbackEntry): string {
    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }

    const date = entry.timestamp.split('T')[0];
    const filePath = join(this.targetDir, `${date}.jsonl`);
    appendFileSync(filePath, JSON.stringify(entry) + '\n');
    return filePath;
  }
}