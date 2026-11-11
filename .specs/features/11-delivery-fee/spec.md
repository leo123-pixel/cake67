# 11 · Taxa de entrega calculada no site (Juma) — Specification

**Status**: Approved (Leonardo, 2026-11-11) · decisão AD-020

## Problem Statement

Hoje o cliente marca "Quero entrega", digita o endereço num campo livre e a taxa é combinada no WhatsApp (SPEC §1). O atendente precisa calcular o frete à parte, o cliente só sabe o total no meio da conversa e o pedido no sistema fica sem o valor da entrega.

A Cake 67 vai usar a **Juma Entregas** (Campo Grande), que roda na plataforma Machine e calcula o frete pela API (**Entregas v2**, `POST /entregas/estimativas`). O pedido passa a sair do site com a taxa calculada e o total certo.

Esta etapa **muda a decisão "Entrega" da seção 1 do SPEC** (pedido do Leonardo em 2026-10-08).

## Goals

- [ ] O cliente que escolhe entrega vê a taxa e o total antes de enviar o pedido.
- [ ] A taxa gravada no pedido é sempre a calculada no servidor pela Juma, nunca um valor vindo do navegador.
- [ ] Nenhuma venda se perde quando a Juma não calcula: o pedido sai com "taxa a combinar", como hoje.

## Out of Scope

- **Chamar o entregador** pelo painel, avisos de situação da Juma (webhook) e link de rastreio: **etapa 12**.
- Margem, arredondamento, frete grátis ou pedido mínimo para entrega.
- Categoria (moto/carro) escolhida pelo tamanho do pedido: é uma categoria fixa por loja.
- Entrega fora de Campo Grande/MS.
- Busca de endereço por CEP ou mapa para o cliente marcar o ponto.
- Cobrar a diferença se a Juma cobrar, na hora de chamar o entregador, um valor diferente do calculado: a Cake 67 absorve.

## Decisões

- **D1 · Valor exato da Juma.** A taxa é o `estimativa_valor` da Juma convertido para centavos, sem margem nem arredondamento.
- **D2 · Taxa fixada no pedido.** O valor calculado na hora do pedido fica gravado e não muda depois, mesmo que a tabela da Juma mude até o dia da entrega (encomenda).
- **D3 · Total = subtotal + taxa.** `subtotal_cents` continua sendo a soma dos itens; o pedido ganha a taxa de entrega e o total.
- **D4 · Sem cálculo, taxa a combinar.** Se a Juma não responder, recusar o endereço ou a loja não tiver a integração configurada, o cliente ainda pode pedir com entrega. O pedido sai com "taxa a combinar no WhatsApp" e fica marcado assim no painel.
- **D5 · Endereço em campos.** Rua, número, complemento (opcional), bairro e ponto de referência (opcional). Cidade fixa "Campo Grande - MS". Rua, número e bairro passam a ser obrigatórios quando é entrega.
- **D6 · Origem é a loja do pedido.** O endereço da loja precisa de rua, número e bairro separados; o admin preenche no painel (Lojas). Loja sem esses dados cai em D4.
- **D7 · Categoria por loja.** O admin escolhe no painel (Lojas) a categoria da Juma usada no cálculo, a partir da lista que a própria Juma devolve. Loja sem categoria cai em D4.
- **D8 · Faturamento não muda.** O relatório continua contando o subtotal como faturamento (AD-011); a taxa aparece em coluna própria, porque é repassada à Juma.
- **D9 · Credenciais só no servidor.** Chave e login da Juma ficam em variáveis de ambiente do servidor (nunca `NEXT_PUBLIC_*`), separadas para testes e produção.

---

## User Stories

### P1: Ver a taxa no checkout ⭐ MVP

**User Story**: Como cliente, quero ver quanto custa a entrega antes de enviar o pedido, para saber o total.

1. WHEN escolho "Quero entrega" THEN o checkout SHALL mostrar os campos de D5 no lugar do campo livre de hoje.
2. WHEN preencho rua, número e bairro THEN o site SHALL calcular a taxa no servidor e mostrar "Entrega: R$ 12,40" e o novo total, sem eu precisar recarregar.
3. WHEN mudo o endereço ou a loja THEN a taxa SHALL ser calculada de novo, e a anterior SHALL sumir até o novo cálculo chegar.
4. WHEN o cálculo falha (D4) THEN o checkout SHALL mostrar "Não conseguimos calcular a entrega para esse endereço agora. Você pode enviar o pedido e combinar a taxa no WhatsApp." e o total SHALL aparecer como "subtotal + entrega a combinar".
5. WHEN escolho retirada THEN nenhum cálculo SHALL ser feito e o total SHALL ser o subtotal, como hoje.

**Independent Test**: no checkout da Loja 1, escolher entrega, digitar um endereço de Campo Grande e ver a taxa e o total mudarem; trocar o bairro e ver a taxa recalculada.

### P1: Pedido com taxa gravada ⭐ MVP

**User Story**: Como Cake 67, quero que o pedido já saia com a taxa certa, para não depender de conta no WhatsApp.

1. WHEN envio o pedido com entrega THEN o servidor SHALL usar a taxa que ele mesmo calculou para aquele endereço e loja; nenhum valor de taxa enviado pelo navegador SHALL ser aceito.
2. WHEN o cálculo usado tem mais de 30 minutos ou o endereço/loja mudou THEN o servidor SHALL calcular de novo; se o valor mudou, o pedido SHALL ser recusado com "A taxa de entrega mudou para R$ X. Confira o total e envie de novo." e o checkout SHALL mostrar o valor novo.
3. WHEN o pedido é criado THEN SHALL gravar o endereço em campos, a taxa (ou "a combinar") e o total.
4. WHEN o pedido é só de retirada THEN taxa e total SHALL seguir D3 com taxa zero, sem endereço.
5. WHEN o pedido expirado é reativado THEN a taxa gravada SHALL ser mantida (D2).

**Independent Test**: criar pedido com entrega e conferir no banco endereço, taxa e total; tentar criar pedido chamando a função direto com uma taxa inventada e ver que ela é ignorada ou recusada.

### P1: Taxa e total em todo lugar que mostra o pedido ⭐ MVP

1. WHEN a mensagem do WhatsApp do pedido é montada THEN SHALL trazer "Entrega: R$ 12,40" (ou "Entrega: taxa a combinar"), o endereço em uma linha e "Total: R$ X" depois do subtotal.
2. WHEN abro `/pedido/[code]` THEN SHALL ver subtotal, entrega e total.
3. WHEN abro o pedido e a comanda no painel THEN SHALL ver o endereço em campos, a taxa e o total; pedido com taxa a combinar SHALL ter um aviso visível.
4. WHEN exporto o CSV ou abro o relatório THEN SHALL haver taxa de entrega e total por pedido, e o faturamento SHALL seguir D8.
5. WHEN a mensagem de confirmação (AD-015) é enviada THEN ela SHALL continuar sem valores.

### P1: Configurar a Juma por loja (painel) ⭐ MVP

1. WHEN o admin edita uma loja THEN SHALL poder preencher rua, número e bairro da loja e escolher a categoria da Juma numa lista vinda da API.
2. WHEN a Juma não responde ao carregar a lista THEN a tela SHALL avisar e manter a categoria já salva.
3. WHEN a loja não tem endereço completo ou categoria THEN o painel SHALL mostrar "Entrega com taxa a combinar (Juma não configurada)" na loja.
4. WHEN sou atendente THEN SHALL não ver nem mudar essa configuração.

### P2: Definir a taxa de um pedido "a combinar"

1. WHEN o pedido está com taxa a combinar THEN o atendente SHALL poder digitar a taxa combinada no painel, e o total SHALL ser atualizado.
2. WHEN a taxa é definida THEN SHALL ficar registrado quem definiu e quando (linha do tempo do pedido).
3. WHEN o pedido está cancelado, expirado ou entregue THEN a taxa SHALL não poder mais ser alterada.

---

## Edge Cases

- WHEN o endereço está fora da área da Juma ou ela devolve erro THEN SHALL seguir D4, sem mostrar a mensagem técnica da Juma ao cliente (ela vai para o log).
- WHEN a Juma demora mais de 8 segundos THEN o cálculo SHALL ser abandonado e seguir D4.
- WHEN a Juma devolve valor zero, negativo ou absurdo (acima de R$ 300,00) THEN SHALL ser tratado como falha (D4) e registrado no log.
- WHEN muitos cálculos chegam para o mesmo endereço e loja em pouco tempo THEN o servidor SHALL reaproveitar o último cálculo válido em vez de chamar a Juma de novo.
- WHEN o carrinho guardado volta com entrega escolhida THEN o endereço SHALL ser preenchido de novo, mas a taxa SHALL ser calculada outra vez.
- WHEN pedidos antigos (antes desta etapa) são exibidos THEN SHALL aparecer como hoje: endereço em texto livre e "taxa a combinar", sem quebrar painel, relatório nem CSV.

---

## Open Questions (Juma)

- ~~Login do Gestor da empresa Cake 67~~: criado em produção, com as permissões API · Entrega, Empresa e Webhook (2026-10-21). Chave de produção em mãos e chamadas testadas no Postman pelo Leonardo (2026-11-11). Não há ambiente de testes para esse usuário: a etapa só faz consultas (categorias e estimativa), que não chamam entregador nem geram custo.
- As duas lojas são uma empresa só na Juma ou duas? Por ora, **um login para as duas** (variáveis de ambiente únicas); se forem duas empresas, o design ganha um login por loja.
- A tarifa é de valor fixo no momento do pedido ou varia por km rodado? Há preço dinâmico? (só afeta o risco de diferença de D1/D2.)

---

## Success Criteria

- [ ] Pedido com entrega para um endereço de Campo Grande sai com taxa igual à estimativa da Juma e total = subtotal + taxa.
- [ ] Chamar `create_order` direto com uma taxa inventada não grava essa taxa.
- [ ] Com a Juma fora (credencial errada ou timeout), o pedido com entrega ainda é criado, marcado "taxa a combinar".
- [ ] Mensagem do WhatsApp, `/pedido/[code]`, painel, comanda, CSV e relatório mostram taxa e total; pedidos antigos continuam abrindo.
- [ ] Nenhuma credencial da Juma aparece no bundle do navegador.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
