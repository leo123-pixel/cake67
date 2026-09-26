# 01 · Base — Design

**Spec**: `.specs/features/01-base/spec.md`
**Status**: Approved

---

## Architecture Overview

Next.js renderiza o site no servidor e lê o Supabase com a **anon key** (sujeita a RLS). Escrita pública não existe nesta etapa. Tudo que exige privilégio (upload das imagens do seed, convite do admin) roda em script Node local com a service role, nunca no app.

```mermaid
graph TD
    B[Navegador] -->|GET /cardapio?loja=| RSC[Server Component]
    RSC --> SC[lib/supabase/server.ts<br/>anon key + cookies]
    SC -->|RLS| PG[(Postgres)]
    PG --> V[view product_availability]
    V -.lê como owner.-> ST[stock]
    RSC --> IMG[next/image] -->|URL pública| S3[(Storage: produtos)]

    subgraph Local, service role
      SEED[scripts/seed.ts] -->|upload img| S3
      SEED -->|inviteUserByEmail + staff| PG
    end
    MIG[supabase/migrations/*.sql + seed.sql] -->|supabase db push --include-seed| PG
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Origem | Local | Uso |
|---|---|---|
| Tokens de cor e fontes | `prototipo/index.html:16-24` | Viram `@theme` do Tailwind v4 em `app/globals.css` |
| Catálogo da vitrine (`CAT`) | `prototipo/index.html:576-582` | Fonte dos nomes, descrições, preços e imagens do `seed.sql` |
| Sabores de bolo (`FL`) e adicionais (`EX`) | `prototipo/index.html:545-546` | Seed de `bolo_kg` (preço provisório) e `addons` |
| Pesos 1–8 kg de 0,5 em 0,5, formatos | `prototipo/index.html:550,569` | `weights_kg` e `formats` padrão dos bolos |
| Imagens WebP | `prototipo/img/*.webp` | Enviadas ao bucket `produtos` em `seed/<arquivo>` |
| Logo (máscara PNG) | `prototipo/img/logo-*.png` | Copiados para `public/brand/` |

Não há código de app para reaproveitar (greenfield).

### Integration Points

| Sistema | Integração |
|---|---|
| Supabase Postgres | Migrations versionadas em `supabase/migrations/`, aplicadas com `supabase db push` |
| Supabase Storage | Bucket `produtos` criado por migration; arquivos pelo `scripts/seed.ts` |
| Supabase Auth | Admin criado por convite (`auth.admin.inviteUserByEmail`) no script |
| Vercel | Root Directory vazio, Framework Next.js, 4 variáveis de ambiente |

---

## Components

### Estrutura de pastas

```
app/
  layout.tsx              fontes, metadata base
  globals.css             Tailwind + @theme com tokens
  (site)/
    layout.tsx            header/footer simples
    page.tsx              home mínima (link para cardápio, lojas)
    cardapio/page.tsx     lista por categoria + seletor de loja
    cardapio/error.tsx    erro amigável
components/site/
  product-card.tsx
  store-picker.tsx        <select> que muda ?loja=
lib/
  env.ts
  money.ts
  supabase/server.ts      client anon para RSC
  supabase/admin.ts       client service role (server-only)
  catalog.ts              consultas do cardápio
  database.types.ts       gerado por supabase gen types
supabase/
  config.toml
  migrations/
    20260926000100_schema.sql
    20260926000200_auth_helpers.sql
    20260926000300_policies.sql
    20260926000400_storage.sql
  seed.sql
scripts/seed.ts
tests/
  unit/money.test.ts
  unit/env.test.ts
  integration/rls.test.ts
prototipo/                cópia intacta do cake67-site/
```

### lib/env.ts

- **Purpose**: valida variáveis de ambiente com Zod e falha com a variável que falta.
- **Interfaces**: `publicEnv: { supabaseUrl, supabaseAnonKey, siteUrl }`, `serverEnv(): { serviceRoleKey }` (lazy, só servidor).
- **Dependencies**: `zod`.

### lib/money.ts

- **Purpose**: formatar centavos em BRL.
- **Interfaces**: `formatBRL(cents: number): string` → `"R$ 22,00"` (usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, troca o NBSP por espaço comum).

### lib/supabase/server.ts / admin.ts

- **Purpose**: `createServerClient` do `@supabase/ssr` com cookies do Next (já preparado para o login da etapa 02). `admin.ts` importa `server-only` e usa a service role; nesta etapa só o script usa.
- **Interfaces**: `createClient(): Promise<SupabaseClient<Database>>`, `createAdminClient(): SupabaseClient<Database>`.

### lib/catalog.ts

- **Purpose**: consultas públicas do cardápio.
- **Interfaces**:
  - `listStores(): Promise<Store[]>`
  - `listVitrineMenu(storeId: string): Promise<MenuCategory[]>` — categorias `kind = 'vitrine'` com produtos ativos que a loja vende (`store_ids` vazio ou contém a loja), capa, preço e `available` da view. Categorias sem produto são removidas.
  - `productImageUrl(path: string | null): string` — URL pública do Storage ou placeholder.
- **Dependencies**: `lib/supabase/server.ts`.

### app/(site)/cardapio/page.tsx

- **Purpose**: Server Component. Lê `searchParams.loja` (slug); sem valor, usa a primeira loja por `sort`. Renderiza `StorePicker` e cards. Dinâmica por depender de `searchParams`, então mudança no banco aparece no próximo carregamento.
- **Reuses**: layout de cards e rótulo "Esgotado" do protótipo (`.vit`).

### scripts/seed.ts

- **Purpose**: parte do seed que SQL não faz. Idempotente.
  1. Envia `prototipo/img/*.webp` para `produtos/seed/<arquivo>` com `upsert: true`.
  2. Convida `ADMIN_EMAIL` (se não existir em `auth.users`) e faz upsert em `staff` com `role = 'admin'`.
- **Run**: `npm run seed` (`tsx scripts/seed.ts`), lê `.env.local`.

---

## Data Models

Enums Postgres (geram tipos TS): `category_kind (vitrine, encomenda)`, `product_type (vitrine, bolo_kg, cento, kit)`, `stock_reason (ajuste, reserva, devolucao, venda)`, `order_status (novo, confirmado, em_producao, pronto, entregue, cancelado, expirado)`, `fulfillment (retirada, entrega)`, `staff_role (admin, atendente)`, `highlight_slot (bolo_do_mes, combo_semana, banner)`.

Tabelas exatamente como SPEC §4, mais:

| Acréscimo | Motivo |
|---|---|
| `products.price_pending boolean default false` | Marcar preço provisório ("a definir") no painel e esconder do site se necessário |
| `orders.public_token text default encode(gen_random_bytes(16),'hex')` | Token de 32 caracteres do SPEC §6 para `get_order_public` |
| `orders.code text unique default 'C67-' \|\| lpad(nextval('order_code_seq')::text, 6, '0')` | Formato `C67-000123` |
| `settings.id smallint primary key default 1 check (id = 1)` | Garante linha única |
| `created_at`/`updated_at` em tabelas editáveis | Auditoria; trigger `set_updated_at` |
| check `staff.role = 'admin' or store_id is not null` | Atendente precisa de loja |
| check `stock.quantity >= 0`, `order_items.qty > 0`, preços `>= 0` | Integridade |

`stores.hours` (jsonb), chave por dia, `null` = fechado:

```json
{ "mon": { "open": "10:00", "close": "19:00" }, "sun": { "open": "09:00", "close": "12:00" } }
```

Slugs em `stores`, `categories` e `products` são `unique` — é o que torna o `seed.sql` idempotente (`insert ... on conflict (slug) do update`).

### Funções e view

- `is_admin() returns boolean` e `staff_store() returns uuid`: `security definer`, `stable`, `set search_path = ''`, leem `staff` do `auth.uid()` ativo.
- `product_availability` (view, roda como owner para ler `stock` sem expor a tabela): `product_id`, `store_id`, `available = quantity > 0`, `quantity = least(quantity, 10)`; só produtos ativos do tipo `vitrine`. `grant select` para `anon, authenticated`.

### Políticas RLS

| Tabela | anon | atendente | admin |
|---|---|---|---|
| stores, categories, products, product_images, addons, product_addons | select se `active` | select se `active` | tudo |
| highlights | select se vigente | idem | tudo |
| stock | — | select da sua loja | tudo |
| stock_movements | — | select da sua loja | tudo |
| orders, order_items | — | select/update da sua loja | tudo |
| staff | — | select da própria linha | tudo |
| settings | — | select | tudo |

Sem políticas de insert/update/delete para anon em nenhuma tabela. Atendente **não** tem update direto em `stock`: ajustes chegam na etapa 03 por função, para que todo ajuste gere `stock_movements` (regra 2 do `CLAUDE.md`).

Storage `produtos`: bucket público; políticas em `storage.objects` permitem insert/update/delete só com `is_admin()`.

---

## Error Handling Strategy

| Cenário | Tratamento | O que o usuário vê |
|---|---|---|
| Variável de ambiente ausente | `lib/env.ts` lança no primeiro import com o nome da variável | Build/boot falha com mensagem clara (dev) |
| Supabase pausado/fora | `catalog.ts` lança; `cardapio/error.tsx` captura | "Não conseguimos carregar o cardápio agora. Tente de novo em instantes." + botão |
| `?loja=` inválido | Cai na primeira loja | Cardápio normal |
| Produto sem imagem | `productImageUrl(null)` → placeholder | Card com ilustração neutra |
| Script de seed sem service role | Aborta antes de qualquer escrita | Mensagem no terminal |

---

## Testes

| Tipo | O que cobre | Como roda |
|---|---|---|
| Unit (Vitest) | `formatBRL`, `env` | `npm test`, sempre |
| Integração (Vitest) | Aceite do SPEC: anon não lê `orders`, `order_items`, `stock_movements`, `staff`, `settings`; não escreve em nenhuma tabela; lê só ativos; view responde; seed tem as contagens esperadas | `npm run test:integration`, contra o projeto Supabase; pulado com aviso se faltar env |

Sem Docker local (B-001), então não uso `supabase test db`/pgTAP.

---

## Tech Decisions

| Decisão | Escolha | Motivo |
|---|---|---|
| Next.js | 15 (fixado pelo SPEC) | Decisão fechada |
| Tailwind | v4, tokens em `@theme` | Padrão atual do `create-next-app`; tokens do protótipo viram classes `bg-olive`, `text-cocoa` |
| Enum vs check | Enums Postgres | Tipos TS gerados; os valores são estáveis |
| Imagens do seed | Storage via script, não `public/` | SPEC §9 manda para Storage; o painel vai gerir as mesmas imagens |
| Admin | Convite por e-mail | Senha nunca passa pelo repo nem pelo chat |
| Aplicar seed remoto | `supabase db push --include-seed` | Sem Docker local |
| `product_availability` | View como owner | Anon lê disponibilidade sem acesso à tabela `stock` |
| Cardápio | Renderização dinâmica | Mudança no banco aparece no próximo carregamento sem deploy; cache/tag entra na etapa 03 |

---

## Dados do seed e lacunas

| Item | Fonte | Situação |
|---|---|---|
| Lojas 1 e 2 | SPEC §9 | Loja 2 com WhatsApp provisório: vou usar **556796258783** (número do cardápio, que tem um dígito a menos) e marcar como provisório |
| Vitrine: Fatias, Potes, Croissants, Docinhos (coxinhas, morango do amor) | `CAT` do protótipo | Completo, 20 produtos, com imagem |
| Estoque inicial | — | 10 unidades por produto por loja, exceto os marcados "esgotado" no protótipo (`OUT`), que ficam em 0 para testar o rótulo |
| Bolos por kg (5 sabores) | `FL` do protótipo | `price_pending = true`, antecedência 48 h |
| Adicionais (4) | `EX` do protótipo | Preços do protótipo |
| **Bebidas** | SPEC §9 cita, protótipo não tem | Fora do seed; cadastro pelo painel (AD-005) |
| **Cento e kits** | Não existe no protótipo | **Sem dados.** Um item de exemplo de cada, `active = false`, `price_pending = true` |
