'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@repo/ui';
import type { KanbanLead, KanbanStage } from './kanban-board';
import { LeadCard } from './lead-card';

const KIND_ACCENT: Record<KanbanStage['kind'], string> = {
  open: 'bg-stage-open',
  won: 'bg-stage-won',
  lost: 'bg-stage-lost',
};

export function KanbanColumn({
  stage,
  leads,
  onSelectLead,
}: {
  stage: KanbanStage;
  leads: KanbanLead[];
  onSelectLead?: (lead: KanbanLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn('inline-block h-2 w-2', KIND_ACCENT[stage.kind])}
          />
          <h2 className="text-h3 text-ink">{stage.displayName}</h2>
        </div>
        <span className="text-micro text-ink-muted">{leads.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto space-y-3 border border-transparent p-2 transition-colors',
          isOver ? 'border-line bg-paper' : 'bg-canvas',
          leads.length === 0 && 'min-h-16',
        )}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={onSelectLead} />
        ))}
      </div>
    </div>
  );
}
