-- Close the gap between what the client believes about stock and what the database
-- will accept.
--
-- assertStockLevels in warehouseSlice.js enforces two things on every mutation:
-- the on-hand quantity never goes below zero, AND the quantity still covers what is
-- reserved, quarantined or written off against the row. The database only enforced
-- the first. inventory_no_negative_stock checks each bucket against zero
-- independently, so a row of quantity 50 with reserved_qty 80 satisfies it, and
--
--   available = quantity - reserved - quarantined - damaged
--
-- reads -30. The client never gets that far, but three things do not come from the
-- client:
--
--   * The diff-sync upsert. workspaceSync writes quantity, reserved_qty,
--     quarantined_qty and damaged_qty together from whatever that tab happens to be
--     holding. A tab that has not seen another tab's reservation writes its own
--     stale reserved_qty over the real one, discarding the earmark. Two tabs
--     confirming two orders against the same last 50 both see 50 available, and the
--     loser's upsert puts reserved_qty back to 50 rather than 100. Both orders are
--     then promised stock that was only ever counted once.
--   * rpc_update_production_batch, which guards its own rows, but only the ones it
--     is asked about.
--   * Anything reaching the REST API directly.
--
-- So the second half of the invariant is asserted in a browser tab and nowhere else.
-- This puts it in the table, where every path has to pass through it.
--
-- Existing rows are checked before the constraint is added rather than after, so a
-- table that already violates it fails the migration with the offending rows named
-- instead of a bare "violates check constraint".

do $$
declare
  v_bad integer;
  v_sample text;
begin
  select count(*) into v_bad
  from inventory
  where reserved_qty + quarantined_qty + damaged_qty > quantity;

  if v_bad > 0 then
    select string_agg(format('%s (product %s, warehouse %s): %s on hand, %s committed',
      i.id, i.product_id, i.warehouse_id, i.quantity,
      i.reserved_qty + i.quarantined_qty + i.damaged_qty), ' | ') into v_sample
    from (select * from inventory
          where reserved_qty + quarantined_qty + damaged_qty > quantity
          order by quantity limit 5) i;

    raise exception
      '% inventory row(s) have more reserved, quarantined or damaged stock than they hold on hand, so this constraint cannot be added yet: %',
      v_bad, v_sample;
  end if;
end;
$$;

alter table inventory
  drop constraint if exists inventory_covers_committed_stock;

alter table inventory
  add constraint inventory_covers_committed_stock
  check (reserved_qty + quarantined_qty + damaged_qty <= quantity);

-- The two constraints together are the whole rule, and they are named apart so a
-- refusal says which half was broken: a bare "check constraint" error does not.
comment on constraint inventory_covers_committed_stock on inventory is
  'On-hand stock must still cover everything reserved, quarantined or written off against the row.';

-- rpc_adjust_inventory had no lower bound on p_quantity. It happened to be caught —
-- a negative adjustment trips the movement's own quantity > 0 constraint, which
-- aborts the transaction — but only after the inventory update had already run, and
-- the operator saw a stock_movement error instead of being told the adjustment was
-- malformed. The direction is checked too: anything that is not 'in' or 'out' fell
-- through both branches and did nothing at all, silently.
create or replace function rpc_adjust_inventory(
  p_product uuid,
  p_batch uuid,
  p_warehouse uuid,
  p_direction text,   -- 'in' | 'out'
  p_quantity numeric,
  p_notes text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_direction not in ('in', 'out') then
    raise exception 'Adjustment direction must be ''in'' or ''out'', not %', p_direction
      using errcode = 'check_violation';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Adjustment quantity must be greater than zero, not %', p_quantity
      using errcode = 'check_violation';
  end if;

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
    -- The same available-stock test the client makes, and the same reason: taking
    -- stock that is already promised to an order leaves a negative availability
    -- even though quantity itself is still positive.
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
