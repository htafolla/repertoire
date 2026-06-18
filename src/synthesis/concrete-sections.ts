export const MANDATORY_SYNTHESIS_SECTIONS = [
  'Repeatedly Surfaced Missing Primitives & Invariants',
  'Concrete Validation Experiments',
  'System Validation Opportunities (Feats)',
  'Gap Analysis: Inference Output vs Current System State',
  'Strategic Recommendations (Actionable Only)',
] as const;

export const SYNTHESIS_SECTION_INSTRUCTIONS = `
## 1. Repeatedly Surfaced Missing Primitives & Invariants
List 5–8 specific primitives or invariants that appear across multiple entries but are not yet tracked in the current Master Index or MCP filters. Rank by confidence-weighted score (avg_confidence × sqrt(occurrences)). For each, give the name + one-sentence definition + avg_confidence + which posts surfaced it.

## 2. Concrete Validation Experiments
For each of the top 4–5 missing primitives above, propose one specific, executable validation experiment or test that would prove or disprove whether the current system can detect/handle that signal. Make them falsifiable.

## 3. System Validation Opportunities (Feats)
Extract 4–6 demonstrable "feats" the Groover system should be able to perform based on what the inferences are repeatedly calling for. These should be measurable capabilities, not vague goals.

## 4. Gap Analysis: Inference Output vs Current System State
Identify the largest observable gaps between what the inference replies are demanding and what the current MCP / Master Index / governance layer actually implements. Be specific.

## 5. Strategic Recommendations (Actionable Only)
Maximum 5 recommendations. Each must name a concrete next action, not a principle.
`.trim();