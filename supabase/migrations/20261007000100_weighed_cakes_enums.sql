-- Stage 10 · whole cakes sold by weight in the showcase (AD-018).
-- Enum values live in their own migration: a value added by ALTER TYPE can
-- only be used after the transaction that added it commits.

alter type public.product_type add value 'vitrine_kg';
alter type public.stock_reason add value 'descarte';
alter type public.stock_reason add value 'correcao_peso';

create type public.piece_status as enum ('disponivel', 'reservado', 'vendido', 'descartado');
