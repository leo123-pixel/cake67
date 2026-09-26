# 06 · Relatório e acabamento — Specification

**Status**: Approved (2026-09-26)

## Problem Statement

A operação funciona, mas a dona ainda não enxerga quanto vendeu, em qual loja, nem o que sai mais. As regras que ela pode querer mudar (tempo de reserva, texto da mensagem do WhatsApp, política de privacidade) só mudam pelo banco. E o site ainda não está pronto para ser encontrado no Google nem revisado de ponta a ponta no celular. Esta é a última etapa do MVP (SPEC §11.6).

## Goals

- [ ] A dona vê pedidos, faturamento, ticket médio e mais vendidos por período e loja em uma tela, e exporta CSV.
- [ ] Tempo de reserva, modelo da mensagem e texto de privacidade editáveis no painel, sem deploy.
- [ ] SEO local: metadados por página, `sitemap.xml`, `robots.txt`, dados estruturados `Bakery` e `Product` (SPEC §10).
- [ ] Lighthouse mobile acima de 85 nas páginas públicas principais; site e painel sem quebra a partir de 360 px.

## Out of Scope

- Gráficos elaborados ou biblioteca de gráficos (barras simples em CSS bastam).
- Relatório para atendente (SPEC §8: só admin).
- Nota fiscal, conciliação de pagamento, custo e margem.
- Domínio e hospedagem de produção (M2). O SEO usa `NEXT_PUBLIC_SITE_URL`, que muda quando o domínio existir.
- Texto jurídico definitivo: o rascunho continua marcado como provisório até a cliente revisar.

---

## User Stories

### P1: Relatório ⭐ MVP

**User Story**: Como dona, quero ver quanto cada loja vendeu num período e o que saiu mais, para decidir produção e compras.

**Acceptance Criteria**:

1. WHEN abro `/admin/relatorio` THEN SHALL escolher o período (Hoje · 7 dias · Este mês · Mês passado · De/até) e a loja (Todas · Loja 1 · Loja 2). Padrão: este mês, todas.
2. WHEN escolho o período THEN SHALL considerar a **data em que o pedido foi feito**, em Campo Grande (AD-011, mesma regra do filtro "Hoje" da AD-010).
3. WHEN vejo o resumo THEN SHALL ter:
   - **Pedidos**: quantidade de pedidos que chegaram a ser confirmados (`confirmado`, `em_producao`, `pronto`, `entregue`);
   - **Faturamento**: soma do subtotal desses pedidos;
   - **Ticket médio**: faturamento ÷ pedidos (ou "—" quando zero);
   - **Cancelados** e **Expirados**: quantidade e valor, à parte, sem entrar no faturamento;
   - **Aguardando confirmação** (`novo`) do período, à parte.
4. WHEN o período tem mais de um dia THEN SHALL mostrar faturamento e pedidos por dia (tabela com barra simples).
5. WHEN "Todas" as lojas THEN SHALL mostrar a divisão por loja (pedidos, faturamento, ticket médio).
6. WHEN vejo **Mais vendidos** THEN SHALL listar os 10 produtos com mais unidades nos pedidos confirmados do período, com unidades e valor. Bolo por kg conta 1 unidade por bolo (e mostra os kg somados); cento conta as unidades pedidas.
7. WHEN sou atendente THEN `/admin/relatorio` SHALL não aparecer no menu e a rota SHALL responder "Sem permissão"; os dados SHALL ser recusados também por requisição direta.
8. WHEN não há pedidos no período THEN SHALL ver um estado vazio claro.

**Independent Test**: pedidos de teste em datas e lojas diferentes, com um cancelado e um expirado; os totais batem com a conta feita à mão.

---

### P1: Exportar CSV ⭐ MVP

**Acceptance Criteria**:

1. WHEN toco em **Exportar pedidos (CSV)** THEN SHALL baixar um arquivo com uma linha por pedido do período e loja escolhidos, **todos os status**, com: número, data e hora do pedido, loja, status, cliente, WhatsApp, CPF/CNPJ (AD-011), retirada/entrega, data e hora marcada, endereço, subtotal, motivo do cancelamento, quem confirmou.
2. WHEN toco em **Exportar itens (CSV)** THEN SHALL baixar uma linha por item: número do pedido, data, loja, status, produto, tipo, quantidade, opções (peso, formato, adicionais, sabor), valor unitário e total.
3. WHEN abro o CSV no Excel em português THEN acentos, datas (`dd/mm/aaaa hh:mm`) e valores (`1234,50`) SHALL aparecer certos (UTF-8 com BOM, separador `;`).
4. WHEN um campo começa com `=`, `+`, `-` ou `@` THEN SHALL ser neutralizado (injeção de fórmula).
5. WHEN sou atendente THEN a exportação SHALL ser recusada.

---

### P1: Configurações ⭐ MVP

**User Story**: Como dona, quero ajustar as regras e textos do site sem depender do desenvolvedor.

**Acceptance Criteria**:

1. WHEN abro `/admin/configuracoes` (só admin) THEN SHALL editar:
   - **Tempo de reserva** do pedido de vitrine, em minutos (15 a 1440). Vale para pedidos novos; os já criados mantêm o prazo.
   - **Modelo da mensagem do WhatsApp** (AD-011): texto livre com as variáveis `{codigo}`, `{loja}`, `{entrega}`, `{itens}`, `{subtotal}`, `{nome}`, `{whatsapp}`, `{observacoes}`, listadas com o que cada uma mostra.
   - **Texto de privacidade**, com a opção **"Texto revisado pela Cake 67"**.
2. WHEN edito o modelo THEN SHALL ver a **prévia** com um pedido de exemplo, atualizada enquanto digito.
3. WHEN salvo um modelo sem `{codigo}` ou sem `{itens}`, ou com variável desconhecida (ex. `{cliente}`) THEN SHALL ver o erro e nada é salvo.
4. WHEN salvo THEN o site SHALL usar os novos valores sem deploy (próximo pedido e próxima visita a `/privacidade`).
5. WHEN o texto de privacidade não está marcado como revisado THEN `/privacidade` e o painel SHALL continuar mostrando o selo "Texto provisório" (regra 6 do projeto).
6. WHEN o banco é criado do zero THEN SHALL ter um **rascunho de política** (AD-011) que descreve o que o sistema realmente faz: dados coletados (nome, WhatsApp, endereço opcional, observações, CPF/CNPJ opcional para nota), finalidade (atender o pedido e emitir nota), compartilhamento (WhatsApp da loja; contabilidade para a nota), guarda, direitos do titular e contato pelas lojas.

---

### P1: SEO local ⭐ MVP

**Acceptance Criteria**:

1. WHEN um buscador lê as páginas públicas THEN cada uma SHALL ter título e descrição próprios; home, cardápio, encomendas e produto com Open Graph (título, descrição, imagem).
2. WHEN acesso `/sitemap.xml` THEN SHALL listar home, cardápio, encomendas, privacidade e os produtos ativos com preço definido, com a URL de `NEXT_PUBLIC_SITE_URL`.
3. WHEN acesso `/robots.txt` THEN SHALL liberar o site e bloquear `/admin`, `/carrinho`, `/checkout`, `/pedido`; em deploy de preview SHALL bloquear tudo.
4. WHEN um buscador lê a home THEN SHALL encontrar dados estruturados `Bakery` para cada loja ativa (nome, endereço, telefone, horários do banco, URL).
5. WHEN lê a página de um produto THEN SHALL encontrar `Product` com nome, descrição, imagem e oferta em BRL; a disponibilidade vem do estoque para vitrine.
6. WHEN um produto está inativo ou com preço pendente THEN SHALL ficar fora do sitemap (a página já responde 404).

---

### P1: Revisão mobile e desempenho ⭐ MVP

**Acceptance Criteria**:

1. WHEN abro as páginas públicas e as telas do painel em 360 px THEN SHALL não haver rolagem horizontal, texto cortado ou botão menor que 44 px nas ações principais.
2. WHEN meço no preview THEN o Lighthouse mobile SHALL ficar acima de 85 (desempenho, acessibilidade, boas práticas, SEO) em home, cardápio, encomendas e produto.
3. WHEN uma imagem de produto aparece THEN SHALL vir por `next/image` em formato moderno, com carregamento sob demanda fora da primeira dobra.
4. WHEN acesso uma página que não existe THEN SHALL ver uma página 404 com a identidade da Cake 67 e atalho para o cardápio.

---

## Edge Cases

- WHEN o período cruza a meia-noite de Campo Grande THEN o pedido SHALL cair no dia local, não no UTC.
- WHEN um pedido é cancelado depois de confirmado THEN SHALL sair do faturamento e entrar em cancelados (conta o status atual).
- WHEN um produto foi renomeado ou apagado THEN os mais vendidos SHALL agrupar pelo produto e mostrar o nome atual, ou o nome guardado no pedido se o produto não existir mais.
- WHEN o período é longo (ex. um ano) THEN a tela SHALL continuar rápida: o banco agrega, a tela não baixa todos os pedidos.
- WHEN duas pessoas salvam as configurações ao mesmo tempo THEN vale a última (tabela de uma linha, sem conflito de dados).
- WHEN `NEXT_PUBLIC_SITE_URL` não está definida THEN sitemap e dados estruturados SHALL usar a URL do deploy, sem quebrar o build.

---

## Success Criteria

- [ ] Totais do relatório batem com a conta à mão num conjunto de pedidos de teste (teste de integração).
- [ ] Atendente recusado em relatório, CSV e configurações (tela e requisição direta).
- [ ] CSV abre certo no Excel pt-BR, com CPF/CNPJ e sem injeção de fórmula.
- [ ] Mudança no modelo da mensagem aparece no próximo pedido sem deploy.
- [ ] `sitemap.xml`, `robots.txt` e JSON-LD válidos; Lighthouse mobile > 85 nas 4 páginas.
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` e preview.
