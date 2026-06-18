#!/usr/bin/env node
/**
 * Repertoire MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RepertoireService } from '../RepertoireService.js';
import type { RepertoireServiceOptions } from '../RepertoireService.js';
import {
  DEFAULT_DATA_DIR,
  DEFAULT_LOG_DIR,
  DEFAULT_SIGNALS_PATH,
  DEFAULT_STATE_PATH,
} from '../paths.js';

function serviceOptionsFromEnv(): RepertoireServiceOptions {
  return {
    dataDir: process.env.REPERTOIRE_DATA_DIR ?? DEFAULT_DATA_DIR,
    signalsPath: process.env.CURATED_SIGNALS_PATH ?? DEFAULT_SIGNALS_PATH,
    statePath: process.env.REPERTOIRE_STATE_PATH ?? DEFAULT_STATE_PATH,
    logDir: process.env.REPERTOIRE_LOG_DIR ?? DEFAULT_LOG_DIR,
  };
}

const service = new RepertoireService(serviceOptionsFromEnv());

const TOOLS = [
  {
    name: 'repertoire__get_high_confidence_signals',
    description:
      'List curated signals at or above a confidence threshold, optionally filtered by tags',
    inputSchema: {
      type: 'object',
      properties: {
        minConfidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Minimum avg_confidence from observation_stats (default 0.55)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter to signals containing any of these tags',
        },
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'repertoire__get_task_confidence',
    description:
      'Evaluate confidence context for a task description (trap detection, complexity boost, matched signals)',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Task or operation description' },
        type: { type: 'string', description: 'Task type (e.g. design, governance)' },
        taskId: { type: 'string', description: 'Optional task identifier' },
      },
      required: ['description'],
    },
  },
  {
    name: 'repertoire__search_primitives',
    description:
      'Search curated primitives by text using registry observation_stats confidence',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to match against signal registry' },
        minConfidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Minimum confidence threshold (default 0.55)',
        },
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'repertoire__ingest_feedback',
    description: 'Record orchestrator routing outcome for meta-inference feedback loop',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        taskId: { type: 'string' },
        assignedAgent: { type: 'string' },
        memorySignals: { type: 'array', items: { type: 'string' } },
        complexity: { type: 'number' },
        success: { type: 'boolean' },
        durationMs: { type: 'number' },
      },
      required: ['sessionId', 'taskId', 'assignedAgent', 'success', 'durationMs'],
    },
  },
] as const;

const server = new Server(
  { name: 'repertoire', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
}));

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'repertoire__get_high_confidence_signals': {
      const tags = Array.isArray(a.tags)
        ? a.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined;
      return jsonResult(
        service.getHighConfidenceSignals({
          minConfidence:
            typeof a.minConfidence === 'number' ? a.minConfidence : undefined,
          tags,
          limit: typeof a.limit === 'number' ? a.limit : undefined,
        }),
      );
    }
    case 'repertoire__get_task_confidence': {
      return jsonResult(
        service.getTaskConfidence({
          description: String(a.description),
          type: typeof a.type === 'string' ? a.type : undefined,
          id: typeof a.taskId === 'string' ? a.taskId : undefined,
        }),
      );
    }
    case 'repertoire__search_primitives': {
      return jsonResult(
        service.searchPrimitives(String(a.query), {
          minConfidence:
            typeof a.minConfidence === 'number' ? a.minConfidence : undefined,
          limit: typeof a.limit === 'number' ? a.limit : undefined,
        }),
      );
    }
    case 'repertoire__ingest_feedback': {
      const result = service.ingestOrchestratorFeedback({
        timestamp: new Date().toISOString(),
        sessionId: String(a.sessionId),
        taskId: String(a.taskId),
        assignedAgent: String(a.assignedAgent),
        repertoireSignals: (a.memorySignals as string[]) ?? [],
        complexity: Number(a.complexity ?? 30),
        success: Boolean(a.success),
        durationMs: Number(a.durationMs),
      });
      return jsonResult({
        logPath: result.logPath,
        updatedSignals: result.updatedSignals,
      });
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err}\n`);
  process.exit(1);
});