'use server';

import { asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  runRoleplayAnalysis,
  runRoleplayTurn,
  scenarioFromTranscript,
  ROLEPLAY_RUBRIC_VERSION,
} from '@repo/commercial';
import type { RoleplayMessage, RoleplayScenario } from '@repo/commercial/types';
import { requireAuth } from '@/server/auth';
import type { ActionResult } from './leads';

// ── Sessões de treino ─────────────────────────────────────────────────────

export async function startSessionAction(input: {
  scenarioId: string;
  traineeLabel: string;
  leadId?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireAuth();

  if (!input.scenarioId) return { ok: false, error: 'Cenário obrigatório.' };
  if (!input.traineeLabel.trim()) return { ok: false, error: 'Selecione quem está treinando.' };

  const [scenario] = await db
    .select({ id: schema.roleplayScenarios.id, active: schema.roleplayScenarios.active })
    .from(schema.roleplayScenarios)
    .where(eq(schema.roleplayScenarios.id, input.scenarioId))
    .limit(1);

  if (!scenario) return { ok: false, error: 'Cenário não encontrado.' };

  const [inserted] = await db
    .insert(schema.roleplaySessions)
    .values({
      scenarioId: input.scenarioId,
      leadId: input.leadId ?? null,
      traineeLabel: input.traineeLabel.trim(),
      rubricVersion: ROLEPLAY_RUBRIC_VERSION,
      status: 'em_andamento',
    })
    .returning({ id: schema.roleplaySessions.id });

  if (!inserted) return { ok: false, error: 'Falha ao criar sessão.' };

  revalidatePath('/comercial/treino');
  return { ok: true, data: { id: inserted.id } };
}

export type TurnMessage = { id: string; role: string; content: string; turnIndex: number };

export async function sendTurnAction(input: {
  sessionId: string;
  content: string;
}): Promise<ActionResult<{ messages: TurnMessage[] }>> {
  await requireAuth();

  const content = input.content.trim();
  if (!content) return { ok: false, error: 'Mensagem vazia.' };

  const session = await loadSessionForEngine(input.sessionId);
  if (!session) return { ok: false, error: 'Sessão não encontrada.' };
  if (session.status !== 'em_andamento') {
    return { ok: false, error: 'Sessão já encerrada.' };
  }

  const nextIndex = session.messages.length;

  // 1) Persiste a fala da closer.
  const [closerMsg] = await db
    .insert(schema.roleplayMessages)
    .values({
      sessionId: input.sessionId,
      role: 'closer',
      content,
      turnIndex: nextIndex,
    })
    .returning();

  // 2) Gera e persiste a resposta do prospect.
  const history: RoleplayMessage[] = [
    ...session.messages.map((m) => ({
      role: m.role === 'closer' ? ('closer' as const) : ('prospect' as const),
      content: m.content,
    })),
    { role: 'closer', content },
  ];

  let prospectContent: string;
  try {
    const turn = await runRoleplayTurn({ scenario: session.scenario, history });
    prospectContent = turn.fala;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Falha ao gerar resposta do lead: ${msg}` };
  }

  const [prospectMsg] = await db
    .insert(schema.roleplayMessages)
    .values({
      sessionId: input.sessionId,
      role: 'prospect',
      content: prospectContent,
      turnIndex: nextIndex + 1,
    })
    .returning();

  await touchSession(input.sessionId);
  revalidatePath(`/comercial/treino/${input.sessionId}`);

  const messages = [closerMsg, prospectMsg].filter(
    (m): m is NonNullable<typeof m> => Boolean(m),
  );
  return { ok: true, data: { messages } };
}

export async function endSessionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireAuth();

  const session = await loadSessionForEngine(input.sessionId);
  if (!session) return { ok: false, error: 'Sessão não encontrada.' };
  if (session.status !== 'em_andamento') {
    return { ok: false, error: 'Sessão já encerrada.' };
  }

  const dialogue = session.messages.filter((m) => m.role === 'closer' || m.role === 'prospect');
  if (dialogue.length < 2) {
    return { ok: false, error: 'Conversa muito curta para avaliar.' };
  }

  const transcript = dialogue
    .map((m) => `${m.role === 'closer' ? 'Closer' : 'Lead'}: ${m.content}`)
    .join('\n');

  try {
    const result = await runRoleplayAnalysis({ scenario: session.scenario, transcript });
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
      .where(eq(schema.roleplaySessions.id, input.sessionId));
  } catch (err) {
    // Não grava dossiê parcial — a sessão segue em_andamento e o erro volta pra UI.
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Avaliação falhou: ${msg}` };
  }

  revalidatePath(`/comercial/treino/${input.sessionId}`);
  revalidatePath('/comercial/treino');
  return { ok: true, data: { id: input.sessionId } };
}

// ── Cenários (Fatia D) ──────────────────────────────────────────────────────

type ScenarioInput = {
  name: string;
  persona: string;
  context: string;
  objections: string[];
  spinFocus: string[];
  difficulty: 'facil' | 'medio' | 'dificil';
  sourceNote?: string;
  active?: boolean;
};

function validateScenario(input: ScenarioInput): string | null {
  if (!input.name.trim()) return 'Nome obrigatório.';
  if (!input.persona.trim()) return 'Persona obrigatória.';
  if (!input.context.trim()) return 'Contexto obrigatório.';
  return null;
}

export async function createScenarioAction(
  input: ScenarioInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  const err = validateScenario(input);
  if (err) return { ok: false, error: err };

  const [inserted] = await db
    .insert(schema.roleplayScenarios)
    .values({
      name: input.name.trim(),
      persona: input.persona.trim(),
      context: input.context.trim(),
      objections: input.objections.filter((o) => o.trim()),
      spinFocus: input.spinFocus.filter((s) => s.trim()),
      difficulty: input.difficulty,
      sourceNote: input.sourceNote?.trim() || null,
      active: input.active ?? true,
    })
    .returning({ id: schema.roleplayScenarios.id });

  if (!inserted) return { ok: false, error: 'Falha ao criar cenário.' };

  revalidatePath('/comercial/treino/cenarios');
  revalidatePath('/comercial/treino');
  return { ok: true, data: { id: inserted.id } };
}

export async function updateScenarioAction(
  id: string,
  input: ScenarioInput,
): Promise<ActionResult> {
  await requireAuth();
  const err = validateScenario(input);
  if (err) return { ok: false, error: err };

  await db
    .update(schema.roleplayScenarios)
    .set({
      name: input.name.trim(),
      persona: input.persona.trim(),
      context: input.context.trim(),
      objections: input.objections.filter((o) => o.trim()),
      spinFocus: input.spinFocus.filter((s) => s.trim()),
      difficulty: input.difficulty,
      sourceNote: input.sourceNote?.trim() || null,
      active: input.active ?? true,
    })
    .where(eq(schema.roleplayScenarios.id, id));

  revalidatePath('/comercial/treino/cenarios');
  revalidatePath('/comercial/treino');
  return { ok: true };
}

/** Extrai um rascunho {persona, context, objections} de uma transcrição (revisão humana). */
export async function draftScenarioAction(input: {
  transcript: string;
}): Promise<ActionResult<{ persona: string; context: string; objections: string[] }>> {
  await requireAuth();
  if (!input.transcript.trim()) return { ok: false, error: 'Cole uma transcrição.' };

  try {
    const draft = await scenarioFromTranscript(input.transcript);
    return { ok: true, data: draft };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: `Extração falhou: ${msg}` };
  }
}

// ── helpers internos ──────────────────────────────────────────────────────

type SessionForEngine = {
  status: string;
  scenario: RoleplayScenario;
  messages: { role: string; content: string }[];
};

async function loadSessionForEngine(sessionId: string): Promise<SessionForEngine | null> {
  const [row] = await db
    .select({
      status: schema.roleplaySessions.status,
      name: schema.roleplayScenarios.name,
      persona: schema.roleplayScenarios.persona,
      context: schema.roleplayScenarios.context,
      objections: schema.roleplayScenarios.objections,
      spinFocus: schema.roleplayScenarios.spinFocus,
      difficulty: schema.roleplayScenarios.difficulty,
    })
    .from(schema.roleplaySessions)
    .innerJoin(
      schema.roleplayScenarios,
      eq(schema.roleplaySessions.scenarioId, schema.roleplayScenarios.id),
    )
    .where(eq(schema.roleplaySessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select({ role: schema.roleplayMessages.role, content: schema.roleplayMessages.content })
    .from(schema.roleplayMessages)
    .where(eq(schema.roleplayMessages.sessionId, sessionId))
    .orderBy(asc(schema.roleplayMessages.turnIndex));

  return {
    status: row.status,
    scenario: {
      name: row.name,
      persona: row.persona,
      context: row.context,
      objections: asStringArray(row.objections),
      spinFocus: asStringArray(row.spinFocus),
      difficulty: row.difficulty as RoleplayScenario['difficulty'],
    },
    messages,
  };
}

async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(schema.roleplaySessions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.roleplaySessions.id, sessionId));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}
