import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InferenceState } from '../types.js';

export class InferenceStateManager {
  constructor(private readonly filePath = 'data/inference-state.json') {}

  load(): InferenceState {
    if (!existsSync(this.filePath)) {
      return this.createEmpty();
    }
    const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<InferenceState>;
    return {
      processedCommentIds: raw.processedCommentIds ?? [],
      processedSessionIds: raw.processedSessionIds ?? [],
      lastRun: raw.lastRun ?? null,
    };
  }

  save(state: InferenceState): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  isProcessed(id: string): boolean {
    const state = this.load();
    return state.processedCommentIds.includes(id) || state.processedSessionIds.includes(id);
  }

  markProcessed(ids: string[], kind: 'comment' | 'session' = 'comment'): void {
    const state = this.load();
    const target = kind === 'comment' ? state.processedCommentIds : state.processedSessionIds;
    for (const id of ids) {
      if (!target.includes(id)) target.push(id);
    }
    state.lastRun = new Date().toISOString();
    this.save(state);
  }

  private createEmpty(): InferenceState {
    return { processedCommentIds: [], processedSessionIds: [], lastRun: null };
  }
}