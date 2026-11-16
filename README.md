# cake67

Site de pedidos e painel da doceria Cake 67 (Campo Grande - MS). Next.js 15 (App Router) + Supabase, hospedado na Vercel.

A especificação completa está em `.specs/project/SPEC.md`; o estado e as decisões de cada etapa, em `.specs/project/STATE.md`. As regras do repositório estão no `CLAUDE.md`.

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:integration   # contra o projeto Supabase real (precisa do .env.local)
```

## Pagamentos

Pagamento online pelo **Checkout Integrado da InfinitePay** (Pix e cartão de crédito), etapa 12. Spec: `.specs/features/12-infinitepay/`.

### O que paga online e o que continua no WhatsApp

| Pedido | Como finaliza |
| --- | --- |
| Só vitrine, retirada | **Pagar agora** no site (ou "Prefiro combinar no WhatsApp") |
| Só vitrine, entrega com taxa calculada pela Juma | **Pagar agora** no site (total = itens + entrega) |
| Entrega com taxa "a combinar" (a Juma não calculou) | WhatsApp |
| Qualquer encomenda (bolo por kg, cento, kit) | WhatsApp |
| Loja sem conta InfinitePay ou sem chave no servidor | WhatsApp |

Cada loja é um CNPJ e tem a **própria conta InfinitePay**. A primeira ligada é a **Jeribá** (`cake-zsf`).

### Fluxo

1. O cliente envia o pedido. O `create_order` grava o pedido e reserva o estoque da vitrine, como antes.
2. O site chama `POST /api/checkout` com o código e o token do pedido. O servidor:
   - lê o valor no banco (`total_cents`, nunca vindo do navegador);
   - cria o link em `POST https://api.checkout.infinitepay.io/links`, com `single_payment: true`, `valid_until` de 60 minutos, Pix e cartão, e `assured_installments: 0`;
   - grava o `checkout_url` e redireciona o cliente.
3. O cliente paga na página da InfinitePay. A reserva do pedido dura pelo menos até o link vencer (+5 min).
4. A InfinitePay chama o webhook `POST /api/webhooks/infinitepay`. O webhook **não tem assinatura**, então o servidor:
   - grava o corpo bruto em `payment_events`;
   - confirma em `POST /payment_check` (timeout de 700 ms);
   - chama `settle_online_payment` no banco. O banco confere se o `order_nsu` existe e se o `amount` confirmado é o valor cobrado. Um `transaction_nsu` repetido não faz nada (é `UNIQUE`).
   - Respostas: **200** = tratado ou nada a fazer. **400** = tentar de novo (não pago ainda, `payment_check` não respondeu, chave ausente).
5. O cliente clica em "Continuar" e volta por `/api/pagamento/retorno/<código>/<token>`. Os parâmetros dessa URL não são confiáveis: o servidor só os usa para rodar o mesmo `payment_check` (caso o webhook atrase). Depois leva o cliente a `/pedido/<código>`, que mostra o status e o comprovante.
6. O painel avisa em tempo real (som e título da aba) e mostra o selo **Pago**. O pedido continua `novo` até a equipe confirmar: o estoque já estava reservado desde o passo 1, e pagar não mexe no estoque de novo.

Situações especiais (o pagamento vai para **Pagamento a conferir** no painel, com o motivo):

- valor confirmado diferente do cobrado;
- segundo pagamento do mesmo pedido;
- pagamento de pedido cancelado;
- reserva expirada sem estoque.

A API da InfinitePay **não faz estorno**. O estorno é feito pelo App ou pela Conta Web, e o painel avisa ao cancelar um pedido pago.

**Parcelamento:** a InfinitePay não deixa limitar parcelas no link (o cartão mostra até 12x). Com `assured_installments: 0`, os juros do parcelamento ficam com o cliente e a loja recebe o valor cheio. O painel mostra o valor do pedido e o valor pago com juros.

Expiração: o `pg_cron` roda `expire_orders` a cada 5 minutos (e também a cada leitura de pedido). Link vencido vira "Link de pagamento expirado" e o cliente pode gerar outro. Pedido vencido volta o estoque, como sempre.

### Variáveis de ambiente (Vercel, só servidor)

| Variável | Para quê |
| --- | --- |
| `INFINITEPAY_API_KEY_<TAG>` | Chave da conta de cada loja. A tag vai em maiúsculas, com `-` trocado por `_`. Jeribá: `INFINITEPAY_API_KEY_CAKE_ZSF`. |
| `INFINITEPAY_HANDLE` + `INFINITEPAY_API_KEY` | Atalho para uma conta só (vale para a loja com essa InfiniteTag). |
| `NEXT_PUBLIC_PAYMENT_MODE` | `whatsapp` desliga o pagamento online no site inteiro. Vazio ou `infinitepay` = ligado onde houver conta e chave. |
| `NEXT_PUBLIC_SITE_URL` | Base do `redirect_url` e do `webhook_url`. Em produção: `https://www.cake67.com.br`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existia. O webhook e o checkout gravam com ela. |

A InfiniteTag (sem o `$`) é configurada em **Painel → Lojas → (loja) → Pagamento online**. O painel mostra se a loja está **Ativa**, **Sem chave no servidor** (com o nome da variável que falta) ou **Desligada**. A chave nunca vai para o banco, para o navegador nem para `NEXT_PUBLIC_*`.

Para criar a chave: Conta Web ou App InfinitePay → Configurações do Checkout → ativar **Checkout Integrado** → criar API Key (começa com `inchk_` e aparece uma vez só). A chave precisa ser da mesma conta da InfiniteTag, senão a API responde 403.

```bash
vercel env add INFINITEPAY_API_KEY_CAKE_ZSF production
```

Depois de cadastrar a chave, reimplante (`vercel --prod` ou um novo deploy pela `main`).

### webhook_url em produção

A `webhook_url` vai **em cada link criado**, montada a partir de `NEXT_PUBLIC_SITE_URL`: `https://www.cake67.com.br/api/webhooks/infinitepay`. Não há cadastro no painel da InfinitePay. Ela precisa ser **pública e com HTTPS**:

- Em produção (`www.cake67.com.br`) funciona direto.
- Os previews da Vercel pedem login (Deployment Protection) e a InfinitePay recebe 401. Para testar num preview, use a Protection Bypass for Automation da Vercel ou teste em produção.
- `localhost` não recebe webhook. Use o retorno (passo 5), que confirma sozinho, ou um túnel HTTPS (`cloudflared tunnel --url http://localhost:3000`) com `NEXT_PUBLIC_SITE_URL` apontando para ele.
- Um link guarda a `webhook_url` de quando foi criado. Se o domínio mudar, os links abertos continuam avisando o endereço antigo por até 60 minutos.

### Testar com um link real de R$ 1,00

A InfinitePay não tem sandbox. O teste é uma compra real de valor baixo (mínimo R$ 1,00), estornada depois.

1. Ponha a chave da Jeribá na Vercel (produção) e reimplante.
2. No painel, crie um produto de vitrine de teste a **R$ 1,00**, só na Jeribá, com estoque 1.
3. No site, escolha a Jeribá, coloque o produto no carrinho, retirada, **Pagar agora**.
4. Pague com Pix. Ao clicar em "Continuar", a página do pedido deve mostrar **Pagamento recebido**.
5. Confira:
   - no painel, o pedido tem o selo **Pago**, a forma, o valor e o comprovante;
   - o **Registro da InfinitePay** mostra `link_created`, `received` e `settled_ok`;
   - a resposta completa do `/links` aparece nos logs da Vercel (`infinitepay /links`).
6. Cancele o pedido no painel, estorne pelo App InfinitePay e apague o produto de teste.

### Simular o webhook localmente

Com `npm run dev` rodando e um pedido que já abriu o link (o id do pedido está na URL do painel):

```bash
scripts/simulate-webhook.sh <id-do-pedido>
```

Com transações inventadas, a resposta esperada é `400 {"outcome":"not_paid"}`: o `payment_check` diz que não foi pago e nada muda. É a recusa funcionando. Passando o `transaction_nsu` e o `slug` de um pagamento real (estão na URL de retorno e no App), a primeira chamada responde `200 {"outcome":"paid"}` e as seguintes `200 {"outcome":"duplicate"}`.

```bash
scripts/simulate-webhook.sh <id-do-pedido> <transaction_nsu> <slug> https://www.cake67.com.br
```

Os testes que não dependem da InfinitePay estão em `tests/unit/infinitepay.test.ts` e `tests/unit/payments-webhook.test.ts` (`npm run test`), e as regras no banco estão em `tests/integration/payments.test.ts` (`npm run test:integration`).
