-- Stage 06: editable settings with database checks, privacy policy draft and
-- the admin report (AD-011).

-- settings -------------------------------------------------------------------

-- Draft written from what the system actually collects; stays marked as
-- provisional until the client checks "Texto revisado pela Cake 67".
alter table public.settings
  add column privacy_reviewed boolean not null default false,
  alter column privacy_text set default $policy$Esta política explica como a Cake 67 trata os dados pessoais informados nos pedidos feitos pelo site.

Quais dados coletamos: nome, WhatsApp, retirada ou entrega, endereço de entrega (se você escolher entrega), observações do pedido e, se você pedir nota fiscal, CPF ou CNPJ. O site não pede conta, senha nem dados de pagamento.

Para que usamos: registrar e preparar o seu pedido, conversar com você pelo WhatsApp para combinar pagamento, retirada ou entrega, e emitir a nota fiscal quando solicitada. A base é a execução do pedido que você fez e o cumprimento de obrigações fiscais.

Com quem compartilhamos: a equipe da loja escolhida vê o pedido no painel interno. O resumo do pedido é enviado pelo WhatsApp a partir do seu próprio aparelho. O CPF ou CNPJ pode ser repassado à contabilidade para emitir a nota. Não vendemos nem cedemos seus dados para publicidade.

Onde ficam e por quanto tempo: os dados ficam em serviços de hospedagem e banco de dados contratados pela Cake 67, com acesso restrito à equipe. Guardamos o histórico de pedidos pelo tempo necessário ao atendimento e às obrigações fiscais e contábeis.

O carrinho fica guardado apenas no seu aparelho até você concluir ou limpar o pedido. O site não usa cookies de publicidade.

Seus direitos: você pode pedir para confirmar, acessar, corrigir ou excluir seus dados, ressalvado o que a lei obriga a guardar. Fale com a loja pelo WhatsApp informado no site.$policy$;

update public.settings set privacy_text = default where privacy_text = '';

alter table public.settings
  drop constraint settings_reservation_minutes_check,
  add constraint settings_reservation_minutes_check check (reservation_minutes between 15 and 1440),
  add constraint settings_template_check check (
    char_length(order_whatsapp_template) <= 2000
    and position('{codigo}' in order_whatsapp_template) > 0
    and position('{itens}' in order_whatsapp_template) > 0
  ),
  add constraint settings_privacy_text_check check (char_length(privacy_text) <= 20000);

create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reservation_minutes', reservation_minutes,
    'order_whatsapp_template', order_whatsapp_template,
    'privacy_text', privacy_text,
    'privacy_reviewed', privacy_reviewed
  )
  from public.settings where id = 1;
$$;

-- report ---------------------------------------------------------------------

-- Orders placed between two Campo Grande dates (inclusive). Revenue counts
-- orders that reached confirmation; cancelled, expired and new are separate.
create function public.report_summary(p_from date, p_to date, p_store_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'report is admin only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 400 then
    raise exception 'invalid period' using errcode = 'CK011', detail = 'period';
  end if;

  with scoped as (
    select o.id, o.store_id, o.status, o.subtotal_cents,
           (o.created_at at time zone 'America/Campo_Grande')::date as day,
           o.status in ('confirmado', 'em_producao', 'pronto', 'entregue') as counted
    from public.orders o
    where (o.created_at at time zone 'America/Campo_Grande')::date between p_from and p_to
      and (p_store_id is null or o.store_id = p_store_id)
  ),
  totals as (
    select
      count(*) filter (where counted) as orders,
      coalesce(sum(subtotal_cents) filter (where counted), 0) as revenue,
      count(*) filter (where status = 'cancelado') as cancelled,
      coalesce(sum(subtotal_cents) filter (where status = 'cancelado'), 0) as cancelled_cents,
      count(*) filter (where status = 'expirado') as expired,
      coalesce(sum(subtotal_cents) filter (where status = 'expirado'), 0) as expired_cents,
      count(*) filter (where status = 'novo') as pending,
      coalesce(sum(subtotal_cents) filter (where status = 'novo'), 0) as pending_cents
    from scoped
  ),
  by_day as (
    select day, count(*) as orders, sum(subtotal_cents) as revenue
    from scoped where counted group by day
  ),
  by_store as (
    select s.id, s.name, s.sort, count(*) as orders, sum(sc.subtotal_cents) as revenue
    from scoped sc join public.stores s on s.id = sc.store_id
    where sc.counted
    group by s.id, s.name, s.sort
  ),
  lines as (
    select coalesce(i.product_id::text, 'snapshot:' || i.name_snapshot) as key,
           i.product_id, i.name_snapshot, i.type, i.qty, i.total_cents,
           -- bolo_kg lines are one cake each; the weight goes to kg
           case when i.type = 'bolo_kg' then (i.options ->> 'weight_kg')::numeric end as kg
    from public.order_items i join scoped sc on sc.id = i.order_id
    where sc.counted
  ),
  top as (
    select l.key,
           coalesce(max(p.name), max(l.name_snapshot)) as name,
           max(l.type::text) as type,
           max(l.product_id::text) as product_id,
           sum(case when l.type = 'bolo_kg' then 1 else l.qty end) as units,
           sum(l.kg) as kg,
           sum(l.total_cents) as revenue
    from lines l left join public.products p on p.id = l.product_id
    group by l.key
    order by units desc, revenue desc, name
    limit 10
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'orders', t.orders,
        'revenue_cents', t.revenue,
        'avg_ticket_cents', case when t.orders > 0 then round(t.revenue::numeric / t.orders)::integer end,
        'cancelled', jsonb_build_object('count', t.cancelled, 'cents', t.cancelled_cents),
        'expired', jsonb_build_object('count', t.expired, 'cents', t.expired_cents),
        'pending', jsonb_build_object('count', t.pending, 'cents', t.pending_cents)
      ) from totals t
    ),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'orders', d.orders, 'revenue_cents', d.revenue) order by d.day)
      from by_day d
    ), '[]'::jsonb),
    'by_store', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store_id', b.id, 'name', b.name, 'orders', b.orders, 'revenue_cents', b.revenue,
        'avg_ticket_cents', round(b.revenue::numeric / b.orders)::integer
      ) order by b.sort, b.name)
      from by_store b
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', tp.product_id, 'name', tp.name, 'type', tp.type,
        'units', tp.units, 'kg', tp.kg, 'revenue_cents', tp.revenue
      ) order by tp.units desc, tp.revenue desc, tp.name)
      from top tp
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.report_summary(date, date, uuid) from public, anon;
grant execute on function public.report_summary(date, date, uuid) to authenticated;
