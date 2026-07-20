import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/page-header';

export default function TarefasPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="tarefas." />

      <div className="mx-auto w-full max-w-3xl space-y-10 p-8">
        <section className="space-y-4">
          <h2 className="text-h2 text-ink">contexto.</h2>

          <div className="space-y-1">
            <h3 className="text-h3 text-ink normal-case">Giulia Salvatore — Studio Sal</h3>
          </div>

          <Block title="Resumo Executivo">
            <P>
              Giulia Salvatore é fundadora do Estúdio Sal, agência boutique de branding e design
              para marcas pessoais. Rodrigo atua como consultor em duas frentes: IA (Skills/agentes
              para a operação dela) e Revenue Operations (otimização do funil ponta a ponta +
              centralização do comercial na plataforma BA Hub).
            </P>
            <P>
              <strong>Modelo comercial:</strong> 15% sobre o faturamento da mentoria + 20% sobre as
              vendas do curso, repasse mensal. Rodrigo tem porcentagem na mentoria, então não há
              conflito de interesse com a consultoria.
            </P>
            <P>
              Categorizado como unidade Treevium (tre) nos arquivos de transcrição; o registro de
              clients_active está como aurea. Ver nota de discrepância no fim.
            </P>
          </Block>

          <Block title="Equipe e Operação">
            <P>Operação enxuta de 4 pessoas:</P>
            <UL
              items={[
                <><strong>Giulia</strong> — CEO, rosto da marca, conteúdo</>,
                <><strong>Renata (Rê) Restaino</strong> — closer; fecha todos os produtos de ticket alto e decide qual produto apresentar quando a cliente chega</>,
                <><strong>Ana</strong> — atendimento/SDR; recebe os formulários, faz o primeiro contato e marca as reuniões com a Rê</>,
                <><strong>André</strong> — operação/produção (sendo treinado em Skills de Claude)</>,
              ]}
            />
            <P>
              Sofia foi desligada da equipe (decisão de 18/05/2026) — perfil pouco adaptável a IA e
              atrasos em entregas simples. Espera-se algum impacto na velocidade de entregas no
              curto prazo.
            </P>
            <P>
              <strong>Fluxo comercial atual:</strong>
            </P>
            <P>Lead → Formulário → Ana faz contato → marca reunião com a Rê → Rê fecha</P>
            <P>
              Ferramentas: Notion (entrega para clientes — permanece, pois clientes resistem a
              migrar), Google Meet (gravação/transcrição das reuniões com clientes), Hotmart
              (checkout, sob avaliação de migração). O processo comercial (CRM, transcrições,
              WhatsApp, tráfego pago) está sendo centralizado na plataforma BA Hub do Rodrigo.
            </P>
          </Block>

          <Block title="Produtos">
            <UL
              items={[
                <><strong>Consultoria</strong> — entrega individual de alto valor</>,
                <><strong>Mentoria</strong> — encontros ao vivo já em andamento (retomados após o retiro); ~4 mentoriadas rodando, número que se quer aumentar</>,
                <><strong>Método Sal</strong> — produto intermediário/core (~R$ 800+); ~23 alunos no mês de maio</>,
                <><strong>Curso de Criação de Conteúdo</strong> — recém-gravado, em finalização; venda de entrada ~R$ 297 (e bundle com o template)</>,
                <><strong>Template de Notion</strong> — produto de entrada barato (~R$ 97/297, acompanha aula); gerando interesse (lista de espera nos stories)</>,
                <><strong>Podcast</strong> — 4 episódios gravados; peça do funil/comunidade</>,
                <><strong>Produto de autoconhecimento com terapeutas</strong> — em estudo como MVP</>,
              ]}
            />
          </Block>

          <Block title="Estratégia Atual (consolidada nas weeklies de maio/2026)">
            <P>
              <strong>1. Organizar o funil de entrada (Fase 1)</strong>
            </P>
            <P>
              O site / link da bio é o gargalo #1. Falta uma entrada que oriente a pessoa ao produto
              certo. A aposta é a bio interativa / quiz de qualificação (a “iniciativa do formulário
              inteligente”): em vez de linktree, um fluxo que pergunta, engaja, faz leitura sensível
              da pessoa no tom de voz da Giulia, entrega algo ao final (ex.: dossiê/teste) e a
              encaminha ao produto/comunidade certos. Rodrigo monta a prévia; Giulia revisa com o
              olhar sensível.
            </P>
            <P>
              <strong>2. Centralizar o comercial no BA Hub</strong>
            </P>
            <P>
              CRM, transcrições de reunião, WhatsApp (somente leitura, p/ extrair dados de Ana e
              Renata) e tráfego pago numa só plataforma. Como o WhatsApp esbarra no limite de 4
              dispositivos, a saída é uma visualização do WhatsApp dentro do BA Hub para a Giulia.
              Médio prazo: avaliar plataforma/área de membros própria (dados granulares, automações
              por etapa, podcast e comunidade), reduzindo dependência da Hotmart.
            </P>
            <P>
              <strong>3. Melhorar o processo de fechamento</strong>
            </P>
            <UL
              items={[
                <>Definir critério de MQL e trackear meta de ≥30% dos leads virando MQL (via transcrição das calls).</>,
                <>Reformular as 3 apresentações (assessoria/consultoria/mentoria): mais curtas, com dados de retorno (antes/depois) e postura mais incisiva/persuasiva (menos passiva).</>,
                <>Régua de reativação de leads quentes esquecidos: mensagens + áudios da Giulia encaminhados pela Ana — lembrar o lead, não cobrar resposta.</>,
                <>Programa de indicação para expandir a base (definir recompensa + discurso alinhado à narrativa).</>,
                <>Funis completos integrando os 3 produtos (template, curso, Método Sal) com bônus/order bump — Rodrigo vai estruturar de forma integrada, não produto a produto.</>,
              ]}
            />
          </Block>

          <Block title="Leitura de Mercado (visão do Rodrigo)">
            <UL
              items={[
                <>Ano difícil/retração; Hotmart reportou queda de faturamento em todos os nichos de 2024→2025.</>,
                <>Mercado “machucado”: muitos leads já compraram mentorias ruins e pediram reembolso → medo de comprar de novo. Diferenciação está em prometer com entrega real (“sei que foi difícil, mas somos diferentes”).</>,
                <>Em crise, o dinheiro migra para produtos muito baratos OU muito caros (e presenciais); pior nicho é a classe média. Daí a aposta em produtos de entrada baratos.</>,
                <>A transformação da mentoria é intangível: precisa virar métrica/depoimento de faturamento (antes/depois), equilibrado com depoimentos emocionais.</>,
                <>Referência recorrente: Luana Carolina — pragmatismo de venda (VSL/página conversa-L, depoimentos de faturamento, mostrar a própria rotina/ferramenta nos stories).</>,
              ]}
            />
          </Block>

          <Block title="Conteúdo / Stories">
            <P>
              Alcance de stories baixo (~1–1,5k de uma base de ~100k) — o público dela consome
              vídeo, não stories. Estratégia: aprofundar o relacionamento com quem já engaja (não
              perseguir alcance), instigar respostas e usar a associação aspiracional (mostrar
              rotina/Notion). Criativos: recriar o vídeo “de mil a 100 mil”, postar o vídeo “criar
              conteúdo é um saco” com CTA + número concreto, testar criativo de imagem.
            </P>
          </Block>

          <Block title="O que precisa ser preservado em qualquer cenário">
            <UL
              items={[
                <>A “voz” da Giulia — cadência, vocabulário, universo metafórico, maneirismos. A diferença real está aqui, não na estrutura.</>,
                <>O “olhar amoroso” — tirar a pessoa do modo sobrevivência e levá-la a um estado de segurança. É o “molho” além do método.</>,
                <>A relação 1:1 com clientes — analogia Michelangelo/Davi: enxergar o potencial humano na pessoa. Esse é o serviço real.</>,
              ]}
            />
          </Block>

          <Block title="Histórico de Decisões">
            <UL
              items={[
                <><strong>26/05:</strong> Definir MQL + meta ≥30%; reformular apresentações; criar régua de reativação; criar programa de indicação; estruturar funis completos; visualização do WhatsApp no BA Hub.</>,
                <><strong>18/05:</strong> Centralizar o comercial no BA Hub; Fase 1 = organizar a entrada do funil; conectar WhatsApp à IA (leitura); desligar a Sofia; treinar o André em Skills de Claude.</>,
                <><strong>11/05:</strong> Manter o Método Sal na esteira (problema é discurso, não oferta); não mudar o rumo dos produtos (otimizar via IA antes); treinar o André em Claude.</>,
                <><strong>06/04:</strong> Em vez de regravar o curso de identidade visual inteiro, gravar 1-2 aulas novas com o modelo atualizado; nasce a iniciativa do formulário inteligente.</>,
                <><strong>16/03:</strong> Seguir com mentoria (descartada comunidade por assinatura); mentoria a R$ 3.500 (6 encontros + curso + grupo).</>,
                <><strong>09/03:</strong> Avaliar migração Hotmart → plataforma própria; usar Claude Code com Skills em vez de ChatGPT.</>,
              ]}
            />
          </Block>

          <Block title="Pendências em Aberto">
            <UL
              items={[
                <>Site da SAL desatualizado — gargalo #1 do funil; Giulia devolve feedback no formato combinado. (alto)</>,
                <>WhatsApp da Giulia × IA — bloqueado por limite de dispositivos; solução = visualização no BA Hub. (alto)</>,
                <>Rastreamento de vendas — migrar para dados quantitativos; garantir gravações das calls (Ana/Renata). (alto)</>,
                <>Compartilhamento das gravações da Renata com o Rodrigo é manual/bugado (Google ~80%); migração de sistema em ~60 dias. (médio)</>,
                <>Transcrições das reuniões com clientes (pasta do Drive) + criativos a enviar. (médio)</>,
              ]}
            />
          </Block>
        </section>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-line pt-6">
      <h3 className="text-h3 text-ink normal-case">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-body text-ink-muted normal-case">{children}</p>;
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-body text-ink-muted normal-case">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
