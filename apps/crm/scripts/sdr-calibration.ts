#!/usr/bin/env tsx
/**
 * Calibração da régua SDR — puxa conversas reais via Evolution, roda a análise
 * e imprime os resultados (score + extração). NÃO persiste nada no banco.
 *
 * Uso:
 *   tsx --env-file=../../.env.local scripts/sdr-calibration.ts [qtd]
 *
 * Requer EVOLUTION_* e OPENAI_API_KEY no ambiente.
 */

import { findChats, findMessages } from '../src/server/lib/evolution-client';
import { buildSdrThread } from '../src/server/lib/evolution-thread-builder';
import { runSdrAnalysis } from '@repo/commercial';

const HOW_MANY = Number(process.argv[2] ?? 3);
const MIN_MESSAGES = 6;

async function main() {
  if (!process.env.EVOLUTION_API_URL || !process.env.OPENAI_API_KEY) {
    console.error('Faltam EVOLUTION_* e/ou OPENAI_API_KEY no ambiente.');
    process.exit(1);
  }

  console.log('\n=== Calibração SDR — puxando conversas reais ===\n');

  const chats = await findChats();
  const individual = chats.filter((c) => {
    const jid = c.remoteJid || c.id || '';
    return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
  });
  // Mais recentes primeiro.
  individual.sort(
    (a, b) => (b.lastMessage?.messageTimestamp ?? 0) - (a.lastMessage?.messageTimestamp ?? 0),
  );

  const picked: { jid: string; name: string | null; thread: string }[] = [];

  for (const chat of individual) {
    if (picked.length >= HOW_MANY) break;
    const jid = chat.remoteJid || chat.id;
    const messages = await findMessages(jid, { limit: 500 });

    const hasInbound = messages.some((m) => !m.key.fromMe);
    const hasOutbound = messages.some((m) => m.key.fromMe);
    if (messages.length < MIN_MESSAGES || !hasInbound || !hasOutbound) continue;

    const name = chat.pushName ?? chat.name ?? null;
    const thread = buildSdrThread(messages, { leadName: name });
    picked.push({ jid, name, thread });
  }

  if (picked.length === 0) {
    console.error('Nenhuma conversa elegível encontrada.');
    process.exit(1);
  }

  for (let i = 0; i < picked.length; i++) {
    const { jid, name, thread } = picked[i]!;
    console.log('\n' + '═'.repeat(78));
    console.log(`CONVERSA ${i + 1}/${picked.length}  —  ${name ?? jid}  (${jid})`);
    console.log('═'.repeat(78));
    console.log('\n--- THREAD (montada) ---\n');
    console.log(thread.length > 4000 ? thread.slice(0, 4000) + '\n[...truncado para exibição...]' : thread);

    console.log('\n--- ANALISANDO (GPT-4o)... ---');
    try {
      const result = await runSdrAnalysis({ thread });
      console.log('\n>>> OVERALL SCORE:', result.overallScore);
      console.log('>>> BREAKDOWN:');
      for (const [k, v] of Object.entries(result.breakdown)) {
        console.log(`      ${k.padEnd(22)} ${v === null ? 'null (não avaliável)' : v}`);
      }
      console.log('\n>>> SUMMARY:\n', result.summary);
      console.log('\n>>> EXTRAÇÃO:');
      console.log(JSON.stringify(result.extracted, null, 2));
    } catch (err) {
      console.error('Erro na análise:', err instanceof Error ? err.message : err);
    }
  }

  console.log('\n' + '═'.repeat(78));
  console.log('Calibração concluída. Nada foi gravado no banco.');
  console.log('═'.repeat(78) + '\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
