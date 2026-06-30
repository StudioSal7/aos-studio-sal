// Personalização das perguntas do formulário ao estilo Respondi: o token `{nome}`
// escrito em qualquer título/subtítulo é substituído, em tempo real, pelo apelido
// que a pessoa deu em "como você gostaria de ser chamada" (campo com
// leadMapping: 'nickname'). Fallback: primeiro nome do campo `name`.
//
// Módulo puro (sem React/DB) — testável isoladamente.

import type { FormFieldView } from './types';

/**
 * Deriva o mapa de variáveis disponíveis para interpolação a partir das respostas
 * já dadas. Hoje só `{nome}`, mas o formato (Record) permite crescer (`{email}`…)
 * sem mexer no `interpolate`.
 *
 * - `nome` ← resposta do campo `leadMapping: 'nickname'` (trim).
 * - fallback ← primeiro token do campo `leadMapping: 'name'` (trim).
 * - nada respondido ainda → `{ nome: '' }` (o interpolate higieniza a frase).
 */
export function resolveFormVariables(
  fields: FormFieldView[],
  answers: Record<string, unknown>,
): Record<string, string> {
  const valueFor = (mapping: string): string => {
    const field = fields.find((f) => f.leadMapping === mapping);
    if (!field) return '';
    const raw = answers[field.id];
    return typeof raw === 'string' ? raw.trim() : '';
  };

  const nickname = valueFor('nickname');
  const fullName = valueFor('name');
  const firstName = fullName.split(/\s+/)[0] ?? '';

  return { nome: nickname || firstName };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Substitui tokens `{chave}` pelo valor correspondente em `variables`.
 *
 * - Valor presente → injeta o valor (sem mexer na capitalização do resto).
 * - Valor vazio (`''`) → remove o token e a "cola" (vírgula/espaços órfãos) ao
 *   redor, para "{nome}, sabemos..." virar "Sabemos..." sem quebrar a frase. Se
 *   o token vazio abria a frase, recapitaliza a primeira letra.
 * - Chave desconhecida (não está em `variables`) → token fica intocado.
 */
export function interpolate(
  text: string,
  variables: Record<string, string>,
): string {
  if (!text || !text.includes('{')) return text;

  // O token vazio abria a frase? (decide a recapitalização no fim.)
  const leadMatch = text.trimStart().match(/^\{(\w+)\}/);
  const leadingTokenEmpty =
    !!leadMatch && leadMatch[1]! in variables && variables[leadMatch[1]!] === '';

  let result = text;

  for (const [key, value] of Object.entries(variables)) {
    const token = `{${key}}`;
    if (!result.includes(token)) continue;

    if (value !== '') {
      result = result.split(token).join(value);
      continue;
    }

    // Valor vazio: remove o token junto da cola adjacente.
    const tk = escapeRegExp(token);
    result = result
      .replace(new RegExp(`\\s*${tk}\\s*,\\s*`, 'g'), ' ') // "{nome}, " → " "
      .replace(new RegExp(`\\s*,\\s*${tk}`, 'g'), '') //      ", {nome}" → ""
      .replace(new RegExp(`\\s*${tk}\\s*`, 'g'), ' '); //      "{nome}" cru → " "
  }

  result = result.replace(/\s{2,}/g, ' ').trim();

  if (leadingTokenEmpty && result) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}
