# 11 · Pagamento online (Stripe, uma conta por loja) — Tasks

**Design**: `.specs/features/11-online-payment/design.md`
**Status**: In Progress (2026-10-21)

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1 | ✅ | Migration aplicada no projeto pelo Leonardo (2026-10-21) |
| T2–T4 | ✅ | `20261021000200_online_payment.sql` escrita. Validada num Postgres 16 local com stubs do Supabase (todas as migrations + seed aplicam) e um roteiro SQL com 80 checagens: permissões, `begin_order_payment` (token, CK040–CK043, extensão da reserva, tentativa anterior cancelada), cada linha de `settle_order_payment` (ok, duplicate, ignore, review, duplicidade, cancelado, expirado com e sem estoque, peça `vitrine_kg`), `close_payment_attempt`, `mark_refund`, cancelamento de pedido pago, `reactivate_order` e `report_summary`. Tipos à mão e `rls.test.ts` com a tabela nova. Aplicada no projeto (2026-10-21). `test:integration`: `report.test.ts` ajustado para `online_cents`; `rls.test.ts` passou a aceitar lojas criadas no painel (há uma terceira, `cake67-jeriba`); `hookTimeout` de 30 s depois de um `beforeAll` lento em `operations.test.ts`. Rodada completa no projeto: 12 arquivos, 83 testes passando (2026-10-21); para isso o invariante de estoque passou a ler em páginas (L-022) |
| T5 | ✅ | `tests/integration/payments.test.ts` (11 testes) passando no projeto; rodada completa com 13 arquivos e 94 testes (2026-10-21) |
| T6 | ✅ | `stripe@23.0.0`; `lib/payments/accounts.ts` (pura), `stripe.ts` (`server-only`, client por apelido), `labels.ts`; `.env.example` com as variáveis por apelido; `payments-accounts.test.ts` (25 casos) |
| T7 | ✅ | `checkout-params.ts` (pura) + `checkout.ts` (`server-only`). SDK 23 usa `allowed_payment_method_types` (filtra as formas ativadas na conta) e o Pix só aceita prazo em segundos a partir da escolha: 10 min. Spec D4/D9 e design ajustados. `payments-checkout.test.ts` (7 casos) |
| T8 | ✅ | `webhook.ts` (pura, `handleStripeEvent`), `db.ts` (funções do banco pela service role), `refund.ts` (`refundPayment`, nunca lança: falha vira `falha_devolucao`; `webhookDeps`). Eventos de devolução incluem `refund.failed`. `payments-webhook.test.ts` (18 casos) |
| T9 | ✅ | `app/api/stripe/webhook/[account]/route.ts`: 404 conta desconhecida, 400 sem assinatura ou assinatura de outra conta/corpo alterado, 500 em falha do banco, 200 no resto (inclusive evento que não é nosso, para a Stripe não reenviar à toa). `payments-webhook-route.test.ts` (5 casos, assinatura real do SDK). `build` com chaves falsas: nada da Stripe em `.next/static` |
| T10 | ✅ | `listCheckoutStores` com `paymentsEnabled` (decidido no servidor; o navegador não recebe apelido nem chave); `startPayment(code, token)` em `app/(site)/actions.ts`: tentativa no banco, conta sem chaves → WhatsApp, encerra sessões antigas, cria a sessão, grava o id; falhas marcam a tentativa e encerram a sessão órfã. `payments-start.test.ts` (10 casos) |
| T11 | ✅ | `checkout-form.tsx`: "Como prefere pagar?" só em loja com pagamento ativo (padrão pelo site), resumo e aviso da vitrine acompanham a escolha, explica subtotal/entrega/pesagem, aviso de privacidade cita a Stripe, botão "Fazer pedido e pagar"; depois do `placeOrder` chama `startPayment` e vai para a Stripe, ou cai em `/pedido/...&pagamento=erro`. Loja sem pagamento: igual a hoje. Conferência visual fica para a T18 (a tela depende do banco) |
| T12 | ✅ | `lib/payments/public.ts` (`paymentView`, pura): Pagar agora + Finalizar no WhatsApp para pedido novo de loja com conta; "Pagamento recebido"/"Avisar a loja no WhatsApp" (mensagem com "Pago pelo site") quando pago; avisos de `?pagamento=ok/cancelado/erro`; selo no resumo (pago, devolvido, devolução em andamento, em conferência). `pay-button.tsx`, `payment-poll.tsx` (atualiza a cada 3 s por ~1 min). Linha do tempo com expirado → novo coberta. `payments-public.test.ts` (20 casos). O botão aparece por `store_has_account`; se o apelido estiver sem chaves no servidor, o clique explica e manda para o WhatsApp |
| T13–T16 | ⏳ | Painel |
| T17 | ⏳ | Relatório, CSV e mensagens (P2) |
| T18–T19 | ⏳ | Verificação e entrega |

Branch: a partir da `main`, na branch indicada para a sessão de implementação.

## Antes de começar (com o Leonardo)

- Chaves de **teste** de duas contas Stripe (ou duas sandboxes), uma para `loja1` e outra para `loja2`, no `.env.local` e no preview da Vercel. As contas reais da Cake 67 (uma por CNPJ, com Pix ativado) só são necessárias para ligar em produção.
- Stripe CLI no computador do Leonardo para a verificação manual (T18), ou os webhooks de teste cadastrados apontando para a URL do preview.

---

## Fase 1 · Banco

### T1: Migration `20261021000100_online_payment_enums.sql`
Enums `order_payment_status` e `payment_attempt_status`.
**Done when**: aplicada no projeto (só cria tipos; o site no ar ignora).

### T2: Migration `20261021000200_online_payment.sql` · estrutura
`stores.payment_account` (check do apelido), `orders.payment_status` (padrão `nenhum`), tabela `order_payments` (checks, índices, índice único de pago, `set_updated_at`), RLS + política de leitura da equipe, grants (`authenticated` select, `service_role` all; nada para anon).

### T3: Mesma migration · funções novas
`refresh_payment_status` e `reserve_order_again` (internas, sem grant); `begin_order_payment`, `attach_payment_session`, `fail_payment_attempt`, `settle_order_payment`, `close_payment_attempt`, `mark_refund` (só `service_role`). Erros `CK040`–`CK043`.

### T4: Mesma migration · funções existentes
`create or replace` de `reactivate_order` (usa o helper), `cancel_order` (marca devolução e cancela sessões abertas), `get_order_public` (bloco `payment`), `report_summary` (`online_cents`) e do trigger `sync_order_pieces` (`expirado → novo` com `reserva`), copiando a versão atual e mudando só o do design.
**Done when**: aplicada no projeto; `lib/database.types.ts` atualizado à mão (enums, colunas, tabela, funções); testes de integração existentes de pedido, operação, peças, linha do tempo e relatório continuam passando.

### T5: Testes de integração `tests/integration/payments.test.ts`
Os casos da seção Testes do design (permissões, `begin_order_payment`, cada linha da tabela de `settle_order_payment`, cancelamento de pedido pago, `mark_refund`, relatório). Entra também no `rls.test.ts` a tabela nova. Limpa o que criar.

---

## Fase 2 · `lib/payments` e webhook

### T6: Dependência e contas
`npm install stripe` (versão fixa). `lib/payments/accounts.ts` (`isValidAlias`, `accountEnvNames`, `readAccount`, `accountState`), `lib/payments/stripe.ts` (`stripeFor`, `server-only`), `lib/payments/labels.ts`. `.env.example` com o bloco das variáveis por apelido (comentado).
**Done when**: `tests/unit/payments-accounts.test.ts` e testes dos rótulos passando.

### T7: Sessão de pagamento
`lib/payments/checkout.ts`: `checkoutParams` (pura), `createCheckout` (idempotência pelo `payment_id`), `expireSessions`. Opcional `STRIPE_<APELIDO>_METHODS` (padrão `card,pix`).
**Done when**: `tests/unit/payments-checkout.test.ts` confere valor, linha única, formas, expirações, URLs e metadata.

### T8: Devolução e eventos
`lib/payments/refund.ts` (`refundPayment` + `mark_refund`), `lib/payments/webhook.ts` (`handleStripeEvent` com `deps` injetáveis).
**Done when**: `tests/unit/payments-webhook.test.ts` cobre cada evento da tabela do design, inclusive `refund` automático e `unpaid` sem efeito.

### T9: Rota do webhook
`app/api/stripe/webhook/[account]/route.ts` (Node, dinâmica): 404 sem conta, 400 assinatura inválida ou `ignore`, 500 em falha de banco/rede, 200 no resto; log sem dados do cliente.
**Done when**: teste da rota com `generateTestHeaderString` (válida, inválida, apelido desconhecido); nenhuma chave em `NEXT_PUBLIC_*` nem no bundle do cliente (`grep` no `.next/static` depois do build).

---

## Fase 3 · Site

### T10: Lojas e action de pagamento
`listCheckoutStores` com `paymentsEnabled`; `startPayment(code, token)` em `app/(site)/actions.ts` com Zod, admin client, mapa de erros `CK040`–`CK043` e `fail_payment_attempt` quando a Stripe falha.

### T11: Checkout
Rádio "Como prefere pagar?" só em loja com pagamento ativo (padrão pagar agora), texto do pagamento acompanhando a escolha, redirecionamento para a Stripe depois do `placeOrder`, queda em `/pedido/...&pagamento=erro`. Aviso de privacidade cita a Stripe. Loja sem pagamento: checkout idêntico ao de hoje.

### T12: Página do pedido
`PublicOrder.payment`; `pay-button.tsx`; estados de `?pagamento=ok|cancelado|erro`; `payment-poll.tsx` (até 1 min); selo "Pago pelo site"; **Avisar a loja no WhatsApp** com a linha "Pago pelo site"; mensagens de devolução; `order-timeline` aceitando `novo → expirado → novo`.
**Done when**: testes unitários da linha do tempo e da mensagem; 360 px sem rolagem horizontal.

---

## Fase 4 · Painel

### T13: Lojas
Campo "Conta de pagamento online" no formulário, validador e action; situação Ativo / Conta sem chaves no servidor / Desligado calculada no servidor. `useAdminForm` + `<form key={round}>` (regra 10), `values` no erro.

### T14: Lista e detalhe do pedido
`payment_status` na lista com selo; bloco **Pagamento** no detalhe (forma, valor, data/hora em Campo Grande, situação, nota, `payment_intent_id`); comanda impressa mostra "Pago pelo site" quando pago.

### T15: Cancelar pedido pago e reembolso pendente
Aviso de devolução no diálogo; `cancelOrder` chama `refundPayment` com a conta gravada e encerra sessões abertas; `retryRefund` para `falha_devolucao`; mensagens finais.

### T16: Tempo real
Conferir que a mudança de `payment_status` atualiza a lista e o início sem tocar o alerta de pedido novo.

---

## Fase 5 · P2

### T17: Relatório, CSV e mensagem de confirmação
Cartão "Pago pelo site" no relatório (total e por loja); colunas "Pagamento" e "Devolvido" no CSV; variável `{pagamento}` no modelo de confirmação (validação e prévia em Configurações); parágrafo sugerido da política de privacidade para o admin colar.
**Done when**: testes unitários do CSV, do relatório e do modelo atualizados.

---

## Fase 6 · Validação e entrega

### T18: Verificação
`lint`, `typecheck`, `test`, `test:integration`, `build`. No localhost, com as chaves de teste e a Stripe CLI:
- pedido na Loja 1 pago com cartão de teste → pago no painel e na conta de teste da Loja 1; o mesmo na Loja 2 com a conta dela;
- Pix de teste; cartão recusado; desistir na Stripe e pagar depois pela página do pedido;
- deixar a sessão expirar; pagar em duas abas (a segunda é devolvida);
- cancelar pedido pago (devolução); simular falha de devolução e **Tentar devolver de novo**;
- pedido expirado que recebe pagamento atrasado, com e sem estoque (evento reenviado pela Stripe CLI);
- loja sem apelido e loja com apelido sem chaves: checkout e página do pedido iguais aos de hoje;
- celular 360 px no checkout, na página do pedido e no detalhe do painel.
Apagar os dados de teste.

### T19: Entrega
Commit(s), PR, preview com chaves de teste, merge. Produção sem variáveis da Stripe até as contas reais existirem (recurso desligado). ROADMAP, STATE (AD-019) e specs marcados como feitos. Para ligar em produção, com o Leonardo: variáveis das contas reais na Vercel (Production), webhooks cadastrados em cada conta Stripe com os eventos do design, apelido preenchido em cada loja, política de privacidade atualizada.
