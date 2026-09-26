-- Cake 67 · initial data (SPEC §9). Idempotent: every insert ignores
-- existing rows, so re-running never duplicates nor overwrites panel edits.
-- Photos and the admin user are seeded by scripts/seed.ts.

-- stores ---------------------------------------------------------------

insert into public.stores (slug, name, address, phone, whatsapp, hours, sort) values
  (
    'estiva', 'Loja 1', 'Rua Estiva, 200', '(67) 3026-8816', '5567981519796',
    '{
      "mon": {"open": "10:00", "close": "19:00"},
      "tue": {"open": "10:00", "close": "19:00"},
      "wed": {"open": "10:00", "close": "19:00"},
      "thu": {"open": "10:00", "close": "19:00"},
      "fri": {"open": "10:00", "close": "19:00"},
      "sat": {"open": "10:00", "close": "19:00"},
      "sun": {"open": "09:00", "close": "12:00"}
    }',
    1
  ),
  (
    -- PROVISIONAL WhatsApp: menu shows (67) 9625-8783, one digit short (SPEC §12).
    'afonso-pena', 'Loja 2', 'Av. Afonso Pena, 2716', '(67) 3029-3039', '556796258783',
    '{
      "mon": {"open": "10:30", "close": "18:00"},
      "tue": {"open": "10:30", "close": "18:00"},
      "wed": {"open": "10:30", "close": "18:00"},
      "thu": {"open": "10:30", "close": "18:00"},
      "fri": {"open": "10:30", "close": "18:00"},
      "sat": {"open": "10:00", "close": "17:30"},
      "sun": null
    }',
    2
  )
on conflict (slug) do nothing;

-- categories -----------------------------------------------------------

insert into public.categories (slug, name, kind, sort) values
  ('fatias', 'Fatias', 'vitrine', 1),
  ('potes', 'Potes', 'vitrine', 2),
  ('croissants', 'Croissants', 'vitrine', 3),
  ('docinhos', 'Docinhos', 'vitrine', 4),
  ('bolos', 'Bolos por kg', 'encomenda', 10),
  ('cento', 'Salgados e doces por cento', 'encomenda', 11),
  ('kits', 'Kits festa', 'encomenda', 12)
on conflict (slug) do nothing;

-- vitrine products (prices from the prototype menu) --------------------

insert into public.products (category_id, slug, name, description, type, price_cents, sort)
select c.id, v.slug, v.name, v.description, 'vitrine', v.price_cents, v.sort
from (values
  ('fatias', 'fatia-karen', 'Fatia Karen', 'Massa amanteigada de chocolate, recheio trufado de maracujá e crumble de chocolate', 2200, 1),
  ('fatias', 'cheesecake', 'Cheesecake', 'Frutas vermelhas, abacaxi ou Nutella', 2700, 2),
  ('fatias', 'cookie-recheado-nutella', 'Cookie recheado com Nutella', 'Fatia para consumir morna', 2700, 3),
  ('fatias', 'crunch-cake', 'Crunch Cake', 'Bolo úmido com brigadeiro e cobertura de Nutella crocante', 2490, 4),
  ('potes', 'copo-da-felicidade', 'Copo da Felicidade', 'Kinder Brownie, Twix ou pistache com frutas vermelhas', 2500, 1),
  ('potes', 'tiramissu', 'Tiramissú', 'Biscoito com café, creme de cream cheese e cacau', 2000, 2),
  ('potes', 'bombom-aberto', 'Bombom Aberto', 'Brigadeiro de Ninho, ganache com Nutella e bombom', 2200, 3),
  ('potes', 'banoffee', 'Banoffee', 'Banana, doce de leite cremoso e chantilly', 1800, 4),
  ('potes', 'copo-palha', 'Copo Palha', 'Biscoito e brigadeiro molinho, Ninho e Nutella', 1600, 5),
  ('potes', 'bombom-aberto-frutas', 'Bombom Aberto de Frutas', 'Brigadeiro de Ninho, frutas frescas e ganache', 2000, 6),
  ('croissants', 'croissant-ninho-morango', 'Croissant Ninho com Morango', 'Brigadeiro cremoso de Ninho e morangos', 2800, 1),
  ('croissants', 'croissant-frango', 'Croissant de Frango', 'Frango cremoso, requeijão e muçarela', 2490, 2),
  ('croissants', 'croissant-costela', 'Croissant Costela Cremosa', 'Costela desfiada com requeijão e muçarela', 2490, 3),
  ('croissants', 'croissant-4-queijos', 'Croissant 4 Queijos', 'Requeijão, muçarela, parmesão e gorgonzola', 2290, 4),
  ('croissants', 'croissant-caprese', 'Croissant Caprese', 'Tomate cereja, folhas, muçarela e pesto', 2290, 5),
  ('croissants', 'croissant-presunto-queijo', 'Croissant Presunto e Queijo', 'Requeijão, presunto e muçarela derretida', 2000, 6),
  ('docinhos', 'coxinha-morango', 'Coxinha de Morango', 'Brigadeiro, coco ou Ninho', 1000, 1),
  ('docinhos', 'coxinha-ninho-nutella', 'Coxinha Ninho com Nutella', 'Ninho com Nutella ou Ferrero', 1200, 2),
  ('docinhos', 'coxinha-pistache', 'Coxinha de Pistache', 'Brigadeiro de pistache com morango', 1500, 3),
  ('docinhos', 'morango-do-amor', 'Morango do Amor', 'Brigadeiro branco e caramelo crocante', 1500, 4)
) as v (category, slug, name, description, price_cents, sort)
join public.categories c on c.slug = v.category
on conflict (slug) do nothing;

-- cakes by kg: PROVISIONAL prices (prototype marks them as illustrative) -

insert into public.products (
  category_id, slug, name, description, type, price_cents, price_pending,
  sort, lead_time_hours, weights_kg, formats
)
select
  c.id, v.slug, v.name, v.description, 'bolo_kg', v.price_cents, true,
  v.sort, 48,
  array(select w from generate_series(1, 8, 0.5) as w where w >= v.min_kg)::numeric(4, 1)[],
  '{Redondo,Retangular,Régua}'
from (values
  ('bolo-ninho-morango', 'Bolo Ninho com Morango', 'Massa branca, creme de leite Ninho, morangos frescos e farofa caramelizada por cima.', 10990, 1, 1.0),
  ('bolo-brigadeiro-morango', 'Bolo Brigadeiro com Morango', 'Massa de chocolate, creme de Ninho com morango e fileiras de brigadeiro no topo.', 11490, 2, 1.0),
  ('bolo-pistache-frutas-vermelhas', 'Bolo Pistache com Frutas Vermelhas', 'Creme de pistache, geleia de frutas vermelhas e topo de mirtilo, framboesa e cereja.', 13990, 3, 1.5),
  ('bolo-prestigio', 'Bolo Prestígio', '', 9990, 4, 1.0),
  ('bolo-red-velvet', 'Bolo Red Velvet', '', 11990, 5, 1.0)
) as v (slug, name, description, price_cents, sort, min_kg)
join public.categories c on c.slug = 'bolos'
on conflict (slug) do nothing;

-- cento and kit: placeholders, inactive until real data arrives ---------

insert into public.products (
  category_id, slug, name, description, type, price_cents, price_pending,
  active, min_qty, step_qty, kit_contents
)
select c.id, v.slug, v.name, v.description, v.type::public.product_type, 0, true,
  false, v.min_qty, v.step_qty, v.kit_contents
from (values
  ('cento', 'cento-exemplo', 'Cento (exemplo)', 'Item de exemplo. Cadastre os itens reais pelo painel.', 'cento', 25, 25, null),
  ('kits', 'kit-festa-exemplo', 'Kit festa (exemplo)', 'Item de exemplo. Cadastre os kits reais pelo painel.', 'kit', null, null, 'A definir')
) as v (category, slug, name, description, type, min_qty, step_qty, kit_contents)
join public.categories c on c.slug = v.category
on conflict (slug) do nothing;

-- cake addons ----------------------------------------------------------

insert into public.addons (name, price_cents, sort) values
  ('Topo personalizado', 2500, 1),
  ('Foto em papel de arroz', 3000, 2),
  ('Velas', 800, 3),
  ('Frutas extras', 2200, 4)
on conflict (name) do nothing;

insert into public.product_addons (product_id, addon_id)
select p.id, a.id
from public.products p
cross join public.addons a
where p.type = 'bolo_kg'
on conflict do nothing;

-- photos (files uploaded to bucket "produtos" by scripts/seed.ts) ------

insert into public.product_images (product_id, path, alt)
select p.id, 'seed/' || v.file, p.name
from (values
  ('fatia-karen', 'fatia-karen.webp'),
  ('cheesecake', 'cheesecake.webp'),
  ('cookie-recheado-nutella', 'cookie-nutella.webp'),
  ('crunch-cake', 'crunch-cake.webp'),
  ('copo-da-felicidade', 'copo-felicidade.webp'),
  ('tiramissu', 'tiramissu.webp'),
  ('bombom-aberto', 'pote-bombom.webp'),
  ('banoffee', 'banoffee.webp'),
  ('copo-palha', 'copo-palha.webp'),
  ('bombom-aberto-frutas', 'bombom-aberto.webp'),
  ('croissant-ninho-morango', 'croissant-ninho.webp'),
  ('croissant-frango', 'cro-frango.webp'),
  ('croissant-costela', 'cro-costela.webp'),
  ('croissant-4-queijos', 'cro-4queijos.webp'),
  ('croissant-caprese', 'cro-caprese.webp'),
  ('croissant-presunto-queijo', 'cro-presunto.webp'),
  ('coxinha-morango', 'coxinha-morango.webp'),
  ('coxinha-ninho-nutella', 'coxinha-nutella.webp'),
  ('coxinha-pistache', 'coxinha-pistache.webp'),
  ('morango-do-amor', 'morango-amor.webp'),
  ('bolo-ninho-morango', 'bolo-ninho-morango.webp'),
  ('bolo-brigadeiro-morango', 'bolo-brigadeiro.webp'),
  ('bolo-pistache-frutas-vermelhas', 'bolo-pistache.webp')
) as v (slug, file)
join public.products p on p.slug = v.slug
on conflict (product_id, path) do nothing;

-- initial stock: 10 per store, 0 for the items the prototype shows as sold out

insert into public.stock (product_id, store_id, quantity)
select
  p.id,
  s.id,
  case
    when (s.slug, p.slug) in (
      ('estiva', 'cheesecake'),
      ('estiva', 'banoffee'),
      ('estiva', 'morango-do-amor'),
      ('afonso-pena', 'fatia-karen'),
      ('afonso-pena', 'copo-palha'),
      ('afonso-pena', 'croissant-4-queijos')
    ) then 0
    else 10
  end
from public.products p
cross join public.stores s
where p.type = 'vitrine'
on conflict (product_id, store_id) do nothing;

-- settings -------------------------------------------------------------

insert into public.settings (id, reservation_minutes, order_whatsapp_template)
values (
  1,
  120,
  E'Olá, Cake 67! Pedido *{codigo}*\nLoja: {loja}\n{entrega}\n\n{itens}\n\nSubtotal: {subtotal}\nNome: {nome} · WhatsApp: {whatsapp}\n{observacoes}'
)
on conflict (id) do nothing;

-- opening balance movements (see migration 20260928000100_stock) ----------

insert into public.stock_movements
  (product_id, store_id, delta, reason, quantity_after, actor_name, created_at)
select s.product_id, s.store_id, s.quantity, 'ajuste', s.quantity, 'Saldo inicial', s.updated_at
from public.stock s
where s.quantity > 0
  and not exists (
    select 1 from public.stock_movements m
    where m.product_id = s.product_id and m.store_id = s.store_id
  );
