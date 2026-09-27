-- A batch records the warehouse it is stored in.
--
-- It used to record none. Where a batch's output was could only be read by joining
-- production_batches to the inventory row completion booked into, which left two
-- gaps:
--
--   * A batch that is planned or in progress had no storage at all. Nothing could
--     say where the seed was meant to go before it was finished, so the destination
--     was a decision taken at the moment of completion, by whoever happened to be
--     at the keyboard, and nowhere else.
--   * Correcting where a completed batch sat meant editing the inventory row by
--     hand through the REST API, with no stock movement written. The batch and the
--     shelf then disagreed about where the output was, and the movement history
--     recorded the stock as still being where it had been booked.
--
-- warehouse_id names the warehouse the batch is stored in: for an open batch, the
-- one its output is destined for. It is required on a completed batch, mirroring
-- production_batches_output_product_matches_plant — a batch that claims to have
-- produced stock has to say where that stock is, and the row that books it is the
-- same warehouse the batch names.
--
-- Existing batches inherit the warehouse their stock is already in, which is the
-- only answer available for them. A batch whose output was spread over two
-- warehouses (a hand transfer, or stock added against the batch in a second
-- warehouse) is consolidated into the one holding most of it, with a transfer pair
-- so the movement history says the stock moved rather than silently reappearing.

alter table production_batches
  add column if not exists warehouse_id uuid references warehouses(id);

comment on column production_batches.warehouse_id is
  'The warehouse this batch is stored in — for an open batch, where its output is destined for. Required once the batch is COMPLETED.';

-- Backfill from the stock each batch already has. The keeper is the row holding
-- most of the batch''s output in the product that output is counted in, chosen
-- deterministically so a re-run finds nothing left to move.
do $$
declare
  b record;
  v_keep record;
  v_row record;
  v_warehouse uuid;
begin
  for b in
    select pb.id, pb.batch_number, coalesce(pb.output_product_id, pb.product_id) as product_id
    from production_batches pb
    where pb.warehouse_id is null
      and exists (select 1 from inventory i where i.batch_id = pb.id)
  loop
    select i.* into v_keep
    from inventory i
    where i.batch_id = b.id and i.product_id = b.product_id
    order by i.quantity desc, i.warehouse_id
    limit 1;

    if v_keep.id is null then
      -- No stock in the batch''s own product. Whatever it does hold is still the
      -- batch''s whereabouts, so the largest row names the warehouse — but nothing
      -- is consolidated, because moving stock recorded against a different product
      -- is not this migration''s call to make.
      select i.warehouse_id into v_warehouse
      from inventory i
      where i.batch_id = b.id
      order by i.quantity desc, i.warehouse_id
      limit 1;

      update production_batches set warehouse_id = v_warehouse where id = b.id;
      continue;
    end if;

    update production_batches set warehouse_id = v_keep.warehouse_id where id = b.id;

    for v_row in
      select * from inventory
      where batch_id = b.id
        and product_id = b.product_id
        and id <> v_keep.id
      order by id
    loop
      if v_row.quantity > 0 then
        insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        values (
          v_row.product_id, b.id, v_row.warehouse_id, 'TRANSFER', v_row.quantity,
          'production_batch', b.id, 'Batch ' || b.batch_number || ' storage recorded — stock moved to its warehouse', auth.uid()
        );
        insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
        values (
          v_keep.product_id, b.id, v_keep.warehouse_id, 'TRANSFER', v_row.quantity,
          'production_batch', b.id, 'Batch ' || b.batch_number || ' storage recorded — stock received', auth.uid()
        );
      end if;

      -- Every bucket is summed, not just the quantity: moving a row must not drop
      -- an order''s reservation or a quarantine on the way across.
      update inventory
      set quantity = quantity + v_row.quantity,
          reserved_qty = reserved_qty + v_row.reserved_qty,
          quarantined_qty = quarantined_qty + v_row.quarantined_qty,
          damaged_qty = damaged_qty + v_row.damaged_qty,
          updated_at = now()
      where id = v_keep.id;

      delete from inventory where id = v_row.id;
    end loop;
  end loop;
end;
$$;

-- Second source, for a batch whose stock is no longer on the shelf. An inventory
-- row can be gone while the PRODUCTION movement that created it survives, and that
-- movement names the warehouse the output was booked into. Taking it from there is
-- recording where the batch already says its output went, not choosing for it.
--
-- Only reached when the batch has no inventory row at all, so this is the last
-- word available. The largest movement is taken, and ties broken by warehouse, so a
-- re-run finds nothing left to infer and a batch whose output was moved around
-- lands on the same warehouse every time.
do $$
begin
  update production_batches pb
  set warehouse_id = source.warehouse_id
  from (
    select distinct on (m.batch_id) m.batch_id, m.warehouse_id
    from stock_movements m
    where m.batch_id is not null
      and m.movement_type = 'PRODUCTION'
      and m.warehouse_id is not null
      and not exists (select 1 from inventory i where i.batch_id = m.batch_id)
    order by m.batch_id, m.quantity desc, m.warehouse_id
  ) source
  where pb.id = source.batch_id
    and pb.warehouse_id is null
    and pb.status = 'COMPLETED';
end;
$$;

-- Checked before the constraint is added rather than after, so a table that cannot
-- satisfy it fails with the offending batches named instead of a bare constraint
-- error. Reaching here means the two passes above found nothing to inherit, so the
-- batch produced no output at all: no inventory row and no PRODUCTION movement.
-- There is no record anywhere of where that output went, because there was none, and
-- picking a warehouse for it would be recording a location nobody stored anything
-- in. Those are the only rows that can still be null here.
do $$
declare
  v_bad integer;
  v_sample text;
  v_ids text;
begin
  select count(*) into v_bad
  from production_batches
  where status = 'COMPLETED' and warehouse_id is null;

  if v_bad > 0 then
    -- %L quotes each id, so the statement in the message is runnable as printed.
    -- Unquoted it would fail with "column d0000000 does not exist", which would send
    -- the operator looking for a broken batch rather than at their own copy-paste.
    select string_agg(format('%s (%s)', batch_number, id), ' | '), string_agg(format('%L', id), ', ')
    into v_sample, v_ids
    from (
      select batch_number, id from production_batches
      where status = 'COMPLETED' and warehouse_id is null
      order by batch_number
      limit 5
    ) s;

    raise exception
      '% completed batch(es) recorded no stock and no production movement, so there is nowhere for them to inherit a warehouse from and this constraint cannot be added yet. The Edit form cannot be used to fix this: the column it writes to is part of the migration that just rolled back. 1) alter table production_batches add column if not exists warehouse_id uuid references warehouses(id); 2) update production_batches set warehouse_id = ''<warehouse id>'' where id in (%); 3) run the migration again — it skips the column it finds, keeps the warehouses just set, and adds the constraint. The batches needing a decision are: %',
      v_bad, v_ids, v_sample;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_storage_warehouse'
  ) then
    -- A null warehouse is only tolerated on a batch that has not been completed
    -- yet: nothing has been booked, so there is nowhere yet for the output to be.
    alter table production_batches
      add constraint production_batches_storage_warehouse
      check (status <> 'COMPLETED' or warehouse_id is not null);
  end if;
end;
$$;

comment on constraint production_batches_storage_warehouse on production_batches is
  'A completed batch must name the warehouse its output is stored in.';

-- Completing a batch now records the warehouse on the batch as well as on the
-- inventory row and the movement, so the batch says where its output is instead of
-- leaving that to be inferred by a join. The warehouse is checked before anything
-- is written: the column's constraint would catch a null, but not in words an
-- operator can act on.
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

-- Editing a batch can now change which warehouse it is stored in, and the stock
-- moves with it.
--
-- Previously the batch had nowhere to record a warehouse, so a completed batch
-- whose output was in the wrong place had to be corrected on the inventory row
-- through the REST API: no movement, no record of the batch saying so, and a batch
-- that named nowhere at all.
--
-- Moving the storage is treated exactly like correcting the output. The stock row
-- follows the batch to the new warehouse, merging into the row already holding
-- this batch's output there if there is one, and a TRANSFER pair records the
-- relocation the way every other movement between warehouses is recorded — the
-- PRODUCTION movement keeps the warehouse the output was booked into, which is what
-- happened then. The same refusals apply: a quality approved batch has been
-- inspected where it is, and stock that has been sold, reserved, quarantined or
-- written off cannot be relocated behind the paperwork that committed it.
--
-- Changing the output and the warehouse in one save is refused rather than guessed
-- at. The two are separate relocations of the same stock, and composing them in a
-- single pass would leave the movement history describing neither.
--
-- The old signature is dropped first: adding a defaulted parameter registers a
-- second overload rather than replacing this function, and PostgREST would then
-- refuse the call as ambiguous.
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

