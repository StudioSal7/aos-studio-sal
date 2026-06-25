/**
 * Atualiza o conteúdo do form `aplicacao-sal` JÁ gravado em produção.
 * O seed (seed-aplicacao-sal.ts) é idempotente e PULA forms existentes — então
 * mudanças de copy em telas já criadas precisam de UPDATE explícito (este script).
 *
 * Operação NÃO-DESTRUTIVA: só faz UPDATE do `subtitulo` da tela "aviso importante"
 * (ordem 1), inserindo os marcadores de itálico `*...*` que o runtime renderiza
 * como <em> (ver renderInline em components/forms/fields.tsx).
 *
 * Idempotente: rodar de novo grava o mesmo texto.
 * Rodar: pnpm --filter crm update-aplicacao-sal-copy
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

const SLUG = 'aplicacao-sal';
const AVISO_ORDEM = 1;

const AVISO_SUBTITULO =
  'Somos uma agência boutique, comprometida com um atendimento *personalizado, próximo e artesanal* e, devido à alta demanda, precisamos selecionar com carinho os projetos que melhor se alinham com a transformação que podemos promover.\n*Acreditamos que você nos escolhe, mas nós também escolhemos você.*\nPor isso, nem todos os projetos que recebemos seguem adiante.\n\nTe agradecemos desde já pela compreensão e te retornaremos o quanto antes (fique atenta ao whatsapp e email – principalmente a caixa de spam).\n\nVamos lá?';

async function main() {
  const [form] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, SLUG))
    .limit(1);

  if (!form) {
    console.error(`Form '${SLUG}' não encontrado — nada a atualizar.`);
    process.exit(1);
  }

  const updated = await db
    .update(schema.formFields)
    .set({ subtitulo: AVISO_SUBTITULO })
    .where(and(eq(schema.formFields.formId, form.id), eq(schema.formFields.ordem, AVISO_ORDEM)))
    .returning({ id: schema.formFields.id, titulo: schema.formFields.titulo });

  if (updated.length === 0) {
    console.error(`Tela ordem=${AVISO_ORDEM} não encontrada no form '${SLUG}'.`);
    process.exit(1);
  }

  console.warn(`✅ Atualizado subtítulo da tela "${updated[0]!.titulo}" (${updated[0]!.id}). URL: /f/${SLUG}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Update form copy failed:', err);
  process.exit(1);
});
