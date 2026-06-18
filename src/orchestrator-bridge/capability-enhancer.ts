import type { AgentCapability } from '../types.js';
import { TAG_AGENT_AFFINITY } from './signal-agent-affinity.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';

export class CapabilityEnhancer {
  constructor(private readonly signalsManager: CuratedSignalsManager) {}

  /**
   * Seeds repertoireSignals and repertoireTags onto each agent capability map entry.
   */
  enhance(baseCapabilities: Map<string, AgentCapability>): Map<string, AgentCapability> {
    const highPriority = this.signalsManager.getHighPrioritySignals();
    const signalNames = highPriority.map((s) => s.name);
    const allTags = [...new Set(highPriority.flatMap((s) => s.tags))];

    const enriched = new Map<string, AgentCapability>();

    for (const [agent, caps] of baseCapabilities) {
      const tagAffinities = Object.entries(TAG_AGENT_AFFINITY)
        .filter(([, agents]) => agents.includes(agent))
        .map(([tag]) => tag);

      const agentSignals = highPriority
        .filter((s) => s.tags.some((t) => tagAffinities.includes(t)))
        .map((s) => s.name);

      enriched.set(agent, {
        ...caps,
        capabilities: [...new Set([...caps.capabilities, ...signalNames, ...agentSignals])],
        repertoireSignals: [...new Set([...(caps.repertoireSignals ?? []), ...agentSignals])],
        repertoireTags: [...new Set([...(caps.repertoireTags ?? []), ...tagAffinities, ...allTags])],
      });
    }

    return enriched;
  }
}