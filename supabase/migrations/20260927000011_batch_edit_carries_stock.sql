-- Editing a completed batch has to carry the stock booked by completion with it.
--
-- Previously a correction wrote only production_batches, so the batch and the
-- stock it had booked drifted apart: the batch said 500, the warehouse said 480,
-- and nothing recorded which was right. Completing a batch through the edit form
-- was also possible, which would book the output a second time.
--
-- This puts the batch and its stock behind one function, so a correction either
-- lands on both or on neither.
--
-- What may be changed, and when:
--
--   * Traceability fields (batch number, planted product, variety, seed class,
--     input, dates, notes) are free. None of them touch stock.
--   * output_qty and output_product_id rewrite the stock row and the PRODUCTION
--     movement that booked it, as the operator asked — in place, not as a
--     correcting entry, so there is one row of truth per batch.
--   * They are refused once the batch is quality APPROVED, because an approved
--     quantity is a statement about what was inspected.
--   * They are refused once any of the stock has been sold, reserved, quarantined
--     or written off. The reservation check matters: an order confirmed against
--     this batch has already been promised to a customer.
--   * Taking a completed batch back out of COMPLETED releases its stock, so
--     re-completing books the output once rather than twice.
--
-- The rejected cases raise rather than clamp, so a refused edit leaves nothing
-- half-applied and the operator is told which batch and why.

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
  p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  b production_batches%rowtype;
  v_inv inventory%rowtype;
  v_target inventory%rowtype;
  v_number text;
  v_output_product uuid;
  v_new_status production_status;
  v_new_output numeric;
  v_new_rejected numeric;
  v_stock_changed boolean := false;
  v_reopening boolean := false;
  v_movements integer;
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
  v_new_status := coalesce(p_status, b.status);
  v_new_output := coalesce(p_output_qty, b.output_qty);
  v_new_rejected := coalesce(p_rejected_qty, b.rejected_qty);

  if v_new_output < 0 or v_new_rejected < 0 then
    raise exception 'Output and rejected quantities cannot be negative' using errcode = 'check_violation';
  end if;
  if coalesce(p_input_qty, b.input_qty) <= 0 then
    raise exception 'Input quantity must be greater than zero' using errcode = 'check_violation';
  end if;

  -- Becoming COMPLETED is what books stock, and that is the completion flow's job.
  -- Letting the edit form do it here would book the output outside the one
  -- transaction that completion guarantees.
  if b.status <> 'COMPLETED' and v_new_status = 'COMPLETED' then
    raise exception 'Batch % can only be completed from the Complete action, which is what books its stock', v_number
      using errcode = 'check_violation';
  end if;

  select * into v_inv from inventory where batch_id = p_batch_id;

  -- Has any of this batch's stock left the shelf, or been promised to somebody?
  -- quantity below the completed figure means net outflow; the other three are
  -- stock this batch is still answerable for but must not quietly re-cut.
  v_spent := v_inv.id is not null and (
    v_inv.quantity < b.output_qty
    or v_inv.reserved_qty > 0
    or v_inv.quarantined_qty > 0
    or v_inv.damaged_qty > 0
  );

  v_stock_changed := b.status = 'COMPLETED' and (
    v_output_product is distinct from b.output_product_id
    or v_new_output is distinct from b.output_qty
  );
  v_reopening := b.status = 'COMPLETED' and v_new_status <> 'COMPLETED';

  if (v_stock_changed or v_reopening) and b.quality_status = 'APPROVED' then
    raise exception 'Batch % is quality approved, so its stock is locked. Record a further quality check before changing it.', v_number
      using errcode = 'check_violation';
  end if;

  if (v_stock_changed or v_reopening) and v_spent then
    raise exception 'Stock from batch % has already been sold, reserved or written off, so it cannot be changed', v_number
      using errcode = 'check_violation';
  end if;

  -- Checked before anything is written, so a batch whose movements cannot be
  -- matched is refused outright rather than half-corrected.
  if v_stock_changed and v_inv.id is not null then
    select count(*) into v_movements
    from stock_movements
    where batch_id = p_batch_id
      and movement_type = 'PRODUCTION'
      and reference_type = 'production_batch';

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
        and movement_type = 'PRODUCTION'
        and reference_type = 'production_batch';
    else
      delete from stock_movements
      where batch_id = p_batch_id
        and movement_type = 'PRODUCTION'
        and reference_type = 'production_batch';
    end if;
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
      notes = p_notes
  where id = p_batch_id;
end;
$$;
