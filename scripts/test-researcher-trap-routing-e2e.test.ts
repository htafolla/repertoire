/**
 * P0.5 — MCP-mode trap routing e2e (xray-researcher stdio subprocess).
 * Proves analyze_proposal emits MEMORY_ROUTING in harness/MCP mode — no silent no-op.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const TRAP_SIGNAL = 'attestation-as-map';
const TRAP_DESCRIPTION =
  'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function resolveResearcherServerPath(): string {
  const sibling = join(repoRoot, '../xray/dist/mcps/researcher.server.js');
  if (existsSync(sibling)) return sibling;
  return join(repoRoot, 'node_modules/0xray/dist/mcps/researcher.server.js');
}

function textToolResult(result: CallToolResult): string {
  const block = result.content?.find((entry) => entry.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('MCP tool returned no text content');
  }
  return block.text;
}

interface ResearcherSession {
  client: Client;
  transport: StdioClientTransport;
}

async function openResearcherSession(): Promise<ResearcherSession> {
  const serverPath = resolveResearcherServerPath();
  if (!existsSync(serverPath)) {
    throw new Error(
      `xray researcher MCP not found at ${serverPath}. Run: npm install 0xray (or build ../xray)`,
    );
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: repoRoot,
    stderr: 'pipe',
  });

  const client = new Client({ name: 'trap-routing-e2e', version: '1.0.0' });
  await client.connect(transport);
  return { client, transport };
}

async function closeResearcherSession(session: ResearcherSession): Promise<void> {
  await session.client.close();
  await session.transport.close();
}

describe('xray-researcher MCP trap routing e2e (P0.5)', () => {
  // Researcher MCP cold-start can exceed default 5s on CI / macOS
  let serverPath: string;

  beforeAll(() => {
    serverPath = resolveResearcherServerPath();
    if (!existsSync(serverPath)) {
      throw new Error(`Missing researcher server: ${serverPath}`);
    }
    if (!existsSync(join(repoRoot, 'dist/provider/memory-routing-provider.js'))) {
      throw new Error('Repertoire provider not built. Run: npm run build');
    }
  });

  afterEach(async () => {
    // sessions closed per test
  });

  it('analyze_proposal emits MEMORY_ROUTING immediately (no async load race)', { timeout: 30_000 }, async () => {
    const session = await openResearcherSession();
    try {
      const result = await session.client.callTool({
        name: 'analyze_proposal',
        arguments: {
          proposalTitle: 'Trap governance review',
          proposalDescription: TRAP_DESCRIPTION,
          proposalType: 'governance',
        },
      });

      const text = textToolResult(result);

      expect(text).toContain('MEMORY_ROUTING:');
      expect(text).toContain('provider: repertoire');
      expect(text).toContain('trigger: trap-language');
      expect(text).toContain(`matchedSignals: ${TRAP_SIGNAL}`);
      expect(text).toContain('highConfidenceTrapPresent: true');
      expect(text).toContain('recommendedAgent: architect');
      expect(text).toContain('complexityBoost:');
      expect(text).toContain('high-confidence ontological trap');
    } finally {
      await closeResearcherSession(session);
    }
  });

  it('routine proposal does not emit MEMORY_ROUTING block', { timeout: 30_000 }, async () => {
    const session = await openResearcherSession();
    try {
      const result = await session.client.callTool({
        name: 'analyze_proposal',
        arguments: {
          proposalTitle: 'Routine refactor',
          proposalDescription: 'Rename helper functions for readability.',
          proposalType: 'refactor',
        },
      });

      const text = textToolResult(result);
      expect(text).not.toContain('MEMORY_ROUTING:');
    } finally {
      await closeResearcherSession(session);
    }
  });
});