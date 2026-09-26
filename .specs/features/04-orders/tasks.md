# 04 · Pedido — Tasks

**Design**: `.specs/features/04-orders/design.md`
**Status**: Draft

Branch: `feat/04-orders`, a partir de `feat/03-stock` (PRs #1–#3 sem merge). Um commit por fase.

---

## Execution Plan

```
Fase 1 · Banco          T1 → T2 → T3 → T4 → T5
Fase 2 · Lógica pura    T6 [P], T7 [P], T8 [P], T9 [P], T10 [P], T11 [P]
Fase 3 · Servidor       T5 → T12 → T13
Fase 4 · Telas          T11, T13 → T14 → T15 → T16 → T17 → T18 → T19 → T20 [P], T21 [P]
Fase 5 · Integração     T22 → T23 → T24 → T25
```

---

## Fase 1 · Banco

### T1: Migration de pedidos
**Where**: `supabase/migrations/20260929000100_orders.sql`
**What**: `customer_tax_id`; `is_valid_tax_id`, `store_open_at`, `evaluate_order_lines`, `quote_order`, `create_order`, `get_order_public`, `expire_orders`; códigos CK010–CK015; grants.
**Done when**:
- [ ] Check PGlite: preço por tipo (vitrine, bolo com peso/formato/adicionais, cento proporcional, kit); linha inválida recusada (peso/formato/adicional não oferecido, cento fora do passo, qty acima do limite); produto inativo/pendente/não vendido → `indisponivel`
- [ ] `create_order`: reserva com movimento `reserva`; item sem estoque → `CK010` e nada baixado; 3º pedido `novo` do mesmo WhatsApp → `CK012`; encomenda sem horário, antes da antecedência ou fora do expediente → `CK013`; loja inativa → `CK014`; CPF/CNPJ inválido → `CK011`; subtotal é o do banco
- [ ] `get_order_public`: token errado → nulo; resposta sem `customer_tax_id`
- [ ] `expire_orders`: vencido vira `expirado`, devolve com `devolucao`, segunda execução não devolve de novo
- [ ] Anon sem `select` em `orders`/`order_items`; anon sem `execute` em `expire_orders`
- [ ] Soma dos movimentos = quantidade após reserva e devolução; checks das etapas 01–03 passando

### T2: Migration do cron
**Where**: `supabase/migrations/20260929000200_expire_cron.sql`
**What**: `pg_cron` + agendamento a cada 5 min.

### T3: Tipos
**Where**: `lib/database.types.ts` — coluna nova e funções.

### T4: Aplicar no projeto
**What**: `supabase db push --db-url`. Se `pg_cron` for recusado, registrar bloqueio e pedir ativação no painel.

### T5: Conferir o cron no projeto
**What**: pedido de teste com `expires_at` vencido (service role) volta sozinho em até 5 min; limpar.

---

## Fase 2 · Lógica pura (com testes unitários)

### T6: `lib/tax-id.ts` [P]
CPF e CNPJ: normalizar, validar, formatar.

### T7: `lib/cake.ts` [P]
`suggestCake(guests, weights, formats)`.

### T8: `lib/schedule.ts` [P]
`buildSlots(hours, earliestIso, days, step)` em Campo Grande.

### T9: `lib/whatsapp.ts` [P]
`renderOrderMessage` igual ao exemplo do SPEC §5; `whatsappLink`.

### T10: `lib/cart/cart.ts` [P]
Linhas, chave por opções, adicionar/alterar/remover, conversão para itens do pedido.

### T11: `lib/validators/order.ts` [P]
Zod do checkout (nome, WhatsApp, entrega/endereço, CPF/CNPJ, observações, privacidade, horário) e das linhas.

---

## Fase 3 · Servidor

### T12: Consultas públicas
**Where**: `lib/catalog.ts` — `listMadeToOrder()`, `getProductPage(slug)`, `getOrderPublic(code, token)`, `getSettingsPublic()` (privacidade/reserva/modelo via função ou colunas públicas).
**Done when**: tudo via `createPublicClient()`; nada de dados de cliente além do próprio pedido com token.

### T13: Server Actions do site
**Where**: `app/(site)/actions.ts` — `quoteCart`, `placeOrder`
**Done when**: Zod antes do rpc; erros CK010–CK015 traduzidos com ids; nenhum preço aceito do navegador.

---

## Fase 4 · Telas

### T14: Carrinho no cliente
**Where**: `components/site/cart-provider.tsx`, `cart-button.tsx`; `app/(site)/layout.tsx`
**Done when**: persiste em `localStorage` (cai para memória se bloqueado); contador no header.

### T15: Adicionar no cardápio
**Where**: `components/site/add-to-cart.tsx`, `product-card.tsx`
**Done when**: esgotado não adiciona; limite pelo disponível (≤ 10).

### T16: `/encomendas`
**Where**: `app/(site)/encomendas/page.tsx`, `components/site/cake-configurator.tsx`, `guest-calculator.tsx`, `cento-picker.tsx`
**Done when**: calculadora aplica sugestão; preço ao vivo no configurador; cento em passos; estado vazio quando não há encomendas com preço.

### T17: `/carrinho`
**Done when**: preços e problemas vindos do `quote_order`; troca de loja revalida; remover/alterar; "Continuar" bloqueado com problema.

### T18: `/checkout`
**Done when**: campos do T11; slots de data/hora (encomenda) ou "retire em até N h"; CPF/CNPJ opcional; aviso de privacidade; envio trata CK010/CK015 ajustando o carrinho.

### T19: `/pedido/[code]`
**Done when**: 404 sem token válido; resumo; botão WhatsApp com a mensagem; estado "expirado"; esvazia o carrinho.

### T20: `/produto/[slug]` [P]
**Done when**: fotos, descrição, preço, disponibilidade por loja, adicionar/configurar; 404 para inativo/pendente.

### T21: `/privacidade` [P]
**Done when**: texto de `settings` + selo "Texto provisório"; link no rodapé e no checkout.

---

## Fase 5 · Integração

### T22: Testes de integração de pedido
**Where**: `tests/integration/orders.test.ts`
**Done when**: disputa (estoque 1, 5 pedidos simultâneos → 1 sucesso, 4 `CK010`); expiração devolve estoque uma vez; anon não lê `orders`; `get_order_public` sem token → nulo e sem CPF; soma dos movimentos = quantidade; limpeza (expira/devolve e apaga pedidos de teste).

### T23: Validação completa
lint, typecheck, test, test:integration, build.

### T24: Navegador (360 px)
Cardápio → carrinho → troca de loja com esgotado → checkout (vitrine) → pedido → link do WhatsApp; encomenda com um bolo de preço definido temporariamente (restaurar); `/pedido` sem token → 404; limpar pedidos e estoque.

### T25: Commit, PR, preview
PR da `feat/04-orders` (base `feat/03-stock`); aceite no preview; ROADMAP/STATE.
