#!/usr/bin/env tsx
/**
 * Correção pontual do lead Bruna Neiman (bru_tb@hotmail.com).
 *
 * Diagnóstico: a linha 194 do CSV legado não tinha o campo de status inicial
 * (todas as outras começam com "pendente," ou "recusada,"). Isso causou um
 * deslocamento de uma coluna à esquerda no parse, gravando os valores nos
 * campos errados.
 *
 * Fonte da verdade: linha bruta do CSV (verificada manualmente).
 *
 * Uso: pnpm --filter crm fix-shifted-lead
 */

import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

async function run() {
  // Identifica o lead pelo email errado que ficou gravado (era o telefone)
  const [lead] = await db
    .select({ id: schema.leads.id, name: schema.leads.name, email: schema.leads.email })
    .from(schema.leads)
    .where(eq(schema.leads.email, '5511969302292'))
    .limit(1);

  if (!lead) {
    // Tenta pelo intakeRespondentId caso o email já tenha sido corrigido
    const [byRId] = await db
      .select({ id: schema.leads.id, name: schema.leads.name })
      .from(schema.leads)
      .where(eq(schema.leads.intakeRespondentId, '573df258-ce32-4c69-999e-2f7cfb69d805'))
      .limit(1);

    if (!byRId) {
      console.log('Lead não encontrado — provavelmente já foi corrigido.');
      return;
    }
    console.log(`Lead encontrado por respondentId: ${byRId.id} (${byRId.name})`);
    Object.assign(lead ?? {}, byRId);
  }

  console.log(`Corrigindo lead: ${lead!.id} — nome atual: "${lead!.name}" email atual: "${lead!.email}"`);

  // Busca o leadSourceId para "instagram_organico"
  const [sourceRow] = await db
    .select({ id: schema.leadSources.id })
    .from(schema.leadSources)
    .where(eq(schema.leadSources.slug, 'instagram_organico'))
    .limit(1);

  const leadSourceId = sourceRow?.id ?? null;

  await db
    .update(schema.leads)
    .set({
      name: 'Bruna Neiman',
      nickname: 'Bru',
      email: 'bru_tb@hotmail.com',
      whatsappE164: '+5511969302292',
      instagramHandle: 'bru_neiman',
      idadeFaixa: '35_a_44',
      leadSourceId,
      rendaFaixa: 'de R$20.000 a R$30.000 por mês',
      notes: 'Sou servidora pública e quero fazer transição de carreira',
      tempoNoNichoFaixa: 'mais_16',
      abordagemPreferida: 'equipe_constroi',
      orcamentoFaixa: 'entre R$8.000 e R$12.000',
      pontuacao: 17,
      intakeRespondentId: '573df258-ce32-4c69-999e-2f7cfb69d805',
      createdAt: new Date('2026-05-04T01:21:13Z'),
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, lead!.id));

  console.log('✅ Lead corrigido com sucesso.');
  console.log('   nome: Bruna Neiman');
  console.log('   apelido: Bru');
  console.log('   email: bru_tb@hotmail.com');
  console.log('   whatsapp: +5511969302292');
  console.log('   instagram: bru_neiman');
  console.log('   renda: de R$20.000 a R$30.000 por mês');
}

run()
  .catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
