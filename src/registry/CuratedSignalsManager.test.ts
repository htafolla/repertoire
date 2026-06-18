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
});