-- Role helpers used by RLS policies. SECURITY DEFINER so they can read
-- public.staff without recursing into its own policies.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff
    where user_id = auth.uid()
      and active
      and role = 'admin'
  );
$$;

create function public.staff_store()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select store_id
  from public.staff
  where user_id = auth.uid()
    and active;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.staff_store() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.staff_store() to authenticated;
