-- ============================================================
-- VFA Irish Potato Seed Production & Warehouse Management System
-- Supabase schema: application tables, RLS policies, RPCs, and permission definitions
-- Run this in the Supabase SQL Editor (or `supabase db push`).
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('manager', 'staff', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_status as enum ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quality_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'QUARANTINED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_status as enum ('PAID', 'PARTIAL', 'UNPAID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum (
    'PRODUCTION', 'SALE', 'RETURN', 'DAMAGE',
    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RESERVATION', 'RELEASE'
  );
exception when duplicate_object then null; end $$;

alter type movement_type add value if not exists 'QUARANTINE';
alter type movement_type add value if not exists 'RELEASE_QUARANTINE';

-- ---------- Roles & permissions ----------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ---------- Profiles (extends auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role user_role not null default 'customer',
  status text not null default 'PENDING' check (status in ('ACTIVE', 'INACTIVE', 'PENDING')),
  email_verified boolean not null default false,
  permissions text[] not null default '{}',
  registered date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Catalog ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists seed_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists varieties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  recommended_use text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null,
  category_id uuid references categories(id),
  variety_id uuid references varieties(id),
  seed_class_id uuid references seed_classes(id),
  description text,
  unit text not null default 'kg',
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  minimum_stock numeric(12,2) not null default 0 check (minimum_stock >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Production ----------
create table if not exists production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text unique not null,
  product_id uuid not null references products(id),
  -- What the batch actually produced, which is not always what was planted: a
  -- farmer can sow one product and finish with another. Null until completion for
  -- a batch that is still open; every completed batch names the product its
  -- output and rejected quantities are counted in, and stock is booked there.
  output_product_id uuid references products(id),
  -- Where the batch is stored — for an open batch, where its output is destined
  -- for. Required once the batch is COMPLETED, so a batch never claims to have
  -- produced stock without saying which warehouse holds it. The inventory row
  -- that books the output names the same warehouse, and correcting the warehouse
  -- here moves that stock rather than leaving the two records disagreeing.
  --
  -- The foreign key is added after the warehouses table below, because this table
  -- is created first.
  warehouse_id uuid,
  variety_id uuid references varieties(id),
  seed_class_id uuid references seed_classes(id),
  input_qty numeric(12,2) not null check (input_qty > 0),
  output_qty numeric(12,2) not null default 0 check (output_qty >= 0),
  rejected_qty numeric(12,2) not null default 0 check (rejected_qty >= 0),
  start_date date,
  end_date date,
  status production_status not null default 'PLANNED',
  quality_status quality_status not null default 'PENDING',
  approved boolean not null default false,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- production_batches has two foreign keys to products, the planted one and the one
-- the batch actually produced. An embed that does not name the constraint is
-- ambiguous and PostgREST refuses the whole query — which stops the app loading at
-- all, rather than just losing a column — so both are given stable names that the
-- client's `product:products!<constraint>(name)` embeds rely on.
--
-- The lookup finds each constraint by the column it sits on rather than by its
-- current name, so it is correct however the constraint was created.
do $$
declare
  v_table regclass := 'production_batches'::regclass;
  v_name text;
  v_column text;
  v_target text;
begin
  foreach v_column in array array['product_id', 'output_product_id'] loop
    v_target := case v_column
      when 'product_id' then 'batches_planted_product_fkey'
      else 'batches_output_product_fkey'
    end;

    select conname into v_name
    from pg_constraint
    where conrelid = v_table
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = v_table and attname = v_column)
      ];

    if v_name is null then
      raise exception 'no foreign key found on production_batches.%, so % cannot be named', v_column, v_target;
    end if;

    if v_name <> v_target then
      execute format('alter table production_batches rename constraint %I to %I', v_name, v_target);
    end if;
  end loop;
end $$;

-- A completed batch must name the product its output is counted in, otherwise
-- there is no product to book the finished stock against.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_output_product_matches_plant'
  ) then
    alter table production_batches
      add constraint production_batches_output_product_matches_plant
      check (status <> 'COMPLETED' or output_product_id is not null);
  end if;
end;
$$;

-- A completed batch must also name the warehouse that stock is in. A null is only
-- tolerated on a batch that has not been completed: nothing has been booked, so
-- there is nowhere yet for the output to be.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_storage_warehouse'
  ) then
    alter table production_batches
      add constraint production_batches_storage_warehouse
      check (status <> 'COMPLETED' or warehouse_id is not null);
  end if;
end;
$$;

comment on constraint production_batches_storage_warehouse on production_batches is
  'A completed batch must name the warehouse its output is stored in.';

create table if not exists production_stages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references production_batches(id) on delete cascade,
  name text not null,
  sequence int not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists quality_checks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references production_batches(id) on delete cascade,
  inspector uuid references profiles(id),
  inspection_date date not null default current_date,
  status quality_status not null,
  grade text,
  accepted_qty numeric(12,2) not null default 0 check (accepted_qty >= 0),
  rejected_qty numeric(12,2) not null default 0 check (rejected_qty >= 0),
  comments text,
  created_at timestamptz not null default now()
);

-- ---------- Warehouse ----------
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  description text,
  manager text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

-- production_batches is created before the warehouses table, so the storage
-- warehouse's foreign key is added here rather than inline in its definition.
alter table production_batches
  drop constraint if exists batches_storage_warehouse_fkey;

alter table production_batches
  add constraint batches_storage_warehouse_fkey
  foreign key (warehouse_id) references warehouses(id);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid not null references warehouses(id),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  reserved_qty numeric(12,2) not null default 0 check (reserved_qty >= 0),
  quarantined_qty numeric(12,2) not null default 0 check (quarantined_qty >= 0),
  damaged_qty numeric(12,2) not null default 0 check (damaged_qty >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, batch_id, warehouse_id)
);

-- Postgres distinct from NULL: use coalesce to make unique index work with NULL batch
create unique index if not exists inventory_unique_row
  on inventory (product_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id);

-- §37: stock can never go negative, and on-hand must always cover the quantity
-- reserved, quarantined or written off against the row.
alter table inventory
  drop constraint if exists inventory_no_negative_stock;

alter table inventory
  add constraint inventory_no_negative_stock
  check (
    quantity >= 0
    and reserved_qty >= 0
    and quarantined_qty >= 0
    and damaged_qty >= 0
    and quantity >= reserved_qty + quarantined_qty + damaged_qty
  ) not valid;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid not null references warehouses(id),
  movement_type movement_type not null,
  quantity numeric(12,2) not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Customers & Sales ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  customer_type text not null default 'Farmer',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists customers_email_unique_idx
  on customers (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid not null references customers(id),
  status order_status not null default 'PENDING',
  expected_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_status pay_status not null default 'UNPAID',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table orders add column if not exists expected_amount numeric(12,2) not null default 0;
alter table orders add column if not exists paid_amount numeric(12,2) not null default 0;
alter table orders add column if not exists remaining_amount numeric(12,2) not null default 0;
alter table orders add column if not exists payment_status pay_status not null default 'UNPAID';

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid references warehouses(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  customer_id uuid not null references customers(id),
  order_id uuid references orders(id),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_status pay_status not null default 'UNPAID',
  notes text,
  sale_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid references warehouses(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  order_number text,
  customer_id uuid not null references customers(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  reference text,
  evidence_url text,
  evidence_name text,
  evidence_type text,
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'REJECTED')),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  payment_date date not null default current_date,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Keep existing installations compatible with customer payment claims.
alter table payments add column if not exists evidence_url text;
alter table payments alter column sale_id drop not null;
alter table payments add column if not exists order_id uuid references orders(id) on delete set null;
alter table payments add column if not exists order_number text;
alter table payments add column if not exists evidence_name text;
alter table payments add column if not exists evidence_type text;
alter table payments add column if not exists status text not null default 'CONFIRMED';
alter table payments add column if not exists confirmed_by uuid references profiles(id);
alter table payments add column if not exists confirmed_at timestamptz;

-- ---------- Expenses ----------
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- System ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  type text not null default 'info',
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  module text,
  created_at timestamptz not null default now()
);

create table if not exists email_notification_events (
  event_key text primary key,
  recipient text not null,
  provider_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
revoke all on email_notification_events from anon, authenticated;
grant all on email_notification_events to service_role;

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Supporting documents that are not represented by operational records.
create table if not exists archive_files (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Other',
  description text not null default '',
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  zip_size bigint not null check (zip_size > 0 and zip_size <= 27262976),
  original_path text unique not null,
  zip_path text unique not null,
  created_by uuid not null references profiles(id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper: current user's role
-- ============================================================
create or replace function current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'ACTIVE' and email_verified;
$$;

create or replace function current_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(permissions, '{}'::text[]) from profiles where id = auth.uid() and status = 'ACTIVE' and email_verified;
$$;

create or replace function is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select current_role_name() = 'manager';
$$;

create or replace function is_staff_or_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('manager', 'staff') from profiles where id = auth.uid() and status = 'ACTIVE' and email_verified),
    false
  );
$$;

create or replace function has_perm(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'manager' and status = 'ACTIVE' and email_verified from profiles where id = auth.uid()),
    false
  ) or p_code = any (
    coalesce(
      (select permissions from profiles where id = auth.uid() and status = 'ACTIVE' and email_verified),
      '{}'::text[]
    )
  );
$$;

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
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
  );
  insert into public.customers (name, email, user_id)
  values (coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function handle_user_email_verified()
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
      and not exists (select 1 from public.customers c where c.user_id = new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function handle_user_email_verified();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table categories enable row level security;
alter table seed_classes enable row level security;
alter table varieties enable row level security;
alter table products enable row level security;
alter table production_batches enable row level security;
alter table production_stages enable row level security;
alter table quality_checks enable row level security;
alter table warehouses enable row level security;
alter table inventory enable row level security;
alter table stock_movements enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table email_notification_events enable row level security;
alter table settings enable row level security;
alter table archive_files enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table expense_categories enable row level security;

-- profiles: read own; manager reads all; manager updates others
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid() or is_manager() or (is_staff_or_manager() and role = 'customer')
);

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (
  id = auth.uid() or is_manager()
) with check (
  is_manager() or (
    id = auth.uid()
    and role = current_role_name()
    and permissions = current_permissions()
  )
);

-- Supabase Storage archive: private bucket and permission-checked metadata/files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('system-archive', 'system-archive', false, 27262976)
on conflict (id) do update set public = false, file_size_limit = 27262976;

drop policy if exists archive_files_select on archive_files;
create policy archive_files_select on archive_files for select using (
  is_manager() or has_perm('archive.view')
);
drop policy if exists archive_files_insert on archive_files;
create policy archive_files_insert on archive_files for insert with check (
  (is_manager() or has_perm('archive.manage')) and created_by = auth.uid()
);
drop policy if exists archive_files_delete on archive_files;
create policy archive_files_delete on archive_files for delete using (
  is_manager() or has_perm('archive.manage')
);

drop policy if exists archive_objects_select on storage.objects;
create policy archive_objects_select on storage.objects for select to authenticated using (
  bucket_id = 'system-archive' and (is_manager() or has_perm('archive.view'))
);
drop policy if exists archive_objects_insert on storage.objects;
create policy archive_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'system-archive' and (is_manager() or has_perm('archive.manage'))
);
drop policy if exists archive_objects_delete on storage.objects;
create policy archive_objects_delete on storage.objects for delete to authenticated using (
  bucket_id = 'system-archive' and (is_manager() or has_perm('archive.manage'))
);

-- Catalog: all authenticated can read; only manager writes
drop policy if exists catalog_read on categories;
create policy catalog_read on categories for select using (auth.role() = 'authenticated');
drop policy if exists catalog_write on categories;
create policy catalog_write on categories for all using (is_manager()) with check (is_manager());

drop policy if exists seedclass_read on seed_classes;
create policy seedclass_read on seed_classes for select using (auth.role() = 'authenticated');
drop policy if exists seedclass_write on seed_classes;
create policy seedclass_write on seed_classes for all using (is_manager()) with check (is_manager());

drop policy if exists varieties_read on varieties;
create policy varieties_read on varieties for select using (auth.role() = 'authenticated');
drop policy if exists varieties_write on varieties;
create policy varieties_write on varieties for all using (is_manager()) with check (is_manager());

drop policy if exists products_read on products;
create policy products_read on products for select using (auth.role() = 'authenticated');
drop policy if exists products_write on products;
create policy products_write on products for all using (is_manager()) with check (is_manager());

-- Production: staff+manager read; writes gated by permissions
drop policy if exists batches_select on production_batches;
create policy batches_select on production_batches for select using (
  is_staff_or_manager() or has_perm('production.view')
);
drop policy if exists batches_insert on production_batches;
create policy batches_insert on production_batches for insert with check (
  has_perm('production.create')
);
drop policy if exists batches_update on production_batches;
create policy batches_update on production_batches for update using (
  has_perm('production.update')
);
drop policy if exists batches_delete on production_batches;
create policy batches_delete on production_batches for delete using (
  is_manager() or has_perm('production.delete')
);

drop policy if exists stages_select on production_stages;
create policy stages_select on production_stages for select using (
  is_staff_or_manager() or has_perm('production.view')
);
drop policy if exists stages_write on production_stages;
drop policy if exists stages_insert on production_stages;
drop policy if exists stages_update on production_stages;
drop policy if exists stages_delete on production_stages;
create policy stages_insert on production_stages for insert with check (
  has_perm('production.create') or has_perm('production.update')
);
create policy stages_update on production_stages for update using (
  has_perm('production.update')
) with check (has_perm('production.update'));
create policy stages_delete on production_stages for delete using (
  has_perm('production.update')
);

drop policy if exists qc_select on quality_checks;
create policy qc_select on quality_checks for select using (is_staff_or_manager());
drop policy if exists qc_write on quality_checks;
create policy qc_write on quality_checks for all using (
  has_perm('quality.create') or has_perm('quality.update')
) with check (has_perm('quality.create') or has_perm('quality.update'));

-- Warehouse
drop policy if exists warehouses_select on warehouses;
create policy warehouses_select on warehouses for select using (auth.role() = 'authenticated');
drop policy if exists warehouses_write on warehouses;
create policy warehouses_write on warehouses for all using (is_manager()) with check (is_manager());

drop policy if exists inv_select on inventory;
create policy inv_select on inventory for select using (
  is_staff_or_manager() or has_perm('inventory.view')
);
drop policy if exists inv_write on inventory;
create policy inv_write on inventory for all using (
  has_perm('inventory.update') or has_perm('inventory.adjust')
) with check (has_perm('inventory.update') or has_perm('inventory.adjust'));

drop policy if exists movements_select on stock_movements;
create policy movements_select on stock_movements for select using (
  is_staff_or_manager() or has_perm('inventory.view')
);
drop policy if exists movements_insert on stock_movements;
create policy movements_insert on stock_movements for insert with check (
  is_staff_or_manager() or has_perm('inventory.update')
);

-- Customers: staff read; customers read only their own linked record
drop policy if exists customers_select on customers;
create policy customers_select on customers for select using (
  is_staff_or_manager() or (current_role_name() = 'customer' and user_id = auth.uid())
);
drop policy if exists customers_write on customers;
create policy customers_insert on customers for insert with check (has_perm('customers.create'));
create policy customers_update on customers for update using (
  has_perm('customers.update')
) with check (has_perm('customers.update'));
drop policy if exists customers_delete on customers;
create policy customers_delete on customers for delete using (has_perm('customers.delete'));

-- Orders: staff manage; customers see own
drop policy if exists orders_select on orders;
create policy orders_select on orders for select using (
  is_staff_or_manager()
  or exists (
    select 1 from customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = orders.customer_id
  )
);
drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert with check (
  is_staff_or_manager()
  or exists (
    select 1 from customers c
    where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = orders.customer_id
  )
);
drop policy if exists orders_update on orders;
create policy orders_update on orders for update using (is_staff_or_manager());

drop policy if exists orderitems_select on order_items;
create policy orderitems_select on order_items for select using (
  is_staff_or_manager()
  or exists (
    select 1 from orders o join customers c on c.id = o.customer_id
    where current_role_name() = 'customer' and o.id = order_items.order_id and c.user_id = auth.uid()
  )
);
drop policy if exists orderitems_write on order_items;
create policy orderitems_write on order_items for all using (is_staff_or_manager())
  with check (is_staff_or_manager());

-- Sales: staff manage; customers see own invoices
drop policy if exists sales_select on sales;
create policy sales_select on sales for select using (
  is_staff_or_manager()
  or exists (
    select 1 from customers c where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = sales.customer_id
  )
);
drop policy if exists sales_write on sales;
create policy sales_write on sales for all using (is_staff_or_manager())
  with check (is_staff_or_manager());

drop policy if exists saleitems_select on sale_items;
create policy saleitems_select on sale_items for select using (
  is_staff_or_manager()
  or exists (
    select 1 from sales s join customers c on c.id = s.customer_id
    where current_role_name() = 'customer' and s.id = sale_items.sale_id and c.user_id = auth.uid()
  )
);
drop policy if exists saleitems_write on sale_items;
create policy saleitems_write on sale_items for all using (is_staff_or_manager())
  with check (is_staff_or_manager());

-- Payments: staff manage; customers see own
drop policy if exists payments_select on payments;
create policy payments_select on payments for select using (
  is_staff_or_manager()
  or exists (
    select 1 from customers c where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = payments.customer_id
  )
);
drop policy if exists payments_write on payments;
create policy payments_staff_write on payments for all using (is_staff_or_manager())
  with check (is_staff_or_manager());
drop policy if exists payments_customer_claim on payments;
create policy payments_customer_claim on payments for insert with check (
  status = 'PENDING'
  and exists (
    select 1 from customers c where current_role_name() = 'customer' and c.user_id = auth.uid() and c.id = payments.customer_id
  )
);

-- Expenses: manager + staff with permission
drop policy if exists expenses_select on expenses;
create policy expenses_select on expenses for select using (
  is_staff_or_manager() and has_perm('expenses.view')
);
drop policy if exists expenses_write on expenses;
create policy expenses_write on expenses for all using (
  has_perm('expenses.create') or has_perm('expenses.update')
) with check (has_perm('expenses.create') or has_perm('expenses.update'));

-- Notifications: user's own
drop policy if exists notif_select on notifications;
create policy notif_select on notifications for select using (
  user_id = auth.uid() or user_id is null
);
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert with check (
  user_id = auth.uid() or (user_id is null and is_manager())
);
drop policy if exists notif_update on notifications;
create policy notif_update on notifications for update using (
  user_id = auth.uid() or user_id is null
) with check (
  user_id = auth.uid() or (user_id is null and is_manager())
);

-- Audit logs: manager only
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select using (is_manager());
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert with check (auth.uid() is not null);

-- Settings: manager only
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (is_manager());
drop policy if exists settings_write on settings;
create policy settings_write on settings for all using (is_manager()) with check (is_manager());

-- ============================================================
-- RPCs (multi-record operations run server-side in a transaction)
-- ============================================================

-- Record a quality check and update the batch status
create or replace function rpc_record_quality_check(
  p_batch_id uuid,
  p_status quality_status,
  p_grade text,
  p_accepted numeric,
  p_rejected numeric,
  p_comments text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into quality_checks (batch_id, inspector, status, grade, accepted_qty, rejected_qty, comments)
  values (p_batch_id, auth.uid(), p_status, p_grade, p_accepted, p_rejected, p_comments);

  update production_batches
  set quality_status = p_status,
      approved = (p_status = 'APPROVED')
  where id = p_batch_id;
end;
$$;

-- Complete a production batch: update batch, add inventory + movement.
-- p_output_product defaults to whatever the batch already records, so a caller
-- that has not been updated completes it as the product it planted. The finished
-- stock is booked against the output product, which is not always the planted one,
-- and the warehouse it is booked into is recorded on the batch too, so the batch
-- says where its output is instead of leaving that to be inferred by a join.
create or replace function rpc_complete_production_batch(
  p_batch_id uuid,
  p_output numeric,
  p_rejected numeric,
  p_warehouse uuid,
  p_output_product uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_product uuid;
  v_number text;
  v_output numeric;
  v_rejected numeric;
begin
  select coalesce(p_output_product, b.output_product_id, b.product_id), b.batch_number
  into v_product, v_number
  from production_batches b
  where b.id = p_batch_id;

  if v_product is null then
    raise exception 'Batch % does not exist', p_batch_id using errcode = 'no_data_found';
  end if;

  if not exists (select 1 from products where id = v_product and status = 'ACTIVE') then
    raise exception 'Output product % is not an active product', v_product using errcode = 'foreign_key_violation';
  end if;

  if p_warehouse is null then
    raise exception 'Batch % cannot be completed without the warehouse its output is stored in', v_number
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from warehouses where id = p_warehouse) then
    raise exception 'Warehouse % does not exist', p_warehouse using errcode = 'foreign_key_violation';
  end if;

  v_output := round(coalesce(p_output, 0), 2);
  v_rejected := round(coalesce(p_rejected, 0), 2);

  if v_output < 0 or v_rejected < 0 then
    raise exception 'Output and rejected quantities cannot be negative' using errcode = 'check_violation';
  end if;

  update production_batches
  set status = 'COMPLETED',
      end_date = current_date,
      output_qty = v_output,
      rejected_qty = v_rejected,
      output_product_id = v_product,
      warehouse_id = p_warehouse
  where id = p_batch_id;

  if v_output > 0 then
    -- One atomic upsert that adds the output exactly once: the row is created
    -- holding it, or an existing row is topped up by it. Seeding the row with
    -- the output and then adding it again books production stock twice.
    -- The stock belongs to the output product, not the planted one.
    insert into inventory (product_id, batch_id, warehouse_id, quantity, updated_at)
    values (v_product, p_batch_id, p_warehouse, v_output, now())
    on conflict (product_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id)
    do update set quantity = inventory.quantity + excluded.quantity, updated_at = now();

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (v_product, p_batch_id, p_warehouse, 'PRODUCTION', v_output, 'production_batch', p_batch_id, 'Batch ' || v_number || ' completed', auth.uid());
  end if;
end;
$$;

-- Edit a production batch, carrying the stock that completion booked along with it.
--
-- A correction on a completed batch writes the batch and its stock together, in one
-- transaction, so the two cannot drift apart: the batch said 500 while the warehouse
-- said 480, with nothing recording which was right. Moving the storage warehouse is
-- the same kind of change, and moves the stock with it, because a batch that names a
-- warehouse holding none of its output is a record that is not true.
--
-- What may be changed, and when:
--
--   * Traceability fields (batch number, planted product, variety, seed class,
--     input, dates, notes) are free. None of them touch stock.
--   * warehouse_id names where the batch is stored. On an open batch it is where the
--     output is destined for. On a completed batch it is where the output is, and
--     changing it relocates the stock, recorded as the transfer pair a transfer
--     between warehouses always produces.
--   * output_qty and output_product_id rewrite the stock row and the PRODUCTION
--     movement that booked it, as the operator asked — in place, not as a
--     correcting entry, so there is one row of truth per batch.
--   * All three are refused once the batch is quality APPROVED, because an approved
--     quantity is a statement about what was inspected, and an approved batch has
--     been inspected where it is.
--   * They are refused once any of the stock has been sold, reserved, quarantined
--     or written off. The reservation check matters: an order confirmed against
--     this batch has already been promised to a customer.
--   * Taking a completed batch back out of COMPLETED releases its stock, so
--     re-completing books the output once rather than twice.
--
-- Changing the output and the warehouse in one save is refused rather than guessed
-- at: they are separate relocations of the same stock, and composing them would
-- leave the movement history describing neither.
--
-- The refused cases raise rather than clamp, so a refused edit leaves nothing
-- half-applied and the operator is told which batch and why.

drop function if exists public.rpc_update_production_batch(
  uuid, text, uuid, uuid, uuid, numeric, numeric, numeric, uuid, date, date, production_status, quality_status, text
);

create or replace function rpc_update_production_batch(
  p_batch_id uuid,
  p_batch_number text,
  p_product_id uuid,
  p_variety_id uuid default null,
  p_seed_class_id uuid default null,
  p_input_qty numeric default null,
  p_output_qty numeric default null,
  p_rejected_qty numeric default null,
  p_output_product_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_status production_status default null,
  p_quality_status quality_status default null,
  p_notes text default null,
  p_warehouse_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  b production_batches%rowtype;
  v_inv inventory%rowtype;
  v_target inventory%rowtype;
  v_number text;
  v_output_product uuid;
  v_warehouse uuid;
  v_new_status production_status;
  v_new_output numeric;
  v_new_rejected numeric;
  v_stock_changed boolean := false;
  v_reopening boolean := false;
  v_moved boolean := false;
  v_movements integer;
  v_rows integer := 0;
  v_spent boolean := false;
begin
  -- security definer bypasses the batches_update policy, so the permission it
  -- encodes is checked here instead of being assumed.
  if not has_perm('production.update') then
    raise exception 'You need the production.update permission to edit a batch'
      using errcode = 'insufficient_privilege';
  end if;

  -- for update: two operators editing the same batch must not both read the same
  -- stock figure and each correct it from there.
  select * into b from production_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch % does not exist', p_batch_id using errcode = 'no_data_found';
  end if;

  v_number := b.batch_number;
  v_output_product := coalesce(p_output_product_id, b.output_product_id, b.product_id);
  v_warehouse := coalesce(p_warehouse_id, b.warehouse_id);
  v_new_status := coalesce(p_status, b.status);
  v_new_output := coalesce(p_output_qty, b.output_qty);
  v_new_rejected := coalesce(p_rejected_qty, b.rejected_qty);

  if v_new_output < 0 or v_new_rejected < 0 then
    raise exception 'Output and rejected quantities cannot be negative' using errcode = 'check_violation';
  end if;
  if coalesce(p_input_qty, b.input_qty) <= 0 then
    raise exception 'Input quantity must be greater than zero' using errcode = 'check_violation';
  end if;
  if v_warehouse is not null and not exists (select 1 from warehouses where id = v_warehouse) then
    raise exception 'Warehouse % does not exist', v_warehouse using errcode = 'foreign_key_violation';
  end if;
  -- Stock that exists has to be somewhere, so a completed batch has to name where.
  -- production_batches_storage_warehouse would catch a null, but not in words an
  -- operator can act on.
  if v_new_status = 'COMPLETED' and v_warehouse is null then
    raise exception 'Batch % must name the warehouse its output is stored in', v_number
      using errcode = 'check_violation';
  end if;

  -- Becoming COMPLETED is what books stock, and that is the completion flow's job.
  -- Letting the edit form do it here would book the output outside the one
  -- transaction that completion guarantees.
  if b.status <> 'COMPLETED' and v_new_status = 'COMPLETED' then
    raise exception 'Batch % can only be completed from the Complete action, which is what books its stock', v_number
      using errcode = 'check_violation';
  end if;

  v_stock_changed := b.status = 'COMPLETED' and (
    v_output_product is distinct from b.output_product_id
    or v_new_output    is distinct from b.output_qty
  );
  v_reopening := b.status = 'COMPLETED' and v_new_status <> 'COMPLETED';
  v_moved := b.status = 'COMPLETED' and v_warehouse is distinct from b.warehouse_id;

  -- A batch holding stock in more than one warehouse has no single answer to
  -- "where is it", and the function below reads one row. It is counted rather than
  -- left to the select into, which raises "query returned more than one row" on a
  -- correction the operator cannot connect to that message. An edit that touches
  -- nothing about the stock is still allowed through.
  select count(*) into v_rows from inventory where batch_id = p_batch_id;
  if v_rows > 1 and (v_stock_changed or v_reopening or v_moved) then
    raise exception 'Batch % has stock in % warehouses, so its whereabouts are ambiguous. Transfer the stock into one warehouse from Inventory first, then edit the batch.', v_number, v_rows
      using errcode = 'check_violation';
  end if;

  select * into v_inv from inventory where batch_id = p_batch_id order by quantity desc, warehouse_id limit 1;

  -- Has any of this batch's stock left the shelf, or been promised to somebody?
  -- quantity below the completed figure means net outflow; the other three are
  -- stock this batch is still answerable for but must not quietly re-cut.
  v_spent := v_inv.id is not null and (
    v_inv.quantity < b.output_qty
    or v_inv.reserved_qty > 0
    or v_inv.quarantined_qty > 0
    or v_inv.damaged_qty > 0
  );

  if (v_stock_changed or v_reopening or v_moved) and b.quality_status = 'APPROVED' then
    raise exception 'Batch % is quality approved, so its stock is locked. Record a further quality check before changing it.', v_number
      using errcode = 'check_violation';
  end if;

  if (v_stock_changed or v_reopening or v_moved) and v_spent then
    raise exception 'Stock from batch % has already been sold, reserved or written off, so it cannot be changed', v_number
      using errcode = 'check_violation';
  end if;

  if v_moved and v_stock_changed then
    raise exception 'Batch % is changing both its output and the warehouse it is stored in. Save the output change first, then the warehouse.', v_number
      using errcode = 'check_violation';
  end if;

  -- Checked before anything is written, so a batch whose movements cannot be
  -- matched is refused outright rather than half-corrected.
  if v_stock_changed and v_inv.id is not null then
    select count(*) into v_movements
    from stock_movements
    where batch_id = p_batch_id
      and movement_type = 'PRODUCTION';

    if v_movements <> 1 then
      raise exception 'Batch % has % PRODUCTION stock movement(s) instead of one, so its stock cannot be matched up safely. Correct the movements first.', v_number, v_movements
        using errcode = 'check_violation';
    end if;
  end if;

  -- Reopening: the output is given back, because the batch no longer claims to
  -- have produced it. Zeroing the inventory row rather than deleting it keeps the
  -- row for the re-completion to book into, which is the same row it would have
  -- used had the batch never been reopened.
  if v_reopening and v_inv.id is not null and v_inv.quantity > 0 then
    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (
      v_inv.product_id, p_batch_id, v_inv.warehouse_id, 'ADJUSTMENT_OUT', v_inv.quantity,
      'production_batch', p_batch_id, 'Batch ' || v_number || ' reopened — stock released', auth.uid()
    );
    update inventory set quantity = 0, updated_at = now() where id = v_inv.id;
  end if;

  if v_reopening then
    v_new_output := 0;
    v_new_rejected := 0;
  end if;

  -- A corrected figure is written to the stock row it belongs to. When the output
  -- product changes, the stock moves with it: into the row that already holds
  -- this batch's output in the new product if there is one, otherwise the row
  -- itself is re-pointed.
  if v_stock_changed and v_inv.id is not null then
    if v_output_product is distinct from v_inv.product_id then
      select * into v_target
      from inventory
      where batch_id = p_batch_id
        and product_id = v_output_product
        and warehouse_id = v_inv.warehouse_id;

      if v_target.id is not null then
        update inventory set quantity = quantity + v_new_output, updated_at = now() where id = v_target.id;
        delete from inventory where id = v_inv.id;
      else
        update inventory
        set product_id = v_output_product, quantity = v_new_output, updated_at = now()
        where id = v_inv.id;
      end if;
    else
      update inventory set quantity = v_new_output, updated_at = now() where id = v_inv.id;
    end if;

    -- stock_movements.quantity is constrained to be positive, so a batch corrected
    -- down to nothing has its booking removed rather than set to zero.
    if v_new_output > 0 then
      update stock_movements
      set product_id = v_output_product, quantity = v_new_output
      where batch_id = p_batch_id
        and movement_type = 'PRODUCTION';
    else
      delete from stock_movements
      where batch_id = p_batch_id
        and movement_type = 'PRODUCTION';
    end if;
  end if;

  -- The batch and the shelf cannot disagree about where a batch is: if the batch
  -- named a warehouse holding none of its output, every later query joining the
  -- two would be answering from a record that is not true. So the stock is
  -- relocated rather than the batch relabelled, and the relocation is recorded as
  -- the pair of TRANSFER movements a transfer between warehouses always produces.
  -- The PRODUCTION movement is left alone, so the history still shows the output
  -- being booked into the warehouse it was harvested into, and the transfer says
  -- where it went from there.
  --
  -- Re-pointing the row cannot collide with another row for this batch and product,
  -- because the count above has already established there is only one row and
  -- inventory is unique on (product, batch, warehouse). There is nothing to merge.
  if v_moved and v_inv.id is not null then
    if v_inv.quantity > 0 then
      insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
      values (
        v_inv.product_id, p_batch_id, v_inv.warehouse_id, 'TRANSFER', v_inv.quantity,
        'production_batch', p_batch_id, 'Batch ' || v_number || ' moved to another warehouse — stock transferred out', auth.uid()
      );
      insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
      values (
        v_inv.product_id, p_batch_id, v_warehouse, 'TRANSFER', v_inv.quantity,
        'production_batch', p_batch_id, 'Batch ' || v_number || ' moved to another warehouse — stock transferred in', auth.uid()
      );
    end if;

    -- After a reopen the row is already empty — v_new_output was zeroed above — so
    -- this re-points it and nothing else, ready for the re-completion to book into.
    update inventory set warehouse_id = v_warehouse, updated_at = now() where id = v_inv.id;
  end if;

  update production_batches
  set batch_number = coalesce(p_batch_number, batch_number),
      product_id = coalesce(p_product_id, product_id),
      variety_id = p_variety_id,
      seed_class_id = p_seed_class_id,
      input_qty = coalesce(p_input_qty, input_qty),
      output_qty = v_new_output,
      rejected_qty = v_new_rejected,
      output_product_id = v_output_product,
      start_date = p_start_date,
      end_date = p_end_date,
      status = v_new_status,
      -- approved follows the quality status rather than being set independently,
      -- or the two disagree and the sale gate reads the wrong one.
      quality_status = coalesce(p_quality_status, quality_status),
      approved = (coalesce(p_quality_status, quality_status) = 'APPROVED'),
      warehouse_id = v_warehouse,
      notes = p_notes
  where id = p_batch_id;
end;
$$;

-- Create a sale: invoice + items + SALE movements + payment status
create or replace function rpc_create_sale(
  p_customer uuid,
  p_items jsonb,       -- [{product_id, batch_id?, warehouse_id?, quantity, unit_price}]
  p_discount numeric default 0,
  p_order uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_invoice text;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_qty numeric;
  v_price numeric;
  v_batch uuid;
  v_wh uuid;
  v_reserved numeric;
begin
  -- Generate the NEXT invoice number: 'INV-YYYY-####' → max sequence + 1.
  -- (Reusing max() directly caused a unique violation on the second sale.)
  select coalesce(max((regexp_match(invoice_number, '^INV-[0-9]{4}-([0-9]+)$'))[1]::int), 0) + 1
    into v_invoice
  from sales where invoice_number like 'INV-%';
  v_invoice := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_invoice::text, 4, '0');

  insert into sales (invoice_number, customer_id, order_id, subtotal, discount, total, paid_amount, payment_status, created_by)
  values (
    v_invoice,
    p_customer, p_order, 0, p_discount, 0, 0, 'UNPAID', auth.uid()
  ) returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_qty * v_price;

    insert into sale_items (sale_id, product_id, batch_id, warehouse_id, quantity, unit_price, subtotal)
    values (
      v_sale,
      (v_item->>'product_id')::uuid,
      (v_item->>'batch_id')::uuid,
      (v_item->>'warehouse_id')::uuid,
      v_qty,
      v_price,
      v_qty * v_price
    );

    v_batch := (v_item->>'batch_id')::uuid;
    v_wh := coalesce((v_item->>'warehouse_id')::uuid, (select min(id) from warehouses));

    -- Fulfilling an order releases the matching reservation first, so the
    -- earmarked goods become sellable and reserved_qty is consumed exactly
    -- once (never leaked, never double-counted).
    if p_order is not null then
      select coalesce(sum(quantity), 0) into v_reserved
      from order_items
      where order_id = p_order
        and product_id = (v_item->>'product_id')::uuid
        and ((v_batch is not null and batch_id = v_batch) or (v_batch is null and batch_id is null))
        and warehouse_id = v_wh;

      if v_reserved > 0 then
        update inventory
        set reserved_qty = greatest(reserved_qty - least(reserved_qty, v_reserved, v_qty), 0), updated_at = now()
        where product_id = (v_item->>'product_id')::uuid
          and warehouse_id = v_wh
          and ((v_batch is not null and batch_id = v_batch) or (v_batch is null and batch_id is null));

        insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        values (
          (v_item->>'product_id')::uuid,
          v_batch,
          v_wh,
          'RELEASE', least(v_reserved, v_qty), 'order', p_order, 'Reservation converted to sale', auth.uid()
        );
      end if;
    end if;

    -- Decrement exactly one row: product + batch + warehouse, and only when
    -- the available quantity (quantity − reserved − quarantined − damaged)
    -- covers the sale (§37: negative stock impossible).
    update inventory
    set quantity = quantity - v_qty, updated_at = now()
    where product_id = (v_item->>'product_id')::uuid
      and warehouse_id = v_wh
      and ((v_batch is not null and batch_id = v_batch) or (v_batch is null and batch_id is null))
      and quantity - reserved_qty - quarantined_qty - damaged_qty >= v_qty;

    if not found then
      raise exception 'Insufficient stock or unknown inventory row for product %', v_item->>'product_id';
    end if;

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (
      (v_item->>'product_id')::uuid,
      v_batch,
      v_wh,
      'SALE', v_qty, 'sale', v_sale, 'Invoice ' || v_invoice, auth.uid()
    );
  end loop;

  update sales
  set subtotal = v_subtotal,
      total = greatest(v_subtotal - p_discount, 0)
  where id = v_sale;

  if p_order is not null then
    update orders set status = 'COMPLETED' where id = p_order;
  end if;

  return v_sale;
end;
$$;

-- Confirm an order: reserve stock
create or replace function rpc_confirm_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item record;
  v_wh uuid;
begin
  select coalesce(min(warehouse_id), (select min(id) from warehouses)) into v_wh
  from order_items where order_id = p_order;

  for v_item in
    select oi.* from order_items oi where oi.order_id = p_order
  loop
    update inventory
    set reserved_qty = reserved_qty + v_item.quantity, updated_at = now()
    where product_id = v_item.product_id
      and warehouse_id = coalesce(v_item.warehouse_id, v_wh)
      and ((v_item.batch_id is not null and batch_id = v_item.batch_id) or (v_item.batch_id is null and batch_id is null))
      and quantity - reserved_qty - quarantined_qty - damaged_qty >= v_item.quantity;

    if not found then
      raise exception 'Insufficient available stock to reserve for product %', v_item.product_id;
    end if;

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (
      v_item.product_id, v_item.batch_id, coalesce(v_item.warehouse_id, v_wh),
      'RESERVATION', v_item.quantity, 'order', p_order, 'Order confirmed', auth.uid()
    );
  end loop;

  update orders set status = 'CONFIRMED' where id = p_order;
end;
$$;

-- Cancel an order: release reserved stock
create or replace function rpc_cancel_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item record;
  v_wh uuid;
begin
  select coalesce(min(warehouse_id), (select min(id) from warehouses)) into v_wh
  from order_items where order_id = p_order;

  for v_item in select oi.* from order_items oi where oi.order_id = p_order loop
    update inventory
    set reserved_qty = greatest(reserved_qty - v_item.quantity, 0), updated_at = now()
    where product_id = v_item.product_id
      and warehouse_id = coalesce(v_item.warehouse_id, v_wh)
      and ((v_item.batch_id is not null and batch_id = v_item.batch_id) or (v_item.batch_id is null and batch_id is null));

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (
      v_item.product_id, v_item.batch_id, coalesce(v_item.warehouse_id, v_wh),
      'RELEASE', v_item.quantity, 'order', p_order, 'Order cancelled', auth.uid()
    );
  end loop;

  update orders set status = 'CANCELLED' where id = p_order;
end;
$$;

-- Record a payment; recalc payment status
create or replace function rpc_record_payment(
  p_sale uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_payment_date date
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_paid numeric;
begin
  select total, paid_amount into v_total, v_paid from sales where id = p_sale;

  if p_amount <= 0 then raise exception 'Payment must be positive'; end if;
  if v_paid + p_amount > v_total then raise exception 'Payment exceeds invoice total'; end if;

  insert into payments (sale_id, customer_id, amount, method, reference, payment_date, recorded_by)
  select p_sale, customer_id, p_amount, p_method, p_reference, p_payment_date, auth.uid() from sales where id = p_sale;

  v_paid := v_paid + p_amount;
  update sales
  set paid_amount = v_paid,
      payment_status = case
        when v_paid >= v_total then 'PAID'::pay_status
        when v_paid > 0 then 'PARTIAL'::pay_status
        else 'UNPAID'::pay_status end
  where id = p_sale;
end;
$$;

-- Adjust inventory with movement (audit trail)
create or replace function rpc_adjust_inventory(
  p_product uuid,
  p_batch uuid,
  p_warehouse uuid,
  p_direction text,   -- 'in' | 'out'
  p_quantity numeric,
  p_notes text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_direction = 'in' then
    update inventory set quantity = quantity + p_quantity, updated_at = now()
    where product_id = p_product and warehouse_id = p_warehouse
      and (batch_id = p_batch or (p_batch is null and batch_id is null));
    if not found then
      insert into inventory (product_id, batch_id, warehouse_id, quantity)
      values (p_product, p_batch, p_warehouse, p_quantity);
    end if;
    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, notes, created_by)
    values (p_product, p_batch, p_warehouse, 'ADJUSTMENT_IN', p_quantity, 'manual', p_notes, auth.uid());
  else
    update inventory set quantity = quantity - p_quantity, updated_at = now()
    where product_id = p_product and warehouse_id = p_warehouse
      and (batch_id = p_batch or (p_batch is null and batch_id is null))
      and quantity - reserved_qty - quarantined_qty - damaged_qty >= p_quantity;
    if not found then raise exception 'Insufficient available stock'; end if;
    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, notes, created_by)
    values (p_product, p_batch, p_warehouse, 'ADJUSTMENT_OUT', p_quantity, 'manual', p_notes, auth.uid());
  end if;
end;
$$;

-- ============================================================
-- Structural reference data only (idempotent). No sample business records are inserted.
-- ============================================================
insert into roles (name, description) values
  ('manager', 'Full access'),
  ('staff', 'Permission-based access'),
  ('customer', 'Own data only')
on conflict (name) do nothing;

insert into permissions (code)
select unnest(array[
  'dashboard.view','users.view','users.create','users.update','users.delete',
  'roles.view','roles.manage','products.view','products.create','products.update','products.delete',
  'categories.view','categories.create','categories.update','categories.delete',
  'varieties.view','varieties.create','varieties.update','varieties.delete',
  'production.view','production.create','production.update','production.delete',
  'quality.view','quality.create','quality.update',
  'warehouses.view','warehouses.manage','inventory.view','inventory.update','inventory.adjust',
  'customers.view','customers.create','customers.update','customers.delete',
  'orders.view','orders.create','orders.update','orders.cancel',
  'sales.view','sales.create','sales.update',
  'payments.view','payments.create','payments.update',
  'expenses.view','expenses.create','expenses.update','expenses.delete',
  'reports.view','archive.view','archive.manage','audit_logs.view','settings.manage'
])
on conflict (code) do nothing;

-- Manager role gets all permissions
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.name = 'manager'
on conflict do nothing;
