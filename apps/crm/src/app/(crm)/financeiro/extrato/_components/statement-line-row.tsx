'use client';

import { useState, useTransition } from 'react';
import {
  createEntryFromLineAction,
  ignoreLineAction,
  reconcileLineWithEntryAction,
} from '@/server/actions/bank-statement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type StatementLineData = {
  id: string;
  accountName: string | null;
  postedAt: Date | string;
  amountCents: number;
  description: string;
  status: 'nao_conciliado' | 'conciliado' | 'ignorado';
  importFileName: string | null;
};

function formatDateBR(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function StatusBadge({ status }: { status: StatementLineData['status'] }) {
  if (status === 'conciliado') return <Badge variant="won">conciliado</Badge>;
  if (status === 'ignorado') return <Badge variant="archive">ignorado</Badge>;
  return <Badge variant="neutral">não conciliado</Badge>;
}

export function StatementLineRow({
  line,
  openEntries,
  categories,
}: {
  line: StatementLineData;
  openEntries: { id: string; description: string; amountCents: number; kind: 'receita' | 'despesa' }[];
  categories: { id: string; name: string; entryKind: 'receita' | 'despesa' }[];
}) {
  const [mode, setMode] = useState<'view' | 'reconcile' | 'create'>('view');
  const [pending, startTransition] = useTransition();

  const kind: 'receita' | 'despesa' = line.amountCents >= 0 ? 'receita' : 'despesa';

  function handleIgnore() {
    startTransition(async () => {
      await ignoreLineAction(line.id);
    });
  }

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-ink">{line.description}</p>
          <p className="truncate text-micro text-ink-muted normal-case tracking-normal">
            {formatDateBR(line.postedAt)} · {line.accountName ?? '—'}
            {line.importFileName && ` · ${line.importFileName}`}
          </p>
        </div>
        <p className={`shrink-0 tabular-nums text-body ${line.amountCents >= 0 ? 'text-leaf' : 'text-ink'}`}>
          {BRL.format(line.amountCents / 100)}
        </p>
        <div className="shrink-0">
          <StatusBadge status={line.status} />
        </div>
        {line.status === 'nao_conciliado' && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMode(mode === 'reconcile' ? 'view' : 'reconcile')}
              className="text-micro text-ink-muted hover:text-ink"
            >
              vincular
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'create' ? 'view' : 'create')}
              className="text-micro text-ink-muted hover:text-ink"
            >
              criar lançamento
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleIgnore}
              className="text-micro text-ink-muted hover:text-ink disabled:opacity-50"
            >
              ignorar
            </button>
          </div>
        )}
      </div>

      {mode === 'reconcile' && (
        <ReconcileForm
          lineId={line.id}
          candidates={openEntries.filter((e) => e.kind === kind)}
          onDone={() => setMode('view')}
        />
      )}
      {mode === 'create' && (
        <CreateFromLineForm
          lineId={line.id}
          description={line.description}
          categories={categories.filter((c) => c.entryKind === kind)}
          onDone={() => setMode('view')}
        />
      )}
    </div>
  );
}

function ReconcileForm({
  lineId,
  candidates,
  onDone,
}: {
  lineId: string;
  candidates: { id: string; description: string; amountCents: number }[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const entryId = String(formData.get('entryId') ?? '');
    const result = await reconcileLineWithEntryAction(lineId, entryId);
    if (result.ok) onDone();
    else setError(result.error);
  }

  if (candidates.length === 0) {
    return (
      <div className="border-t border-line bg-canvas px-5 py-4 text-micro text-ink-muted">
        Nenhum lançamento em aberto compatível — use &quot;criar lançamento&quot; em vez disso.
      </div>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => handleSubmit(fd))}
      className="flex items-end gap-3 border-t border-line bg-canvas px-5 py-4"
    >
      <div className="flex-1">
        <label className="text-micro text-ink-muted">lançamento em aberto</label>
        <Select name="entryId" required defaultValue={candidates[0]?.id}>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.description} — {BRL.format(c.amountCents / 100)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="solid" size="sm" disabled={pending}>
        conciliar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        cancelar
      </Button>
      {error && <p className="text-micro text-clay">{error}</p>}
    </form>
  );
}

function CreateFromLineForm({
  lineId,
  description,
  categories,
  onDone,
}: {
  lineId: string;
  description: string;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createEntryFromLineAction({
      lineId,
      description: String(formData.get('description') ?? ''),
      categoryId: String(formData.get('categoryId') ?? ''),
    });
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form
      action={(fd) => startTransition(() => handleSubmit(fd))}
      className="flex items-end gap-3 border-t border-line bg-canvas px-5 py-4"
    >
      <div className="flex-1">
        <label className="text-micro text-ink-muted">descrição</label>
        <Input name="description" defaultValue={description} />
      </div>
      <div className="flex-1">
        <label className="text-micro text-ink-muted">categoria</label>
        <Select name="categoryId" required defaultValue={categories[0]?.id}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="solid" size="sm" disabled={pending}>
        criar e conciliar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        cancelar
      </Button>
      {error && <p className="text-micro text-clay">{error}</p>}
    </form>
  );
}
