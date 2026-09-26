# 05 · Operação — Tasks

**Design**: `.specs/features/05-operations/design.md`
**Status**: Draft

Branch: `feat/05-operations`, a partir de `feat/04-orders` (PRs #1–#4 sem merge). Um commit por fase.

---

## Execution Plan

```
Fase 1 · Banco        T1 → T2 → T3
Fase 2 · Servidor     T4 [P] ; T3 → T5 → T6
Fase 3 · Telas        T6 → T7 → T8 → T9 ; T10 [P] ; T11 [P] ; T12
Fase 4 · Integração   T13 → T14 → T15 → T16
```

---

## Fase 1 · Banco

### T1: Migration de operação
**Where**: `supabase/migrations/20261001000100_operations.sql`
**What**: `order_events` (RLS, grants), triggers de criação e mudança de status, `advance_order`, `cancel_order`, `reactivate_order`, grant de `expire_orders` para `authenticated`, remoção da política "staff updates orders", `orders` na publicação do Realtime (guardado).
**Done when**:
- [ ] Check PGlite: transições válidas e inválidas (`CK021`); `p_from` diferente (`CK020`); confirmar troca `reserva` → `venda` sem mudar a soma; vitrine pula para `pronto`/`entregue`, encomenda não; cancelar devolve estoque, grava motivo e exige motivo; não cancela `entregue`/`expirado`; reativar reserva de novo como `venda` e confirma; reativar sem estoque → `CK010` e nada muda; atendente de outra loja → 42501; atendente sem `update` direto em `orders`; eventos em criação, mudanças e expiração ("Sistema") com motivo no cancelamento; anon sem `order_events`; soma dos movimentos = estoque
- [ ] Checks das etapas 01–04 passando (a checagem antiga "atendente atualiza pedidos da própria loja" passa a esperar 0 linhas)

### T2: Tipos
**Where**: `lib/database.types.ts` — `order_events` e funções.

### T3: Aplicar no projeto
**What**: `supabase db push --db-url`; conferir que `orders` entrou na publicação do Realtime.

---

## Fase 2 · Servidor

### T4: `lib/order-status.ts` [P]
**Done when**: rótulos, tons, `nextStatuses`, `canCancel`, `CANCEL_REASONS`, `minutesLeft` com testes unitários espelhando a tabela de transições.

### T5: Consultas
**Where**: `lib/admin/orders.ts` — `listOrders`, `getOrder`, `getDashboard`
**Done when**: `expire_orders` antes de listar; `novo` sempre visível; "Hoje" pela data do pedido em Campo Grande; "Saem hoje" pela data agendada.

### T6: Server Actions
**Where**: `app/admin/(panel)/pedidos/actions.ts` — `advanceOrder`, `cancelOrder`, `reactivateOrder`
**Done when**: Zod nos limites; CK010 (com nomes), CK020, CK021, 42501 traduzidos; `revalidatePath` do painel.

---

## Fase 3 · Telas

### T7: Lista `/admin/pedidos`
**Done when**: filtros status/loja/data (padrão hoje); `novo` no topo e destacados; tempo restante < 30 min; loja só para admin.

### T8: Detalhe `/admin/pedidos/[id]`
**Done when**: dados completos (inclui CPF/CNPJ formatado), itens com opções e frase, histórico de status, WhatsApp do cliente, link da comanda; 404 para pedido invisível.

### T9: `OrderActions`
**Where**: `components/admin/order-actions.tsx`
**Done when**: só botões válidos; cancelar com motivo (lista + "Outro" com texto); reativar; erros no lugar; alvos ≥ 44 px.

### T10: Comanda [P]
**Where**: `app/admin/(print)/pedidos/[id]/comanda/page.tsx`
**Done when**: sem casca do painel; CSS de impressão 80 mm/A4; frase em destaque; sem CPF/CNPJ; imprime ao abrir.

### T11: Início com o dia [P]
**Where**: `app/admin/(panel)/page.tsx`
**Done when**: a confirmar, contagem por status de hoje, "Saem hoje"; admin com filtro de loja e atalhos; atendente com atalhos de estoque.

### T12: `OrdersLive` e menu
**Where**: `components/admin/orders-live.tsx`, `app/admin/(panel)/layout.tsx`
**Done when**: Realtime com a sessão; refresh em lote; som após "Ativar" (máx. 1 a cada 3 s); título da aba com não vistos enquanto oculta; "Reconectando…"; "Pedidos" no menu dos dois perfis.

---

## Fase 4 · Integração

### T13: Testes de integração
**Where**: `tests/integration/operations.test.ts`
**Done when**: duas confirmações simultâneas → 1 ok + `CK020`; atendente da Loja 2 não lê pedidos nem eventos da Loja 1 e não muda status deles (42501); **Realtime**: atendente da Loja 2 recebe o INSERT da Loja 2 e não o da Loja 1 em até 10 s; cancelar devolve estoque; soma dos movimentos = estoque; limpeza.

### T14: Validação completa
lint, typecheck, test, test:integration, build.

### T15: Navegador
Início e lista; pedido criado por script aparece sozinho (título da aba); confirmar → produção → pronto → entregue; cancelar com motivo; reativar expirado; comanda; limpar dados de teste.

### T16: Commit, PR, preview
PR da `feat/05-operations` (base `feat/04-orders`); aceite no preview; ROADMAP/STATE.
