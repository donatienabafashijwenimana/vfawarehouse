create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.profiles (id, full_name, email, role, status, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'customer',
    'PENDING',
    true
  ) on conflict (id) do nothing;

  insert into public.customers (name, email, user_id)
  values (coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.profiles (id, full_name, email, role, status, email_verified)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      'customer',
      'PENDING',
      true
    )
    on conflict (id) do update
      set email = excluded.email, email_verified = true, updated_at = now();

    insert into public.customers (name, email, user_id)
    select p.full_name, new.email, new.id
    from public.profiles p
    where p.id = new.id and p.role = 'customer'
      and not exists (select 1 from public.customers c where c.user_id = new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Remove abandoned, unverified customer rows from the previous signup flow.
delete from public.customers c
using auth.users u
where c.user_id = u.id and u.email_confirmed_at is null;

delete from public.profiles p
using auth.users u
where p.id = u.id and p.role = 'customer' and u.email_confirmed_at is null
  and not exists (select 1 from public.production_batches x where x.created_by = p.id)
  and not exists (select 1 from public.quality_checks x where x.inspector = p.id)
  and not exists (select 1 from public.stock_movements x where x.created_by = p.id)
  and not exists (select 1 from public.orders x where x.created_by = p.id)
  and not exists (select 1 from public.sales x where x.created_by = p.id)
  and not exists (select 1 from public.payments x where x.confirmed_by = p.id or x.recorded_by = p.id)
  and not exists (select 1 from public.expenses x where x.recorded_by = p.id)
  and not exists (select 1 from public.audit_logs x where x.user_id = p.id)
  and not exists (select 1 from public.archive_files x where x.created_by = p.id);

-- Customer create/update remain permission based; deletion requires manager/delete permission.
drop policy if exists customers_write on public.customers;
create policy customers_insert on public.customers for insert with check (
  has_perm('customers.create')
);
create policy customers_update on public.customers for update using (
  has_perm('customers.update')
) with check (has_perm('customers.update'));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete using (
  has_perm('customers.delete')
);
