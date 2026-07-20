// Bucket privado com os templates .docx de contrato (um por tipo de produto —
// mentoria/infoproduto). Trocável por upload no /admin sem deploy. Usa o
// service-role client (mesmo padrão de server/actions/users.ts) porque o
// bucket é privado e o CRUD é owner-only, não RLS por usuário.

import { createClient } from '@supabase/supabase-js';
import type { ProductTipo } from '@repo/db/schema';

export const CONTRACT_TEMPLATES_BUCKET = 'contract-templates';

const CONTENT_TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function templatePathForTipo(tipo: ProductTipo): string {
  return `${tipo}.docx`;
}

/** Idempotente — ignora "already exists". Chamado defensivamente antes do upload. */
async function ensureBucketExists(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(CONTRACT_TEMPLATES_BUCKET, { public: false });
  // Supabase não expõe um código estável de "já existe" entre versões — checa a mensagem.
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

/** null quando o template desse tipo ainda não foi enviado (rascunho sai com placeholders vazios seria pior — ver caller). */
export async function downloadContractTemplate(tipo: ProductTipo): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(CONTRACT_TEMPLATES_BUCKET).download(templatePathForTipo(tipo));
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadContractTemplate(tipo: ProductTipo, file: Buffer): Promise<void> {
  await ensureBucketExists();
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(CONTRACT_TEMPLATES_BUCKET)
    .upload(templatePathForTipo(tipo), file, { upsert: true, contentType: CONTENT_TYPE_DOCX });
  if (error) throw error;
}

export type ContractTemplateStatus = {
  tipo: ProductTipo;
  exists: boolean;
  updatedAt: string | null;
};

// Só os tipos de produto que têm contrato assinado. infoproduto é venda
// self-serve (Método SAL, Central de Conteúdo) — não gera contrato.
export const CONTRACT_TIPOS: ProductTipo[] = ['mentoria', 'assessoria', 'branding_pessoal'];

/** Status dos templates pros tipos com contrato — usado no /admin/contratos. */
export async function listContractTemplatesStatus(): Promise<ContractTemplateStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(CONTRACT_TEMPLATES_BUCKET).list('', { limit: 100 });
  const byName = new Map((data ?? []).map((f) => [f.name, f]));

  return CONTRACT_TIPOS.map((tipo) => {
    const file = byName.get(templatePathForTipo(tipo));
    return {
      tipo,
      exists: Boolean(file),
      updatedAt: file?.updated_at ?? null,
    };
  });
}
