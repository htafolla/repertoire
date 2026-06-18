import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RepertoireService } from './RepertoireService.js';

describe('RepertoireService MCP query helpers', () => {
  let tempDir = '';
  let service: RepertoireService;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  function setupService(): RepertoireService {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    service = new RepertoireService({
      signalsPath: join(tempDir, 'curated_signals.json'),
      logDir: join(tempDir, 'logs'),
      statePath: join(tempDir, 'inference-state.json'),
    });

    service.signalsManager.addSignal({
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

    service.signalsManager.recordPrimitiveObservations(
      [
        { name: 'attestation-as-map', confidence: 0.92 },
        { name: 'attestation-as-map', confidence: 0.88 },
      ],
      { governanceForced: true },
    );

    return service;
  }

  it('returns high-confidence signals with optional tag filter', () => {
    setupService();
    const results = service.getHighConfidenceSignals({
      minConfidence: 0.55,
      tags: ['ontological-trap'],
      limit: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('attestation-as-map');
    expect(results[0].effectiveConfidence).toBeGreaterThanOrEqual(0.55);
  });

  it('evaluates task confidence for trap descriptions', () => {
    setupService();
    const context = service.getTaskConfidence({
      description: 'TYPE: ontological-trap attestation-as-map closure required',
      type: 'governance',
      id: 'task-42',
    });

    expect(context.highConfidenceTrapPresent).toBe(true);
    expect(context.complexityBoost).toBeGreaterThan(0);
    expect(context.signals.some((entry) => entry.name === 'attestation-as-map')).toBe(true);
    expect(context.matchedSignals).toContain('attestation-as-map');
    expect(context.recommendedAgent).toBe('architect');
  });

  it('searches primitives using registry observation_stats only', () => {
    setupService();
    const results = service.searchPrimitives('attestation-as-map ontological-trap', {
      minConfidence: 0.55,
      limit: 3,
    });

    expect(results[0].name).toBe('attestation-as-map');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.55);
    expect(results[0].observationCount).toBe(2);
  });
});