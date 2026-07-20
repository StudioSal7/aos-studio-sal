# Contrato de fechamento — geração de .docx no lead pago

## Context

Hoje, quando um lead fecha (`PaidForm` no Kanban move o lead pro estágio `paid`), o CRM grava produto + valor + forma de pagamento, mas não existe nenhum artefato de contrato. O time monta contrato manualmente fora do CRM. Esta feature fecha esse gap: gera um `.docx` de rascunho, preenchido por mail-merge a partir dos dados do lead + dados coletados na hora (CPF/CNPJ, endereço, condições de pagamento — que o CRM não tem hoje), pronto pra revisão humana antes de enviar.

Parte da leva bio-lead → produtos → **contrato** → métricas → agenda → tráfego. Depende da `produtos` (já mergeada na main) pelo `products.tipo`, que seleciona qual template usar.

---

## Comportamento esperado

- Estando o lead no estágio `paid`, a aba **comercial** do lead mostra uma ação "gerar contrato".
- Ao acioná-la, o closer preenche um formulário com o que falta (nome completo/razão social, CPF/CNPJ, endereço, condições de pagamento — parcelas/vencimentos). Nome, produto e valor já vêm preenchidos do lead.
- O contrato gerado é um `.docx` de **rascunho**, baixável a partir do lead, com todos os placeholders preenchidos (nome, produto, valor, valor por extenso, dados coletados). Um placeholder sem dado correspondente sai **vazio** — nunca quebra a geração.
- O `.docx` gerado **nunca é enviado automaticamente** a ninguém — é sempre um arquivo pra download e revisão manual.
- O owner troca o template `.docx` de cada tipo de produto (mentoria/infoproduto) fazendo upload em `/admin/contratos`, **sem precisar de deploy**. O próximo contrato gerado (mesmo de um lead já existente) usa o template mais recente.
- Tentar gerar contrato pra um lead que não está em `paid` não é possível pela UI.
- Cada geração fica registrada (auditável) — o lead pode ter mais de um contrato gerado ao longo do tempo (regeração após correção de dado).

---

## Fora de escopo

- **PDF** — só `.docx`.
- **Assinatura eletrônica** — o contrato sai como rascunho pra assinatura manual/externa.
- **Cálculo de comissão/revenue-share** — é outra fatia do roadmap (Fatia 6); esta feature só grava produto + valor, não calcula nada sobre eles.
- **Auto-envio** do contrato (email, WhatsApp, etc.) — geração é sempre uma ação explícita, o arquivo é sempre baixado manualmente.
- **Coleta de dados dentro do `Sheet` de fechamento do Kanban** — o `PaidForm` existente (produto/valor/forma de pagamento) fica intocado; a coleta de CPF/endereço/condições acontece depois, na tela de detalhe do lead.
- **Persistir o `.docx` gerado** — o arquivo não fica salvo em disco/Storage; é gerado on-demand a cada download a partir do template atual + dados salvos. O que persiste é o registro dos dados coletados, não o binário.
- **Validação de CPF/CNPJ (dígito verificador) ou de CEP via API** — os campos são texto livre nesta primeira versão.

---

## Seams de teste

Módulos puros, testados isoladamente (sem tocar banco/rede/Storage):

- **`server/lib/valor-extenso/`** — função pura `cents → string` (valor por extenso em português). Casos: valores redondos, com centavos, singular ("um real"), zero, valores grandes (milhares).
- **`server/lib/contract-data-builder/`** — função pura que recebe `(lead, product, dadosColetados)` e devolve o record plano de placeholders para o mail-merge. Casos: todos os dados presentes; dados coletados parcialmente ausentes (placeholder deve sair `''`, não `undefined`/`null`/`"undefined"`); produto ausente.

O adaptador de render (`server/lib/contract-docx/` — PizZip + Docxtemplater sobre um buffer de template) é testado com um fixture `.docx` mínimo versionado no repo (não integração real com Storage) — confirma que o merge substitui placeholders conhecidos e que um placeholder desconhecido/vazio não derruba a geração.

Storage, upload de template e a rota de download são integração (não cobertos por unit test) — verificação é o roteiro manual ao final do build.

---

## Passos de execução

1. **Deps**: `pnpm --filter crm add docxtemplater pizzip`.
2. **Módulos puros + testes**: `valor-extenso` e `contract-data-builder` (TDD — escrever teste antes da implementação).
3. **Schema + migration**: `packages/db/src/schema/lead-contracts.ts` (+ `contractStatusEnum`), barrel export, `relations.ts`. Migration gerada via `pnpm db:generate`, próximo inteiro livre, com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` incluído manualmente (padrão do repo — RLS não é automático no push). **PENDENTE_APLICAR** — não rodar `db:migrate`/`db:push` em prod.
4. **Storage**: bucket privado `contract-templates` (script idempotente de setup, ou criação defensiva no próprio upload).
5. **Render adapter**: `server/lib/contract-docx/` (fino, sobre docxtemplater/pizzip).
6. **Server actions**: `server/actions/contracts.ts` (`generateContractAction`, `uploadContractTemplateAction`), `server/queries/contracts.ts`.
7. **Rota de download**: `app/api/leads/[leadId]/contrato/[contractId]/route.ts` (primeira rota não-JSON do app — `runtime='nodejs'`, self-guard `requireAuth()`).
8. **UI**: botão + modal de coleta na aba comercial do lead (gated por `stage==='paid'`); página `/admin/contratos` (owner-only, upload de template por tipo).
9. **Gate**: `pnpm --filter crm test` + `pnpm typecheck` verdes. `pnpm dev` local, roteiro manual de ponta a ponta.
