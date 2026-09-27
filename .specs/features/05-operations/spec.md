# 05 · Operação — Specification

## Problem Statement

Os pedidos já chegam ao banco, mas a equipe não os vê: só expiram. O balcão precisa saber na hora que um pedido entrou, confirmar o que combinou no WhatsApp, acompanhar a produção até a entrega, cancelar com motivo e imprimir a comanda, cada atendente só com a própria loja.

## Goals

- [ ] Pedido novo aparece no painel e toca um alerta em até 10 segundos, sem recarregar a página.
- [ ] Confirmar, avançar status ou cancelar em até 2 toques no celular.
- [ ] Atendente da Loja 2 não vê pedidos da Loja 1 (aceite do SPEC).
- [ ] Estoque continua fechando: confirmação e cancelamento sempre registrados no histórico.

## Out of Scope

- Editar itens, preços ou loja de um pedido (se mudar, cancela e o cliente refaz).
- Pagamento, taxa de entrega, nota fiscal emitida pelo sistema (o CPF/CNPJ só é exibido).
- Notificação ao cliente pelo sistema (a conversa segue no WhatsApp).
- Relatórios e CSV (etapa 06).
- Push notification fora do navegador aberto.

---

## User Stories

### P1: Lista de pedidos ⭐ MVP

**User Story**: Como atendente, quero ver os pedidos da minha loja e achar rápido o que precisa de ação.

**Acceptance Criteria**:

1. WHEN abro `/admin/pedidos` THEN SHALL ver os pedidos com número, cliente, loja (admin), retirada/entrega com data e hora (ou "em até N h"), total, status e há quanto tempo chegou; os `novo` primeiro e destacados.
2. WHEN filtro por status, loja (admin) ou data THEN a lista SHALL respeitar o filtro. A data é a **data em que o pedido foi feito**, em Campo Grande (AD-010); padrão "Hoje". Pedidos `novo` SHALL aparecer sempre, qualquer que seja a data.
3. WHEN sou atendente THEN SHALL ver só os pedidos da minha loja, por tela e por requisição direta (RLS da etapa 01).
4. WHEN abro a lista THEN pedidos `novo` vencidos SHALL virar `expirado` antes de mostrar (SPEC §5.6).
5. WHEN um pedido `novo` está perto de expirar (menos de 30 min) THEN SHALL mostrar o tempo restante em destaque.

**Independent Test**: logar como atendente da Loja 2 com pedidos nas duas lojas e ver só os da Loja 2.

---

### P1: Detalhe do pedido ⭐ MVP

**Acceptance Criteria**:

1. WHEN abro um pedido THEN SHALL ver: número, status e histórico de status (quando e quem), loja, cliente (nome, WhatsApp, CPF/CNPJ se houver), retirada ou entrega com endereço, data e hora, observações, itens com opções (peso, formato, adicionais, frase), valores e subtotal.
2. WHEN toco em **WhatsApp do cliente** THEN SHALL abrir `wa.me/<WhatsApp do cliente>` com "Olá, <nome>! Sobre o pedido <número> da Cake 67…".
3. WHEN o pedido é de outra loja e sou atendente THEN SHALL ver "Pedido não encontrado".

---

### P1: Mudar status ⭐ MVP

**Acceptance Criteria**:

1. WHEN o pedido está `novo` THEN SHALL poder **Confirmar**: status `confirmado`, `confirmed_at`, `handled_by`; a reserva do estoque passa a constar como **venda** no histórico (SPEC §5.5).
2. WHEN está `confirmado` THEN SHALL poder avançar para `em_producao`; de `em_producao` para `pronto`; de `pronto` para `entregue`. Pedido só de vitrine SHALL poder ir de `confirmado` direto para `pronto` ou `entregue`.
3. WHEN tento pular para trás ou para um status não permitido (por tela ou requisição) THEN o banco SHALL recusar.
4. WHEN duas pessoas mudam o mesmo pedido ao mesmo tempo THEN só a primeira transição SHALL valer; a segunda SHALL ver "Este pedido mudou. Atualize a página."
5. WHEN o pedido está `cancelado` ou `entregue` THEN SHALL não oferecer mudança de status.
5a. WHEN o pedido está `expirado` THEN SHALL oferecer **Reativar e confirmar** (AD-010): reserva de novo os itens da vitrine na mesma transação e o pedido vai direto para `confirmado`. Se algum item acabou, NADA SHALL ser reservado e a tela SHALL dizer quais itens faltam; o pedido continua `expirado`. Encomendas SHALL ser reativadas sem checar antecedência (a data já foi combinada com o cliente).
6. WHEN mudo o status THEN a lista e o detalhe SHALL refletir na hora para todos que estão com o painel aberto.

---

### P1: Cancelar com motivo ⭐ MVP

**Acceptance Criteria**:

1. WHEN cancelo um pedido `novo`, `confirmado`, `em_producao` ou `pronto` THEN SHALL escolher um motivo (Cliente desistiu · Não respondeu no WhatsApp · Sem produção para a data · Outro, com texto) e confirmar.
2. WHEN cancelo THEN o estoque da vitrine SHALL voltar com movimento `devolucao`, na mesma transação; `cancelled_at`, `cancel_reason` e `handled_by` gravados.
3. WHEN o pedido é `entregue` ou `expirado` THEN SHALL não poder ser cancelado.
4. WHEN o cliente abre o link do pedido cancelado THEN SHALL ver "Pedido cancelado" (já existe na etapa 04).

---

### P1: Alerta de pedido novo ⭐ MVP

**User Story**: Como atendente no balcão, quero ouvir e ver quando entra um pedido, mesmo com o painel em outra aba.

**Acceptance Criteria**:

1. WHEN um pedido novo da minha loja é criado THEN, com o painel aberto, SHALL aparecer no topo da lista e no início sem recarregar (Supabase Realtime), em até 10 s.
2. WHEN ativo o som (um toque em "Ativar alerta sonoro", exigido pelo navegador) THEN cada pedido novo SHALL tocar um aviso curto.
3. WHEN o painel está em outra aba THEN o título da aba SHALL mostrar a contagem, ex. "(2) Pedidos novos · Cake 67", até eu voltar à aba.
4. WHEN sou atendente THEN SHALL receber alerta só dos pedidos da minha loja (o Realtime respeita o RLS).
5. WHEN a conexão cai THEN SHALL mostrar "Reconectando…" e, ao voltar, recarregar a lista para não perder pedidos.

---

### P1: Início com o dia ⭐ MVP

**Acceptance Criteria**:

1. WHEN abro `/admin` THEN SHALL ver os pedidos **novos** (a confirmar) em destaque, a contagem por status dos pedidos **feitos hoje** e a lista "Saem hoje" (encomendas com retirada/entrega marcada para hoje, confirmadas ou em produção), para a equipe não esquecer o que foi pedido em outro dia.
2. WHEN sou admin THEN SHALL ver todas as lojas, com filtro por loja; atendente, só a sua.
3. WHEN não há pedidos THEN SHALL ver um estado vazio claro, com o atalho para o estoque (atendente) ou o cardápio (admin).

---

### P1: Comanda ⭐ MVP

**Acceptance Criteria**:

1. WHEN toco em **Imprimir comanda** THEN SHALL abrir uma versão para impressão (papel A4 e bobina de 80 mm legíveis) com número, loja, cliente, retirada/entrega com data e hora e endereço, itens com opções e frase em destaque, observações e subtotal.
2. WHEN imprimo THEN a comanda SHALL não mostrar o CPF/CNPJ (minimização; ele aparece no detalhe).

---

## Edge Cases

- WHEN a confirmação acontece segundos antes de o pedido expirar THEN a transição SHALL valer só se ainda for `novo` na hora (a trava do banco decide).
- WHEN o atendente é desativado com o painel aberto THEN a próxima ação SHALL ser recusada e ele levado ao login.
- WHEN o pedido tem item cujo produto foi apagado THEN o detalhe SHALL mostrar o nome guardado no pedido.
- WHEN muitos pedidos entram de uma vez THEN o som SHALL tocar uma vez por lote (no máximo a cada 3 s).

---

## Success Criteria

- [ ] Aceite do SPEC: atendente da Loja 2 não vê pedidos da Loja 1 (tela, requisição direta e Realtime).
- [ ] Confirmar e cancelar mantêm a soma dos movimentos = estoque.
- [ ] Transição concorrente: duas confirmações simultâneas → uma vale, a outra é recusada (teste de integração).
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` e preview.
