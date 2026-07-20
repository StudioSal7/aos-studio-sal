/**
 * Sobe os templates .docx canônicos (apps/crm/contract-templates/*.docx) para
 * o bucket privado do Supabase Storage. Idempotente (upsert). Rodar após
 * regenerar os templates (contract-templates/build.py) ou para restaurar o
 * default. O dono também pode subir a versão dele por /admin/contratos.
 *
 *   pnpm --filter crm upload-contract-templates
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'contract-templates';
const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// Só os tipos de produto com contrato assinado (infoproduto é self-serve).
const TIPOS = ['mentoria', 'assessoria', 'branding_pessoal'] as const;

const TEMPLATES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../contract-templates');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes');

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { error: bucketError } = await admin.storage.createBucket(BUCKET, { public: false });
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

  for (const tipo of TIPOS) {
    const buffer = readFileSync(resolve(TEMPLATES_DIR, `${tipo}.docx`));
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(`${tipo}.docx`, buffer, { upsert: true, contentType: CONTENT_TYPE });
    if (error) throw error;
    console.log(`✓ ${tipo}.docx (${buffer.length} bytes)`);
  }
  console.log('templates de contrato atualizados no Storage.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
