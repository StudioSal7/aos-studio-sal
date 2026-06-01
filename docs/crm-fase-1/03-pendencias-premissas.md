---
name: CRM Fase 1 — pendências e premissas (atualizado pós-grilling completo)
description: Itens ainda em aberto após sessão completa de 24 perguntas; itens resolvidos foram movidos para 02-decisoes-arquiteturais.md
type: project
---

Após a sessão completa de grilling (24 perguntas), quase tudo da estrutura ficou definido. Os itens abaixo ainda merecem confirmação operacional ou definição com a cliente durante onboarding.

## Pendências operacionais (a definir com cliente durante onboarding)

**Conteúdo de catálogos (estrutura definida, dado a coletar):**
- `lead_objections`: lista vazia na seed. Cliente cadastra as primeiras 5-10 objeções via admin conforme aparecem (ex: "marido não topou", "vou fazer outra mentoria primeiro", "timing ruim").
- `products` (produtos de interesse): cliente cria via admin com nome próprio + ticket_min + ticket_max + kind. Provavelmente: "Mentoria Salto" e "Consultoria Voo" baseado em menções no CSV legado.
- `lead_loss_reasons` modernos: além dos 11 seedados, cliente pode adicionar específicos da operação dela.
- `tipo_proxima_acao`: enum proposto no plano (`call, follow-up, mandar_contrato, cobrar_sinal`) — confirmar com cliente quais ações ela usa de fato.

**ICP — DEFERIDO** (cliente não tem dados de ICP definidos hoje):
- Card mostra dados crus (idade, tempo no nicho, renda) sem flag ✓/✗
- Quando cliente definir ICP, ativa flags visuais (entra como feature Fase 2 ou backlog dentro da Fase 1 quando dado chegar)
- Decisão da Pergunta 3 (flags em vez de score numérico) continua válida — só a renderização das flags fica desativada até ter regras

## Pendências técnicas (a confirmar antes de codar)

**Plano Vercel: confirmado Pro** ✅

**Variáveis de ambiente necessárias:**
- `DATABASE_URL` (Supabase Postgres connection string com service role)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `WEBHOOK_TOKEN_RESPONDI` (token que Respondi.app envia no header)
- `CRON_SECRET` (Bearer token pra route handlers de cron)

**Configuração Respondi.app: payload conhecido, falta operacional** ✅⏳
- Payload structure documentada (artigo 48 do help) — ver schema em `02-decisoes-arquiteturais.md`
- URL final: `https://<vercel>.app/api/webhooks/leads/respondi?token=${WEBHOOK_TOKEN_RESPONDI}`
- Cliente precisa colar essa URL no painel do Respondi após deploy
- Antes do go-live: pegar exemplo de payload REAL do(s) formulário(s) ativos da cliente pra validar Zod schema (testar com `respondi.com.br/article/96-como-testar-um-webhook` — tem ferramenta de teste)
- Mapear `question_id` → campo do CRM. Cada pergunta do formulário Respondi tem ID estável; mapeamento vive em código TS (não em DB). Exemplo:
  ```ts
  const RESPONDI_FIELD_MAPPING = {
    '3716ad0542d3': 'name',           // "Como você se chama?"
    'x4k3pgwkowan': 'email',          // "Qual seu melhor email?"
    'xg8tmynhnv6u': 'idade_faixa',    // "Qual a sua idade"
    // ...
  };
  ```
- A confirmar: política de retry do Respondi (não documentada). Webhook deve ser idempotente (já é via `respondent_id`).

**Domínio: Vercel default** ✅
- Sem domínio personalizado na Fase 1. CRM hospedado em `<projeto>.vercel.app`.
- Domínio personalizado pode ser configurado depois sem mudança de código.

## Itens FORA do escopo da Fase 1 (entram em Fase 2 ou depois)

- **Notificações** (in-app/email/SMS) — pull-only na Fase 1
- Score numérico recalibrado por dado real
- SLA hardcoded — virou configurável quando ativado
- Projeção de receita ponderada (precisa ≥20 fechamentos/estágio)
- Form nativo (substituindo Respondi.app)
- Integração Calendly/Google Calendar pra `scheduled_at`
- Integração com sistema de assinatura (Clicksign/D4Sign)
- Multi-pipeline (separar por produto)
- Real-time sync no Kanban
- Briefing automático pré-call via IA
- Captura automática de objeções via transcrição
- Integração WhatsApp (extração de dados via IA)
- CallScore (avaliação de calls gravadas via IA)
- Sequência de follow-up automatizada
- Email marketing
- TZ por lead (campo `lead_timezone`)
- Polling/Realtime de mudanças no Kanban
- Multi-tenant (entra se aparecer Cenário 2)

## Critério de pronto da Fase 1 (revisado)

1. Webhook do Respondi cria lead novo automaticamente em produção
2. Script de import do legado executado com relatório de qualidade publicado
3. Time consegue arrastar lead entre estágios (com validação inline em `lost`/`paid`)
4. Dashboard mostra pipeline bruto + contagens + tempo médio por estágio
5. Busca por apelido curto funciona (Bi, Ju)
6. Fila "Para revisão" zerada pelo menos uma vez (~51 leads do legado tratados)
7. 3 estágios novos (`meeting_done`, `closed_verbally`, `contract_sent`) ativos por 30 dias contínuos sem virar débito
8. Nenhum lead duplicado em produção por 30 dias
9. View "Saúde dos dados" populada e acionável (cron data-quality rodando)
10. 3 papéis (owner, sdr, closer) com login funcionando, sem acesso indevido a admin (RLS app-level confirmado em testes)
