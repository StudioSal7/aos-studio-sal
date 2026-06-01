# Estado Atual — Motor de Análise Comercial
**Data:** 2026-06-01 (atualizado)  
**Projeto:** `aos-studio-sal` (CRM Studio Sal)

---

## O que foi construído (Fatias 0–4 concluídas)

### Pacote `@repo/commercial` (puro, sem DB)
- `openai.ts` — `callGPT4oJSON` (**gpt-4o-mini**, temp 0.3, JSON mode, retry 3×) — trocado de `gpt-4o` porque transcrições longas (~23k tokens) excedem o limite de 10k TPM do Tier 1 da OpenAI
- `types.ts` — tipos de ambas as réguas (`CloserScoreBreakdown`, `CloserExtractedData`, `SdrScoreBreakdown`…)
- `closer/prompts.ts` — prompts calibrados nas transcrições reais da Studio Sal ("Anotações do Gemini")
- `closer/analyze.ts` — `runCloserAnalysis` (score ponderado calculado no código, parse defensivo)
- **9 testes passando**

### Schema Drizzle (`packages/db`)
- Tabela `commercial_analyses` (tabela única + `analyzer` discriminador `closer|sdr`)
- FK `lead_id` opcional (`ON DELETE SET NULL`)
- `CHECK overall_score [0, 100]`
- Unique parcial em `source_file` (idempotência do lote)
- `rubric_version` (text) — versão da régua que gerou a análise (`closer-v1`, `sdr-v1`); permite filtrar/comparar histórico quando a régua evoluir. Constantes em `@repo/commercial` (`CLOSER_RUBRIC_VERSION`, `SDR_RUBRIC_VERSION`), exibidas no detalhe.
- `status` enum: `pendente|processando|concluido|erro|nao_aplicavel`
- **Migrations aplicadas em produção:** `0002` (tabela+enums), `0003` (`nao_aplicavel`), `0004` (`rubric_version`). Backfill: 7 análises closer existentes → `closer-v1`.

### CRM (`apps/crm`)
- `server/queries/commercial.ts` — `listAnalyses` (inclui `extractedData` para exibir Fechou/valor na lista), `getAnalysisById`, `getAnalysisKpis`, `searchLeadsForSelector`
- `server/actions/commercial.ts` — `analyzeCloserAction`, `deleteAnalysisAction`, `searchLeadsAction`
- Rotas:
  - `/analise/closer` — lista + KPIs (total, score médio, no mês, fechamentos). Lista com **score ring SVG** (REGULAR/BOM/EXCELENTE/ÓTIMO), badge **Fechou / Não fechou** e valor em BRL quando disponível
  - `/analise/closer/nova` — form com seletor de lead (`maxDuration=300`, síncrono)
  - `/analise/closer/[id]` — detalhe: score ring, breakdown 6 critérios, extração, transcrição colapsável
  - `/analise/sdr` — placeholder (em breve)
- Sidebar: `análise closer.` (ClipboardCheck) + `análise sdr.` (MessageSquareText)
- Script `pnpm --filter crm analyze-closer-batch -- <dir>` — processa pasta de `.txt`, idempotente, gera `tmp/analise-closer-report.md`. **7 calls da Studio Sal processadas** (acervo em `THE SHIRE/SAL/TRANSCRIÇÃO`). Scores: Fernanda 88, Beatriz 82, Marina 82, Mariana 77, Nátalie 74, Leticia 73, Nathália 65.

### Verificação
- `pnpm typecheck` — 0 erros
- `pnpm test` — 173 passando, 8 skipped (commercial: 21 closer+sdr · crm: 152 incl. 10 thread-builder)

---

## Réguas implementadas

### Closer (6 critérios — `runCloserAnalysis` ✅ funcionando)
| Critério | Peso |
|---|---|
| `fechamento` | 30% |
| `conducao` | 20% |
| `tecnica_vendas` | 20% |
| `escuta_ativa` | 10% |
| `clareza` | 10% |
| `rapport` | 10% |

**Extração:** `fechou` (bool), `programa_interesse`, `orcamento_valor`, `forma_pagamento`, `objecoes`, `nivel_interesse`, `proximos_passos`, `concorrentes_mencionados`, `insights_adicionais`

**Input:** transcrição "Anotações do Gemini" do Google Meet (falantes identificados por nome completo)

### SDR (5 critérios — `runSdrAnalysis` ✅ implementado e calibrado)
| Critério | Peso |
|---|---|
| `conducao_agendamento` | 30% |
| `qualificacao` | 25% |
| `rapport` | 20% |
| `clareza` | 15% |
| `velocidade_resposta` | 10% (avaliada de fato via timestamps por mensagem; `null` só em thread degenerada → renormaliza os outros 4) |

**Extração:** `agendou`, `data_agendamento`, `nivel_interesse`, `faixa_renda`, `tempo_no_nicho`, `objecoes`, `proximos_passos`, `insights_adicionais`

**Detecção de não-aplicabilidade:** o prompt decide se a conversa é mesmo de pré-venda SDR. Se não for (contato frio, recado interno do time, grupo), a análise é gravada com `status='nao_aplicavel'` (fora dos KPIs) em vez de receber nota enganosa.

---

## Ingestão SDR: pull sob demanda via Evolution API ✅

### Arquitetura (decidida e implementada)
A operação tem uma instância Evolution API conectada ao número fixo da Studio Sal.
A ingestão é **exclusivamente pull sob demanda** — não há upload manual, webhook receiver, cron de silêncio nem tabela de mensagens. Só a **análise** é persistida (`commercial_analyses`); a thread vira o campo `transcript`.

> ⚠️ Não existe ingestão manual de SDR (o time não tem acesso ao WhatsApp Web para copiar conversas). A única origem é o Evolution.

**Duas portas:**
- **Porta 1 (a partir do lead):** botão "analisar whatsapp" na página do lead → usa `lead.whatsappE164` → `resolveRemoteJid` → `findMessages` → `buildSdrThread` → `runSdrAnalysis` → grava com `lead_id` preenchido.
- **Porta 2 (lista de chats):** `/analise/sdr` chama `findChats` da instância, lista conversas individuais (casando com leads por número), usuário escolhe uma para puxar+analisar (`lead_id` casado ou nulo).

### Descobertas da instância (verificação bloqueante — Etapa 0, concluída)
- Store/persistência **habilitado** (728 chats). `findMessages` retorna conversas completas com `limit:500` (sem truncar).
- A API retorna mensagens em ordem **decrescente** → `buildSdrThread` reordena ascendente por `messageTimestamp`.
- Contatos individuais: **477 `@s.whatsapp.net`** (número no JID) + **203 `@lid`** (identificador opaco; número real em `lastMessage.key.remoteJidAlt`). Por isso `resolveRemoteJid` tem fallback por `findChats` + tolerância ao 9º dígito BR.
- `messageTimestamp` existe **por mensagem** → `velocidade_resposta` é sempre avaliável.

### Arquivos
- `apps/crm/src/server/lib/evolution-client/` — `findMessages`, `findChats`, `resolveRemoteJid` (com @lid + 9º dígito), `e164ToRemoteJid`, tipos.
- `apps/crm/src/server/lib/evolution-thread-builder/` — `buildSdrThread` (puro, 10 testes).
- `packages/commercial/src/sdr/` — `prompts.ts`, `analyze.ts` (`runSdrAnalysis`, `computeSdrOverallScore`), 12 testes.
- `apps/crm/src/server/actions/commercial.ts` — `analyzeSdrFromLeadAction`, `analyzeSdrFromChatAction`, `listEvolutionChatsAction`.
- `apps/crm/src/server/queries/commercial.ts` — `getLeadByWhatsappDigits` (match com 9º dígito), KPIs SDR (agendamentos).
- Rotas `/analise/sdr` (Porta 2 + KPIs + lista), `/analise/sdr/[id]` (detalhe 5 critérios).
- `apps/crm/scripts/sdr-calibration.ts` — puxa conversas reais e imprime análise (sem gravar). Uso: `tsx --env-file=../../.env.local scripts/sdr-calibration.ts [qtd]`.
- Migration `0003_needy_supernaut.sql` (enum `analysis_status` += `nao_aplicavel`) — **aplicada em produção**.

### Variáveis de ambiente (já em `.env.example`, `turbo.json` globalEnv)
`EVOLUTION_API_URL` (sem barra no fim), `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.
⚠️ Ainda **faltam** em `apps/crm/.env.local` (estão só no `.env.local` da raiz). Adicionar antes de rodar via `pnpm --filter crm dev` se o app não herdar do root.

---

## Fatia 5b (futura, NÃO planejada ainda) — captura automática
Webhook `messages.upsert` + cron de silêncio + lógica de re-análise. **Só planejar depois** de validar a régua SDR com mais volume de conversas reais via pull. Decisões em aberto (threshold de silêncio, re-análise) ficam para essa fatia.

## Fatia 6 — Polish (independente)
- Filtros/ordenação nas listas; esconder `nao_aplicavel` por padrão na lista SDR.
- Análises vinculadas visíveis na tab Atividade do lead.
- Refino de KPIs.

---

## Comandos rápidos

```bash
# Rodar o CRM local
pnpm --filter crm dev

# Processar acervo de transcrições da closer em lote
pnpm --filter crm analyze-closer-batch -- "/caminho/para/pasta/TRANSCRIÇÃO"

# Migrations
pnpm db:generate    # gera SQL nova migration
pnpm db:migrate     # aplica em produção
pnpm db:studio      # Drizzle Studio visual
```
