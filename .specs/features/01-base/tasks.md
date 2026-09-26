# 01 · Base — Tasks

**Design**: `.specs/features/01-base/design.md`
**Status**: Draft

Branch: `feat/01-base`. Um commit por fase. Tarefas marcadas 🔒 dependem do projeto Supabase (B-001).

---

## Execution Plan

```
Fase 1 · Fundação (sequencial)
  T1 → T2 → T3

Fase 2 · App e banco (paralelo depois de T2)
  App:    T4 [P], T5 [P], T6 [P]
  Banco:  T7 → T8 → T9 → T10 → T11 → T12
          T8 → T13
  Tipos:  T7 → T14

Fase 3 · Site (depois de T4, T6, T14)
  T15 → T16 [P], T17 [P] → T18 → T19

Fase 4 · Integração 🔒
  T12, T13 → T20 → T21 → T22 → T23 → T24
```

---

## Fase 1 · Fundação

### T1: Mover o protótipo para `prototipo/`

**What**: `git mv cake67-site prototipo` na branch `feat/01-base`.
**Where**: raiz do repo
**Depends on**: None

**Done when**:
- [ ] `prototipo/index.html`, `favicon.png` e `img/` (29 arquivos) presentes; `cake67-site/` não existe
- [ ] Git registra como rename (histórico preservado)

**Verify**: `git status` mostra `renamed: cake67-site/... -> prototipo/...`

---

### T2: Criar o app Next.js 15 na raiz

**What**: app Next.js 15 (App Router, TypeScript strict, Tailwind v4, ESLint, sem `src/`), npm, com scripts `typecheck` (`tsc --noEmit`), `test` (Vitest) e `seed`.
**Where**: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
**Depends on**: T1

**Done when**:
- [ ] `next` fixado em 15.x no `package-lock.json`
- [ ] `.gitignore` cobre `.env*` (exceto `.env.example`) e `supabase/.temp/`
- [ ] `.env.example` lista as 4 variáveis do SPEC + `ADMIN_EMAIL`
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam

**Verify**: os três comandos terminam com código 0.

---

### T3: Tokens visuais e fontes

**What**: `@theme` com as cores do protótipo (`olive`, `olive-dark`, `olive-deep`, `moss`, `peach`, `peach-light`, `linen`, `cocoa`, `cocoa-soft`, `raspberry`) e fontes Marcellus/Montserrat via `next/font/google`; logo copiado para `public/brand/`.
**Where**: `app/globals.css`, `app/layout.tsx`, `public/brand/`
**Depends on**: T2
**Reuses**: `prototipo/index.html:16-24`, `prototipo/img/logo-*.png`

**Done when**:
- [ ] Classes `bg-linen`, `text-cocoa`, `font-display` funcionam
- [ ] `<html lang="pt-BR">`, metadata base com nome Cake 67
- [ ] Build passa

**Verify**: `npm run build`; página raiz renderiza com fundo linho e título em Marcellus.

---

## Fase 2 · App e banco

### T4: `lib/env.ts` [P]

**What**: validação Zod de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (público) e `SUPABASE_SERVICE_ROLE_KEY` (lazy, servidor).
**Where**: `lib/env.ts`, `tests/unit/env.test.ts`
**Depends on**: T2

**Done when**:
- [ ] Variável ausente gera erro com o nome dela
- [ ] Testes: tudo presente → ok; cada ausência → mensagem certa

**Verify**: `npm test -- env`

---

### T5: `lib/money.ts` [P]

**What**: `formatBRL(cents)`.
**Where**: `lib/money.ts`, `tests/unit/money.test.ts`
**Depends on**: T2

**Done when**:
- [ ] `2200 → "R$ 22,00"`, `2490 → "R$ 24,90"`, `0 → "R$ 0,00"`, `123456 → "R$ 1.234,56"`

**Verify**: `npm test -- money`

---

### T6: Clientes Supabase [P]

**What**: `createClient()` (anon + cookies, `@supabase/ssr`) e `createAdminClient()` (service role, `server-only`).
**Where**: `lib/supabase/server.ts`, `lib/supabase/admin.ts`
**Depends on**: T4

**Done when**:
- [ ] `admin.ts` importa `server-only`
- [ ] Nenhum import de `admin.ts` em código client
- [ ] Typecheck passa

**Verify**: `npm run typecheck`

---

### T7: Migration de schema

**What**: `supabase init`; enums, sequence `order_code_seq`, 13 tabelas do SPEC §4 com acréscimos do design (`price_pending`, `public_token`, `code`, `settings.id`, timestamps, checks), trigger `set_updated_at`, RLS ligado em todas.
**Where**: `supabase/config.toml`, `supabase/migrations/20260926000100_schema.sql`
**Depends on**: T1

**Done when**:
- [ ] Toda tabela tem `enable row level security`
- [ ] Slugs `unique`, `stock` com PK composta, `quantity >= 0`
- [ ] Check de loja obrigatória para atendente

**Verify**: revisão contra o SPEC §4; aplicação real em T20.

---

### T8: Migration de helpers de auth

**What**: `is_admin()` e `staff_store()` (`security definer`, `stable`, `search_path = ''`).
**Where**: `supabase/migrations/20260926000200_auth_helpers.sql`
**Depends on**: T7

**Done when**:
- [ ] Ambas leem só `staff` ativo do `auth.uid()`
- [ ] `grant execute` para `authenticated`; revogado de `public`

---

### T9: Migration de políticas e view

**What**: políticas da tabela do design e view `product_availability` (`least(quantity, 10)`), `grant select` para `anon, authenticated`.
**Where**: `supabase/migrations/20260926000300_policies.sql`
**Depends on**: T8

**Done when**:
- [ ] Nenhuma política de escrita para `anon`
- [ ] Atendente sem update em `stock`
- [ ] Cada linha da tabela de políticas do design tem política correspondente

---

### T10: Migration de Storage

**What**: bucket público `produtos`; políticas de insert/update/delete em `storage.objects` só com `is_admin()`.
**Where**: `supabase/migrations/20260926000400_storage.sql`
**Depends on**: T8

---

### T11: `seed.sql`

**What**: lojas, categorias (Fatias, Potes, Croissants, Docinhos, Bolos, Cento, Kits), 20 produtos de vitrine, 5 bolos `price_pending`, 4 adicionais, cento e kit de exemplo inativos, `product_images` apontando para `seed/<arquivo>.webp`, estoque (10, ou 0 para os esgotados do protótipo), `settings`. Tudo com `on conflict do update`/`do nothing`. Bebidas ficam fora (cadastro no painel).
**Where**: `supabase/seed.sql`
**Depends on**: T7
**Reuses**: `CAT`, `FL`, `EX`, `OUT` de `prototipo/index.html:545-583`

**Done when**:
- [ ] Preços em centavos iguais ao protótipo
- [ ] Loja 2 com WhatsApp provisório comentado no SQL
- [ ] Nenhum `insert` sem cláusula de conflito

---

### T12: `scripts/seed.ts`

**What**: sobe `prototipo/img/*.webp` para `produtos/seed/` (upsert) e convida `ADMIN_EMAIL`, com upsert em `staff` (`admin`).
**Where**: `scripts/seed.ts`, script `npm run seed`
**Depends on**: T6, T10, T11

**Done when**:
- [ ] Aborta sem escrever nada se faltar env
- [ ] Rodar duas vezes não duplica usuário nem arquivo

---

### T13: Tipos do banco (provisório)

**What**: `lib/database.types.ts` escrito à mão no formato do `supabase gen types`, espelhando T7–T9. Substituído pelo gerado em T20.
**Where**: `lib/database.types.ts`
**Depends on**: T9

**Done when**:
- [ ] Tabelas, view e enums tipados; typecheck passa

---

### T14: `lib/catalog.ts`

**What**: `listStores()`, `listVitrineMenu(storeId)`, `productImageUrl(path)`.
**Where**: `lib/catalog.ts`
**Depends on**: T6, T13

**Done when**:
- [ ] Filtra `store_ids` vazio ou contendo a loja
- [ ] Remove categorias vazias
- [ ] Erro do Supabase é lançado, não engolido

---

## Fase 3 · Site

### T15: Layout do site e home mínima

**What**: header/footer do `(site)` e home com chamada para o cardápio e as lojas.
**Where**: `app/(site)/layout.tsx`, `app/(site)/page.tsx`
**Depends on**: T3, T14

---

### T16: `ProductCard` [P]

**What**: card com foto (`next/image`), nome, descrição, preço e rótulo **Esgotado**.
**Where**: `components/site/product-card.tsx`
**Depends on**: T15
**Reuses**: estilo `.vit` do protótipo

---

### T17: `StorePicker` [P]

**What**: seletor de loja que troca `?loja=` na URL.
**Where**: `components/site/store-picker.tsx`
**Depends on**: T15

---

### T18: Página `/cardapio` e erro

**What**: Server Component que resolve a loja, chama `listVitrineMenu` e renderiza; `error.tsx` com mensagem em PT-BR e botão de tentar de novo.
**Where**: `app/(site)/cardapio/page.tsx`, `app/(site)/cardapio/error.tsx`
**Depends on**: T16, T17

**Done when**:
- [ ] `?loja=` inválido cai na primeira loja
- [ ] `next.config.ts` libera imagens do domínio do Supabase

---

### T19: Teste de integração RLS

**What**: com a anon key, confere: select vazio/negado em `orders`, `order_items`, `stock`, `stock_movements`, `staff`, `settings`; insert/update/delete negados em todas as tabelas; só ativos em `products`; view responde; contagens do seed. Pula com aviso se faltar env.
**Where**: `tests/integration/rls.test.ts`, script `test:integration`
**Depends on**: T4

---

## Fase 4 · Integração 🔒

### T20: Aplicar no Supabase 🔒

**What**: `supabase link`, `supabase db push --include-seed`, `npm run seed`, `supabase gen types` sobrescrevendo `lib/database.types.ts`.
**Depends on**: T12, T13, chaves do projeto

**Done when**:
- [ ] Migrations aplicadas sem erro
- [ ] Tipos gerados sem diff relevante em relação a T13; typecheck passa
- [ ] Rodar seed de novo não muda contagens

---

### T21: Validação local 🔒

**What**: `lint`, `typecheck`, `test`, `test:integration`, `build`; conferir `/cardapio` no navegador em 360 px nas duas lojas; desativar um produto no banco e ver sumir.
**Depends on**: T18, T19, T20

---

### T22: Vercel 🔒

**What**: Root Directory vazio, Framework Next.js, 4 variáveis em Preview e Production.
**Depends on**: T21

---

### T23: Commit e push 🔒

**What**: commits por fase na `feat/01-base`, push e PR.
**Depends on**: T21

---

### T24: Aceite no preview 🔒

**What**: preview abre o cardápio do banco; `test:integration` passa; ROADMAP marca 01 como COMPLETE; STATE atualizado.
**Depends on**: T22, T23

---

## Ferramentas por tarefa

| Tarefas | Ferramentas |
|---|---|
| T1–T19 | Arquivos + terminal (npm, git, supabase CLI) |
| T20 | Supabase CLI |
| T21 | Terminal + navegador embutido (verificação em 360 px) |
| T22 | Vercel (MCP conectado) |
| T23 | git + `gh` |

## Granularity Check

| Tarefa | Escopo | Status |
|---|---|---|
| T2 | scaffold + configs geradas juntas | ⚠️ coeso (uma operação do create-next-app) |
| T7 | uma migration | ✅ |
| T11 | um arquivo SQL | ✅ |
| T19 | um arquivo de teste | ✅ |
| Demais | 1 arquivo / 1 componente / 1 função | ✅ |
