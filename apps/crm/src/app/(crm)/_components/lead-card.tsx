'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { cn } from '@repo/ui';
import type { KanbanLead } from './kanban-board';

export function LeadCard({
  lead,
  isDragOverlay = false,
  onSelect,
}: {
  lead: KanbanLead;
  isDragOverlay?: boolean;
  onSelect?: (lead: KanbanLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      suppressHydrationWarning
      className={cn(
        'group relative cursor-grab border border-line bg-paper p-4 select-none transition-colors',
        isDragging && !isDragOverlay && 'opacity-40',
        isDragOverlay ? 'rotate-1 shadow-lg' : 'hover:border-ink',
        lead.requiresAttention && 'border-l-2 border-l-signal-hot',
        lead.needsManualReview && 'border-l-2 border-l-signal-review',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {lead.firstContactSignal && (
            <span
              className={cn(
                'mb-1 inline-flex items-center gap-1 text-micro',
                lead.firstContactSignal.urgency === 'overdue'
                  ? 'bg-signal-hot px-1.5 py-0.5 text-paper'
                  : 'text-leaf',
              )}
            >
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  lead.firstContactSignal.urgency === 'overdue' ? 'bg-paper' : 'bg-leaf',
                )}
              />
              {lead.firstContactSignal.urgency === 'overdue'
                ? `atrasado${lead.firstContactSignal.ageDays > 0 ? ` · ${lead.firstContactSignal.ageDays}d` : ''}`
                : 'novo'}
            </span>
          )}
          <p className="truncate text-body text-ink">
            {lead.nickname ? (
              <>
                <span>{lead.nickname}</span>
                <span className="ml-1 text-ink-muted">({lead.name})</span>
              </>
            ) : (
              lead.name ?? <span className="italic text-ink-muted">sem nome</span>
            )}
          </p>
          {lead.email && (
            <p className="mt-1 truncate text-micro text-ink-muted normal-case tracking-normal">
              {lead.email}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {lead.ehClienteAnterior && (
            <span
              title="Cliente anterior"
              className="inline-block h-2 w-2 rounded-full bg-signal-archive"
            />
          )}
          {lead.marcadoFake && (
            <span
              title="Marcado como fake"
              className="inline-block h-2 w-2 rounded-full bg-signal-fake"
            />
          )}
        </div>
      </div>

      {lead.hasUnconfirmedMeeting && (
        <p className="mt-2 text-micro text-wood">confirmar reunião</p>
      )}
      {lead.nextActionAt && (
        <p className="mt-2 text-micro text-wood">
          {formatActionDate(lead.nextActionAt)}
          {lead.nextActionType && (
            <span className="ml-1 text-ink-muted">— {lead.nextActionType}</span>
          )}
        </p>
      )}

      {onSelect ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(lead);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Abrir lead ${lead.name ?? lead.nickname ?? ''}`}
        />
      ) : (
        <Link
          href={`/leads/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 opacity-0"
          aria-label={`Abrir lead ${lead.name ?? ''}`}
        />
      )}
    </div>
  );
}

function formatActionDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}
