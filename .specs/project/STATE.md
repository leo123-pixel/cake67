# State

**Last Updated:** 2026-09-28
**Current Work:** Sistema no ar em https://cake67.vercel.app desde 2026-09-27 (produção = `main`). Etapa 08 (WhatsApp por setor e aviso de confirmação) em PR; migration já aplicada no projeto. Depois do merge: PR que apaga `stores.whatsapp`. Próximo: M2 · Lançamento (pendências da cliente, plano pago da Vercel e domínio).

---

## Recent Decisions (Last 60 days)

### AD-015: WhatsApp por setor e aviso de confirmação (2026-09-28)

**Decision:** Cada loja tem três WhatsApp: pronta entrega, encomenda e SAC. Pedido com qualquer item de encomenda vai para Encomenda; só vitrine vai para Pronta entrega (a escolha fica em `get_order_public`). Contato público (home, assistente, Cakelovers, pedido depois de `novo`) é só o SAC; "Pedir pelo WhatsApp" de bolo sem preço vai para Encomenda. Ao **Confirmar** (e **Reativar e confirmar**), o painel abre o WhatsApp do cliente com a mensagem de confirmação (modelo editável em Configurações, exige `{codigo}` e `{link}`, sem valores); a página `/pedido/[code]` mostra o status real. Etapa 08.
**Reason:** Pedido do Leonardo: a operação real separa os setores e o cliente não sabia que o pedido foi confirmado.
**Trade-off:** O aviso não é automático (o atendente envia). A API oficial do WhatsApp (Meta) ficou fora: exige conta verificada, modelo aprovado e custo por mensagem; o gatilho é o mesmo, então dá para trocar depois.
**Impact:** `stores.whatsapp` fica anulável e fora dos tipos até um PR seguinte apagar a coluna (a migration foi aplicada antes do merge sem quebrar o site no ar). Resolve a pendência do WhatsApp da Loja 2.

### AD-014: Uma checagem de sessão no servidor por acesso (2026-09-28)

**Decision:** O `middleware.ts` continua com `getUser()` (pergunta ao Supabase Auth); `getSession` em `lib/auth.ts` passa a usar `getClaims()`, que confere a assinatura do JWT localmente (ES256, JWKS em cache) (PR #12).
**Reason:** Cada página e Server Action do painel ia duas vezes ao Auth; agora vai uma.
**Trade-off:** Usuário apagado direto no Supabase Auth mantém um JWT válido até expirar (~1 h), mas só se o middleware for contornado. Para tirar alguém da equipe, desativar em `staff.active` continua valendo na hora (lido a cada acesso).
**Impact:** Depende de o projeto assinar JWT com chave assimétrica; `tests/integration/auth.test.ts` falha se voltar para HS256 (aí `getClaims` cairia para uma chamada de rede e o ganho some).

### AD-013: Funções da Vercel em São Paulo (`gru1`) (2026-09-28)

**Decision:** `vercel.json` fixa `regions: ["gru1"]`, ao lado do Supabase (`sa-east-1`). O painel ganhou `loading.tsx` (esqueleto na navegação) e consultas independentes em paralelo no Início e em Pedidos (PR #10).
**Reason:** Painel "travando": as funções rodavam em `iad1` (EUA) e cada consulta cruzava EUA↔Brasil; as páginas do painel encadeiam 4–6 consultas. `/cardapio` caiu de 0,85–3,2 s para 0,4–0,6 s de TTFB.
**Trade-off:** Nenhum relevante; o plano gratuito permite uma região. Se o Supabase mudar de região, mudar esta junto.
**Impact:** A checagem de sessão duplicada foi resolvida na AD-014.

### AD-012: Home igual ao protótipo em produção (2026-09-27)

**Decision:** A home reproduz o `prototipo/index.html` (o que está em `cake67.vercel.app`) com dados reais. Bolos com preço a definir **aparecem** na home e no configurador (exceção de exibição à AD-006), sem preço e com "Pedir pelo WhatsApp"; continuam fora do pedido pelo site. Cakelovers mantém o visual e "Quero participar" abre o WhatsApp (sem coletar e-mail). O assistente fica, com respostas por regras a partir do banco e saída para o WhatsApp. Texto do hero diz que o pagamento é combinado no WhatsApp; "15 anos de marca" e "89,7 mil no Instagram" ficam; sai "Protótipo Onbind".
**Reason:** Pedido do Leonardo: a home do preview estava diferente da aprovada em produção.
**Trade-off:** Mostrar bolo sem preço exige leitura pública sem expor `price_cents` (função no banco, não relaxar o RLS).
**Impact:** Nova etapa 07; cabeçalho e rodapé do site passam a ser os do protótipo.

### AD-011: Relatório e configurações (2026-09-26)

**Decision:** Faturamento = subtotal dos pedidos que chegaram a ser confirmados (`confirmado`, `em_producao`, `pronto`, `entregue`), pela **data em que o pedido foi feito**; cancelados, expirados e novos aparecem à parte. CSV de pedidos **inclui CPF/CNPJ** (só admin). Rascunho da política de privacidade redigido a partir do que o sistema coleta, marcado provisório até a cliente marcar "revisado". Modelo da mensagem do WhatsApp é texto livre com variáveis e prévia; exige `{codigo}` e `{itens}` e recusa variável desconhecida.
**Reason:** Escolhas do Leonardo: mesma regra de data do filtro "Hoje"; contabilidade emite notas a partir da planilha.
**Trade-off:** CSV com CPF sai do sistema; restrito ao admin e neutralizado contra injeção de fórmula; a política cita o compartilhamento com a contabilidade.
**Impact:** Agregação no banco (função só para admin), coluna de "privacidade revisada" em `settings`.

### AD-010: Operação de pedidos (2026-09-26)

**Decision:** Pedido `expirado` pode ser **reativado e confirmado** pela equipe se ainda houver estoque (tudo ou nada; encomendas sem checar antecedência). Filtro "Hoje" da lista usa a **data em que o pedido foi feito**; o início também mostra "Saem hoje" (encomendas agendadas para hoje).
**Reason:** Escolhas do Leonardo: cliente que manda o WhatsApp depois de 2 h não precisa refazer o pedido.
**Trade-off:** "Saem hoje" complementa o filtro por data de criação para não esquecer encomendas antigas.
**Impact:** Função de reativação no banco com a mesma reserva atômica do `create_order`.

### AD-009: Regras do pedido público (2026-09-26)

**Decision:**
- Anti-abuso só com limites no banco: máx. 10 un. por item de vitrine, 2 pedidos `novo` por WhatsApp, 30 linhas por pedido. Sem captcha.
- Pedido só de vitrine não escolhe horário: "retire em até N horas" (tempo de reserva).
- Checkout com aviso curto de privacidade e `/privacidade` provisória (texto de `settings`).
- Campo **CPF ou CNPJ na nota**, opcional, validado (dígitos verificadores) no site e no banco; não vai para a tela pública nem para a mensagem do WhatsApp; visível no painel (etapa 05).
**Reason:** Escolhas do Leonardo; CPF/CNPJ pedido para emissão de nota.
**Trade-off:** Limites simples não param um ataque determinado; Turnstile fica como opção futura.
**Impact:** Nova coluna `orders.customer_tax_id`; texto de privacidade precisa citar o documento.

### AD-008: Estoque para todo item de vitrine + contagem da manhã (2026-09-26)

**Decision:** Todo produto de vitrine tem contagem, inclusive os feitos na hora (croissants). A etapa 03 inclui um modo "Contagem" que salva a vitrine inteira de uma vez; durante o dia usa +/−/Definir/Esgotar. Sem zerar automático no fim do dia.
**Reason:** Rotina real do balcão (Leonardo).
**Trade-off:** Croissant precisa ser contado como os demais.
**Impact:** Função de contagem em lote, atômica, com um movimento por item alterado.

### AD-007: Convite e nova senha por link, sem e-mail (2026-09-26)

**Decision:** `auth.admin.generateLink` gera link de uso único para `/auth/confirm?token_hash=…`; o painel mostra Copiar / Enviar pelo WhatsApp. "Esqueci minha senha" orienta a pedir link ao admin. Primeiro link do Leonardo via `npm run admin:link`.
**Reason:** SMTP do Supabase Free só entrega para a equipe da org e 2/h.
**Trade-off:** Sem autoatendimento de senha até ter SMTP próprio.
**Impact:** Antes do lançamento (M2), avaliar Resend/SMTP próprio; `/auth/confirm` já serve para links por e-mail.

### AD-006: Escopo extra da etapa 02 (2026-09-26)

**Decision:** Etapa 02 inclui tela de Usuários (convite/perfil/loja/desativar) e tela de Adicionais de bolo. Produto com `price_pending = true` não aparece no site.
**Reason:** Usuários e adicionais estão no SPEC §8/§4 sem etapa definida; login já usa convite e etapa 05 precisa de atendente real. Esconder preço pendente evita pedido com valor ilustrativo.
**Trade-off:** Etapa 02 maior.
**Impact:** Regra de `price_pending` aplicada no RLS público e na view de disponibilidade, não só na UI.

### AD-005: Bebidas e preços pendentes entram pelo painel (2026-09-26)

**Decision:** Bebidas não entram no seed. Elas e os preços provisórios (bolos, cento, kits) serão cadastrados pelo painel.
**Reason:** Não há dados no protótipo; decisão do Leonardo.
**Trade-off:** O cardápio começa sem bebidas.
**Impact:** O painel de produtos (etapa 02) precisa permitir criar produto e definir preço, limpando `price_pending`.

### AD-001: Decisões de produto do SPEC (2026-09-25)

**Decision:** Todas as decisões da seção 1 do [SPEC.md](SPEC.md) estão fechadas.
**Reason:** Acordadas com o Leonardo.
**Trade-off:** —
**Impact:** Não rediscutir sem o Leonardo.

### AD-002: Repositório local em `Downloads/cake67` (2026-09-25)

**Decision:** Trabalhar no clone de `leo123-pixel/cake67`. A pasta `Downloads/cake67-site` é só a cópia antiga do protótipo.
**Reason:** App na raiz do repo, protótipo em `prototipo/`.
**Trade-off:** —
**Impact:** Todos os caminhos relativos são a partir de `Downloads/cake67`.

### AD-003: `Downloads/CLAUDE.md` (Onbind) não se aplica (2026-09-25)

**Decision:** As regras do Onbind (SQLite, Drizzle, OpenAI, pnpm) não valem aqui. O projeto tem `CLAUDE.md` próprio na raiz do repo.
**Reason:** Arquivo de outro projeto que herda por estar em pasta-pai.
**Trade-off:** —
**Impact:** Seguir `cake67/CLAUDE.md` e o SPEC.

### AD-004: npm como gerenciador de pacotes (2026-09-25)

**Decision:** npm (já instalado). Admin do seed: comercial.servicoaki@gmail.com.
**Reason:** Escolha do Leonardo.
**Trade-off:** —
**Impact:** Lockfile `package-lock.json`.

---

## Active Blockers

### B-001: ~~Projeto Supabase ainda não existe~~ — resolvido 2026-09-26

Projeto `zwzngzjhjyfndxigyinq` (sa-east-1, Leo Org, Free). Chaves e `SUPABASE_DB_URL` (session pooler `aws-0-sa-east-1`) só no `.env.local`.

### B-003: Tipos do banco não são gerados automaticamente

**Discovered:** 2026-09-26
**Impact:** `lib/database.types.ts` é escrito à mão; risco de divergir do schema.
**Workaround:** atualizar o arquivo junto com cada migration; `test:integration` e typecheck pegam divergências nas tabelas usadas.
**Resolution:** (a) Leonardo roda `supabase login` com a conta da Leo Org e usamos `supabase gen types --project-id`, ou (b) instalar Docker Desktop.

### B-004: ~~Cadastro público no Supabase Auth~~ — resolvido 2026-09-26

Leonardo desligou "Allow new users to sign up" no painel.

### B-006: Primeiro acesso do Leonardo ao painel

**Impact:** a conta `comercial.servicoaki@gmail.com` ainda não tem senha (convite do seed nunca foi aceito).
**Resolution:** `SITE_URL=<url do preview ou produção> npm run admin:link -- comercial.servicoaki@gmail.com`, abrir o link e definir a senha.

### B-005: Conector Vercel (MCP) só com leitura

**Discovered:** 2026-09-26
**Impact:** `update_project` e `create_project_env` retornam 403.
**Workaround:** Vercel CLI logado como `leo123-pixel` (`vercel env add ... preview "" --value ... --yes --force`; o `""` é necessário para "todas as branches"). Configurações de build só pelo painel.

### B-002: Pendências da cliente (SPEC §12)

**Discovered:** 2026-09-25
**Impact:** Seed usa valores provisórios (preços por kg, kits, cento, antecedência). WhatsApp da Loja 2 resolvido em 2026-09-28 (AD-015).
**Workaround:** Marcar como provisório no seed e no painel.
**Resolution:** Leonardo confirma com a cliente antes do M2. Inclui revisar e marcar a política de privacidade (rascunho da etapa 06) e decidir se o pêssego sobre oliva do protótipo (contraste 4,05:1, abaixo de 4,5 para texto pequeno) fica ou ganha um tom mais claro.

---

## Lessons Learned

### L-001: Página com dados do banco precisa ser dinâmica

**Context:** `next build` tentou pré-renderizar a home.
**Problem:** `createClient()` validava o env antes de `cookies()`; sem `cookies()` o Next trata a rota como estática e congelaria o catálogo no deploy.
**Solution:** chamar `cookies()` primeiro em `lib/supabase/server.ts`.
**Prevents:** catálogo desatualizado em produção. Conferir no output do build que rotas com dados aparecem como `ƒ`.

### L-002: Validar SQL sem Docker

**Context:** sem Docker local para `supabase start`.
**Solution:** PGlite (Postgres 17 em WASM) com stubs de `auth.users`, `auth.uid()`, `storage`, papéis `anon`/`authenticated` e `set role` + `request.jwt.claim.sub` testa migrations, seed e RLS em segundos.
**Prevents:** descobrir erro de SQL só no `db push` contra o projeto real.

### L-004: Projeto Supabase sem GRANT automático

**Context:** primeiro `npm run seed` falhou com "permission denied for table staff" até com a service role; anon recebia 401 em `stores`.
**Problem:** o projeto não aplica default privileges às tabelas novas do `public`.
**Solution:** migration `20260926000500_grants.sql` com grants explícitos (anon só `select` no catálogo). O check local em PGlite passou a simular o mesmo (sem default privileges).
**Prevents:** tabela nova invisível para a Data API. Regra 8 do `CLAUDE.md`.

### L-005: Site público nunca usa a sessão do usuário

**Problem:** com login existindo, `createClient()` (cookies) fazia um admin navegando no site ver produtos inativos e com preço a definir (política "admin manages").
**Solution:** `lib/supabase/public.ts` (`createPublicClient`, anon sem sessão + `connection()`). Todo código do site público usa esse client.
**Prevents:** vazamento de itens ocultos e divergência entre o que admin e cliente veem.

### L-006: React 19 reseta formulário após action

**Problem:** `<form action>` é resetado ao fim da action; `<select>`/checkbox não voltam ao `defaultValue` novo (categoria sumia após erro; valores antigos após salvar).
**Solution:** `useAdminForm` (components/admin/use-admin-form.ts) numera respostas; `<form key={round}>` remonta com os padrões atuais; actions devolvem `values` no erro.
**Prevents:** perda de dados digitados e tela mostrando valor desatualizado.

### L-007: Funções SQL com RLS do chamador podem falhar ou silenciar

**Context:** `set_product_addons` (security invoker) para atendente: `delete` filtrado em silêncio, `insert` gera 42501.
**Prevents:** testes que assumem "sem efeito = sem erro". Testar com entrada que force a escrita.

### L-008: `@dnd-kit` precisa de `id` estável

**Solution:** `<DndContext id={useId()}>`; sem isso há erro de hidratação (`DndDescribedBy-N`).

### L-009: Dado que migration cria precisa ir também para o seed

**Context:** a migration de estoque grava "Saldo inicial" para linhas existentes, mas num banco novo o `seed.sql` roda depois das migrations.
**Solution:** mesmo insert idempotente no fim do `seed.sql`.
**Prevents:** ambiente novo com histórico que não fecha com o estoque.

### L-010: `pattern` em input bloqueia a action com mensagem do navegador

**Solution:** `noValidate` no form quando a validação e as mensagens vêm do servidor; manter `inputMode`/`pattern` só para o teclado numérico.

### L-011: Build na Vercel pode falhar no download do Google Fonts

**Context:** preview da etapa 03 falhou com `next/font … Cannot read properties of null (reading '1')` sem mudança nas fontes; o mesmo commit compilou no redeploy.
**Solution:** `vercel redeploy <url> --target preview`. Se repetir, considerar fontes locais (`next/font/local`) com os arquivos no repo.
**Prevents:** investigar código por um erro de rede do build.

### L-012: Testes de integração compartilham o banco real

**Problem:** checagens de invariante (soma dos movimentos = estoque) podem ver outro arquivo de teste no meio de uma operação.
**Solution:** `fileParallelism: false` no projeto `integration`; ajustes de estoque em teste sempre por `set_stock` (atômico), nunca `update` direto.

### L-013: `Set-Content -Encoding utf8` grava BOM no PowerShell 5.1

**Problem:** mensagem de commit começou com BOM invisível.
**Solution:** escrever mensagens de commit com a ferramenta Write (UTF-8 sem BOM) e `git commit -F`.

### L-014: Realtime confirma a inscrição antes de transmitir

**Problem:** o teste de Realtime não recebia o INSERT feito logo após `SUBSCRIBED`, embora `orders` estivesse na publicação.
**Solution:** `realtime.setAuth(token)` antes de assinar (senão o RLS avalia como anon) e, em teste, esperar ~2 s depois de `SUBSCRIBED`. O painel fica conectado o tempo todo e não precisa disso.

### L-015: `router.refresh()` reescreve o título da aba

**Problem:** o contador "(n) Pedidos novos" sumia no refresh seguinte ao alerta.
**Solution:** `MutationObserver` no `<head>` reaplica o título enquanto a aba está oculta com pedidos não vistos.

### L-016: Trigger que usa `auth.uid()` herda quem disparou a função

**Problem:** `expire_orders` roda também quando alguém abre o painel, e a expiração saía no histórico com o nome dessa pessoa.
**Solution:** status `expirado` sempre registra "Sistema", independente da sessão.

### L-017: `fieldset` não encolhe sozinho

**Problem:** a contagem de estoque estourava 360 px mesmo com `truncate` no nome.
**Solution:** `fieldset { min-width: 0 }` na base do CSS (o navegador dá `min-inline-size: min-content` ao fieldset).

### L-018: Textarea envia quebras de linha como CRLF

**Problem:** o modelo da mensagem salvo pelo painel ia com `\r\n` para o banco e para o link do WhatsApp.
**Solution:** normalizar para `\n` no schema Zod de todo campo multilinha.

### L-019: `next build` e `next dev` dividem a pasta `.next`

**Problem:** rodar o build de produção com o dev aberto quebrou o dev (ENOENT em manifestos).
**Solution:** parar o dev antes de `build`/`start`, apagar `.next` e reiniciar. Medir Lighthouse no build local (o preview exige login da Vercel); `robots.ts` é gerado no build, então usar `VERCEL_ENV=production` só para essa medição.

### L-020: Emulação de viewport do painel não reduz `innerWidth`

**Problem:** o viewport de 360 px do Browser pane relatava 527 px.
**Solution:** medir em 360 px com um `<iframe>` de 360 px da mesma origem (rolagem horizontal e alvos < 44 px por script).

### L-021: O projeto não usa Prettier

**Problem:** `npx prettier --write` nos arquivos da etapa 08 reformatou arquivos inteiros (diff de ~1.950 linhas); o código segue o estilo próprio, com linhas longas.
**Solution:** Não rodar formatador; seguir o estilo do arquivo. O `lint` (ESLint) é o único verificador de estilo.

### L-003: Commit no PowerShell 5.1

**Problem:** here-string via stdin não chega ao `git commit -F -`.
**Solution:** escrever a mensagem num arquivo do scratchpad e usar `git commit -F <arquivo>`.

---

## Preferences

**Model Guidance Shown:** never
