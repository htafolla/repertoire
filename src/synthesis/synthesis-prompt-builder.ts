import { SYNTHESIS_SECTION_INSTRUCTIONS } from './concrete-sections.js';
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
      .map(
        (e, idx) => `
Entry ${globalIndex + idx + 1}
Post: ${e.post_title ?? 'untitled'}
Inference: ${e.inference || 'N/A'}
Public Reply: ${e.public_reply ?? 'N/A'}
Dynamo: ${e.dynamo_result?.result?.recommendation ?? 'N/A'}
`,
      )
      .join('\n');

    return `You are Groover performing deep meta-inference.

Batch ${batchIndex} of ${totalBatches} — ${entries.length} entries.

=== GOVERNANCE STATS (cumulative) ===
Total analyzed so far: ${dynamoStats.analyzedSoFar}
Dynamo PASS: ${dynamoStats.pass}
Dynamo REJECT: ${dynamoStats.reject}
Average resonance: ${dynamoStats.avgResonance}

${entryBlocks}

Perform dual-layer analysis on this batch and previous context if available. Focus on both inference quality and what the data reveals about Dynamo governance effectiveness and agent autonomy.`;
  }

  buildFinalSynthesisPrompt(
    entryCount: number,
    dynamoStats: { pass: number; reject: number; avgResonance: string },
    batchResults: string[],
  ): string {
    return `You are Groover synthesizing a deep, concrete meta-inference report from ${entryCount} entries.

GOVERNANCE SUMMARY:
- Total entries: ${entryCount}
- Dynamo PASS: ${dynamoStats.pass}
- Dynamo REJECT: ${dynamoStats.reject}
- Average resonanceScore: ${dynamoStats.avgResonance}

Below are the batch analyses. Produce a **concrete, non-abstract** report with the following mandatory sections. Every point must be grounded in specific signals from the data:

${SYNTHESIS_SECTION_INSTRUCTIONS}

${batchResults.join('\n\n--- BATCH BREAK ---\n\n')}`;
  }
}