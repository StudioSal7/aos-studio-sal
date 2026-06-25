/**
 * Cria UM formulário "exemplo" ATIVO para validar a feature de Formulários
 * ponta a ponta (slice 1): rota pública /f/<slug> → submit → lead no kanban.
 *
 * Campos mínimos mapeados pra coluna do lead:
 *   - nome  → name
 *   - email → email
 *   - whatsapp → whatsappE164 (normalizado no submit)
 *
 * Idempotente: se o slug já existir, PULA sem apagar nada.
 *
 * Rodar: pnpm --filter crm seed-form-example
 */

import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

const SLUG = 'aplicacao-exemplo';

async function main() {
  const [existing] = await db
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, SLUG))
    .limit(1);

  if (existing) {
    console.warn(`Form '${SLUG}' já existe (${existing.id}) — pulando. URL: /f/${SLUG}`);
    process.exit(0);
  }

  const [form] = await db
    .insert(schema.forms)
    .values({
      titulo: 'Aplicação — exemplo',
      descricao: 'Formulário de teste da feature (slice 1).',
      slug: SLUG,
      status: 'ativo',
      config: {
        mensagemFinal: 'Recebemos sua aplicação. Em breve entraremos em contato.',
        coletarUtm: true,
      },
    })
    .returning({ id: schema.forms.id });

  if (!form) throw new Error('falha ao criar form');

  await db.insert(schema.formFields).values([
    {
      formId: form.id,
      ordem: 0,
      tipo: 'boas_vindas',
      titulo: 'Que bom te ver por aqui.',
      subtitulo: 'Leva menos de 1 minuto. Vamos começar?',
      obrigatorio: false,
      config: { botaoTexto: 'começar' },
    },
    {
      formId: form.id,
      ordem: 1,
      tipo: 'texto_curto',
      titulo: 'Qual o seu nome?',
      placeholder: 'Seu nome completo',
      obrigatorio: true,
      leadMapping: 'name',
    },
    {
      formId: form.id,
      ordem: 2,
      tipo: 'email',
      titulo: 'Qual o seu melhor email?',
      placeholder: 'voce@exemplo.com',
      obrigatorio: true,
      leadMapping: 'email',
    },
    {
      formId: form.id,
      ordem: 3,
      tipo: 'telefone',
      titulo: 'E o seu WhatsApp?',
      subtitulo: 'É por onde vamos te chamar.',
      placeholder: '(11) 90000-0000',
      obrigatorio: true,
      leadMapping: 'whatsappE164',
    },
    {
      formId: form.id,
      ordem: 4,
      tipo: 'encerramento',
      titulo: 'Tudo certo!',
      obrigatorio: false,
    },
  ]);

  console.warn(`✅ Form '${SLUG}' criado (${form.id}). URL pública: /f/${SLUG}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed form failed:', err);
  process.exit(1);
});
