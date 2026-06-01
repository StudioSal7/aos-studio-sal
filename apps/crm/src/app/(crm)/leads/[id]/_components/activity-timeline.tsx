import { ArrowRight, Calendar, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { ConfirmMeetingForm } from './confirm-meeting-form';

type Meeting = {
  id: string;
  scheduledAt: Date | string;
  link: string | null;
  status: 'agendada' | 'realizada' | 'nao_realizada' | 'reagendada' | 'cancelada';
  needsConfirmation: boolean;
  notesPostCall: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StageHistory = {
  id: string;
  fromStageId: string | null;
  toStageId: string;
  changedAt: Date | string;
};

type Stage = { id: string; displayName: string };

type TimelineItem =
  | {
      kind: 'meeting';
      id: string;
      at: Date;
      meeting: Meeting;
    }
  | {
      kind: 'stage';
      id: string;
      at: Date;
      history: StageHistory;
    };

export function ActivityTimeline({
  meetings,
  stageHistory,
  stages,
  leadId,
}: {
  meetings: Meeting[];
  stageHistory: StageHistory[];
  stages: Map<string, Stage>;
  leadId: string;
}) {
  const items: TimelineItem[] = [
    ...meetings.map<TimelineItem>((m) => ({
      kind: 'meeting',
      id: `m-${m.id}`,
      at: new Date(m.scheduledAt),
      meeting: m,
    })),
    ...stageHistory.map<TimelineItem>((h) => ({
      kind: 'stage',
      id: `s-${h.id}`,
      at: new Date(h.changedAt),
      history: h,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (items.length === 0) {
    return (
      <p className="text-body text-ink-muted">Nenhuma atividade registrada ainda.</p>
    );
  }

  return (
    <ol className="relative space-y-4">
      {items.map((item) =>
        item.kind === 'meeting' ? (
          <MeetingItem key={item.id} meeting={item.meeting} leadId={leadId} />
        ) : (
          <StageItem key={item.id} history={item.history} stages={stages} />
        ),
      )}
    </ol>
  );
}

function MeetingItem({ meeting, leadId }: { meeting: Meeting; leadId: string }) {
  const date = new Date(meeting.scheduledAt);
  const dateStr = date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const { Icon, label, accent } = describeMeeting(meeting);

  return (
    <li className="flex gap-3 border-l-2 border-line pl-4">
      <div className={`-ml-[1.05rem] mt-0.5 flex h-5 w-5 items-center justify-center bg-paper ${accent}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-micro text-ink-muted">{label}</span>
          <span className="text-micro text-ink-muted normal-case tracking-normal">
            {dateStr}
          </span>
        </div>
        {meeting.link && (
          <a
            href={meeting.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-body text-wood underline-offset-2 hover:underline"
          >
            {meeting.link}
          </a>
        )}
        {meeting.notesPostCall && (
          <p className="whitespace-pre-wrap text-body text-ink">{meeting.notesPostCall}</p>
        )}
        {meeting.needsConfirmation && (
          <ConfirmMeetingForm meetingId={meeting.id} leadId={leadId} />
        )}
      </div>
    </li>
  );
}

function describeMeeting(m: Meeting): {
  Icon: typeof Calendar;
  label: string;
  accent: string;
} {
  switch (m.status) {
    case 'realizada':
      return { Icon: CheckCircle2, label: 'reunião realizada', accent: 'text-leaf' };
    case 'nao_realizada':
      return { Icon: XCircle, label: 'reunião não aconteceu', accent: 'text-clay' };
    case 'reagendada':
      return { Icon: RotateCcw, label: 'reunião reagendada', accent: 'text-ink-muted' };
    case 'cancelada':
      return { Icon: XCircle, label: 'reunião cancelada', accent: 'text-ink-muted' };
    case 'agendada':
    default:
      return { Icon: Calendar, label: 'reunião agendada', accent: 'text-wood' };
  }
}

function StageItem({
  history,
  stages,
}: {
  history: StageHistory;
  stages: Map<string, Stage>;
}) {
  const fromName = history.fromStageId
    ? stages.get(history.fromStageId)?.displayName
    : null;
  const toName = stages.get(history.toStageId)?.displayName ?? '?';
  const date = new Date(history.changedAt);
  const dateStr = date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="flex gap-3 border-l-2 border-line pl-4">
      <div className="-ml-[1.05rem] mt-0.5 flex h-5 w-5 items-center justify-center bg-paper text-ink-muted">
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-micro text-ink-muted">mudança de estágio</span>
          <span className="text-micro text-ink-muted normal-case tracking-normal">
            {dateStr}
          </span>
        </div>
        <p className="text-body text-ink">
          {fromName ? <span className="text-ink-muted">{fromName} → </span> : null}
          <span>{toName}</span>
        </p>
      </div>
    </li>
  );
}
