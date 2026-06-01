'use server';

import { requireAuth } from '@/server/auth';
import { searchLeads } from '@/server/queries/search';

export type PaletteLeadResult = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
  whatsappE164: string | null;
  stageId: string;
};

export async function searchLeadsForPalette(
  query: string,
): Promise<PaletteLeadResult[]> {
  await requireAuth();
  if (!query.trim()) return [];
  return searchLeads(query);
}
