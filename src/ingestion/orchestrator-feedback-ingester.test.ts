import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FEEDBACK_DIR } from '../paths.js';
import { OrchestratorFeedbackIngester } from './orchestrator-feedback-ingester.js';

describe('OrchestratorFeedbackIngester', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('writes feedback to an explicit absolute target directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-feedback-'));
    const targetDir = join(tempDir, 'orchestrator-feedback');
    const ingester = new OrchestratorFeedbackIngester(targetDir);

    const logPath = ingester.ingest({
      timestamp: '2026-06-18T12:00:00.000Z',
      sessionId: 'sess-1',
      taskId: 'task-1',
      assignedAgent: 'architect',
      repertoireSignals: ['attestation-as-map'],
      complexity: 40,
      success: true,
      durationMs: 900,
    });

    expect(logPath).toBe(join(targetDir, '2026-06-18.jsonl'));
    expect(existsSync(logPath)).toBe(true);
    const line = readFileSync(logPath, 'utf8').trim();
    expect(JSON.parse(line).taskId).toBe('task-1');
  });

  it('defaults to package-root feedback directory constant', () => {
    expect(DEFAULT_FEEDBACK_DIR).toContain('logs/orchestrator-feedback');
  });
});