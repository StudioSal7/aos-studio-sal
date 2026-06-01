import OpenAI from 'openai';

// Lazy initialization — avoids build/import error when OPENAI_API_KEY is absent
// (e.g. running tests or importing types without the key configured).
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurado no ambiente');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// gpt-4o em TODAS as análises (closer e SDR): qualidade de julgamento e
// comparabilidade entre análises são o ativo. A compressão extrativa de
// fallback chama explicitamente o mini (opts.model).
export const OPENAI_MODEL = 'gpt-4o';

// Erro lançado quando a resposta foi truncada (finish_reason='length').
// O caller deve FALHAR a análise — nunca persistir dossiê/JSON parcial.
export class TruncatedResponseError extends Error {
  constructor(maxTokens: number) {
    super(`Resposta truncada (finish_reason=length) — max_tokens=${maxTokens} insuficiente`);
    this.name = 'TruncatedResponseError';
  }
}

export interface CallGPTOptions {
  model?: string; // default OPENAI_MODEL
  maxTokens?: number; // teto de output; reservado contra o TPM pela OpenAI
  temperature?: number; // default 0.3
}

function isRateLimit(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { status?: number }).status === 429);
}

function retryAfterMs(err: unknown, attempt: number): number {
  // Respeita o header Retry-After quando presente (segundos); senão backoff exponencial.
  const headers = (err as { headers?: Record<string, string> })?.headers;
  const ra = headers?.['retry-after'];
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs * 1000);
  }
  return 1000 * Math.pow(2, attempt);
}

/**
 * Chama o GPT esperando resposta JSON, com retry automático e backoff.
 * Em 429 respeita Retry-After e tenta mais vezes (TPM é o gargalo do batch).
 * Lança TruncatedResponseError se a resposta vier cortada (finish_reason='length').
 * Retorna o objeto JSON parseado (unknown — o caller valida o shape).
 */
export async function callGPT4oJSON(
  systemPrompt: string,
  userPrompt: string,
  opts: CallGPTOptions = {},
): Promise<unknown> {
  const client = getClient();
  const model = opts.model ?? OPENAI_MODEL;
  const maxTokens = opts.maxTokens;
  const temperature = opts.temperature ?? 0.3;
  const maxAttempts = 5;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const choice = response.choices[0];
      // Guarda de truncamento: NUNCA aceitar JSON parcial.
      if (choice?.finish_reason === 'length') {
        throw new TruncatedResponseError(maxTokens ?? 0);
      }

      const content = choice?.message.content ?? '';
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      return JSON.parse(jsonStr);
    } catch (err) {
      // Truncamento é erro determinístico — não adianta repetir com o mesmo max_tokens.
      if (err instanceof TruncatedResponseError) throw err;

      lastError = err as Error;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, retryAfterMs(err, attempt)));
      }
    }
  }

  throw lastError;
}
