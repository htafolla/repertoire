/** Default tag → agent affinity for Repertoire-enriched routing */
export const TAG_AGENT_AFFINITY: Record<string, string[]> = {
  'ontological-trap': ['architect', 'security-auditor', 'researcher'],
  attestation: ['security-auditor', 'architect'],
  'consumer-boundary': ['architect', 'code-reviewer'],
  interpretation: ['researcher', 'architect'],
  criteria: ['researcher', 'architect'],
  invariant: ['architect', 'security-auditor'],
  'provenance-failure': ['code-reviewer', 'bug-triage-specialist'],
  representation: ['researcher', 'architect'],
};

/** Agents that receive ontological-trap complexity boost in thinDispatch */
export const ONTOLOGICAL_TRAP_PREFERRED_AGENTS = [
  'architect',
  'security-auditor',
  'researcher',
] as const;