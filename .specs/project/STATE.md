# State

**Last Updated:** 2026-09-26
**Current Work:** 03 concluída (PR #3, base `feat/02-catalog-panel`). PRs #1, #2 e #3 aguardando merge, nessa ordem. Próximo: 04 · Pedido — Specify.

---

## Recent Decisions (Last 60 days)

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
**Impact:** Seed usa valores provisórios (WhatsApp da Loja 2, preços por kg, kits, cento, antecedência).
**Workaround:** Marcar como provisório no seed e no painel.
**Resolution:** Leonardo confirma com a cliente antes do M2.

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

### L-003: Commit no PowerShell 5.1

**Problem:** here-string via stdin não chega ao `git commit -F -`.
**Solution:** escrever a mensagem num arquivo do scratchpad e usar `git commit -F <arquivo>`.

---

## Preferences

**Model Guidance Shown:** never
