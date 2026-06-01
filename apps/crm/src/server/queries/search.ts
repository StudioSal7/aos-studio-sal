import { desc } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { buildLeadSearchWhere, type SearchFilters } from '@/server/lib/search-query-builder/index';

const SEARCH_LIMIT = 20;

export async function searchLeads(query: string, filters: SearchFilters = {}) {
  const where = buildLeadSearchWhere(query, filters);

  return db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      email: schema.leads.email,
      whatsappE164: schema.leads.whatsappE164,
      instagramHandle: schema.leads.instagramHandle,
      stageId: schema.leads.stageId,
    })
    .from(schema.leads)
    .where(where)
    .orderBy(desc(schema.leads.updatedAt))
    .limit(SEARCH_LIMIT);
}
