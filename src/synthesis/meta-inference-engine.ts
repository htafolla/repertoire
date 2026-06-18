import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { SynthesisPromptBuilder } from './synthesis-prompt-builder.js';
import { InferenceStateManager } from '../registry/InferenceStateManager.js';
import type { InferenceEntry, SynthesisReport } from '../types.js';

export interface MetaInferenceEngineOptions {
  logDir?: string;
  statePath?: string;
  reportPath?: string;
  batchSize?: number;
  maxEntries?: number;
  hermesCommand?: (prompt: string) => string;
}

const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_MAX_ENTRIES = 8;

export class MetaInferenceEngine {
  private readonly logDir: string;
  private readonly stateManager: InferenceStateManager;
  private readonly reportPath: string;
  private readonly batchSize: number;
  private readonly maxEntries: number;
  private readonly promptBuilder = new SynthesisPromptBuilder();
  private readonly runHermes: (prompt: string) => string;

  constructor(options: MetaInferenceEngineOptions = {}) {
    this.logDir = options.logDir ?? 'logs/groover-inference';
    this.stateManager = new InferenceStateManager(options.statePath ?? 'data/inference-state.json');
    this.reportPath = options.reportPath ?? 'logs/meta-inference/synthesis.md';
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.runHermes = options.hermesCommand ?? this.defaultHermesCommand;
  }

  async run(): Promise<SynthesisReport | null> {
    const state = this.stateManager.load();
    const processed = new Set([
      ...state.processedCommentIds,
      ...state.processedSessionIds,
    ]);

    if (!existsSync(this.logDir)) {
      return null;
    }

    const newEntries = this.loadUnprocessedEntries(processed);
    if (newEntries.length === 0) {
      return null;
    }

    const entries = newEntries.slice(0, this.maxEntries);
    const batchResults: string[] = [];

    let totalPass = 0;
    let totalReject = 0;
    let resonanceSum = 0;
    let resonanceCount = 0;

    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize);

      for (const e of batch) {
        const rec = e.dynamo_result?.result?.recommendation;
        if (rec === 'PASS') totalPass++;
        if (rec === 'REJECT') totalReject++;
        const res = e.dynamo_result?.result?.resonanceScore;
        if (typeof res === 'number') {
          resonanceSum += res;
          resonanceCount++;
        }
      }

      const avgResonance =
        resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

      const prompt = this.promptBuilder.buildBatchPrompt({
        batchIndex: Math.floor(i / this.batchSize) + 1,
        totalBatches: Math.ceil(entries.length / this.batchSize),
        entries: batch,
        globalIndex: i,
        dynamoStats: {
          pass: totalPass,
          reject: totalReject,
          avgResonance,
          analyzedSoFar: i + batch.length,
        },
      });

      try {
        batchResults.push(this.runHermes(prompt));
      } catch {
        // Continue with remaining batches
      }
    }

    const avgResonance =
      resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

    const finalPrompt = this.promptBuilder.buildFinalSynthesisPrompt(
      entries.length,
      { pass: totalPass, reject: totalReject, avgResonance },
      batchResults,
    );

    let finalReport = '';
    try {
      finalReport = this.runHermes(finalPrompt);
      this.appendReport(entries.length, totalPass, resonanceCount > 0 ? resonanceSum / resonanceCount : null, finalReport);
    } catch {
      finalReport = batchResults.join('\n\n---\n\n');
    }

    const ids = entries.map((e) => e.comment_id ?? e.post_id ?? e.session_id).filter(Boolean) as string[];
    const hasSession = entries.some((e) => e.session_id);
    this.stateManager.markProcessed(ids, hasSession ? 'session' : 'comment');

    return {
      entriesProcessed: entries.length,
      batchResults,
      finalReport,
      timestamp: new Date().toISOString(),
      dynamoStats: {
        pass: totalPass,
        reject: totalReject,
        avgResonance: resonanceCount > 0 ? resonanceSum / resonanceCount : null,
      },
    };
  }

  private loadUnprocessedEntries(processed: Set<string>): InferenceEntry[] {
    const files = readdirSync(this.logDir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort();

    const entries: InferenceEntry[] = [];

    for (const file of files) {
      const lines = readFileSync(join(this.logDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as InferenceEntry;
          const id = entry.comment_id ?? entry.post_id ?? entry.session_id;
          if (id && !processed.has(id)) {
            entries.push(entry);
            processed.add(id);
          }
        } catch {
          // skip malformed
        }
      }
    }

    return entries;
  }

  private appendReport(
    entryCount: number,
    passCount: number,
    avgResonance: number | null,
    report: string,
  ): void {
    const dir = dirname(this.reportPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const header =
      `\n\n## Meta-Inference Run — ${new Date().toISOString()}\n` +
      `Entries: ${entryCount} | ` +
      `Dynamo PASS rate: ${passCount}/${entryCount} | ` +
      `Avg resonance: ${avgResonance?.toFixed(3) ?? 'N/A'}\n\n`;

    appendFileSync(this.reportPath, header + report);
  }

  private defaultHermesCommand(prompt: string): string {
    const tmpPath = '/tmp/repertoire-meta-inference.txt';
    writeFileSync(tmpPath, prompt);
    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000,
    }).trim();
  }
}