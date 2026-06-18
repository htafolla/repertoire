import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compiled to dist/paths.js — one level below package root. */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_DATA_DIR = join(PACKAGE_ROOT, 'data');
export const DEFAULT_SIGNALS_PATH = join(PACKAGE_ROOT, 'data', 'curated_signals.json');
export const DEFAULT_STATE_PATH = join(PACKAGE_ROOT, 'data', 'inference-state.json');
export const DEFAULT_LOG_DIR = join(PACKAGE_ROOT, 'logs', 'groover-inference');
export const DEFAULT_FEEDBACK_DIR = join(PACKAGE_ROOT, 'logs', 'orchestrator-feedback');
export const DEFAULT_MCP_SERVER_PATH = join(PACKAGE_ROOT, 'dist', 'mcp', 'server.js');
export const DEFAULT_PROVIDER_PATH = join(
  PACKAGE_ROOT,
  'dist',
  'provider',
  'memory-routing-provider.js',
);