import { and, asc, avg, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type {
  RoleplayDifficulty,
  RoleplayFeedbackDossier,
  RoleplayScenario,
  RoleplayScoreBreakdown,
} from '@repo/commercial/types';

// ── Cenários ────────────────────────────────────────────────────────────────

export type ScenarioListItem = {
  id: string;
  name: string;
  difficulty: RoleplayDifficulty;
  spinFocus: string[];
  active: boolean;
  sourceNote: string | null;
};

export async function listScenarios(opts: { activeOnly?: boolean } = {}): Promise<ScenarioListItem[]> {
  const rows = await db
    .select({
      id: schema.roleplayScenarios.id,
      name: schema.roleplayScenarios.name,
      difficulty: schema.roleplayScenarios.difficulty,
      spinFocus: schema.roleplayScenarios.spinFocus,
      active: schema.roleplayScenarios.active,
      sourceNote: schema.roleplayScenarios.sourceNote,
    })
    .from(schema.roleplayScenarios)
    .where(opts.activeOnly ? eq(schema.roleplayScenarios.active, true) : undefined)
    .orderBy(desc(schema.roleplayScenarios.active), asc(schema.roleplayScenarios.name));

  return rows.map((r) => ({
    ...r,
    difficulty: r.difficulty as RoleplayDifficulty,
    spinFocus: asStringArray(r.spinFocus),
  }));
}

export type ScenarioDetail = {
  id: string;
  name: string;
  persona: string;
  context: string;
  objections: string[];
  spinFocus: string[];
  difficulty: RoleplayDifficulty;
  sourceNote: string | null;
  active: boolean;
};

export async function listScenariosDetailed(): Promise<ScenarioDetail[]> {
  const rows = await db
    .select()
    .from(schema.roleplayScenarios)
    .orderBy(desc(schema.roleplayScenarios.active), asc(schema.roleplayScenarios.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    persona: row.persona,
    context: row.context,
    objections: asStringArray(row.objections),
    spinFocus: asStringArray(row.spinFocus),
    difficulty: row.difficulty as RoleplayDifficulty,
    sourceNote: row.sourceNote,
    active: row.active,
  }));
}

export async function getScenarioById(id: string): Promise<ScenarioDetail | null> {
  const [row] = await db
    .select()
    .from(schema.roleplayScenarios)
    .where(eq(schema.roleplayScenarios.id, id))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    persona: row.persona,
    context: row.context,
    objections: asStringArray(row.objections),
    spinFocus: asStringArray(row.spinFocus),
    difficulty: row.difficulty as RoleplayDifficulty,
    sourceNote: row.sourceNote,
    active: row.active,
  };
}

/** Cenário como DADO de entrada do motor puro (@repo/commercial). */
export function toEngineScenario(s: ScenarioDetail): RoleplayScenario {
  return {
    name: s.name,
    persona: s.persona,
    context: s.context,
    objections: s.objections,
    spinFocus: s.spinFocus,
    difficulty: s.difficulty,
  };
}

// ── Sessões ───────────────────────────────────────────────────────────────

export type SessionListItem = {
  id: string;
  scenarioName: string;
  traineeLabel: string;
  status: string;
  overallScore: number | null;
  startedAt: Date;
  completedAt: Date | null;
};

export async function listSessions(opts: { traineeLabel?: string; limit?: number } = {}): Promise<
  SessionListItem[]
> {
  const limit = opts.limit ?? 50;
  const where = opts.traineeLabel
    ? eq(schema.roleplaySessions.traineeLabel, opts.traineeLabel)
    : undefined;

  return db
    .select({
      id: schema.roleplaySessions.id,
      scenarioName: schema.roleplayScenarios.name,
      traineeLabel: schema.roleplaySessions.traineeLabel,
      status: schema.roleplaySessions.status,
      overallScore: schema.roleplaySessions.overallScore,
      startedAt: schema.roleplaySessions.startedAt,
      completedAt: schema.roleplaySessions.completedAt,
    })
    .from(schema.roleplaySessions)
    .innerJoin(
      schema.roleplayScenarios,
      eq(schema.roleplaySessions.scenarioId, schema.roleplayScenarios.id),
    )
    .where(where)
    .orderBy(desc(schema.roleplaySessions.startedAt))
    .limit(limit);
}

export type SessionMessage = {
  id: string;
  role: string;
  content: string;
  turnIndex: number;
};

export type SessionWithMessages = {
  id: string;
  scenarioId: string;
  scenarioName: string;
  persona: string;
  context: string;
  difficulty: RoleplayDifficulty;
  traineeLabel: string;
  status: string;
  overallScore: number | null;
  breakdown: RoleplayScoreBreakdown | null;
  feedback: RoleplayFeedbackDossier | null;
  leadId: string | null;
  leadName: string | null;
  messages: SessionMessage[];
};

export async function getSessionWithMessages(id: string): Promise<SessionWithMessages | null> {
  const [row] = await db
    .select({
      id: schema.roleplaySessions.id,
      scenarioId: schema.roleplaySessions.scenarioId,
      scenarioName: schema.roleplayScenarios.name,
      persona: schema.roleplayScenarios.persona,
      context: schema.roleplayScenarios.context,
      difficulty: schema.roleplayScenarios.difficulty,
      traineeLabel: schema.roleplaySessions.traineeLabel,
      status: schema.roleplaySessions.status,
      overallScore: schema.roleplaySessions.overallScore,
      breakdown: schema.roleplaySessions.scoreBreakdown,
      feedback: schema.roleplaySessions.feedback,
      leadId: schema.roleplaySessions.leadId,
      leadName: schema.leads.name,
    })
    .from(schema.roleplaySessions)
    .innerJoin(
      schema.roleplayScenarios,
      eq(schema.roleplaySessions.scenarioId, schema.roleplayScenarios.id),
    )
    .leftJoin(schema.leads, eq(schema.roleplaySessions.leadId, schema.leads.id))
    .where(eq(schema.roleplaySessions.id, id))
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select({
      id: schema.roleplayMessages.id,
      role: schema.roleplayMessages.role,
      content: schema.roleplayMessages.content,
      turnIndex: schema.roleplayMessages.turnIndex,
    })
    .from(schema.roleplayMessages)
    .where(eq(schema.roleplayMessages.sessionId, id))
    .orderBy(asc(schema.roleplayMessages.turnIndex));

  return {
    ...row,
    difficulty: row.difficulty as RoleplayDifficulty,
    breakdown: row.breakdown as RoleplayScoreBreakdown | null,
    feedback: row.feedback as RoleplayFeedbackDossier | null,
    messages,
  };
}

// ── Quem treina (dropdown a partir de users.role='closer') ───────────────────

export type CloserOption = { id: string; label: string };

export async function getCloserOptions(): Promise<CloserOption[]> {
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.role, 'closer'))
    .orderBy(asc(schema.users.name));

  return rows.map((r) => ({ id: r.id, label: r.name?.trim() || r.email }));
}

// ── Tendência por trainee (Fatia E) ──────────────────────────────────────────

export type TraineeTrend = {
  totalSessions: number;
  avgOverall: number | null;
  avgByCriterion: RoleplayScoreBreakdown | null;
  weakestCriterion: keyof RoleplayScoreBreakdown | null;
  // Evolução: sessões concluídas mais recentes primeiro (para sparkline/lista).
  timeline: { score: number; completedAt: Date }[];
};

const CRITERIA: (keyof RoleplayScoreBreakdown)[] = [
  'situacao',
  'problema',
  'implicacao',
  'necessidade',
  'conducao_escuta',
];

export async function getTraineeTrends(traineeLabel?: string): Promise<TraineeTrend> {
  const where = and(
    eq(schema.roleplaySessions.status, 'concluida'),
    traineeLabel ? eq(schema.roleplaySessions.traineeLabel, traineeLabel) : undefined,
  );

  // Médias por critério extraídas do jsonb score_breakdown (notas 0–10).
  const avgCriterion = (key: keyof RoleplayScoreBreakdown) =>
    sql<number>`AVG((${schema.roleplaySessions.scoreBreakdown}->>${sql.raw(`'${key}'`)})::numeric)`;

  const [agg] = await db
    .select({
      total: count(schema.roleplaySessions.id),
      avgOverall: avg(schema.roleplaySessions.overallScore),
      situacao: avgCriterion('situacao'),
      problema: avgCriterion('problema'),
      implicacao: avgCriterion('implicacao'),
      necessidade: avgCriterion('necessidade'),
      conducao_escuta: avgCriterion('conducao_escuta'),
    })
    .from(schema.roleplaySessions)
    .where(where);

  const total = agg?.total ?? 0;

  const timelineRows = await db
    .select({
      score: schema.roleplaySessions.overallScore,
      completedAt: schema.roleplaySessions.completedAt,
    })
    .from(schema.roleplaySessions)
    .where(where)
    .orderBy(desc(schema.roleplaySessions.completedAt))
    .limit(30);

  if (total === 0) {
    return {
      totalSessions: 0,
      avgOverall: null,
      avgByCriterion: null,
      weakestCriterion: null,
      timeline: [],
    };
  }

  const avgByCriterion: RoleplayScoreBreakdown = {
    situacao: round1(agg?.situacao),
    problema: round1(agg?.problema),
    implicacao: round1(agg?.implicacao),
    necessidade: round1(agg?.necessidade),
    conducao_escuta: round1(agg?.conducao_escuta),
  };

  const weakestCriterion = CRITERIA.reduce((weakest, key) =>
    avgByCriterion[key] < avgByCriterion[weakest] ? key : weakest,
  );

  return {
    totalSessions: total,
    avgOverall: agg?.avgOverall ? Math.round(Number(agg.avgOverall)) : null,
    avgByCriterion,
    weakestCriterion,
    timeline: timelineRows
      .filter((r): r is { score: number; completedAt: Date } => r.score !== null && r.completedAt !== null)
      .reverse(),
  };
}

// ── helpers ───────────────────────────────────────────────────────────────

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function round1(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}
