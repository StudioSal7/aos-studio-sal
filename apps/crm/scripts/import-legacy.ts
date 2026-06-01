#!/usr/bin/env tsx
/**
 * Import script for the legacy Respondi/Google-Sheets CSV.
 *
 * Usage:
 *   pnpm tsx scripts/import-legacy.ts <path-to-csv>
 *
 * Requires DATABASE_URL in the environment (same as the app).
 * Outputs a human-readable report to tmp/import-report.md.
 *
 * Safe to re-run: leads that already exist (by email or whatsapp) are
 * recorded as duplicates rather than inserted again.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, or } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  parseLegacyCsvText,
  type ParsedLegacyLead,
  type CsvColumnMap,
} from '../src/server/lib/legacy-csv-parser/index';
import { findDuplicateLead } from '../src/server/lib/dedup-matcher/index';

const RESPONDI_COLUMN_MAP: CsvColumnMap = {
  nome: 'Primeiro, queremos te conhecer um pouco melhor! Como você se chama?',
  apelido: 'Como você gostaria de ser chamada?',
  email: '___, qual o seu melhor email?',
  whatsapp: 'Qual o seu melhor celular?',
  instagram: 'Qual seu @ oficial nas redes sociais?',
  status: '',
  observacoes: 'Nos conte um pouco sobre seu trabalho e o momento atual da sua jornada, ___?',
  data: 'Data',
  fonte: 'Como você nos conheceu, ___?',
  idade: 'Qual a sua idade',
  renda: 'Em seu lar, qual é a renda média mensal?',
  orcamento:
    'Qual é seu orçamento atual para investir em sua marca pessoal com uma das melhores agências boutiques do mercado?',
  tempoNicho: 'Há quanto tempo você está nesse nicho?',
  abordagem: 'Qual dessas abordagens você sente que tem mais ressonância com seu momento agora?',
  pontuacao: 'Pontuação',
  respondentId: 'ID',
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmTerm: 'utm_term',
  utmContent: 'utm_content',
};

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Argument parsing ----

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: pnpm tsx scripts/import-legacy.ts <path-to-csv>');
  process.exit(1);
}

const resolvedPath = resolve(csvPath);

// ---- Stage / loss-reason ID lookup ----

async function getStageId(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Stage not found: "${slug}". Run pnpm db:seed first.`);
  return row.id;
}

async function getLossReasonId(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: schema.leadLossReasons.id })
    .from(schema.leadLossReasons)
    .where(eq(schema.leadLossReasons.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Loss reason not found: "${slug}". Run pnpm db:seed first.`);
  return row.id;
}

// Pre-load all stage, loss-reason, and source IDs to avoid N+1 on each row.
async function buildLookups() {
  const stages = await db.select({ id: schema.leadStages.id, slug: schema.leadStages.slug }).from(schema.leadStages);
  const lossReasons = await db.select({ id: schema.leadLossReasons.id, slug: schema.leadLossReasons.slug }).from(schema.leadLossReasons);
  const sources = await db.select({ id: schema.leadSources.id, slug: schema.leadSources.slug }).from(schema.leadSources);
  return {
    stageBySlug: new Map(stages.map((s) => [s.slug, s.id])),
    lossReasonBySlug: new Map(lossReasons.map((r) => [r.slug, r.id])),
    sourceBySlug: new Map(sources.map((s) => [s.slug, s.id])),
  };
}

// ---- Import logic ----

type ImportOutcome =
  | { kind: 'imported'; leadId: string; lead: ParsedLegacyLead }
  | { kind: 'duplicate'; existingLeadId: string; matchedOn: string[]; lead: ParsedLegacyLead }
  | { kind: 'failed'; reason: string; lead: ParsedLegacyLead };

async function importLead(
  lead: ParsedLegacyLead,
  lookups: Awaited<ReturnType<typeof buildLookups>>,
): Promise<ImportOutcome> {
  // Check for duplicate
  const dupResult = await findDuplicateLead(
    { email: lead.email, whatsappE164: lead.whatsappE164 },
    db as Parameters<typeof findDuplicateLead>[1],
  );

  if (dupResult.match) {
    // Log the duplicate intake but don't re-insert
    await db.insert(schema.leadIntakeLog).values({
      source: 'legacy_csv_import',
      payloadRaw: lead as unknown as Record<string, unknown>,
      payloadParsed: lead as unknown as Record<string, unknown>,
      leadId: dupResult.leadId,
      status: 'duplicate_upsert',
    });
    return { kind: 'duplicate', existingLeadId: dupResult.leadId, matchedOn: dupResult.matchedOn, lead };
  }

  const stageId = lookups.stageBySlug.get(lead.stageSlug);
  if (!stageId) {
    return { kind: 'failed', reason: `Unknown stage slug: ${lead.stageSlug}`, lead };
  }

  const lossReasonId = lead.lossReasonSlug
    ? lookups.lossReasonBySlug.get(lead.lossReasonSlug)
    : null;

  if (lead.lossReasonSlug && !lossReasonId) {
    return { kind: 'failed', reason: `Unknown loss reason slug: ${lead.lossReasonSlug}`, lead };
  }

  const leadSourceId = lead.leadSourceSlug
    ? (lookups.sourceBySlug.get(lead.leadSourceSlug) ?? null)
    : null;

  try {
    const [inserted] = await db
      .insert(schema.leads)
      .values({
        name: lead.name,
        nickname: lead.nickname,
        email: lead.email,
        whatsappE164: lead.whatsappE164,
        instagramHandle: lead.instagramHandle,
        notes: lead.notes,
        stageId,
        motivoPerdaId: lossReasonId ?? undefined,
        leadSourceId: leadSourceId ?? undefined,
        leadSourceOther: lead.leadSourceOther,
        idadeFaixa: lead.idadeFaixa,
        tempoNoNichoFaixa: lead.tempoNoNichoFaixa,
        abordagemPreferida: lead.abordagemPreferida,
        rendaFaixa: lead.rendaFaixa,
        orcamentoFaixa: lead.orcamentoFaixa,
        pontuacao: lead.pontuacao,
        intakeRespondentId: lead.intakeRespondentId,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        utmTerm: lead.utmTerm,
        utmContent: lead.utmContent,
        needsManualReview: lead.needsManualReview,
        manualReviewReason: lead.manualReviewReason,
        createdAt: lead.receivedAt,
        updatedAt: lead.receivedAt,
      })
      .returning({ id: schema.leads.id });

    if (!inserted) throw new Error('Insert returned no rows');

    // Log the intake
    await db.insert(schema.leadIntakeLog).values({
      source: 'legacy_csv_import',
      payloadRaw: lead as unknown as Record<string, unknown>,
      payloadParsed: lead as unknown as Record<string, unknown>,
      leadId: inserted.id,
      status: 'ok',
    });

    // Create placeholder meeting if needed
    if (lead.createMeeting && lead.meetingStatus) {
      await db.insert(schema.meetings).values({
        leadId: inserted.id,
        scheduledAt: lead.receivedAt,
        status: lead.meetingStatus,
        needsConfirmation: false,
      });
    }

    return { kind: 'imported', leadId: inserted.id, lead };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'failed', reason: message, lead };
  }
}

// ---- Report generation ----

function buildReport(
  csvPath: string,
  parseFailures: Array<{ row: Record<string, string>; reason: string }>,
  duplicateEmailGroups: string[],
  duplicateWhatsappGroups: string[],
  outcomes: ImportOutcome[],
): string {
  const imported = outcomes.filter((o) => o.kind === 'imported');
  const duplicates = outcomes.filter((o) => o.kind === 'duplicate');
  const failed = outcomes.filter((o) => o.kind === 'failed');
  const manualReview = imported.filter(
    (o) => o.kind === 'imported' && o.lead.needsManualReview,
  );

  const lines: string[] = [
    `# Relatório de Import Legado`,
    ``,
    `**Arquivo:** \`${csvPath}\``,
    `**Executado em:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário SP)`,
    ``,
    `## Resumo`,
    ``,
    `| | Quantidade |`,
    `|---|---|`,
    `| ✅ Importados | ${imported.length} |`,
    `| 🔁 Duplicatas (já existiam no DB) | ${duplicates.length} |`,
    `| 👀 Importados → revisão manual | ${manualReview.length} |`,
    `| ❌ Falhas de parse (descartados) | ${parseFailures.length} |`,
    `| ❌ Falhas de inserção | ${failed.length} |`,
    `| 📋 Duplicatas intra-arquivo (email) | ${duplicateEmailGroups.length} |`,
    `| 📋 Duplicatas intra-arquivo (WhatsApp) | ${duplicateWhatsappGroups.length} |`,
    ``,
  ];

  if (manualReview.length > 0) {
    lines.push(`## Leads importados → revisão manual obrigatória`);
    lines.push(``);
    for (const o of manualReview) {
      if (o.kind !== 'imported') continue;
      lines.push(
        `- **${o.lead.name}** (${o.lead.email ?? o.lead.whatsappE164}) — status legado: "${o.lead.rawStatus}" — razão: ${o.lead.manualReviewReason}`,
      );
    }
    lines.push(``);
  }

  if (duplicates.length > 0) {
    lines.push(`## Duplicatas detectadas (já existiam no DB)`);
    lines.push(``);
    for (const o of duplicates) {
      if (o.kind !== 'duplicate') continue;
      lines.push(
        `- **${o.lead.name}** — matched on: [${o.matchedOn.join(', ')}] → lead_id: \`${o.existingLeadId}\``,
      );
    }
    lines.push(``);
  }

  if (duplicateEmailGroups.length > 0 || duplicateWhatsappGroups.length > 0) {
    lines.push(`## Duplicatas intra-arquivo (mesma submissão 2x)`);
    lines.push(``);
    for (const e of duplicateEmailGroups) lines.push(`- Email duplicado: \`${e}\``);
    for (const w of duplicateWhatsappGroups) lines.push(`- WhatsApp duplicado: \`${w}\``);
    lines.push(``);
  }

  if (parseFailures.length > 0) {
    lines.push(`## Falhas de parse (linhas descartadas)`);
    lines.push(``);
    for (const f of parseFailures) {
      const name = f.row['Nome'] ?? '(sem nome)';
      lines.push(`- **${name}** — razão: \`${f.reason}\``);
    }
    lines.push(``);
  }

  if (failed.length > 0) {
    lines.push(`## Falhas de inserção no banco`);
    lines.push(``);
    for (const o of failed) {
      if (o.kind !== 'failed') continue;
      lines.push(`- **${o.lead.name}** — erro: ${o.reason}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

// ---- Main ----

async function main() {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset) {
    console.log('🗑  Modo --reset: limpando lead_stage_history, lead_field_audit, lead_action_log, lead_intake_log, meetings, leads...');
    await db.delete(schema.leadStageHistory);
    await db.delete(schema.leadFieldAudit);
    await db.delete(schema.leadActionLog);
    await db.delete(schema.leadIntakeLog);
    await db.delete(schema.meetings);
    await db.delete(schema.leads);
    console.log('✅ Tabelas limpas');
  }

  console.log(`📥 Lendo CSV: ${resolvedPath}`);

  const text = readFileSync(resolvedPath, 'utf-8');
  const { leads, failures, duplicateEmailGroups, duplicateWhatsappGroups } =
    parseLegacyCsvText(text, RESPONDI_COLUMN_MAP);

  console.log(
    `📊 Parse: ${leads.length} leads válidos, ${failures.length} falhas, ${duplicateEmailGroups.length + duplicateWhatsappGroups.length} grupos de duplicata intra-arquivo`,
  );

  const lookups = await buildLookups();

  const outcomes: ImportOutcome[] = [];
  let i = 0;
  for (const lead of leads) {
    i++;
    if (i % 20 === 0) process.stdout.write(`   ${i}/${leads.length}...\r`);
    const outcome = await importLead(lead, lookups);
    outcomes.push(outcome);
  }

  process.stdout.write('\n');

  const imported = outcomes.filter((o) => o.kind === 'imported').length;
  const dups = outcomes.filter((o) => o.kind === 'duplicate').length;
  const failed = outcomes.filter((o) => o.kind === 'failed').length;

  console.log(`✅ Importados: ${imported} | 🔁 Duplicatas: ${dups} | ❌ Falhas: ${failed}`);

  const report = buildReport(
    resolvedPath,
    failures,
    duplicateEmailGroups,
    duplicateWhatsappGroups,
    outcomes,
  );

  const tmpDir = resolve(__dirname, '..', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const reportPath = resolve(tmpDir, 'import-report.md');
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`📄 Relatório: ${reportPath}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
