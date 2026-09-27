-- Purge operational data, keep auth and reference data.
--
-- NOT A MIGRATION. This file used to live in supabase/migrations/ as
-- 20260926000003_purge_operational_data.sql, and it does not belong there.
--
-- A migration is replayed, in version order, against every environment that
-- applies the chain, and it describes a change to the *schema*. This describes
-- the opposite: a one-off, irreversible deletion of whatever operational data an
-- environment happens to hold. It belongs to a single throwaway environment at a
-- single moment, which is not something a migration can express.
--
-- Keeping it in the chain was actively dangerous. It was never applied to the
-- production database, but it sat at a version older than the newest applied
-- migration, so `supabase db push` treated it as an out-of-order file and refused
-- to run without `--include-all`. That flag is the only way to apply a pending
-- migration, so the database could not be migrated at all unless the operator also
-- agreed to run the purge — which deletes every batch, inventory row, stock
-- movement, order and sale. A routine `db push` and a destructive wipe were coupled
-- together by nothing more than a file's location.
--
-- It is kept, and not deleted, because a fresh demo or test environment is
-- legitimately reset this way. Run it deliberately, by hand, as below.
--
-- DELETES (irreversible):
--   production_batches, production_stages, quality_checks,
--   inventory, stock_movements,
--   orders, order_items, sales, sale_items, payments,
--   expenses, notifications, audit_logs,
--   archive_files rows + their objects in the 'system-archive' storage bucket
--
-- KEEPS:
--   auth.users, profiles,
--   roles, permissions, role_permissions   (RBAC — has_perm() reads these)
--   categories, seed_classes, varieties, products, warehouses,
--   expense_categories, customers, settings
--
-- SAFETY RAIL: refuses to run unless the session opts in, so an accidental run
-- against a real environment cannot wipe it.
--   psql:      psql "$DB_URL" -v ON_ERROR_STOP=1 \
--                -c "set app.allow_purge = 'yes'" \
--                -f supabase/scripts/purge_operational_data.sql
--   SQL editor: run `set app.allow_purge = 'yes';` in the SAME session first,
--               then run this file. (Session settings do not persist across
--               separate statements in the dashboard, so use one DO block or
--               paste the body after the SET.)
--   Dashboard → Database → SQL editor: paste the SET and this file together.
--
-- AFTER RUNNING: every signed-in client must reload. The app diffs its local
-- Zustand state against the previous state and re-upserts anything it still
-- holds (see src/services/workspaceSync.js), so a stale browser tab can push
-- the purged records straight back.

do $$
begin
  if current_setting('app.allow_purge', true) is distinct from 'yes' then
    raise exception
      'Purge blocked. Run "set app.allow_purge = ''yes'';" in this session first, or comment out this guard if you are certain.';
  end if;
end $$;

begin;

-- Report first, delete second: the notices tell you exactly what was removed.
do $$
declare
  targets text[] := array[
    'payments', 'sale_items', 'sales', 'order_items', 'orders',
    'inventory', 'stock_movements', 'quality_checks', 'production_stages',
    'production_batches', 'expenses', 'notifications', 'audit_logs'
  ];
  target text;
  n bigint;
begin
  foreach target in array targets loop
    execute format('select count(*) from public.%I', target) into n;
    raise notice 'purge: % row(s) in public.%', n, target;
  end loop;
end $$;

-- Archive files. Every upload is stored under "<archive_files.id>/original" and
-- "<archive_files.id>/archive.zip", so an object belongs to a row when its first
-- folder segment is that row's id. A bare "<id>" folder marker is matched on the
-- name itself, because storage.foldername() returns an empty array for a name
-- with no slash in it. Report and delete share one predicate so they cannot drift.
do $$
declare
  n bigint;
begin
  execute $q$
    select count(*)
    from storage.objects o
    where o.bucket_id = 'system-archive'
      and exists (
        select 1 from archive_files f
        where o.name = f.id::text or (storage.foldername(o.name))[1] = f.id::text
      )
  $q$ into n;
  raise notice 'purge: % storage object(s) in bucket system-archive', n;

  delete from storage.objects o
  where o.bucket_id = 'system-archive'
    and exists (
      select 1 from archive_files f
      where o.name = f.id::text or (storage.foldername(o.name))[1] = f.id::text
    );
end $$;

delete from archive_files;

-- Operational data, in foreign-key safe order. Child tables first: payments and
-- line items hang off sales/orders, and inventory/movements/line items reference
-- production_batches.
delete from payments;
delete from sale_items;
delete from sales;
delete from order_items;
delete from orders;
delete from inventory;
delete from stock_movements;
delete from quality_checks;
delete from production_stages;
delete from production_batches;
delete from expenses;
delete from notifications;
delete from audit_logs;

-- The sent-email ledger. Deleting it removes the de-duplication keys, so any
-- notification that is re-triggered later can be emailed a second time.
-- Comment this out if you would rather keep that history.
delete from email_notification_events;

commit;
