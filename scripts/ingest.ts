#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';

const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const pathIdx = args.indexOf('--path');

const source = sourceIdx >= 0 ? args[sourceIdx + 1] : 'groover';
const sourcePath = pathIdx >= 0 ? args[pathIdx + 1] : undefined;

const service = new RepertoireService();

if (!sourcePath) {
  console.error('Usage: npm run ingest -- --source groover|xray --path <dir>');
  process.exit(1);
}

if (source === 'groover') {
  const result = service.ingestGrooverLogs(sourcePath);
  console.log(
    `Groover ingest: imported=${result.imported} skipped=${result.skipped} promoted=${result.promoted.join(',') || 'none'}`,
  );
} else if (source === 'xray') {
  const result = service.ingestXraySessions(sourcePath);
  console.log(`0xRay ingest: imported=${result.imported} skipped=${result.skipped}`);
} else {
  console.error(`Unknown source: ${source}`);
  process.exit(1);
}