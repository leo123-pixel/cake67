# 03 · Estoque — Tasks

**Design**: `.specs/features/03-stock/design.md`
**Status**: Done (2026-09-26) — aceite verificado em localhost e preview; PR #3 aguardando merge

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T3 | ✅ `4cb3549` | PGlite 100% (24 checks novos); saldo inicial também no `seed.sql` (em banco novo o seed roda depois das migrations); 34 movimentos de saldo inicial no projeto |
| T4–T6 | ✅ `c9a83ec` | |
| T7–T11 | ✅ `46f5b18` | |
| T12 | ✅ | `stock.test.ts` 7 casos; integração total 42/42; valores originais restaurados |
| T13 | ✅ | lint, typecheck, 80 unit, build |
| T14 | ✅ | 360 px: Esgotar Fatia Karen (Loja 1) → "Esgotado" no `/cardapio?loja=estiva`; 3 toques rápidos em "+" = 3; "Definir" recusa `2,5`; atendente fixo na Loja 2 mesmo com `?loja=estiva`; contagem com campo inválido não grava e mantém tudo; contagem de 3 itens → "3 itens atualizados" e 3 movimentos com autor; "Todas as lojas" no desktop. Correção: `noValidate` na contagem (o `pattern` do navegador bloqueava o envio com mensagem genérica). Valores e usuários de QA restaurados/removidos |
| T15 | ✅ | PR https://github.com/leo123-pixel/cake67/pull/3 (base `feat/02-catalog-panel`). 1º preview falhou no `next/font` (download do Google Fonts, L-011); redeploy do mesmo commit `cake67-290pa96z8-…` Ready: `/admin/estoque` sem sessão → 307 login; `/cardapio?loja=estiva` 20 itens, 3 esgotados |

Branch: `feat/03-stock`, a partir de `feat/02-catalog-panel` (PRs #1 e #2 ainda sem merge). Um commit por fase.

---

## Execution Plan

```
Fase 1 · Banco         T1 → T2 → T3
Fase 2 · Servidor      T3 → T4 [P], T5 [P] → T6
Fase 3 · Telas         T6 → T7 → T8 ; T9 [P] ; T10 [P] ; T11
Fase 4 · Integração    T3 → T12 → T13 → T14 → T15
```

---

## Fase 1 · Banco

### T1: Migration de estoque
**Where**: `supabase/migrations/20260928000100_stock.sql`
**What**: colunas `quantity_after`, `actor_name`; `can_manage_store`, `adjust_stock`, `set_stock`, `count_stock` (security definer, validações, códigos 42501/CK002/CK003/CK004); saldo inicial; grants.
**Done when**:
- [ ] Check PGlite: atendente ajusta a própria loja e não a outra (42501); negativo CK002; > 9999 CK003; produto de encomenda CK004; `set_stock` igual não grava; `count_stock` com item inválido não grava nada; saldo inicial faz soma = quantidade em todas as linhas; anon sem `execute`; atendente continua sem `update` direto em `stock`
- [ ] Checks das etapas 01 e 02 continuam passando

### T2: Tipos
**Where**: `lib/database.types.ts` — colunas novas e 4 funções.

### T3: Aplicar no projeto
**What**: `supabase db push --db-url`.

---

## Fase 2 · Servidor

### T4: Schema da contagem e montagem da grade [P]
**Where**: `lib/validators/stock.ts`, `lib/stock-grid.ts` (puro) + testes
**Done when**:
- [ ] Quantidade: inteiro 0–9999, mensagens PT-BR; contagem lê `qty_<productId>` do form
- [ ] Grade: sem linha = 0; agrupado por categoria na ordem; `visible` por ativo/preço/loja

### T5: `getStaffContext()` e erros novos [P]
**Where**: `lib/auth.ts`, `lib/admin/common.ts`
**Done when**: staff ativo de qualquer perfil; `dbFailure` traduz 42501, CK002, CK003, CK004.

### T6: Consultas e actions
**Where**: `lib/admin/stock.ts`, `app/admin/(panel)/estoque/actions.ts`
**Done when**: `getStockGrid`, `listMovements` (filtros, `limit + 1`); `adjustStock`, `setStock`, `countStock` devolvem a quantidade do banco; erros do Supabase nunca engolidos.

---

## Fase 3 · Telas

### T7: `StockRow`
**Where**: `components/admin/stock/stock-row.tsx`
**Done when**: +/−/Definir/Esgotar; delta pendente somado na tela; valor final vem do banco; erro volta ao confirmado com mensagem; alvos ≥ 44 px.

### T8: Página da grade
**Where**: `app/admin/(panel)/estoque/page.tsx`
**Done when**: atendente fixo na própria loja; admin com seletor e "Todas as lojas" (tabela só leitura); busca no cliente; grupo "Fora do site" recolhido (admin).

### T9: Contagem [P]
**Where**: `app/admin/(panel)/estoque/contagem/page.tsx`, `components/admin/stock/count-form.tsx`
**Done when**: campos pré-preenchidos; eco em erro; resumo "N itens atualizados"; Cancelar volta sem gravar.

### T10: Histórico [P]
**Where**: `app/admin/(panel)/estoque/historico/page.tsx`
**Done when**: filtros produto/loja/período; data em Campo Grande; +N/−N, "ficou com", motivo, quem; "Carregar mais".

### T11: Menu e início do atendente
**Where**: `app/admin/(panel)/layout.tsx`, `app/admin/(panel)/page.tsx`
**Done when**: "Estoque" nos dois menus; início do atendente com atalho para o estoque da loja.

---

## Fase 4 · Integração

### T12: Testes de integração de estoque
**Where**: `tests/integration/stock.test.ts`
**Done when**: 20 incrementos paralelos = +20; soma dos movimentos = quantidade em todas as linhas; atendente da Loja 2 não ajusta nem lê a Loja 1; `set_stock(0)` → `available = false` na view; `count_stock` atômico; valores originais restaurados no fim (com movimentos de volta, sem apagar histórico).

### T13: Validação completa
**What**: lint, typecheck, test, test:integration, build.

### T14: Navegador (360 px)
**What**: esgotar Fatia Karen na Loja 1 → "Esgotado" no `/cardapio?loja=estiva`; contagem de 3 itens → 3 movimentos no histórico; atendente só vê a própria loja; restaurar valores e remover usuários de QA.

### T15: Commit, PR, preview
**What**: PR da `feat/03-stock` (base `feat/02-catalog-panel`); aceite no preview; ROADMAP/STATE.
