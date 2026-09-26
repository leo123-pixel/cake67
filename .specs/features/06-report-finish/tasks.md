# 06 · Relatório e acabamento — Tasks

**Design**: `.specs/features/06-report-finish/design.md`
**Status**: Draft

Branch: `feat/06-report-finish`, a partir de `feat/05-operations` (PRs #1–#5 sem merge). Um commit por fase.

---

## Execution Plan

```
Fase 1 · Banco          T1 → T2 → T3
Fase 2 · Lógica pura    T4 [P], T5 [P], T6 [P], T7 [P], T8 [P]
Fase 3 · Painel         T3, T4, T5 → T9 → T10 → T11 ; T6, T8 → T12 → T13 ; T14
Fase 4 · Site e SEO     T6, T7 → T15 → T16 → T17 → T18 [P], T19 [P]
Fase 5 · Integração     T20 → T21 → T22 → T23 → T24
```

---

## Fase 1 · Banco

### T1: Migration de relatório e configurações
**Where**: `supabase/migrations/20261002000100_report_settings.sql` (+ `supabase/seed.sql`)
**What**: `settings.privacy_reviewed`; checks (reserva 15–1440, modelo com `{codigo}` e `{itens}` até 2000, privacidade até 20000); rascunho da política (migration `where privacy_text = ''` e seed); `get_public_settings` com `privacy_reviewed`; `report_summary(p_from, p_to, p_store_id)` só admin, grants explícitos.
**Done when**:
- [ ] Check PGlite: totais com confirmado/em produção/pronto/entregue × cancelado × expirado × novo; pedido às 23h30 de Campo Grande no dia local; filtro por loja; `by_day` e `by_store`; mais vendidos (bolo kg conta 1 e soma kg; cento soma unidades; produto apagado usa `name_snapshot`; limite 10); ticket médio nulo sem pedidos; atendente → 42501; anon sem `execute`; `CK011` (período invertido ou > 400 dias)
- [ ] Check PGlite de `settings`: recusa reserva 10 e 2000, modelo sem `{itens}`; atendente não atualiza; admin atualiza; `get_public_settings` traz `privacy_reviewed`; rascunho presente
- [ ] Checks das etapas 01–05 passando

### T2: Tipos
**Where**: `lib/database.types.ts` — `privacy_reviewed`, `report_summary`.

### T3: Aplicar no projeto
**What**: `supabase db push --db-url`; conferir `privacy_reviewed`, o rascunho e `report_summary` negando atendente.

---

## Fase 2 · Lógica pura (unit tests)

### T4: `lib/report.ts` [P]
**Done when**: `PERIOD_PRESETS`, `resolvePeriod` (hoje, 7 dias, mês, mês passado com virada de ano, personalizado inválido → mês atual com aviso, limite 400 dias), `fillDays`; testes.

### T5: `lib/csv.ts` [P]
**Done when**: `toCsv` com BOM, `;`, `\r\n`, aspas, quebra de linha; anti-fórmula (`=`, `+`, `-`, `@`, tab, CR); `csvCents`; `csvDateTime` em Campo Grande; testes.

### T6: Modelo da mensagem [P]
**Where**: `lib/whatsapp.ts`
**Done when**: `TEMPLATE_VARIABLES`, `templateProblems` (obrigatórias ausentes, desconhecidas), `SAMPLE_ORDER`; testes (o modelo do seed não tem problemas).

### T7: `lib/structured-data.ts` [P]
**Done when**: `bakeryJsonLd` (endereço, telefone, `openingHoursSpecification` a partir de `hours`, dia fechado omitido), `productJsonLd` (preço em reais, `InStock`/`OutOfStock` para vitrine, sem disponibilidade em encomenda), `jsonLdScript` escapa `<`; testes.

### T8: `lib/validation/settings.ts` [P]
**Done when**: Zod de reserva, modelo (via `templateProblems`), privacidade, checkbox; testes.

---

## Fase 3 · Painel

### T9: Consultas do relatório
**Where**: `lib/admin/report.ts` — `getReport`, `exportOrders`, `exportItems`
**Done when**: rpc com período e loja; exportação paginada em 1000 com ordem estável; linhas com as colunas do design.

### T10: Tela `/admin/relatorio`
**Where**: `app/admin/(panel)/relatorio/page.tsx`
**Done when**: `requireAdmin`; filtros por `<form method="get">`; cartões (pedidos, faturamento, ticket médio, cancelados, expirados, aguardando); por dia com barra (dias vazios preenchidos); por loja quando "Todas"; mais vendidos; estado vazio; botões de exportação com os filtros; 360 px.

### T11: Rota do CSV
**Where**: `app/admin/(panel)/relatorio/exportar/route.ts`
**Done when**: não admin → 403; Zod em `tipo`, período e loja; cabeçalhos `text/csv`, `attachment` com nome do período, `no-store`; erro → 500 sem arquivo parcial.

### T12: Tela `/admin/configuracoes`
**Where**: `app/admin/(panel)/configuracoes/{page.tsx,settings-form.tsx,actions.ts}`
**Done when**: `requireAdmin`; `useAdminForm` com `values` no erro; variáveis clicáveis que inserem no cursor; prévia ao vivo com `SAMPLE_ORDER`; erro de variável antes de enviar; privacidade com "Texto revisado pela Cake 67" e selo; `saveSettings` com 0 linhas → `NOT_ALLOWED`; check do banco traduzido.

### T13: Menu
**Where**: `app/admin/(panel)/layout.tsx`
**Done when**: admin com "Relatório" depois de "Pedidos" e "Configurações" no fim; atendente sem mudança.

### T14: Selo de dado provisório no painel [P]
**Done when**: início do admin avisa "Política de privacidade provisória" com link para configurações enquanto `privacy_reviewed` é falso (regra 6).

---

## Fase 4 · Site e SEO

### T15: Privacidade
**Where**: `app/(site)/privacidade/page.tsx`, `lib/storefront.ts`
**Done when**: texto do banco; selo só se não revisado; texto fixo do código removido; texto vazio → frase de contato; descrição da página.

### T16: Metadados e Open Graph
**Where**: `app/layout.tsx`, `app/opengraph-image.tsx`, `app/(site)/produto/[slug]/page.tsx`
**Done when**: `metadataBase` de `NEXT_PUBLIC_SITE_URL`; `openGraph` padrão (pt_BR); imagem 1200×630 da marca sem fonte externa; produto com capa no Open Graph e `canonical`.

### T17: Sitemap, robots e JSON-LD
**Where**: `app/sitemap.ts`, `app/robots.ts`, `components/site/json-ld.tsx`, home e produto
**Done when**: sitemap com páginas fixas + produtos ativos com preço; robots de produção × preview (`disallow: /`); `Bakery` por loja ativa na home; `Product` no produto.

### T18: 404 da marca [P]
**Where**: `components/site/not-found-panel.tsx`, `app/not-found.tsx`, `app/(site)/not-found.tsx`
**Done when**: mesma página para rota inexistente, produto inativo e pedido sem token; atalhos para cardápio e início.

### T19: Revisão mobile [P]
**Done when**: roteiro de 360 px do design sem rolagem horizontal, texto cortado ou alvo principal < 44 px; `sizes`/`priority` das imagens conferidos; correções pontuais registradas nas notas.

---

## Fase 5 · Integração

### T20: Testes de integração
**Where**: `tests/integration/report.test.ts`
**Done when**: pedidos de teste nas duas lojas com `created_at` num dia fixo do passado (um perto da meia-noite local), confirmados/cancelado/expirado pelas funções; `report_summary` bate com a conta à mão (totais, por loja, mais vendidos); atendente → 42501; limpeza (pedidos apagados, estoque e soma dos movimentos intactos).

### T21: Validação completa
lint, typecheck, test, test:integration, build.

### T22: Lighthouse
**Done when**: build de produção local; `npx lighthouse --form-factor=mobile` em home, cardápio, encomendas e produto acima de 85 nas quatro categorias; resultado nas notas.

### T23: Navegador
Relatório (filtros, estado vazio); CSVs com acentos e CPF; configurações (prévia, erro de variável, novo modelo no próximo pedido, restaurar o modelo); privacidade com e sem selo (restaurar); `sitemap.xml`, `robots.txt`, JSON-LD; 404; limpar dados de teste.

### T24: Commit, PR, preview
PR da `feat/06-report-finish` (base `feat/05-operations`); rotas no preview; ROADMAP/STATE (M1 completo).
