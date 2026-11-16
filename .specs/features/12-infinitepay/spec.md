# 12 · Pagamento online pela InfinitePay — Specification

**Status**: Approved (2026-11-16, Leonardo: "Pode remover o stripe, vamos usar somente a infinitepay")

## Problem Statement

Hoje o pedido do site termina em "Finalizar no WhatsApp" e o pagamento é combinado na conversa. A etapa da Stripe (AD-019) foi aplicada no banco mas não foi ao ar, e o Leonardo trocou de checkout. Esta etapa liga o **Checkout Integrado da InfinitePay** (Pix e cartão de crédito), muda a decisão "Pagamento combinado no WhatsApp" do SPEC §1 para os pedidos de vitrine e remove a Stripe (AD-021).

## Decisões

- **D1 · O que paga online.** Pedido **só de vitrine** (vitrine e bolo inteiro por peso), na **retirada** ou na **entrega com taxa calculada** pela Juma. Valor = `total_cents` do pedido (itens + entrega). (Leonardo: "Agora vitrine receber pagamento na retirada e entrega".)
- **D2 · O que continua no WhatsApp.** Qualquer **encomenda** (Leonardo: "Encomendas continua indo para whatsapp"). Entrega com **taxa a combinar**, porque a Juma não calculou (Leonardo: "Quando der erro no cálculo da entrega enviar para whatsapp"). Loja sem conta ou sem chave. O cliente que pode pagar online também tem "Prefiro combinar no WhatsApp".
- **D3 · Uma conta por loja.** Cada loja é um CNPJ (Leonardo). A InfiniteTag fica em `stores.payment_handle` (painel, admin). A chave fica só no servidor, em `INFINITEPAY_API_KEY_<TAG>`, ou no atalho `INFINITEPAY_HANDLE` + `INFINITEPAY_API_KEY`. Primeira loja: **Jeribá (`cake-zsf`)**.
- **D4 · Pagar não confirma o pedido.** O pedido pago continua `novo`, deixa de expirar e a equipe confirma, como hoje. O estoque já foi reservado no `create_order`; pagar não mexe no estoque de novo.
- **D5 · Link de 60 minutos, pago uma vez.** `single_payment: true`, `valid_until` = agora + 60 min, Pix e cartão. A reserva do pedido dura pelo menos até o link vencer + 5 min. Link vencido vira "expirado" e o cliente pode gerar outro (até 5 links por pedido). Enquanto o link vale, "Pagar agora" reabre o mesmo link.
- **D6 · Webhook sem assinatura.** Nada é marcado como pago só porque o webhook chegou. Sempre há `payment_check` antes, e o banco confere se o pedido existe e se o valor bate. `transaction_nsu` é `UNIQUE`: repetir não processa de novo. O webhook responde 200 quando tratou ou não há nada a fazer. Responde 400 quando vale tentar de novo: não pago ainda, `payment_check` fora do ar ou lento (timeout de 700 ms), chave ausente.
- **D7 · Parcelamento.** O Leonardo queria parcelar só na loja, mas a API **não limita** parcelas: o cartão mostra até 12x. Com `assured_installments: 0`, os juros ficam com o cliente e a loja recebe o valor cheio. O checkout avisa que o parcelamento tem juros.
- **D8 · Resposta do /links não documentada.** A URL é lida em `url`, `link`, `checkout_url`... A resposta completa vai para o log da Vercel e para `payment_events`.
- **D9 · Sem estorno pela API.** Dinheiro que não encaixa vai para **Pagamento a conferir**, com o motivo, e é devolvido pelo App ou pela Conta Web da InfinitePay: valor diferente, segundo pagamento, pedido cancelado, reserva expirada sem estoque. Pagamento atrasado de pedido expirado com estoque refaz a reserva. Cancelar um pedido pago avisa que o estorno é manual.

## User Stories

### P1: Pagar no checkout ⭐

1. WHEN o carrinho é só de vitrine, a loja tem conta ativa e é retirada (ou entrega com taxa calculada) THEN o botão SHALL ser **Pagar agora**, com **Prefiro combinar no WhatsApp** ao lado.
2. WHEN pago THEN o pedido SHALL ser criado como hoje e o cliente SHALL ir para a página da InfinitePay.
3. WHEN o link não abre THEN o cliente SHALL cair em `/pedido/[code]` com o aviso e **Pagar agora** de novo.
4. WHEN há encomenda, a taxa é a combinar ou a loja não tem conta THEN o checkout SHALL ficar como antes ("Fazer pedido" → WhatsApp).

### P1: Página do pedido ⭐

1. WHEN volto da InfinitePay THEN a confirmação SHALL ser feita pelo `payment_check` e a página SHALL mostrar **Pagamento recebido**, a forma, o valor e **Ver comprovante**. Enquanto não confirma, SHALL mostrar "Confirmando pagamento…" e se atualizar sozinha.
2. WHEN o link venceu e o pedido ainda vale THEN SHALL mostrar o aviso e **Pagar agora**.
3. WHEN o pedido está pago THEN o WhatsApp SHALL virar "Avisar a loja no WhatsApp", com "Pagamento feito pelo site" na mensagem.

### P1: Painel ⭐

1. Lista com o selo **Pago**, **Aguardando pagamento** ou **Pagamento a conferir**. Alerta sonoro quando um pagamento chega.
2. Detalhe com o bloco Pagamento online: situação, forma e parcelas, valor cobrado e pago, data, transação, comprovante, motivo do "conferir" e registro da InfinitePay.
3. A comanda impressa SHALL dizer "PAGO PELO SITE".
4. Em Lojas, o admin SHALL ver a InfiniteTag e a situação: Ativo, Sem chave no servidor (com o nome da variável) ou Desligado.

## Success Criteria

- [ ] Pedido da Jeribá de R$ 1,00 pago com Pix aparece como pago no painel e na página do pedido (README, "Testar com um link real").
- [ ] Webhook com `paid: false` ou valor diferente não marca pago; webhook repetido não muda nada.
- [ ] Nenhuma chave em `NEXT_PUBLIC_*`, no banco ou no bundle; anon não executa as funções de pagamento nem lê `payment_events`.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
