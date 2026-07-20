import { Card } from '@/components/ui/card';
import type { CreativeDecisionRow } from '@/server/lib/ads-report/index';
import type { DayWindow } from '@/server/lib/ads-windows/index';
import { FadigaBadge, FlagBadge } from './flag-badge';
import { brl, pct, roasX, shortDay } from './format';

// Vista Decisão: tabela por criativo na janela 7d fechada em D-3, com flag do
// motor + motivo em texto (auditável). O seletor de segmento vive no header da
// página — esta tabela NUNCA mistura segmentos (nunca blended).

export function DecisionTable({
  rows,
  window,
  holdLabel,
}: {
  rows: CreativeDecisionRow[];
  window: DayWindow;
  holdLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-body text-ink-muted">
          nenhum criativo com entrega neste segmento na janela {shortDay(window.since)}–
          {shortDay(window.until)}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-line">
            <tr>
              <th className="px-5 py-3 text-left text-micro text-ink-muted">criativo</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">gasto</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">vendas</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">cpa</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">roas</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">hook</th>
              <th className="px-4 py-3 text-right text-micro text-ink-muted">{holdLabel}</th>
              <th className="px-4 py-3 text-left text-micro text-ink-muted">veredito</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.adId} className="border-b border-line align-top last:border-0">
                <td className="max-w-[240px] px-5 py-3">
                  <p className="truncate text-[12px] normal-case tracking-normal text-ink" title={row.adName}>
                    {row.adName}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] normal-case tracking-normal text-ink-muted" title={row.campaignName}>
                    {row.campaignName}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                  {brl(row.metrics.totals.spendCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                  {row.metrics.totals.purchases}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                  {brl(row.metrics.cpaCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] font-medium text-ink">
                  {roasX(row.metrics.roas)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                  {pct(row.metrics.hookRate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                  {pct(row.metrics.hold75)}
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <FlagBadge flag={row.decision.flag} />
                    {row.decision.fadiga && <FadigaBadge />}
                  </div>
                  <p
                    className="mt-1 text-[11px] normal-case leading-snug tracking-normal text-ink-muted"
                    title={row.decision.fadigaReason ?? undefined}
                  >
                    {row.decision.reason}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
