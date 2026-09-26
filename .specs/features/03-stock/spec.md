# 03 · Estoque — Specification

## Problem Statement

Hoje todo produto novo aparece como "Esgotado" e o estoque só muda por SQL. A equipe do balcão precisa dizer ao site, pelo celular e em segundos, quanto tem de cada item da vitrine em cada loja, e a dona precisa saber quem mexeu e quando.

## Goals

- [ ] Ajustar a quantidade de um item em até 2 toques no celular.
- [ ] Zerar um item mostra "Esgotado" no site em até 1 minuto (aceite do SPEC); na prática, no próximo carregamento.
- [ ] Toda mudança de estoque fica no histórico com quem, quando, quanto e por quê.

## Out of Scope

- Reserva e baixa por pedido (`reserva`, `devolucao`, `venda`): etapa 04. Esta etapa só cria movimentos `ajuste`.
- Estoque de itens de encomenda (bolo por kg, cento, kit): não têm estoque (SPEC §1).
- Alerta de estoque baixo, previsão de produção, custo, fornecedores.
- Transferência entre lojas (vira dois ajustes manuais).
- Produto "sempre disponível" sem contagem: todo item de vitrine tem estoque, inclusive os feitos na hora (AD-008).
- Zerar a vitrine automaticamente no fim do dia.

---

## User Stories

### P1: Grade de estoque ⭐ MVP

**User Story**: Como atendente, quero ver de uma vez quanto tem de cada item da vitrine na minha loja.

**Acceptance Criteria**:

1. WHEN abro `/admin/estoque` como atendente THEN SHALL ver só a minha loja, com os produtos de vitrine agrupados por categoria na ordem do cardápio e a quantidade de cada um.
2. WHEN abro como admin THEN SHALL escolher a loja (padrão: primeira) e ver a mesma grade; em tela larga, SHALL poder ver todas as lojas lado a lado.
3. WHEN um produto não tem linha de estoque naquela loja (produto ou loja novos) THEN SHALL aparecer com 0 e poder ser ajustado.
4. WHEN o produto está inativo, com preço a definir ou não é vendido naquela loja (`store_ids`) THEN SHALL aparecer num grupo "Fora do site" recolhido, para não poluir a operação. O atendente não vê esses itens (RLS da etapa 02); o grupo aparece só para o admin.
5. WHEN a quantidade é 0 THEN a linha SHALL ter destaque visual de "Esgotado".
6. WHEN filtro por nome THEN a grade SHALL mostrar só os itens que batem.

**Independent Test**: logar como atendente da Loja 2 e ver só a coluna dela, com os 3 esgotados do seed destacados.

---

### P1: Ajuste rápido ⭐ MVP

**User Story**: Como atendente, quero somar, tirar ou definir a quantidade sem digitar muito.

**Acceptance Criteria**:

1. WHEN toco em **+** ou **−** THEN a quantidade SHALL mudar em 1 e ser salva, e a tela SHALL mostrar o novo valor.
2. WHEN toco em **Definir** e informo um número inteiro ≥ 0 THEN a quantidade SHALL passar a ser esse número.
3. WHEN toco em **Esgotar** THEN a quantidade SHALL ir a 0 com um toque, sem confirmação extra.
4. WHEN o ajuste deixaria a quantidade negativa THEN SHALL ser recusado com "O estoque não pode ficar negativo" e a tela SHALL mostrar o valor real.
5. WHEN duas pessoas ajustam o mesmo item ao mesmo tempo THEN os dois ajustes SHALL valer (somas não se perdem) e a tela SHALL mostrar o valor final do banco após cada ação.
6. WHEN "Definir" informa o mesmo valor atual THEN nada SHALL ser gravado (sem movimento vazio).
7. WHEN a rede falha THEN a tela SHALL avisar "Não foi possível salvar" e voltar ao último valor confirmado.
8. WHEN um atendente tenta ajustar outra loja (tela ou requisição direta) THEN SHALL ser recusado pelo banco.

**Independent Test**: tocar "Esgotar" na Fatia Karen da Loja 1 e ver "Esgotado" no `/cardapio?loja=estiva` ao recarregar.

---

### P1: Contagem da manhã ⭐ MVP

**User Story**: Como atendente, quero lançar a contagem de toda a vitrine de uma vez ao abrir a loja.

**Why P1**: É a rotina diária da equipe (AD-008); item a item seriam dezenas de toques.

**Acceptance Criteria**:

1. WHEN toco em **Contagem** THEN a grade SHALL virar uma lista de campos numéricos, um por item, já preenchidos com a quantidade atual.
2. WHEN salvo a contagem THEN todos os itens alterados SHALL ser gravados numa única transação, cada um com seu movimento `ajuste`; itens não alterados não geram movimento.
3. WHEN algum campo é inválido (vazio, negativo, fracionado, > 9999) THEN nada SHALL ser gravado e os campos com erro SHALL ficar destacados, mantendo o que foi digitado.
4. WHEN alguém ajustou um item depois que abri a contagem THEN o valor que eu salvei SHALL prevalecer (contagem física é a verdade), e o histórico SHALL mostrar os dois movimentos.
5. WHEN cancelo a contagem THEN nada SHALL ser gravado.
6. WHEN a contagem é salva THEN SHALL mostrar um resumo: "12 itens atualizados".

**Independent Test**: abrir a contagem da Loja 2, mudar 3 itens, salvar e ver 3 movimentos no histórico.

---

### P1: Histórico de movimentos ⭐ MVP

**User Story**: Como dona, quero saber quem mexeu no estoque, quando e quanto.

**Acceptance Criteria**:

1. WHEN abro o histórico THEN SHALL ver os movimentos mais recentes primeiro: data/hora (Campo Grande), produto, loja, variação (+3 / −1), quantidade resultante, motivo e quem fez.
2. WHEN filtro por produto, loja ou período THEN a lista SHALL respeitar os filtros.
3. WHEN há muitos movimentos THEN SHALL paginar ("Carregar mais", 50 por vez).
4. WHEN sou atendente THEN SHALL ver só o histórico da minha loja.
5. WHEN um ajuste é feito THEN o movimento SHALL ser gravado na mesma transação da mudança de quantidade (nunca um sem o outro).
6. WHEN abro um item da grade THEN SHALL ver os últimos movimentos daquele item naquela loja.

---

### P1: Acesso do atendente ⭐ MVP

**Acceptance Criteria**:

1. WHEN o atendente entra no painel THEN o menu SHALL mostrar "Estoque" além de "Início".
2. WHEN o admin entra THEN o menu SHALL mostrar "Estoque" junto das áreas de catálogo.

---

## Edge Cases

- WHEN o produto deixa de ser de vitrine (tipo alterado) THEN a linha de estoque SHALL continuar no banco mas sair da grade; se voltar a vitrine, a quantidade antiga reaparece.
- WHEN a loja é desativada THEN SHALL sumir do seletor do admin; o atendente dela continua vendo a grade (a loja pode estar fechada temporariamente).
- WHEN o valor digitado em "Definir" não é inteiro (ex. `2,5`, `-1`, vazio) THEN SHALL mostrar erro no campo e não gravar.
- WHEN a quantidade é muito alta (> 9999) THEN SHALL ser recusada como provável erro de digitação.
- WHEN a sessão expira no meio do ajuste THEN SHALL levar ao login sem perder a tela anterior de forma confusa.

---

## Success Criteria

- [ ] Aceite do SPEC: zerar um item mostra "Esgotado" no site sem deploy (≤ 1 min).
- [ ] 100% das mudanças de quantidade têm movimento correspondente (teste de integração compara soma dos movimentos com a quantidade). O estoque inicial do seed ganha um movimento de saldo inicial, para a soma fechar desde o começo.
- [ ] Ajuste concorrente: 20 incrementos paralelos resultam em +20 (teste de integração).
- [ ] Atendente da Loja 2 não altera nem lê estoque da Loja 1 (teste de integração).
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` e preview.
