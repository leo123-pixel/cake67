-- Stage 11 · online payment with Stripe, one account per store (AD-019).
-- Enum types live in their own migration, like stage 10: the next migration
-- uses them in defaults and functions.

-- Summary on orders: list badge, Realtime and the public order page.
create type public.order_payment_status as enum (
  'nenhum',          -- no payment opened (or every attempt ended unpaid)
  'pagando',         -- a Stripe Checkout Session is open
  'pago',
  'devolvendo',      -- refund requested, Stripe has not finished it (Pix may take a while)
  'devolvido',
  'falha_devolucao', -- refund failed, the panel offers a retry
  'conferir'         -- paid with an amount or currency that does not match the order
);

-- One row of order_payments per Checkout Session.
create type public.payment_attempt_status as enum (
  'aberto', 'pago', 'expirado', 'falhou', 'cancelado', 'erro',
  'conferir', 'devolvendo', 'devolvido', 'falha_devolucao'
);
