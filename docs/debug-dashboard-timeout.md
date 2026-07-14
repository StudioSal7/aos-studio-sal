# Resolução — /dashboard dá erro só na Vercel (FUNCTION_INVOCATION_TIMEOUT)

Documento vivo. Atualizar a CADA teste: hipótese, expectativa, resultado. Ler
antes de cada próximo passo pra garantir que o raciocínio evolui e não repete.

---

## Sintoma

- `GET /dashboard` na Vercel → tela "Application error" / no console `Uncaught Error: Connection closed` (sintoma cliente do stream RSC abortado).
- **Só o /dashboard.** kanban, busca, quentes, revisão, calendário, saúde → todos 200.
- **Local funciona** (dev E build de produção) contra o MESMO banco, ~4s, sem erro, 4× seguidas.

## Fatos confirmados (não re-testar)

| # | Fato | Como foi confirmado |
|---|---|---|
| F1 | Erro real = `504 FUNCTION_INVOCATION_TIMEOUT`, "Task timed out after 60 seconds" | Log de runtime da Vercel |
| F2 | **Não é memória** — 280MB / 2048MB | Log de runtime |
| F3 | A função **trava num POST ao Supabase** (não retorna) | Log: External API pendente |
| F4 | Função rodava em **gru1 (São Paulo)** | Log: "Received in São Paulo" |
| F5 | Banco (pooler) está em **us-west-1 (Califórnia)** | String do pooler: `aws-1-us-west-1.pooler.supabase.com` |
| F6 | Vercel **já usava o POOLER** (transaction, porta 6543), não a conexão direta | Rodrigo confirmou que a env já era essa |
| F7 | Local usa **conexão DIRETA** (`db.<ref>.supabase.co:5432`) e funciona | `.env.local` |
| F8 | `statement_timeout = 2min`; todas as queries ~230ms local | Script de profiling |
| F9 | O erro **NÃO é uma query lançando exceção** — é HANG | Diagnóstico try/catch por query não capturou nada |
| F10 | Deploy servido é o código atual (chunk `5159` bate com build local) | `next build` local |
| F11 | Plano Vercel = **Hobby** (teto de 60s por função) | Log |

## Diferença central ainda não explicada

**Local (conexão DIRETA, processo longo) = 4s. Vercel (POOLER, serverless) = trava 60s.**
As duas grandes diferenças não isoladas: (a) POOLER vs DIRETA; (b) serverless vs processo longo; (c) região.

---

## Hipóteses testadas (expectativa × resultado)

| # | Hipótese | Correção aplicada | Expectativa | Resultado |
|---|---|---|---|---|
| T1 | Funil semanal em paralelo (4×8 queries) esgota conexões → "Connection closed" | `getWeeklyFunnel` sequencial | Resolver | ❌ Virou 504 timeout |
| T2 | Sequencial ficou lento demais | `getWeeklyFunnel` em 3 queries agrupadas (era 32) | Rápido, resolver | ❌ Local OK, Vercel ainda falha |
| T3 | Exaustão do pool (max:10 × conexão direta, limite 60) | `client.ts` max:3 + idle_timeout | Resolver exaustão | ❌ Ainda falha. **E F6 invalida a premissa** (Vercel usa pooler, não direta) |
| T4 | Uma query específica lança erro na Vercel | Diagnóstico try/catch por query na página | Mostrar qual query falha | ❌ Não disparou → **não é erro capturável, é HANG** (virou F9) |
| T5 | Query lenta batendo em statement_timeout | Profiling + `show statement_timeout` | Achar query lenta | ❌ statement_timeout=2min, queries ~230ms (F8) |
| T6 | `getCommercialFunnelCounts` pesado (14 queries) | Colapsado em 3 queries agrupadas | Aliviar, resolver | ⚠️ Local 2,25s→0,46s (bom), Vercel ainda falha |
| T7 | Bug de código que só aparece no build de produção | `next build` + `next start` local contra banco real | Reproduzir | ❌ Local prod renderiza limpo 4× (virou F10) |
| T8 | DATABASE_URL global errada na Vercel | Verificar se outras páginas quebram | Se global, tudo quebra | ❌ Só dashboard quebra; resto 200 (descarta env global) |
| T9 | Latência cross-region (função gru1 × banco us-west-1) | `vercel.json` `regions:["sfo1"]` | Co-localizar, queries ~2ms, resolver | ❌ Ainda falhou — **MAS não verifiquei se a região realmente mudou** (Hobby pode ignorar vercel.json). PENDENTE confirmar no log "Received in" |

---

## 10 hipóteses prováveis (ranqueadas) para a causa raiz

Contexto que qualquer hipótese precisa explicar: **hang de 60s, só no dashboard
(page com ~18 queries concorrentes), só na Vercel (pooler+serverless), nunca
local (direta+processo longo), sem exceção capturável, sem estouro de memória.**

1. **postgres.js + pooler transaction-mode + alta concorrência de queries.** O dashboard dispara ~18 queries em `Promise.all`; multiplexadas sobre poucas conexões do postgres.js contra o pgBouncer/Supavisor em transaction mode, o pipelining do postgres.js conflita com o roteamento por-transação do pooler e **trava**. Kanban (poucas queries) fica abaixo do limiar. → *Explica: só dashboard, só pooler, hang.* **MAIS PROVÁVEL.**
2. **Região não mudou (Hobby ignora `vercel.json regions`).** Função segue em gru1; T9 nunca foi realmente testada. → *Explica tudo se a real causa for cross-region.* **VERIFICAR PRIMEIRO (barato).**
3. **`default_pool_size` do Supavisor pequeno + concorrência.** Sob invocações concorrentes, o pool de backends do pooler esgota; queries em transaction mode esperam (`query_wait_timeout`) até ~60s. Dashboard segura mais conexões por mais tempo. → *Explica hang no pooler.*
4. **Conexões stale no freeze/thaw serverless.** Instância quente guarda conexões ao pooler; no thaw o socket está morto; a próxima request trava no socket morto até o timeout. Dashboard (mais queries) mais exposto. → *Explica só-Vercel, hang.*
5. **Cross-region puro (se região não mudou): 18 queries × ~200ms + setup TLS + fila do pooler** compõem >60s sob qualquer contenção. → *Explica só dashboard (mais queries).*
6. **Uma query específica trava só via pooler** (ex.: `getWeeklyFunnel` com `db.execute` raw + FILTER, ou plano ruim via pgBouncer). → *Testável com timing por query no runtime.*
7. **Render/serialização RSC dos 4 gráficos trava** (não lança) DEPOIS do fetch, fora do try/catch. → *Explica F9; testável removendo os charts.*
8. **Prefetch storm.** Next faz prefetch do link do dashboard nas outras páginas → várias invocações concorrentes do dashboard → esgotam o pooler juntas → cada uma trava. → *Explica só-Vercel.*
9. **`prepare:false` não surtindo efeito / erro de prepared statement contra transaction pooler causando retry-hang.** → *Testável forçando pooler local.*
10. **maxDuration=60 + a função realmente precisa de >60s** por compounding de latência; só cortar drasticamente round-trips resolve. → *Parcialmente atacado por T2/T6.*

---

## Próximo passo (o teste que isola a variável certa)

**Rodar o /dashboard LOCALMENTE apontando para o POOLER** (mesma senha da direta,
só troca host/porta/usuário). Isola pooler-vs-direta na minha máquina, sem Vercel:

- Se **travar local com o pooler** → a causa é o POOLER (H1/H3/H9), reproduzido e
  corrigível/verificável aqui. Testar então: reduzir concorrência, session-mode
  (5432 no host do pooler), ou limitar pipelining do postgres.js.
- Se **funcionar local com o pooler** → a causa é serverless/região/concorrência
  específica da Vercel (H2/H4/H8) → aí verificar a região (H2) e instrumentar
  timing por query no runtime.

Depois: registrar aqui expectativa × resultado antes de qualquer deploy.

---

## Log de execução dos próximos testes

### T10 — POOLER vs DIRETA local (isola pooler-vs-direta, mesma região) ✅ CAUSA ENCONTRADA
Rodei o conjunto de queries do dashboard contra as duas conexões (ambas cross-region
da minha máquina, então a região sai da equação):

| Conexão | max | Resultado |
|---|---|---|
| DIRETA 5432 | 3 | ✅ 18/18 OK, 3,9s |
| **POOLER 6543 (transaction)** | **3** | ❌ **3 queries TRAVARAM** (timeout), 25s+ |
| POOLER 6543 | 5 | ✅ OK, 3,0s |
| POOLER 6543 | 10 | ✅ OK, 2,2s |
| POOLER 6543 | 20 | ✅ OK, 2,1s |
| POOLER 6543 | 3 + lotes de 3 | ✅ OK, 4,4s |

**Expectativa:** isolar se o pooler é o problema. **Resultado:** SIM. Confirma a
hipótese #1. Mecanismo: o `postgres.js` faz **pipelining** de queries quando há mais
queries concorrentes que conexões no pool. Contra o pooler em **transaction mode**,
pipeline PROFUNDO (max baixo + ~18 queries) faz queries **travarem pra sempre** → a
função da Vercel estoura o `maxDuration` (60s) → FUNCTION_INVOCATION_TIMEOUT, que o
cliente vê como "Connection closed". **O `max:3` que EU introduzi (T3) foi o gatilho
determinístico.** Threshold: hang só com pipeline muito fundo (depth ~6); depth ≤ 3.6 OK.

Isso reconcilia TODO o histórico:
- ca2fdf2 (max:10, mas funil ainda 14 queries → ~28 no total, depth ~2.8): borderline/intermitente (bate com o "Connection closed pré-existente e irreproduzível" do PRD do André).
- 5db84d2/3059c82 (max:3, ~18 queries, depth 6): **hang determinístico**.

### T11 — FIX: max:3 → max:10 + otimizações de query, verificado no pooler ✅
Rodei o Promise.all EXATO do dashboard (funções reais) contra o POOLER com max:10:
**14/14 OK, 2,1s, zero travamento.** Também revertida a mudança de região (sfo1, T9) —
era palpite ortogonal e não é necessária; o hang (não a latência) era o killer, e
max:10 o elimina. `getWeeklyFunnel` (32→3) e `getCommercialFunnelCounts` (14→3) reduzem
a profundidade do pipeline como reforço.

**Correção final:**
1. `packages/db/src/client.ts`: `max: 3` → `max: 10` (nunca baixar de ~10 no pooler).
2. `getWeeklyFunnel` e `getCommercialFunnelCounts` agrupados (menos queries concorrentes).
3. Região revertida pro padrão (gru1) — bom pros usuários BR nas páginas leves.

**Verificação pendente:** confirmar na Vercel (deploy do fix) que o /dashboard carrega.
