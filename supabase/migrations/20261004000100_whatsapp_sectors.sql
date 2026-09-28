-- Stage 08: one WhatsApp per store sector (ready-made, made-to-order, support)
-- and the message the panel sends when an order is confirmed.
--
-- stores.whatsapp stays (nullable, unused by the new code) so the deployed
-- site keeps working between this migration and the merge. A later migration
-- drops it.

-- stores ---------------------------------------------------------------

alter table public.stores
  add column whatsapp_ready text,
  add column whatsapp_made_to_order text,
  add column whatsapp_support text;

-- Numbers given by the client on 2026-09-28 (spec 08). Fixes the provisional
-- Loja 2 number (SPEC §12).
update public.stores
set whatsapp_ready = '5567998272300', whatsapp_made_to_order = '5567981519796', whatsapp_support = '5567993285925'
where slug = 'estiva';
update public.stores
set whatsapp_ready = '5567999873946', whatsapp_made_to_order = '5567996258783', whatsapp_support = '5567996197916',
    whatsapp = '5567996258783'
where slug = 'afonso-pena';
-- Any other store keeps its single number in every sector until edited.
update public.stores
set whatsapp_ready = coalesce(whatsapp_ready, whatsapp),
    whatsapp_made_to_order = coalesce(whatsapp_made_to_order, whatsapp),
    whatsapp_support = coalesce(whatsapp_support, whatsapp);

alter table public.stores
  alter column whatsapp drop not null,
  alter column whatsapp_ready set not null,
  alter column whatsapp_made_to_order set not null,
  alter column whatsapp_support set not null,
  add constraint stores_whatsapp_ready_check check (whatsapp_ready ~ '^55[0-9]{10,11}$'),
  add constraint stores_whatsapp_made_to_order_check check (whatsapp_made_to_order ~ '^55[0-9]{10,11}$'),
  add constraint stores_whatsapp_support_check check (whatsapp_support ~ '^55[0-9]{10,11}$');

-- settings -------------------------------------------------------------

alter table public.settings
  add column confirmation_whatsapp_template text not null default
    E'Olá, {nome}! Seu pedido *{codigo}* foi confirmado pela Cake 67.\n{entrega}\nLoja: {loja}\n\nAcompanhe aqui: {link}',
  add constraint settings_confirmation_template_check check (
    char_length(confirmation_whatsapp_template) <= 2000
    and position('{codigo}' in confirmation_whatsapp_template) > 0
    and position('{link}' in confirmation_whatsapp_template) > 0
  );

-- public order ---------------------------------------------------------

-- store.whatsapp is the sector that handles the order: any made-to-order
-- item sends it to made-to-order, otherwise ready-made (spec 08, D1).
create or replace function public.get_order_public(p_code text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_store public.stores;
begin
  perform public.expire_orders();

  select * into v_order from public.orders where code = p_code and public_token = p_token;
  if v_order.id is null then
    return null;
  end if;
  select * into v_store from public.stores where id = v_order.store_id;

  return jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'expires_at', v_order.expires_at,
    'fulfillment', v_order.fulfillment,
    'delivery_address', v_order.delivery_address,
    'scheduled_for', v_order.scheduled_for,
    'customer_name', v_order.customer_name,
    'customer_whatsapp', v_order.customer_whatsapp,
    'notes', v_order.notes,
    'subtotal_cents', v_order.subtotal_cents,
    'has_made_to_order', v_order.has_made_to_order,
    'store', jsonb_build_object(
      'name', v_store.name,
      'address', v_store.address,
      'whatsapp', case when v_order.has_made_to_order then v_store.whatsapp_made_to_order else v_store.whatsapp_ready end,
      'support_whatsapp', v_store.whatsapp_support
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', i.name_snapshot, 'type', i.type, 'qty', i.qty,
               'unit_price_cents', i.unit_price_cents, 'total_cents', i.total_cents, 'options', i.options)
             order by i.position), '[]'::jsonb)
      from public.order_items i where i.order_id = v_order.id
    )
  );
end;
$$;
