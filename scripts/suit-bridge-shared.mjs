#!/usr/bin/env node
/**
 * Consumer-side helpers for suit verification — constants from 0xray bridge-mcp-wiring (SSOT).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');

/** Consumer project root (hoisted 0xray lives here, not under @0xray/repertoire). */
export function resolveConsumerRoot() {
  if (process.env.SUIT_VERIFY_ROOT) return resolve(process.env.SUIT_VERIFY_ROOT);
  if (existsSync(join(process.cwd(), '.xray', 'features.json'))) return resolve(process.cwd());
  return packageRoot;
}

function xrayPathCandidates(...segments) {
  const consumerRoot = resolveConsumerRoot();
  const roots =
    consumerRoot === packageRoot ? [packageRoot] : [consumerRoot, packageRoot];
  const candidates = roots.map((r) => join(r, 'node_modules/0xray', ...segments));
  candidates.push(resolve(packageRoot, '../xray', ...segments));
  return candidates;
}

function resolveXrayBridgeModule() {
  const found = xrayPathCandidates('scripts/node/bridge-mcp-wiring.cjs').find((p) =>
    existsSync(p),
  );
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
  return xrayPathCandidates('scripts/node', filename).find((p) => existsSync(p)) ?? null;
}

export function readInstalledXrayVersion() {
  const pkgPath = xrayPathCandidates('package.json').find((p) => existsSync(p));
  if (!pkgPath) return 'unknown';
  try {
    const pkg = createRequire(import.meta.url)(pkgPath);
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

    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        proc.kill('SIGTERM');
      } catch {
        /* already exited */
      }
      if (ok) resolveProbe(out);
      else rejectProbe(new Error(out.slice(0, 200) || 'no serverInfo in MCP response'));
    };

    let finished = false;

    const onData = (chunk) => {
      out += chunk.toString();
      if (out.includes('serverInfo')) finish(true);
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('close', () => {
      if (!finished) finish(out.includes('serverInfo'));
    });

    proc.stdin.write(`${init}\n`);
    proc.stdin.end();
  });
}