-- ============================================================
-- VFA Irish Potato Seed Production & Warehouse Management System
-- Supabase schema: tables, RLS policies, RPCs, seed data
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

-- ---------- Roles & permissions ----------
create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default uuid_generate_v4(),
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
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  permissions text[] not null default '{}',
  registered date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Catalog ----------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists seed_classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists varieties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  recommended_use text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sku text unique not null,
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
  id uuid primary key default uuid_generate_v4(),
  batch_number text unique not null,
  product_id uuid not null references products(id),
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

create table if not exists production_stages (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  description text,
  manager text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
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

create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  customer_type text not null default 'Farmer',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null,
  customer_id uuid not null references customers(id),
  status order_status not null default 'PENDING',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid references warehouses(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0
);

create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  batch_id uuid references production_batches(id),
  warehouse_id uuid references warehouses(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  customer_id uuid not null references customers(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  reference text,
  payment_date date not null default current_date,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Expenses ----------
create table if not exists expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  type text not null default 'info',
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  module text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Helper: current user's role
-- ============================================================
create or replace function current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select current_role_name() = 'manager';
$$;

create or replace function is_staff_or_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select current_role_name() in ('manager', 'staff');
$$;

create or replace function has_perm(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'manager' from profiles where id = auth.uid()),
    false
  ) or p_code = any (
    select permissions from profiles where id = auth.uid()
  );
$$;

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'customer'
  );
  return new;
end;
$$;

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
alter table settings enable row level security;
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
create policy batches_delete on production_batches for delete using (is_manager());

drop policy if exists stages_select on production_stages;
create policy stages_select on production_stages for select using (
  is_staff_or_manager() or has_perm('production.view')
);
drop policy if exists stages_write on production_stages;
create policy stages_write on production_stages for all using (
  has_perm('production.update')
) with check (has_perm('production.update'));

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
  is_staff_or_manager() or user_id = auth.uid()
);
drop policy if exists customers_write on customers;
create policy customers_write on customers for all using (
  has_perm('customers.create') or has_perm('customers.update')
) with check (has_perm('customers.create') or has_perm('customers.update'));

-- Orders: staff manage; customers see own
drop policy if exists orders_select on orders;
create policy orders_select on orders for select using (
  is_staff_or_manager()
  or exists (
    select 1 from customers c
    where c.user_id = auth.uid() and c.id = orders.customer_id
  )
);
drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert with check (
  is_staff_or_manager()
  or exists (
    select 1 from customers c
    where c.user_id = auth.uid() and c.id = orders.customer_id
  )
);
drop policy if exists orders_update on orders;
create policy orders_update on orders for update using (is_staff_or_manager());

drop policy if exists orderitems_select on order_items;
create policy orderitems_select on order_items for select using (
  is_staff_or_manager()
  or exists (
    select 1 from orders o join customers c on c.id = o.customer_id
    where o.id = order_items.order_id and c.user_id = auth.uid()
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
    select 1 from customers c where c.user_id = auth.uid() and c.id = sales.customer_id
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
    where s.id = sale_items.sale_id and c.user_id = auth.uid()
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
    select 1 from customers c where c.user_id = auth.uid() and c.id = payments.customer_id
  )
);
drop policy if exists payments_write on payments;
create policy payments_write on payments for all using (is_staff_or_manager())
  with check (is_staff_or_manager());

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
drop policy if exists notif_update on notifications;
create policy notif_update on notifications for update using (
  user_id = auth.uid() or user_id is null
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

-- Complete a production batch: update batch, add inventory + movement
create or replace function rpc_complete_production_batch(
  p_batch_id uuid,
  p_output numeric,
  p_rejected numeric,
  p_warehouse uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_product uuid;
  v_number text;
begin
  select product_id, batch_number into v_product, v_number
  from production_batches where id = p_batch_id;

  update production_batches
  set status = 'COMPLETED',
      end_date = current_date,
      output_qty = p_output,
      rejected_qty = p_rejected
  where id = p_batch_id;

  if p_output > 0 then
    insert into inventory (product_id, batch_id, warehouse_id, quantity)
    values (v_product, p_batch_id, p_warehouse, p_output)
    on conflict (product_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id) do nothing;

    update inventory set quantity = quantity + p_output, updated_at = now()
    where product_id = v_product and batch_id = p_batch_id and warehouse_id = p_warehouse;

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (v_product, p_batch_id, p_warehouse, 'PRODUCTION', p_output, 'production_batch', p_batch_id, 'Batch ' || v_number || ' completed', auth.uid());
  end if;
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
-- Seed data (idempotent)
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
  'reports.view','audit_logs.view','settings.manage'
])
on conflict (code) do nothing;

-- Manager role gets all permissions
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.name = 'manager'
on conflict do nothing;

insert into expense_categories (name) values
  ('Production costs'), ('Packaging'), ('Transport'), ('Labor'),
  ('Utilities'), ('Maintenance'), ('Equipment'), ('Other')
on conflict do nothing;

insert into warehouses (name, location, description) values
  ('Main Warehouse — Huye', 'Huye, Southern Province', 'Primary storage facility'),
  ('Cold Store — Musanze', 'Musanze, Northern Province', 'Cold storage for pre-basic seed')
on conflict do nothing;

insert into categories (name, description) values
  ('Irish Potato Seeds', 'Certified seed potatoes produced by VFA'),
  ('Packaging Materials', 'Bags and crates for seed packaging'),
  ('Production Materials', 'Inputs used in seed production'),
  ('Other', 'Miscellaneous items')
on conflict do nothing;

insert into seed_classes (name, description) values
  ('Pre-basic', 'Early generation seed under lab control'),
  ('Basic', 'First field generation from pre-basic'),
  ('Certified', 'Certified seed for commercial growers')
on conflict do nothing;

insert into varieties (name, description, recommended_use) values
  ('Kinigi', 'High-yield table & seed variety', 'High altitude areas'),
  ('Victoria', 'Widely grown, good storage quality', 'Mid altitude'),
  ('Girinka', 'Disease tolerant variety', 'Disease-prone zones')
on conflict do nothing;

-- Settings singleton
insert into settings (data)
select '{"organizationName": "VFA Greenhouse Seeds Hub Ltd", "enableCustomerOrders": true, "currency": "RWF"}'::jsonb
where not exists (select 1 from settings);
