# 08 · WhatsApp por setor e aviso de confirmação — Specification

**Status**: Approved (2026-09-28, "aprovado, pode seguir")

## Problem Statement

Hoje cada loja tem um único WhatsApp (`stores.whatsapp`), usado para tudo: pedido do site, contato da home, assistente e Cakelovers. Na operação real, cada loja tem três números, um por setor: **Pronta entrega** (vitrine), **Encomenda** e **SAC**. Pedido que cai no setor errado precisa ser repassado à mão.

Além disso, quando o atendente clica em **Confirmar** no painel, o cliente não fica sabendo: o status muda só no banco, e a página `/pedido/[code]` continua dizendo "Pedido recebido".

Números informados pelo Leonardo (2026-09-28):

| Loja | Pronta entrega | Encomenda | SAC |
|---|---|---|---|
| Loja 1 · Rua Estiva | (67) 99827-2300 | (67) 98151-9796 | (67) 99328-5925 |
| Loja 2 · Afonso Pena | (67) 99987-3946 | (67) 99625-8783 | (67) 99619-7916 |

O número de Encomenda da Loja 2 resolve a pendência do SPEC §12 (o cardápio trazia "9625-8783", sem um dígito).

## Goals

- [ ] Pedido do site abre o WhatsApp do setor certo da loja escolhida.
- [ ] Contato público (home, assistente, Cakelovers, pedido cancelado/expirado) usa só o SAC.
- [ ] Ao confirmar um pedido, o atendente envia ao cliente, em um toque, uma mensagem pronta com o link de acompanhamento.
- [ ] O link do pedido mostra o status real para o cliente.

## Out of Scope

- Envio automático pela API oficial do WhatsApp (Meta Cloud API): exige conta verificada, modelo aprovado e custo por mensagem. O gatilho (confirmação) fica no mesmo lugar, então dá para trocar depois.
- E-mail, SMS e notificação do navegador.
- Separar pedido misto em dois pedidos.
- Restringir atendente por setor no painel (continua por loja).

## Decisões

- **D1 · Pedido misto vai para Encomenda.** Se o pedido tem qualquer item de encomenda (`has_made_to_order`), vai para o número de Encomenda; só vitrine vai para Pronta entrega. (Leonardo, 2026-09-28)
- **D2 · Só o SAC aparece como contato público.** Os números dos setores só recebem pedidos feitos pelo site. (Leonardo, 2026-09-28)
- **D3 · "Pedir pelo WhatsApp" de bolo com preço a definir (AD-012) vai para Encomenda** da loja escolhida no configurador, porque é um pedido, não um contato geral. (Leonardo, 2026-09-28)

---

## User Stories

### P1: Três números por loja ⭐ MVP

1. WHEN abro **Lojas** no painel THEN SHALL ver e editar três campos: "WhatsApp · Pronta entrega", "WhatsApp · Encomenda" e "WhatsApp · SAC", todos obrigatórios e validados como hoje (DDD + número, gravado com 55).
2. WHEN a migration roda THEN as duas lojas SHALL ficar com os seis números da tabela acima e o WhatsApp da Loja 2 deixa de ser provisório.
3. WHEN vejo a lista de lojas no painel THEN SHALL ver os três números de cada loja.

### P1: Pedido vai para o setor certo ⭐ MVP

1. WHEN meu pedido tem só itens da vitrine THEN "Finalizar no WhatsApp" SHALL abrir o número de Pronta entrega da loja.
2. WHEN meu pedido tem algum item de encomenda (bolo por kg, cento, kit) THEN SHALL abrir o número de Encomenda da loja (D1).
3. WHEN peço pelo WhatsApp um bolo com preço a definir THEN SHALL abrir o número de Encomenda da loja escolhida (D3).

### P1: Contato público pelo SAC ⭐ MVP

1. WHEN vejo a seção Lojas da home THEN cada loja SHALL mostrar só o SAC, com o botão do WhatsApp apontando para ele (D2).
2. WHEN uso o assistente ou "Quero participar" do Cakelovers THEN SHALL abrir o SAC.
3. WHEN meu pedido foi cancelado ou expirou THEN a página do pedido SHALL oferecer "Falar com a loja" no SAC dela.

### P1: Aviso de confirmação ao cliente ⭐ MVP

1. WHEN clico em **Confirmar** e o status muda THEN o painel SHALL abrir o WhatsApp do cliente com uma mensagem pronta; o atendente só envia.
2. WHEN a mensagem é montada THEN SHALL ter o nome do cliente, o número do pedido, loja e retirada/entrega com data e hora (se houver) e o link de acompanhamento (`/pedido/[code]?t=…`). Sem valores.
3. WHEN o navegador bloqueia a janela nova THEN o painel SHALL mostrar o botão "Avisar cliente no WhatsApp" no detalhe do pedido, que pode ser usado de novo a qualquer momento enquanto o pedido estiver confirmado ou depois.
4. WHEN a confirmação falha (pedido mudou, sessão expirou) THEN o WhatsApp NÃO SHALL abrir.
5. WHEN quero mudar o texto THEN SHALL editar o modelo em **Configurações**, com prévia, como o modelo do pedido; exige `{codigo}` e `{link}` e recusa variável desconhecida.

### P1: Status real na página do pedido ⭐ MVP

1. WHEN abro meu link de pedido THEN o título SHALL refletir o status: Pedido recebido (novo), Pedido confirmado, Em produção, Pronto para retirar / Saiu para entrega (conforme retirada/entrega), Entregue, Cancelado, Reserva expirada.
2. WHEN o pedido já foi confirmado THEN o botão "Finalizar no WhatsApp" SHALL sumir e o texto SHALL dizer que a loja confirmou.
3. WHEN o pedido está `novo` THEN a página SHALL continuar como hoje.

---

## Edge Cases

- Link do WhatsApp do cliente com número inválido no pedido: não acontece, o número é validado no checkout.
- "Reativar e confirmar" um pedido expirado: também abre o aviso.
- O aviso sai do WhatsApp que estiver aberto no aparelho do atendente; o sistema não controla qual número.

## Success Criteria

- [ ] Pedido só de vitrine da Loja 2 abre (67) 99987-3946; pedido com bolo abre (67) 99625-8783.
- [ ] Nenhuma página pública mostra número de setor fora do fluxo de pedido.
- [ ] Confirmar no painel abre o WhatsApp do cliente com a mensagem e o link, e o link mostra "Pedido confirmado".
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
