import { getKanbanLeads, getAllLossReasons } from '@/server/queries/leads';
import { listActiveProducts } from '@/server/queries/products';
import { computeFirstContactSignal } from '@/server/lib/first-contact-urgency';
import { KanbanBoard } from '../_components/kanban-board';

export default async function KanbanPage() {
  const [{ stages, leads }, lossReasons, products] = await Promise.all([
    getKanbanLeads(),
    getAllLossReasons(),
    listActiveProducts(),
  ]);
  const stageSlugById = new Map(stages.map((s) => [s.id, s.slug]));
  const now = new Date();
  const serializedLeads = leads.map(({ applicationReceivedAt, ...l }) => ({
    ...l,
    nextActionAt: l.nextActionAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    firstContactSignal: computeFirstContactSignal({
      stageSlug: stageSlugById.get(l.stageId) ?? '',
      applicationReceivedAt,
      now,
    }),
  }));
  return (
    <KanbanBoard
      stages={stages}
      leads={serializedLeads}
      lossReasons={lossReasons}
      products={products}
    />
  );
}
