import { describe, expect, it } from 'vitest';
import {
  buildInferenceEntryFromGrooverLog,
  parseGrooverLogFields,
} from './groover-log-parser.js';

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

  it('falls back to repertoire_signals when matched_primitives is absent', () => {
    const parsed = parseGrooverLogFields({
      inference: 'legacy entry',
      repertoire_signals: ['attestation-as-map'],
      match_confidence: { 'attestation-as-map': 0.9 },
    });

    expect(parsed.matchedPrimitives).toEqual(['attestation-as-map']);
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