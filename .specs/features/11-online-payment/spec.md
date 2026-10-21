# 11 · Pagamento online (Stripe, uma conta por loja) — Specification

**Status**: Draft (2026-10-21) — aguardando aprovação do Leonardo

## Problem Statement

Hoje o pedido do site termina em "Finalizar no WhatsApp" e o pagamento é combinado na conversa (SPEC §1). A equipe cobra Pix ou cartão à mão, confere comprovante e o pedido fica `novo` até alguém confirmar. Cliente que quer resolver tudo pelo site não consegue.

Cada loja é uma empresa com CNPJ próprio, então o dinheiro de um pedido precisa cair na conta da loja do pedido. O sistema já garante que todo pedido é de uma loja só (SPEC §5).

Esta etapa muda a decisão "Pagamento combinado no WhatsApp" do SPEC §1 e o "Sem gateway de pagamento no MVP" do SPEC §2 (AD-019, decisão do Leonardo em 2026-10-21).

## Goals

- [ ] O cliente paga o pedido pelo site com Pix ou cartão, na loja escolhida, e o dinheiro cai na conta Stripe do CNPJ daquela loja.
- [ ] Pagar continua opcional: quem prefere combinar no WhatsApp segue o fluxo de hoje.
- [ ] Loja sem conta configurada continua só com o WhatsApp, sem nenhuma mudança para o cliente.
- [ ] A equipe vê no painel quais pedidos estão pagos, e cancelar um pedido pago devolve o dinheiro.
- [ ] O valor cobrado é sempre o `subtotal_cents` gravado pelo `create_order`, nunca um valor vindo do navegador.

## Out of Scope

- Sinal ou pagamento parcial: o site cobra o subtotal inteiro (D3).
- Taxa de entrega online: continua combinada no WhatsApp.
- Diferença de peso do bolo por kg: continua paga na retirada (SPEC §7).
- Parcelamento, boleto e moedas que não sejam real.
- Reembolso parcial pelo painel (item que faltou etc.): feito no painel da Stripe.
- Link de pagamento enviado pela equipe para pedido feito pelo WhatsApp.
- Maquininha/pagamento no balcão (Stripe Terminal).
- Stripe Connect (conta principal com contas ligadas): não compensa para duas lojas; dá para migrar depois sem mudar o resto (D6).
- Emissão de nota fiscal: continua pela contabilidade, a partir do CSV.
- Mudar a confirmação do pedido: continua manual (D2).

## Decisões

- **D1 · Pagamento opcional.** Na loja com pagamento ativo, o checkout pergunta "Como prefere pagar?": **Pagar agora pelo site (Pix ou cartão)** (padrão) ou **Combinar no WhatsApp**. A escolha não fica presa: enquanto o pedido estiver `novo` e sem pagamento, a página do pedido oferece "Pagar agora" de novo, para quem desistiu no meio ou mudou de ideia.
- **D2 · Pedido pago não se confirma sozinho.** Pagar não muda o status do pedido (continua `novo`), mas ele **deixa de expirar**: a reserva de estoque fica segura até a equipe confirmar ou cancelar. Encomenda continua dependendo de a produção aceitar.
- **D3 · Cobra o subtotal inteiro.** O valor é o `subtotal_cents` do pedido, em uma linha só na Stripe ("Pedido C67-000123"). Entrega e diferença de peso ficam como hoje.
- **D4 · Pix e cartão de crédito à vista.** Lista fixa de formas de pagamento na sessão (`card`, `pix`), sem boleto. Carteiras digitais (Apple Pay/Google Pay) entram junto com o cartão quando a Stripe oferecer. Página da Stripe em português, moeda BRL.
- **D5 · Uma conta Stripe por loja.** Cada loja tem um apelido de conta (`stores.payment_account`, ex. `loja1`). As chaves ficam só em variáveis de ambiente do servidor, uma dupla por apelido: `STRIPE_<APELIDO>_SECRET_KEY` e `STRIPE_<APELIDO>_WEBHOOK_SECRET` (regra 4). A loja só tem pagamento ativo se o apelido estiver preenchido **e** as duas chaves existirem; senão fica só com WhatsApp. Chave nunca vai para o banco nem aparece no painel.
- **D6 · Tudo que fala com a Stripe passa por `lib/payments`.** Checkout, webhook e reembolso usam o mesmo módulo, que escolhe a conta pelo apelido. Nenhum outro arquivo sabe quantas contas existem.
- **D7 · O pagamento fica preso à conta em que foi feito.** Cada tentativa de pagamento guarda o apelido da conta. Webhook e reembolso usam esse apelido, mesmo que a loja mude de conta depois.
- **D8 · Um webhook por conta.** URL `/api/stripe/webhook/<apelido>`, cadastrada no painel da Stripe de cada loja com a sua chave de assinatura. O banco só aceita o evento se o pedido for de uma loja daquela conta e o valor e a moeda baterem com o pedido.
- **D9 · Reserva e pagamento andam juntos.** Ao abrir o pagamento, a reserva do pedido é estendida para durar pelo menos até o fim da sessão da Stripe (a Stripe exige no mínimo 30 min) e o Pix expira antes dela. No máximo 5 tentativas de pagamento por pedido, para ninguém segurar estoque indefinidamente.
- **D10 · Pagamento que não tem mais pedido é devolvido sozinho.** Se o pagamento chegar e o pedido estiver cancelado, ou expirado sem estoque para reservar de novo, ou já pago por outra tentativa, o sistema devolve o valor automaticamente e registra o motivo.
- **D11 · Cancelar pedido pago devolve tudo.** O cancelamento (atendente ou admin, como hoje) avisa "O pagamento de R$ X será devolvido ao cliente" e dispara o reembolso total pela Stripe. Se a Stripe falhar, o pedido fica cancelado com "Reembolso pendente" e um botão para tentar de novo.

---

## User Stories

### P1: Conta de pagamento por loja ⭐ MVP

1. WHEN abro uma loja em **Lojas** (admin) THEN SHALL ver o campo "Conta de pagamento online" (apelido, minúsculas e números, opcional) e a situação: **Ativo**, **Conta sem chaves no servidor** ou **Desligado**.
2. WHEN o apelido está vazio THEN a loja SHALL ficar só com WhatsApp (Desligado).
3. WHEN o apelido está preenchido mas faltam as variáveis de ambiente THEN a loja SHALL ficar só com WhatsApp e o painel SHALL mostrar "Conta sem chaves no servidor".
4. WHEN sou atendente THEN SHALL não ver nem mudar esse campo.

### P1: Pagar no checkout ⭐ MVP

1. WHEN a loja do carrinho tem pagamento ativo THEN o checkout SHALL mostrar "Como prefere pagar?" com as duas opções de D1, e o texto "Pagamento combinado no WhatsApp" SHALL mudar conforme a escolha.
2. WHEN a loja não tem pagamento ativo THEN o checkout SHALL ficar exatamente como hoje.
3. WHEN escolho pagar agora e envio THEN o pedido SHALL ser criado pelo `create_order` como hoje e, em seguida, eu SHALL ser levado à página de pagamento da Stripe da conta daquela loja, com o valor do pedido.
4. WHEN pago THEN SHALL voltar para `/pedido/[code]` vendo "Pagamento recebido" (ou "Confirmando pagamento…" enquanto o aviso da Stripe não chegou).
5. WHEN desisto na página da Stripe THEN SHALL voltar para `/pedido/[code]` com o pedido `novo`, e a página SHALL oferecer "Pagar agora" e "Finalizar no WhatsApp".
6. WHEN o pedido foi criado mas abrir a Stripe falhou THEN SHALL cair em `/pedido/[code]` com "Não conseguimos abrir o pagamento agora" e as mesmas duas opções; o pedido não se perde.

### P1: Página do pedido ⭐ MVP

1. WHEN o pedido está `novo`, sem pagamento, e a loja tem pagamento ativo THEN SHALL ver **Pagar agora** (principal) e **Finalizar no WhatsApp** (secundário).
2. WHEN o pedido está pago THEN SHALL ver o selo "Pago pelo site · Pix" (ou "· Cartão") no resumo, e o WhatsApp SHALL virar **Avisar a loja no WhatsApp**, com a mensagem do pedido acrescida de "Pago pelo site".
3. WHEN o pedido pago é cancelado THEN SHALL ver "Pagamento devolvido" (ou "Devolução em andamento").
4. WHEN o pedido é de entrega THEN SHALL continuar vendo "Taxa de entrega combinada no WhatsApp".
5. WHEN o pedido tem bolo por kg THEN SHALL continuar vendo que a diferença da pesagem é paga na retirada.
6. A linha do tempo (etapa 09) SHALL não ganhar etapa de pagamento.

### P1: Aviso da Stripe (webhook) ⭐ MVP

1. WHEN a Stripe avisa que a sessão foi paga THEN o pedido SHALL ficar pago, deixar de expirar (D2) e aparecer como pago no painel em tempo real.
2. WHEN o aviso chega com assinatura inválida ou para um apelido desconhecido THEN SHALL ser recusado sem tocar no banco.
3. WHEN o mesmo aviso chega duas vezes THEN o segundo SHALL não mudar nada.
4. WHEN valor ou moeda não batem com o pedido THEN o pagamento SHALL ficar marcado "Conferir" no painel, sem marcar o pedido como pago.
5. WHEN o caso é um dos de D10 THEN SHALL devolver o valor sozinho e registrar no histórico do pedido.
6. WHEN o pedido pago estava expirado e ainda há estoque THEN a reserva SHALL ser refeita (tudo ou nada, como a reativação) e o pedido SHALL voltar a `novo` pago.
7. WHEN a sessão expira sem pagamento THEN a tentativa SHALL ficar expirada; o pedido segue o tempo de reserva normal.

### P1: Painel ⭐ MVP

1. WHEN vejo a lista de pedidos THEN o pedido pago SHALL ter o selo "Pago"; o que está com pagamento aberto, "Pagando".
2. WHEN abro o detalhe THEN SHALL ver o bloco Pagamento: forma (Pix/Cartão), valor, data e hora, situação (Pago, Devolvido, Reembolso pendente, Conferir) e o identificador da Stripe.
3. WHEN cancelo um pedido pago THEN o diálogo SHALL avisar da devolução (D11) antes de confirmar.
4. WHEN o reembolso falhou THEN SHALL ver "Reembolso pendente" e **Tentar devolver de novo**.
5. WHEN sou atendente THEN SHALL ver pagamento só dos pedidos da minha loja.

### P2: Relatório e CSV

1. WHEN abro o relatório THEN SHALL ver, além do faturamento de hoje (AD-011), quanto foi pago pelo site no período, por loja.
2. WHEN exporto o CSV THEN SHALL ter a coluna "Pagamento" (Pix / Cartão / vazio) e "Devolvido".

### P2: Mensagens

1. WHEN o painel abre o WhatsApp de confirmação (AD-015) para um pedido pago THEN o modelo SHALL aceitar a variável `{pagamento}` ("Pago pelo site" ou vazio).

---

## Edge Cases

- WHEN o cliente abre duas abas e paga nas duas THEN a segunda SHALL ser devolvida sozinha (D10). Ao abrir uma nova tentativa, a anterior ainda aberta SHALL ser encerrada na Stripe.
- WHEN o atendente cancela enquanto o cliente está na página da Stripe THEN a sessão aberta SHALL ser encerrada; se o pagamento passar mesmo assim, D10.
- WHEN o atendente confirma o pedido antes de o pagamento chegar THEN o pagamento SHALL ser aceito normalmente (pedido confirmado e pago).
- WHEN a loja perde o pagamento ativo (apelido apagado ou chave removida) com pedidos pagos THEN reembolso e webhook desses pedidos SHALL continuar usando o apelido gravado (D7); se a chave sumiu, o reembolso fica pendente com aviso.
- WHEN o pedido chega a `entregue` THEN o pagamento SHALL não mudar; devolução depois disso é pelo painel da Stripe.
- WHEN a reserva já está perto de expirar ao abrir o pagamento THEN D9 estende; com 5 tentativas usadas, "Pagar agora" some e fica só o WhatsApp.
- WHEN o limite de 2 pedidos `novo` por WhatsApp (AD-009) THEN pedido pago ainda `novo` SHALL continuar contando.

---

## Pré-requisitos (fora do código)

- Uma conta Stripe por CNPJ, com a conta bancária da própria loja; o mesmo login administra as duas. Pix ativado em cada uma (a página de preços da Stripe já indicou "somente por convite"; confirmar no painel da conta).
- Webhook cadastrado em cada conta (D8) com os eventos de sessão concluída, pagamento assíncrono aprovado/recusado, sessão expirada e reembolso.
- Antes de ligar em produção: política de privacidade citando a Stripe como processadora do pagamento.
- Hospedagem continua como está, na Vercel (Hobby) + Supabase Free, por decisão do Leonardo (2026-10-21). Risco aceito: os termos do Hobby são para uso não comercial e receber pagamento deixa o uso claramente comercial; se a Vercel restringir o projeto, a saída é passar o mesmo projeto para o plano pago da Vercel, sem mudar código.
- Desenvolvimento e preview usam as chaves de teste; sem variáveis, o recurso fica desligado, então o merge não muda nada no ar.

## Custos de referência (stripe.com/br/pricing, 2026-10-21)

Cartão nacional 3,99% + R$ 0,39 · Pix 1,19% · contestação R$ 55,00. Pedido de R$ 271,80: R$ 11,24 no cartão, R$ 3,23 no Pix. A tarifa não volta no reembolso.

---

## Success Criteria

- [ ] Pedido da Loja 1 pago no modo de teste aparece como pago no painel da conta de teste da Loja 1, e o da Loja 2 na conta da Loja 2.
- [ ] Loja sem apelido ou sem chaves: checkout e página do pedido idênticos aos de hoje.
- [ ] Pedido pago não expira; pedido pago e cancelado é devolvido; pagamento atrasado de pedido expirado sem estoque é devolvido sozinho.
- [ ] Webhook com assinatura errada, apelido trocado ou valor diferente não marca nada como pago.
- [ ] Nenhuma chave Stripe em `NEXT_PUBLIC_*`, no banco ou no bundle do navegador.
- [ ] Anon não lê pagamentos; atendente só vê os da própria loja.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
