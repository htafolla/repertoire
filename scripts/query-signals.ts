#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Usage: npm run query -- "your operation description"');
  process.exit(1);
}

const service = new RepertoireService();
const matches = service.searchPrimitives(query, { limit: 10 });
const taskConfidence = service.getTaskConfidence({ description: query, type: 'general' });
const routing = service.buildRoutingContext(query);

console.log('\n=== Matched Signals ===');
for (const match of matches) {
  console.log(`• ${match.name} (confidence=${match.confidence.toFixed(3)}, priority=${match.priority})`);
  console.log(`  ${match.definition.slice(0, 120)}...`);
}

console.log('\n=== Task Confidence ===');
console.log(JSON.stringify(taskConfidence, null, 2));

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