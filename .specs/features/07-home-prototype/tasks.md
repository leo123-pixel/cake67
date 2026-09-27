# 07 · Home igual ao protótipo — Tasks

**Design**: `.specs/features/07-home-prototype/design.md`
**Status**: In Progress

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
