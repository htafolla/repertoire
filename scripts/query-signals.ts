#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Usage: npm run query -- "your operation description"');
  process.exit(1);
}

const service = new RepertoireService();
const matches = service.querySignals(query);
const routing = service.buildRoutingContext(query);

console.log('\n=== Matched Signals ===');
for (const m of matches) {
  console.log(`• ${m.signal.name} (score=${m.score}, priority=${m.signal.priority})`);
  console.log(`  ${m.signal.definition.slice(0, 120)}...`);
}

console.log('\n=== Routing Context ===');
console.log(JSON.stringify(routing, null, 2));

const caps = new Map([
  ['architect', { capabilities: ['design', 'planning'], complexityThreshold: 50, concurrentTasks: 2 }],
  ['security-auditor', { capabilities: ['security', 'audit'], complexityThreshold: 35, concurrentTasks: 2 }],
  ['code-reviewer', { capabilities: ['review', 'quality'], complexityThreshold: 30, concurrentTasks: 4 }],
]);

const enhanced = service.enhanceCapabilities(caps);
const agent = service.selectAgent(enhanced, ['design'], 40, query);
console.log(`\nRecommended agent: ${agent ?? 'none'}`);