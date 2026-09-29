# 10 · Bolo inteiro por peso na vitrine — Tasks

**Design**: `.specs/features/10-weighed-cakes/design.md`
**Status**: Done (2026-09-29)

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T4 | ✅ | Migrations aplicadas no projeto; `pieces.test.ts` (10 testes) e o `rls.test.ts` com a tabela nova passando; 78 de integração no total |
| T5–T6 | ✅ | `weight.test.ts` (26 casos) + testes de carrinho, validador e grade |
| T7–T10 | ✅ | Ações do estoque chamam a action direto, como o `stock-row` (sem `<form>`), então não precisam de `useAdminForm` |
| T11–T13 | ✅ | Home e assistente ficam sem `vitrine_kg` (`withoutWeighed`); JSON-LD do produto com preço por kg (`UnitPriceSpecification`) |
| T14 | ✅ | lint, typecheck, 234 unit, 78 integração, build. Localhost: 2 peças (1,340/1,620) → card e página do produto; carrinho sem quantidade; outra aba reservou a mesma peça → "Esse bolo acabou de ser reservado"; pedido C67-000162 com peso no resumo, WhatsApp e `/pedido`, sem "Em produção"; cancelar devolve, entregar vende; corrigir peso, venda no balcão, descarte e histórico certos; 360 px sem rolagem; categoria de encomenda recusada. Dados de teste apagados |
| T15 | ✅ | PR #19 mergeado depois do preview (deploy Vercel ok); produção respondendo em `/`, `/cardapio`, `/carrinho` e `/produto` |

Branch: `feat/10-weighed-cakes`, a partir da `main`.

---

## Fase 1 · Banco

### T1: Migration `20261007000100_weighed_cakes_enums.sql`
`product_type += vitrine_kg`, `stock_reason += descarte, correcao_peso`, enum `piece_status`.
**Done when**: aplicada no projeto (só acrescenta valores; o site no ar ignora).

### T2: Migration `20261007000200_weighed_cakes.sql` · estrutura
Tabela `showcase_pieces` (checks, índices, `set_updated_at`), RLS + política de leitura da equipe, grants (`authenticated` select, `service_role` all), view `piece_availability` com grant para anon/authenticated, colunas `order_items.piece_id`, `stock_movements.piece_id`/`weight_g`, check de `delta` com `correcao_peso`.

### T3: Mesma migration · funções
`piece_lock`, `piece_log` (internas, sem grant), `add_piece`, `sell_piece`, `discard_piece`, `set_piece_weight` (grant `authenticated`); `create or replace` de `evaluate_order_lines`, `quote_order`, `create_order` copiando a versão atual e mudando só o do design; trigger `sync_order_pieces`.
**Done when**: aplicada no projeto; `database.types.ts` atualizado à mão; testes de integração existentes de pedido e estoque continuam passando.

### T4: Testes de integração `tests/integration/pieces.test.ts`
Os casos da seção Testes do design (anon, loja de outra atendente, reserva e disputa, expiração, cancelamento, reativação com e sem peça, entrega, ações em peça reservada, pedido só de peça sem agendamento). Limpa o que criar.

---

## Fase 2 · Lógica pura

### T5: `lib/weight.ts`
`parseKgToGrams`, `formatKg`, `piecePriceCents`, `daysOnShowcase` (Campo Grande).
**Done when**: `tests/unit/weight.test.ts` com limites, vírgula/ponto, arredondamento igual ao banco, virada de dia.

### T6: Carrinho, validadores e grade
`cart.ts` (`vitrine_kg`, `piece_id`, qty 1), `validators/order.ts` (`piece_id`), `validators/product.ts` (`vitrineKg`), `stock-grid.ts` (`pieces`).
**Done when**: testes unitários novos para cada um passando.

---

## Fase 3 · Painel

### T7: Cadastro do produto
Tipo "Bolo inteiro (vitrine)", "Preço por kg", campos de encomenda escondidos; action recusa categoria que não é de vitrine.

### T8: Estoque · peças
`lib/admin/stock.ts` carrega peças; `pieces-row.tsx` com Adicionar bolo, Vendida no balcão, Descartar (confirmação), Corrigir peso; reservada mostra o pedido; `estoque/actions.ts` com Zod e mapa de erros. `useAdminForm` + `<form key={round}>`.

### T9: Visão do admin e histórico
Célula "N bolos" na visão de todas as lojas; histórico com peso e rótulos novos; filtro por produto inclui `vitrine_kg`.

### T10: Pedido no painel
Item mostra o peso (`itemLabel`) na lista, no detalhe, na impressão e no CSV.

---

## Fase 4 · Site

### T11: Cardápio
`catalog.ts` com `vitrine_kg` e peças; `piece-picker.tsx`; `product-card.tsx` com "R$ X o kg", Esgotado sem peças.

### T12: Página do produto
`getProductPage` com peças por loja; mesmo seletor; `structured-data` sem `offers` para `vitrine_kg`.

### T13: Carrinho, checkout, WhatsApp e `/pedido`
Linha sem quantidade, mensagem de peça reservada vinda da cotação, peso na mensagem do WhatsApp e na página do pedido.

---

## Fase 5 · Validação e entrega

### T14: Verificação
`lint`, `typecheck`, `test`, `test:integration`, `build`. No localhost: cadastrar um `vitrine_kg` de teste, pôr duas peças (1,340 e 1,620), conferir card, carrinho, pedido, disputa em duas abas, expiração/cancelamento/reativação/entrega, venda no balcão, descarte, correção, histórico, celular 360 px. Apagar os dados de teste.

### T15: Entrega
Commit(s), PR, preview, merge; ROADMAP, STATE (AD-018) e specs marcados como feitos; conferir em produção.
