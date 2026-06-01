/**
 * Maps Respondi question_ids to CRM lead fields.
 *
 * IMPORTANT: these IDs come from the Respondi form builder
 * (visible in the embed code or the webhook test tool).
 * Update them once you have the real form IDs from the client.
 *
 * Do NOT map by question_title — titles are editable and will break the mapping.
 */

import type { QuestionMapping } from '@/server/lib/respondi-payload-mapper/index';

// TODO: replace placeholder IDs with the real question_ids from the client's active forms.
// Steps: open the Respondi webhook test tool (panel → Integrações → Webhook → Testar)
// and inspect the raw payload to find the question_ids for each field.
export const RESPONDI_FIELD_MAPPING: QuestionMapping = {
  // Replace each key with the real question_id from the form builder.
  q_name: 'name',
  q_nickname: 'nickname',
  q_email: 'email',
  q_whatsapp: 'whatsappE164',
  q_instagram: 'instagramHandle',
  q_idade: 'idadeFaixa',
  q_tempo: 'tempoNoNichoFaixa',
  q_abordagem: 'abordagemPreferida',
  q_renda: 'rendaFaixa',
  q_orcamento: 'orcamentoFaixa',
  q_profissao: 'profissao',
  q_source: 'leadSourceSlug',
};
