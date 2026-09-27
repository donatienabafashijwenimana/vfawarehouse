-- Repair the operational data left behind by the batch-completion bug.
--
-- What happened: completion used to assemble the three rows in the browser and
-- let the generic diff-sync push them. The production_batches upsert carried
-- output_product_id, a column this database did not have, because
-- 20260927000007_batch_output_product.sql had never been applied. So every batch
-- write failed while the inventory and stock_movements upserts — which have no
-- such column — succeeded. The flow then rolled the store back, which
-- desynchronised the store from the sync baseline, and the next sync read that
-- rollback as a deletion and removed the stock a second time.
--
-- Net effect: the completion was lost, and the batch stayed open. Where the
-- browser was closed before that second sync ran, the residue survives — stock
-- and a PRODUCTION movement booked against a batch the database never marked
-- COMPLETED.
--
-- Those rows are removed below. The fingerprint is deliberately narrow: a
-- PRODUCTION movement that references the batch, sitting next to the stock row
-- it booked. Stock that arrived any other way (batch_id null, a batch that is
-- COMPLETED, a movement of another type) is left alone.
--
-- This cannot un-complete a batch, and it cannot invent stock. Where a completed
-- batch is short of the stock it should have, that is reported rather than
-- guessed, because the intended warehouse is not recoverable from what is left.

-- No begin/commit here on purpose: `supabase db push` already wraps a migration
-- in a transaction, and a COMMIT inside one commits it early. The purge migration
-- carries them because it is also meant to be run standalone through psql.

-- Report first, delete second.
do $$
declare
  n bigint;
begin
  select count(*) into n
  from inventory i
  join production_batches b on b.id = i.batch_id
  where b.status <> 'COMPLETED'
    and exists (
      select 1 from stock_movements m
      where m.movement_type = 'PRODUCTION'
        and m.reference_type = 'production_batch'
        and m.reference_id = i.batch_id
        and m.product_id = i.product_id
        and m.warehouse_id = i.warehouse_id
    );
  raise notice 'repair: % stock row(s) booked against a batch that is not COMPLETED', n;

  select count(*) into n
  from stock_movements m
  join production_batches b on b.id = m.reference_id
  where m.movement_type = 'PRODUCTION'
    and m.reference_type = 'production_batch'
    and b.status <> 'COMPLETED';
  raise notice 'repair: % PRODUCTION movement(s) against a batch that is not COMPLETED', n;

  select count(*) into n
  from production_batches b
  where b.status = 'COMPLETED' and coalesce(b.output_qty, 0) > 0;
  raise notice 'check: % COMPLETED batch(es) with output to account for', n;
end $$;

-- The residue. Movements first so the stock row is never left describing a
-- production event that no longer exists.
delete from stock_movements m
using production_batches b
where m.movement_type = 'PRODUCTION'
  and m.reference_type = 'production_batch'
  and m.reference_id = b.id
  and b.status <> 'COMPLETED';

delete from inventory i
using production_batches b
where i.batch_id = b.id
  and b.status <> 'COMPLETED'
  and exists (
    select 1 from stock_movements m
    where m.movement_type = 'PRODUCTION'
      and m.reference_type = 'production_batch'
      and m.reference_id = i.batch_id
      and m.product_id = i.product_id
      and m.warehouse_id = i.warehouse_id
  );

-- What this deliberately does not fix, so it is visible rather than silent. A
-- completed batch whose output is not in stock is not repaired here: the
-- warehouse it should have gone to is not recorded anywhere the bug left behind,
-- and booking it against a guess is worse than reporting it. Re-complete the
-- batch through the app to book it, which rpc_complete_production_batch now
-- does atomically and exactly once.
do $$
declare
  r record;
begin
  for r in
    select b.batch_number, b.output_qty, b.output_product_id
    from production_batches b
    where b.status = 'COMPLETED'
      and coalesce(b.output_qty, 0) > 0
      and not exists (
        select 1 from inventory i
        where i.batch_id = b.id
          and i.product_id = b.output_product_id
          and i.quantity > 0
      )
  loop
    raise notice 'needs review: batch % is COMPLETED with output % but has no stock row for its output product %',
      r.batch_number, r.output_qty, r.output_product_id;
  end loop;
end $$;
