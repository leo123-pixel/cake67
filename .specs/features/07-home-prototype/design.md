# 07 · Home igual ao protótipo — Design

**Spec**: `.specs/features/07-home-prototype/spec.md`
**Status**: Approved (2026-09-27, "pode começar")

---

## Architecture Overview

A home vira a página do protótipo montada por componentes, com o **CSS do protótipo portado quase literalmente** para `app/(site)/prototype.css` (classes com prefixo `ck-` para não colidir com as utilidades do Tailwind, como `btn` e `card`). Isso garante a fidelidade visual (arcos, selo, faixa, animações, reveal por scroll) sem reescrever cada regra em Tailwind.

Dados:

- **Servidor** (`app/(site)/page.tsx`) carrega tudo de uma vez com `createPublicClient()`: lojas (com horário, telefone e WhatsApp), bolos para vitrine (`list_cake_showcase()`, nova), cardápio da vitrine de **cada** loja (`listVitrineMenu`) e as configurações públicas.
- **Cliente**: ilhas pequenas. O configurador, a vitrine por abas, o assistente, a paralaxe, o toast e a animação de "voar para o carrinho" são client components. O resto é HTML estático do servidor.

Bolo sem preço (AD-012): o RLS de `products` continua escondendo `price_pending` do anon. Uma função `security definer` devolve os bolos ativos com `price_cents = null` quando o preço está pendente. O pedido segue barrado no banco (`create_order` → `CK015`).

```mermaid
graph TD
    P[app/(site)/page.tsx] -->|rpc| SC[list_cake_showcase<br/>price null se pendente]
    P --> ST[stores: horário, fone, WhatsApp]
    P --> VM[listVitrineMenu × lojas]
    P --> H[Hero · Faixa · Bolos · Lojas · Cakelovers · Rodapé<br/>server]
    P --> B[HomeBuilder client<br/>calculadora + configurador]
    P --> V[HomeVitrine client<br/>loja + abas]
    P --> A[Assistant client<br/>lib/assistant.ts regras]
    B & V -->|useCart| C[(carrinho localStorage)]
    B -->|sem preço| W[wa.me da loja]
    C --> CO[/carrinho → checkout → create_order/]
```

---

## Code Reuse Analysis

| Existente | Uso |
|---|---|
| `useCart`, `lib/cart/cart.ts` | Adicionar da vitrine e do configurador; ganha `preferred` (retirada/entrega e dia) para pré-preencher o checkout |
| `suggestCake` (`lib/cake.ts`) | Calculadora do Passo 1 e resposta "bolo para N pessoas" do assistente |
| `listVitrineMenu`, `listStores` (`lib/catalog.ts`) | Vitrine por loja; lojas passam a trazer `whatsapp` |
| `parseStoredHours`, `WEEK_DAYS` | Horário por extenso ("Seg a sáb, 10h às 19h · Dom, 9h às 12h") |
| `whatsappLink`, `formatWhatsapp`, `formatBRL` | Botões de WhatsApp, Cakelovers, bolo sem preço, assistente |
| `productImageUrl`, placeholder | Fotos dos bolos e itens |
| `Logo` (máscara com `currentColor`) | Cabeçalho, abertura, selo, faixa, rodapé |

---

## Data Model — migration `20261003000100_cake_showcase.sql`

`list_cake_showcase() → jsonb` (`security definer`, `stable`, `execute` para anon e authenticated):

```json
[{ "id": "…", "slug": "bolo-ninho-morango", "name": "Bolo Ninho com Morango", "description": "…",
   "price_cents": null, "weights_kg": [1, 1.5, …], "formats": ["Redondo", …], "lead_time_hours": 48,
   "store_ids": [], "featured": false, "cake_of_month": false, "image_path": "seed/bolo-ninho-morango.webp",
   "addons": [{ "id": "…", "name": "Velas", "price_cents": 800 }] }]
```

Só `type = 'bolo_kg'` e `active`. `price_cents` e o preço dos adicionais são sempre reais (adicionais já são públicos); o do bolo vem `null` se `price_pending`. `cake_of_month` = existe destaque ativo `bolo_do_mes` no período apontando para o produto. Ordem: `featured desc, sort, name`.

Tipos em `lib/database.types.ts`. Checagens PGlite: anon executa; pendente vem com `price_cents` nulo; inativo não aparece; `bolo_do_mes` marca o bolo.

---

## Components

### Estilo — `app/(site)/prototype.css`

Porta do `<style>` do protótipo: variáveis mapeadas para os tokens (`--color-*`, `--font-display`, `--font-sans`), `ck-` em todas as classes, keyframes (`draw`, `rise`, `introOut`, `kb`, `bob`, `spin`, `mq`, `bump`, `rv`, `pop`), `prefers-reduced-motion`. Importado pelo layout do site.

### Layout do site — `app/(site)/layout.tsx`

Cabeçalho e rodapé do protótipo: marca, links `/#bolos · /#encomendas · /#vitrine · /#lojas · /#cakelovers` (escondidos abaixo de 860 px, como no protótipo), botão "Pedido" pêssego com contagem (`CartButton`, `id="cart-button"`, pulso ao adicionar). Rodapé: logo, "Navegue", "Lojas" (endereços do banco), linha legal com "Política de privacidade" → `/privacidade`. `Toast` global montado aqui.

### Home — `components/site/home/`

| Componente | Tipo | Conteúdo |
|---|---|---|
| `intro.tsx` | server | Abertura (CSS puro, `aria-hidden`, some sozinha) |
| `hero.tsx` | server + `parallax.tsx` client | Texto AD-012, CTAs, meta, arco com `next/image` `priority`, 4 doces, selo SVG, "Imagem ilustrativa" |
| `marquee.tsx` | server | Faixa pêssego |
| `cakes-showcase.tsx` | server + `pick-cake-button.tsx` client | Até 3 bolos; "Montar este" dispara `cake67:pick-cake` e rola até o configurador |
| `home-builder.tsx` | client | Passo 1 (calculadora) e Passo 2 (sabor, peso, formato, adicionais, retirada, data, total animado); com preço → carrinho (+ `preferred`); sem preço → "Pedir pelo WhatsApp" com a mensagem montada |
| `home-vitrine.tsx` | client | Loja + abas + itens de todas as lojas vindos do servidor; "Adicionar" usa `useCart` + `flyToCart` + toast |
| `stores-section.tsx` | server | Aquarelas + lojas do banco com horário por extenso e WhatsApp |
| `cakelovers.tsx` | server | Visual do protótipo; "Quero participar" → WhatsApp da primeira loja |
| `assistant.tsx` | client | FAB + painel do protótipo; respostas de `lib/assistant.ts` |

Imagens decorativas do protótipo (arco, doces, aquarelas, cartão Cakelovers) copiadas para `public/home/`.

### Lógica pura (unit tests)

| Arquivo | Conteúdo |
|---|---|
| `lib/store-hours.ts` | `describeHours(hours)` agrupa dias seguidos com o mesmo horário: "Seg a sáb, 10h às 19h · Dom, 9h às 12h"; minutos só quando ≠ 00 ("10h30") |
| `lib/assistant.ts` | `answerQuestion(text, data)` → `{ text, action?: "vitrine" \| "calc" \| "cfg" \| "lojas", whatsapp?: string }` com as regras da spec; número de pessoas extraído do texto; nunca inventa valor (sem dado → "em breve"/WhatsApp) |
| `lib/cake-order.ts` | `minCakeDate(today, leadHours)`, `cakeWhatsappMessage(...)` para o bolo sem preço |
| `lib/cart/cart.ts` (+) | `preferred` no carrinho: parse, set; checkout usa para iniciar retirada/entrega e o dia |

---

## Error Handling

| Cenário | Tratamento |
|---|---|
| Sem bolos | Seções Bolos e Encomendas somem; hero aponta "Encomendar" para `/encomendas` |
| Loja sem itens na vitrine | "Nenhum produto na vitrine desta loja no momento." |
| Bolo sem preço | Total "Preço em breve", botão WhatsApp; `create_order` barra por garantia |
| Data antes da antecedência | Campo `min` + checkout valida de novo (`CK013`) |
| JS desligado | Conteúdo estático do servidor; abas mostram a primeira categoria da primeira loja |

---

## Testes

| Tipo | Cobre |
|---|---|
| Unit | `describeHours`, `answerQuestion` (8 regras + fallback, número de pessoas, preço em breve), `minCakeDate`, `cakeWhatsappMessage`, `preferred` no carrinho |
| PGlite | `list_cake_showcase` (anon, preço nulo se pendente, inativo fora, bolo do mês) + etapas 01–06 |
| Integração | anon chama `list_cake_showcase` no projeto e não recebe preço de bolo pendente |
| Navegador | Lado a lado com `cake67.vercel.app` (1280 e 375 px); vitrine → carrinho → checkout com item real; bolo sem preço → WhatsApp; assistente nas 4 sugestões; 360 px; Lighthouse da home |

---

## Tech Decisions

| Decisão | Escolha | Motivo |
|---|---|---|
| Fidelidade visual | CSS do protótipo portado com prefixo | Reproduz exatamente; Tailwind segue no resto do site |
| Bolo sem preço | Função `security definer` com preço nulo | Não relaxa o RLS nem expõe o preço provisório |
| Vitrine por loja | Servidor carrega todas as lojas (2) | Troca instantânea, sem rota nova |
| Assistente | Regras sobre dados reais | Sem custo nem risco de resposta inventada |
| Carrinho | Botão leva a `/carrinho` | Checkout real já existe; gaveta fora do escopo |
