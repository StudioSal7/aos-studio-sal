import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { CpaDiarioChart } from './_components/cpa-diario-chart';
import { CampanhaChart } from './_components/campanha-chart';

function brl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ── Dados mockup — substituir por integração Meta Ads ────────────────────────

const KPIS = {
  investimento: 2689.78,
  vendas: 12,
  cpa: { value: 224.15, meta: 200.0 },
  roas: { value: 5.26, meta: 4.0 },
  receita: 14148.72,
};

const CAMPANHAS = [
  {
    nome: '[202601] [ONGOING] [VENDAS] [LP] [F] – Método SAL',
    tipo: 'frio' as const,
    investimento: 1464.37,
    vendas: 5,
    cpa: 292.87,
    ctr: 6.9,
    roas: 4.03,
    hook: 34.9,
    hold: 7.8,
  },
  {
    nome: '[202602] [ONGOING] [VENDAS] [LP] [Q] – Método SAL',
    tipo: 'quente' as const,
    investimento: 1225.41,
    vendas: 7,
    cpa: 175.06,
    ctr: 4.4,
    roas: 6.74,
    hook: 28.4,
    hold: 7.0,
  },
];

type FunilRow =
  | { type: 'etapa'; label: string; valor: number; retencao: number | null; destaque?: boolean }
  | { type: 'drop'; pct: number; texto: string }
  | { type: 'nota'; texto: string; positiva?: boolean };

const FUNIL: FunilRow[] = [
  { type: 'etapa', label: 'Impressões', valor: 50089, retencao: null },
  { type: 'drop', pct: 68.6, texto: 'perdidos antes de 3s' },
  { type: 'etapa', label: '3 segundos', valor: 15730, retencao: 31.4, destaque: true },
  { type: 'drop', pct: 79.7, texto: 'queda abrupta' },
  { type: 'etapa', label: '25%', valor: 3201, retencao: 20.3 },
  { type: 'etapa', label: '50%', valor: 1859, retencao: 58.1 },
  { type: 'etapa', label: '75%', valor: 1163, retencao: 62.6 },
  { type: 'etapa', label: '95%', valor: 671, retencao: 57.7 },
  { type: 'nota', texto: '12 vendas — CPA R$224,15', positiva: true },
  { type: 'etapa', label: 'Vendas', valor: 12, retencao: 0.1 },
];

const CRIATIVOS = [
  { rank: 1, nome: 'AD09 – Vídeo – Como você se apresentaria', cpa: 10.29, conversoes: 1, investido: 10.29, hook: 30.1, acao: 'escalar' as const },
  { rank: 2, nome: 'AD05 – Vídeo – Gerar Ansiedade', cpa: 149.88, conversoes: 3, investido: 449.63, hook: 27.3, acao: 'manter' as const },
  { rank: 3, nome: 'AD09 – Vídeo – Como você se apresentaria', cpa: 185.94, conversoes: 3, investido: 557.81, hook: 27.9, acao: 'manter' as const },
  { rank: 4, nome: 'AD01 – Vídeo – Saco Cheio com a Internet', cpa: 271.76, conversoes: 5, investido: 1358.82, hook: 35.0, acao: 'pausar' as const },
];

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  note,
  badge,
  valueColor,
}: {
  label: string;
  value: string | number;
  note?: string;
  badge?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro text-ink-muted">{label}</p>
        {badge}
      </div>
      <p
        className={`mt-3 break-words text-[26px] font-serif leading-[1.15] normal-case tabular-nums tracking-tight ${valueColor ?? 'text-ink'}`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-micro text-ink-muted">{note}</p>}
    </Card>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="shrink-0 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-700">
      no alvo
    </span>
  ) : (
    <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700">
      atenção
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: 'frio' | 'quente' }) {
  return tipo === 'frio' ? (
    <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-blue-700">
      frio
    </span>
  ) : (
    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700">
      quente
    </span>
  );
}

function AcaoBadge({ acao }: { acao: 'escalar' | 'manter' | 'pausar' }) {
  const styles = {
    escalar: 'bg-emerald-100 text-emerald-700',
    manter: 'bg-canvas text-ink-muted',
    pausar: 'bg-red-100 text-red-700',
  } as const;
  return (
    <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal ${styles[acao]}`}>
      {acao}
    </span>
  );
}

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-h3 text-ink">{title}</h2>
      {caption && <p className="mb-5 mt-1 text-micro text-ink-muted">{caption}</p>}
      {!caption && <div className="mb-5" />}
      <Card className="min-w-0 overflow-hidden">{children}</Card>
    </section>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function TrafegoPagoPage() {
  const cpaOk = KPIS.cpa.value <= KPIS.cpa.meta;
  const roasOk = KPIS.roas.value >= KPIS.roas.meta;
  const maxFunil = 50089;

  return (
    <div className="flex flex-col">
      <PageHeader title="tráfego pago." />

      <div className="space-y-8 p-8">
        {/* Alert */}
        <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <p className="text-[12px] normal-case tracking-normal text-emerald-800">
            roas acima de 4x em &quot;[202602] [ONGOING] [VENDAS] [LP] [Q] – Método SAL&quot; (6.7x)
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-5 gap-4 [&>*]:min-w-0">
          <KpiCard
            label="investimento"
            value={brl(KPIS.investimento)}
            note="meta ads no período"
          />
          <KpiCard
            label="vendas"
            value={KPIS.vendas}
            note="conversões no período"
          />
          <KpiCard
            label="cpa"
            value={brl(KPIS.cpa.value)}
            note={`meta: ${brl(KPIS.cpa.meta)}`}
            badge={<StatusBadge ok={cpaOk} />}
            valueColor={cpaOk ? 'text-ink' : 'text-amber-700'}
          />
          <KpiCard
            label="roas"
            value={`${KPIS.roas.value.toFixed(2)}x`}
            note={`meta: ${KPIS.roas.meta}x`}
            badge={<StatusBadge ok={roasOk} />}
            valueColor={roasOk ? 'text-emerald-700' : 'text-amber-700'}
          />
          <KpiCard
            label="receita"
            value={brl(KPIS.receita)}
          />
        </div>

        {/* Gráficos de período */}
        <div className="grid grid-cols-2 gap-6 [&>*]:min-w-0">
          <Section title="cpa diário.">
            <CpaDiarioChart />
          </Section>
          <Section title="por campanha.">
            <CampanhaChart />
          </Section>
        </div>

        {/* Tabela de campanhas */}
        <section>
          <h2 className="mb-5 text-h3 text-ink">campanhas.</h2>
          <Card className="min-w-0 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-line">
                  <tr>
                    <th className="px-5 py-3 text-left text-micro text-ink-muted">campanha</th>
                    <th className="px-4 py-3 text-left text-micro text-ink-muted">tipo</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">invest. ↓</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">vendas ↕</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">cpa ↕</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">ctr ↕</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">roas ↕</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">hook ↕</th>
                    <th className="px-4 py-3 text-right text-micro text-ink-muted">hold ↕</th>
                  </tr>
                </thead>
                <tbody>
                  {CAMPANHAS.map((c) => (
                    <tr key={c.nome} className="border-b border-line last:border-0">
                      <td className="max-w-xs truncate px-5 py-3 text-[12px] normal-case tracking-normal text-ink">
                        {c.nome}
                      </td>
                      <td className="px-4 py-3">
                        <TipoBadge tipo={c.tipo} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {brl(c.investimento)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {c.vendas}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {brl(c.cpa)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {c.ctr}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] font-medium text-ink">
                        {c.roas}x
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {c.hook}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-ink">
                        {c.hold}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Funil de Vídeo + Ranking de Criativos */}
        <div className="grid grid-cols-2 gap-6 [&>*]:min-w-0">
          <Section title="funil de vídeo." caption="retenção acumulada por checkpoint do vídeo.">
            <div className="space-y-2">
              {FUNIL.map((row, i) => {
                if (row.type === 'drop') {
                  return (
                    <p key={i} className="ml-28 text-[11px] normal-case tracking-normal text-red-600">
                      ↓ -{row.pct}% {row.texto}
                    </p>
                  );
                }
                if (row.type === 'nota') {
                  return (
                    <p
                      key={i}
                      className={`ml-28 text-[11px] normal-case tracking-normal ${
                        row.positiva ? 'text-emerald-700' : 'text-ink-muted'
                      }`}
                    >
                      {row.texto}
                    </p>
                  );
                }
                const barPct = Math.max((row.valor / maxFunil) * 100, 0.4);
                const barColor = row.destaque ? '#d97706' : '#a8a29e';
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-right text-[11px] normal-case tracking-normal text-ink-muted">
                      {row.label}
                    </span>
                    <div className="relative h-5 flex-1 bg-canvas">
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${barPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums text-[11px] text-ink">
                      {row.valor.toLocaleString('pt-BR')}
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums text-[11px] text-ink-muted">
                      {row.retencao !== null ? `${row.retencao}%` : '100%'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <section>
            <h2 className="text-h3 text-ink">ranking de criativos.</h2>
            <p className="mb-5 mt-1 text-micro text-ink-muted">criativos · ordenados por cpa</p>
            <Card className="divide-y divide-line p-0">
              {CRIATIVOS.map((c) => (
                <div key={`${c.rank}-${c.cpa}`} className="flex items-start gap-4 px-5 py-4">
                  <span className="mt-0.5 w-5 shrink-0 tabular-nums text-[12px] font-medium text-ink-muted">
                    {c.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] normal-case tracking-normal text-ink">{c.nome}</p>
                    <p className="mt-2 text-h3 text-ink">{brl(c.cpa)}</p>
                    <p className="mt-1 text-micro normal-case tracking-normal text-ink-muted">
                      {c.conversoes} conv. · {brl(c.investido)} investido · hook {c.hook}%
                    </p>
                  </div>
                  <AcaoBadge acao={c.acao} />
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
