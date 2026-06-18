import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import {
  confidenceWeightedAgentBoost,
  getConfidenceForTask,
  TRAP_CAPABLE_AGENTS,
} from './confidence-gate.js';
import type { OrchestrationTask } from '../types.js';

describe('confidence gate', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  function createManager(): CuratedSignalsManager {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-confidence-'));
    const manager = new CuratedSignalsManager(join(tempDir, 'curated_signals.json'));
    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional rather than final.',
      tags: ['ontological-trap', 'attestation'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Static attestation post test.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });
    manager.recordPrimitiveObservations(
      [
        { name: 'attestation-as-map', confidence: 0.9 },
        { name: 'attestation-as-map', confidence: 0.85 },
      ],
      { governanceForced: true },
    );
    return manager;
  }

  it('detects high-confidence ontological-trap tasks', () => {
    const manager = createManager();
    const task: OrchestrationTask = {
      id: 'task-1',
      description: 'TYPE: ontological-trap attestation-as-map closure primitive required',
      type: 'governance',
    };

    const context = getConfidenceForTask(task, manager);

    expect(context.highConfidenceTrapPresent).toBe(true);
    expect(context.complexityBoost).toBeGreaterThan(15);
    expect(context.signals.some((entry) => entry.name === 'attestation-as-map')).toBe(true);
    expect(context.matchedSignals).toContain('attestation-as-map');
    expect(context.recommendedAgent).toBe('architect');
  });

  it('boosts trap-capable agents when high-confidence trap is present', () => {
    const context = getConfidenceForTask(
      {
        id: 'task-2',
        description: 'TYPE: ontological-trap attestation-as-map',
        type: 'governance',
      },
      createManager(),
    );

    expect(confidenceWeightedAgentBoost('architect', context)).toBeGreaterThan(20);
    expect(confidenceWeightedAgentBoost('code-reviewer', context)).toBe(0);
    expect(TRAP_CAPABLE_AGENTS).toContain('architect');
  });
});