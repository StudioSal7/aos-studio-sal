'use client';

import { DndContext, DragOverlay, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useOptimistic, useState, useTransition } from 'react';
import { updateLeadStageAction } from '@/server/actions/leads';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import type { FirstContactSignal } from '@/server/lib/first-contact-urgency';
import { KanbanColumn } from './kanban-column';
import { LeadCard } from './lead-card';
import { LeadQuickView } from './lead-quick-view';

// Narrow types for what the board actually needs from the DB rows.
export type KanbanStage = {
  id: string;
  slug: string;
  displayName: string;
  position: number;
  kind: 'open' | 'won' | 'lost';
};

export type KanbanLead = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
  whatsappE164: string | null;
  stageId: string;
  nextActionAt: string | null;
  nextActionType: string | null;
  sdrId: string | null;
  closerId: string | null;
  needsManualReview: boolean;
  requiresAttention: boolean;
  marcadoFake: boolean;
  ehClienteAnterior: boolean;
  idadeFaixa: string | null;
  abordagemPreferida: string | null;
  tempoNoNichoFaixa: string | null;
  rendaFaixa: string | null;
  orcamentoFaixa: string | null;
  profissao: string | null;
  createdAt: string;
  updatedAt: string;
  hasUnconfirmedMeeting: boolean;
  firstContactSignal: FirstContactSignal;
};

type PendingTransition = {
  leadId: string;
  targetStage: KanbanStage;
};

export type LossReason = {
  id: string;
  slug: string;
  displayName: string;
};

export function KanbanBoard({
  stages,
  leads: initialLeads,
  lossReasons,
}: {
  stages: KanbanStage[];
  leads: KanbanLead[];
  lossReasons: LossReason[];
}) {
  const [optimisticLeads, addOptimisticMove] = useOptimistic(
    initialLeads,
    (state, { leadId, targetStageId }: { leadId: string; targetStageId: string }) =>
      state.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId } : l)),
  );

  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [quickViewLeadId, setQuickViewLeadId] = useState<string | null>(null);
  const moveError = useActionFeedback();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const leadById = new Map(optimisticLeads.map((l) => [l.id, l]));
  const activeLead = activeId ? (leadById.get(activeId) ?? null) : null;
  const quickViewLead = quickViewLeadId ? (leadById.get(quickViewLeadId) ?? null) : null;
  const quickViewStage = quickViewLead
    ? stages.find((s) => s.id === quickViewLead.stageId)
    : undefined;

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const targetStage = stages.find((s) => s.id === over.id);
    if (!targetStage) return;

    const leadId = String(active.id);
    const currentLead = leadById.get(leadId);
    if (!currentLead) return;
    if (currentLead.stageId === targetStage.id) return;

    if (targetStage.kind === 'lost' || targetStage.slug === 'paid') {
      setPendingTransition({ leadId, targetStage });
      return;
    }

    startTransition(async () => {
      addOptimisticMove({ leadId, targetStageId: targetStage.id });
      const result = await updateLeadStageAction({ leadId, targetStageId: targetStage.id });
      if (!result.ok) moveError.error(`não foi possível mover: ${result.error}`);
    });
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <header className="flex h-16 items-center gap-6 border-b border-line bg-paper px-8">
          <h1 className="text-h2 text-ink">pipeline.</h1>
          <ActionFeedback state={moveError.state} pendingLabel="movendo..." />
        </header>

        <div className="flex min-h-0 flex-1 gap-6 overflow-x-auto overflow-y-hidden p-6">
          <DndContext
            sensors={sensors}
            onDragStart={({ active }) => setActiveId(String(active.id))}
            onDragEnd={handleDragEnd}
          >
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={optimisticLeads.filter((l) => l.stageId === stage.id)}
                onSelectLead={(l) => setQuickViewLeadId(l.id)}
              />
            ))}

            <DragOverlay>
              {activeLead ? <LeadCard lead={activeLead} isDragOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <LeadQuickView
        lead={quickViewLead}
        stage={quickViewStage}
        onClose={() => setQuickViewLeadId(null)}
      />

      <TransitionSheet
        transition={pendingTransition}
        lossReasons={lossReasons}
        onClose={() => setPendingTransition(null)}
        onConfirm={(extras) => {
          if (!pendingTransition) return;
          const { leadId, targetStage } = pendingTransition;
          setPendingTransition(null);
          startTransition(async () => {
            addOptimisticMove({ leadId, targetStageId: targetStage.id });
            const result = await updateLeadStageAction({
              leadId,
              targetStageId: targetStage.id,
              ...extras,
            });
            if (!result.ok) moveError.error(`não foi possível mover: ${result.error}`);
          });
        }}
      />
    </>
  );
}

type TransitionExtras = {
  motivoPerdaId?: string;
  valorProposto?: string;
  formaPagamentoNegociada?: string;
};

function TransitionSheet({
  transition,
  lossReasons,
  onClose,
  onConfirm,
}: {
  transition: PendingTransition | null;
  lossReasons: LossReason[];
  onClose: () => void;
  onConfirm: (extras: TransitionExtras) => void;
}) {
  const isLost = transition?.targetStage.kind === 'lost';
  const isPaid = transition?.targetStage.slug === 'paid';

  return (
    <Sheet open={!!transition} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" width="sm">
        <SheetHeader>
          <SheetTitle>
            mover para {transition?.targetStage.displayName.toLowerCase() ?? ''}.
          </SheetTitle>
          <SheetDescription>
            {isLost
              ? 'Selecione o motivo da perda para registrar o histórico.'
              : 'Informe o valor e a forma de pagamento negociados.'}
          </SheetDescription>
        </SheetHeader>

        {isLost && (
          <LostForm
            lossReasons={lossReasons}
            onConfirm={(motivoPerdaId) => onConfirm({ motivoPerdaId })}
            onCancel={onClose}
          />
        )}
        {isPaid && !isLost && (
          <PaidForm
            onConfirm={(valorProposto, formaPagamentoNegociada) =>
              onConfirm({ valorProposto, formaPagamentoNegociada })
            }
            onCancel={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LostForm({
  lossReasons,
  onConfirm,
  onCancel,
}: {
  lossReasons: LossReason[];
  onConfirm: (motivoPerdaId: string) => void;
  onCancel: () => void;
}) {
  const [motivo, setMotivo] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (motivo) onConfirm(motivo);
      }}
      className="flex flex-1 flex-col"
    >
      <SheetBody>
        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo da perda</Label>
          <Select
            id="motivo"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            <option value="">Selecione...</option>
            {lossReasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </Select>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          cancelar
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={!motivo}>
          confirmar
        </Button>
      </SheetFooter>
    </form>
  );
}

function PaidForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (valorProposto: string, formaPagamentoNegociada: string) => void;
  onCancel: () => void;
}) {
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valor && forma) onConfirm(valor, forma);
      }}
      className="flex flex-1 flex-col"
    >
      <SheetBody>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              required
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="5000.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forma">Forma de pagamento</Label>
            <Select
              id="forma"
              required
              value={forma}
              onChange={(e) => setForma(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="boleto">Boleto</option>
              <option value="transferencia">Transferência bancária</option>
              <option value="parcelado">Parcelado</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          cancelar
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={!valor || !forma}>
          confirmar
        </Button>
      </SheetFooter>
    </form>
  );
}
