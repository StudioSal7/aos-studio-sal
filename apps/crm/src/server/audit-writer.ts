/**
 * Transactional audit helpers.
 *
 * All writes happen inside the caller's transaction so the mutation and its
 * audit trail are always consistent.
 *
 * Stage changes go to `lead_stage_history`.
 * The audited scalar fields (owner, value, loss reason, fake flag, soft delete)
 * go to `lead_field_audit`.
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import * as schema from '@repo/db/schema';

type TxClient = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export async function writeStageHistory(
  tx: TxClient,
  params: {
    leadId: string;
    fromStageId: string | null;
    toStageId: string;
    durationInPreviousSeconds: number | null;
    changedBy: string;
  },
) {
  await tx.insert(schema.leadStageHistory).values({
    leadId: params.leadId,
    fromStageId: params.fromStageId ?? undefined,
    toStageId: params.toStageId,
    durationInPreviousSeconds: params.durationInPreviousSeconds ?? undefined,
    changedBy: params.changedBy,
  });
}

// Only these fields are audited — keep in sync with PRD §Implementation Decisions/Audit.
const AUDITED_FIELDS = new Set([
  'sdrId',
  'closerId',
  'valorProposto',
  'formaPagamentoNegociada',
  'motivoPerdaId',
  'marcadoFake',
  'deletedAt',
]);

type FieldAuditEntry = {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

export async function writeFieldAudit(
  tx: TxClient,
  params: {
    leadId: string;
    changes: Record<string, { from: unknown; to: unknown }>;
    changedBy: string;
    requestId?: string;
  },
) {
  const entries: FieldAuditEntry[] = [];

  for (const [field, { from, to }] of Object.entries(params.changes)) {
    if (!AUDITED_FIELDS.has(field)) continue;
    const oldVal = from == null ? null : String(from);
    const newVal = to == null ? null : String(to);
    if (oldVal === newVal) continue;
    entries.push({ fieldName: field, oldValue: oldVal, newValue: newVal });
  }

  if (entries.length === 0) return;

  await tx.insert(schema.leadFieldAudit).values(
    entries.map((e) => ({
      leadId: params.leadId,
      fieldName: e.fieldName,
      oldValue: e.oldValue,
      newValue: e.newValue,
      changedBy: params.changedBy,
      requestId: params.requestId ?? null,
    })),
  );
}
