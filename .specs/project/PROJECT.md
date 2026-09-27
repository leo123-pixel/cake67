# Cake 67

**Vision:** Site de pedidos e painel operacional da confeitaria Cake 67 (Campo Grande/MS): o cliente monta o pedido no site, o estoque é reservado na hora e o pedido segue para o WhatsApp da loja.
**For:** Clientes da Cake 67 (celular, sem conta) e equipe das lojas (dona = admin, atendentes por loja).
**Solves:** Hoje pedidos e disponibilidade são tratados só no WhatsApp; não há estoque por loja, número de pedido nem visão de operação.

Fonte da verdade detalhada: [SPEC.md](SPEC.md) (decisões de 25/09/2026). Este arquivo resume; em conflito, vale o SPEC.

## Goals

- Pedido completo (carrinho → número → WhatsApp) em menos de 2 min no celular.
- Zero venda de item esgotado: duas pessoas disputando a última unidade, só uma consegue.
- Mudanças do painel (produto, estoque, destaque) aparecem no site sem deploy, em até 1 min.
- Lighthouse mobile > 85.

## Tech Stack

**Core:**

- Framework: Next.js 15 (App Router, Server Actions) na Vercel
- Language: TypeScript
- Database: Supabase (Postgres + Auth + Storage + Realtime + pg_cron)
- Package manager: npm · Node 24

**Key dependencies:** `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS (tokens do protótipo), Zod, `browser-image-compression`.

## Scope

**v1 includes:**

- Site: home com destaques, cardápio de vitrine com disponibilidade por loja, produto, encomendas (bolo por kg, cento, kits), carrinho, checkout, tela do pedido com link wa.me, privacidade.
- Pedido via função `create_order` (transação, preço do banco, reserva de estoque, expiração).
- Painel: pedidos, estoque, produtos com fotos, categorias, destaques, lojas/horários, relatório + CSV, usuários, configurações.
- RLS em todas as tabelas; atendente limitado à própria loja.

**Explicitly out of scope:**

- Pagamento online / gateway.
- Conta de cliente, login de cliente.
- Cálculo de taxa de entrega e endereço estruturado (combinado no WhatsApp).
- Limite de capacidade de produção por dia.
- Estoque para itens de encomenda.

## Constraints

- Desenvolvimento em Vercel Hobby + Supabase Free; produção precisa de Vercel Pro ou outra conta (pendente).
- Supabase Free pausa após 7 dias sem uso.
- Público no celular a partir de 360 px; painel usado no balcão pelo celular.
- LGPD: coleta mínima (nome, WhatsApp, endereço opcional).
- Visual segue o protótipo em `prototipo/`.
