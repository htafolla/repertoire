import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { CuratedSignalsFile } from '../src/types.js';

const TRAP_SIGNAL = 'attestation-as-map';
const TRAP_DESCRIPTION =
  'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(repoRoot, 'dist/mcp/server.js');

function seedPromotedRegistry(path: string): void {
  const data: CuratedSignalsFile = {
    description: 'MCP stdio smoke fixture',
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
        status: 'validated',
        priority: 'high',
        evaluation_criteria:
          'Reply states attestation is directional/ongoing rather than final.',
        validation_experiment:
          'Feed static attestation metadata without consumer recheck and expect REJECT.',
        master_index_integration: 'Register as first-class signal type.',
        implementation_notes: 'Enforce via govern_with_solar on ontological-trap entries.',
        observation_stats: {
          observation_count: 2,
          avg_confidence: 0.9,
          max_confidence: 0.92,
          last_seen: '2026-06-18T12:05:00.000Z',
          governance_forced_count: 2,
        },
      },
    ],
  };
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function parseJsonToolResult(result: CallToolResult): unknown {
  const block = result.content?.find((entry) => entry.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('MCP tool returned no text content');
  }
  return JSON.parse(block.text);
}

function textToolResult(result: CallToolResult): string {
  const block = result.content?.find((entry) => entry.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('MCP tool returned no text content');
  }
  return block.text;
}

interface McpSession {
  client: Client;
  transport: StdioClientTransport;
  workspace: string;
}

function mcpEnvForWorkspace(workspace: string): Record<string, string> {
  const dataDir = join(workspace, 'data');
  const feedbackDir = join(workspace, 'logs', 'orchestrator-feedback');
  return {
    ...process.env,
    CURATED_SIGNALS_PATH: join(dataDir, 'curated_signals.json'),
    REPERTOIRE_DATA_DIR: dataDir,
    REPERTOIRE_FEEDBACK_DIR: feedbackDir,
  } as Record<string, string>;
}

async function openMcpSession(options: {
  cwd: string;
  env?: Record<string, string>;
}): Promise<McpSession> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: options.cwd,
    env: options.env,
    stderr: 'pipe',
  });

  const client = new Client({ name: 'repertoire-mcp-smoke', version: '1.0.0' });
  await client.connect(transport);
  return { client, transport, workspace: options.cwd };
}

async function closeMcpSession(session: McpSession): Promise<void> {
  await session.client.close();
  await session.transport.close();
}

describe('MCP stdio smoke (Hermes path)', () => {
  let workspace: string | null = null;

  beforeAll(() => {
    if (!existsSync(serverPath)) {
      throw new Error(
        `MCP server not built at ${serverPath}. Run: npm run build`,
      );
    }
  });

  afterEach(async () => {
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
      workspace = null;
    }
  });

  it('lists repertoire MCP tools over stdio', async () => {
    workspace = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    const dataDir = join(workspace, 'data');
    mkdirSync(dataDir, { recursive: true });
    seedPromotedRegistry(join(dataDir, 'curated_signals.json'));

    const session = await openMcpSession({
      cwd: workspace,
      env: mcpEnvForWorkspace(workspace),
    });
    try {
      const tools = await session.client.listTools();
      const names = tools.tools.map((tool) => tool.name).sort();

      expect(names).toEqual([
        'repertoire__get_high_confidence_signals',
        'repertoire__get_task_confidence',
        'repertoire__ingest_feedback',
        'repertoire__search_primitives',
      ]);
    } finally {
      await closeMcpSession(session);
    }
  });

  it('returns trap confidence via repertoire__get_task_confidence', async () => {
    workspace = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    const dataDir = join(workspace, 'data');
    mkdirSync(dataDir, { recursive: true });
    seedPromotedRegistry(join(dataDir, 'curated_signals.json'));

    const session = await openMcpSession({
      cwd: workspace,
      env: mcpEnvForWorkspace(workspace),
    });

    try {
      const result = await session.client.callTool({
        name: 'repertoire__get_task_confidence',
        arguments: {
          description: TRAP_DESCRIPTION,
          type: 'governance',
          taskId: 'mcp-smoke-trap',
        },
      });

      const context = parseJsonToolResult(result) as {
        highConfidenceTrapPresent: boolean;
        ontologicalTrapDetected: boolean;
        matchedSignals: string[];
        recommendedAgent: string | null;
        complexityBoost: number;
        signals: Array<{ name: string; confidence: number }>;
      };

      expect(context.highConfidenceTrapPresent).toBe(true);
      expect(context.ontologicalTrapDetected).toBe(true);
      expect(context.matchedSignals).toContain(TRAP_SIGNAL);
      expect(context.recommendedAgent).toBe('architect');
      expect(context.complexityBoost).toBeGreaterThan(0);
      expect(context.signals.some((entry) => entry.name === TRAP_SIGNAL)).toBe(true);
    } finally {
      await closeMcpSession(session);
    }
  });

  it('searches primitives via repertoire__search_primitives', async () => {
    workspace = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    const dataDir = join(workspace, 'data');
    mkdirSync(dataDir, { recursive: true });
    seedPromotedRegistry(join(dataDir, 'curated_signals.json'));

    const session = await openMcpSession({
      cwd: workspace,
      env: mcpEnvForWorkspace(workspace),
    });
    try {
      const result = await session.client.callTool({
        name: 'repertoire__search_primitives',
        arguments: {
          query: 'attestation-as-map ontological-trap',
          minConfidence: 0.55,
          limit: 5,
        },
      });

      const matches = parseJsonToolResult(result) as Array<{
        name: string;
        confidence: number;
        observationCount: number;
      }>;

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe(TRAP_SIGNAL);
      expect(matches[0].confidence).toBeGreaterThanOrEqual(0.55);
      expect(matches[0].observationCount).toBe(2);
    } finally {
      await closeMcpSession(session);
    }
  });

  it('filters high-confidence trap signals via repertoire__get_high_confidence_signals', async () => {
    workspace = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    const dataDir = join(workspace, 'data');
    mkdirSync(dataDir, { recursive: true });
    seedPromotedRegistry(join(dataDir, 'curated_signals.json'));

    const session = await openMcpSession({
      cwd: workspace,
      env: mcpEnvForWorkspace(workspace),
    });
    try {
      const result = await session.client.callTool({
        name: 'repertoire__get_high_confidence_signals',
        arguments: {
          minConfidence: 0.55,
          tags: ['ontological-trap'],
          limit: 10,
        },
      });

      const signals = parseJsonToolResult(result) as Array<{ name: string }>;
      expect(signals.map((entry) => entry.name)).toContain(TRAP_SIGNAL);
    } finally {
      await closeMcpSession(session);
    }
  });

  it('records feedback via repertoire__ingest_feedback', async () => {
    workspace = mkdtempSync(join(tmpdir(), 'repertoire-mcp-'));
    const dataDir = join(workspace, 'data');
    mkdirSync(dataDir, { recursive: true });
    seedPromotedRegistry(join(dataDir, 'curated_signals.json'));

    const session = await openMcpSession({
      cwd: workspace,
      env: mcpEnvForWorkspace(workspace),
    });
    try {
      const result = await session.client.callTool({
        name: 'repertoire__ingest_feedback',
        arguments: {
          sessionId: 'mcp-smoke-session',
          taskId: 'mcp-smoke-task',
          assignedAgent: 'architect',
          memorySignals: [TRAP_SIGNAL],
          complexity: 45,
          success: true,
          durationMs: 1200,
        },
      });

      const payload = parseJsonToolResult(result) as {
        logPath: string;
        updatedSignals: Array<{ signalName: string }>;
      };
      expect(payload.logPath).toContain('orchestrator-feedback');
      expect(payload.updatedSignals.map((entry) => entry.signalName)).toContain(TRAP_SIGNAL);
    } finally {
      await closeMcpSession(session);
    }
  });
});