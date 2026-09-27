-- Cake 67 · schema (SPEC §4). Money in cents, timestamps in timestamptz.

create type public.category_kind as enum ('vitrine', 'encomenda');
create type public.product_type as enum ('vitrine', 'bolo_kg', 'cento', 'kit');
create type public.stock_reason as enum ('ajuste', 'reserva', 'devolucao', 'venda');
create type public.order_status as enum (
  'novo', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado', 'expirado'
);
create type public.fulfillment as enum ('retirada', 'entrega');
create type public.staff_role as enum ('admin', 'atendente');
create type public.highlight_slot as enum ('bolo_do_mes', 'combo_semana', 'banner');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- stores ---------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text not null,
  phone text,
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  -- { "mon": { "open": "10:00", "close": "19:00" }, ... }; missing or null day = closed
  hours jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- catalog --------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind public.category_kind not null,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text not null default '',
  type public.product_type not null,
  -- vitrine: unit · bolo_kg: per kg · cento: per hundred · kit: per kit
  price_cents integer not null check (price_cents >= 0),
  price_pending boolean not null default false,
  active boolean not null default true,
  featured boolean not null default false,
  sort integer not null default 0,
  min_qty integer check (min_qty > 0),
  step_qty integer check (step_qty > 0),
  lead_time_hours integer not null default 48 check (lead_time_hours >= 0),
  weights_kg numeric(4, 1)[] not null default '{}',
  formats text[] not null default '{}',
  kit_contents text,
  -- empty = sold in every store
  store_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cento_requires_quantities check (
    type <> 'cento' or (min_qty is not null and step_qty is not null)
  )
);

create index products_category_idx on public.products (category_id, sort);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  alt text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, path)
);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_addons (
  product_id uuid not null references public.products (id) on delete cascade,
  addon_id uuid not null references public.addons (id) on delete cascade,
  primary key (product_id, addon_id)
);

-- stock (vitrine products only) ----------------------------------------

create table public.stock (
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, store_id)
);

-- orders ---------------------------------------------------------------

create sequence public.order_code_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'C67-' || lpad(nextval('public.order_code_seq')::text, 6, '0'),
  public_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  store_id uuid not null references public.stores (id) on delete restrict,
  status public.order_status not null default 'novo',
  expires_at timestamptz,
  customer_name text not null,
  customer_whatsapp text not null,
  notes text,
  fulfillment public.fulfillment not null,
  delivery_address text,
  scheduled_for timestamptz,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  has_made_to_order boolean not null default false,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint made_to_order_requires_schedule check (
    not has_made_to_order or scheduled_for is not null
  )
);

alter sequence public.order_code_seq owned by public.orders.code;

create index orders_store_created_idx on public.orders (store_id, created_at desc);
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'novo';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  type public.product_type not null,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  -- weight, format, addons, flavor, message
  options jsonb not null default '{}'::jsonb
);

create index order_items_order_idx on public.order_items (order_id);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason public.stock_reason not null,
  order_id uuid references public.orders (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_store_created_idx
  on public.stock_movements (store_id, created_at desc);

-- staff ----------------------------------------------------------------

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.staff_role not null,
  store_id uuid references public.stores (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendant_requires_store check (role = 'admin' or store_id is not null)
);

-- home highlights ------------------------------------------------------

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  slot public.highlight_slot not null,
  product_id uuid references public.products (id) on delete set null,
  title text not null,
  subtitle text,
  image_path text,
  cta_label text,
  cta_href text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint highlight_period check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- settings (single row) ------------------------------------------------

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  reservation_minutes integer not null default 120 check (reservation_minutes > 0),
  order_whatsapp_template text not null,
  privacy_text text not null default '',
  updated_at timestamptz not null default now()
);

-- updated_at triggers --------------------------------------------------

create trigger set_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.addons
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stock
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.highlights
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- RLS on every table; policies live in a later migration ---------------

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.addons enable row level security;
alter table public.product_addons enable row level security;
alter table public.stock enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.staff enable row level security;
alter table public.highlights enable row level security;
alter table public.settings enable row level security;
