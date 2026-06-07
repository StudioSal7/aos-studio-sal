#!/usr/bin/env tsx
/**
 * Lote de análise SDR sobre conversas de WhatsApp lidas do store local da Evolution.
 *
 * Uso:
 *   pnpm analyze-sdr-batch                 # lote cheio (até SDR_BATCH_LIMIT, default 15)
 *   SDR_BATCH_LIMIT=2 pnpm analyze-sdr-batch   # dry rápido (recomendado antes do cheio)
 *
 * ── SEGURANÇA (risco de ban de WhatsApp) ──────────────────────────────────────
 * Este script chama SOMENTE findChats() e findMessages() do evolution-client —
 * ambos leem o Postgres da Evolution (POST /chat/findChats, /chat/findMessages).
 * NÃO conecta/desconecta/reinicia a instância nem dispara sync de histórico.
 * findMessages vazio → PULA a conversa; nunca força sync para completar histórico.
 *
 * ── O que faz ─────────────────────────────────────────────────────────────────
 * - findChats() → filtra conversas individuais → casa cada uma com lead pelos
 *   dígitos (tolerando 9º dígito). Prioriza casadas (mais recentes primeiro) e
 *   completa as vagas até SDR_BATCH_LIMIT com individuais recentes sem match.
 * - Idempotente: pula conversa cujo remoteJid já está em commercial_analyses
 *   (source_file) OU cujo lead já tem análise SDR (cobre análises feitas pela UI).
 * - Por conversa: findMessages → buildSdrThread → runSdrAnalysis (gpt-4o) →
 *   persiste em commercial_analyses (analyzer='sdr', rubric_version='sdr-v1').
 *   Não-aplicável (contato frio/recado) → status 'nao_aplicavel', sem nota.
 * - Throttle leve entre análises (default 3s). 429 e finish_reason='length' já
 *   são tratados em @repo/commercial/openai (backoff/Retry-After; truncado = erro).
 * - Relatório em apps/crm/tmp/analise-sdr-report.md + resumo ranqueado no terminal.
 *
 * Requer: DATABASE_URL, OPENAI_API_KEY e EVOLUTION_* no ambiente.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { runSdrAnalysis, SDR_RUBRIC_VERSION } from '@repo/commercial';
import {
  brazilianPhoneVariants,
  findChats,
  findMessages,
  remoteJidToDigits,
  type EvolutionChat,
} from '../src/server/lib/evolution-client';
import { buildSdrThread } from '../src/server/lib/evolution-thread-builder';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leitura é local (store da Evolution) → não precisa dos 65s do closer. Só espaça
// as chamadas gpt-4o para folgar o TPM. 429 já tem backoff em openai.ts.
const THROTTLE_MS = Number(process.env.SDR_BATCH_THROTTLE_MS ?? 3000);
const MAX_BATCH = Number(process.env.SDR_BATCH_LIMIT ?? 15);
const PULL_LIMIT = 500; // mesmo limite do fluxo sob demanda; chats reais têm ~20–35 msgs.
const MIN_MESSAGES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Tipos de seleção / resultado ──────────────────────────────────────────────

type Candidate = {
  remoteJid: string;
  phoneDigits: string;
  displayName: string | null;
  lastMessageAt: number;
  leadId: string | null;
  leadName: string | null;
};

type Outcome =
  | { kind: 'analyzed'; label: string; id: string; score: number; summary: string }
  | { kind: 'nao_aplicavel'; label: string; id: string; reason: string }
  | { kind: 'failed'; label: string; error: string }
  | { kind: 'skipped'; label: string; reason: 'already_analyzed' | 'empty' | 'not_commercial' };

const outcomes: Outcome[] = [];

// ── Helpers de chat ────────────────────────────────────────────────────────────

function isIndividual(chat: EvolutionChat): boolean {
  const jid = chat.remoteJid || chat.id || '';
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

/** Telefone real: do remoteJidAlt quando @lid, senão do próprio JID. */
function phoneDigitsOf(chat: EvolutionChat, jid: string): string {
  const alt = chat.lastMessage?.key?.remoteJidAlt;
  return jid.endsWith('@lid') && alt ? remoteJidToDigits(alt) : remoteJidToDigits(jid);
}

// ── Casamento lead ⇄ conversa (mapa em memória) ─────────────────────────────────
//
// NÃO usamos getLeadByWhatsappDigits: a coluna gerada leads.whatsapp_digits_only
// está com o '+' (bug pré-existente — ela deveria conter só dígitos), então a
// comparação por dígitos puros nunca casa. Aqui derivamos os dígitos do
// whatsapp_e164 com replace(/\D/g, '') (remove o '+' de forma confiável) e
// indexamos todas as variantes de 9º dígito.

type LeadRef = { id: string; name: string | null };

async function buildLeadMatcher(): Promise<Map<string, LeadRef>> {
  const leads = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      whatsappE164: schema.leads.whatsappE164,
    })
    .from(schema.leads)
    .where(and(isNotNull(schema.leads.whatsappE164), isNull(schema.leads.deletedAt)));

  const map = new Map<string, LeadRef>();
  for (const l of leads) {
    const digits = (l.whatsappE164 ?? '').replace(/\D/g, '');
    if (!digits) continue;
    for (const variant of brazilianPhoneVariants(digits)) {
      if (!map.has(variant)) map.set(variant, { id: l.id, name: l.name });
    }
  }
  return map;
}

function matchLead(map: Map<string, LeadRef>, phoneDigits: string): LeadRef | null {
  if (!phoneDigits) return null;
  for (const variant of brazilianPhoneVariants(phoneDigits)) {
    const hit = map.get(variant);
    if (hit) return hit;
  }
  return null;
}

// ── Idempotência (espelha o closer) ─────────────────────────────────────────────

async function getExistingSdr(): Promise<{ sourceFiles: Set<string>; leadIds: Set<string> }> {
  const rows = await db
    .select({
      sourceFile: schema.commercialAnalyses.sourceFile,
      leadId: schema.commercialAnalyses.leadId,
    })
    .from(schema.commercialAnalyses)
    .where(eq(schema.commercialAnalyses.analyzer, 'sdr'));

  return {
    sourceFiles: new Set(rows.map((r) => r.sourceFile).filter(Boolean) as string[]),
    leadIds: new Set(rows.map((r) => r.leadId).filter(Boolean) as string[]),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }
  if (!process.env.EVOLUTION_API_URL) {
    console.error('EVOLUTION_API_URL not set (defina também EVOLUTION_API_KEY e EVOLUTION_INSTANCE)');
    process.exit(1);
  }

  console.log('\nStudio Sal — analyze-sdr-batch');
  console.log(`Lendo store local da Evolution (findChats/findMessages). Limite do lote: ${MAX_BATCH}\n`);

  // 1. Lista chats individuais e casa cada um com um lead pelos dígitos.
  const leadMatcher = await buildLeadMatcher();
  const chats = await findChats();
  const individual = chats.filter(isIndividual);

  const candidates: Candidate[] = individual.map((chat) => {
    const jid = chat.remoteJid || chat.id;
    const phoneDigits = phoneDigitsOf(chat, jid);
    const matched = matchLead(leadMatcher, phoneDigits);
    return {
      remoteJid: jid,
      phoneDigits,
      displayName: chat.pushName ?? chat.name ?? null,
      lastMessageAt: chat.lastMessage?.messageTimestamp ?? 0,
      leadId: matched?.id ?? null,
      leadName: matched?.name ?? null,
    };
  });

  // 2. Prioriza casadas (recentes primeiro), completa com não-casadas recentes.
  const byRecency = (a: Candidate, b: Candidate) => b.lastMessageAt - a.lastMessageAt;
  const matchedCands = candidates.filter((c) => c.leadId).sort(byRecency);
  const unmatchedCands = candidates.filter((c) => !c.leadId).sort(byRecency);
  const selected = [...matchedCands, ...unmatchedCands].slice(0, MAX_BATCH);

  console.log(
    `Chats individuais: ${candidates.length} (casados: ${matchedCands.length}). ` +
      `Selecionados para este lote: ${selected.length}\n`,
  );

  // 3. Idempotência: o que já tem análise SDR?
  const existing = await getExistingSdr();

  // 4. Processa cada conversa selecionada.
  for (let i = 0; i < selected.length; i++) {
    const cand = selected[i]!;
    const label = cand.leadName || cand.displayName || cand.phoneDigits || cand.remoteJid;

    // Idempotência: pula se o chat já foi analisado, ou se o lead já tem SDR.
    if (
      existing.sourceFiles.has(cand.remoteJid) ||
      (cand.leadId && existing.leadIds.has(cand.leadId))
    ) {
      // Backfill barato (sem gpt-4o): análise antiga gravada com lead_id nulo
      // (quando o match estava quebrado) e agora casa com um lead → preenche.
      if (cand.leadId) {
        await db
          .update(schema.commercialAnalyses)
          .set({ leadId: cand.leadId, updatedAt: new Date() })
          .where(
            and(
              eq(schema.commercialAnalyses.analyzer, 'sdr'),
              eq(schema.commercialAnalyses.sourceFile, cand.remoteJid),
              isNull(schema.commercialAnalyses.leadId),
            ),
          );
      }
      console.log(`  ⟳ skip (já analisado)       ${label}`);
      outcomes.push({ kind: 'skipped', label, reason: 'already_analyzed' });
      continue;
    }

    // SEGURANÇA: lê do store local. Vazio → pula, nunca força sync.
    let messages;
    try {
      messages = await findMessages(cand.remoteJid, { limit: PULL_LIMIT });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ erro ao puxar             ${label}: ${msg}`);
      outcomes.push({ kind: 'failed', label, error: `findMessages: ${msg}` });
      continue;
    }

    if (!messages || messages.length === 0) {
      console.log(`  ⟳ skip (sem mensagens)      ${label}`);
      outcomes.push({ kind: 'skipped', label, reason: 'empty' });
      continue;
    }

    // Pré-filtro leve: precisa de troca de parte a parte. (Ciente: leads sem
    // resposta do SDR caem aqui — reavaliar afrouxar após a call.)
    const hasInbound = messages.some((m) => !m.key.fromMe);
    const hasOutbound = messages.some((m) => m.key.fromMe);
    if (messages.length < MIN_MESSAGES || !hasInbound || !hasOutbound) {
      console.log(`  ⟳ skip (não comercial)      ${label}`);
      outcomes.push({ kind: 'skipped', label, reason: 'not_commercial' });
      continue;
    }

    const thread = buildSdrThread(messages, { leadName: cand.leadName ?? cand.displayName });
    const today = new Date().toISOString().slice(0, 10);

    console.log(`  ⟳ analisando…               ${label}`);

    // Insere 'processando' (crash-recovery + idempotência via source_file=remoteJid).
    const [inserted] = await db
      .insert(schema.commercialAnalyses)
      .values({
        analyzer: 'sdr',
        leadId: cand.leadId,
        title: `SDR – ${label}`,
        callDate: today,
        sourceType: 'whatsapp',
        sourceFile: cand.remoteJid,
        transcript: thread,
        status: 'processando',
        rubricVersion: SDR_RUBRIC_VERSION,
      })
      .returning({ id: schema.commercialAnalyses.id });

    if (!inserted) {
      outcomes.push({ kind: 'failed', label, error: 'DB insert falhou' });
      continue;
    }
    const analysisId = inserted.id;

    try {
      const result = await runSdrAnalysis({ thread });

      if (!result.applicable) {
        const reason = result.applicabilityReason ?? 'Conversa não é de pré-venda SDR.';
        await db
          .update(schema.commercialAnalyses)
          .set({
            status: 'nao_aplicavel',
            errorMessage: reason,
            analyzedBy: 'gpt-4o',
            updatedAt: new Date(),
          })
          .where(eq(schema.commercialAnalyses.id, analysisId));

        console.log(`  – não aplicável             ${label}: ${reason}`);
        outcomes.push({ kind: 'nao_aplicavel', label, id: analysisId, reason });
      } else {
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

        console.log(`  ✓ done  score=${result.overallScore}  ${label}`);
        outcomes.push({
          kind: 'analyzed',
          label,
          id: analysisId,
          score: result.overallScore,
          summary: result.summary,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.commercialAnalyses)
        .set({ status: 'erro', errorMessage: msg, updatedAt: new Date() })
        .where(eq(schema.commercialAnalyses.id, analysisId));

      console.error(`  ✗ erro                      ${label}: ${msg}`);
      outcomes.push({ kind: 'failed', label, error: msg });
    }

    // Throttle entre análises (não dorme após a última).
    if (i < selected.length - 1) await sleep(THROTTLE_MS);
  }

  writeReport();
  printRankedSummary();
  console.log('\nDone. Relatório: apps/crm/tmp/analise-sdr-report.md');
  // @repo/db/client não expõe o client postgres.js; a pool aberta segura o event
  // loop. Encerra explicitamente — o trabalho e o relatório já foram persistidos.
  process.exit(0);
}

// ── Resumo ranqueado no terminal (para a call) ──────────────────────────────────

function firstLine(s: string, max = 100): string {
  const line = s.split('\n').find((l) => l.trim()) ?? '';
  const clean = line.trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function printRankedSummary() {
  const analyzed = outcomes
    .filter((o): o is Extract<Outcome, { kind: 'analyzed' }> => o.kind === 'analyzed')
    .sort((a, b) => b.score - a.score);
  const naoAplicavel = outcomes.filter((o) => o.kind === 'nao_aplicavel');
  const failed = outcomes.filter((o) => o.kind === 'failed');
  const skippedNotCommercial = outcomes.filter(
    (o) => o.kind === 'skipped' && o.reason === 'not_commercial',
  );
  const skippedEmpty = outcomes.filter((o) => o.kind === 'skipped' && o.reason === 'empty');
  const skippedAlready = outcomes.filter(
    (o) => o.kind === 'skipped' && o.reason === 'already_analyzed',
  );

  const bar = '═'.repeat(78);
  console.log('\n' + bar);
  console.log('RESUMO RANQUEADO — análise SDR (maior score primeiro)');
  console.log(bar);

  if (analyzed.length === 0) {
    console.log('\n(nenhuma conversa pontuada neste lote)');
  } else {
    for (const a of analyzed) {
      const score = String(a.score).padStart(3);
      console.log(`\n[${score}] ${a.label}`);
      console.log(`      ${firstLine(a.summary)}`);
    }
  }

  if (naoAplicavel.length > 0) {
    console.log('\n' + '─'.repeat(78));
    console.log('Não aplicáveis (sem nota):');
    for (const n of naoAplicavel) {
      if (n.kind === 'nao_aplicavel') console.log(`  • ${n.label} — ${firstLine(n.reason, 70)}`);
    }
  }

  if (failed.length > 0) {
    console.log('\nFalhas:');
    for (const f of failed) {
      if (f.kind === 'failed') console.log(`  • ${f.label} — ${firstLine(f.error, 70)}`);
    }
  }

  console.log('\n' + '─'.repeat(78));
  console.log(
    `Puladas → já analisadas: ${skippedAlready.length} · ` +
      `não comercial: ${skippedNotCommercial.length} · sem mensagens: ${skippedEmpty.length}`,
  );
  console.log(bar);
}

// ── Relatório em arquivo ────────────────────────────────────────────────────────

function writeReport() {
  const analyzed = outcomes
    .filter((o): o is Extract<Outcome, { kind: 'analyzed' }> => o.kind === 'analyzed')
    .sort((a, b) => b.score - a.score);
  const naoAplicavel = outcomes.filter(
    (o): o is Extract<Outcome, { kind: 'nao_aplicavel' }> => o.kind === 'nao_aplicavel',
  );
  const failed = outcomes.filter(
    (o): o is Extract<Outcome, { kind: 'failed' }> => o.kind === 'failed',
  );
  const skipped = outcomes.filter(
    (o): o is Extract<Outcome, { kind: 'skipped' }> => o.kind === 'skipped',
  );

  const avgScore =
    analyzed.length > 0
      ? Math.round(analyzed.reduce((s, a) => s + a.score, 0) / analyzed.length)
      : null;

  const lines: string[] = [
    '# Relatório — analyze-sdr-batch',
    '',
    `**Data:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    `**Conversas no lote:** ${outcomes.length}`,
    `**Analisadas (com nota):** ${analyzed.length}`,
    `**Não aplicáveis:** ${naoAplicavel.length}`,
    `**Falhas:** ${failed.length}`,
    `**Puladas:** ${skipped.length}`,
    ...(avgScore !== null ? [`**Score médio (lote):** ${avgScore}`] : []),
    '',
  ];

  if (analyzed.length > 0) {
    lines.push('## Análises concluídas (ranqueadas)', '');
    lines.push('| Lead / Número | Score | Resumo | ID |');
    lines.push('|---------------|-------|--------|----|');
    for (const a of analyzed) {
      lines.push(`| ${a.label} | ${a.score} | ${firstLine(a.summary, 120)} | ${a.id} |`);
    }
    lines.push('');
  }

  if (naoAplicavel.length > 0) {
    lines.push('## Não aplicáveis (sem nota)', '');
    for (const n of naoAplicavel) lines.push(`- **${n.label}**: ${n.reason}`);
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('## Falhas', '');
    for (const f of failed) lines.push(`- **${f.label}**: ${f.error}`);
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('## Puladas', '');
    for (const s of skipped) lines.push(`- ${s.label} (${s.reason})`);
    lines.push('');
  }

  const reportDir = resolve(__dirname, '../tmp');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, 'analise-sdr-report.md'), lines.join('\n'), 'utf-8');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
