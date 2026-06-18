import type { InferenceEntry, InferenceType, PrimitiveMatch } from '../types.js';

const VALID_INFERENCE_TYPES: InferenceType[] = [
  'theoretical',
  'temporal-drift',
  'practical-workflow',
  'ontological-trap',
  'provenance-failure',
];

export interface ParsedGrooverFields {
  matchedPrimitives: string[];
  matchConfidence: Record<string, number>;
  primitiveMatches: PrimitiveMatch[];
  governanceForced: boolean;
  inferenceType?: InferenceType;
}

export function extractInferenceType(inference: string): InferenceType | undefined {
  const explicit = inference.match(/TYPE:\s*(\S+)/i)?.[1]?.toLowerCase();
  if (explicit && VALID_INFERENCE_TYPES.includes(explicit as InferenceType)) {
    return explicit as InferenceType;
  }
  return undefined;
}

export function parseMatchConfidence(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};

  const confidence: Record<string, number> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      confidence[name] = Math.max(0, Math.min(1, value));
    }
  }
  return confidence;
}

export function parseMatchedPrimitives(
  raw: Record<string, unknown>,
  matchConfidence: Record<string, number>,
): string[] {
  const fromField = raw.matched_primitives;
  if (Array.isArray(fromField)) {
    return fromField.filter((value): value is string => typeof value === 'string');
  }

  const fromRepertoire = raw.repertoire_signals;
  if (Array.isArray(fromRepertoire)) {
    return fromRepertoire.filter((value): value is string => typeof value === 'string');
  }

  const dynamo = raw.dynamo_result as Record<string, unknown> | undefined;
  const fromDynamo = dynamo?.matchedPrimitives;
  if (Array.isArray(fromDynamo)) {
    return fromDynamo.filter((value): value is string => typeof value === 'string');
  }

  return Object.keys(matchConfidence);
}

export function toPrimitiveMatches(
  matchedPrimitives: string[],
  matchConfidence: Record<string, number>,
  fallbackConfidence = 0.5,
): PrimitiveMatch[] {
  return matchedPrimitives.map((name) => ({
    name,
    confidence: matchConfidence[name] ?? fallbackConfidence,
  }));
}

export function parseGrooverLogFields(raw: Record<string, unknown>): ParsedGrooverFields {
  const inference = String(raw.inference ?? '');
  const matchConfidence = parseMatchConfidence(raw.match_confidence);
  const matchedPrimitives = parseMatchedPrimitives(raw, matchConfidence);
  const primitiveMatches = toPrimitiveMatches(matchedPrimitives, matchConfidence);

  const inferenceType =
    typeof raw.inference_type === 'string' &&
    VALID_INFERENCE_TYPES.includes(raw.inference_type as InferenceType)
      ? (raw.inference_type as InferenceType)
      : extractInferenceType(inference);

  const governanceForced =
    typeof raw.governance_forced === 'boolean'
      ? raw.governance_forced
      : inferenceType === 'ontological-trap';

  return {
    matchedPrimitives,
    matchConfidence,
    primitiveMatches,
    governanceForced,
    inferenceType,
  };
}

export function buildInferenceEntryFromGrooverLog(
  raw: Record<string, unknown>,
  fallbackMatches?: PrimitiveMatch[],
): InferenceEntry {
  const parsed = parseGrooverLogFields(raw);
  const primitiveMatches =
    parsed.primitiveMatches.length > 0
      ? parsed.primitiveMatches
      : (fallbackMatches ?? []);

  const matchedPrimitives = primitiveMatches.map((match) => match.name);
  const matchConfidence = Object.fromEntries(
    primitiveMatches.map((match) => [match.name, match.confidence]),
  );

  return {
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    source: 'groover',
    post_id: raw.post_id as string | undefined,
    post_title: (raw.post_title ?? raw.postTitle) as string | undefined,
    comment_id: raw.comment_id as string | undefined,
    inference: String(raw.inference ?? ''),
    public_reply: (raw.public_reply ?? raw.publicReply) as string | undefined,
    inference_type: parsed.inferenceType,
    matched_primitives: matchedPrimitives,
    match_confidence: matchConfidence,
    governance_forced: parsed.governanceForced,
    dynamo_result: raw.dynamo_result as InferenceEntry['dynamo_result'],
    repertoire_signals: matchedPrimitives,
  };
}