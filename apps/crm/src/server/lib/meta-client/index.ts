/**
 * meta-client — wrapper mínimo do endpoint de insights da Graph API (Meta Ads).
 *
 * Read-only por contrato: só GET /act_{id}/insights, level=ad, time_increment=1.
 * Porta do motor do ba-hub (main@3c881f8, packages/shared/lib/meta.ts) com os
 * fixes de integridade já aplicados:
 *   - paginação segue `paging.next` até esgotar (limit sem loop trunca
 *     silenciosamente — 30 dias × N anúncios estoura 500 linhas fácil);
 *   - header `X-Business-Use-Case-Usage` monitorado — ≥80% aborta com erro
 *     tipado ANTES da próxima chamada (a página corrente é aproveitada).
 *
 * Credenciais só server-side: META_ACCESS_TOKEN (System User — não expira) e
 * META_AD_ACCOUNT_ID (numérico, SEM prefixo act_ — o código prepende).
 * Sem import de DB — testável com fetch injetado.
 */

export const META_API_VERSION = 'v25.0'; // versões da Graph expiram — validar no upgrade
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const PAGE_LIMIT = 500;
const USAGE_ABORT_PCT = 80;

export interface MetaAction {
  action_type: string;
  value: string;
}

/** Linha crua de insights nível ad com time_increment=1 (date_start === date_stop). */
export interface MetaInsightRaw {
  date_start: string;
  date_stop: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p95_watched_actions?: MetaAction[];
}

interface MetaApiResponse {
  data?: MetaInsightRaw[];
  paging?: { next?: string };
  error?: { code: number; message: string; type?: string };
}

/**
 * Fields nível ad. video_3s NÃO tem field próprio (vem de actions[video_view]);
 * p25–p95 são arrays top-level. NÃO pedimos cpc/cpm/ctr prontos — ratio é
 * sempre calculado no código por janela (Σ/Σ), nunca lido da API.
 */
export const AD_INSIGHT_FIELDS = [
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'spend',
  'impressions',
  'reach',
  'inline_link_clicks',
  'actions',
  'action_values',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p95_watched_actions',
] as const;

/** Uso da conta ≥80% (X-Business-Use-Case-Usage) — parar antes do throttle da Meta. */
export class MetaUsageAbortError extends Error {
  constructor(public readonly maxUsagePct: number) {
    super(
      `Meta API usage em ${maxUsagePct}% (limite de abort: ${USAGE_ABORT_PCT}%) — sync interrompido; re-rodar depois.`,
    );
    this.name = 'MetaUsageAbortError';
  }
}

interface MetaEnv {
  accessToken: string;
  adAccountId: string;
}

function getMetaEnv(): MetaEnv {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim();

  if (!accessToken || !adAccountId) {
    throw new Error(
      'Meta Ads não configurada: defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID (id numérico, sem prefixo act_).',
    );
  }

  return { accessToken, adAccountId: adAccountId.replace(/^act_/, '') };
}

/** Maior percentual de uso reportado no header X-Business-Use-Case-Usage (0 se ausente). */
function parseUsagePct(header: string | null): number {
  if (!header) return 0;
  try {
    const parsed = JSON.parse(header) as Record<
      string,
      Array<{ call_count?: number; total_cputime?: number; total_time?: number }>
    >;
    const entries = Object.values(parsed).flat();
    return entries.reduce(
      (max, e) => Math.max(max, e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0),
      0,
    );
  } catch {
    return 0;
  }
}

/**
 * Puxa insights diários (level=ad) da janela [since, until] (dias inclusivos,
 * 'yyyy-MM-dd' no fuso da conta). Segue a paginação até esgotar.
 */
export async function fetchAdInsights(params: {
  since: string;
  until: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaInsightRaw[]> {
  const { accessToken, adAccountId } = getMetaEnv();
  const doFetch = params.fetchImpl ?? fetch;

  const query = new URLSearchParams({
    fields: AD_INSIGHT_FIELDS.join(','),
    level: 'ad',
    time_increment: '1',
    limit: String(PAGE_LIMIT),
    time_range: JSON.stringify({ since: params.since, until: params.until }),
    access_token: accessToken,
  });

  let url: string | null = `${META_API_BASE}/act_${adAccountId}/insights?${query.toString()}`;
  const rows: MetaInsightRaw[] = [];

  while (url) {
    const response = await doFetch(url, { cache: 'no-store' });
    const usagePct = parseUsagePct(response.headers.get('X-Business-Use-Case-Usage'));

    const data = (await response.json()) as MetaApiResponse;
    if (data.error) {
      throw new Error(`Meta API error [${data.error.code}]: ${data.error.message}`);
    }
    if (data.data) rows.push(...data.data);

    url = data.paging?.next ?? null;

    // Aproveita a página corrente; só aborta se ainda houver chamadas a fazer.
    if (usagePct >= USAGE_ABORT_PCT && url) {
      throw new MetaUsageAbortError(usagePct);
    }
  }

  return rows;
}
