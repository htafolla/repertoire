#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';

const service = new RepertoireService();
const report = await service.runMetaInference();

if (!report) {
  console.log('No new entries to process.');
  process.exit(0);
}

console.log(`Meta-inference complete: ${report.entriesProcessed} entries`);
console.log(`Dynamo PASS: ${report.dynamoStats.pass}, REJECT: ${report.dynamoStats.reject}`);
console.log(`Avg resonance: ${report.dynamoStats.avgResonance?.toFixed(3) ?? 'N/A'}`);