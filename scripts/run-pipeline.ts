#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RepertoireService } from '../src/RepertoireService.js';
import { MetaInferenceEngine } from '../src/synthesis/meta-inference-engine.js';
import {
  aggregateWeightedPrimitives,
  formatWeightedPrimitivesSection,
} from '../src/synthesis/primitive-confidence-aggregator.js';
import { SynthesisPromptBuilder } from '../src/synthesis/synthesis-prompt-builder.js';
import type { InferenceEntry } from '../src/types.js';

interface PipelineOptions {
  sourceDir: string;
  maxEntries: number;
  skipMetaInference: boolean;
  outputPath: string;
}

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf('--source');
  const maxIdx = args.indexOf('--max-entries');
  const outputIdx = args.indexOf('--output');

  const sourceDir =
    sourceIdx >= 0
      ? args[sourceIdx + 1]!
      : '../groover-integration-work/research/groover-inference-logs';

  return {
    sourceDir,
    maxEntries: maxIdx >= 0 ? Number(args[maxIdx + 1]) : 12,
    skipMetaInference: args.includes('--skip-meta-inference'),
    outputPath: outputIdx >= 0 ? args[outputIdx + 1]! : 'logs/pipeline-run.json',
  };
}

function loadInferenceEntries(logDir: string): InferenceEntry[] {
  if (!existsSync(logDir)) return [];

  const entries: InferenceEntry[] = [];
  for (const file of readdirSync(logDir).filter((name) => name.endsWith('.jsonl')).sort()) {
    const lines = readFileSync(join(logDir, file), 'utf8').trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      try {
        entries.push(JSON.parse(line) as InferenceEntry);
      } catch {
        // skip malformed
      }
    }
  }
  return entries;
}

function rankByOccurrence(entries: InferenceEntry[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const names = entry.matched_primitives ?? entry.repertoire_signals ?? [];
    for (const name of names) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function summarizeEntryFormat(entries: InferenceEntry[]) {
  const enriched = entries.filter(
    (entry) =>
      entry.match_confidence !== undefined ||
      entry.governance_forced !== undefined ||
      (entry.matched_primitives?.length ?? 0) > 0,
  ).length;

  return {
    total: entries.length,
    enriched,
    legacy: entries.length - enriched,
    enrichedPct: entries.length > 0 ? ((enriched / entries.length) * 100).toFixed(1) : '0.0',
  };
}

function compareRankings(entries: InferenceEntry[], limit = 12) {
  const weighted = aggregateWeightedPrimitives(entries).slice(0, limit);
  const occurrence = rankByOccurrence(entries).slice(0, limit);

  const weightedRank = new Map(weighted.map((item, index) => [item.name, index + 1]));
  const occurrenceRank = new Map(occurrence.map((item, index) => [item.name, index + 1]));

  const allNames = new Set([
    ...weighted.map((item) => item.name),
    ...occurrence.map((item) => item.name),
  ]);

  const deltas = [...allNames]
    .map((name) => {
      const weightedPosition = weightedRank.get(name) ?? null;
      const occurrencePosition = occurrenceRank.get(name) ?? null;
      const delta =
        weightedPosition !== null && occurrencePosition !== null
          ? occurrencePosition - weightedPosition
          : null;

      return { name, weightedPosition, occurrencePosition, delta };
    })
    .sort((a, b) => {
      const aRank = a.weightedPosition ?? 999;
      const bRank = b.weightedPosition ?? 999;
      return aRank - bRank || a.name.localeCompare(b.name);
    });

  return { weighted, occurrence, deltas };
}

function generateDrySynthesisReport(entries: InferenceEntry[]): string {
  const builder = new SynthesisPromptBuilder();
  const batchPrompt = builder.buildBatchPrompt({
    batchIndex: 1,
    totalBatches: 1,
    entries,
    globalIndex: 0,
    dynamoStats: {
      pass: entries.filter((e) => e.dynamo_result?.result?.recommendation === 'PASS').length,
      reject: entries.filter((e) => e.dynamo_result?.result?.recommendation === 'REJECT').length,
      avgResonance: 'N/A',
      analyzedSoFar: entries.length,
    },
  });

  return [
    '# Dry Synthesis Report (no Hermes — OAuth unavailable)',
    '',
    '## Confidence-Weighted Primitives',
    formatWeightedPrimitivesSection(entries, 12),
    '',
    '## Occurrence-Only Top Primitives',
    ...rankByOccurrence(entries)
      .slice(0, 12)
      .map((item, index) => `${index + 1}. ${item.name} — count=${item.count}`),
    '',
    '## Batch Prompt Preview',
    batchPrompt,
  ].join('\n');
}

async function main(): Promise<void> {
  const options = parseArgs();
  const service = new RepertoireService();

  console.log('=== Repertoire Pipeline ===');
  console.log(`Source: ${options.sourceDir}`);
  console.log(`Max entries for meta-inference: ${options.maxEntries}`);

  const beforeSignals = service.signalsManager.load();
  const beforeStatuses = Object.fromEntries(
    beforeSignals.signals.map((signal) => [signal.name, signal.status ?? 'proposed']),
  );

  const ingest = service.ingestGrooverLogs(options.sourceDir);
  console.log(`\nIngest: imported=${ingest.imported} skipped=${ingest.skipped}`);
  console.log(
    `Promoted (${ingest.promoted.length}): ${ingest.promoted.join(', ') || 'none'}`,
  );

  const allEntries = loadInferenceEntries('logs/groover-inference');
  const formatSummary = summarizeEntryFormat(allEntries);
  console.log(
    `\nLog format: total=${formatSummary.total} enriched=${formatSummary.enriched} legacy=${formatSummary.legacy} (${formatSummary.enrichedPct}% enriched)`,
  );

  const comparison = compareRankings(allEntries, 12);
  console.log('\n--- Top primitives: weighted vs occurrence ---');
  for (const row of comparison.deltas.slice(0, 12)) {
    const weighted = row.weightedPosition ?? '-';
    const occurrence = row.occurrencePosition ?? '-';
    const delta =
      row.delta === null
        ? 'new/absent'
        : row.delta === 0
          ? 'same'
          : row.delta > 0
            ? `+${row.delta} (up)`
            : `${row.delta} (down)`;
    console.log(`${row.name}: weighted=#${weighted} occurrence=#${occurrence} delta=${delta}`);
  }

  const promotionEvents = beforeSignals.signals
    .filter((signal) => {
      const before = beforeStatuses[signal.name];
      const after = service.signalsManager.getByName(signal.name)?.status ?? 'proposed';
      return before !== after;
    })
    .map((signal) => ({
      name: signal.name,
      from: beforeStatuses[signal.name],
      to: service.signalsManager.getByName(signal.name)?.status ?? 'proposed',
      stats: service.signalsManager.getByName(signal.name)?.observation_stats,
    }));

  let metaReport = null;
  let dryReportPath: string | null = null;

  const unprocessedEntries = loadInferenceEntries('logs/groover-inference').filter((entry) => {
    const id = entry.comment_id ?? entry.post_id ?? entry.session_id;
    if (!id) return false;
    const state = JSON.parse(readFileSync('data/inference-state.json', 'utf8')) as {
      processedCommentIds: string[];
      processedSessionIds: string[];
    };
    return !state.processedCommentIds.includes(id) && !state.processedSessionIds.includes(id);
  });

  const analysisEntries =
    unprocessedEntries.length > 0
      ? unprocessedEntries.slice(0, options.maxEntries)
      : loadInferenceEntries('logs/groover-inference').slice(0, options.maxEntries);

  if (!options.skipMetaInference && analysisEntries.length > 0) {
    console.log('\nRunning meta-inference...');
    const engine = new MetaInferenceEngine({
      logDir: 'logs/groover-inference',
      statePath: 'data/inference-state.json',
      maxEntries: options.maxEntries,
    });
    metaReport = await engine.run();

    if (!metaReport) {
      console.log('Meta-inference: no new unprocessed entries.');
    } else if (!metaReport.finalReport) {
      dryReportPath = 'logs/meta-inference/dry-synthesis.md';
      mkdirSync('logs/meta-inference', { recursive: true });
      const dryReport = generateDrySynthesisReport(analysisEntries);
      writeFileSync(dryReportPath, dryReport);
      console.log(`Meta-inference: Hermes produced no report (likely OAuth). Dry report: ${dryReportPath}`);
    } else {
      console.log(`Meta-inference: processed=${metaReport.entriesProcessed}`);
      console.log(
        `Dynamo PASS=${metaReport.dynamoStats.pass} REJECT=${metaReport.dynamoStats.reject} avgResonance=${metaReport.dynamoStats.avgResonance?.toFixed(3) ?? 'N/A'}`,
      );
      console.log('Report appended to logs/meta-inference/synthesis.md');
    }
  } else if (analysisEntries.length > 0) {
    dryReportPath = 'logs/meta-inference/dry-synthesis.md';
    mkdirSync('logs/meta-inference', { recursive: true });
    writeFileSync(dryReportPath, generateDrySynthesisReport(analysisEntries));
    console.log(`\nDry synthesis report: ${dryReportPath}`);
  }

  const runSummary = {
    timestamp: new Date().toISOString(),
    sourceDir: options.sourceDir,
    ingest,
    formatSummary,
    promotionEvents,
    rankingComparison: comparison,
    metaInference: metaReport
      ? {
          entriesProcessed: metaReport.entriesProcessed,
          dynamoStats: metaReport.dynamoStats,
          reportPreview: metaReport.finalReport.slice(0, 2000),
          dryReportPath,
        }
      : dryReportPath
        ? { dryReportPath }
        : null,
  };

  writeFileSync(options.outputPath, JSON.stringify(runSummary, null, 2));
  console.log(`\nPipeline summary written to ${options.outputPath}`);
}

main().catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});