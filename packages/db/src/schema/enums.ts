import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['owner', 'sdr', 'closer']);
export const stageKindEnum = pgEnum('stage_kind', ['open', 'won', 'lost']);
export const meetingStatusEnum = pgEnum('meeting_status', [
  'agendada',
  'realizada',
  'nao_realizada',
  'reagendada',
  'cancelada',
]);
export const idadeFaixaEnum = pgEnum('idade_faixa', [
  '19_a_24',
  '25_a_34',
  '35_a_44',
  '45_a_54',
  '55_a_64',
]);
export const abordagemPreferidaEnum = pgEnum('abordagem_preferida', [
  'orientacao_sensivel',
  'equipe_constroi',
]);
export const tempoNoNichoFaixaEnum = pgEnum('tempo_no_nicho_faixa', [
  'menos_5',
  '5_a_10',
  '11_a_15',
  'mais_16',
]);
export const nextActionTypeEnum = pgEnum('next_action_type', [
  'call',
  'follow_up',
  'mandar_contrato',
  'cobrar_sinal',
  'outro',
]);
export const intakeSourceEnum = pgEnum('intake_source', [
  'respondi_webhook',
  'legacy_csv_import',
  'manual',
]);
export const intakeStatusEnum = pgEnum('intake_status', ['ok', 'duplicate_upsert', 'failed']);
export const actionCompletionKindEnum = pgEnum('action_completion_kind', ['done', 'replaced']);
