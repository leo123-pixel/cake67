# 07 · Home igual ao protótipo — Tasks

**Design**: `.specs/features/07-home-prototype/design.md`
**Status**: Done (2026-09-27) — verificado em localhost; PR #7 aguardando merge

## Progress

| Tarefas | Status | Notas |
|---|---|---|
| T1–T2 | ✅ `baf06ef` | `list_cake_showcase` aplicada no projeto: 5 bolos, preço nulo nos pendentes; PGlite passando |
| T3–T5 | ✅ `baf06ef` | 14 testes (horários por extenso, assistente, data mínima, mensagem do WhatsApp, preferência no carrinho) |
| T6–T13 | ✅ `9eaae8c` | CSS do protótipo com prefixo `ck-`; comparação lado a lado com `cake67.vercel.app` em 1280 e 375 px (capturas do Chrome headless): mesmas seções, cores, fontes e animações. Diferenças intencionais: texto do pagamento, "Preço em breve"/WhatsApp nos bolos, botões com 44 px, esgotado esmaece só a foto, "Quero participar" sem e-mail, sem "Protótipo Onbind" |
| T14 | ✅ | `showcase.test.ts`: anon lista os bolos sem preço pendente e segue sem conseguir cotá-los |
| T15 | ✅ | lint, typecheck, 175 unit, 58 integração, build |
| T16 | ✅ | Vitrine → carrinho (voo + toast + pulso); "Montar este" seleciona o bolo; bolo sem preço → WhatsApp com o bolo na mensagem; bolo com preço (temporário, restaurado) → R$ 219,80 para 2 kg, checkout abre com entrega e o dia escolhidos, subtotal do banco; assistente nas 4 sugestões + pergunta fora das regras → WhatsApp; 360 px sem rolagem em todas as páginas; Lighthouse mobile da home 88/95/100/100 (título do hero aparece depois da abertura, como no protótipo; contraste restante é o pêssego da marca) |
| T17 | ✅ | PR e preview |

Branch: `feat/07-home-prototype`, a partir de `feat/06-report-finish`.

---

## Fase 1 · Banco

### T1: Migration `list_cake_showcase`
**Done when**: PGlite: anon executa; pendente com `price_cents` nulo; inativo fora; bolo do mês marcado; etapas 01–06 passando.

### T2: Tipos e aplicar no projeto

---

## Fase 2 · Lógica pura [P]

### T3: `lib/store-hours.ts`
### T4: `lib/assistant.ts`
### T5: `lib/cake-order.ts` e `preferred` no carrinho
**Done when**: testes unitários de cada um.

---

## Fase 3 · Telas

### T6: `prototype.css`, imagens em `public/home/`
### T7: Cabeçalho, rodapé, toast e "voar para o carrinho"
### T8: Hero, abertura, faixa, paralaxe
### T9: Bolos em destaque
### T10: Calculadora e configurador (carrinho / WhatsApp) + checkout lendo `preferred`
### T11: Vitrine por abas
### T12: Lojas e Cakelovers
### T13: Assistente

---

## Fase 4 · Integração

### T14: Teste de integração (`list_cake_showcase` sem preço pendente)
### T15: Validação completa (lint, typecheck, test, test:integration, build)
### T16: Navegador: lado a lado com produção (1280/375), pedido real pela home, bolo sem preço → WhatsApp, assistente, 360 px, Lighthouse
### T17: Commit, PR (base `feat/06-report-finish`), preview, ROADMAP/STATE
