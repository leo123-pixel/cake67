# 11 · Taxa de entrega calculada no site (Juma) — Design

**Spec**: `.specs/features/11-delivery-fee/spec.md`
**Status**: Approved (2026-11-11)

## Visão geral

```
checkout (navegador)
  │  rua, número, bairro (+ complemento, referência)
  ▼
quoteDelivery()  ── Server Action ──► lib/delivery/quote.ts (server-only)
                                        │ 1. lê a loja (endereço + categoria)
                                        │ 2. reaproveita cálculo recente (delivery_quotes)
                                        │ 3. senão chama a Juma (Machine, Entregas v2)
                                        │ 4. grava o resultado em delivery_quotes (service role)
                                        ▼
                                   { feeCents } ou "a combinar"
placeOrder()  ── refaz o passo acima (normalmente reaproveita) ──► create_order(p_customer.delivery_quote_id)
                                                                      │ confere loja, endereço e idade do cálculo
                                                                      ▼
                                                              orders.delivery_fee_cents
```

A regra "preço nunca vem do navegador" continua: o navegador nunca manda valor de taxa. O servidor grava o cálculo numa tabela que só a service role escreve, e o `create_order` lê a taxa de lá pelo id, conferindo loja, endereço e idade. Quem chamar `create_order` direto só consegue usar um cálculo que existe para aquela loja e aquele endereço; sem id, o pedido sai com taxa a combinar (D4).

## Por que não mexer em `get_order_public` e `report_summary`

As migrations da Stripe (`20261021000100/200`, branch `claude/fervent-franklin-ux8f2g`) já estão aplicadas no projeto e recriaram `get_order_public`, `report_summary`, `cancel_order`, `reactivate_order` e `sync_order_pieces`. Esses arquivos não estão na `main`. Para não desfazer nem depender dessas versões, esta etapa **não recria nenhuma delas**:

- a página do pedido lê a taxa por uma função nova, `get_order_delivery(code, token)`;
- o relatório continua igual (D8: faturamento = subtotal); a taxa por pedido sai no CSV.

`create_order`, `quote_order` e `evaluate_order_lines` não foram tocadas pela Stripe; só `create_order` é recriada aqui, a partir da versão da etapa 10.

## Banco · `20261111000100_delivery_fee.sql`

### `stores`

| Coluna | Tipo | Notas |
|---|---|---|
| `address_street` | text null | rua da loja (origem da entrega), até 120 |
| `address_number` | text null | até 20 |
| `address_district` | text null | bairro, até 80 |
| `delivery_category_id` | text null | id da categoria da Juma (vem como texto) |
| `delivery_category_name` | text null | nome, só para exibir |

Loja sem rua, número, bairro ou categoria → taxa a combinar (D6, D7). A coluna `address` (texto exibido no site) continua.

### `delivery_quotes` (nova)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `store_id` | uuid fk stores | |
| `address_key` | text | `rua|número|bairro` normalizados (minúsculas, espaços colapsados), para reaproveitar |
| `street`, `number`, `district` | text | como digitado |
| `status` | `delivery_quote_status` (`ok`, `falhou`) | |
| `fee_cents` | integer null | obrigatório e entre 1 e 30000 quando `ok` |
| `km`, `minutes` | numeric / integer null | informativo |
| `category_id` | text | categoria usada |
| `error` | text null | motivo técnico (log), nunca mostrado ao cliente |
| `created_at` | timestamptz | |

RLS ligado e **sem política**: só a service role lê e escreve (GRANT só para `service_role`). Índice `(store_id, address_key, created_at desc)`.

### `orders`

| Coluna | Tipo | Notas |
|---|---|---|
| `delivery_street`, `delivery_number`, `delivery_complement`, `delivery_district`, `delivery_reference` | text null | endereço em campos (D5) |
| `delivery_fee_cents` | integer null | null = a combinar (ou retirada); 0–30000; só com `fulfillment = 'entrega'` |
| `delivery_quote_id` | uuid null fk delivery_quotes | cálculo usado |
| `total_cents` | integer **gerada** | `subtotal_cents + coalesce(delivery_fee_cents, 0)` |

`delivery_address` continua: para pedidos novos é a linha montada a partir dos campos ("Rua X, 123, apto 4 · Bairro Y · ref.: …"), e é o que painel, comanda, mensagem e CSV já mostram. Pedidos antigos seguem com o texto livre e taxa a combinar.

### `create_order` (recriada)

`p_customer` ganha `delivery_street`, `delivery_number`, `delivery_complement`, `delivery_district`, `delivery_reference` e `delivery_quote_id`.

- **Entrega com campos:** rua, número e bairro obrigatórios (`CK011`, detail `delivery_street`/`delivery_number`/`delivery_district`). Monta `delivery_address`.
- **Entrega sem campos (site antigo durante o deploy):** aceita `delivery_address` livre, como hoje, e taxa a combinar. Assim a migration pode ser aplicada antes do merge.
- **`delivery_quote_id` informado:** precisa existir com `status = 'ok'`, mesma loja, criado há no máximo 35 minutos (o servidor usa 30; a folga cobre o tempo entre a checagem e o insert) e mesmos rua/número/bairro normalizados em SQL dos dois lados. Senão, `CK016` (o servidor calcula de novo e devolve o aviso de taxa alterada).
- **Retirada:** ignora endereço e cálculo.

### `get_order_delivery(p_code, p_token)` (nova)

`security definer`, anon pode executar. Devolve `{ delivery_fee_cents, total_cents }` ou null (mesma checagem de código e token do `get_order_public`).

### Mensagem do pedido

Variável nova `{taxa_entrega}` no modelo editável: "Entrega: R$ 12,40\nTotal: R$ 61,20", "Entrega: taxa a combinar" ou vazia (retirada). Linha que fica vazia sai da mensagem. A migration acrescenta `{taxa_entrega}` depois de `Subtotal: {subtotal}` no modelo salvo, se ele tiver essa linha e ainda não tiver a variável. `{entrega}` passa a dizer "Entrega em …" quando a taxa está calculada e mantém "Quero entrega (taxa a combinar)" quando não.

## Juma · `lib/delivery/machine.ts`

API Machine v2 (`docs.machine.global`, seção Entregas). Toda chamada leva `api-key: <chave>` e `Authorization: Basic base64(usuário:senha)`.

| Uso | Chamada |
|---|---|
| Categorias no painel | `GET /configuracoes/categorias?lat=-20.4697&lng=-54.6201` (centro de Campo Grande) |
| Estimativa | `POST /entregas/estimativas` com `endereco_partida` ("Rua, número"), `bairro_partida`, `cidade_partida` "Campo Grande", `estado_partida` "MS", o mesmo para `*_desejado`, e `categoria_id` |

- Funções puras para montar o pedido e ler a resposta (testes unitários); o `fetch` recebe um `AbortSignal` de 8 s.
- `estimativa_valor` vem em reais → `Math.round(valor * 100)`. Zero, negativo, não numérico ou acima de R$ 300 → falha.
- Erros vêm com `success: false` e `errors[{ code, message }]`, quase sempre com status 400; o código e a mensagem vão para `delivery_quotes.error` e para o log.

Variáveis (só servidor, opcionais; sem elas tudo cai em "a combinar"):

```
MACHINE_API_URL=https://api.taximachine.com.br/api/v2/integracao
MACHINE_API_KEY=
MACHINE_USERNAME=
MACHINE_PASSWORD=
```

## Cálculo · `lib/delivery/quote.ts` (server-only)

`getDeliveryQuote(storeId, address)`:

1. Loja ativa com endereço e categoria, e variáveis presentes; senão `{ ok: false, reason: "not_configured" }`.
2. Último cálculo da mesma loja e `address_key`: `ok` com menos de 30 min ou `falhou` com menos de 2 min → reaproveita.
3. Freio: mais de 60 cálculos da loja no último minuto → `{ ok: false }` sem chamar a Juma.
4. Chama a Juma, grava o resultado e devolve `{ ok: true, quoteId, feeCents }` ou `{ ok: false }`.

Server Actions em `app/(site)/actions.ts`:

- `quoteDelivery(storeId, address)` → `{ status: "ok", feeCents } | { status: "a_combinar" }`. O id do cálculo não vai para o navegador.
- `placeOrder(...)`: se for entrega com campos, chama `getDeliveryQuote`; compara com `delivery_fee_seen` (o que o checkout mostrou, só para comparação). Se mudou, devolve `deliveryFeeChanged` com a mensagem da spec e o valor novo, sem criar o pedido. Senão chama `create_order` com o `delivery_quote_id`. `CK016` → calcula de novo e devolve o mesmo aviso.

## Checkout

- "Quero entrega" mostra rua, número, complemento, bairro e referência, mais "Campo Grande - MS".
- Com rua, número e bairro preenchidos, espera 700 ms sem digitação e chama `quoteDelivery`; respostas atrasadas são ignoradas. Enquanto calcula: "Calculando a entrega…".
- Resumo: Subtotal, Entrega (valor, "calculando…" ou "a combinar no WhatsApp") e Total.
- Campo oculto `delivery_fee_seen` com o valor mostrado (`a_combinar` quando não calculou).

## Painel

- **Lojas (admin):** seção "Entrega pela Juma": rua, número, bairro e categoria (lista da Juma; se a Juma não responder, aviso e a categoria salva fica). Situação: "Juma configurada" ou "Entrega com taxa a combinar (Juma não configurada)", com o motivo.
- **Pedido:** endereço, "Taxa de entrega R$ X" ou selo "Taxa a combinar", e Total. A lista mostra o total.
- **Comanda:** taxa e total.
- **CSV de pedidos:** colunas "Taxa de entrega" e "Total" depois de "Subtotal".

## Fora deste design

P2 (atendente digita a taxa combinada) fica para depois: precisa de um registro na linha do tempo que não seja mudança de status, e o `order_events` de hoje só guarda status.
