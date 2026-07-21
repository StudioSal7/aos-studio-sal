'use client';

import { useState, useTransition } from 'react';
import {
  cancelFinancialEntryAction,
  liquidateFinancialEntryAction,
  reopenFinancialEntryAction,
  setFinancialEntryAccountAction,
} from '@/server/actions/financial-entries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EntryForm } from './entry-form';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type EntryRowData = {
  id: string;
  kind: 'receita' | 'despesa';
  description: string;
  amountCents: number;
  competenceDate: string;
  dueDate: string | null;
  cashDate: Date | string | null;
  status: 'em_aberto' | 'liquidado' | 'cancelado';
  originSource: string;
  categoryId: string;
  categoryName: string | null;
  accountName: string | null;
};

function formatDateBR(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: EntryRowData['status'] }) {
  if (status === 'liquidado') return <Badge variant="won">liquidado</Badge>;
  if (status === 'cancelado') return <Badge variant="lost">cancelado</Badge>;
  return <Badge variant="neutral">em aberto</Badge>;
}

export function EntryRow({
  entry,
  categories,
  accounts,
}: {
  entry: EntryRowData;
  categories: { id: string; name: string; entryKind: 'receita' | 'despesa' }[];
  accounts: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'liquidate' | 'account'>('view');
  const [pending, startTransition] = useTransition();

  const isManual = entry.originSource === 'manual';
  const sign = entry.kind === 'receita' ? '+' : '−';

  function handleCancel() {
    startTransition(async () => {
      await cancelFinancialEntryAction(entry.id);
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenFinancialEntryAction(entry.id);
    });
  }

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-ink">{entry.description}</p>
          <p className="truncate text-micro text-ink-muted normal-case tracking-normal">
            {entry.categoryName ?? '—'} · competência {formatDateBR(entry.competenceDate)}
            {entry.dueDate && ` · vencimento ${formatDateBR(entry.dueDate)}`}
            {entry.accountName && ` · ${entry.accountName}`}
          </p>
        </div>
        <p
          className={`shrink-0 tabular-nums text-body ${entry.kind === 'receita' ? 'text-leaf' : 'text-ink'}`}
        >
          {sign} {BRL.format(entry.amountCents / 100)}
        </p>
        <div className="shrink-0">
          <StatusBadge status={entry.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {entry.status === 'em_aberto' && (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === 'liquidate' ? 'view' : 'liquidate')}
                className="text-micro text-ink-muted hover:text-ink"
              >
                liquidar
              </button>
              {isManual && (
                <button
                  type="button"
                  onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
                  className="text-micro text-ink-muted hover:text-ink"
                >
                  editar
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={handleCancel}
                className="text-micro text-clay hover:underline disabled:opacity-50"
              >
                cancelar
              </button>
            </>
          )}
          {entry.status === 'liquidado' && (
            <button
              type="button"
              onClick={() => setMode(mode === 'account' ? 'view' : 'account')}
              className="text-micro text-ink-muted hover:text-ink"
            >
              trocar conta
            </button>
          )}
          {entry.status !== 'em_aberto' && (
            <button
              type="button"
              disabled={pending}
              onClick={handleReopen}
              className="text-micro text-ink-muted hover:text-ink disabled:opacity-50"
            >
              reabrir
            </button>
          )}
        </div>
      </div>

      {mode === 'account' && (
        <AccountReassignForm entryId={entry.id} accounts={accounts} onDone={() => setMode('view')} />
      )}

      {mode === 'edit' && (
        <div className="px-5 pb-4">
          <EntryForm
            categories={categories}
            existing={{
              id: entry.id,
              kind: entry.kind,
              description: entry.description,
              amountCents: entry.amountCents,
              competenceDate: entry.competenceDate,
              dueDate: entry.dueDate,
              categoryId: entry.categoryId,
              notes: null,
            }}
            onDone={() => setMode('view')}
          />
        </div>
      )}

      {mode === 'liquidate' && (
        <LiquidateForm entryId={entry.id} accounts={accounts} onDone={() => setMode('view')} />
      )}
    </div>
  );
}

function AccountReassignForm({
  entryId,
  accounts,
  onDone,
}: {
  entryId: string;
  accounts: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const accountId = String(formData.get('accountId') ?? '');
    const result = await setFinancialEntryAccountAction(entryId, accountId);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form
      action={(fd) => startTransition(() => handleSubmit(fd))}
      className="flex items-end gap-3 border-t border-line bg-canvas px-5 py-4"
    >
      <div className="flex-1">
        <label className="text-micro text-ink-muted">nova conta</label>
        <Select name="accountId" required defaultValue={accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="solid" size="sm" disabled={pending}>
        confirmar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        cancelar
      </Button>
      {error && <p className="text-micro text-clay">{error}</p>}
    </form>
  );
}

function LiquidateForm({
  entryId,
  accounts,
  onDone,
}: {
  entryId: string;
  accounts: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const accountId = String(formData.get('accountId') ?? '');
    const cashDate = String(formData.get('cashDate') ?? '');
    const result = await liquidateFinancialEntryAction({ id: entryId, accountId, cashDate });
    if (result.ok) {
      onDone();
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      action={(fd) => startTransition(() => handleSubmit(fd))}
      className="flex items-end gap-3 border-t border-line bg-canvas px-5 py-4"
    >
      <div className="flex-1">
        <label className="text-micro text-ink-muted">conta</label>
        <Select name="accountId" required defaultValue={accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-micro text-ink-muted">data do pagamento/recebimento</label>
        <Input type="date" name="cashDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <Button type="submit" variant="solid" size="sm" disabled={pending}>
        confirmar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        cancelar
      </Button>
      {error && <p className="text-micro text-clay">{error}</p>}
    </form>
  );
}
