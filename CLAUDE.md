# Cake 67 — site de pedidos e painel

Este arquivo substitui, para este repositório, qualquer `CLAUDE.md` de pasta-pai (o de `Downloads/` é do projeto Onbind e não se aplica).

## Onde está o quê

- Especificação completa: `.specs/project/SPEC.md` (fonte da verdade).
- Visão, roadmap e memória entre sessões: `.specs/project/PROJECT.md`, `ROADMAP.md`, `STATE.md`. Ler `STATE.md` no início de toda sessão.
- Specs por etapa: `.specs/features/NN-nome/{spec,design,tasks}.md`.
- Protótipo aprovado (referência visual, não editar): `prototipo/`.

## Regras

1. **Preço nunca vem do navegador.** `create_order` recalcula tudo no banco.
2. **Estoque só muda por função no banco** e toda mudança gera linha em `stock_movements`.
3. **RLS ligado em todas as tabelas.** Anon não lê nem escreve `orders`/`order_items` direto.
4. **Service role key só no servidor.** Nunca em componente client nem em `NEXT_PUBLIC_*`.
5. Valores em centavos (`integer`). Datas `timestamptz`, exibição em `America/Campo_Grande`.
6. Dado provisório (pendência da cliente) fica marcado como tal no seed e no painel.
7. Não rediscutir decisões da seção 1 do SPEC sem o Leonardo.

## Idioma

- Interface em PT-BR.
- Código, nomes de arquivo, tabelas e commits em inglês. Valores de enum seguem o SPEC (`vitrine`, `novo`, `retirada`...).

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind · Supabase (`@supabase/ssr`) · Zod · npm · Node 24.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

Etapa só termina com `lint`, `typecheck`, `test` e `build` passando, commit e deploy de preview.

## Nunca commitar

`.env*` (exceto `.env.example`) · `supabase/.temp/` · chaves de qualquer tipo.
