# Roadmap

**Current Milestone:** M1 · MVP
**Status:** In Progress

Cada feature = uma etapa do SPEC (seção 11). Uma por vez, com commit e deploy de preview ao final.

---

## M1 · MVP

**Goal:** Site recebendo pedidos reais com estoque confiável e equipe operando pelo painel.
**Target:** Critérios de aceite das 6 etapas passando em preview.

### Features

**01 · Base** - COMPLETE (verificado no preview em 2026-09-26; PR #1)

- Protótipo movido para `prototipo/`, app Next.js na raiz
- Tailwind com tokens e fontes do protótipo
- Migrations: schema completo, RLS, `is_admin()`, `staff_store()`, view `product_availability`
- Seed: lojas, categorias, produtos da vitrine, imagens, admin
- Aceite: site lista produtos do banco; anon não acessa pedidos

**02 · Painel de catálogo** - PLANNED

- Login (e-mail/senha, sem cadastro público)
- Produtos com fotos (compressão WebP, ordenar), categorias, lojas e horários, destaques
- Usuários da equipe e adicionais de bolo (AD-006)
- Produto com preço a definir fica fora do site
- Aceite: produto criado no painel aparece no site sem deploy

**03 · Estoque** - PLANNED

- Grade produto × loja, ajuste +/−/definir, "esgotar", histórico de movimentos
- Aceite: zerar item mostra "Esgotado" no site em até 1 min

**04 · Pedido** - PLANNED

- Carrinho (uma loja), encomendas (bolo kg, cento, kit), checkout, `create_order`, tela `/pedido/[code]`, link WhatsApp
- `expire_orders()` com pg_cron a cada 5 min
- Aceite: disputa pela última unidade, só um vence; pedido não confirmado devolve estoque

**05 · Operação** - PLANNED

- Lista/detalhe de pedidos, status, cancelar com motivo, WhatsApp do cliente, comanda
- Dashboard com alerta sonoro (Realtime)
- Aceite: atendente da Loja 2 não vê pedidos da Loja 1

**06 · Relatório e acabamento** - PLANNED

- Relatório por período/loja, ticket médio, mais vendidos, CSV
- Configurações (reserva, modelo da mensagem, privacidade)
- SEO (metadados, sitemap, `Bakery`/`Product`), página de privacidade, revisão mobile

---

## M2 · Lançamento

**Goal:** Sair do ambiente de desenvolvimento para produção comercial.

### Features

**Pendências da cliente resolvidas** - PLANNED (ver SPEC §12)
**Hospedagem de produção (Vercel Pro ou conta da Cake 67) e domínio** - PLANNED

---

## Future Considerations

- Pagamento online (Pix)
- Capacidade de produção por dia
- Cálculo de taxa de entrega por bairro
