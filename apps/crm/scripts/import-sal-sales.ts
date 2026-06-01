#!/usr/bin/env tsx
/**
 * Import script for the Hotmart sales CSV (Método SAL — produto 6721435).
 *
 * Usage:
 *   pnpm --filter crm import-sal-sales -- <path-to-csv>
 *
 * Requires DATABASE_URL in the environment (loaded from apps/crm/.env.local
 * via tsx --env-file).
 *
 * Safe to re-run: rows are upserted by transaction_id, so status changes
 * (e.g. approved → refunded) are reflected on subsequent imports.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  parseHotmartCsvText,
  type ParsedSale,
} from '../src/server/lib/hotmart-csv-parser/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// pnpm forwards `--` as a literal arg; strip it so the path is always argv[2..n]
const args = process.argv.slice(2).filter((a) => a !== '--');
const csvPath = args[0];
if (!csvPath) {
  console.error('Usage: pnpm --filter crm import-sal-sales -- <path-to-csv>');
  process.exit(1);
}
const resolvedPath = resolve(csvPath);

type ImportOutcome =
  | { kind: 'inserted'; sale: ParsedSale }
  | { kind: 'updated'; sale: ParsedSale }
  | { kind: 'failed'; reason: string; sale: ParsedSale };

async function importSale(sale: ParsedSale): Promise<ImportOutcome> {
  try {
    const inserted = await db
      .insert(schema.salSales)
      .values({
        transactionId: sale.transactionId,
        purchasedAt: sale.purchasedAt,
        rawStatus: sale.rawStatus,
        status: sale.status,
        buyerName: sale.buyerName,
        buyerEmail: sale.buyerEmail,
        buyerPhoneRaw: sale.buyerPhoneRaw,
        buyerPhoneE164: sale.buyerPhoneE164,
        productName: sale.productName,
        productCode: sale.productCode,
        commissionCents: sale.commissionCents,
        utmSource: sale.utmSource,
        utmMedium: sale.utmMedium,
        utmCampaign: sale.utmCampaign,
        utmTerm: sale.utmTerm,
        utmContent: sale.utmContent,
        trafficType: sale.trafficType,
        rawRow: sale.rawRow,
      })
      .onConflictDoUpdate({
        target: schema.salSales.transactionId,
        set: {
          rawStatus: sale.rawStatus,
          status: sale.status,
          commissionCents: sale.commissionCents,
          utmSource: sale.utmSource,
          utmMedium: sale.utmMedium,
          utmCampaign: sale.utmCampaign,
          utmTerm: sale.utmTerm,
          utmContent: sale.utmContent,
          trafficType: sale.trafficType,
          rawRow: sale.rawRow,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: schema.salSales.id,
        createdAt: schema.salSales.createdAt,
        updatedAt: schema.salSales.updatedAt,
      });

    const row = inserted[0];
    if (!row) throw new Error('upsert returned no rows');
    // Treat as "inserted" if createdAt == updatedAt (within 1s); otherwise "updated"
    const isNew = Math.abs(row.createdAt.getTime() - row.updatedAt.getTime()) < 1000;
    return { kind: isNew ? 'inserted' : 'updated', sale };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'failed', reason: message, sale };
  }
}

function buildReport(
  csvPath: string,
  parseFailures: Array<{ row: Record<string, string>; reason: string }>,
  duplicateTransactionIds: string[],
  outcomes: ImportOutcome[],
): string {
  const inserted = outcomes.filter((o): o is Extract<ImportOutcome, { kind: 'inserted' }> => o.kind === 'inserted');
  const updated = outcomes.filter((o): o is Extract<ImportOutcome, { kind: 'updated' }> => o.kind === 'updated');
  const failed = outcomes.filter((o): o is Extract<ImportOutcome, { kind: 'failed' }> => o.kind === 'failed');

  const byStatus = new Map<string, number>();
  for (const o of [...inserted, ...updated]) {
    byStatus.set(o.sale.status, (byStatus.get(o.sale.status) ?? 0) + 1);
  }

  const totalRevenueCents = [...inserted, ...updated]
    .filter((o) => o.sale.status === 'approved')
    .reduce((sum, o) => sum + o.sale.commissionCents, 0);

  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const lines: string[] = [
    `# Relatório de Import — Vendas SAL (Hotmart)`,
    ``,
    `**Arquivo:** \`${csvPath}\``,
    `**Executado em:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário SP)`,
    ``,
    `## Resumo`,
    ``,
    `| | Quantidade |`,
    `|---|---|`,
    `| 🆕 Inseridos | ${inserted.length} |`,
    `| 🔄 Atualizados (já existiam) | ${updated.length} |`,
    `| ❌ Falhas de parse | ${parseFailures.length} |`,
    `| ❌ Falhas de inserção | ${failed.length} |`,
    `| 📋 Duplicatas intra-arquivo (transaction_id) | ${duplicateTransactionIds.length} |`,
    ``,
    `## Por status normalizado`,
    ``,
    `| Status | Quantidade |`,
    `|---|---|`,
    ...[...byStatus.entries()].map(([s, n]) => `| ${s} | ${n} |`),
    ``,
    `**Receita das aprovadas:** ${fmtBRL(totalRevenueCents)}`,
    ``,
  ];

  if (parseFailures.length > 0) {
    lines.push(`## Falhas de parse`);
    lines.push(``);
    for (const f of parseFailures) {
      const tx = f.row['Transacao_prod'] ?? '(sem id)';
      lines.push(`- \`${tx}\` — razão: ${f.reason}`);
    }
    lines.push(``);
  }

  if (duplicateTransactionIds.length > 0) {
    lines.push(`## Duplicatas no arquivo`);
    lines.push(``);
    for (const id of duplicateTransactionIds) {
      lines.push(`- \`${id}\``);
    }
    lines.push(``);
  }

  if (failed.length > 0) {
    lines.push(`## Falhas de inserção`);
    lines.push(``);
    for (const o of failed) {
      lines.push(`- \`${o.sale.transactionId}\` — ${o.reason}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

async function main() {
  console.log(`📥 Lendo CSV: ${resolvedPath}`);

  const text = readFileSync(resolvedPath, 'utf-8');
  const { sales, failures, duplicateTransactionIds } = parseHotmartCsvText(text);

  console.log(
    `📊 Parse: ${sales.length} vendas válidas, ${failures.length} falhas, ${duplicateTransactionIds.length} ids duplicados no arquivo`,
  );

  const outcomes: ImportOutcome[] = [];
  let i = 0;
  for (const sale of sales) {
    i++;
    if (i % 20 === 0) process.stdout.write(`   ${i}/${sales.length}...\r`);
    outcomes.push(await importSale(sale));
  }
  process.stdout.write('\n');

  const inserted = outcomes.filter((o) => o.kind === 'inserted').length;
  const updated = outcomes.filter((o) => o.kind === 'updated').length;
  const failed = outcomes.filter((o) => o.kind === 'failed').length;

  console.log(`✅ Inseridos: ${inserted} | 🔄 Atualizados: ${updated} | ❌ Falhas: ${failed}`);

  const report = buildReport(resolvedPath, failures, duplicateTransactionIds, outcomes);

  const tmpDir = resolve(__dirname, '..', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const reportPath = resolve(tmpDir, 'sal-import-report.md');
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`📄 Relatório: ${reportPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
