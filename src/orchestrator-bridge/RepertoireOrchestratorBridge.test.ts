import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import { RepertoireOrchestratorBridge } from './RepertoireOrchestratorBridge.js';
import type { AgentCapability } from '../types.js';

const TRAP_TASK =
  'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required';

function baseCapabilities(): Map<string, AgentCapability> {
  return new Map([
    [
      'architect',
      {
        capabilities: ['design', 'planning', 'attestation-as-map'],
        complexityThreshold: 50,
        concurrentTasks: 2,
      },
    ],
    [
      'orchestrator',
      {
        capabilities: ['orchestration'],
        complexityThreshold: 100,
        concurrentTasks: 10,
      },
    ],
    [
      'code-reviewer',
      {
        capabilities: ['review'],
        complexityThreshold: 90,
        concurrentTasks: 4,
      },
    ],
  ]);
}

describe('RepertoireOrchestratorBridge trap routing integrity', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('assigns architect for trap tasks even when boosted complexity exceeds architect threshold', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-bridge-'));
    const signalsPath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(signalsPath);

    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional.',
      tags: ['ontological-trap', 'attestation', 'consumer-boundary'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Test static attestation post.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.99 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.99 }],
      { governanceForced: true },
    );

    const bridge = new RepertoireOrchestratorBridge(manager);
    const boostedComplexity = 70;

    const selected = bridge.selectAgentForTask(
      baseCapabilities(),
      ['governance', 'attestation-as-map'],
      boostedComplexity,
      TRAP_TASK,
    );

    expect(selected).toBe('architect');

    const confidence = bridge.getConfidenceForTask({
      id: 'trap-routing-integrity',
      description: TRAP_TASK,
      type: 'governance',
    });
    expect(confidence.recommendedAgent).toBe('architect');
    expect(confidence.highConfidenceTrapPresent).toBe(true);
  });

  it('does not force architect when trap is absent', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-bridge-'));
    const bridge = new RepertoireOrchestratorBridge(
      new CuratedSignalsManager(join(tempDir, 'curated_signals.json')),
    );

    const selected = bridge.selectAgentForTask(
      baseCapabilities(),
      ['review'],
      30,
      'routine code review with no trap markers',
    );

    expect(selected).not.toBe('architect');
  });
});