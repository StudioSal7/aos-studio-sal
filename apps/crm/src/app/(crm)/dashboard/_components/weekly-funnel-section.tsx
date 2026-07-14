// Evolução semanal do funil — duas tabelas simples, sempre 4 linhas (as 4
// últimas semanas de calendário, segunda→domingo em SP; a corrente marcada
// "em curso"). Independe do filtro de período do funil acima.
//
// Tabela A: volume por etapa. Tabela B: conversão "fluxo na semana" entre
// etapas adjacentes (etapa_seguinte ÷ etapa_anterior da MESMA semana; "—"
// quando não há base). Posts feitos e pessoas alcançadas dependem de Meta
// Ads/GA4 (fase posterior) → colunas "em manutenção".

import { Card } from '@/components/ui/card';
import { weeklyConversions } from '@/server/lib/week-range/conversion';
import type { CommercialFunnelCounts, WeeklyFunnelRow } from '@/server/queries/commercial-funnel';

function MaintenanceTag() {
  return (
    <span className="ml-1 whitespace-nowrap bg-clay/10 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-clay">
      em manutenção
    </span>
  );
}

// Etapas coletadas, na ordem do funil. `key` casa com CommercialFunnelCounts.
const VOLUME_COLUMNS: Array<{ key: keyof CommercialFunnelCounts; label: string }> = [
  { key: 'leadsEntered', label: 'leads' },
  { key: 'formResponses', label: 'formulários' },
  { key: 'qualifiedReached', label: 'qualificados' },
  { key: 'firstContactReached', label: '1º contato' },
  { key: 'meetingsScheduled', label: 'reunião agendada' },
  { key: 'meetingsAttended', label: 'reunião realizada' },
  { key: 'proposalsSent', label: 'proposta' },
  { key: 'salesWon', label: 'venda' },
];

// Cadeia usada para conversão (do formulário à venda) — pula "leads que
// entraram" porque nem todo lead vem de formulário (webhook/legado sem
// form_response), o que tornaria a 1ª taxa enganosa.
const CONVERSION_KEYS: Array<keyof CommercialFunnelCounts> = [
  'formResponses',
  'qualifiedReached',
  'firstContactReached',
  'meetingsScheduled',
  'meetingsAttended',
  'proposalsSent',
  'salesWon',
];

const CONVERSION_COLUMNS = [
  'form → qualif.',
  'qualif. → 1º contato',
  '1º contato → reunião',
  'agendada → realizada',
  'realizada → proposta',
  'proposta → venda',
];

const thBase = 'whitespace-nowrap px-4 py-3 text-micro text-ink-muted';
const tdBase = 'whitespace-nowrap px-4 py-3 text-right font-tabular-nums text-body';

function WeekLabel({ row }: { row: WeeklyFunnelRow }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-left text-body text-ink">
      {row.label}
      {row.isCurrent && <span className="ml-2 text-micro text-ink-muted">em curso</span>}
    </td>
  );
}

function Num({ value }: { value: number }) {
  return <span className={value === 0 ? 'text-ink-muted' : 'text-ink'}>{value}</span>;
}

export function WeeklyFunnelSection({ weeks }: { weeks: WeeklyFunnelRow[] }) {
  return (
    <section className="space-y-8">
      <div className="border-b border-line pb-4">
        <h2 className="text-h3 text-ink">evolução semanal.</h2>
        <p className="mt-1 text-micro text-ink-muted">
          últimas 4 semanas (segunda a domingo). volume baixo — números semanais são indicativos, leia a
          tendência, não o valor isolado.
        </p>
      </div>

      {/* Tabela A — volume por etapa */}
      <div>
        <h3 className="mb-3 text-body text-ink-muted">volume por etapa</h3>
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-line">
                <tr>
                  <th className={`${thBase} text-left`}>semana</th>
                  {VOLUME_COLUMNS.map((c) => (
                    <th key={c.key} className={`${thBase} text-right`}>
                      {c.label}
                    </th>
                  ))}
                  <th className={`${thBase} text-right`}>
                    posts
                    <MaintenanceTag />
                  </th>
                  <th className={`${thBase} text-right`}>
                    alcance
                    <MaintenanceTag />
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <WeekLabel row={row} />
                    {VOLUME_COLUMNS.map((c) => (
                      <td key={c.key} className={tdBase}>
                        <Num value={row.counts[c.key]} />
                      </td>
                    ))}
                    <td className={`${tdBase} text-ink-muted`}>—</td>
                    <td className={`${tdBase} text-ink-muted`}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Tabela B — conversão entre etapas (fluxo na semana) */}
      <div>
        <h3 className="mb-3 text-body text-ink-muted">conversão entre etapas (fluxo na semana)</h3>
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-line">
                <tr>
                  <th className={`${thBase} text-left`}>semana</th>
                  {CONVERSION_COLUMNS.map((label) => (
                    <th key={label} className={`${thBase} text-right`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((row) => {
                  const values = CONVERSION_KEYS.map((k) => row.counts[k]);
                  const conversions = weeklyConversions(values);
                  return (
                    <tr key={row.label} className="border-b border-line last:border-0">
                      <WeekLabel row={row} />
                      {conversions.map((c, i) => (
                        <td
                          key={CONVERSION_COLUMNS[i]}
                          className={`${tdBase} ${c == null ? 'text-ink-muted' : 'text-ink'}`}
                        >
                          {c == null ? '—' : `${c}%`}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
