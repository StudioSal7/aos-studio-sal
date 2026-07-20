import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contractStatusEnum, productTipoEnum } from './enums';
import { leads } from './leads';
import { products } from './products';
import { users } from './users';

// Registro de cada geração de contrato (.docx) de um lead pago. O binário em
// si NUNCA é persistido — é gerado on-demand a cada download, casando o
// template atual (Supabase Storage) com o snapshot de `dados` aqui salvo.
// Isso evita PII (CPF/endereço) em repouso duplicada e garante que trocar o
// template no /admin reflita no próximo download, mesmo de um lead antigo.
export const leadContracts = pgTable(
  'lead_contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    // set null (não cascade): apagar um produto do catálogo não deve apagar o
    // histórico de contratos já gerados com ele.
    produtoId: uuid('produto_id').references(() => products.id, { onDelete: 'set null' }),
    // Snapshot do tipo no momento da geração — qual template foi usado, mesmo
    // que o produto mude de tipo depois.
    tipo: productTipoEnum('tipo').notNull(),

    // Snapshot dos dados coletados na hora (nome completo, CPF/CNPJ, endereço,
    // condições de pagamento) — ver ContractCollectedData em contract-data-builder.
    dados: jsonb('dados').$type<Record<string, unknown>>().notNull(),

    status: contractStatusEnum('status').notNull().default('rascunho'),

    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_contracts_lead_idx').on(table.leadId),
    createdAtIdx: index('lead_contracts_created_at_idx').on(table.createdAt),
  }),
);

export type LeadContract = typeof leadContracts.$inferSelect;
export type NewLeadContract = typeof leadContracts.$inferInsert;
