import { getKanbanLeads, getAllLossReasons } from '@/server/queries/leads';
import { KanbanBoard } from '../_components/kanban-board';

export default async function KanbanPage() {
  const [{ stages, leads }, lossReasons] = await Promise.all([
    getKanbanLeads(),
    getAllLossReasons(),
  ]);
  const serializedLeads = leads.map((l) => ({
    ...l,
    nextActionAt: l.nextActionAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));
  return <KanbanBoard stages={stages} leads={serializedLeads} lossReasons={lossReasons} />;
}
