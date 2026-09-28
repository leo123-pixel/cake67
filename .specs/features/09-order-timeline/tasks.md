# 09 · Linha do tempo na página do pedido — Tasks

**Design**: `.specs/features/09-order-timeline/design.md`
**Status**: Done (2026-09-28)

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T2 | ✅ | Migration aplicada no projeto; `order-timeline.test.ts` (2 testes) passando, motivo do cancelamento não sai |
| T3 | ✅ | 7 casos do design |
| T4–T5 | ✅ | Leitor de tela: texto contrastado (`text-cocoa-soft`) nas próximas em vez de `cocoa/45` |
| T6–T7 | ✅ | lint, typecheck, 204 unit, 66 integração, build. Localhost: C67-000076 (reativado) mostra Recebido → Confirmado 17h01 sem a expiração; pedidos de teste de vitrine com etapa pulada, encomenda, entrega, cancelado e expirado batem com a spec; 360 px sem rolagem. Achado e corrigido: pedido entregue anunciava a última etapa como "em andamento" (agora concluída, com `aria-current` na última). Pedidos de teste apagados |
| T8 | ✅ | PR #16 mergeado; produção mostra a linha do tempo no C67-000076 |

Branch: `feat/09-order-timeline`, a partir da `main`.

---

## Fase 1 · Banco

### T1: Migration `20261006000100_order_timeline.sql`
`get_order_public` com `events: [{ status, at }]`, na ordem dos eventos.
**Done when**: aplicada no projeto (só acrescenta uma chave; o código no ar ignora).

### T2: Teste de integração
`get_order_public` traz `events` só com `status` e `at`, em ordem; sem `actor_name`, `actor_id`, `from_status` ou `note`; token errado continua sem resposta.

---

## Fase 2 · Lógica pura

### T3: `lib/order-timeline.ts`
`buildTimeline` com as regras 1–7 do design; `PublicOrder.events`.
**Done when**: os 7 casos da tabela do design em `tests/unit/order-timeline.test.ts`.

---

## Fase 3 · Tela

### T4: `components/site/order-timeline.tsx`
Lista vertical, estados done/current/upcoming/end, `aria-current="step"`, textos para leitor de tela.

### T5: Página do pedido
Linha do tempo entre o botão do WhatsApp e o resumo.

---

## Fase 4 · Verificação e entrega

### T6: Gates
`lint`, `typecheck`, `test`, `test:integration`, `build`.

### T7: Verificação em localhost
C67-000076 (reativado) mostra Recebido → Confirmado; pedido de teste passando por vitrine com etapa pulada, encomenda, entrega, cancelado e expirado; 360 px sem rolagem; pedidos de teste apagados e estoque devolvido.

### T8: PR e preview
PR, preview, `STATE.md` e `ROADMAP.md`.
