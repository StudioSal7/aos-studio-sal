# A Revolução — Projeto 2

CRM e plataforma para operação de mentoria/consultoria de marca pessoal.

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Apps**: Next.js 15 (App Router) + TypeScript estrito + Tailwind v4 + shadcn/ui
- **Banco**: Supabase (Postgres + Auth) + Drizzle ORM
- **Deploy**: Vercel Pro

## Estrutura

```
apps/
  crm/          # CRM Fase 1
packages/
  db/           # Drizzle schema + queries + migrations + seed
  ui/           # Componentes shadcn/ui compartilhados
  config/       # eslint, tsconfig, tailwind compartilhados
docs/
  crm-fase-1/   # Decisões arquiteturais e PRD
```

## Comandos

```bash
pnpm install              # instala dependências
pnpm dev                  # roda dev de todos os apps
pnpm build                # build de produção
pnpm test                 # roda testes
pnpm typecheck            # checa tipos
pnpm db:push              # aplica schema no DB de dev (sem migration)
pnpm db:generate          # gera migration SQL versionada
pnpm db:migrate           # aplica migrations em prod
pnpm db:seed              # seed inicial (estágios, motivos, fontes)
pnpm db:studio            # abre Drizzle Studio
```

## Setup inicial

1. Copie `.env.example` para `.env` e preencha as variáveis (DATABASE_URL, Supabase keys, tokens)
2. `pnpm install`
3. `pnpm db:push` (cria tabelas no Postgres)
4. `pnpm db:seed` (popula catálogos iniciais + user owner)
5. `pnpm dev` (abre CRM em http://localhost:3000)

## Documentação

Decisões arquiteturais e PRD da Fase 1: [`docs/crm-fase-1/`](./docs/crm-fase-1/)
