#!/usr/bin/env bash
# Sends a webhook shaped like InfinitePay's to the site (README, "Pagamentos").
#
#   scripts/simulate-webhook.sh <order_id> [transaction_nsu] [invoice_slug] [base_url]
#
# The site always asks /payment_check before marking anything as paid, so with
# made-up transaction ids the expected answer is 400 {"outcome":"not_paid"}:
# that is the refusal working. With the transaction_nsu and slug of a real
# payment (they come in the return URL and in the InfinitePay app), the answer
# is 200 {"outcome":"paid"} the first time and 200 {"outcome":"duplicate"}
# after that.
set -euo pipefail

ORDER_ID="${1:?usage: $0 <order_id> [transaction_nsu] [invoice_slug] [base_url]}"
TRANSACTION_NSU="${2:-00000000-0000-4000-8000-000000000000}"
INVOICE_SLUG="${3:-teste-local}"
BASE_URL="${4:-http://localhost:3000}"

curl -sS -i -X POST "$BASE_URL/api/webhooks/infinitepay" \
  -H "Content-Type: application/json" \
  --data @- <<JSON
{
  "invoice_slug": "$INVOICE_SLUG",
  "amount": 100,
  "paid_amount": 100,
  "installments": 1,
  "capture_method": "pix",
  "transaction_nsu": "$TRANSACTION_NSU",
  "order_nsu": "$ORDER_ID",
  "receipt_url": "https://recibo.infinitepay.io/$INVOICE_SLUG",
  "items": [{ "description": "Teste", "quantity": 1, "price": 100 }]
}
JSON
echo
