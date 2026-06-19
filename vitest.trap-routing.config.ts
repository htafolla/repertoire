import { defineConfig } from 'vitest/config';

/** Isolated config for slow MCP subprocess trap-routing e2e (confirm:suit:all). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/test-researcher-trap-routing-e2e.test.ts'],
    testTimeout: 30_000,
  },
});