#!/usr/bin/env node
/**
 * Phase 5: one real ingestFeedback cycle against production registry state.
 *
 * Simulates the 0xRay TaskHandler post-orchestration path:
 *   getTaskConfidence → architect routing → record success outcome
 */

import { readFileSync, existsSync } from 'node:fs';
import { RepertoireService } from '../src/RepertoireService.js';

const TRAP_TASK =
  'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required';

function emit(report: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function main(): void {
  const service = new RepertoireService();

  const before = service.signalsManager.getByName('attestation-as-map');
  const beforeAvg = before?.observation_stats?.avg_confidence ?? null;
  const beforeFeedbackCount = before?.feedback_stats?.outcome_count ?? 0;

  const confidence = service.getTaskConfidence({
    description: TRAP_TASK,
    type: 'governance',
    id: 'production-trap-routing-1',
  });

  if (!confidence.highConfidenceTrapPresent) {
    emit({
      status: 'aborted',
      reason: 'trap signal not present — run ingest pipeline first',
      confidence,
    });
    process.exit(1);
  }

  const assignedAgent = confidence.recommendedAgent ?? 'architect';
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: `feedback-cycle-${Date.now()}`,
    taskId: 'production-trap-routing-1',
    assignedAgent,
    repertoireSignals: confidence.matchedSignals,
    complexity: 45 + (confidence.complexityBoost ?? 0),
    success: true,
    durationMs: 2400,
  };

  const result = service.ingestOrchestratorFeedback(entry);

  const after = service.signalsManager.getByName('attestation-as-map');
  const afterAvg = after?.observation_stats?.avg_confidence ?? null;

  const logFile = result.logPath;
  const lastLogLine = existsSync(logFile)
    ? readFileSync(logFile, 'utf8').trim().split('\n').at(-1) ?? null
    : null;

  emit({
    status: 'complete',
    confidence: {
      highConfidenceTrapPresent: confidence.highConfidenceTrapPresent,
      recommendedAgent: confidence.recommendedAgent,
      matchedSignals: confidence.matchedSignals,
    },
    feedback: {
      logPath: result.logPath,
      updatedSignals: result.updatedSignals,
      lastLogLine,
    },
    attestationAsMap: {
      avgConfidence: { before: beforeAvg, after: afterAvg },
      feedbackOutcomes: {
        before: beforeFeedbackCount,
        after: after?.feedback_stats?.outcome_count ?? 0,
      },
      lastOutcome: after?.feedback_stats?.last_outcome ?? null,
      lastAssignedAgent: after?.feedback_stats?.last_assigned_agent ?? null,
    },
  });
}

main();