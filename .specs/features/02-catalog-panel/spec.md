# 02 · Painel de catálogo — Specification

## Problem Statement

O catálogo só muda hoje por SQL. A dona precisa cadastrar e ajustar produtos (inclusive bebidas e os preços que ficaram "a definir"), fotos, categorias, lojas e os destaques da home pelo celular, e ver a mudança no site na hora, sem depender de dev nem de deploy.

## Goals

- [ ] Admin entra no painel com e-mail e senha e só ele edita o catálogo.
- [ ] Produto criado no painel aparece no site sem novo deploy (aceite do SPEC).
- [ ] Todas as telas do painel usáveis em 360 px.

## Out of Scope

- Estoque (etapa 03), pedidos e dashboard (etapa 05), relatório e configurações (etapa 06).
- Página de produto e telas de encomenda no site (etapa 04). Nesta etapa o site só ganha os destaques na home.
- Exclusão definitiva de produto, categoria ou loja: só **desativar** (preserva histórico de pedidos).
- Login social, 2FA.

---

## User Stories

### P1: Login do painel ⭐ MVP

**User Story**: Como membro da equipe, quero entrar no painel com e-mail e senha para operar o catálogo.

**Acceptance Criteria**:

1. WHEN acesso qualquer rota `/admin/*` sem sessão THEN o sistema SHALL redirecionar para `/admin/login`.
2. WHEN informo e-mail e senha válidos de um `staff` ativo THEN SHALL entrar e ir para `/admin`.
3. WHEN a senha está errada ou o usuário não existe THEN SHALL mostrar "E-mail ou senha incorretos" (mesma mensagem nos dois casos).
4. WHEN o usuário existe no Auth mas não está em `staff` ativo THEN SHALL encerrar a sessão e mostrar "Seu acesso ao painel não está ativo".
5. WHEN clico em "Sair" THEN SHALL encerrar a sessão e voltar ao login.
6. WHEN abro um link de convite ou de nova senha (gerado pelo admin em Usuários e enviado por WhatsApp — AD-007) THEN SHALL cair em `/admin/definir-senha`, definir a senha (mín. 8 caracteres, confirmação igual) e entrar.
6a. WHEN clico em "Esqueci minha senha" no login THEN SHALL ver "Peça um novo link a um administrador".
7. WHEN a sessão expira durante o uso THEN a próxima navegação SHALL renovar a sessão ou levar ao login, sem erro técnico na tela.

**Independent Test**: entrar com o admin do seed, sair, pedir redefinição de senha e definir uma nova.

---

### P1: Acesso por perfil ⭐ MVP

**User Story**: Como dona, quero que só admins mexam no catálogo.

**Acceptance Criteria**:

1. WHEN um atendente acessa `/admin/produtos`, `/categorias`, `/adicionais`, `/lojas`, `/destaques` ou `/usuarios` THEN SHALL ver "Você não tem permissão para esta área" e o menu SHALL não mostrar esses itens.
2. WHEN um atendente tenta uma Server Action de catálogo (ex. via requisição forjada) THEN SHALL ser recusada no servidor e pelo RLS.
3. WHEN um atendente entra THEN `/admin` SHALL mostrar a loja dele e "Pedidos chegam na etapa de operação" (placeholder até a etapa 05).

**Independent Test**: logar como atendente de teste e tentar abrir e salvar um produto.

---

### P1: Produtos ⭐ MVP

**User Story**: Como dona, quero criar e editar produtos de todos os tipos para manter o cardápio atualizado.

**Acceptance Criteria**:

1. WHEN abro `/admin/produtos` THEN SHALL ver a lista com foto, nome, categoria, tipo, preço (ou "Preço a definir") e status (ativo/inativo), com filtro por categoria e busca por nome.
2. WHEN crio um produto THEN SHALL informar nome, categoria, tipo, descrição, preço em reais e lojas onde é vendido (nenhuma marcada = todas); o slug SHALL ser gerado do nome e ser único.
3. WHEN o tipo é `bolo_kg` THEN o formulário SHALL pedir preço por kg, pesos oferecidos, formatos e antecedência mínima (horas).
4. WHEN o tipo é `cento` THEN SHALL pedir preço do cento, quantidade mínima e passo (padrão 25 e 25) e antecedência.
5. WHEN o tipo é `kit` THEN SHALL pedir preço do kit, o que vem no kit e antecedência.
6. WHEN marco "Preço a definir" THEN SHALL gravar `price_pending = true` e o produto SHALL **não aparecer no site** (nem cardápio, nem destaques) até ser desmarcado; no painel ele aparece com o selo "Preço a definir". Ao desmarcar e salvar com preço válido, SHALL gravar `price_pending = false` e o produto volta ao site se estiver ativo.
7. WHEN salvo com dados inválidos (preço vazio ou negativo, nome vazio, cento sem mínimo/passo, bolo sem peso) THEN SHALL mostrar o erro no campo, em PT-BR, sem perder o que foi digitado.
8. WHEN desativo um produto THEN SHALL sumir do site no próximo carregamento e continuar visível no painel como inativo.
9. WHEN crio um produto de vitrine ativo com foto THEN SHALL aparecer em `/cardapio` sem deploy (aceite do SPEC). Sem estoque cadastrado ele aparece como **Esgotado** até a etapa 03.

**Independent Test**: cadastrar "Água com gás" (vitrine, Bebidas) e vê-la no cardápio.

---

### P1: Fotos do produto ⭐ MVP

**User Story**: Como dona, quero subir várias fotos pelo celular e escolher a capa.

**Acceptance Criteria**:

1. WHEN escolho fotos (câmera ou galeria) THEN cada uma SHALL ser convertida no navegador para WebP com no máximo 1600 px no maior lado antes do envio.
2. WHEN o envio termina THEN a foto SHALL aparecer na lista do produto; a primeira da lista é a capa.
3. WHEN arrasto uma foto (ou uso os botões ↑/↓ no celular) THEN a ordem SHALL ser salva e a capa no site SHALL mudar.
4. WHEN removo uma foto THEN SHALL sair do produto e do Storage.
5. WHEN o arquivo não é imagem ou a conversão falha THEN SHALL mostrar "Não foi possível usar esta imagem" e não enviar.
6. WHEN edito o texto alternativo THEN SHALL ser usado no `alt` do site (padrão: nome do produto).

---

### P1: Categorias ⭐ MVP

**Acceptance Criteria**:

1. WHEN crio uma categoria THEN SHALL informar nome e tipo (vitrine ou encomenda); slug gerado e único.
2. WHEN renomeio THEN o site SHALL mostrar o novo nome no próximo carregamento.
3. WHEN reordeno (arrastar ou ↑/↓) THEN a ordem do cardápio SHALL seguir.
4. WHEN desativo uma categoria THEN ela e seus produtos SHALL sumir do cardápio.

---

### P1: Lojas e horários ⭐ MVP

**Acceptance Criteria**:

1. WHEN edito uma loja THEN SHALL alterar nome, endereço, telefone, WhatsApp e horários por dia (aberta/fechada, abre, fecha).
2. WHEN digito o WhatsApp com máscara `(67) 98151-9796` THEN SHALL gravar só dígitos com 55 (`5567981519796`) e recusar números com quantidade errada de dígitos.
3. WHEN o horário de fechamento é menor ou igual ao de abertura THEN SHALL mostrar erro no dia correspondente.
4. WHEN desativo uma loja THEN SHALL sumir do seletor do site e da home.
5. WHEN salvo THEN a home e o cardápio SHALL refletir os dados no próximo carregamento.

---

### P1: Destaques da home ⭐ MVP

**User Story**: Como dona, quero trocar o Bolo do Mês, o Combo da Semana e banners sem pedir a ninguém.

**Acceptance Criteria**:

1. WHEN crio um destaque THEN SHALL escolher o espaço (Bolo do Mês, Combo da Semana, Banner) e informar título, subtítulo, imagem (própria ou do produto vinculado), texto e link do botão, período (início/fim opcionais) e ordem.
2. WHEN o destaque está ativo e dentro do período THEN SHALL aparecer na home.
3. WHEN o período acaba THEN SHALL sair da home sem ação manual.
4. WHEN o link do botão não é um caminho do site (`/...`) nem `https://` THEN SHALL ser recusado.
5. WHEN não há destaque vigente em um espaço THEN a home SHALL simplesmente não mostrar aquele bloco.

---

### P1: Usuários da equipe ⭐ MVP

**User Story**: Como dona, quero convidar atendentes e vinculá-los à loja deles.

**Why P1**: SPEC §8 lista a tela sem etapa no §11; decidido trazer para cá (AD-006) porque o login já usa o fluxo de convite e a etapa 05 precisa de atendente real.

**Acceptance Criteria**:

1. WHEN convido por e-mail com nome, perfil e loja (obrigatória para atendente) THEN SHALL criar o usuário e a linha em `staff` e mostrar o link de convite com "Copiar" e "Enviar pelo WhatsApp".
1a. WHEN peço "Gerar link de nova senha" para alguém da equipe THEN SHALL mostrar um link de uso único da mesma forma.
2. WHEN o e-mail já é da equipe THEN SHALL mostrar "Este e-mail já faz parte da equipe" sem enviar novo convite; se estiver desativado, oferecer reativar.
3. WHEN edito nome, perfil ou loja THEN SHALL valer a partir da próxima navegação daquela pessoa.
4. WHEN desativo um usuário THEN ele SHALL perder o acesso na próxima navegação.
5. WHEN tento desativar ou rebaixar o último admin ativo (inclusive a mim mesmo) THEN SHALL ser recusado.
6. WHEN um convite não foi aceito THEN a lista SHALL mostrar "Convite pendente" e permitir gerar um novo link.

---

### P1: Adicionais de bolo ⭐ MVP

**User Story**: Como dona, quero manter os adicionais (topo, velas, foto, frutas) e escolher quais cada bolo aceita.

**Acceptance Criteria**:

1. WHEN abro `/admin/adicionais` THEN SHALL criar, renomear, mudar preço, reordenar e ativar/desativar adicionais.
2. WHEN edito um produto `bolo_kg` THEN SHALL marcar quais adicionais ativos ele aceita.
3. WHEN desativo um adicional THEN ele SHALL deixar de ser oferecido em todos os bolos, sem apagar o vínculo.

---

## Edge Cases

- WHEN dois admins editam o mesmo produto THEN vale o último a salvar (sem trava otimista no MVP).
- WHEN o nome gera um slug já usado THEN SHALL acrescentar sufixo (`agua-com-gas-2`).
- WHEN o preço é digitado como `24,9`, `24,90` ou `R$ 24,90` THEN SHALL gravar 2490 centavos.
- WHEN o upload cai no meio (rede do balcão) THEN a foto SHALL não ficar pela metade: sem linha em `product_images` para arquivo que não subiu.
- WHEN uma categoria desativada tem produtos ativos THEN eles SHALL não aparecer no site (a categoria manda).
- WHEN um produto com "Preço a definir" é buscado direto pela API pública (anon) THEN SHALL não ser retornado: a regra vale no banco, não só na tela.
- WHEN a imagem de um destaque some do Storage THEN a home SHALL usar a do produto vinculado ou não mostrar imagem, sem quebrar.

---

## Success Criteria

- [ ] Aceite do SPEC: produto criado no painel aparece no site sem deploy.
- [ ] Atendente não consegue alterar catálogo nem pela tela nem por requisição direta (teste automatizado).
- [ ] Cadastro de um produto de vitrine com foto em menos de 2 minutos no celular.
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` passando e preview no ar.
