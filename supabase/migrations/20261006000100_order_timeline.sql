-- Stage 09: the public order carries its status history for the timeline.
-- Same signature and grants; only adds the "events" key.

-- store.whatsapp is the sector that handles the order (spec 08, D1).
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
    ),
    -- Status history for the timeline: no actor, from_status or note (the
    -- cancel reason is internal).
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at) order by e.id), '[]'::jsonb)
      from public.order_events e where e.order_id = v_order.id
    )
  );
end;
$$;
