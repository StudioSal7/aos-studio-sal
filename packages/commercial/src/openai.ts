import OpenAI from 'openai';

// Lazy initialization — avoids build/import error when OPENAI_API_KEY is absent
// (e.g. running tests or importing types without the key configured).
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurado no ambiente');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Chama o GPT-4o esperando resposta JSON, com retry automático (3x, backoff exponencial).
 * Portado 1:1 de ba-hub/packages/shared/lib/openai.ts. Mantém o prompt calibrado no GPT-4o.
 * Retorna o objeto JSON parseado (unknown — o caller valida o shape).
 */
export async function callGPT4oJSON(
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  const client = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message.content ?? '';
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      return JSON.parse(jsonStr);
    } catch (err) {
      lastError = err as Error;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}
