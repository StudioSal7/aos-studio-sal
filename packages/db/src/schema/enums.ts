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
  // Formulário self-hosted (substitui o Respondi) — ver schema/forms.ts
  'formulario_web',
]);
export const intakeStatusEnum = pgEnum('intake_status', ['ok', 'duplicate_upsert', 'failed']);
export const actionCompletionKindEnum = pgEnum('action_completion_kind', ['done', 'replaced']);

// Motor de análise comercial (CallScore) — closer e SDR
export const analyzerEnum = pgEnum('analyzer', ['closer', 'sdr']);
export const analysisStatusEnum = pgEnum('analysis_status', [
  'pendente',
  'processando',
  'concluido',
  'erro',
  // SDR: conversa puxada não é de pré-venda (contato frio, recado interno, etc.).
  'nao_aplicavel',
]);

// Treino comercial — role-play SPIN (lead simulado por IA)
export const roleplaySessionStatusEnum = pgEnum('roleplay_session_status', [
  'em_andamento',
  'concluida',
  'abandonada',
]);
export const roleplayMessageRoleEnum = pgEnum('roleplay_message_role', [
  'prospect', // fala do lead simulado pela IA
  'closer', // fala de quem treina
  'system', // mensagem de sistema (abertura/contexto)
]);
export const roleplayDifficultyEnum = pgEnum('roleplay_difficulty', [
  'facil',
  'medio',
  'dificil',
]);

// Formulários self-hosted (Typeform-style) — substituem o Respondi.app
export const formStatusEnum = pgEnum('form_status', [
  'rascunho',
  'ativo',
  'pausado',
  'encerrado',
]);
// 13 tipos de campo (espelha o motor portado do ba-hub). boas_vindas e
// encerramento são telas (não coletam resposta).
export const formFieldTypeEnum = pgEnum('form_field_type', [
  'boas_vindas',
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'url',
  'numero',
  'data',
  'select',
  'multi_select',
  'escala',
  'sim_nao',
  'encerramento',
]);
