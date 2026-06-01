import { getAllStages } from '@/server/queries/leads';
import { searchLeads } from '@/server/queries/search';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const stageFilter = params.stage;

  const [results, stages] = await Promise.all([
    query ? searchLeads(query, stageFilter ? { stageId: stageFilter } : {}) : [],
    getAllStages(),
  ]);

  const stageMap = new Map(stages.map((s) => [s.id, s.displayName]));

  return (
    <div className="flex flex-col">
      <header className="flex h-16 items-center gap-4 border-b border-line bg-paper px-8">
        <form method="GET" action="/busca" className="flex flex-1 items-center gap-3">
          <Input
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="buscar por nome, apelido, e-mail, whatsapp..."
            className="flex-1 px-3 py-2 text-body"
          />
          <Select
            name="stage"
            defaultValue={stageFilter ?? ''}
            className="w-56 px-3 py-2 text-body"
          >
            <option value="">Todos os estágios</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="solid" size="sm">
            buscar
          </Button>
        </form>
      </header>

      <div className="p-8">
        {!query && (
          <p className="text-body text-ink-muted">
            Digite pelo menos 1 caractere para buscar.
          </p>
        )}
        {query && results.length === 0 && (
          <p className="text-body text-ink-muted">
            Nenhum lead encontrado para &quot;{query}&quot;.
          </p>
        )}
        {results.length > 0 && (
          <div className="space-y-3">
            <p className="mb-4 text-micro text-ink-muted">
              {results.length} resultado{results.length !== 1 ? 's' : ''} para &quot;
              {query}&quot;
            </p>
            {results.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between border border-line bg-paper px-6 py-4 transition-colors hover:bg-canvas"
              >
                <div className="min-w-0">
                  <p className="text-body text-ink">
                    {lead.nickname ? (
                      <>
                        {lead.nickname}{' '}
                        <span className="text-ink-muted">({lead.name})</span>
                      </>
                    ) : (
                      lead.name ?? <span className="italic text-ink-muted">sem nome</span>
                    )}
                  </p>
                  <p className="truncate text-micro text-ink-muted normal-case tracking-normal">
                    {lead.email ?? lead.whatsappE164 ?? lead.instagramHandle ?? '—'}
                  </p>
                </div>
                <Badge className="ml-4 shrink-0">
                  {stageMap.get(lead.stageId) ?? '—'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
