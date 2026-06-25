# Estado Atual — Motor de Análise Comercial
**Data:** 2026-06-25 (atualizado)  
**Projeto:** `aos-studio-sal` (CRM Studio Sal)

---

## O que foi construído (Fatias 0–4 concluídas)

### Pacote `@repo/commercial` (puro, sem DB)
- `openai.ts` — `callGPT4oJSON` (**gpt-4o**, temp 0.3, JSON mode, `max_tokens`, retry 5× com backoff/Retry-After em 429). Lança `TruncatedResponseError` em `finish_reason='length'` (nunca aceita JSON parcial). Param opcional `{ model, maxTokens }`. Tier OpenAI atual: gpt-4o = **30k TPM** (Tier 1).
- `types.ts` — tipos de ambas as réguas. Closer v2: `CloserMethodDossier` (detecção + 7 blocos + dossiê qualitativo), `CloserBlockScores`, `CloserDetection`, `CloserEvidence`, `CloserRecommendation`, `CloserExtractedData`, `SdrScoreBreakdown`…
- `closer/prompts.ts` — **régua Winning by Design (closer-v2)**: avalia execução do método (não se fechou). 1 prompt unificado → dossiê + extração de negócio numa só chamada (transcrição enviada 1×).
- `closer/transcript-cleaner.ts` — limpador determinístico do Gemini (remove BOM/data/header/timestamps/branco/`�`, colapsa falante consecutivo; preserva falas/citações). Puro, **7 testes**.
- `closer/compress.ts` — compressão extrativa de fallback (mini), só se exceder `TRANSCRIPT_CEILING=22000` após limpeza. Seleciona turnos verbatim + trava determinística head+tail.
- `closer/analyze.ts` — `runCloserAnalysis` (limpa → comprime se preciso → 1 call gpt-4o → parse defensivo). **Pesos variáveis por etapa** (FECHAMENTO/DIAGNÓSTICO), `computeCloserOverallScore(blocos, etapa)` = soma ponderada 0–10 ×10 → 0–100. `CLOSER_RUBRIC_VERSION='closer-v2'`.
- **13 testes do closer passando** (pesos ambas etapas, parse do dossiê, extração)

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
  - `/analise/closer` — lista + KPIs (total, score médio, no mês, fechamentos). Lista com **score ring SVG** (0–100, REGULAR/BOM/EXCELENTE/ÓTIMO), badge **Fechou / Não fechou** e valor em BRL quando disponível
  - `/analise/closer/nova` — form com seletor de lead (`maxDuration=300`, síncrono)
  - `/analise/closer/[id]` — detalhe v2: **header de detecção** (produto · etapa · decisores · lead qualificado), score ring 0–100, **breakdown 7 blocos A–G** (pesos do dossiê), **leitura em 1 linha**, **desejo + implicação**, **3 acertos + 3 falhas com trecho literal**, **sinais vermelhos**, **3 recomendações com script copiável**, painel "dados extraídos", transcrição colapsável
  - `/analise/sdr` — placeholder (em breve)
- Sidebar: `análise closer.` (ClipboardCheck) + `análise sdr.` (MessageSquareText)
- Script `pnpm --filter crm analyze-closer-batch -- <dir>` (ou `node_modules/.bin/tsx --env-file=.env.local scripts/analyze-closer-batch.ts <dir>`) — processa pasta de `.txt`, idempotente, **throttle `THROTTLE_MS=65000`** entre calls (respeita TPM), grava modelo/compressão/etapa em `tmp/analise-closer-report.md`. **8 calls reprocessadas com a régua v2** (acervo em `THE SHIRE/SAL/TRANSCRIÇÃO`). Scores caem vs v1 — a régua de método é mais severa (ex.: Beatriz 82→56).

### Verificação
- `pnpm typecheck` — 0 erros
- `pnpm test` — 184 passando, 8 skipped (commercial: 32 incl. cleaner/closer-v2/sdr · crm: 152)

---

## Réguas implementadas

### Closer (régua Winning by Design — `closer-v2`, 7 blocos A–G, `runCloserAnalysis` ✅)
Avalia EXECUÇÃO DO MÉTODO (venda consultiva), **nunca se fechou**. Pesos **variáveis por etapa**:

| Bloco | FECHAMENTO | DIAGNÓSTICO |
|---|---|---|
| A `abertura` | 10% | 10% |
| B `conducao` | 7,5% | 10% |
| C `diagnostico` | 15% | 25% |
| D `desejo` | 20% | 15% |
| E `implicacao` | 20% | 15% |
| F `urgencia` | 7,5% | 10% |
| G `fechamento` | 20% | 15% |

Notas dos blocos 0–10; global = soma ponderada ×10 → 0–100 (calculada no código). **Detecção** prévia: produto, etapa, nº decisores (e 2º conduzido), lead qualificado. **Dossiê**: leitura em 1 linha, análise desejo+implicação, 3 acertos + 3 falhas (com trecho literal), sinais vermelhos, 3 recomendações com script.

**Extração de negócio (mesma chamada):** `fechou` (bool), `dor_principal`, `dores_secundarias`, `programa_interesse`, `orcamento_mencionado`, `orcamento_valor`, `forma_pagamento`, `objecoes`, `nivel_interesse`, `proximos_passos`, `concorrentes_mencionados`, `insights_adicionais`

**Input:** transcrição "Anotações do Gemini" do Google Meet (falantes por nome completo). Limpa por código + comprimida (extrativa) só se exceder o teto de tokens.

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

### Treino role-play SPIN (`roleplay-spin-v1`, `@repo/commercial/roleplay` ✅)
Espaço para a closer **treinar antes** da call real: conversa com um "lead" simulado por IA e recebe nota + feedback com exemplos de reescrita. Persona/contexto/objeções vêm de `roleplay_scenarios` (dados); quem treina, de `trainee_label` (dropdown de `users.role='closer'`). **Zero string de cliente no core.**

| Critério | Peso | O que mede |
|---|---|---|
| `situacao` (S) | 10% | mapeou contexto sem interrogatório |
| `problema` (P) | 15% | fez o lead admitir insatisfação/dor |
| `implicacao` (I) | 30% | fez o lead sentir o custo de não resolver |
| `necessidade` (N) | 30% | fez o lead verbalizar o valor de resolver |
| `conducao_escuta` | 15% | não pitchou cedo, aprofundou follow-up |

Notas 0–10 por critério; global = soma ponderada ×10 → 0–100 (**calculada no código**, `computeRoleplayOverallScore`). **Score é end-of-session** (nunca ao vivo por turno).

**Motor puro (sem DB), 3 funções:**
- `runRoleplayTurn(scenario, history)` → próxima fala do prospect. `callGPT4oChat` (texto multi-turno, temp 0.7); closer→user, prospect→assistant. Lead realista que **não entrega a dor de graça**; `difficulty` controla o quão guardado é.
- `runRoleplayAnalysis(scenario, transcript)` → **1 chamada gpt-4o unificada** (notas + dossiê). Dossiê: leitura 1 linha, 3 melhores momentos (trecho literal), 3 perguntas fracas + reescrita, 2 perguntas-modelo, próximo foco. Parsing manual + clamp 0–10.
- `scenarioFromTranscript(transcript)` → rascunho `{persona, context, objections}` para revisão humana (reusa limpeza/compressão da closer).

**UI** (`apps/crm/src/app/(crm)/comercial/treino/`): `page.tsx` (tendência por trainee + iniciar treino + histórico), `[sessionId]/page.tsx` (chat + dossiê, `maxDuration=300` p/ a análise final), `cenarios/page.tsx` (CRUD + extração, `maxDuration=60`). Actions em `server/actions/treino.ts`, queries em `server/queries/treino.ts`. Mensagens persistidas em `roleplay_messages` (treino É gravado). Testes do motor: `packages/commercial/src/roleplay/__tests__/` (14 — cálculo de score, parsing, ordem de mensagens).

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
