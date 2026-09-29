# Roadmap

**Current Milestone:** M2 · Lançamento
**Status:** In Progress — M1 (etapas 01–07) publicado em 2026-09-27

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

**02 · Painel de catálogo** - COMPLETE (verificado em localhost e preview em 2026-09-26; PR #2)

- Login (e-mail/senha, sem cadastro público)
- Produtos com fotos (compressão WebP, ordenar), categorias, lojas e horários, destaques
- Usuários da equipe e adicionais de bolo (AD-006)
- Produto com preço a definir fica fora do site
- Aceite: produto criado no painel aparece no site sem deploy

**03 · Estoque** - COMPLETE (verificado em localhost e preview em 2026-09-26; PR #3)

- Grade produto × loja, ajuste +/−/definir, "esgotar", histórico de movimentos
- Contagem da manhã (vitrine inteira de uma vez) — AD-008
- Aceite: zerar item mostra "Esgotado" no site em até 1 min

**04 · Pedido** - COMPLETE (verificado em localhost e preview em 2026-09-26; PR #4)

- Carrinho (uma loja), encomendas (bolo kg, cento, kit), checkout, `create_order`, tela `/pedido/[code]`, link WhatsApp
- `expire_orders()` com pg_cron a cada 5 min
- Limites anti-abuso, CPF/CNPJ opcional para nota, `/privacidade` provisória (AD-009)
- Aceite: disputa pela última unidade, só um vence; pedido não confirmado devolve estoque

**05 · Operação** - COMPLETE (verificado em localhost e preview em 2026-09-26; PR #5)

- Lista/detalhe de pedidos, status, cancelar com motivo, WhatsApp do cliente, comanda
- Dashboard com alerta sonoro (Realtime)
- Reativar pedido expirado se houver estoque; "Hoje" pela data do pedido + "Saem hoje" (AD-010)
- Aceite: atendente da Loja 2 não vê pedidos da Loja 1

**06 · Relatório e acabamento** - COMPLETE (verificado em localhost e preview em 2026-09-27; PR #6)

- Relatório por período/loja, ticket médio, mais vendidos, CSV
- Configurações (reserva, modelo da mensagem, privacidade)
- SEO (metadados, sitemap, `Bakery`/`Product`), página de privacidade, revisão mobile

**07 · Home igual ao protótipo** - COMPLETE (verificado em localhost em 2026-09-27; PR #7)

- Home do `prototipo/index.html` com dados reais: hero animado, bolos, calculadora e configurador, vitrine por abas, lojas, Cakelovers, assistente (AD-012)
- Cabeçalho e rodapé do protótipo em todo o site
- Aceite: lado a lado com `cake67.vercel.app` em 1280 e 375 px; pedido real pela home

**08 · WhatsApp por setor e aviso de confirmação** - COMPLETE (verificado em localhost e preview em 2026-09-28; PR #14)

- Três WhatsApp por loja (pronta entrega, encomenda, SAC); pedido vai para o setor certo; site mostra só o SAC (AD-015)
- Confirmar no painel abre o WhatsApp do cliente com mensagem e link; página do pedido com status real
- Aceite: pedido só vitrine da Loja 2 → (67) 99987-3946; com encomenda → (67) 99625-8783

**09 · Linha do tempo na página do pedido** - COMPLETE (verificado em localhost e produção em 2026-09-28; PR #16)

- Etapas do pedido com data e hora, por tipo (vitrine/encomenda) e retirada/entrega; cancelado e expirado encerram a linha (AD-016)
- `get_order_public` devolve só status e horário de cada mudança

**10 · Bolo inteiro por peso na vitrine** - COMPLETE (verificado em localhost e produção em 2026-09-29; PR #19)

- Tipo `vitrine_kg`: cada bolo físico é uma peça com o peso da balança; o cliente escolhe o peso no card (AD-018)
- Painel: Adicionar bolo, Vendida no balcão, Descartar, Corrigir peso; sobra continua no dia seguinte

---

## M2 · Lançamento

**Goal:** Sair do ambiente de desenvolvimento para produção comercial.

### Features

**Publicação na `main`** - COMPLETE (2026-09-27: PRs #1–#7 mergeados; `cake67.vercel.app` com o sistema)
**Pendências da cliente resolvidas** - PLANNED (ver SPEC §12 e B-002)
**Domínio `www.cake67.com.br`** - COMPLETE (2026-09-28, AD-017)
**Hospedagem de produção (Vercel Pro ou conta da Cake 67)** - PLANNED (por ora nos planos gratuitos, AD-017)

---

## Future Considerations

- Pagamento online (Pix)
- Capacidade de produção por dia
- Cálculo de taxa de entrega por bairro
