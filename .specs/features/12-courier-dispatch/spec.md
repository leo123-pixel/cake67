# 12 · Chamar o entregador da Juma pelo painel — Specification

**Status**: Draft (aguardando aprovação do Leonardo e respostas da Juma)
**Depende de**: etapa 11 (taxa da Juma, no ar) e do checkout com pagamento online (a definir; a versão Stripe ficou de lado)

## Problem Statement

Desde a etapa 11 o pedido com entrega sai do site com a taxa da Juma no total, mas o entregador ainda é chamado por fora: o atendente abre o app ou o WhatsApp da Juma, digita o endereço de novo e acompanha a corrida em outro lugar. O cliente não tem como saber onde está o pedido depois que ele sai da loja.

A mesma API da Juma (plataforma Machine, **Entregas v2**) abre a entrega (`POST /entregas`), informa cada mudança de situação por aviso assinado (webhook `status`, cabeçalho `Signature-V2`), devolve o link de rastreio (`GET /entregas/{id}/links-rastreio`) e cancela (`POST /entregas/{id}/cancelar`). O usuário Gestor da Cake 67 já tem as permissões **API · Entrega** e **API · Webhook**.

## Goals

- [ ] O atendente chama o entregador da Juma com um clique no pedido, sem redigitar endereço.
- [ ] O painel e o cliente veem a situação da entrega sem sair do sistema.
- [ ] Nenhuma entrega fica aberta na Juma para um pedido cancelado, e nenhum pedido pago com entrega fica esquecido sem entregador.

## Out of Scope

- **Cobrar a entrega do cliente**: já está no total do pedido (etapa 11) e o pagamento é do checkout novo.
- **Escolher o entregador** (`condutor`): a entrega segue o despacho da Juma.
- **Várias paradas** numa só corrida (juntar pedidos): uma entrega por pedido.
- **Mapa com a posição do entregador** no site (webhook `posicao`): o link de rastreio da Juma já mostra isso.
- **Conversar com o entregador** pelo sistema.
- **Retirada pelo cliente**: não chama entregador.
- Ajustar o total do pedido quando a Juma cobrar diferente do estimado: a Cake 67 absorve (etapa 11, D1).

## Decisões

- **D1 · Chamada manual pelo painel (MVP).** O botão "Chamar entregador" aparece no pedido com entrega quando ele está **Pronto** e **pago** (ou, enquanto o checkout com pagamento não existir, confirmado). A chamada automática fica em P2 (D9). **Pendente de aprovação do Leonardo.**
- **D2 · Uma entrega ativa por pedido.** O sistema guarda o número da entrega da Juma no pedido. Enquanto houver uma entrega ativa (não finalizada, cancelada ou não atendida), o botão não aparece e um segundo clique não abre outra.
- **D3 · O que vai para a Juma.** Partida = endereço da loja do pedido (o mesmo da etapa 11). Parada = endereço em campos do pedido, complemento e referência; `nome_cliente_parada` e `telefone_cliente_parada` do pedido; `id_externo` = código do pedido (`C67-000123`); `observacao_parada` = observação do pedido. Categoria = a da loja (39792). `info_antes_aceite` = "Cake 67 · {loja}" (até 70 caracteres).
- **D4 · Forma de pagamento à Juma.** A Cake 67 paga a Juma; o cliente já pagou a taxa no total. Valor de `forma_pagamento`: **Faturado (`F`) ou Carteira de créditos (`R`) — perguntar à Juma**. Fica numa variável de configuração, não no código.
- **D5 · Situação vem por aviso, com consulta de reserva.** A Juma avisa cada mudança pelo webhook `status`; o sistema confere a assinatura (`Signature-V2`, SHA-512 com a chave da API) e ignora aviso repetido (`event_id`). Como a documentação não garante reenvio, o painel também consulta `GET /entregas/{id}/status` ao abrir um pedido com entrega ativa.
- **D6 · Entrega finalizada move o pedido.** Quando a Juma informa **Finalizada (`F`)**, o pedido passa a **Entregue** sozinho, com "Sistema · Juma" na linha do tempo. Os outros status da Juma não mudam o status do pedido; aparecem só como situação da entrega.
- **D7 · Cancelar o pedido cancela a entrega.** Cancelar um pedido com entrega ativa cancela na Juma no mesmo gesto. Se a Juma recusar (por exemplo, entrega já finalizada), o pedido não é cancelado e o painel mostra o motivo.
- **D8 · Código de confirmação (opcional por loja).** Com a opção ligada na loja, o sistema gera 4 dígitos (`codigo_confirmacao`), mostra ao cliente na página do pedido e a Juma pede ao entregador na entrega. **Pendente: ligar por padrão ou não.**
- **D9 · Chamada automática (P2).** Opção por loja: chamar o entregador sozinho quando o pedido pago com entrega passa a **Pronto**. Desligada por padrão.
- **D10 · Encomendas agendadas usam a mesma chamada.** O atendente chama quando o bolo está pronto, no dia. A entrega programada da Juma (`POST /entregas/programadas`, cuja data é a do envio aos entregadores, não a da chegada) fica fora desta etapa.
- **D11 · Credenciais e cadastro.** Mesmo login e chave da etapa 11 (`MACHINE_*`, só no servidor). Se a Juma pedir um cadastro por loja, o design ganha um login por loja; a spec não muda.

---

## User Stories

### P1: Chamar o entregador ⭐ MVP

**User Story**: Como atendente, quero chamar o entregador da Juma pelo pedido, para não redigitar o endereço em outro app.

1. WHEN um pedido com entrega está Pronto e pago (D1) e não tem entrega ativa THEN o detalhe do pedido SHALL mostrar o botão "Chamar entregador (Juma)".
2. WHEN clico THEN o sistema SHALL abrir a entrega na Juma com os dados de D3/D4 e mostrar "Entregador chamado · Distribuindo".
3. WHEN a Juma recusa a chamada (endereço não encontrado, fora da área, sem entregador por perto, credencial) THEN o painel SHALL mostrar o motivo em português e o botão SHALL continuar disponível; o pedido não muda.
4. WHEN dois atendentes clicam ao mesmo tempo THEN só uma entrega SHALL ser aberta (D2).
5. WHEN o pedido é de retirada, está cancelado ou expirado, ou a loja não tem a Juma configurada THEN o botão SHALL não aparecer.
6. WHEN sou atendente de outra loja THEN SHALL não ver nem chamar entregador para esse pedido (RLS da loja, como hoje).

**Independent Test**: num pedido de teste com entrega, chamar o entregador e ver a entrega aparecer na Juma com o código `C67-…` em `id_externo`; cancelar em seguida.

### P1: Acompanhar a entrega ⭐ MVP

**User Story**: Como loja e como cliente, quero ver em que pé está a entrega.

1. WHEN a Juma avisa uma mudança THEN o pedido SHALL mostrar a situação em português: Distribuindo, Aguardando aceite, Aceita (entregador a caminho da loja / na loja), Em andamento, Finalizada, Não atendida, Cancelada; com o nome e o veículo do entregador quando a Juma enviar.
2. WHEN o aviso não tem assinatura válida THEN SHALL ser recusado e registrado no log, sem mudar nada.
3. WHEN o mesmo aviso chega duas vezes THEN SHALL ter efeito uma vez só.
4. WHEN abro um pedido com entrega ativa THEN o painel SHALL consultar a situação na Juma se o último aviso tiver mais de 2 minutos (D5).
5. WHEN a entrega é **Finalizada** THEN o pedido SHALL passar a **Entregue** (D6).
6. WHEN a entrega fica **Não atendida** ou é **Cancelada pela Juma/entregador** sem voltar à distribuição THEN o pedido SHALL ganhar um aviso visível "Entrega sem entregador · chamar de novo" e o botão SHALL voltar.
7. WHEN o cliente abre `/pedido/[code]` de um pedido com entrega ativa THEN SHALL ver a situação e o link "Acompanhar a entrega" (link de rastreio da Juma).
8. WHEN a lista de pedidos do painel é exibida THEN o pedido com entrega ativa SHALL ter um selo com a situação.

### P1: Cancelar ⭐ MVP

1. WHEN cancelo um pedido com entrega ativa THEN o diálogo SHALL avisar "A entrega na Juma também será cancelada" e o sistema SHALL cancelar na Juma antes de cancelar o pedido (D7).
2. WHEN a Juma recusa o cancelamento THEN o pedido SHALL continuar como está e o painel SHALL mostrar o motivo.
3. WHEN quero só cancelar a entrega (o cliente vai retirar, por exemplo) THEN o detalhe SHALL ter "Cancelar entrega" separado do cancelamento do pedido.

### P2: Código de confirmação

1. WHEN a loja tem o código ligado (D8) THEN a chamada SHALL enviar 4 dígitos e a página do pedido SHALL mostrar "Código para o entregador: 1234" enquanto a entrega estiver ativa.
2. WHEN a entrega é finalizada THEN o código SHALL sumir da página.

### P2: Chamada automática

1. WHEN a loja tem a chamada automática ligada (D9) e um pedido pago com entrega passa a Pronto THEN o sistema SHALL chamar o entregador sozinho, com "Sistema" na linha do tempo.
2. WHEN a chamada automática falha THEN o pedido SHALL ficar com o aviso de P1 e o botão manual.

### P2: Mensagem ao cliente

1. WHEN o entregador aceita THEN o painel SHALL oferecer "Avisar o cliente no WhatsApp" com o link de rastreio (modelo editável em Configurações, como a confirmação da etapa 08).

---

## Edge Cases

- WHEN o pedido teve a taxa "a combinar" (etapa 11, D4) THEN o botão SHALL aparecer igual: a chamada não depende da taxa calculada.
- WHEN o endereço do pedido é o texto livre de antes da etapa 11 (sem campos) THEN o botão SHALL não aparecer, com a explicação "Endereço sem campos: chame pela Juma".
- WHEN a Juma demora mais de 15 segundos para responder à chamada THEN o sistema SHALL consultar se a entrega foi criada (pelo `id_externo`) antes de deixar chamar de novo, para não abrir duas.
- WHEN a Juma cancela e informa `will_reopen = true` (volta para a distribuição) THEN a entrega SHALL continuar ativa, como Distribuindo.
- WHEN um aviso chega para uma entrega que o sistema não conhece THEN SHALL ser aceito (200) e ignorado, com registro no log.
- WHEN o pedido é reativado (AD-010) depois de uma entrega cancelada THEN o histórico da entrega anterior SHALL continuar visível e o botão SHALL voltar quando o pedido estiver Pronto.
- Toda chamada, aviso e cancelamento SHALL ficar registrado (quem, quando, resposta da Juma) para conferir a fatura da Juma.

---

## Open Questions

**Para a Juma (Bruna):**
1. Qual `forma_pagamento` usar: **Faturado (`F`)** ou **Carteira de créditos (`R`)**? (D4)
2. Um cadastro para as três lojas, mudando o endereço de partida em cada chamada, serve para a fatura? Ou cada loja precisa de empresa própria? (D11)
3. Existe empresa/usuário de **teste** que não gere corrida real? Hoje só há produção: cada teste vira uma corrida que precisa ser cancelada na hora.
4. O código de confirmação da entrega (D8) já está ligado na central da Juma? Se estiver, ele passa a ser obrigatório nas chamadas.
5. O cancelamento logo após a chamada (antes do aceite) tem custo?

**Para o Leonardo:**
6. D1: botão manual no MVP e automática como opção (P2), ou automática já no MVP?
7. D8: código de confirmação ligado por padrão nas três lojas?
8. Enquanto o checkout com pagamento não existir, liberar o botão para pedidos **confirmados** (pagamento combinado no WhatsApp)?

---

## Success Criteria

- [ ] Um pedido de teste com entrega abre a entrega na Juma com o endereço, o cliente e o `C67-…` certos, e a situação chega ao painel e à página do pedido.
- [ ] Clique duplo ou dois atendentes não abrem duas entregas.
- [ ] Aviso sem assinatura válida não muda nada; aviso repetido tem efeito uma vez.
- [ ] Entrega finalizada deixa o pedido Entregue; não atendida deixa o pedido com aviso e botão de novo.
- [ ] Cancelar o pedido cancela a entrega; se a Juma recusar, o pedido não é cancelado.
- [ ] Nenhuma credencial da Juma no navegador; a rota do aviso só aceita chamadas assinadas.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
