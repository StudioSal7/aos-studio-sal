/**
 * Cria o formulário de aplicação do Studio Sal — réplica do form Respondi.
 * Slug: `aplicacao-sal`  →  URL pública: /f/aplicacao-sal
 *
 * Estrutura (ordem das telas):
 *  0. boas_vindas — intro "APLICAÇÃO | STUDIO SAL"
 *  1. boas_vindas — aviso importante (seletividade boutique)
 *  2. texto_curto — nome completo           → leads.name
 *  3. texto_curto — apelido                 → leads.nickname
 *  4. email       — melhor email            → leads.email
 *  5. telefone    — celular/WhatsApp        → leads.whatsapp_e164
 *  6. select      — idade                   → leads.idade_faixa (enum + map)
 *  7. select      — como nos conheceu       → leads.lead_source_id (via leadSourceSlug + map)
 *  8. texto_curto — @ nas redes sociais     → leads.instagram_handle
 *  9. texto_longo — trabalho/momento atual  → leads.profissao
 * 10. select      — tempo no nicho          → leads.tempo_no_nicho_faixa (enum + map)
 * 11. multi_select — desafios do dia a dia  → não mapeado (vive em form_responses.dados)
 * 12. boas_vindas — sobre o investimento (statement intermediário)
 * 13. select      — abordagem preferida     → leads.abordagem_preferida (enum + map)
 * 14. select      — renda mensal            → leads.renda_faixa (texto)
 * 15. select      — orçamento               → leads.orcamento_faixa (texto)
 * 16. encerramento
 *
 * Idempotente: pula sem apagar se o slug já existir.
 * Rodar: pnpm --filter crm seed-aplicacao-sal
 */

import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

const SLUG = 'aplicacao-sal';

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
      titulo: 'Aplicação | Studio Sal',
      descricao: 'Formulário de aplicação para as jornadas do Studio Sal.',
      slug: SLUG,
      status: 'ativo',
      config: {
        mensagemFinal:
          'Recebemos sua aplicação com muito carinho! Logo entraremos em contato pelo WhatsApp e email — fique atenta à caixa de spam.',
        coletarUtm: true,
        backgroundImage: '/sal-fundo.jpg',
      },
    })
    .returning({ id: schema.forms.id });

  if (!form) throw new Error('falha ao criar form');

  await db.insert(schema.formFields).values([
    // ─── 0. Tela de boas-vindas ──────────────────────────────────────────────
    {
      formId: form.id,
      ordem: 0,
      tipo: 'boas_vindas',
      titulo: 'APLICAÇÃO | STUDIO SAL',
      subtitulo:
        'Agradecemos o seu interesse em ser traduzida pela Sal junto de centenas de mulheres maravilhosas que estão deixando sua marca no mundo!\n\nAqui o tempo de todos é sagrado: de quem trabalha conosco, das nossas clientes e também das potenciais clientes. Por isso, temos um aviso importante, podemos contar com o valor da sua atenção?',
      obrigatorio: false,
      config: { botaoTexto: 'Claro!' },
    },

    // ─── 1. Aviso importante ─────────────────────────────────────────────────
    {
      formId: form.id,
      ordem: 1,
      tipo: 'boas_vindas',
      titulo: 'AVISO IMPORTANTE',
      subtitulo:
        'Somos uma agência boutique, comprometida com um atendimento *personalizado, próximo e artesanal* e, devido à alta demanda, precisamos selecionar com carinho os projetos que melhor se alinham com a transformação que podemos promover.\n*Acreditamos que você nos escolhe, mas nós também escolhemos você.*\nPor isso, nem todos os projetos que recebemos seguem adiante.\n\nTe agradecemos desde já pela compreensão e te retornaremos o quanto antes (fique atenta ao whatsapp e email – principalmente a caixa de spam).\n\nVamos lá?',
      obrigatorio: false,
      config: { botaoTexto: 'Vamos!' },
    },

    // ─── 2. Nome completo → leads.name ───────────────────────────────────────
    {
      formId: form.id,
      ordem: 2,
      tipo: 'texto_curto',
      titulo: 'Primeiro, queremos te conhecer um pouco melhor! Como você se chama?',
      subtitulo: 'Por favor, coloque seu nome e sobrenome',
      placeholder: 'Sua resposta...',
      obrigatorio: true,
      leadMapping: 'name',
    },

    // ─── 3. Apelido → leads.nickname ─────────────────────────────────────────
    {
      formId: form.id,
      ordem: 3,
      tipo: 'texto_curto',
      titulo: 'Como você gostaria de ser chamada?',
      subtitulo:
        'Por aqui, gostamos do carinho que vem em forma apelidos e queremos te dar esse abraço, mesmo antes de te conhecer pessoalmente.',
      placeholder: 'Sua resposta...',
      obrigatorio: true,
      leadMapping: 'nickname',
    },

    // ─── 4. Email → leads.email ──────────────────────────────────────────────
    {
      formId: form.id,
      ordem: 4,
      tipo: 'email',
      titulo: 'Qual o seu melhor email?',
      subtitulo:
        'É importante que você acompanhe sua caixa de spam, mandaremos informações importantes sobre sua jornada conosco por lá!',
      placeholder: 'voce@email.com',
      obrigatorio: true,
      leadMapping: 'email',
    },

    // ─── 5. Celular → leads.whatsapp_e164 ────────────────────────────────────
    {
      formId: form.id,
      ordem: 5,
      tipo: 'telefone',
      titulo: 'Qual o seu melhor celular?',
      subtitulo: 'Se sua aplicação for acolhida, mandaremos um whatsapp para ele',
      placeholder: '(11) 99900-0000',
      obrigatorio: true,
      leadMapping: 'whatsappE164',
    },

    // ─── 6. Idade → leads.idade_faixa (enum) ─────────────────────────────────
    {
      formId: form.id,
      ordem: 6,
      tipo: 'select',
      titulo: 'Qual a sua idade',
      obrigatorio: true,
      leadMapping: 'idadeFaixa',
      config: {
        opcoes: [
          'tenho menos de 18 anos',
          'entre 19 e 24 anos',
          'entre 25 e 34 anos',
          'entre 35 e 44 anos',
          'entre 45 e 54 anos',
          'entre 55 e 64 anos',
          'tenho mais de 65 anos',
        ],
      },
      leadEnumMap: {
        'entre 19 e 24 anos': '19_a_24',
        'entre 25 e 34 anos': '25_a_34',
        'entre 35 e 44 anos': '35_a_44',
        'entre 45 e 54 anos': '45_a_54',
        'entre 55 e 64 anos': '55_a_64',
      },
    },

    // ─── 7. Como conheceu → leads.lead_source_id (via leadSourceSlug) ────────
    {
      formId: form.id,
      ordem: 7,
      tipo: 'select',
      titulo: 'Como você nos conheceu?',
      obrigatorio: true,
      leadMapping: 'leadSourceSlug',
      config: {
        opcoes: [
          'através da Giu Salvatore',
          'reels ou postagem no instagram de vocês',
          'uma pessoa me indicou vocês',
          'Outro...',
        ],
      },
      leadEnumMap: {
        'através da Giu Salvatore': 'giu_salvatore_indicacao',
        'reels ou postagem no instagram de vocês': 'instagram_organico',
        'uma pessoa me indicou vocês': 'indicacao_pessoal',
        'Outro...': 'outro',
      },
    },

    // ─── 8. Instagram → leads.instagram_handle ───────────────────────────────
    {
      formId: form.id,
      ordem: 8,
      tipo: 'texto_curto',
      titulo: 'Qual seu @ oficial nas redes sociais?',
      subtitulo: 'se preferir, pode também deixar algum link aqui no qual possamos te conhecer melhor',
      placeholder: 'Sua resposta...',
      obrigatorio: false,
      leadMapping: 'instagramHandle',
    },

    // ─── 9. Trabalho/momento → leads.profissao ───────────────────────────────
    {
      formId: form.id,
      ordem: 9,
      tipo: 'texto_longo',
      titulo: 'Nos conte um pouco sobre seu trabalho e o momento atual da sua jornada',
      subtitulo:
        '_caso trabalhe no corporativo, por favor indique empresa e cargo.\n_caso trabalhe como autônoma ou empresária, por favor indique nicho e momento do negócio:',
      placeholder: 'Sua resposta...',
      obrigatorio: true,
      leadMapping: 'profissao',
    },

    // ─── 10. Tempo no nicho → leads.tempo_no_nicho_faixa (enum) ─────────────
    {
      formId: form.id,
      ordem: 10,
      tipo: 'select',
      titulo: 'Há quanto tempo você está nesse nicho?',
      obrigatorio: true,
      leadMapping: 'tempoNoNichoFaixa',
      config: {
        opcoes: ['menos de 5 anos', 'entre 5 e 10 anos', 'entre 11 e 15 anos', 'mais de 16 anos'],
      },
      leadEnumMap: {
        'menos de 5 anos': 'menos_5',
        'entre 5 e 10 anos': '5_a_10',
        'entre 11 e 15 anos': '11_a_15',
        'mais de 16 anos': 'mais_16',
      },
    },

    // ─── 11. Desafios → não mapeado (vive em form_responses.dados) ───────────
    {
      formId: form.id,
      ordem: 11,
      tipo: 'multi_select',
      titulo: 'Qual ou quais desses desafios estão mais presentes no seu dia a dia?',
      obrigatorio: true,
      config: {
        opcoes: [
          'quero ter presença dentro do digital, mas não sei por onde começar',
          'sinto que as pessoas não enxergam e nem valorizam quem eu realmente sou',
          'já tentei outros cursos, mentorias e até social media, mas ninguém parece conseguir me ajudar com autenticidade',
          'preciso me reconectar e enxergar aquilo que me torna única',
          'quero fazer uma transição de carreira e preciso agregar valor à minha marca para sentir segurança',
          'não sei como traduzir quem eu sou em palavras ou imagem',
        ],
      },
    },

    // ─── 12. Statement intermediário — sobre o investimento ──────────────────
    {
      formId: form.id,
      ordem: 12,
      tipo: 'boas_vindas',
      titulo: 'sabemos que o investimento é uma parte importante da sua decisão',
      subtitulo:
        'e que, muitas vezes, ele depende não só do valor em si, mas do quanto a proposta faz sentido pra você. Por isso, as perguntas a seguir não são eliminatórias. Elas só nos ajudam a te direcionar melhor, com respeito ao seu momento atual e ao nosso tempo.',
      obrigatorio: false,
      config: { botaoTexto: 'Continuar' },
    },

    // ─── 13. Abordagem preferida → leads.abordagem_preferida (enum) ──────────
    {
      formId: form.id,
      ordem: 13,
      tipo: 'select',
      titulo: 'Qual dessas abordagens você sente que tem mais ressonância com seu momento agora?',
      obrigatorio: false,
      leadMapping: 'abordagemPreferida',
      config: {
        opcoes: [
          'busco uma orientação sensível e estratégica para que eu mesma aplique o necessário',
          'consigo investir mais e ter uma equipe que construa tudo comigo — com menos esforço da minha parte',
        ],
      },
      leadEnumMap: {
        'busco uma orientação sensível e estratégica para que eu mesma aplique o necessário':
          'orientacao_sensivel',
        'consigo investir mais e ter uma equipe que construa tudo comigo — com menos esforço da minha parte':
          'equipe_constroi',
      },
    },

    // ─── 14. Renda mensal → leads.renda_faixa (texto) ────────────────────────
    {
      formId: form.id,
      ordem: 14,
      tipo: 'select',
      titulo: 'Em seu lar, qual é a renda média mensal?',
      obrigatorio: false,
      leadMapping: 'rendaFaixa',
      config: {
        opcoes: [
          'até R$5.000 por mês',
          'de R$5.000 a R$10.000 por mês',
          'de R$10.000 a R$15.000 por mês',
          'de R$15.000 a R$20.000 por mês',
          'de R$20.000 a R$30.000 por mês',
          'de R$30.000 a R$50.000 por mês',
          'acima de R$50.000 por mês',
        ],
      },
    },

    // ─── 15. Orçamento → leads.orcamento_faixa (texto) ───────────────────────
    {
      formId: form.id,
      ordem: 15,
      tipo: 'select',
      titulo: 'Qual é seu orçamento atual para investir em sua marca pessoal com uma das melhores agências boutiques do mercado?',
      subtitulo: 'Considere que existem possibilidades de parcelamento inteligente.',
      obrigatorio: false,
      leadMapping: 'orcamentoFaixa',
      config: {
        opcoes: [
          'menos de R$8.000',
          'entre R$8.000 e R$12.000',
          'entre R$12.000 e R$15.000',
          'entre R$15.000 e R$20.000',
          'acima de R$20.000',
        ],
      },
    },

    // ─── 16. Encerramento ────────────────────────────────────────────────────
    {
      formId: form.id,
      ordem: 16,
      tipo: 'encerramento',
      titulo: 'Recebemos sua aplicação!',
      subtitulo:
        'Agradecemos seu interesse em ser traduzida pela Sal. Logo entraremos em contato pelo WhatsApp e email — fique atenta à caixa de spam.',
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
