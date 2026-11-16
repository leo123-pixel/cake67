# 12 · Pagamento online pela InfinitePay — Design

**Spec**: `.specs/features/12-infinitepay/spec.md`

## Banco (`20261116201549_infinitepay.sql`)

- **Remove a Stripe:** `order_payments`, as 7 funções dela, `stores.payment_account`, `orders.payment_status` (enum `order_payment_status`) e `payment_attempt_status`. Ficam `reserve_order_again` e o ramo expirado → novo de `sync_order_pieces`, que não dependem da Stripe. No projeto, `order_payments` estava vazia e os 148 pedidos tinham `payment_status = 'nenhum'`.
- **`stores.payment_handle`:** a InfiniteTag.
- **`orders`:**
  - `payment_status`: enum `online_payment_status` (`aguardando_pagamento`, `pago`, `expirado`, `cancelado`, `conferir`); nulo = sem pagamento online.
  - Dados do link: `payment_handle`, `checkout_url`, `invoice_slug`, `payment_valid_until`.
  - Dados da transação: `transaction_nsu` (unique), `capture_method`, `installments`, `paid_at`.
  - Valores: `amount_cents` (o cobrado) e `paid_amount_cents` (o pago, com juros).
  - Registro: `receipt_url` e `payment_note`.
  - Um link por vez.
- **`payment_events`:** log bruto (`webhook`, `return`, `checkout`). RLS: a equipe lê os eventos dos pedidos que vê. Só a service role escreve.
- **Funções (só service role):**
  - `begin_online_payment(code, token)` confere as condições: CK041 pago, CK042 sem conta, CK044 encomenda, CK045 taxa a combinar, CK040 status ou valor, CK043 limite de links. Fixa `amount_cents = total_cents` e `valid_until`, estende `expires_at` e devolve os itens. Se o link atual vale por mais 2 min, devolve o mesmo `valid_until`, o que dá um pedido idêntico à InfinitePay e o mesmo link.
  - `attach_payment_link`: grava a URL só se o link ainda é o atual.
  - `settle_online_payment`: idempotente por `transaction_nsu` e decide entre `ok`, `duplicate`, `review` e `ignore` (D9).
- **Recriadas:**
  - `expire_orders`: vence links e leva o link junto quando o pedido vence.
  - `cancel_order`: fecha o link não pago.
  - `get_order_public`: chave `payment`, com `handle` só quando dá para pagar.
  - `report_summary`: `online_cents` sai das colunas novas, mesmas chaves da versão da Stripe.

## Servidor

- `lib/infinitepay.ts`, sem segredos e testável:
  - `createPaymentLink` e `checkPayment` recebem a conta (`handle` + `apiKey`) e o `fetch` por parâmetro;
  - timeouts: link 8 s, retorno 5 s, webhook 700 ms;
  - `readAccount` lê as variáveis; `buildLinkItems` fecha sempre com o valor cobrado; `toCents` usa `Math.round`.
- `lib/payments/confirm.ts`:
  - `confirmTransaction` e `handleWebhook` com as dependências injetadas;
  - o webhook grava o corpo antes de tudo e não processa se o registro falhar;
  - pedido inexistente → 200; repetido → 200 sem `payment_check`.
- `lib/payments/server.ts` (server-only): liga ao Supabase (service role), `startCheckout`, `confirmFromReturn`, `onlinePaymentReady`.
- **Rotas:**
  - `POST /api/checkout`;
  - `POST /api/webhooks/infinitepay`;
  - `GET /api/pagamento/retorno/[code]/[token]`: o código e o token vão no caminho, porque a InfinitePay acrescenta os próprios query params. A rota redireciona com 303 para `/pedido/[code]?t=…&pagamento=ok|retorno`.

## Site e painel

- O checkout calcula `payOnline` a partir de `store.onlinePayment` (calculado no servidor, sem expor a chave), da ausência de encomenda e de a taxa ter sido calculada.
- A página do pedido usa `PayButton` e `PaymentPoll` (atualiza a cada 4 s, por até 80 s).
- O painel lê as colunas novas pelo RLS de `orders`. O Realtime toca o alerta em UPDATE com `payment_status = 'pago'` e `paid_at` recente.
