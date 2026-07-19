# `POST /api/public/bio-lead` — Direcionador (link-na-bio)

Endpoint público que recebe o lead qualificado pelo "Direcionador" (quiz no site da
Giulia, repo `giulia-salvatore-site`, rota `/comece`) e grava na tabela `leads` do CRM
usando a conexão server-side (service role). O anon key do site **nunca** toca a tabela
`leads` — tudo passa por aqui.

## O que o endpoint faz
1. **Anti-spam (obrigatório antes de ir pro ar):**
   - **Honeypot** (`empresa`): preenchido → `200` fake, não grava.
   - **Rate-limit por IP** (janela deslizante ponderada no Postgres, tabela
     `bio_rate_limit`, `server/lib/rate-limit`): default 8 submits / 10 min. A janela é
     ponderada pra fechar o estouro clássico de fixed-window na borda (rajada no fim de
     um bucket + rajada no início do próximo = até 2x o limite) — ver `window-math.ts`.
     Chave = **IP confiável** (`getTrustedClientIp`, `server/lib/bio-lead-guard`): usa
     `x-real-ip` (injetado pela Vercel, não forjável pelo cliente); **nunca** o primeiro
     valor de `x-forwarded-for` — esse campo o cliente controla e derrubaria o rate-limit
     inteiro com um header forjado. Ajuste em `route.ts` (`RATE_LIMIT`, `RATE_WINDOW_SECONDS`).
   - **Origin allowlist + `x-bio-token`**: camadas extras (token vai no bundle do client;
     Origin se forja fora do browser). A defesa real é honeypot + rate-limit.
   - **Cap de tamanho** (`findPayloadCapViolation`, `server/lib/bio-lead-guard`): nome
     (200), email (254), resumo (4000), campos UTM (256 cada), respostas.faturamento
     (100). Acima do limite → `400 payload_too_large`, sem tocar o banco.
2. Normaliza o WhatsApp pra E.164 (`normalizeWhatsapp`).
3. **Dedup que enriquece** (`findDuplicateLead` por email/WhatsApp): no hit, dá append da
   qualificação no `notes` (sempre) e só **PREENCHE campo vazio** do lead existente
   (`buildEnrichPatch`, `server/lib/bio-lead-guard`) — nunca sobrescreve valor já
   preenchido (renda, UTM, produto), nunca duplica/dropa, e **nunca aceita
   `requiresAttention` vindo do cliente** pra um lead de terceiro (a intenção de
   agendar fica só registrada no `notes`, que é sempre append).
4. Resolve o stage de entrada por `BIO_LEAD_STAGE_SLUG` (default `bio_quiz_novo`, frio,
   separado do funil principal) e a fonte por **allowlist fixa** (`resolveAllowedSourceSlug`
   — hoje só `bio-quiz`; qualquer outro slug enviado pelo cliente é ignorado, nunca repassado
   livre pro banco).
5. Mapeia a qualificação pras colunas tipadas (`rendaFaixa`) + resumo legível no `notes`.
6. Retorna **sempre `200 { ok: true }`** no caminho de sucesso — lead novo, lead
   enriquecido ou honeypot são indistinguíveis na resposta (nunca `leadId`, nunca
   flag `duplicate`). Isso é proposital: diferenciar "novo" de "já existe" + devolver o
   `leadId` do registro existente vira oráculo pra confirmar se um email/telefone já é
   lead da mentoria. Ver seção **Contrato de resposta** abaixo.

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

## Contrato de resposta

**Sucesso — lead novo, enriquecido ou honeypot (todos indistinguíveis):**
```jsonc
// HTTP 200
{ "ok": true }
```
Antes desta rodada de hardening, o endpoint diferenciava `201 { ok, leadId }` (novo) de
`200 { ok, duplicate: true, leadId }` (já existia) — isso vazava se um email/telefone já
é lead da mentoria (e o `leadId` interno de terceiros) pra qualquer chamador que soubesse
o identificador. Se o minisite (`giulia-salvatore-site`) tratava `status === 201`,
`body.duplicate` ou `body.leadId` de alguma forma (analytics, redirect condicional,
mensagem diferente pra "já é lead"), **isso quebra** — precisa trocar pra checar só
`response.ok` (ou `body.ok === true`). O lead continua sendo criado/enriquecido no
servidor normalmente; só a resposta HTTP ficou mais enxuta.

**Erros** (shape inalterado, exceto o novo `payload_too_large`):
| Status | `error` | Quando |
|---|---|---|
| 403 | `forbidden_origin` | Origin/Referer fora da allowlist (só se `BIO_LEAD_ALLOWED_ORIGINS` configurada) |
| 401 | `unauthorized` | `x-bio-token` não bate (só se `BIO_LEAD_TOKEN` configurado) |
| 400 | `invalid_json` | Body não é JSON válido |
| 400 | `invalid_payload` | Falta `nome`/`email`/`whatsapp` válido |
| 400 | `payload_too_large` **(novo)** | Campo acima do cap — body inclui `field` e `limit` |
| 429 | `rate_limited` | Estourou o rate-limit por IP |
| 500 | `stage_not_seeded` | `BIO_LEAD_STAGE_SLUG` não existe em `lead_stages` (rodar `db:seed`) |
| 500 | `insert_failed` | Falha inesperada no insert |

## Passos pra subir (rodar pelo Rodrigo — esta branch NÃO é pushada automaticamente)
1. **Schema:** já tem a tabela `bio_rate_limit` (`packages/db/src/schema/bio-rate-limit.ts`)
   e o seed da fonte `bio-quiz` + stage `bio_quiz_novo` (`packages/db/src/seed.ts`).
2. **Aplicar as DUAS migrations** (0012 cria a tabela, 0013 liga RLS nela — **as
   duas são obrigatórias**, não só a 0012: sem a 0013 a tabela fica exposta ao
   `anon` do Supabase via PostgREST, igual às 21 tabelas que a 0011 já protegia):
   ```bash
   pnpm db:migrate    # aplica 0012 (bio_rate_limit) + 0013 (RLS nela)
   pnpm db:seed       # cria a fonte 'bio-quiz' e o stage 'bio_quiz_novo'
   ```
3. **Env vars** (Vercel/produção): `BIO_LEAD_ALLOWED_ORIGINS`, `BIO_LEAD_TOKEN`,
   `BIO_LEAD_STAGE_SLUG`. Ver `.env.example`.
4. **No site** (`giulia-salvatore-site`): setar `VITE_AOS_LEAD_ENDPOINT` apontando pra
   `https://<crm>/api/public/bio-lead` e `VITE_AOS_LEAD_TOKEN` = mesmo `BIO_LEAD_TOKEN`.
   Se o site checava `status===201`/`body.duplicate`/`body.leadId`, ajustar pro novo
   contrato (ver seção acima).
5. **⚠️ Testar com e-mail NOVO, não com o seu.** Um e-mail que já é lead passa pelo
   caminho de enrich (sem checar stage) e mascara `stage_not_seeded` se o seed não
   rodou — só um lead genuinamente novo revela esse erro.

## Opcional (não bloqueante)
Pra vincular `produtoInteresseId` no CRM, seedar `products` com slugs `metodo-sal`,
`mentoria-salto`, `central-conteudo` (casando com os slugs do `bio.config.ts` do site).
Sem isso, o produto recomendado ainda fica registrado no `notes`.
