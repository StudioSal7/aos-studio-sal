'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  runCloserAnalysis,
  runSdrAnalysis,
  CLOSER_RUBRIC_VERSION,
  SDR_RUBRIC_VERSION,
} from '@repo/commercial';
import { requireAuth } from '@/server/auth';
import type { ActionResult } from './leads';
import { getLeadByWhatsappDigits, searchLeadsForSelector } from '@/server/queries/commercial';
import {
  findChats,
  findMessages,
  remoteJidToDigits,
  resolveRemoteJid,
} from '@/server/lib/evolution-client';
import { buildSdrThread } from '@/server/lib/evolution-thread-builder';

// ─── Closer ─────────────────────────────────────────────────────────────────

type AnalyzeCloserInput = {
  title: string;
  callDate: string; // YYYY-MM-DD
  transcript: string;
  durationMinutes?: number;
  leadId?: string;
  closerId?: string;
};

export async function analyzeCloserAction(
  input: AnalyzeCloserInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAuth();

  if (!input.title.trim()) return { ok: false, error: 'Título obrigatório.' };
  if (!input.transcript.trim()) return { ok: false, error: 'Transcrição obrigatória.' };
  if (!input.callDate) return { ok: false, error: 'Data da call obrigatória.' };

  // Insere registro pendente para feedback imediato na UI.
  const [inserted] = await db
    .insert(schema.commercialAnalyses)
    .values({
      analyzer: 'closer',
      leadId: input.leadId ?? null,
      closerId: input.closerId ?? null,
      title: input.title.trim(),
      callDate: input.callDate,
      sourceType: 'fechamento',
      transcript: input.transcript.trim(),
      durationMinutes: input.durationMinutes ?? null,
      status: 'processando',
      rubricVersion: CLOSER_RUBRIC_VERSION,
      createdBy: auth.userId,
    })
    .returning({ id: schema.commercialAnalyses.id });

  if (!inserted) return { ok: false, error: 'Falha ao criar registro.' };
  const analysisId = inserted.id;

  try {
    const result = await runCloserAnalysis({ transcript: input.transcript.trim() });

    await db
      .update(schema.commercialAnalyses)
      .set({
        overallScore: result.overallScore,
        // Dossiê de método completo (detecção + 7 blocos + dossiê qualitativo).
        scoreBreakdown: result.dossier,
        scoreSummary: result.summary,
        extractedData: result.extracted,
        status: 'concluido',
        analyzedBy: result.compressed ? `${result.model} (comprimido)` : result.model,
        updatedAt: new Date(),
      })
      .where(eq(schema.commercialAnalyses.id, analysisId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    await db
      .update(schema.commercialAnalyses)
      .set({ status: 'erro', errorMessage: msg, updatedAt: new Date() })
      .where(eq(schema.commercialAnalyses.id, analysisId));
    return { ok: false, error: `Análise falhou: ${msg}` };
  }

  revalidatePath('/analise/closer');
  return { ok: true, data: { id: analysisId } };
}

export async function deleteAnalysisAction(id: string): Promise<ActionResult> {
  const auth = await requireAuth();
  if (auth.role !== 'owner') return { ok: false, error: 'Sem permissão.' };

  await db
    .delete(schema.commercialAnalyses)
    .where(eq(schema.commercialAnalyses.id, id));

  revalidatePath('/analise/closer');
  revalidatePath('/analise/sdr');
  return { ok: true };
}

// ─── SDR (pull sob demanda via Evolution API) ────────────────────────────────

const SDR_PULL_LIMIT = 500;

/** Persiste o resultado SDR e devolve o id. Compartilhado pelas duas portas. */
async function persistSdrAnalysis(args: {
  title: string;
  thread: string;
  leadId: string | null;
  createdBy: string;
}): Promise<ActionResult<{ id: string }>> {
  const today = new Date().toISOString().slice(0, 10);

  const [inserted] = await db
    .insert(schema.commercialAnalyses)
    .values({
      analyzer: 'sdr',
      leadId: args.leadId,
      title: args.title,
      callDate: today,
      sourceType: 'whatsapp',
      transcript: args.thread,
      status: 'processando',
      rubricVersion: SDR_RUBRIC_VERSION,
      createdBy: args.createdBy,
    })
    .returning({ id: schema.commercialAnalyses.id });

  if (!inserted) return { ok: false, error: 'Falha ao criar registro.' };
  const analysisId = inserted.id;

  try {
    const result = await runSdrAnalysis({ thread: args.thread });

    // Conversa que não é de pré-venda SDR → marca 'nao_aplicavel' (fora dos KPIs).
    if (!result.applicable) {
      await db
        .update(schema.commercialAnalyses)
        .set({
          status: 'nao_aplicavel',
          errorMessage: result.applicabilityReason ?? 'Conversa não é de pré-venda SDR.',
          analyzedBy: 'gpt-4o',
          updatedAt: new Date(),
        })
        .where(eq(schema.commercialAnalyses.id, analysisId));

      revalidatePath('/analise/sdr');
      return { ok: true, data: { id: analysisId } };
    }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    await db
      .update(schema.commercialAnalyses)
      .set({ status: 'erro', errorMessage: msg, updatedAt: new Date() })
      .where(eq(schema.commercialAnalyses.id, analysisId));
    return { ok: false, error: `Análise falhou: ${msg}` };
  }

  revalidatePath('/analise/sdr');
  return { ok: true, data: { id: analysisId } };
}

/** Porta 1: analisa a conversa de WhatsApp a partir do lead (usa o whatsapp dele). */
export async function analyzeSdrFromLeadAction(
  leadId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAuth();

  const [lead] = await db
    .select({ id: schema.leads.id, name: schema.leads.name, whatsappE164: schema.leads.whatsappE164 })
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);

  if (!lead) return { ok: false, error: 'Lead não encontrado.' };
  if (!lead.whatsappE164) return { ok: false, error: 'Lead sem WhatsApp cadastrado.' };

  let thread: string;
  try {
    const remoteJid = await resolveRemoteJid(lead.whatsappE164);
    if (!remoteJid) {
      return { ok: false, error: 'Nenhuma conversa encontrada no WhatsApp para este número.' };
    }
    const messages = await findMessages(remoteJid, { limit: SDR_PULL_LIMIT });
    thread = buildSdrThread(messages, { leadName: lead.name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Falha ao puxar conversa: ${msg}` };
  }

  const result = await persistSdrAnalysis({
    title: `SDR – ${lead.name ?? 'lead'}`,
    thread,
    leadId: lead.id,
    createdBy: auth.userId,
  });

  if (result.ok) revalidatePath(`/leads/${leadId}`);
  return result;
}

/** Porta 2: analisa a conversa a partir de um chat escolhido na lista da instância. */
export async function analyzeSdrFromChatAction(input: {
  remoteJid: string;
  displayName?: string;
  phoneDigits?: string;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAuth();
  if (!input.remoteJid) return { ok: false, error: 'remoteJid obrigatório.' };

  // Casa com um lead pelos dígitos do número (telefone real, não o @lid opaco).
  const digits = input.phoneDigits || remoteJidToDigits(input.remoteJid);
  const matched = digits ? await getLeadByWhatsappDigits(digits) : null;

  let thread: string;
  try {
    const messages = await findMessages(input.remoteJid, { limit: SDR_PULL_LIMIT });
    thread = buildSdrThread(messages, { leadName: matched?.name ?? input.displayName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Falha ao puxar conversa: ${msg}` };
  }

  const title = matched?.name || input.displayName || digits || input.remoteJid;
  return persistSdrAnalysis({
    title: `SDR – ${title}`,
    thread,
    leadId: matched?.id ?? null,
    createdBy: auth.userId,
  });
}

export type EvolutionChatItem = {
  remoteJid: string;
  displayName: string | null;
  phoneDigits: string;
  lastMessageAt: number | null;
  leadId: string | null;
  leadName: string | null;
};

/** Lista os chats individuais da instância (Porta 2), casando cada um com leads. */
export async function listEvolutionChatsAction(): Promise<ActionResult<EvolutionChatItem[]>> {
  await requireAuth();

  let chats;
  try {
    chats = await findChats();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Falha ao listar conversas: ${msg}` };
  }

  // Só conversas individuais (descarta grupos @g.us e broadcast).
  const individual = chats.filter((c) => {
    const jid = c.remoteJid || c.id || '';
    return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
  });

  const items: EvolutionChatItem[] = await Promise.all(
    individual.map(async (c) => {
      const jid = c.remoteJid || c.id;
      // Telefone real: do próprio JID (@s.whatsapp.net) ou do remoteJidAlt (@lid).
      const alt = c.lastMessage?.key?.remoteJidAlt;
      const phoneDigits = jid.endsWith('@lid') && alt ? remoteJidToDigits(alt) : remoteJidToDigits(jid);
      const matched = phoneDigits ? await getLeadByWhatsappDigits(phoneDigits) : null;

      return {
        remoteJid: jid,
        displayName: c.pushName ?? c.name ?? null,
        phoneDigits,
        lastMessageAt: c.lastMessage?.messageTimestamp ?? null,
        leadId: matched?.id ?? null,
        leadName: matched?.name ?? null,
      };
    }),
  );

  // Mais recentes primeiro.
  items.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  return { ok: true, data: items };
}

// Busca de leads para o seletor no formulário (Server Action para o client component).
export async function searchLeadsAction(q: string) {
  await requireAuth();
  return searchLeadsForSelector(q);
}
