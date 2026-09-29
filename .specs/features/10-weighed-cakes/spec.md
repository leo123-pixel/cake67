# 10 · Bolo inteiro por peso na vitrine — Specification

**Status**: Approved (2026-09-29, "aprovado, pode seguir")

## Problem Statement

Bolo inteiro pronto na vitrine é vendido por kg, mas cada bolo sai da forma com um peso quebrado (1,34 kg, 1,62 kg...). Hoje o sistema só tem dois jeitos de vender bolo:

- `bolo_kg` é **encomenda**: pesos fixos (1, 1,5, 2 kg...), formato, adicionais, frase, antecedência.
- `vitrine` tem preço por unidade e estoque em contador (`stock.quantity`): dois bolos do mesmo sabor viram "2 unidades" iguais, com o mesmo preço.

Nenhum dos dois representa "dois Ninho com Morango na vitrine, um de 1,34 kg e outro de 1,62 kg, cada um com seu preço".

## Goals

- [ ] O cliente vê o bolo com a foto e escolhe entre os pesos que existem de verdade na loja, cada um com o preço exato.
- [ ] A atendente coloca cada bolo na vitrine digitando o peso da balança, pelo celular, em segundos.
- [ ] Um bolo nunca é vendido para duas pessoas, e toda mudança fica registrada em `stock_movements`.

## Out of Scope

- Fatia ou pedaço cortado na hora: fatia é outro produto, de vitrine comum, com preço por fatia (já funciona).
- Foto de cada bolo físico: a foto é a do produto.
- Integração com balança: o peso é digitado.
- Tirar da vitrine automaticamente no fim do dia: a sobra continua (D6).
- Bolo inteiro da vitrine na home (vitrine de bolos da etapa 07), no assistente e no configurador de encomenda.
- Relatório de perdas/descarte.

## Decisões

- **D1 · Tipo novo `vitrine_kg`** ("Bolo inteiro (vitrine)" no painel), em categoria de vitrine própria criada pela equipe no painel (ex.: "Bolos inteiros"). Independente do `bolo_kg` de encomenda: um sabor pode existir nos dois, cada um com seu cadastro e seu preço. Produto `vitrine_kg` só é vendido inteiro.
- **D2 · Preço por kg no produto.** `price_cents` do `vitrine_kg` é o preço do kg (como no `bolo_kg`). Preço da peça = `round(price_cents × weight_g / 1000)`, calculado no banco na cotação e no pedido. Se o preço por kg mudar, as peças que estão na vitrine passam a valer o preço novo (pedidos já feitos não mudam).
- **D3 · Cada bolo físico é uma peça** com peso em gramas (inteiro), digitado em kg com até 3 casas ("1,340"). Faixa aceita: 0,300 kg a 10,000 kg.
- **D4 · Situação da peça:** `disponivel` → `reservado` (pedido feito) → `vendido` (pedido entregue/retirado ou venda no balcão). `descartado` quando a equipe tira da vitrine sem vender. Cancelamento e expiração devolvem a peça para `disponivel`; reativação reserva de novo se ela ainda estiver disponível (senão, recusa como hoje, "sem estoque").
- **D5 · Carrinho por peça.** Cada peça é um item com quantidade 1. O cliente pode levar várias peças do mesmo sabor; cada uma é uma linha no carrinho e no pedido, com o seu peso.
- **D6 · Sobra continua.** Peça não vendida fica na vitrine nos dias seguintes. O painel mostra há quantos dias cada peça está lá ("hoje", "1 dia", "3 dias").
- **D7 · Correção de peso** só com a peça `disponivel` (digitou errado). Peça reservada ou vendida não muda.
- **D8 · Registro.** Toda entrada, reserva, devolução, venda, venda no balcão, descarte e correção gera linha em `stock_movements` ligada à peça, com quem fez.

---

## User Stories

### P1: Cadastro do produto ⭐ MVP

1. WHEN crio um produto no painel THEN o tipo SHALL oferecer "Bolo inteiro (vitrine)", só em categoria de vitrine.
2. WHEN o tipo é `vitrine_kg` THEN o campo de preço SHALL se chamar "Preço por kg" e os campos de encomenda (pesos, formatos, adicionais, antecedência) SHALL sumir.
3. WHEN o preço está pendente THEN o produto SHALL seguir a regra de hoje (não aparece no site, marcado no painel).

### P1: Pôr bolo na vitrine (painel) ⭐ MVP

1. WHEN abro `/admin/estoque` THEN os produtos `vitrine_kg` SHALL aparecer na grade da loja com a lista de peças disponíveis ("1,340 kg · R$ 147,40 · há 1 dia") em vez de um número.
2. WHEN toco "Adicionar bolo" em um produto e digito o peso THEN SHALL criar uma peça `disponivel` naquela loja e mostrar o preço calculado.
3. WHEN o peso está fora de D3 ou mal digitado THEN SHALL recusar com mensagem em PT-BR, sem criar nada.
4. WHEN toco numa peça disponível THEN SHALL poder: **Vendida no balcão**, **Descartar** (com confirmação) ou **Corrigir peso**.
5. WHEN a peça está reservada THEN SHALL aparecer com o código do pedido e sem ações (muda pelo pedido).
6. WHEN sou atendente THEN SHALL mexer só nas peças da minha loja; o admin, em todas.
7. WHEN "Lançar contagem" (lançamento em lote da etapa 03) THEN os `vitrine_kg` SHALL ficar de fora; as peças entram uma a uma.

### P1: Escolher o peso no site ⭐ MVP

1. WHEN abro o cardápio numa loja THEN o bolo `vitrine_kg` SHALL aparecer como um card só (foto, nome, "R$ X o kg") com os pesos disponíveis como opções: "1,34 kg · R$ 147,40".
2. WHEN há uma peça só THEN ela SHALL vir já escolhida.
3. WHEN não há peça disponível THEN o card SHALL mostrar "Esgotado", como os outros itens da vitrine.
4. WHEN escolho um peso e adiciono THEN o carrinho SHALL mostrar "Bolo Ninho com Morango · 1,34 kg" com o preço da peça, sem campo de quantidade.
5. WHEN a mesma peça já está no carrinho THEN ela SHALL não ser oferecida de novo no card.
6. WHEN a página do produto (`/produto/[slug]`) é de `vitrine_kg` THEN SHALL ter a mesma escolha de peso.

### P1: Pedido e reserva ⭐ MVP

1. WHEN envio o pedido THEN o site SHALL mandar só o id da peça; o banco SHALL conferir que ela está `disponivel`, na loja do pedido, e calcular o preço (D2).
2. WHEN a peça foi reservada por outra pessoa antes THEN o pedido SHALL ser recusado inteiro, e o carrinho SHALL mostrar "Esse bolo acabou de ser reservado, escolha outro peso" naquele item.
3. WHEN o pedido é criado THEN a peça SHALL ficar `reservado`, ligada ao pedido, e sair do site na hora.
4. WHEN o pedido expira ou é cancelado THEN a peça SHALL voltar a `disponivel`.
5. WHEN o pedido é marcado entregue/retirado THEN a peça SHALL ficar `vendido`.
6. WHEN o pedido expirado é reativado THEN SHALL seguir D4.
7. WHEN o painel, a mensagem do WhatsApp, a página `/pedido/[code]` e o CSV mostram o item THEN SHALL aparecer o peso ("Bolo Ninho com Morango 1,34 kg").
8. WHEN o pedido tem só itens de vitrine (inclusive `vitrine_kg`) THEN ele SHALL continuar sendo de pronta entrega (WhatsApp de Pronta entrega, linha do tempo sem "Em produção").

### P2: Histórico da peça

1. WHEN abro o histórico de movimentações do estoque THEN as linhas de peça SHALL mostrar o peso e o que aconteceu (Entrada, Reserva, Devolução, Venda, Venda no balcão, Descarte, Correção de peso).

---

## Edge Cases

- WHEN o produto é desativado ou muda de tipo THEN as peças SHALL continuar no banco mas sair do site e da grade (como a etapa 03 faz com o contador).
- WHEN o produto deixa de ser vendido numa loja (`store_ids`) THEN as peças daquela loja SHALL sair do site.
- WHEN dois atendentes mexem na mesma peça ao mesmo tempo THEN só a primeira ação SHALL valer; a segunda recebe "Esse bolo mudou, atualize a lista".
- WHEN o carrinho guardado tem uma peça que já não está disponível THEN a cotação SHALL marcar o item como indisponível, como faz hoje com esgotado.

---

## Success Criteria

- [ ] Com dois Ninho (1,340 kg e 1,620 kg) na Loja 1, o site mostra um card com os dois pesos e os preços certos.
- [ ] Dois pedidos disputando a mesma peça: só um passa; o outro vê a mensagem e escolhe outro peso.
- [ ] Expirar, cancelar, reativar, entregar, vender no balcão e descartar deixam a peça no estado de D4 e geram linha em `stock_movements`.
- [ ] Anon não consegue ler peça reservada/vendida nem criar ou alterar peça.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
