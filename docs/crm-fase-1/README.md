---
name: CRM Fase 1 — índice de documentação
description: Decisões arquiteturais e contexto da Fase 1 do CRM, geradas em sessão de grilling sobre o plano original
---

# CRM Fase 1 — Documentação

Esta pasta contém o contexto e as decisões arquiteturais da Fase 1 do CRM. Substitui partes do plano original que ficaram desatualizadas após a sessão de grilling (premissas como projeção ponderada e SLA hardcoded foram revisadas).

## Documentos

1. [01-overview.md](./01-overview.md) — contexto da operação, stack, posicionamento estratégico (Fase 1 = instrumento de medição, não solução de gargalo)
2. [02-decisoes-arquiteturais.md](./02-decisoes-arquiteturais.md) — 18 decisões técnicas e de produto travadas: estágios, score em flags, schema, RLS, busca, drag-and-drop, audit, import legado
3. [03-pendencias-premissas.md](./03-pendencias-premissas.md) — itens não resolvidos no grilling: catálogos sem seed, enums não fechados, stack/infra a verificar (timezone, Vercel cron, Auth)
4. [04-estilo-de-trabalho.md](./04-estilo-de-trabalho.md) — preferência de estilo de recomendação técnica (A/B/C com trade-offs + sugestão justificada)

## Ordem recomendada de leitura

Para quem está começando a implementar: ler 01 → 02 → 03 nessa ordem. O 02 é o documento mais denso e o que mais informa decisões de código. O 04 é meta (sobre como colaborar comigo)..

## Status

- Plano original: parcialmente desatualizado, usar como contexto de negócio mas não de implementação
- Estes documentos: fonte de verdade para implementação da Fase 1
