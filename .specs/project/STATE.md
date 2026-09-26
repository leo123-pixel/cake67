# State

**Last Updated:** 2026-09-26
**Current Work:** 01 · Base - Tasks (aguardando aprovação; spec e design aprovados em 2026-09-26)

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

### B-001: Projeto Supabase ainda não existe

**Discovered:** 2026-09-25
**Impact:** Bloqueia aplicar migrations e o aceite da etapa 01. Não bloqueia escrever código e SQL.
**Workaround:** Escrever migrations e seed; validar SQL assim que houver projeto.
**Resolution:** Leonardo cria `cake67` (região São Paulo) e passa URL, anon key e service role key. Plano Free permite 2 projetos ativos por organização.

### B-002: Pendências da cliente (SPEC §12)

**Discovered:** 2026-09-25
**Impact:** Seed usa valores provisórios (WhatsApp da Loja 2, preços por kg, kits, cento, antecedência).
**Workaround:** Marcar como provisório no seed e no painel.
**Resolution:** Leonardo confirma com a cliente antes do M2.

---

## Lessons Learned

_(nenhuma ainda)_

---

## Preferences

**Model Guidance Shown:** never
