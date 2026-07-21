// Rotina de sincronização da ponte de receita — usa o banco (não é um módulo
// puro; a lógica de mapeamento em si mora em revenue-bridge-mapper, testada).
// Compartilhada entre a action owner-only e o cron (nenhum dos dois duplica
// a lógica). Idempotente via índice único parcial em financial_entries.

import { and, desc, eq, isNull, notInArray } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { mapHotmartSaleToEntry, mapLeadPaidToEntry } from '@/server/lib/revenue-bridge-mapper/index';

export interface RevenueBridgeSyncResult {
  hotmartCreated: number;
  leadsCreated: number;
}

async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.financialCategories.id })
    .from(schema.financialCategories)
    .where(eq(schema.financialCategories.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function getDefaultAccountId(): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.financialAccounts.id })
    .from(schema.financialAccounts)
    .where(eq(schema.financialAccounts.active, true))
    .limit(1);
  return row?.id ?? null;
}

async function alreadyBridgedIds(
  originSource: 'hotmart_sale' | 'lead_paid',
): Promise<string[]> {
  const column =
    originSource === 'hotmart_sale'
      ? schema.financialEntries.originHotmartSaleId
      : schema.financialEntries.originLeadId;
  const rows = await db
    .select({ id: column })
    .from(schema.financialEntries)
    .where(eq(schema.financialEntries.originSource, originSource));
  return rows.map((r) => r.id).filter((id): id is string => id !== null);
}

async function resolvePaidCompetenceDate(leadId: string, fallback: Date): Promise<string> {
  const [paidStage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, 'paid'))
    .limit(1);

  if (paidStage) {
    const [transition] = await db
      .select({ changedAt: schema.leadStageHistory.changedAt })
      .from(schema.leadStageHistory)
      .where(
        and(eq(schema.leadStageHistory.leadId, leadId), eq(schema.leadStageHistory.toStageId, paidStage.id)),
      )
      .orderBy(desc(schema.leadStageHistory.changedAt))
      .limit(1);
    if (transition) return transition.changedAt.toISOString().slice(0, 10);
  }

  return fallback.toISOString().slice(0, 10);
}

export async function runRevenueBridgeSync(
  actorUserId: string | null,
): Promise<RevenueBridgeSyncResult | { error: string }> {
  const [hotmartCategoryId, mentoriaCategoryId, defaultAccountId] = await Promise.all([
    getCategoryIdBySlug('receita-hotmart'),
    getCategoryIdBySlug('receita-mentoria'),
    getDefaultAccountId(),
  ]);
  if (!hotmartCategoryId || !mentoriaCategoryId) {
    return { error: 'Plano de contas incompleto — rode o seed do módulo financeiro.' };
  }

  // ── Hotmart ──────────────────────────────────────────────────────────────
  const bridgedSaleIds = await alreadyBridgedIds('hotmart_sale');
  const pendingSales = await db
    .select({
      id: schema.salSales.id,
      purchasedAt: schema.salSales.purchasedAt,
      commissionCents: schema.salSales.commissionCents,
    })
    .from(schema.salSales)
    .where(
      bridgedSaleIds.length > 0
        ? and(eq(schema.salSales.status, 'approved'), notInArray(schema.salSales.id, bridgedSaleIds))
        : eq(schema.salSales.status, 'approved'),
    );

  let hotmartCreated = 0;
  for (const sale of pendingSales) {
    const draft = mapHotmartSaleToEntry(sale, hotmartCategoryId, defaultAccountId);
    const result = await db
      .insert(schema.financialEntries)
      .values({ ...draft, createdBy: actorUserId })
      .onConflictDoNothing({ target: schema.financialEntries.originHotmartSaleId })
      .returning({ id: schema.financialEntries.id });
    if (result.length > 0) hotmartCreated += 1;
  }

  // ── Leads pagos (mentoria/consultoria/assessoria) ───────────────────────
  const [paidStage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, 'paid'))
    .limit(1);

  let leadsCreated = 0;
  if (paidStage) {
    const bridgedLeadIds = await alreadyBridgedIds('lead_paid');
    const pendingLeads = await db
      .select({
        id: schema.leads.id,
        valorProposto: schema.leads.valorProposto,
        updatedAt: schema.leads.updatedAt,
      })
      .from(schema.leads)
      .where(
        bridgedLeadIds.length > 0
          ? and(
              eq(schema.leads.stageId, paidStage.id),
              notInArray(schema.leads.id, bridgedLeadIds),
              isNull(schema.leads.deletedAt),
            )
          : and(eq(schema.leads.stageId, paidStage.id), isNull(schema.leads.deletedAt)),
      );

    for (const lead of pendingLeads) {
      const competenceDate = await resolvePaidCompetenceDate(lead.id, lead.updatedAt);
      const draft = mapLeadPaidToEntry(lead, competenceDate, mentoriaCategoryId);
      if (!draft) continue;

      const result = await db
        .insert(schema.financialEntries)
        .values({ ...draft, createdBy: actorUserId })
        .onConflictDoNothing({ target: schema.financialEntries.originLeadId })
        .returning({ id: schema.financialEntries.id });
      if (result.length > 0) leadsCreated += 1;
    }
  }

  return { hotmartCreated, leadsCreated };
}
