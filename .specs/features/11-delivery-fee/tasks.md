# 11 · Taxa de entrega calculada no site (Juma) — Tasks

**Design**: `.specs/features/11-delivery-fee/design.md`
**Status**: In Progress (2026-11-11)

| Tarefa | Status | Notas |
|---|---|---|
| T1 Migrations `20261111000100_delivery_fee.sql` e `…000200_delivery_fee_template.sql` | ✅ | Validadas num Postgres 16 local (L-023): todas as migrations + seed aplicam; roteiro com cálculo válido, antigo, com falha, de outro endereço, de outra loja, id inválido, taxa vinda do navegador (ignorada), endereço incompleto (CK011), endereço livre antigo, retirada, anon/equipe sem acesso a `delivery_quotes`, `get_order_delivery` com e sem token; a 000200 é idempotente. O modelo da mensagem foi para a 000200, a aplicar **depois** do deploy |
| T2 `lib/database.types.ts` à mão | ✅ | |
| T3 `lib/delivery/machine.ts` + testes | ✅ | `tests/unit/delivery.test.ts` (15 casos) |
| T4 `lib/delivery/quote.ts` + actions | ✅ | nunca lança; chave de reaproveitamento mantém maiúsculas (o `lower()` do Postgres e do JS divergem em acentos) |
| T5 Checkout | ✅ | aviso de privacidade cita a Juma. **Conferência visual pendente** (a tela depende do banco) |
| T6 Mensagem e página do pedido | ✅ | linha só com variável vazia sai da mensagem |
| T7 Painel: lojas, pedido, lista, comanda, CSV | ✅ | lista mostra o total; selo "Entrega: taxa a combinar" na loja sem Juma |
| T8 Testes de integração `tests/integration/delivery.test.ts` | ✅ escrito / ⏳ rodar | roda contra o projeto real (Leonardo), depois da migration; `rls.test.ts` ganhou `delivery_quotes` |
| T9 Verificação e entrega | ⏳ | lint, typecheck, test (265) e build passando na sessão; nada da Juma no bundle além dos nomes das variáveis no texto de ajuda. Falta: migration no projeto, `test:integration`, `juma:check`, preview e conferência visual |

## Antes de ligar em produção (com o Leonardo)

1. Aplicar a migration (`supabase db push --db-url ...`). O projeto tem as migrations da Stripe, que não estão na `main`; ver nota em STATE.
2. Variáveis `MACHINE_*` no `.env.local`, no preview e em produção da Vercel (Sensitive, sem `NEXT_PUBLIC_`).
3. `npm run juma:check` no computador do Leonardo: categorias e uma estimativa da Loja 1 até um endereço de teste.
4. Em Lojas, preencher rua, número, bairro e categoria de cada loja.
