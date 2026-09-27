# 04 · Pedido — Specification

## Problem Statement

O site mostra o cardápio, mas não recebe pedidos. O cliente precisa montar o pedido (vitrine e encomendas) no celular, ter a certeza de que o que escolheu da vitrine está separado para ele, receber um número e seguir para o WhatsApp da loja com o resumo pronto. A loja precisa que o estoque reservado volte sozinho se o cliente sumir.

## Goals

- [ ] Do carrinho ao WhatsApp em menos de 2 minutos no celular.
- [ ] Dois clientes disputando a última unidade: só um consegue (aceite do SPEC).
- [ ] Pedido não confirmado devolve o estoque após o tempo de reserva (aceite do SPEC; padrão 120 min).
- [ ] Nenhum valor do pedido vem do navegador: preço, total e regras recalculados no banco.

## Out of Scope

- Confirmar, cancelar e acompanhar pedidos no painel (etapa 05). Nesta etapa o pedido nasce `novo` e só sai desse status por expiração.
- Pagamento online, taxa de entrega, endereço estruturado (combinados no WhatsApp — SPEC §1).
- Conta de cliente, histórico de pedidos do cliente.
- Limite de capacidade de produção por dia (SPEC §1).
- Edição do modelo da mensagem e do tempo de reserva pelo painel (etapa 06; usa os valores de `settings`).

---

## User Stories

### P1: Carrinho ⭐ MVP

**User Story**: Como cliente, quero juntar itens da vitrine e encomendas num pedido de uma loja.

**Acceptance Criteria**:

1. WHEN toco em **Adicionar** num item disponível do cardápio THEN ele SHALL entrar no carrinho com quantidade 1 e o contador do carrinho no topo SHALL atualizar.
2. WHEN o item está **Esgotado** THEN o botão SHALL não aparecer (ou ficar desativado).
3. WHEN aumento a quantidade de um item da vitrine THEN SHALL parar no disponível daquela loja (máx. 10 por item).
4. WHEN o carrinho tem itens e troco de loja THEN o carrinho SHALL revalidar: itens esgotados ou não vendidos na nova loja SHALL ser marcados e não seguir para o checkout até eu removê-los ou voltar à loja anterior.
5. WHEN fecho o navegador e volto THEN o carrinho SHALL continuar lá (só neste aparelho).
6. WHEN o preço de um item muda no painel enquanto está no carrinho THEN o carrinho SHALL mostrar o preço atual ao abrir; o valor final é sempre o do banco.
7. WHEN o carrinho está vazio THEN SHALL mostrar um convite para ver o cardápio e as encomendas.

**Independent Test**: adicionar 2 fatias, trocar para a loja onde uma delas está esgotada e ver o aviso.

---

### P1: Encomendas ⭐ MVP

**User Story**: Como cliente, quero montar um bolo, pedir salgados/doces por cento ou um kit festa.

**Acceptance Criteria**:

1. WHEN abro `/encomendas` THEN SHALL ver bolos, centos e kits ativos com preço definido (produtos com "Preço a definir" não aparecem — AD-006).
2. WHEN uso a **calculadora de convidados** THEN SHALL sugerir o peso (10 fatias por kg com folga de 15%, arredondado para o peso oferecido mais próximo acima) e o formato, como no protótipo, e SHALL poder aplicar a sugestão ao bolo.
3. WHEN configuro um bolo THEN SHALL escolher sabor (o produto), peso entre os oferecidos, formato entre os oferecidos, adicionais aceitos e uma frase opcional (até 60 caracteres); o preço SHALL ser `preço/kg × peso + adicionais`, mostrado na hora.
4. WHEN peço um cento THEN a quantidade SHALL começar no mínimo e variar no passo do produto (padrão 25 em 25); o preço SHALL ser proporcional ao cento.
5. WHEN peço um kit THEN SHALL ver o que vem nele e escolher a quantidade.
6. WHEN adiciono uma encomenda ao carrinho THEN o item SHALL mostrar suas opções (peso, formato, adicionais, frase) e a antecedência mínima.

**Independent Test**: com um bolo de preço definido, montar 2 kg Retangular com Velas e ver o total igual ao cálculo.

---

### P1: Checkout ⭐ MVP

**User Story**: Como cliente, quero informar meus dados e quando vou buscar, sem criar conta.

**Acceptance Criteria**:

1. WHEN abro o checkout THEN SHALL ver o resumo com subtotal e escolher a loja (a do carrinho, podendo trocar com revalidação).
2. WHEN informo nome e WhatsApp THEN o WhatsApp SHALL aceitar `(67) 99999-9999` e ser guardado só com dígitos.
3. WHEN escolho **Retirada** THEN SHALL retirar na loja escolhida; WHEN escolho **Quero entrega** THEN SHALL poder informar o endereço (opcional) e ver "Taxa e entrega combinadas no WhatsApp".
4. WHEN o pedido tem encomenda THEN data e hora SHALL ser obrigatórias; o primeiro horário possível SHALL respeitar a maior antecedência entre os itens e o horário de funcionamento da loja naquele dia; dias fechados SHALL não ser oferecidos.
5. WHEN o pedido só tem itens de vitrine THEN SHALL ver "Retire em até N horas" (tempo de reserva), sem escolher horário.
5a. WHEN informo **CPF ou CNPJ na nota** (opcional) THEN SHALL ser validado pelos dígitos verificadores, aceitar com ou sem pontuação e ser guardado só com dígitos; inválido SHALL mostrar "CPF ou CNPJ inválido". O documento SHALL não aparecer na tela pública do pedido nem na mensagem do WhatsApp; a equipe vê no painel (etapa 05) — AD-009.
6. WHEN não marco o **aviso de privacidade** THEN SHALL não enviar. O aviso SHALL dizer quais dados são coletados (nome, WhatsApp, endereço e CPF/CNPJ opcionais), para quê (atender o pedido e emitir a nota) e como falar com a loja, com link para `/privacidade`.
6a. WHEN abro `/privacidade` THEN SHALL ver o texto de `settings.privacy_text`, com o aviso "Texto provisório" enquanto a cliente não aprovar a versão final (etapa 06).
7. WHEN envio THEN o pedido SHALL ser gravado pelo banco e eu SHALL ir para a tela **Pedido recebido**.
8. WHEN algum item da vitrine acabou entre o carrinho e o envio THEN SHALL ver quais itens acabaram, o carrinho SHALL ser ajustado, e nada SHALL ser gravado.
9. WHEN algo inválido chega ao banco (preço adulterado, peso não oferecido, cento fora do passo, horário fora do expediente, antecedência menor) THEN o pedido SHALL ser recusado com mensagem clara, e o total gravado SHALL ser sempre o calculado no banco.

---

### P1: Pedido recebido e WhatsApp ⭐ MVP

**Acceptance Criteria**:

1. WHEN o pedido é criado THEN SHALL ver o número (ex. `C67-000123`), o resumo e o botão **Finalizar no WhatsApp**.
2. WHEN toco no botão THEN SHALL abrir `wa.me/<whatsapp da loja>` com a mensagem do modelo de `settings` preenchida (número, loja, retirada/entrega com data e hora, itens com opções e valores, subtotal, nome, WhatsApp, observações — SPEC §5).
3. WHEN abro `/pedido/<código>` sem o token certo THEN SHALL ver "Pedido não encontrado" (o link só funciona com o token de 32 caracteres guardado no pedido).
4. WHEN o pedido expirou THEN a tela SHALL dizer "Reserva expirada" e orientar a falar com a loja.
5. WHEN o pedido é criado THEN o carrinho SHALL ser esvaziado.

---

### P1: Reserva, disputa e expiração ⭐ MVP

**Acceptance Criteria**:

1. WHEN o pedido é criado THEN cada item da vitrine SHALL ser baixado do estoque da loja numa única transação, com movimento `reserva` ligado ao pedido; se qualquer item não tiver quantidade, NADA SHALL ser baixado.
2. WHEN dois clientes pedem a última unidade ao mesmo tempo THEN exatamente um SHALL conseguir; o outro SHALL ver que o item acabou.
3. WHEN o pedido fica `novo` além de `expires_at` (`agora + reservation_minutes`) THEN SHALL virar `expirado` e o estoque SHALL voltar, com movimento `devolucao`.
4. WHEN a expiração roda THEN SHALL rodar sozinha a cada 5 minutos no banco (`pg_cron`) e também antes de cada novo pedido.
5. WHEN a expiração roda duas vezes para o mesmo pedido THEN SHALL devolver o estoque uma vez só.

---

### P1: Proteção contra abuso ⭐ MVP

**Why P1**: Qualquer visitante pode reservar estoque sem conta; sem limite, alguém esvazia a vitrine com pedidos falsos.

**Acceptance Criteria**:

1. WHEN um item da vitrine passa de 10 unidades num pedido THEN SHALL ser recusado.
2. WHEN o mesmo WhatsApp já tem 2 pedidos `novo` em aberto THEN um terceiro SHALL ser recusado com "Você já tem pedidos aguardando. Fale com a loja pelo WhatsApp."
3. WHEN o pedido tem mais de 30 linhas THEN SHALL ser recusado.

---

### P2: Página do produto

**Acceptance Criteria**:

1. WHEN abro `/produto/<slug>` THEN SHALL ver fotos, descrição, preço, lojas onde tem (com disponibilidade da vitrine) e o botão de adicionar (ou configurar, para encomendas).
2. WHEN o produto está inativo ou com preço a definir THEN SHALL ver 404.

---

## Edge Cases

- WHEN o cliente escolhe um horário que fica fora do expediente por minutos (ex. 18:55 numa loja que fecha 19:00) THEN SHALL aceitar se for antes do fechamento; o seletor oferece intervalos de 30 min.
- WHEN a loja fica inativa enquanto o carrinho existe THEN o checkout SHALL pedir outra loja.
- WHEN o produto é desativado entre o carrinho e o envio THEN o banco SHALL recusar e o carrinho SHALL remover o item com aviso.
- WHEN o mesmo produto de vitrine aparece em duas linhas THEN o banco SHALL somar as quantidades para reservar.
- WHEN o nome ou as observações têm texto enorme THEN SHALL ser cortado (nome 80, observações 500, frase do bolo 60, endereço 200).
- WHEN o CPF/CNPJ chega ao banco sem passar pela validação do site THEN o banco SHALL validar de novo e recusar se inválido.
- WHEN o navegador tenta mandar preço ou total THEN SHALL ser ignorado.
- WHEN o horário do cliente (fuso do aparelho) difere de Campo Grande THEN datas e horários SHALL ser sempre de Campo Grande.

---

## Success Criteria

- [ ] Aceite do SPEC: disputa pela última unidade — teste de integração com pedidos simultâneos.
- [ ] Aceite do SPEC: pedido expirado devolve o estoque — teste com `reservation_minutes` curto.
- [ ] Soma dos movimentos = quantidade continua valendo com `reserva` e `devolucao`.
- [ ] Anon continua sem ler `orders`/`order_items`; só `create_order` e `get_order_public`.
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` e preview.
