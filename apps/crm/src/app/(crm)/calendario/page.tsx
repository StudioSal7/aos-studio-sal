import { and, between, eq, isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { startOfWeek, endOfWeek } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import { cn } from '@repo/ui';
import { PageHeader } from '@/components/ui/page-header';
import { RenataWeekAgenda } from '@/app/(crm)/_components/renata-week-agenda';

const SP_TZ = 'America/Sao_Paulo';

export default async function CalendarioPage() {
  const nowUtc = new Date();
  const nowSp = toZonedTime(nowUtc, SP_TZ);
  const weekStart = startOfWeek(nowSp, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(nowSp, { weekStartsOn: 1 });

  const meetings = await db
    .select({
      id: schema.meetings.id,
      leadId: schema.meetings.leadId,
      leadName: schema.leads.name,
      leadNickname: schema.leads.nickname,
      scheduledAt: schema.meetings.scheduledAt,
      link: schema.meetings.link,
      status: schema.meetings.status,
      needsConfirmation: schema.meetings.needsConfirmation,
    })
    .from(schema.meetings)
    .leftJoin(schema.leads, eq(schema.meetings.leadId, schema.leads.id))
    .where(
      and(
        isNull(schema.meetings.deletedAt),
        eq(schema.meetings.status, 'agendada'),
        between(schema.meetings.scheduledAt, weekStart, weekEnd),
      ),
    )
    .orderBy(schema.meetings.scheduledAt);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`calendário — semana atual (${meetings.length} reuniões).`}
      />

      <div className="grid gap-8 p-8 lg:grid-cols-[1fr_380px]">
        <div>
        {meetings.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhuma reunião agendada para esta semana.
          </p>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <Link
                key={m.id}
                href={`/leads/${m.leadId}`}
                className={cn(
                  'flex items-center justify-between border bg-paper px-6 py-4 transition-colors hover:bg-canvas',
                  m.needsConfirmation
                    ? 'border-line border-l-2 border-l-wood'
                    : 'border-line',
                )}
              >
                <div>
                  <p className="text-body text-ink">
                    {m.leadNickname ?? m.leadName ?? 'Lead'}
                  </p>
                  {m.link && (
                    <a
                      href={m.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-micro text-ink underline-offset-2 hover:underline normal-case tracking-normal"
                    >
                      abrir link
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-body text-ink">
                    {m.scheduledAt
                      ? toZonedTime(new Date(m.scheduledAt), SP_TZ).toLocaleString(
                          'pt-BR',
                          {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )
                      : '—'}
                  </p>
                  {m.needsConfirmation && (
                    <p className="text-micro text-wood">confirmar realização</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>

        <aside className="self-start">
          <RenataWeekAgenda />
        </aside>
      </div>
    </div>
  );
}
