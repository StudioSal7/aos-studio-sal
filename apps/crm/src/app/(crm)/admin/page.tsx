import { requireAuth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { PageHeader } from '@/components/ui/page-header';
import { InviteUserForm } from './_components/invite-user-form';
import { GoogleAgendaSection } from './_components/google-agenda-section';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; google_error?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const params = await searchParams;
  const googleBanner = params.google === 'connected' ? 'connected' : (params.google_error ?? null);

  // Nunca selecionar colunas de token — só metadados de exibição.
  const googleAccounts = await db
    .select({
      id: schema.googleAccounts.id,
      googleEmail: schema.googleAccounts.googleEmail,
      isActive: schema.googleAccounts.isActive,
      lastSyncError: schema.googleAccounts.lastSyncError,
    })
    .from(schema.googleAccounts)
    .orderBy(schema.googleAccounts.createdAt);

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      pendingInvite: schema.users.pendingInvite,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt))
    .orderBy(schema.users.createdAt);

  const stages = await db
    .select()
    .from(schema.leadStages)
    .orderBy(schema.leadStages.position);

  const lossReasons = await db
    .select()
    .from(schema.leadLossReasons)
    .orderBy(schema.leadLossReasons.displayName);

  return (
    <div className="flex flex-col">
      <PageHeader title="admin." />

      <div className="space-y-12 p-8">
        <section>
          <h2 className="mb-4 text-h3 text-ink">usuários.</h2>
          <div className="mb-6 overflow-hidden border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Papel
                  </th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3 text-body text-ink">{u.email}</td>
                    <td className="px-6 py-3 text-body text-ink-muted">{u.role}</td>
                    <td className="px-6 py-3 text-micro text-ink-muted">
                      {u.pendingInvite ? 'Convite pendente' : 'Ativo'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InviteUserForm />
        </section>

        <section>
          <h2 className="mb-4 text-h3 text-ink">agenda google.</h2>
          <GoogleAgendaSection accounts={googleAccounts} banner={googleBanner} />
        </section>

        <section>
          <h2 className="mb-4 text-h3 text-ink">estágios.</h2>
          <div className="overflow-hidden border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Nome de exibição
                  </th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3 font-mono text-micro text-ink-muted normal-case tracking-normal">
                      {s.slug}
                    </td>
                    <td className="px-6 py-3 text-body text-ink">{s.displayName}</td>
                    <td className="px-6 py-3 text-micro text-ink-muted">{s.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 text-ink">motivos de perda.</h2>
          <div className="overflow-hidden border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">
                    Nome
                  </th>
                </tr>
              </thead>
              <tbody>
                {lossReasons.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3 font-mono text-micro text-ink-muted normal-case tracking-normal">
                      {r.slug}
                    </td>
                    <td className="px-6 py-3 text-body text-ink">{r.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
