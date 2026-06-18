import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RepertoireService } from '../src/RepertoireService.js';
import type { AgentCapability, CuratedSignalsFile } from '../src/types.js';

const TRAP_SIGNAL = 'attestation-as-map';

const ENRICHED_LOG_ENTRIES = [
  {
    timestamp: '2026-06-18T12:00:00.000Z',
    source: 'groover',
    post_id: 'e2e-post-1',
    post_title: 'Attestation boundary test',
    comment_id: 'e2e-comment-1',
    inference:
      'TYPE: ontological-trap\nattestation-as-map requires consumer-side revalidation at the trust boundary.',
    public_reply: 'Attestation is a directional map, not a terminating verdict.',
    matched_primitives: [TRAP_SIGNAL],
    match_confidence: { [TRAP_SIGNAL]: 0.92 },
    governance_forced: true,
    inference_type: 'ontological-trap',
    repertoire_signals: [TRAP_SIGNAL],
    dynamo_result: {
      result: { recommendation: 'PASS', resonanceScore: 0.88 },
      matchedPrimitives: [TRAP_SIGNAL],
    },
  },
  {
    timestamp: '2026-06-18T12:05:00.000Z',
    source: 'groover',
    post_id: 'e2e-post-2',
    post_title: 'Second trap observation',
    comment_id: 'e2e-comment-2',
    inference:
      'TYPE: ontological-trap\nClosure primitive: attestation-as-map with mandatory consumer re-check.',
    public_reply: 'Consumer boundary must revalidate invariants before consumption.',
    matched_primitives: [TRAP_SIGNAL],
    match_confidence: { [TRAP_SIGNAL]: 0.88 },
    governance_forced: true,
    inference_type: 'ontological-trap',
    repertoire_signals: [TRAP_SIGNAL],
    dynamo_result: {
      result: { recommendation: 'PASS', resonanceScore: 0.91 },
      matchedPrimitives: [TRAP_SIGNAL],
    },
  },
];

const LEGACY_LOG_ENTRY = {
  timestamp: '2026-06-18T13:00:00.000Z',
  source: 'groover',
  post_id: 'legacy-post-1',
  post_title: 'Legacy log without confidence fields',
  comment_id: 'legacy-comment-1',
  inference:
    'TYPE: ontological-trap\nUnnamed negative-space gap with no structured primitive mapping or confidence metadata.',
  public_reply: 'Legacy reply text without enriched logging fields.',
};

interface TestWorkspace {
  root: string;
  service: RepertoireService;
  sourceDir: string;
}

function seedCuratedSignals(path: string): void {
  const data: CuratedSignalsFile = {
    description: 'E2E fixture registry',
    schema_version: '1.1',
    last_updated: new Date().toISOString(),
    signals: [
      {
        name: TRAP_SIGNAL,
        definition:
          'Attestation is directional rather than a terminating verdict; consumers must revalidate.',
        example_inference_snippet:
          'Attestation functions as a trust map rather than a conclusive verdict...',
        tags: ['ontological-trap', 'attestation', 'consumer-boundary'],
        status: 'proposed',
        priority: 'high',
        evaluation_criteria:
          'Reply states attestation is directional/ongoing rather than final.',
        validation_experiment:
          'Feed static attestation metadata without consumer recheck and expect REJECT.',
        master_index_integration: 'Register as first-class signal type.',
        implementation_notes: 'Enforce via govern_with_solar on ontological-trap entries.',
      },
    ],
  };
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function createTestWorkspace(): TestWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'repertoire-e2e-'));
  const dataDir = join(root, 'data');
  const sourceDir = join(root, 'groover-source');
  const logDir = join(root, 'logs', 'groover-inference');

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });

  seedCuratedSignals(join(dataDir, 'curated_signals.json'));
  writeFileSync(join(dataDir, 'inference-state.json'), JSON.stringify({
    processedCommentIds: [],
    processedSessionIds: [],
    lastRun: null,
  }));

  const service = new RepertoireService({
    dataDir,
    logDir,
    signalsPath: join(dataDir, 'curated_signals.json'),
    statePath: join(dataDir, 'inference-state.json'),
  });

  return { root, service, sourceDir };
}

function writeGrooverLogs(sourceDir: string, entries: Record<string, unknown>[]): void {
  const lines = entries.map((entry) => JSON.stringify(entry)).join('\n');
  writeFileSync(join(sourceDir, '2026-06-18.jsonl'), `${lines}\n`);
}

function createAgentCapabilities(): Map<string, AgentCapability> {
  return new Map([
    [
      'architect',
      {
        capabilities: ['design', 'governance', TRAP_SIGNAL],
        complexityThreshold: 90,
        concurrentTasks: 2,
        repertoireSignals: [TRAP_SIGNAL],
        repertoireTags: ['ontological-trap', 'attestation'],
      },
    ],
    [
      'code-reviewer',
      {
        capabilities: ['review', 'governance'],
        complexityThreshold: 90,
        concurrentTasks: 4,
        repertoireSignals: [],
        repertoireTags: [],
      },
    ],
  ]);
}

function trapTaskDescription(): string {
  return 'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required';
}

describe('E2E confidence loop (simulated)', () => {
  let workspace: TestWorkspace | null = null;

  afterEach(() => {
    if (workspace) {
      rmSync(workspace.root, { recursive: true, force: true });
      workspace = null;
    }
  });

  it('closes the enriched loop: ingest → promote → MCP queries → architect routing', () => {
    workspace = createTestWorkspace();
    const { service, sourceDir } = workspace;

    writeGrooverLogs(sourceDir, ENRICHED_LOG_ENTRIES);
    const ingest = service.ingestGrooverLogs(sourceDir);

    expect(ingest.imported).toBe(2);
    expect(ingest.skipped).toBe(0);
    expect(ingest.promoted).toContain(TRAP_SIGNAL);

    const promoted = service.signalsManager.getByName(TRAP_SIGNAL);
    expect(promoted?.status).toBe('validated');
    expect(promoted?.observation_stats?.observation_count).toBe(2);
    expect(promoted?.observation_stats?.avg_confidence).toBeGreaterThanOrEqual(0.55);
    expect(promoted?.observation_stats?.governance_forced_count).toBe(2);

    const highConfidence = service.getHighConfidenceSignals({
      minConfidence: 0.55,
      tags: ['ontological-trap'],
      limit: 5,
    });
    expect(highConfidence.map((signal) => signal.name)).toContain(TRAP_SIGNAL);

    const taskConfidence = service.getTaskConfidence({
      description: trapTaskDescription(),
      type: 'governance',
      id: 'e2e-trap-task',
    });
    expect(taskConfidence.highConfidenceTrapPresent).toBe(true);
    expect(taskConfidence.ontologicalTrapDetected).toBe(true);
    expect(taskConfidence.complexityBoost).toBeGreaterThan(0);
    expect(taskConfidence.signals.some((entry) => entry.name === TRAP_SIGNAL)).toBe(true);

    const searchResults = service.searchPrimitives('attestation-as-map ontological-trap', {
      minConfidence: 0.55,
      limit: 5,
    });
    expect(searchResults[0]?.name).toBe(TRAP_SIGNAL);

    const capabilities = service.enhanceCapabilities(createAgentCapabilities());
    const trapComplexity = 45;
    const selectedAgent = service.selectAgent(
      capabilities,
      ['governance'],
      trapComplexity,
      trapTaskDescription(),
    );
    expect(selectedAgent).toBe('architect');

    const thinDispatch = service.resolveThinDispatch('code-reviewer', trapTaskDescription(), 30);
    expect(thinDispatch.agent).toBe('architect');
    expect(thinDispatch.adjustedScore).toBeGreaterThan(30);
  });

  it('handles legacy logs gracefully without promotion or high-confidence trap routing', () => {
    workspace = createTestWorkspace();
    const { service, sourceDir } = workspace;

    writeGrooverLogs(sourceDir, [LEGACY_LOG_ENTRY]);
    const ingest = service.ingestGrooverLogs(sourceDir);

    expect(ingest.imported).toBe(1);
    expect(ingest.promoted).toHaveLength(0);

    const signal = service.signalsManager.getByName(TRAP_SIGNAL);
    expect(signal?.observation_stats).toBeUndefined();

    const taskConfidence = service.getTaskConfidence({
      description: 'TYPE: ontological-trap unnamed negative-space gap',
      type: 'governance',
    });
    expect(taskConfidence.ontologicalTrapDetected).toBe(true);
    expect(taskConfidence.highConfidenceTrapPresent).toBe(false);
    expect(taskConfidence.complexityBoost).toBe(8);

    const capabilities = service.enhanceCapabilities(createAgentCapabilities());
    const selectedAgent = service.selectAgent(
      capabilities,
      ['governance'],
      30,
      LEGACY_LOG_ENTRY.inference,
    );
    expect(['architect', 'code-reviewer']).toContain(selectedAgent);
  });
});