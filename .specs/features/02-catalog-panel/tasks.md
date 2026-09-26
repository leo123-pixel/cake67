# 02 · Painel de catálogo — Tasks

**Design**: `.specs/features/02-catalog-panel/design.md`
**Status**: Done (2026-09-26) — aceite verificado em localhost e preview; PR #2 aguardando merge

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T6 | ✅ `6e9f4b0` | + `set_product_addons()` atômica (acrescentada na T20); checks PGlite 100% |
| T7–T14 | ✅ `8fefe3c` | `/auth/sair` (route handler) porque RSC não limpa cookie; `admin:link` só gera `recovery` (não cria usuário solto) |
| T15–T24 | ✅ `101d8cf` | lojas ganharam "Nova loja"; destaques podem ser excluídos |
| T25 | ✅ `005d4a9` | **bug encontrado**: site usava a sessão do admin e mostraria itens ocultos → client anônimo `createPublicClient()` |
| T26 | ✅ | migration aplicada no projeto |
| T27 | ✅ | `roles.test.ts`: 11 casos; total integração 35/35; usuários de teste removidos |
| T28 | ✅ | 360 px: link de convite → definir senha → sair → login (erro e sucesso) → criar "Bebidas" + reordenar → produto com erro de validação preservando tudo → criar com `6,5` → foto 2400 px vira WebP 1600 px/6 KB → aparece no `/cardapio` como Esgotado; atendente barrado; desativado perde acesso; Usuários gera link. Correções: `useAdminForm` (reset do React 19 perdia select/checkbox), e-mail preservado no login, `DndContext id` (hidratação). Dados de QA removidos |
| T29 | ✅ | PR https://github.com/leo123-pixel/cake67/pull/2 (base `feat/01-base`); preview `cake67-2vp4ovqaw-…` Ready: `/admin/*` sem sessão → login; `/cardapio?loja=afonso-pena` 20 produtos, 3 esgotados, bolo com preço a definir oculto |

Branch: `feat/02-catalog-panel`, criada a partir de `feat/01-base` (PR #1 ainda sem merge). Um commit por fase.

---

## Execution Plan

```
Fase 1 · Fundação           T1 → T2 ; T3 [P] ; T4 [P] ; T5 → T6
Fase 2 · Auth               T6 → T7 → T8 → T9 → T10 → T11 ; T12 [P]
Fase 3 · Casca do painel    T8 → T13 → T14
Fase 4 · Áreas do catálogo  T14 → T15, T16 → T17 [P], T18 [P], T22 [P], T23 [P], T24 [P]
                            T17 → T19 → T20 → T21
Fase 5 · Site               T2 → T25
Fase 6 · Integração         T1 → T26 → T27 → T28 → T29
```

---

## Fase 1 · Fundação

### T1: Migration do painel
**Where**: `supabase/migrations/20260927000100_catalog_panel.sql`
**What**: política pública de `products` com `not price_pending`; `product_availability` com o mesmo filtro; função `reorder(p_table, p_ids)` (security invoker, whitelist); trigger `ensure_active_admin`; grants.
**Done when**:
- [ ] Check PGlite (scratchpad) passa: anon não vê produto `price_pending` nem na view; `reorder` reordena para admin e não altera nada para atendente; tabela fora da whitelist gera erro; desativar/rebaixar/excluir o último admin gera erro
- [ ] Checagens da etapa 01 continuam passando

### T2: Tipos
**Where**: `lib/database.types.ts`
**What**: `reorder` em `Functions`.
**Done when**: typecheck passa.

### T3: Helpers puros [P]
**Where**: `lib/money.ts` (`parseBRL`), `lib/slug.ts`, `lib/phone.ts` + testes
**Done when**:
- [ ] `parseBRL`: `24,9`/`24,90`/`R$ 24,90`/`1.234,56` → centavos; vazio, negativo, texto → `null`
- [ ] `slugify("Água com Gás!")` → `agua-com-gas`
- [ ] `normalizeWhatsapp("(67) 98151-9796")` → `5567981519796`; 8 dígitos locais aceito; quantidade errada → `null`; `formatWhatsapp` faz o caminho inverso
**Verify**: `npm test`

### T4: Schemas Zod [P]
**Where**: `lib/validators/{product,category,addon,store,highlight,staff}.ts` + testes
**Done when**:
- [ ] Produto: regras por tipo (bolo sem peso/formato, cento sem mín./passo, kit sem conteúdo → erro); preço obrigatório salvo se "a definir"
- [ ] Loja: 7 dias, fechada = `null`, `close > open`
- [ ] Destaque: CTA `/…` ou `https://…`; `fim > início`
- [ ] Staff: atendente exige loja
- [ ] Mensagens em PT-BR

### T5: Dependências
**What**: `browser-image-compression`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
**Done when**: lockfile atualizado, build passa.

### T6: Client do navegador
**Where**: `lib/supabase/browser.ts` (`createBrowserClient`, anon key).

---

## Fase 2 · Auth

### T7: Middleware de sessão
**Where**: `middleware.ts`
**Done when**: `/admin/*` sem sessão → `/admin/login` (exceto `login` e `definir-senha`); matcher não pega o site público.

### T8: `lib/auth.ts`
**What**: `getStaff`, `requireStaff`, `requireAdmin` (server-only).
**Done when**: staff inativo encerra sessão e vai para `/admin/login?erro=inativo`.

### T9: `/auth/confirm`
**Where**: `app/auth/confirm/route.ts`
**Done when**: `verifyOtp` com `token_hash`; `next` só aceita `/admin/…`; falha → `/admin/login?erro=link`.

### T10: Login
**Where**: `app/admin/(auth)/login/{page.tsx,actions.ts}`
**Done when**: mensagem única para credencial errada; mensagens de `?erro=inativo|link`; "Esqueci minha senha" com a orientação do AD-007.

### T11: Definir senha
**Where**: `app/admin/(auth)/definir-senha/{page.tsx,actions.ts}`
**Done when**: exige sessão; mín. 8 e confirmação; depois vai para `/admin`.

### T12: Script `admin:link` [P]
**Where**: `scripts/admin-link.ts`, script `npm run admin:link`
**Done when**: `-- <email> [invite|recovery]` imprime link `…/auth/confirm?token_hash=…&type=…&next=/admin/definir-senha`; e-mail fora da equipe → erro.

---

## Fase 3 · Casca do painel

### T13: Componentes base
**Where**: `components/admin/{admin-shell,field,submit-button,status-badge,money-input,copy-link}.tsx`
**Done when**: menu em gaveta < 768 px, itens por perfil, alvos ≥ 44 px, botão "Sair".

### T14: Layout e início do painel
**Where**: `app/admin/(panel)/layout.tsx`, `app/admin/(panel)/page.tsx`
**Done when**: admin vê atalhos das áreas; atendente vê a loja e o placeholder de pedidos.

---

## Fase 4 · Áreas do catálogo

### T15: Slug único
**Where**: `lib/admin/slug.ts` (+ teste da função de sufixo)

### T16: `SortableList`
**Where**: `components/admin/sortable-list.tsx`
**Done when**: arrastar com toque e mouse + ↑/↓; chama `onReorder(ids)`.

### T17: Categorias [P]
**Where**: `app/admin/(panel)/categorias/{page.tsx,actions.ts}`, `lib/admin/categories.ts`
**Done when**: criar, renomear, tipo, ativar/desativar, reordenar.

### T18: Adicionais [P]
**Where**: `app/admin/(panel)/adicionais/…`, `lib/admin/addons.ts`
**Done when**: criar, preço, ativar/desativar, reordenar.

### T19: Lista de produtos
**Where**: `app/admin/(panel)/produtos/page.tsx`, `lib/admin/products.ts`
**Done when**: miniatura, categoria, tipo, preço ou "Preço a definir", status; filtro por categoria e busca.

### T20: Formulário de produto
**Where**: `app/admin/(panel)/produtos/{novo,[id]}/page.tsx`, `produtos/actions.ts`, `components/admin/product-form.tsx`
**Done when**: campos por tipo, lojas, "Preço a definir", ativo, adicionais aceitos (bolo); cria e edita; erros no campo sem perder dados.

### T21: Fotos do produto
**Where**: `components/admin/product-images.tsx`, actions `addProductImage`, `reorderProductImages`, `updateImageAlt`, `removeProductImage`
**Done when**: WebP ≤ 1600 px antes do upload; path validado no servidor; falha de insert remove o arquivo; ordem salva; remoção apaga linha e arquivo.

### T22: Lojas [P]
**Where**: `app/admin/(panel)/lojas/…`, `components/admin/hours-editor.tsx`, `lib/admin/stores.ts`
**Done when**: dados, WhatsApp com máscara, horários por dia com validação, ativar/desativar, ordem.

### T23: Destaques [P]
**Where**: `app/admin/(panel)/destaques/…`, `lib/admin/highlights.ts`
**Done when**: slot, título, subtítulo, imagem própria (upload WebP) ou do produto, CTA, período, ativo, ordem; status "Vigente / Agendado / Encerrado".

### T24: Usuários [P]
**Where**: `app/admin/(panel)/usuarios/…`, `lib/admin/staff.ts`
**Done when**: lista com e-mail e "Convite pendente"; convidar (cria usuário + staff, mostra link); gerar link de nova senha; editar perfil/loja; desativar/reativar; erro do último admin traduzido; service role só após `requireAdmin()`.

---

## Fase 5 · Site

### T25: Destaques na home
**Where**: `lib/catalog.ts` (`listHomeHighlights`), `components/site/home-highlights.tsx`, `app/(site)/page.tsx`
**Done when**: só vigentes; descarta os de produto invisível; imagem própria → capa do produto → sem imagem.

---

## Fase 6 · Integração

### T26: Aplicar migration
**What**: `supabase db push --db-url` no projeto.

### T27: Testes de integração por perfil
**Where**: `tests/integration/roles.test.ts`
**What**: cria admin e atendente de teste (service role, senha aleatória), faz login com senha e confere: atendente não escreve em produtos, categorias, adicionais, lojas, destaques, staff nem sobe arquivo no bucket; admin escreve; `reorder` só vale para admin; último admin protegido; anon não vê `price_pending`. Remove usuários e dados de teste no fim.
**Verify**: `npm run test:integration`

### T28: Validação completa
**What**: lint, typecheck, test, test:integration, build; navegador em 360 px (localhost): login com o admin de teste, criar categoria "Bebidas" e produto "Água com gás" com foto, ver no `/cardapio`; atendente bloqueado nas áreas de catálogo; limpar dados de teste.

### T29: Commit, push, PR e preview
**What**: PR da `feat/02-catalog-panel` (base `feat/01-base` até o merge do #1); aceite no preview; ROADMAP/STATE atualizados.

---

## Ferramentas

| Tarefas | Ferramentas |
|---|---|
| T1 | PGlite no scratchpad |
| T26 | Supabase CLI (`--db-url`) |
| T28 | Navegador embutido (localhost; credenciais de teste só no `.env.local`) |
| T29 | git, `gh`, conector Vercel (leitura) |
