import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from './CuratedSignalsManager.js';

describe('CuratedSignalsManager confidence tracking', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('records observation stats and promotes qualified proposed signals', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'proposed',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Test static attestation post.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.8 }],
      { governanceForced: false },
    );

    const signal = manager.getByName('attestation-as-map');
    expect(signal?.observation_stats?.observation_count).toBe(2);
    expect(signal?.observation_stats?.avg_confidence).toBeCloseTo(0.85, 3);
    expect(signal?.observation_stats?.governance_forced_count).toBe(1);

    const promoted = manager.promoteQualifiedSignals();
    expect(promoted).toEqual(['attestation-as-map']);
    expect(manager.getByName('attestation-as-map')?.status).toBe('validated');
  });

  it('skips observations below the confidence gate', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'low-confidence-signal',
      definition: 'Low confidence only.',
      tags: ['test'],
      priority: 'low',
      status: 'proposed',
      evaluation_criteria: 'criteria',
      validation_experiment: 'experiment',
      master_index_integration: 'integration',
      implementation_notes: 'notes',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'low-confidence-signal', confidence: 0.4 }],
      { governanceForced: false },
    );

    expect(manager.getByName('low-confidence-signal')?.observation_stats).toBeUndefined();
    expect(manager.promoteQualifiedSignals()).toEqual([]);
  });

  it('records feedback outcomes and nudges confidence on success', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Test static attestation post.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );

    const before = manager.getByName('attestation-as-map')?.observation_stats?.avg_confidence;
    const results = manager.recordFeedbackOutcome({
      timestamp: '2026-06-18T12:00:00.000Z',
      sessionId: 'sess-feedback-1',
      taskId: 'trap-routing-task',
      assignedAgent: 'architect',
      repertoireSignals: ['attestation-as-map'],
      complexity: 45,
      success: true,
      durationMs: 1800,
    });

    const signal = manager.getByName('attestation-as-map');
    expect(results).toHaveLength(1);
    expect(results[0]?.signalName).toBe('attestation-as-map');
    expect(signal?.feedback_stats?.outcome_count).toBe(1);
    expect(signal?.feedback_stats?.success_count).toBe(1);
    expect(signal?.feedback_stats?.last_assigned_agent).toBe('architect');
    expect(signal?.observation_stats?.avg_confidence).toBeGreaterThan(before ?? 0);
  });

  it('penalizes confidence on failed routing outcomes', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'parse-mutation-detector',
      definition: 'Detect parse mutations.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'criteria',
      validation_experiment: 'experiment',
      master_index_integration: 'integration',
      implementation_notes: 'notes',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'parse-mutation-detector', confidence: 0.8 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'parse-mutation-detector', confidence: 0.8 }],
      { governanceForced: false },
    );

    const before = manager.getByName('parse-mutation-detector')?.observation_stats?.avg_confidence;
    manager.recordFeedbackOutcome({
      timestamp: '2026-06-18T12:05:00.000Z',
      sessionId: 'sess-feedback-2',
      taskId: 'failed-trap-task',
      assignedAgent: 'architect',
      repertoireSignals: ['parse-mutation-detector'],
      complexity: 50,
      success: false,
      durationMs: 4200,
    });

    const after = manager.getByName('parse-mutation-detector')?.observation_stats?.avg_confidence;
    expect(after).toBeLessThan(before ?? 1);
    expect(manager.getByName('parse-mutation-detector')?.feedback_stats?.failure_count).toBe(1);
  });
});