/**
 * Cria UMA sessão de treino role-play "exemplo" pronta para a closer ver o que
 * esperar do módulo: uma conversa FICTÍCIA didática (com momentos fortes e
 * fracos de propósito) + a ANÁLISE REAL do motor (1 chamada gpt-4o), gravada
 * exatamente pelo mesmo caminho que o `endSessionAction` usa em produção.
 *
 * Idempotente: se a sessão-exemplo já existir (mesmo `trainee_label` marcador),
 * o script PULA sem apagar nada. Para regerar, encerre/apague manualmente.
 *
 * Rodar: pnpm --filter crm seed-roleplay-example
 */

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { runRoleplayAnalysis, ROLEPLAY_RUBRIC_VERSION } from '@repo/commercial';
import type { RoleplayScenario } from '@repo/commercial/types';

// Marcador que identifica a sessão-exemplo (e garante idempotência).
const EXAMPLE_TRAINEE_LABEL = 'Exemplo — conversa demonstrativa';
const SCENARIO_NAME = 'Ocupada e cética (intermediário)';

// Conversa fictícia entre a closer e o "lead" simulado (Marina, persona genérica
// do cenário). Mistura deliberada: boas perguntas de implicação (turnos 9, 13),
// uma boa de necessidade (15), mas também um pitch cedo demais (11) e uma
// pergunta de situação "metralhadora" (5) — pra o dossiê ter o que elogiar E
// corrigir, e a closer entender o contraste.
const DIALOGUE: { role: 'closer' | 'prospect'; content: string }[] = [
  {
    role: 'closer',
    content:
      'Oi, Marina! Que bom que a gente conseguiu esse horário. Antes de eu te explicar qualquer coisa, queria entender o seu momento. Me conta: como tá a sua presença online hoje?',
  },
  {
    role: 'prospect',
    content:
      'Oi. Olha, vou ser direta porque tô sem tempo. Tenho um Instagram, posto quando dá, mas não é prioridade. Já tentei levar isso a sério antes e não vi resultado, então tô meio pé atrás.',
  },
  {
    role: 'closer',
    content:
      'Entendo total. Quando você diz que tentou antes e não viu resultado, o que você tentou exatamente?',
  },
  {
    role: 'prospect',
    content:
      'Contratei uma social media há uns dois anos. Ela postava uns carrosséis bonitinhos, mas não mudou nada no negócio. Continuei recebendo cliente só por indicação.',
  },
  {
    role: 'closer',
    content:
      'Saquei. E hoje quantos clientes mais ou menos chegam por mês? Você trabalha com o quê mesmo?',
  },
  {
    role: 'prospect',
    content:
      'Sou consultora de imagem. Fecho uns 4, 5 clientes por mês, quase tudo indicação. Tá ok, mas é instável — tem mês que seca.',
  },
  {
    role: 'closer',
    content: 'Esse "mês que seca" te incomoda bastante ou você já se acostumou?',
  },
  {
    role: 'prospect',
    content: 'Incomoda, claro. Mas faz parte, né? Todo mundo que é autônomo vive isso.',
  },
  {
    role: 'closer',
    content:
      'Deixa eu te perguntar: esses meses que secam, você já parou pra calcular quanto isso representa de faturamento que você deixa na mesa no ano?',
  },
  {
    role: 'prospect',
    content:
      'Hmm. Nunca fiz essa conta direito. Mas se eu pegar uns dois, três meses fracos no ano… é bastante. Talvez uns 30, 40 mil que eu poderia ter faturado.',
  },
  {
    role: 'closer',
    content:
      'Olha, é exatamente isso que a gente resolve. Nosso programa de marca pessoal te dá previsibilidade: estrutura o posicionamento, o funil de conteúdo, tudo. Faz sentido?',
  },
  {
    role: 'prospect',
    content:
      'Talvez. Mas é o que toda agência fala, né? E sinceramente, tempo é o que eu menos tenho. Não vou conseguir gravar reels todo dia.',
  },
  {
    role: 'closer',
    content:
      'E se você não resolver essa instabilidade, como você imagina o seu negócio daqui a uns dois anos?',
  },
  {
    role: 'prospect',
    content:
      'Sinceramente? Acho que continuaria igual. Dependendo de indicação, sem conseguir subir o preço porque não construí autoridade. Isso me preocupa, porque eu queria parar de trocar tempo por dinheiro a essa altura.',
  },
  {
    role: 'closer',
    content:
      'Quando você fala em construir autoridade e poder cobrar mais — o que mudaria na sua vida se isso estivesse resolvido nos próximos 6 meses?',
  },
  {
    role: 'prospect',
    content:
      'Mudaria muito. Eu poderia escolher meus clientes, cobrar o que realmente valho e parar de viver no sufoco no fim do mês. Mas… preço, né? Quanto custa isso?',
  },
  {
    role: 'closer',
    content:
      'A gente já chega no investimento, pode deixar. Antes, deixa eu entender uma última coisa: dessas três coisas — escolher cliente, cobrar mais e ter previsibilidade — qual é a que mais pesa pra você hoje?',
  },
  {
    role: 'prospect',
    content:
      'A previsibilidade. Se eu soubesse que todo mês entra um número parecido de cliente, eu respirava. O resto vem junto.',
  },
];

async function toEngineScenario(): Promise<{ id: string; scenario: RoleplayScenario }> {
  const [row] = await db
    .select()
    .from(schema.roleplayScenarios)
    .where(eq(schema.roleplayScenarios.name, SCENARIO_NAME))
    .limit(1);

  if (!row) {
    throw new Error(
      `Cenário "${SCENARIO_NAME}" não encontrado. Rode "pnpm db:seed" primeiro.`,
    );
  }

  return {
    id: row.id,
    scenario: {
      name: row.name,
      persona: row.persona,
      context: row.context,
      objections: asStringArray(row.objections),
      spinFocus: asStringArray(row.spinFocus),
      difficulty: row.difficulty as RoleplayScenario['difficulty'],
    },
  };
}

async function main() {
  // 1) Idempotência: pula se a sessão-exemplo já existe.
  const [existing] = await db
    .select({ id: schema.roleplaySessions.id })
    .from(schema.roleplaySessions)
    .where(eq(schema.roleplaySessions.traineeLabel, EXAMPLE_TRAINEE_LABEL))
    .limit(1);

  if (existing) {
    console.warn(
      `⏭️  Sessão-exemplo já existe (id ${existing.id}). Nada a fazer.\n` +
        `    Abra /comercial/treino/${existing.id} pra ver.`,
    );
    process.exit(0);
  }

  const { id: scenarioId, scenario } = await toEngineScenario();
  console.warn(`📋 Cenário: ${scenario.name} (${scenario.difficulty})`);

  // 2) Cria a sessão.
  const [session] = await db
    .insert(schema.roleplaySessions)
    .values({
      scenarioId,
      leadId: null,
      traineeLabel: EXAMPLE_TRAINEE_LABEL,
      rubricVersion: ROLEPLAY_RUBRIC_VERSION,
      status: 'em_andamento',
    })
    .returning({ id: schema.roleplaySessions.id });

  if (!session) throw new Error('Falha ao criar sessão.');
  console.warn(`💬 Sessão criada: ${session.id}`);

  // 3) Grava a conversa fictícia (mesma estrutura do chat real).
  await db.insert(schema.roleplayMessages).values(
    DIALOGUE.map((m, i) => ({
      sessionId: session.id,
      role: m.role,
      content: m.content,
      turnIndex: i,
    })),
  );
  console.warn(`   ${DIALOGUE.length} mensagens gravadas.`);

  // 4) Roda a ANÁLISE REAL do motor (idêntico ao endSessionAction).
  const transcript = DIALOGUE.map(
    (m) => `${m.role === 'closer' ? 'Closer' : 'Lead'}: ${m.content}`,
  ).join('\n');

  console.warn('🤖 Rodando análise (gpt-4o)…');
  const result = await runRoleplayAnalysis({ scenario, transcript });

  await db
    .update(schema.roleplaySessions)
    .set({
      overallScore: result.overallScore,
      scoreBreakdown: result.breakdown,
      feedback: result.feedback,
      status: 'concluida',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.roleplaySessions.id, session.id));

  console.warn(`\n✅ Sessão-exemplo pronta — nota global ${result.overallScore}/100`);
  console.warn(
    `   situação ${result.breakdown.situacao} · problema ${result.breakdown.problema} · ` +
      `implicação ${result.breakdown.implicacao} · necessidade ${result.breakdown.necessidade} · ` +
      `condução&escuta ${result.breakdown.conducao_escuta}`,
  );
  console.warn(`   "${result.summary}"`);
  console.warn(`\n   Veja em: /comercial/treino/${session.id}`);
  process.exit(0);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

main().catch((err) => {
  console.error('Falhou:', err);
  process.exit(1);
});
