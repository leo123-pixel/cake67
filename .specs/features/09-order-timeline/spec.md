# 09 · Linha do tempo na página do pedido — Specification

**Status**: Approved (2026-09-28, "aprovado, pode seguir")

## Problem Statement

A página `/pedido/[code]` (etapa 08) mostra o status atual em texto, mas o cliente não vê o caminho do pedido: o que já aconteceu, quando, e o que ainda falta. O Leonardo pediu uma linha do tempo nessa página.

O banco já registra cada mudança de status em `order_events` (com data e hora), mas `get_order_public` não devolve esse histórico.

## Goals

- [ ] O cliente vê as etapas do pedido, com a atual em destaque, as feitas com data e hora e as próximas esmaecidas.
- [ ] As etapas seguem o tipo de pedido (vitrine não tem "Em produção") e o tipo de entrega (retirada ou entrega).
- [ ] Nada de dado interno (nome do atendente, observação interna) sai para o público.

## Out of Scope

- Atualizar sozinha com a página aberta (Realtime ou recarga periódica): o cliente recarrega. Pode virar etapa própria.
- Linha do tempo no painel (o painel já tem o bloco "Histórico").
- Previsão de horário das próximas etapas.

## Decisões

- **D1 · Etapas por tipo de pedido.**
  - Com encomenda: Recebido → Confirmado → Em produção → Pronto → Entregue.
  - Só vitrine: Recebido → Confirmado → Pronto → Entregue.
  - Os rótulos seguem retirada/entrega: "Pronto para retirar" / "Pronto para entrega"; "Retirado" / "Entregue".
- **D2 · Etapa pulada conta como feita.** A vitrine pode ir de Confirmado direto a Entregue (regra do painel); nesse caso "Pronto" aparece como feita, sem horário.
- **D3 · Cancelado e expirado encerram a linha.** As etapas alcançadas ficam como feitas e, no lugar das próximas, aparece "Pedido cancelado" ou "Reserva expirada" com data e hora. Sem o motivo do cancelamento (é texto interno).
- **D4 · Pedido reativado mostra o último caminho.** Se o pedido expirou e foi reativado, a linha mostra Recebido → Confirmado (com o horário da reativação); a expiração não aparece, porque não é mais o estado do pedido.
- **D5 · Horário de cada etapa = a última vez que o pedido entrou nela**, em `America/Campo_Grande` ("28/09 às 18h01"). "Recebido" usa a hora do pedido.

---

## User Stories

### P1: Linha do tempo ⭐ MVP

1. WHEN abro o link do meu pedido THEN SHALL ver, abaixo do título e acima do resumo, a lista de etapas na ordem de D1.
2. WHEN uma etapa já aconteceu THEN SHALL aparecer como feita, com data e hora (D5), ou sem horário se foi pulada (D2).
3. WHEN é a etapa atual THEN SHALL ter destaque visual e ser anunciada para leitor de tela (`aria-current="step"`).
4. WHEN a etapa ainda não aconteceu THEN SHALL aparecer esmaecida, sem horário.
5. WHEN o pedido foi cancelado ou expirou THEN a linha SHALL terminar como em D3.
6. WHEN o pedido foi reativado THEN SHALL seguir D4.
7. WHEN abro no celular (360 px) THEN a linha SHALL ser vertical e caber sem rolagem lateral; no desktop pode ser a mesma lista vertical.

### P1: Histórico público sem dado interno ⭐ MVP

1. WHEN `get_order_public` responde THEN SHALL incluir só `{ status, at }` de cada evento; nunca `actor_name`, `actor_id` ou `note`.
2. WHEN o token está errado THEN SHALL continuar devolvendo nada.

---

## Success Criteria

- [ ] Pedido de vitrine confirmado e retirado mostra 4 etapas, "Pronto" feita sem horário se foi pulada.
- [ ] Pedido com encomenda mostra 5 etapas.
- [ ] Pedido cancelado mostra as etapas alcançadas e "Pedido cancelado" com horário, sem motivo.
- [ ] O C67-000076 (expirou e foi reativado) mostra Recebido → Confirmado, sem a expiração.
- [ ] `lint`, `typecheck`, `test`, `test:integration` e `build` passando.
