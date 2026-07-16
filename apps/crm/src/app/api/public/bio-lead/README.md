# `POST /api/public/bio-lead` — Direcionador (link-na-bio)

Endpoint público que recebe o lead qualificado pelo "Direcionador" (quiz no site da
Giulia, repo `giulia-salvatore-site`, rota `/comece`) e grava na tabela `leads` do CRM
usando a conexão server-side (service role). O anon key do site **nunca** toca a tabela
`leads` — tudo passa por aqui.

## O que o endpoint faz
1. **Anti-spam (obrigatório antes de ir pro ar):**
   - **Honeypot** (`empresa`): preenchido → `200` fake, não grava.
   - **Rate-limit por IP** (janela fixa no Postgres, tabela `bio_rate_limit`): default
     8 submits / 10 min. Ajuste em `route.ts` (`RATE_LIMIT`, `RATE_WINDOW_SECONDS`).
   - **Origin allowlist + `x-bio-token`**: camadas extras (token vai no bundle do client;
     Origin se forja fora do browser). A defesa real é honeypot + rate-limit.
2. Normaliza o WhatsApp pra E.164 (`normalizeWhatsapp`).
3. **Dedup que enriquece** (`findDuplicateLead` por email/WhatsApp): no hit, dá append da
   qualificação no `notes` e seta `produtoInteresseId` se vazio — nunca duplica/dropa.
4. Resolve o stage de entrada por `BIO_LEAD_STAGE_SLUG` (default `bio_quiz_novo`, frio,
   separado do funil principal) e a fonte por slug `bio-quiz`.
5. Mapeia a qualificação pras colunas tipadas (`rendaFaixa`) + resumo legível no `notes`.
6. Retorna `{ ok, leadId }`.

## Payload esperado
```jsonc
{
  "nome": "Maria",
  "whatsapp": "11999999999",
  "email": "maria@exemplo.com",
  "empresa": "",                 // honeypot — humano deixa vazio
  "respostas": { "momento": "...", "desafio": "...", "busca": "...", "faturamento": "..." },
  "produtoRecomendado": "metodo-sal",
  "resumo": "Momento: ...\nDesafio: ...",
  "intencao": "quiz",            // ou "agendar"
  "leadSourceSlug": "bio-quiz",
  "utm": { "utm_source": "...", "utm_medium": "...", "utm_campaign": "...", "utm_term": "...", "utm_content": "..." }
}
```

## Passos pra subir (rodar pelo Rodrigo — esta branch NÃO é pushada automaticamente)
1. **Schema:** já adicionei a tabela `bio_rate_limit` (`packages/db/src/schema/bio-rate-limit.ts`)
   e o seed da fonte `bio-quiz` + stage `bio_quiz_novo` (`packages/db/src/seed.ts`).
2. **Gerar e aplicar migration:**
   ```bash
   pnpm db:generate   # gera a SQL da tabela bio_rate_limit a partir do schema
   pnpm db:push       # aplica no banco
   pnpm db:seed       # cria a fonte 'bio-quiz' e o stage 'bio_quiz_novo'
   ```
3. **Env vars** (Vercel/produção): `BIO_LEAD_ALLOWED_ORIGINS`, `BIO_LEAD_TOKEN`,
   `BIO_LEAD_STAGE_SLUG`. Ver `.env.example`.
4. **No site** (`giulia-salvatore-site`): setar `VITE_AOS_LEAD_ENDPOINT` apontando pra
   `https://<crm>/api/public/bio-lead` e `VITE_AOS_LEAD_TOKEN` = mesmo `BIO_LEAD_TOKEN`.

## Opcional (não bloqueante)
Pra vincular `produtoInteresseId` no CRM, seedar `products` com slugs `metodo-sal`,
`mentoria-salto`, `central-conteudo` (casando com os slugs do `bio.config.ts` do site).
Sem isso, o produto recomendado ainda fica registrado no `notes`.
