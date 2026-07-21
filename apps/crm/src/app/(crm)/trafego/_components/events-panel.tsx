'use client';

// Form de 20 segundos + lista do log de mudanças da conta (meta_account_events).
// Qualquer papel anota; só owner deleta. Cada evento aparece como linha
// vertical nos gráficos da vista Tendência.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import {
  createAccountEventAction,
  deleteAccountEventAction,
  type AccountEventInput,
} from '@/server/actions/trafego';

const LEVEL_OPTIONS = [
  { value: 'account', label: 'conta' },
  { value: 'campaign', label: 'campanha' },
  { value: 'adset', label: 'conjunto' },
  { value: 'ad', label: 'anúncio' },
] as const;

const TYPE_OPTIONS = [
  { value: 'budget', label: 'orçamento' },
  { value: 'pause', label: 'pausa' },
  { value: 'resume', label: 'retomada' },
  { value: 'creative_edit', label: 'edição de criativo' },
  { value: 'launch', label: 'lançamento' },
  { value: 'other', label: 'outro' },
] as const;

export interface EventItem {
  id: string;
  eventDate: string;
  level: string;
  entityId: string | null;
  eventType: string;
  note: string;
  createdBy: string | null;
}

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export function EventsPanel({
  events,
  defaultDate,
  isOwner,
}: {
  events: EventItem[];
  defaultDate: string;
  isOwner: boolean;
}) {
  const feedback = useActionFeedback();
  const [form, setForm] = useState<AccountEventInput>({
    eventDate: defaultDate,
    level: 'account',
    entityId: '',
    eventType: 'budget',
    note: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.pending();
    const result = await createAccountEventAction(form);
    if (result.ok) {
      feedback.success('evento anotado');
      setForm((f) => ({ ...f, entityId: '', note: '' }));
    } else {
      feedback.error(result.error);
    }
  }

  async function handleDelete(id: string, note: string) {
    // Nunca apagar sem confirmação — a nota é conhecimento não reconstruível
    // (o motivo desta tela existir é justamente registrar o que explica a curva).
    if (!window.confirm(`Apagar o evento "${note}"? Não pode ser desfeito.`)) return;
    const result = await deleteAccountEventAction(id);
    if (!result.ok) feedback.error(result.error);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="grid grid-cols-12 items-end gap-3">
        <div className="col-span-2">
          <Label htmlFor="ev-date">data</Label>
          <Input
            id="ev-date"
            type="date"
            required
            value={form.eventDate}
            onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
            className="mt-1 px-3 py-2 text-[13px]"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="ev-level">nível</Label>
          <Select
            id="ev-level"
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as AccountEventInput['level'] }))}
            className="mt-1 px-3 py-2 text-[13px]"
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="ev-type">tipo</Label>
          <Select
            id="ev-type"
            value={form.eventType}
            onChange={(e) =>
              setForm((f) => ({ ...f, eventType: e.target.value as AccountEventInput['eventType'] }))
            }
            className="mt-1 px-3 py-2 text-[13px]"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-4">
          <Label htmlFor="ev-note">nota</Label>
          <Input
            id="ev-note"
            required
            placeholder="ex.: budget frio 50→80/dia"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="mt-1 px-3 py-2 text-[13px]"
          />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <Button type="submit" variant="solid" size="sm" disabled={feedback.state.kind === 'pending'}>
            anotar
          </Button>
          <ActionFeedback state={feedback.state} pendingLabel="anotando..." />
        </div>
      </form>

      {events.length > 0 && (
        <ul className="divide-y divide-line border border-line bg-paper">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 tabular-nums text-[11px] text-ink-muted">
                {shortDay(ev.eventDate)}
              </span>
              <span className="shrink-0 rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-ink-muted">
                {TYPE_OPTIONS.find((o) => o.value === ev.eventType)?.label ?? ev.eventType}
                {ev.level !== 'account' &&
                  ` · ${LEVEL_OPTIONS.find((o) => o.value === ev.level)?.label ?? ev.level}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] normal-case tracking-normal text-ink" title={ev.note}>
                {ev.note}
                {ev.entityId && <span className="text-ink-muted"> · {ev.entityId}</span>}
              </span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleDelete(ev.id, ev.note)}
                  aria-label="apagar evento"
                  className="shrink-0 text-ink-muted transition-colors hover:text-clay"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
