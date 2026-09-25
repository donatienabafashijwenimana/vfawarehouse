alter table public.profiles
  add column if not exists email_verified boolean not null default false;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('ACTIVE', 'INACTIVE', 'PENDING'));
alter table public.profiles alter column status set default 'PENDING';

update public.profiles p
set email_verified = (u.email_confirmed_at is not null),
    status = case
      when p.role = 'customer' and u.email_confirmed_at is null then 'PENDING'
      else p.status
    end
from auth.users u
where u.id = p.id;

insert into public.customers (name, email, user_id)
select p.full_name, u.email, p.id
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'customer'
  and u.email_confirmed_at is not null
  and not exists (select 1 from public.customers c where c.user_id = p.id);

create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles
  where id = auth.uid() and status = 'ACTIVE' and email_verified;
$$;

create or replace function public.current_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(permissions, '{}'::text[]) from public.profiles
  where id = auth.uid() and status = 'ACTIVE' and email_verified;
$$;

create or replace function public.has_perm(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'manager' and status = 'ACTIVE' and email_verified
     from public.profiles where id = auth.uid()), false
  ) or p_code = any (
    coalesce((select permissions from public.profiles
      where id = auth.uid() and status = 'ACTIVE' and email_verified), '{}'::text[])
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, status, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'customer',
    'PENDING',
    new.email_confirmed_at is not null
  );
  if new.email_confirmed_at is not null then
    insert into public.customers (name, email, user_id)
    values (coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_email_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set email_verified = true, updated_at = now()
    where id = new.id;
    insert into public.customers (name, email, user_id)
    select p.full_name, new.email, new.id
    from public.profiles p
    where p.id = new.id and p.role = 'customer'
      and not exists (select 1 from public.customers c where c.user_id = new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_verified();

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select using (
  is_staff_or_manager() or (current_role_name() = 'customer' and user_id = auth.uid())
);

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (
  is_staff_or_manager() or exists (
    select 1 from public.customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = orders.customer_id
  )
);
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert with check (
  is_staff_or_manager() or exists (
    select 1 from public.customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = orders.customer_id
  )
);

drop policy if exists orderitems_select on public.order_items;
create policy orderitems_select on public.order_items for select using (
  is_staff_or_manager() or exists (
    select 1 from public.orders o join public.customers c on c.id = o.customer_id
    where current_role_name() = 'customer' and o.id = order_items.order_id and c.user_id = auth.uid()
  )
);

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select using (
  is_staff_or_manager() or exists (
    select 1 from public.customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = sales.customer_id
  )
);
drop policy if exists saleitems_select on public.sale_items;
create policy saleitems_select on public.sale_items for select using (
  is_staff_or_manager() or exists (
    select 1 from public.sales s join public.customers c on c.id = s.customer_id
    where current_role_name() = 'customer' and s.id = sale_items.sale_id and c.user_id = auth.uid()
  )
);

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select using (
  is_staff_or_manager() or exists (
    select 1 from public.customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = payments.customer_id
  )
);
drop policy if exists payments_customer_claim on public.payments;
create policy payments_customer_claim on public.payments for insert with check (
  status = 'PENDING' and exists (
    select 1 from public.customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = payments.customer_id
  )
);
