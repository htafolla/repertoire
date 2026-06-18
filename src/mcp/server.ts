#!/usr/bin/env node
/**
 * Repertoire MCP Server — query primitives, synthesis, and routing context.
 * Provider-agnostic surface; Repertoire is the backing store.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RepertoireService } from '../RepertoireService.js';

const service = new RepertoireService();

const server = new Server(
  { name: 'repertoire', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_signals',
      description: 'Query curated signals by text, tag, or priority',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to match against signals' },
          tag: { type: 'string', description: 'Filter by tag (e.g. ontological-trap)' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    {
      name: 'match_primitives',
      description: 'Match operation text to curated primitives with scores',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
        },
        required: ['operation'],
      },
    },
    {
      name: 'get_routing_context',
      description: 'Build memory routing context for orchestrator/thinDispatch',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
        },
        required: ['operation'],
      },
    },
    {
      name: 'get_high_priority_signals',
      description: 'List all high-priority curated signals',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ingest_feedback',
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'query_signals': {
      let signals = service.signalsManager.load().signals;
      if (a.tag) signals = signals.filter((s) => s.tags.includes(String(a.tag)));
      if (a.priority) signals = signals.filter((s) => s.priority === a.priority);
      if (a.query) {
        const matches = service.querySignals(String(a.query));
        signals = matches.map((m) => m.signal);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }],
      };
    }
    case 'match_primitives': {
      const matches = service.querySignals(String(a.operation));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            matches.map((m) => ({
              name: m.signal.name,
              score: m.score,
              priority: m.signal.priority,
              definition: m.signal.definition,
            })),
            null,
            2,
          ),
        }],
      };
    }
    case 'get_routing_context': {
      const ctx = service.buildRoutingContext(String(a.operation));
      return {
        content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }],
      };
    }
    case 'get_high_priority_signals': {
      const signals = service.getHighPrioritySignals();
      return {
        content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }],
      };
    }
    case 'ingest_feedback': {
      const path = service.ingestOrchestratorFeedback({
        timestamp: new Date().toISOString(),
        sessionId: String(a.sessionId),
        taskId: String(a.taskId),
        assignedAgent: String(a.assignedAgent),
        repertoireSignals: (a.memorySignals as string[]) ?? [],
        complexity: Number(a.complexity ?? 30),
        success: Boolean(a.success),
        durationMs: Number(a.durationMs),
      });
      return {
        content: [{ type: 'text', text: `Feedback recorded: ${path}` }],
      };
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