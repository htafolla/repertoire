import { SYNTHESIS_SECTION_INSTRUCTIONS } from './concrete-sections.js';
import { formatWeightedPrimitivesSection } from './primitive-confidence-aggregator.js';
import type { InferenceEntry } from '../types.js';

export interface BatchPromptOptions {
  batchIndex: number;
  totalBatches: number;
  entries: InferenceEntry[];
  globalIndex: number;
  dynamoStats: {
    pass: number;
    reject: number;
    avgResonance: string;
    analyzedSoFar: number;
  };
}

export class SynthesisPromptBuilder {
  buildBatchPrompt(options: BatchPromptOptions): string {
    const { batchIndex, totalBatches, entries, globalIndex, dynamoStats } = options;

    const entryBlocks = entries
      .map((e, idx) => {
        const primitiveSummary = (e.matched_primitives ?? e.repertoire_signals ?? [])
          .map((name) => {
            const confidence = e.match_confidence?.[name];
            return confidence === undefined ? name : `${name}(${confidence.toFixed(2)})`;
          })
          .join(', ');

        return `
Entry ${globalIndex + idx + 1}
Post: ${e.post_title ?? 'untitled'}
Inference: ${e.inference || 'N/A'}
Public Reply: ${e.public_reply ?? 'N/A'}
Dynamo: ${e.dynamo_result?.result?.recommendation ?? 'N/A'}
Matched Primitives: ${primitiveSummary || 'none'}
Governance Forced: ${e.governance_forced ? 'yes' : 'no'}
`;
      })
      .join('\n');

    const weightedPrimitives = formatWeightedPrimitivesSection(entries);

    return `You are Groover performing deep meta-inference.

Batch ${batchIndex} of ${totalBatches} — ${entries.length} entries.

=== GOVERNANCE STATS (cumulative) ===
Total analyzed so far: ${dynamoStats.analyzedSoFar}
Dynamo PASS: ${dynamoStats.pass}
Dynamo REJECT: ${dynamoStats.reject}
Average resonance: ${dynamoStats.avgResonance}

=== CONFIDENCE-WEIGHTED PRIMITIVES (batch) ===
${weightedPrimitives}

${entryBlocks}

Perform dual-layer analysis on this batch and previous context if available. Focus on both inference quality and what the data reveals about Dynamo governance effectiveness and agent autonomy. Weight "Repeatedly Surfaced Missing Primitives" by avg_confidence and occurrence count.`;
  }

  buildFinalSynthesisPrompt(
    entryCount: number,
    dynamoStats: { pass: number; reject: number; avgResonance: string },
    batchResults: string[],
    entries: InferenceEntry[] = [],
  ): string {
    const weightedPrimitives = formatWeightedPrimitivesSection(entries, 12);

    return `You are Groover synthesizing a deep, concrete meta-inference report from ${entryCount} entries.

GOVERNANCE SUMMARY:
- Total entries: ${entryCount}
- Dynamo PASS: ${dynamoStats.pass}
- Dynamo REJECT: ${dynamoStats.reject}
- Average resonanceScore: ${dynamoStats.avgResonance}

CONFIDENCE-WEIGHTED PRIMITIVES (full run):
${weightedPrimitives}

Below are the batch analyses. Produce a **concrete, non-abstract** report with the following mandatory sections. Every point must be grounded in specific signals from the data. Prioritize primitives with higher weighted_score and avg_confidence when writing section 1:

${SYNTHESIS_SECTION_INSTRUCTIONS}

${batchResults.join('\n\n--- BATCH BREAK ---\n\n')}`;
  }
}