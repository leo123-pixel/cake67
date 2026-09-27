# 07 · Home igual ao protótipo — Specification

**Status**: Approved (2026-09-27)

## Problem Statement

O Leonardo quer que a home do sistema fique igual à que está em produção (`cake67.vercel.app`, que é o `prototipo/index.html`). A home construída na etapa 01 ficou reduzida (hero simples, destaques e lojas); vitrine e encomendas foram para páginas próprias. O protótipo é uma página única com hero animado, bolos em destaque, calculadora e configurador, vitrine por abas, lojas, Cakelovers e um assistente. A nova home reproduz esse visual e comportamento, mas com os dados reais do banco e sem prometer o que o sistema não faz (pagamento online, frete calculado, fidelidade automática).

## Goals

- [ ] Em desktop e celular, a home é visualmente a do protótipo: mesmas seções, na mesma ordem, com as mesmas animações.
- [ ] Todo dado exibido (produtos, preços, disponibilidade, lojas, horários, prazos) vem do banco; nada fixo no código além de textos de marca.
- [ ] Pedido feito pela home segue o fluxo real (carrinho → checkout → WhatsApp), com o preço sempre recalculado no banco.
- [ ] Lighthouse mobile da home continua acima de 85 nas quatro categorias.

## Out of Scope

- Pagamento online (Pix/cartão) e o "Pagar e confirmar" do protótipo: o pagamento segue combinado no WhatsApp.
- Gaveta de carrinho do protótipo: o botão "Pedido" continua levando a `/carrinho` (mesmo visual do botão).
- Cadastro de e-mail e programa de fidelidade de verdade (AD-012: Cakelovers vira WhatsApp).
- Assistente com IA: as respostas são montadas por regras, a partir dos dados do banco.
- Mudanças nas páginas `/cardapio`, `/encomendas`, `/produto`, carrinho e checkout além do cabeçalho e rodapé compartilhados.

---

## User Stories

### P1: Hero, faixa e navegação ⭐ MVP

**Acceptance Criteria**:

1. WHEN abro a home THEN SHALL ver a abertura animada (monograma desenhando e o nome subindo, ~1,5 s) e em seguida o hero: "Doceria · Campo Grande · MS", "Bolos, fatias e docinhos *feitos pra celebrar.*", o bolo no arco com zoom lento, quatro doces flutuando, o selo girando "FEITO À MÃO · CAMPO GRANDE · CAKE67" e o aviso "Imagem ilustrativa".
2. WHEN leio o texto do hero THEN SHALL dizer que o pagamento é combinado no WhatsApp (AD-012), com os botões "Encomendar um bolo" (→ encomendas) e "Ver a vitrine de hoje" (→ vitrine), e a linha "2 lojas em Campo Grande · 15 anos de marca · 89,7 mil no Instagram".
3. WHEN movo o mouse (desktop) THEN os doces SHALL se mover em paralaxe; no celular ficam só balançando.
4. WHEN o sistema pede menos movimento (`prefers-reduced-motion`) THEN abertura, paralaxe, faixa e giros SHALL ficar parados.
5. WHEN rolo THEN SHALL ver a faixa pêssego rolando ("Bolos sob encomenda · Fatias da semana · …") e o cabeçalho fixo com "Bolos · Encomendas · Vitrine · Lojas · Cakelovers" (âncoras na home, `/#secao` nas outras páginas) e o botão "Pedido" com a contagem.
6. WHEN estou no celular THEN o cabeçalho SHALL caber em 360 px sem rolagem horizontal.

### P1: Bolos em destaque ⭐ MVP

1. WHEN rolo até "Bolos sob encomenda" THEN SHALL ver até 3 bolos (produtos `bolo_kg` ativos em destaque, na ordem do painel) em arco, com foto, nome, descrição, "a partir de N kg" e "Montar este".
2. WHEN um bolo é o Bolo do Mês (destaque ativo) THEN SHALL ter a etiqueta "Bolo do mês"; os demais usam "Especial".
3. WHEN o bolo está com preço a definir THEN SHALL aparecer mesmo assim (AD-012), sem preço.
4. WHEN toco em "Montar este" THEN o configurador SHALL selecionar esse bolo e rolar até ele.
5. WHEN não há bolo em destaque THEN a seção SHALL mostrar os primeiros bolos ativos; sem nenhum bolo, a seção não aparece.

### P1: Encomendas (calculadora e configurador) ⭐ MVP

1. WHEN rolo até "Quantos convidados? A gente faz a conta." THEN SHALL ver os dois cartões do protótipo: Passo 1 (convidados, peso, formato, fatias, "Usar esta sugestão") e Passo 2 (sabor, peso, formato, adicionais, loja, data, total estimado, "Adicionar ao pedido").
2. WHEN o bolo escolhido tem preço THEN o total SHALL animar até o valor estimado e "Adicionar ao pedido" SHALL colocá-lo no carrinho real (o banco recalcula no pedido).
3. WHEN o bolo está com preço a definir THEN o total SHALL mostrar "Preço em breve" e o botão SHALL virar "Pedir pelo WhatsApp", com o bolo, o peso, o formato e os adicionais escolhidos na mensagem (AD-012).
4. WHEN escolho a data THEN SHALL respeitar a antecedência do bolo; a data e a loja escolhidas seguem para o checkout, onde são validadas de novo.
5. WHEN há cento e kits cadastrados THEN SHALL aparecer um atalho "Salgados, doces por cento e kits" para `/encomendas`.

### P1: Vitrine ⭐ MVP

1. WHEN rolo até "Na vitrine hoje" THEN SHALL ver o seletor de loja e as abas por categoria da vitrine (dados reais), com os itens em grade de dois.
2. WHEN troco a loja ou a aba THEN a lista SHALL trocar sem recarregar a página, com disponibilidade real (esgotado aparece "Esgotado · Hoje não").
3. WHEN toco em "Adicionar" THEN o item SHALL ir para o carrinho real com a animação do protótipo (a foto voa até "Pedido" e o botão pulsa) e um aviso "… entrou no pedido".
4. WHEN a aba é Croissants ou Fatias THEN a nota SHALL seguir o protótipo ("montados na hora, de 12 a 15 minutos" / "4 sabores por semana").

### P1: Lojas ⭐ MVP

1. WHEN rolo até "Nossas lojas" THEN SHALL ver as aquarelas da fachada e, para cada loja ativa: nome, endereço, horários (do banco, por extenso), telefone, WhatsApp e o botão "WhatsApp".
2. WHEN o WhatsApp da loja é provisório THEN o dado SHALL seguir o que está no banco (regra 6: provisório marcado no painel).

### P1: Cakelovers ⭐ MVP

1. WHEN rolo até "Vire Cakelover." THEN SHALL ver a seção do protótipo (vantagens e o cartão fidelidade).
2. WHEN toco em "Quero participar" THEN SHALL abrir o WhatsApp da Loja 1 com "Quero participar do Cakelovers" (AD-012); nenhum e-mail é pedido nem guardado.

### P1: Assistente ⭐ MVP

1. WHEN toco em "Dúvidas? Fale com a Cake" THEN SHALL abrir o assistente do protótipo, com saudação e as sugestões "Tem fatia hoje?", "Bolo para 30 pessoas", "Abre domingo?", "Qual o prazo?".
2. WHEN pergunto THEN a resposta SHALL vir de regras sobre dados reais (AD-012):
   - fatias/vitrine → itens disponíveis hoje por loja, com preço;
   - convidados/pessoas → sugestão de peso e formato pela mesma conta da calculadora;
   - preço/kg → preço por kg dos bolos com preço, ou "preço em breve";
   - prazo/antecedência → antecedência real dos bolos;
   - horário/loja/domingo → horários do banco;
   - entrega/taxa → retirada ou entrega com taxa combinada no WhatsApp;
   - pagamento/Pix/cartão → pagamento combinado no WhatsApp;
   - croissant → croissants da vitrine hoje.
3. WHEN a pergunta não bate com nenhuma regra THEN SHALL oferecer "Falar no WhatsApp" com a pergunta na mensagem.
4. WHEN a resposta aponta para uma seção THEN SHALL ter o atalho do protótipo (ex.: "Abrir a calculadora").
5. O assistente SHALL nunca inventar preço, prazo ou disponibilidade.

### P1: Rodapé ⭐ MVP

1. WHEN chego ao fim de qualquer página do site THEN SHALL ver o rodapé do protótipo (logo, "Navegue", "Lojas" com endereços do banco), com "Política de privacidade" levando a `/privacidade` e sem "Protótipo Onbind".

---

## Edge Cases

- WHEN o JavaScript não carregou THEN a home SHALL mostrar todo o conteúdo estático (hero, bolos, lojas); vitrine e configurador mostram a primeira loja e o primeiro bolo.
- WHEN o banco não responde THEN a home SHALL usar a página de erro do site (já existe), sem conteúdo fixo falso.
- WHEN uma loja está inativa THEN SHALL sumir da vitrine, das lojas, do rodapé e do assistente.
- WHEN a foto real de um produto não existe THEN SHALL usar o placeholder atual.
- WHEN o aviso de fotos geradas por IA não se aplica mais (fotos reais cadastradas) THEN SHALL poder ser desligado (texto só aparece enquanto a foto do bolo vier do seed).

---

## Success Criteria

- [ ] Comparação lado a lado com `cake67.vercel.app` em 1280 px e 375 px: mesmas seções, ordem, cores, fontes e animações.
- [ ] Pedido pela home (vitrine e bolo com preço) chega ao checkout e vira pedido real; bolo sem preço abre o WhatsApp.
- [ ] Assistente responde as 4 sugestões com dados do banco.
- [ ] Lighthouse mobile da home > 85; 360 px sem rolagem horizontal.
- [ ] `lint`, `typecheck`, `test`, `test:integration`, `build` e preview.
