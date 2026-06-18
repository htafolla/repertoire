import { describe, expect, it } from 'vitest';
import {
  buildInferenceEntryFromGrooverLog,
  EnrichedGrooverLogError,
  isEnrichedGrooverLog,
  parseGrooverLogFields,
} from './groover-log-parser.js';

describe('isEnrichedGrooverLog', () => {
  it('accepts entries with matched_primitives and per-primitive match_confidence', () => {
    expect(
      isEnrichedGrooverLog({
        matched_primitives: ['attestation-as-map'],
        match_confidence: { 'attestation-as-map': 0.92 },
      }),
    ).toBe(true);
  });

  it('rejects entries without structured confidence', () => {
    expect(
      isEnrichedGrooverLog({
        matched_primitives: ['attestation-as-map'],
        inference: 'TYPE: ontological-trap',
      }),
    ).toBe(false);
  });
});

describe('parseGrooverLogFields', () => {
  it('parses enriched Groover log fields', () => {
    const parsed = parseGrooverLogFields({
      inference: 'TYPE: ontological-trap\nattestation-as-map closure.',
      matched_primitives: ['attestation-as-map', 'parse-mutation-detector'],
      match_confidence: {
        'attestation-as-map': 1,
        'parse-mutation-detector': 0.75,
      },
      governance_forced: true,
      inference_type: 'ontological-trap',
    });

    expect(parsed.matchedPrimitives).toEqual([
      'attestation-as-map',
      'parse-mutation-detector',
    ]);
    expect(parsed.matchConfidence['attestation-as-map']).toBe(1);
    expect(parsed.governanceForced).toBe(true);
    expect(parsed.inferenceType).toBe('ontological-trap');
  });

  it('throws when enriched fields are missing', () => {
    expect(() =>
      parseGrooverLogFields({
        inference: 'TYPE: ontological-trap',
      }),
    ).toThrow(EnrichedGrooverLogError);
  });
});

describe('buildInferenceEntryFromGrooverLog', () => {
  it('builds a normalized inference entry for Repertoire storage', () => {
    const entry = buildInferenceEntryFromGrooverLog({
      timestamp: '2026-06-17T12:00:00.000Z',
      post_id: 'post-1',
      comment_id: 'comment-1',
      inference: 'TYPE: ontological-trap',
      public_reply: 'Reply',
      matched_primitives: ['attestation-as-map'],
      match_confidence: { 'attestation-as-map': 0.95 },
      governance_forced: true,
      dynamo_result: {
        result: { recommendation: 'PASS', resonanceScore: 0.88 },
        matchedPrimitives: ['attestation-as-map'],
      },
    });

    expect(entry.source).toBe('groover');
    expect(entry.matched_primitives).toEqual(['attestation-as-map']);
    expect(entry.match_confidence?.['attestation-as-map']).toBe(0.95);
    expect(entry.governance_forced).toBe(true);
    expect(entry.repertoire_signals).toEqual(['attestation-as-map']);
  });
});