import type { InferenceEntry, WeightedPrimitive } from '../types.js';

export function aggregateWeightedPrimitives(entries: InferenceEntry[]): WeightedPrimitive[] {
  const totals = new Map<
    string,
    { confidenceSum: number; count: number; forcedCount: number }
  >();

  for (const entry of entries) {
    const confidenceMap = entry.match_confidence;
    if (!confidenceMap || !entry.matched_primitives?.length) continue;

    for (const name of entry.matched_primitives) {
      const confidence = confidenceMap[name];
      if (typeof confidence !== 'number') continue;

      const current = totals.get(name) ?? { confidenceSum: 0, count: 0, forcedCount: 0 };
      current.confidenceSum += confidence;
      current.count += 1;
      if (entry.governance_forced) current.forcedCount += 1;
      totals.set(name, current);
    }
  }

  return [...totals.entries()]
    .map(([name, stats]) => {
      const avgConfidence = stats.confidenceSum / stats.count;
      const weightedScore = stats.confidenceSum * Math.sqrt(stats.count);
      return {
        name,
        weightedScore,
        avgConfidence,
        occurrenceCount: stats.count,
        governanceForcedCount: stats.forcedCount,
      };
    })
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        b.occurrenceCount - a.occurrenceCount ||
        a.name.localeCompare(b.name),
    );
}

export function formatWeightedPrimitivesSection(
  entries: InferenceEntry[],
  limit = 8,
): string {
  const weighted = aggregateWeightedPrimitives(entries).slice(0, limit);
  if (weighted.length === 0) {
    return 'No confidence-weighted primitives available for this batch.';
  }

  return weighted
    .map(
      (primitive, index) =>
        `${index + 1}. ${primitive.name} — avg_confidence=${primitive.avgConfidence.toFixed(3)}, occurrences=${primitive.occurrenceCount}, weighted_score=${primitive.weightedScore.toFixed(3)}, governance_forced_hits=${primitive.governanceForcedCount}`,
    )
    .join('\n');
}