# State

**Last Updated:** 2026-09-26
**Current Work:** 01 · Base - Implement: T1–T21 feitos na branch `feat/01-base`; próximo T22 (Vercel)

---

## Recent Decisions (Last 60 days)

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

### B-004: Cadastro público no Supabase Auth

**Discovered:** 2026-09-26
**Impact:** `config.toml` só vale localmente. No projeto, "Allow new users to sign up" precisa estar desligado (SPEC §6).
**Resolution:** Leonardo confirma no painel (Authentication → Sign In / Providers).

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

### L-003: Commit no PowerShell 5.1

**Problem:** here-string via stdin não chega ao `git commit -F -`.
**Solution:** escrever a mensagem num arquivo do scratchpad e usar `git commit -F <arquivo>`.

---

## Preferences

**Model Guidance Shown:** never
