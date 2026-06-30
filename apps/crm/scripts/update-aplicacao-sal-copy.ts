/**
 * Atualiza o conteúdo do form `aplicacao-sal` JÁ gravado em produção.
 * O seed (seed-aplicacao-sal.ts) é idempotente e PULA forms existentes — então
 * mudanças de copy em telas já criadas precisam de UPDATE explícito (este script).
 *
 * Operação NÃO-DESTRUTIVA: só faz UPDATE de campos de texto (subtitulo/titulo) de
 * telas específicas, casadas por `ordem`. Não apaga nada, não toca outras telas.
 *
 * Inclui:
 *  - tela 1  (aviso): subtítulo com marcadores de itálico `*...*` (renderInline).
 *  - telas 6,7,9,12,16: título com o token `{nome}` de personalização — o runtime
 *    substitui pelo apelido de "como você gostaria de ser chamada"
 *    (ver components/forms/personalization.ts).
 *
 * Idempotente: rodar de novo grava o mesmo texto.
 * Rodar: pnpm --filter crm update-aplicacao-sal-copy
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

const SLUG = 'aplicacao-sal';

const AVISO_SUBTITULO =
  'Somos uma agência boutique, comprometida com um atendimento *personalizado, próximo e artesanal* e, devido à alta demanda, precisamos selecionar com carinho os projetos que melhor se alinham com a transformação que podemos promover.\n*Acreditamos que você nos escolhe, mas nós também escolhemos você.*\nPor isso, nem todos os projetos que recebemos seguem adiante.\n\nTe agradecemos desde já pela compreensão e te retornaremos o quanto antes (fique atenta ao whatsapp e email – principalmente a caixa de spam).\n\nVamos lá?';

// Patches por tela (match por `ordem`). Mantém em sincronia com seed-aplicacao-sal.ts.
const UPDATES: Array<{ ordem: number; patch: Partial<typeof schema.formFields.$inferInsert> }> = [
  { ordem: 1, patch: { subtitulo: AVISO_SUBTITULO } },
  { ordem: 6, patch: { titulo: '{nome}, qual a sua idade?' } },
  { ordem: 7, patch: { titulo: 'E {nome}, como você nos conheceu?' } },
  {
    ordem: 9,
    patch: { titulo: '{nome}, nos conte um pouco sobre seu trabalho e o momento atual da sua jornada' },
  },
  { ordem: 12, patch: { titulo: '{nome}, sabemos que o investimento é uma parte importante da sua decisão' } },
  { ordem: 16, patch: { titulo: 'Recebemos sua aplicação, {nome}!' } },
];

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

  for (const { ordem, patch } of UPDATES) {
    const updated = await db
      .update(schema.formFields)
      .set(patch)
      .where(and(eq(schema.formFields.formId, form.id), eq(schema.formFields.ordem, ordem)))
      .returning({ id: schema.formFields.id, titulo: schema.formFields.titulo });

    if (updated.length === 0) {
      console.error(`⚠️  Tela ordem=${ordem} não encontrada no form '${SLUG}' — pulando.`);
      continue;
    }

    const campo = Object.keys(patch).join(', ');
    console.warn(`✅ ordem=${ordem} (${campo}) → "${updated[0]!.titulo}"`);
  }

  console.warn(`Concluído. URL: /f/${SLUG}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Update form copy failed:', err);
  process.exit(1);
});
