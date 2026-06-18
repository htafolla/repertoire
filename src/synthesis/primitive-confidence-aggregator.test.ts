import { describe, expect, it } from 'vitest';
import { aggregateWeightedPrimitives } from './primitive-confidence-aggregator.js';
import type { InferenceEntry } from '../types.js';

describe('aggregateWeightedPrimitives', () => {
  it('weights repeated high-confidence primitives above single low-confidence hits', () => {
    const entries: InferenceEntry[] = [
      {
        timestamp: '2026-06-17T10:00:00.000Z',
        source: 'groover',
        inference: 'one',
        matched_primitives: ['attestation-as-map'],
        match_confidence: { 'attestation-as-map': 0.95 },
        governance_forced: true,
      },
      {
        timestamp: '2026-06-17T11:00:00.000Z',
        source: 'groover',
        inference: 'two',
        matched_primitives: ['attestation-as-map'],
        match_confidence: { 'attestation-as-map': 0.9 },
        governance_forced: false,
      },
      {
        timestamp: '2026-06-17T12:00:00.000Z',
        source: 'groover',
        inference: 'three',
        matched_primitives: ['parse-mutation-detector'],
        match_confidence: { 'parse-mutation-detector': 0.6 },
      },
    ];

    const weighted = aggregateWeightedPrimitives(entries);

    expect(weighted[0].name).toBe('attestation-as-map');
    expect(weighted[0].occurrenceCount).toBe(2);
    expect(weighted[0].avgConfidence).toBeCloseTo(0.925, 3);
    expect(weighted[0].governanceForcedCount).toBe(1);
    expect(weighted[0].weightedScore).toBeGreaterThan(weighted[1].weightedScore);
  });
});