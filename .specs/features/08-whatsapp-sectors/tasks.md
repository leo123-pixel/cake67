# 08 · WhatsApp por setor e aviso de confirmação — Tasks

**Design**: `.specs/features/08-whatsapp-sectors/design.md`
**Status**: Done (2026-09-28)

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T3 | ✅ | Migration aplicada no projeto (compatível com o código no ar: `stores.whatsapp` anulável, sai num PR seguinte); `whatsapp.test.ts` passando |
| T4–T6 | ✅ | 197 testes unitários passando |
| T7–T11 | ✅ | Formatação original restaurada (sem Prettier, L-021) |
| T12–T13 | ✅ | lint, typecheck, 197 unit, 64 integração, build. Localhost: home só com SAC (Loja 1 (67) 99328-5925, Loja 2 (67) 99619-7916), bolo sem preço → Encomenda; pedido real só vitrine na Loja 2 → (67) 99987-3946, pedido com encomenda → (67) 99625-8783; link mostra Confirmado / Em produção / Pronto para retirar / Entregue / Cancelado com "Falar com a loja" no SAC; 360 px sem rolagem. Achado e corrigido: cartão dizia "Retirada em até 2 h" depois de confirmado. **Não verificado:** clique em Confirmar no painel (login do painel é do Leonardo) |
| T14 | ✅ | PR #14 mergeado; produção mostra o status real (C67-000076 confirmado no preview → "Pedido confirmado" no ar); `stores.whatsapp` apagada depois do deploy |

Branch: `feat/08-whatsapp-sectors`, a partir da `main`.

---

## Fase 1 · Banco

### T1: Migration `20261004000100_whatsapp_sectors.sql`
Renomeia `stores.whatsapp` → `whatsapp_ready`, adiciona `whatsapp_made_to_order` e `whatsapp_support` com os seis números, `get_order_public` com setor (D1) e `support_whatsapp`, `settings.confirmation_whatsapp_template` com check.
**Done when**: PGlite aplica todas as migrations do zero; etapas 01–07 passando.

### T2: `seed.sql` e `lib/database.types.ts`
Seed com os três números por loja, sem o comentário de provisório.
**Done when**: `npm run typecheck` aponta só os usos antigos de `whatsapp` (resolvidos na Fase 3).

### T3: Testes de integração
`get_order_public`: só vitrine → Pronta entrega; misto → Encomenda; `support_whatsapp` presente. `settings` recusa modelo de confirmação sem `{link}` ou `{codigo}`.
**Done when**: testes novos passam em PGlite.

---

## Fase 2 · Lógica pura [P]

### T4: `lib/whatsapp.ts`
`support_whatsapp` em `OrderSummary.store`; `describeConfirmedFulfillment`; `renderConfirmationMessage`; `CONFIRMATION_TEMPLATE_VARIABLES`; `templateProblems(template, variables, required)` para os dois modelos.
**Done when**: testes unitários (variáveis, sem valores, data/hora, retirada sem data, entrega).

### T5: `lib/order-status.ts`
`publicStatus(status, fulfillment)` e `NOTIFY_STATUSES`.
**Done when**: teste cobre os 7 status × retirada/entrega.

### T6: `lib/validators/store.ts` e `settings.ts`
Três campos de WhatsApp com a mesma validação; modelo de confirmação com `{codigo}` e `{link}`.
**Done when**: testes de validador.

---

## Fase 3 · Telas

### T7: Painel · Lojas
Formulário com "WhatsApp · Pronta entrega", "WhatsApp · Encomenda", "WhatsApp · SAC"; lista com os três.

### T8: Painel · Configurações
Segundo modelo (confirmação) com prévia e variáveis, mesmo padrão do modelo do pedido (`useAdminForm`, `values` no erro).

### T9: Painel · Detalhe do pedido
`notifyHref` montado no servidor (modelo + `siteUrl()` + `public_token`); `OrderActions` abre a aba no gesto e leva ao WhatsApp só se a confirmação der certo (Confirmar e Reativar e confirmar); botão "Avisar cliente no WhatsApp" em `NOTIFY_STATUSES`.

### T10: Site · Página do pedido
Título e texto por `publicStatus`; "Finalizar no WhatsApp" só em `novo` (número do setor); "Falar com a loja" (SAC) nos demais.

### T11: Site · Home
`listStores` com `whatsapp_made_to_order` e `whatsapp_support`; seção Lojas com o SAC ("WhatsApp (SAC)"); assistente e Cakelovers no SAC; configurador sem preço no número de Encomenda (D3); `CheckoutStore` sem `whatsapp`.
**Done when**: `grep` não acha mais `\.whatsapp\b` de loja fora dos três nomes novos.

---

## Fase 4 · Verificação e entrega

### T12: Gates
`lint`, `typecheck`, `test`, `test:integration`, `build`.

### T13: Verificação em localhost
Pedido só vitrine da Loja 2 → (67) 99987-3946; pedido com bolo → (67) 99625-8783; home mostra só SAC; Confirmar no painel abre `wa.me/<cliente>` com mensagem e link; o link mostra "Pedido confirmado"; confirmação que falha fecha a aba; 360 px sem rolagem.

### T14: Aplicar e publicar
`supabase db push` no projeto logo antes do merge, fora do horário das lojas (risco do design); PR, preview, `STATE.md` (AD nova, pendência do WhatsApp da Loja 2 resolvida) e `ROADMAP.md`.
