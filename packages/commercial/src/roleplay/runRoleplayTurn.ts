import { type ChatMessage, callGPT4oChat } from '../openai';
import type { RoleplayTurnOutput, RunRoleplayTurnInput } from '../types';
import { buildRoleplayTurnSystemPrompt } from './prompts';

// Teto de output do turno: a fala do lead é curta; folga pequena.
const MAX_TURN_TOKENS = 400;

/**
 * Gera a próxima fala do lead simulado (prospect) num turno de chat.
 *
 * Função pura — não toca o banco. Monta o histórico como mensagens de chat
 * (closer→user, prospect→assistant) e faz 1 chamada gpt-4o de texto.
 * Sem scoring aqui: a avaliação é end-of-session.
 */
export async function runRoleplayTurn(
  input: RunRoleplayTurnInput,
): Promise<RoleplayTurnOutput> {
  const { scenario, history } = input;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildRoleplayTurnSystemPrompt(scenario) },
    ...history.map(
      (m): ChatMessage => ({
        role: m.role === 'closer' ? 'user' : 'assistant',
        content: m.content,
      }),
    ),
  ];

  const fala = await callGPT4oChat(messages, {
    maxTokens: MAX_TURN_TOKENS,
    temperature: 0.7, // fala natural/variada — não é tarefa determinística
  });

  return { fala };
}
