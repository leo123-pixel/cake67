-- The menu's Régua weighs 2.3 to 2.5 kg and is charged at 2.3 kg; cakes sold
-- as Régua get that weight so create_order accepts it.

update public.products
set weights_kg = array(select distinct w from unnest(weights_kg || 2.3::numeric(4, 1)) as w order by w)
where type = 'bolo_kg'
  and 'Régua' = any(formats)
  and not 2.3 = any(weights_kg);
