#!/usr/bin/env node
/**
 * Consumer-side helpers for suit verification — constants from 0xray bridge-mcp-wiring (SSOT).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function resolveXrayBridgeModule() {
  const candidates = [
    join(root, 'node_modules/0xray/scripts/node/bridge-mcp-wiring.cjs'),
    resolve(root, '../xray/scripts/node/bridge-mcp-wiring.cjs'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error('0xray bridge-mcp-wiring.cjs missing — run npm install');
  }
  return createRequire(import.meta.url)(found);
}

const wiring = resolveXrayBridgeModule();

export const {
  XRAY_MCP_SERVERS,
  HERMES_CONFIG_PATH,
  HERMES_PLUGIN_DIR,
  OPENCLAW_CONFIG_PATH,
  OPENCLAW_STATE_DIR,
} = wiring;

/** Repertoire consumer MCP surface (local dist when developing this repo). */
export const REPERTOIRE_MCP = {
  name: 'repertoire',
  npxArgs: ['-y', '@0xray/repertoire', 'mcp'],
  localArgs: ['node', 'dist/mcp/server.js'],
};

export function resolveXrayScript(filename) {
  const candidates = [
    join(root, 'node_modules/0xray/scripts/node', filename),
    resolve(root, '../xray/scripts/node', filename),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function readInstalledXrayVersion() {
  try {
    const pkg = createRequire(import.meta.url)(
      join(root, 'node_modules/0xray/package.json'),
    );
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function mcpStdioInitializeProbe({ cwd, command, args, env = {}, timeoutMs = 6000 }) {
  return new Promise((resolveProbe, rejectProbe) => {
    const init = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'suit-bridge-probe', version: '1.0' },
      },
    });

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => {
      proc.kill();
      rejectProbe(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      out += chunk.toString();
    });

    proc.on('close', () => {
      clearTimeout(timer);
      if (out.includes('serverInfo')) resolveProbe(out);
      else rejectProbe(new Error(out.slice(0, 200) || 'no serverInfo in MCP response'));
    });

    proc.stdin.write(`${init}\n`);
    proc.stdin.end();
  });
}