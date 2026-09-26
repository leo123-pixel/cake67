# Cake 67 · Especificação do sistema (MVP)

Documento de referência para construir o sistema no repositório `leo123-pixel/cake67`. Ele parte do protótipo aprovado (pasta `cake67-site/`) e do PRD da Onbind. Tudo que está aqui foi decidido com o Leonardo em 25/09/2026. O que ainda está em aberto aparece na seção 12.

## 1. Decisões fechadas

| Tema | Decisão |
|---|---|
| Stack | Next.js (App Router, TypeScript) na Vercel + Supabase (Postgres, Auth, Storage) |
| Repositório | `leo123-pixel/cake67`. O app Next.js fica na raiz; o protótipo vai para `prototipo/` como referência visual |
| Produtos no MVP | Vitrine (preço unitário), bolo por kg (encomenda), salgados e doces por cento, kits festa |
| Estoque | Quantidade por loja, só para itens de vitrine |
| Baixa de estoque | Reserva ao criar o pedido. Cancelado ou expirado devolve ao estoque |
| Encomendas | Sem limite de capacidade por dia no MVP. Só antecedência mínima por produto |
| Pedido | Gravado no sistema com número e status. Em seguida o cliente abre o WhatsApp da loja com o resumo pronto (link wa.me). Pagamento combinado no WhatsApp |
| Entrega | Retirada na loja ou "quero entrega". Taxa e endereço combinados no WhatsApp |
| Cliente | Sem conta. Nome, WhatsApp e observações ficam no pedido |
| Painel | Perfis admin (dona) e atendente (vinculado a uma loja) |
| Painel no MVP | Produtos com fotos, estoque, pedidos, categorias, destaques da home, lojas e horários, relatório simples, usuários |
| Hospedagem de produção | Decidir antes do lançamento. Desenvolver na conta atual (Vercel Hobby + Supabase Free) |

## 2. Stack e bibliotecas

- Next.js 15, App Router, TypeScript, Server Actions para escrita no painel.
- Tailwind CSS com os tokens do protótipo: oliva `#5F6340`, oliva escuro `#474B2F`, pêssego `#F1C8A8`, pêssego claro `#F8E3D2`, linho `#FBF6EF`, cacau `#3E2B20`, framboesa `#B4465A`. Fontes Marcellus (títulos) e Montserrat (texto) via `next/font/google`.
- Supabase: `@supabase/ssr` para sessão em cookies, `@supabase/supabase-js`.
- Zod para validar formulários e o payload do pedido.
- `browser-image-compression` para reduzir fotos no navegador antes do upload (WebP, máx. 1600 px).
- Sem gateway de pagamento no MVP.

## 3. Estrutura de pastas

```
/app
  (site)/            home, cardápio, produto, encomendas, carrinho, checkout, pedido/[code]
  admin/             login, dashboard, pedidos, produtos, estoque, categorias, destaques, lojas, relatorios, usuarios
/components          UI compartilhada (site e admin separados)
/lib                 supabase (server/client/admin), whatsapp.ts, money.ts, validators.ts
/supabase
  migrations/        SQL versionado (schema, RLS, funções)
  seed.sql           lojas, categorias e produtos do cardápio vitrine
/prototipo           cópia do protótipo estático (só referência)
```

Na Vercel, voltar o **Root Directory** para a raiz (vazio) e o Framework para **Next.js** quando o app entrar no repositório.

## 4. Modelo de dados

Valores em centavos (`integer`). Datas em `timestamptz`, fuso de exibição `America/Campo_Grande`.

**stores**: `id`, `slug`, `name`, `address`, `phone`, `whatsapp` (só dígitos, com 55), `hours` (jsonb: dia → abre/fecha), `active`, `sort`.

**categories**: `id`, `name`, `slug`, `kind` (`vitrine` | `encomenda`), `sort`, `active`.

**products**:
- `id`, `category_id`, `name`, `slug`, `description`, `active`, `featured`, `sort`
- `type`: `vitrine` | `bolo_kg` | `cento` | `kit`
- `price_cents`: preço unitário (vitrine), preço do cento (cento) ou preço do kit (kit). No `bolo_kg` é o preço por kg
- `min_qty`, `step_qty`: para `cento`, padrão 25 e 25
- `lead_time_hours`: antecedência mínima para encomendas (padrão 48)
- `weights_kg` (numeric[]): pesos oferecidos no bolo, ex. `{1,1.5,2,...,8}`
- `formats` (text[]): ex. `{Redondo,Retangular,Régua}`
- `kit_contents` (text): o que vem no kit
- `store_ids` (uuid[]): lojas que vendem o produto (vazio = todas)

**product_images**: `id`, `product_id`, `path` (Storage), `alt`, `sort`. Primeira imagem é a capa.

**addons** (adicionais de bolo): `id`, `name`, `price_cents`, `active`, `sort`. Relação N:N `product_addons`.

**stock**: `product_id`, `store_id`, `quantity` (>= 0), `updated_at`. Chave primária composta. Só produtos `vitrine`.

**stock_movements**: `id`, `product_id`, `store_id`, `delta`, `reason` (`ajuste` | `reserva` | `devolucao` | `venda`), `order_id`, `user_id`, `created_at`. Todo ajuste manual e toda reserva geram linha.

**orders**:
- `id`, `code` (ex. `C67-000123`, sequence), `store_id`, `status`, `created_at`, `expires_at`
- `customer_name`, `customer_whatsapp`, `notes`
- `fulfillment`: `retirada` | `entrega`; `delivery_address` (texto livre, opcional)
- `scheduled_for` (data/hora de retirada ou entrega, obrigatório se houver encomenda)
- `subtotal_cents`, `has_made_to_order` (bool)
- `confirmed_at`, `cancelled_at`, `cancel_reason`, `handled_by`

**order_items**: `id`, `order_id`, `product_id`, `name_snapshot`, `type`, `qty`, `unit_price_cents`, `total_cents`, `options` (jsonb: peso, formato, adicionais, sabor, frase).

**staff**: `user_id` (auth.users), `name`, `role` (`admin` | `atendente`), `store_id` (obrigatório para atendente), `active`.

**highlights** (destaques da home): `id`, `slot` (`bolo_do_mes` | `combo_semana` | `banner`), `product_id` (opcional), `title`, `subtitle`, `image_path`, `cta_label`, `cta_href`, `starts_at`, `ends_at`, `active`, `sort`.

**settings** (linha única): `reservation_minutes` (padrão 120), `order_whatsapp_template`, `privacy_text`.

## 5. Fluxo do pedido e regras de estoque

Status: `novo` → `confirmado` → `em_producao` → `pronto` → `entregue`. Saídas: `cancelado` e `expirado`.

1. Cliente monta o carrinho. Um pedido é sempre de **uma loja**. Trocar a loja revalida disponibilidade.
2. No checkout informa nome, WhatsApp, retirada ou entrega, data e hora (se tiver encomenda) e observações. Aceita o aviso de privacidade.
3. O site chama a função `create_order` (Postgres, `security definer`, uma transação):
   - valida preços no banco (nunca confia no preço do navegador);
   - valida `min_qty`/`step_qty` do cento, peso e formato do bolo, antecedência mínima e horário da loja;
   - para itens de vitrine, faz `UPDATE stock SET quantity = quantity - qty WHERE quantity >= qty` com trava de linha; se algum item faltar, aborta e devolve quais itens acabaram;
   - grava pedido `novo` com `expires_at = now() + reservation_minutes`, itens e movimentos `reserva`;
   - retorna `code` e o link do WhatsApp.
4. O site mostra a tela **Pedido recebido** com o número e o botão **Finalizar no WhatsApp**, que abre `https://wa.me/<whatsapp_da_loja>?text=<resumo>`.
5. No painel, o atendente **confirma** (reserva vira `venda` no log) ou **cancela** (devolve ao estoque).
6. Pedido `novo` sem ação até `expires_at` vira `expirado` e devolve o estoque. A função `expire_orders()` roda a cada 5 min via `pg_cron` no Supabase. Como reforço, `create_order` e a listagem de pedidos do painel chamam `expire_orders()` antes de agir. Não usar Vercel Cron para isso, porque no plano Hobby ele só roda uma vez por dia.
7. Item com estoque 0 aparece como **Esgotado** e não entra no carrinho. Painel atualiza o site na hora (`revalidatePath`/`revalidateTag`).

Mensagem de WhatsApp (editável em `settings`):

```
Olá, Cake 67! Pedido *C67-000123*
Loja: Rua Estiva, 200
Retirada em 27/09 às 15h

2x Fatia Karen – R$ 44,00
1x Bolo Ninho com Morango 2 kg, Retangular, Velas – R$ 227,80

Subtotal: R$ 271,80
Nome: Carla · WhatsApp: (67) 9xxxx-xxxx
Obs.: frase "Parabéns, Ana"
```

Para entrega, a linha vira "Quero entrega (taxa a combinar)" com o endereço, se informado.

## 6. Segurança (RLS e acesso)

- RLS ligado em todas as tabelas.
- Público (anon): `select` em `stores`, `categories`, `products` e `product_images` ativos, `addons` ativos e `highlights` vigentes. Estoque exposto por uma view `product_availability` com `available boolean` e `quantity` limitada (sem expor movimentos).
- Pedidos: anon não lê nem escreve tabelas direto. Só executa `create_order`. A tela de confirmação busca por `code` + token aleatório de 32 caracteres guardado no pedido, via função `get_order_public(code, token)`.
- Staff: função `is_admin()` e `staff_store()`. Atendente lê e atualiza pedidos e estoque só da própria loja. Admin acessa tudo, incluindo produtos, destaques, lojas, relatórios e usuários.
- Login do painel com e-mail e senha no Supabase Auth. Cadastro público desligado; admin convida usuários.
- Storage: bucket `produtos` público para leitura; upload e remoção só para admin.
- Service role key só no servidor (convite de usuários). Nunca no navegador.

## 7. Telas do site

- **Home**: destaques do painel (Bolo do Mês, Combo da Semana, banners), atalhos para encomendas e vitrine, lojas.
- **Cardápio / vitrine**: filtro por loja e categoria, disponibilidade em tempo real, "Adicionar".
- **Produto**: fotos, descrição, preço, lojas onde tem.
- **Encomendas**: calculadora de convidados (10 fatias por kg com folga de 15%), configurador de bolo (sabor, peso, formato, adicionais, frase), cento (quantidade em passos de 25) e kits.
- **Carrinho e checkout**: resumo, escolha de loja, data e hora (respeitando antecedência e horário), dados do cliente, aviso de privacidade.
- **Pedido recebido** (`/pedido/[code]`): número, resumo e botão para o WhatsApp.
- **Política de privacidade**.

Visual e animações seguem o protótipo em `prototipo/`.

## 8. Painel administrativo

| Tela | Admin | Atendente |
|---|---|---|
| Dashboard: pedidos de hoje por status, novos em destaque, alerta sonoro e aviso na aba a cada pedido novo (Supabase Realtime) | Todas as lojas | Sua loja |
| Pedidos: lista por data, status e loja; detalhe; mudar status; cancelar com motivo; botão "abrir WhatsApp do cliente"; imprimir comanda | Sim | Sua loja |
| Produtos: criar/editar, tipo, preço, descrição, fotos (várias, arrastar para ordenar), ativar/desativar, lojas, antecedência, pesos e formatos | Sim | Não |
| Estoque: grade produto × loja, ajuste rápido (+/−/definir), "esgotar" com um clique, histórico de movimentos | Sim | Sua loja |
| Categorias: criar, renomear, ordenar | Sim | Não |
| Destaques da home | Sim | Não |
| Lojas: endereço, telefone, WhatsApp, horários | Sim | Não |
| Relatório: pedidos e faturamento por período e loja, ticket médio, mais vendidos, cancelados e expirados. Exportar CSV | Sim | Não |
| Usuários: convidar, perfil, loja, desativar | Sim | Não |
| Configurações: tempo de reserva, modelo da mensagem, texto de privacidade | Sim | Não |

O painel deve funcionar bem no celular, porque a equipe opera no balcão.

## 9. Dados iniciais (seed)

- Lojas: **Loja 1**, Rua Estiva, 200, seg a sáb 10h às 19h, dom 9h às 12h, tel. (67) 3026-8816, WhatsApp 5567981519796. **Loja 2**, Av. Afonso Pena, 2716, seg a sex 10h30 às 18h, sáb 10h às 17h30, tel. (67) 3029-3039, WhatsApp provisório (ver seção 12).
- Categorias e produtos da vitrine com os preços do cardápio (já usados no protótipo): fatias, potes, croissants, coxinhas de morango, morango do amor, bebidas.
- Imagens do protótipo (`prototipo/img`) como fotos iniciais.
- Bolos por kg com preços provisórios marcados como "a definir" no painel.
- Um usuário admin para o Leonardo.

## 10. Requisitos não funcionais

- Mobile first a partir de 360 px. Lighthouse mobile acima de 85.
- Imagens em WebP via `next/image`, carregamento sob demanda.
- LGPD: coleta mínima (nome, WhatsApp, endereço opcional), aviso no checkout, página de privacidade.
- SEO local: metadados por página, `sitemap.xml`, dados estruturados `Bakery` e `Product`.
- Supabase Free pausa o projeto após 7 dias sem uso. Em produção isso não acontece com tráfego real. No desenvolvimento, basta abrir o site ou o painel de vez em quando; se pausar, reativar no painel do Supabase.
- Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 11. Etapas e critérios de aceite

1. **Base**: projeto Next.js, Tailwind com tokens, Supabase ligado, migrations, RLS, seed. Aceite: site lista produtos do banco; anon não acessa pedidos.
2. **Painel de catálogo**: login, produtos com fotos, categorias, lojas, destaques. Aceite: produto criado no painel aparece no site sem novo deploy.
3. **Estoque**: grade por loja, ajustes com histórico, esgotado. Aceite: zerar um item mostra "Esgotado" no site em até 1 minuto.
4. **Pedido**: carrinho, checkout, `create_order`, WhatsApp, expiração. Aceite: dois clientes disputando a última unidade, só um consegue; pedido não confirmado devolve o estoque após o tempo configurado.
5. **Operação**: lista e detalhe de pedidos, status, alerta de novo pedido, comanda. Aceite: atendente da Loja 2 não vê pedidos da Loja 1.
6. **Relatório e ajustes finais**: relatório, CSV, SEO, privacidade, revisão mobile.

## 12. Pendências com a cliente

- WhatsApp correto da Loja 2 (no cardápio está "(67) 9625-8783", com um dígito a menos).
- Preços por kg, pesos e formatos reais dos bolos; itens e preços dos kits e do cento.
- Antecedência mínima real por tipo de encomenda.
- Fotos reais dos produtos (as do protótipo são aquarelas do cardápio e fotos geradas por IA).
- Onde fica a produção: conta da Cake 67 ou da Onbind. A Vercel Hobby é só para uso não comercial, então o lançamento precisa de Vercel Pro ou de outra conta.
- Quem opera o painel em cada loja (para criar os usuários).

## 13. Como começar na nova sessão

Abrir uma sessão do Claude Code com o repositório `leo123-pixel/cake67` selecionado, anexar este arquivo e pedir:

> Leia o SPEC-sistema-cake67.md e implemente a etapa 1 (Base). Mova o protótipo atual de `cake67-site/` para `prototipo/`, crie o app Next.js na raiz, as migrations do Supabase com RLS e o seed. Antes de codar, liste o que precisa de mim (chaves do Supabase, variáveis na Vercel). Pergunte se algo não estiver claro.

Seguir uma etapa por vez, com commit e deploy de preview ao final de cada uma.
