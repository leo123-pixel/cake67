# 01 · Base — Specification

## Problem Statement

O repositório só tem o protótipo estático. Antes de qualquer tela real, precisamos do app Next.js, do banco com schema, segurança (RLS) e dados iniciais, para que as etapas seguintes só adicionem funcionalidade.

## Goals

- [ ] App Next.js na raiz do repo, com o visual do protótipo (tokens e fontes), fazendo build e deploy de preview na Vercel.
- [ ] Banco Supabase com o schema completo do SPEC §4, RLS em 100% das tabelas e seed aplicado.
- [ ] Cardápio público lendo produtos do banco.

## Out of Scope

- Painel, login e qualquer tela de escrita (etapa 02+).
- `create_order`, `expire_orders`, pg_cron (etapa 04). A tabela `orders` e as políticas entram agora; as funções de pedido, não.
- Portar todas as telas do protótipo. Nesta etapa só home simples e cardápio.

---

## User Stories

### P1: Protótipo preservado e app na raiz ⭐ MVP

**User Story**: Como dev, quero o protótipo em `prototipo/` e o app Next.js na raiz, para construir sem perder a referência visual.

**Acceptance Criteria**:

1. WHEN o repo é clonado THEN `prototipo/` SHALL conter `index.html`, `favicon.png` e `img/` idênticos ao `cake67-site/` atual, e `cake67-site/` SHALL não existir mais.
2. WHEN `npm run build` roda THEN o build SHALL passar sem erros de tipo ou lint.
3. WHEN qualquer página do app renderiza THEN SHALL usar Marcellus nos títulos, Montserrat no texto e as cores do SPEC §2 como tokens Tailwind (`olive`, `olive-dark`, `peach`, `peach-light`, `linen`, `cocoa`, `raspberry`).

**Independent Test**: `npm run build` passa; a home abre com fundo linho e títulos em Marcellus.

---

### P1: Schema e RLS ⭐ MVP

**User Story**: Como dona da Cake 67, quero que dados de clientes e pedidos fiquem protegidos desde o início.

**Acceptance Criteria**:

1. WHEN as migrations rodam num banco vazio THEN SHALL criar todas as tabelas do SPEC §4 (`stores`, `categories`, `products`, `product_images`, `addons`, `product_addons`, `stock`, `stock_movements`, `orders`, `order_items`, `staff`, `highlights`, `settings`) com constraints (`quantity >= 0`, enums, FKs, `code` via sequence no formato `C67-000123`).
2. WHEN qualquer tabela é criada THEN RLS SHALL estar ligado nela.
3. WHEN anon faz `select` em `orders`, `order_items`, `stock_movements`, `staff` ou `settings` THEN SHALL receber zero linhas ou erro de permissão.
4. WHEN anon faz `insert`/`update`/`delete` em qualquer tabela THEN SHALL ser negado.
5. WHEN anon lê `products`, `categories`, `stores`, `product_images`, `addons` THEN SHALL ver só linhas `active = true`; `highlights` só vigentes (`active` e dentro de `starts_at`/`ends_at`).
6. WHEN anon consulta `product_availability` THEN SHALL receber `product_id`, `store_id`, `available` e `quantity` limitada (sem expor movimentos).
7. WHEN um usuário staff está logado THEN `is_admin()` e `staff_store()` SHALL retornar seu papel e loja; atendente SHALL ler/atualizar `orders` e `stock` só da própria loja; admin SHALL acessar tudo.
8. WHEN bucket `produtos` existe THEN leitura SHALL ser pública e upload/remoção só para admin.

**Independent Test**: script de teste com a anon key tenta ler/escrever cada tabela e confere o resultado esperado.

---

### P1: Seed ⭐ MVP

**User Story**: Como dev, quero dados reais do cardápio no banco para desenvolver e demonstrar.

**Acceptance Criteria**:

1. WHEN o seed roda THEN SHALL existir Loja 1 e Loja 2 com endereço, telefone, WhatsApp e horários do SPEC §9.
2. WHEN o seed roda THEN categorias e produtos da vitrine SHALL ter os mesmos nomes e preços do protótipo (fatias, potes, croissants, coxinhas de morango, morango do amor, bebidas), com estoque inicial nas duas lojas.
3. WHEN o seed roda THEN bolos por kg, cento e kits SHALL existir com preços marcados como provisórios.
4. WHEN o seed roda THEN as imagens de `prototipo/img` SHALL estar no bucket `produtos` e ligadas aos produtos.
5. WHEN o seed roda THEN SHALL existir `settings` com `reservation_minutes = 120` e modelo de mensagem padrão.
6. WHEN o seed roda duas vezes THEN SHALL não duplicar dados (idempotente).
7. WHEN o admin é criado THEN SHALL existir usuário `comercial.servicoaki@gmail.com` com `role = admin` em `staff` (senha definida pelo Leonardo via convite/reset, nunca no repo).

**Independent Test**: após o seed, `select count(*)` por tabela bate com o esperado e rodar de novo não muda os números.

---

### P1: Cardápio lendo do banco ⭐ MVP

**User Story**: Como cliente, quero ver os produtos da vitrine com preço e disponibilidade por loja.

**Acceptance Criteria**:

1. WHEN abro `/cardapio` THEN SHALL ver os produtos ativos agrupados por categoria, com foto, nome e preço em R$ (formato `R$ 22,00`).
2. WHEN escolho uma loja THEN cada produto de vitrine SHALL mostrar disponível ou **Esgotado** conforme `product_availability` daquela loja.
3. WHEN um produto é desativado direto no banco THEN SHALL sumir do cardápio no próximo carregamento (sem deploy).

**Independent Test**: mudar `active` de um produto no Supabase e recarregar `/cardapio`.

---

### P2: Deploy de preview

**User Story**: Como Leonardo, quero ver cada etapa numa URL de preview.

**Acceptance Criteria**:

1. WHEN há push na branch da etapa THEN a Vercel SHALL gerar preview com Root Directory vazio e Framework Next.js.
2. WHEN o preview abre THEN SHALL usar as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

---

## Edge Cases

- WHEN variável de ambiente do Supabase falta THEN o app SHALL falhar no boot com mensagem clara dizendo qual variável falta.
- WHEN o banco está pausado/inacessível THEN o cardápio SHALL mostrar mensagem de erro amigável em PT-BR, não tela branca.
- WHEN não há produto ativo numa categoria THEN a categoria SHALL não aparecer.
- WHEN o produto não tem imagem THEN SHALL usar um placeholder.

---

## Success Criteria

- [ ] Aceite do SPEC: site lista produtos do banco; anon não acessa pedidos (teste automatizado).
- [ ] `lint`, `typecheck`, `test`, `build` passando.
- [ ] Preview na Vercel funcionando.
