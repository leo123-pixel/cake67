# 12 · Pagamento online pela InfinitePay — Tasks

**Design**: `.specs/features/12-infinitepay/design.md`
**Status**: In Progress (2026-11-16)

| Tarefa | Status | Notas |
|---|---|---|
| T1 Migrations da Stripe na `main` | ✅ | Sem mudança. Resolve o `db push` recusado (B-007) |
| T2 Migration `20261116201549_infinitepay.sql` | ✅ | Três ensaios no projeto real, cada um desfeito no fim. Cobriram: pagamento correto, repetido, segundo pagamento, valor diferente, transação de outro pedido, taxa a combinar, link vencido e novo link, pedido vencido com o link e o estoque voltando, pagamento atrasado refazendo a reserva, formato de `get_order_public` e `report_summary`, anon sem acesso. **Aplicada em 2026-11-16** pelo conector. Advisors sem aviso novo |
| T3 `lib/database.types.ts` à mão | ✅ | |
| T4 `lib/infinitepay.ts` + `lib/payments/*` | ✅ | |
| T5 Rotas `/api/checkout`, webhook e retorno | ✅ | |
| T6 Checkout e página do pedido | ✅ | **Conferência visual pendente** (a tela depende do banco e da chave) |
| T7 Painel: lista, detalhe, comanda, Realtime, Lojas | ✅ | |
| T8 Testes unitários | ✅ | `tests/unit/infinitepay.test.ts`, `tests/unit/payments-webhook.test.ts` |
| T9 Testes de integração `tests/integration/payments.test.ts` | ✅ escrito / ⏳ rodar | Roda contra o projeto real (Leonardo); `rls.test.ts` ganhou `payment_events` |
| T10 README (Pagamentos), `.env.example`, `scripts/simulate-webhook.sh` | ✅ | |
| T11 Entrega | ⏳ | Falta: chave da Jeribá na Vercel, `test:integration`, PR, deploy e o teste real de R$ 1,00 |

## Antes de ligar em produção (com o Leonardo)

1. Criar a API Key no Checkout Integrado da conta da Jeribá e cadastrar `INFINITEPAY_API_KEY_CAKE_ZSF` na Vercel (produção). Sem ela, o site continua só com WhatsApp.
2. Confirmar que `cake-zsf` é a InfiniteTag da Jeribá (Painel → Lojas → Loja 3). Foi gravada pela migration.
3. Política de privacidade: citar a InfinitePay como processadora do pagamento (nome e telefone vão pré-preenchidos no checkout).
4. Teste real de R$ 1,00 (README).
