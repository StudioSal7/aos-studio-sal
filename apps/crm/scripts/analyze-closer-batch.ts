#!/usr/bin/env tsx
/**
 * Batch analysis script for closer call transcriptions (Gemini Notes from Google Meet).
 *
 * Usage:
 *   pnpm analyze-closer-batch -- ./path/to/transcricoes/
 *   pnpm analyze-closer-batch -- ./path/to/file.txt   (single file)
 *
 * - Reads all .txt files in the given directory (or a single file).
 * - Extracts call_date from filename: looks for YYYY_MM_DD or YYYY-MM-DD pattern.
 *   Falls back to file's mtime if no date found.
 * - Extracts title from filename: pattern "Studio Sal & <Name>  - ..." → Name.
 *   Falls back to cleaned filename.
 * - Idempotent: skips files whose source_file is already in commercial_analyses.
 * - Throttle: 1 file at a time (sequential) to avoid OpenAI rate limits.
 * - Writes a report to apps/crm/tmp/analise-closer-report.md.
 *
 * Requires: DATABASE_URL and OPENAI_API_KEY in environment.
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { runCloserAnalysis, CLOSER_RUBRIC_VERSION } from '@repo/commercial';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Argument parsing ────────────────────────────────────────────────────────

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: pnpm analyze-closer-batch -- <path-to-dir-or-file>');
  process.exit(1);
}

const resolvedInput = resolve(inputPath);
const stat = statSync(resolvedInput);

let files: string[];
if (stat.isDirectory()) {
  files = readdirSync(resolvedInput)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .map((f) => resolve(resolvedInput, f));
} else {
  files = [resolvedInput];
}

if (files.length === 0) {
  console.error('No .txt files found in', resolvedInput);
  process.exit(1);
}

// ── Filename parsing ─────────────────────────────────────────────────────────

function extractCallDate(filename: string, mtime: Date): string {
  // Try YYYY_MM_DD or YYYY-MM-DD in filename
  const match = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  // Fallback: file modification date
  return mtime.toISOString().slice(0, 10);
}

function extractTitle(filename: string): string {
  const base = basename(filename, '.txt');
  // Pattern: "Studio Sal & <Name>  - YYYY_MM_DD ..."
  const salMatch = base.match(/Studio Sal\s*&\s*(.+?)\s+-\s+\d{4}/i);
  if (salMatch?.[1]) {
    return salMatch[1].trim();
  }
  // Fallback: clean the filename
  return base.replace(/\s*-\s*Anotações do Gemini.*/i, '').trim() || base;
}

// ── Idempotency: which source_files already exist? ────────────────────────────

async function getExistingSourceFiles(): Promise<Set<string>> {
  const rows = await db
    .select({ sourceFile: schema.commercialAnalyses.sourceFile })
    .from(schema.commercialAnalyses)
    .where(eq(schema.commercialAnalyses.analyzer, 'closer'));

  return new Set(rows.map((r) => r.sourceFile).filter(Boolean) as string[]);
}

// ── Report types ──────────────────────────────────────────────────────────────

type BatchOutcome =
  | { kind: 'skipped'; file: string; reason: 'already_exists' }
  | { kind: 'analyzed'; file: string; title: string; callDate: string; id: string; score: number }
  | { kind: 'failed'; file: string; title: string; error: string };

// ── Main ─────────────────────────────────────────────────────────────────────

const outcomes: BatchOutcome[] = [];
let processed = 0;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log(`\nStudio Sal — analyze-closer-batch`);
  console.log(`Found ${files.length} .txt file(s) in ${resolvedInput}\n`);

  const existing = await getExistingSourceFiles();

  for (const filePath of files) {
    const filename = basename(filePath);
    const fileStat = statSync(filePath);

    if (existing.has(filename)) {
      console.log(`  ⟳ skip (already analyzed)  ${filename}`);
      outcomes.push({ kind: 'skipped', file: filename, reason: 'already_exists' });
      continue;
    }

    const callDate = extractCallDate(filename, fileStat.mtime);
    const title = extractTitle(filename);
    const transcript = readFileSync(filePath, 'utf-8');

    if (!transcript.trim()) {
      console.log(`  ✗ empty file                ${filename}`);
      outcomes.push({ kind: 'failed', file: filename, title, error: 'Arquivo vazio' });
      continue;
    }

    console.log(`  ⟳ analyzing…                ${title} (${callDate})`);

    // Insert with status 'processando' for crash-recovery awareness
    const [inserted] = await db
      .insert(schema.commercialAnalyses)
      .values({
        analyzer: 'closer',
        title,
        callDate,
        sourceType: 'fechamento',
        sourceFile: filename,
        transcript: transcript.trim(),
        status: 'processando',
        rubricVersion: CLOSER_RUBRIC_VERSION,
      })
      .returning({ id: schema.commercialAnalyses.id });

    if (!inserted) {
      outcomes.push({ kind: 'failed', file: filename, title, error: 'DB insert failed' });
      continue;
    }

    const analysisId = inserted.id;

    try {
      const result = await runCloserAnalysis({ transcript: transcript.trim() });

      await db
        .update(schema.commercialAnalyses)
        .set({
          overallScore: result.overallScore,
          scoreBreakdown: result.breakdown,
          scoreSummary: result.summary,
          extractedData: result.extracted,
          status: 'concluido',
          analyzedBy: 'gpt-4o',
          updatedAt: new Date(),
        })
        .where(eq(schema.commercialAnalyses.id, analysisId));

      console.log(`  ✓ done  score=${result.overallScore}  ${title}`);
      outcomes.push({
        kind: 'analyzed',
        file: filename,
        title,
        callDate,
        id: analysisId,
        score: result.overallScore,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.commercialAnalyses)
        .set({ status: 'erro', errorMessage: msg, updatedAt: new Date() })
        .where(eq(schema.commercialAnalyses.id, analysisId));

      console.error(`  ✗ error                     ${title}: ${msg}`);
      outcomes.push({ kind: 'failed', file: filename, title, error: msg });
    }

    processed++;
  }

  writeReport();
  await db.end?.(); // postgres.js cleanup (method exists on the raw client, not drizzle)
  console.log('\nDone. Report: apps/crm/tmp/analise-closer-report.md');
}

function writeReport() {
  const analyzed = outcomes.filter((o) => o.kind === 'analyzed') as Extract<
    BatchOutcome,
    { kind: 'analyzed' }
  >[];
  const skipped = outcomes.filter((o) => o.kind === 'skipped');
  const failed = outcomes.filter((o) => o.kind === 'failed') as Extract<
    BatchOutcome,
    { kind: 'failed' }
  >[];

  const avgScore =
    analyzed.length > 0
      ? Math.round(analyzed.reduce((sum, a) => sum + a.score, 0) / analyzed.length)
      : null;

  const lines: string[] = [
    '# Relatório — analyze-closer-batch',
    '',
    `**Data:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    `**Arquivos processados:** ${outcomes.length}`,
    `**Analisados:** ${analyzed.length}`,
    `**Ignorados (já existentes):** ${skipped.length}`,
    `**Falhas:** ${failed.length}`,
    ...(avgScore !== null ? [`**Score médio (lote):** ${avgScore}`] : []),
    '',
  ];

  if (analyzed.length > 0) {
    lines.push('## Análises concluídas', '');
    lines.push('| Call | Data | Score | ID |');
    lines.push('|------|------|-------|----|');
    for (const a of analyzed) {
      lines.push(`| ${a.title} | ${a.callDate} | ${a.score} | ${a.id} |`);
    }
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('## Falhas', '');
    for (const f of failed) {
      lines.push(`- **${f.title}** (${f.file}): ${f.error}`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('## Ignorados (idempotência)', '');
    for (const s of skipped) {
      lines.push(`- ${s.file}`);
    }
    lines.push('');
  }

  const reportDir = resolve(__dirname, '../tmp');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, 'analise-closer-report.md'), lines.join('\n'), 'utf-8');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
