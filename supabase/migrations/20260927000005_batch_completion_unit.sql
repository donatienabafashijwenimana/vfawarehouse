-- A batch may be counted in a unit other than the product's own unit: seed
-- potato is stored in kg but a harvest is often tallied in bag, crate or pallet.
-- Inventory, movements, quality checks and sales all work in the product's
-- unit, so the count is converted once at completion and the base-unit figure is
-- what gets stored. The unit and its factor live on the batch (not on the
-- product) because packing varies per batch, and they keep the original count
-- visible and reversible: entered = output_qty / completion_unit_factor.
--
-- completion_unit is null when the batch was completed in the product's own unit,
-- which is what every existing row means.

alter table production_batches
  add column if not exists completion_unit text,
  add column if not exists completion_unit_factor numeric(14,6) not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_completion_unit_factor_positive'
  ) then
    alter table production_batches
      add constraint production_batches_completion_unit_factor_positive check (completion_unit_factor > 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_completion_unit_named'
  ) then
    alter table production_batches
      add constraint production_batches_completion_unit_named check (completion_unit is null or btrim(completion_unit) <> '');
  end if;
end;
$$;

-- convert_production_qty mirrors src/lib/units.js: a count in the completion unit
-- expressed in the product's unit, rounded to the two decimals stock is stored at.
create or replace function convert_production_qty(p_qty numeric, p_factor numeric)
returns numeric language sql immutable set search_path = public as $$
  select round(coalesce(p_qty, 0) * case when coalesce(p_factor, 0) > 0 then p_factor else 1 end, 2);
$$;

-- The old four-argument signature is dropped first: adding defaulted parameters
-- would register a second overload instead of replacing this function.
drop function if exists public.rpc_complete_production_batch(uuid, numeric, numeric, uuid);

create or replace function rpc_complete_production_batch(
  p_batch_id uuid,
  p_output numeric,
  p_rejected numeric,
  p_warehouse uuid,
  p_completion_unit text default null,
  p_completion_unit_factor numeric default 1
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_product uuid;
  v_number text;
  v_base_unit text;
  v_unit text;
  v_factor numeric;
  v_output numeric;
  v_rejected numeric;
begin
  select b.product_id, b.batch_number, p.unit into v_product, v_number, v_base_unit
  from production_batches b join products p on p.id = b.product_id
  where b.id = p_batch_id;

  -- An override only counts when it is a different unit; p_completion_unit_factor
  -- defaults to 1 so existing callers keep the behaviour they had.
  v_unit := nullif(btrim(coalesce(p_completion_unit, '')), '');
  if v_unit is null or lower(v_unit) = lower(coalesce(v_base_unit, '')) then
    v_unit := null;
    v_factor := 1;
  else
    v_factor := p_completion_unit_factor;
    if coalesce(v_factor, 0) <= 0 then
      raise exception '1 % must be worth more than zero %', v_unit, v_base_unit
        using errcode = 'check_violation';
    end if;
  end if;

  v_output := convert_production_qty(p_output, v_factor);
  v_rejected := convert_production_qty(p_rejected, v_factor);

  update production_batches
  set status = 'COMPLETED',
      end_date = current_date,
      output_qty = v_output,
      rejected_qty = v_rejected,
      completion_unit = v_unit,
      completion_unit_factor = v_factor
  where id = p_batch_id;

  if v_output > 0 then
    -- One atomic upsert that adds the output exactly once: the row is created
    -- holding it, or an existing row is topped up by it. Seeding the row with
    -- the output and then adding it again books production stock twice.
    insert into inventory (product_id, batch_id, warehouse_id, quantity, updated_at)
    values (v_product, p_batch_id, p_warehouse, v_output, now())
    on conflict (product_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id)
    do update set quantity = inventory.quantity + excluded.quantity, updated_at = now();

    insert into stock_movements (product_id, batch_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values (v_product, p_batch_id, p_warehouse, 'PRODUCTION', v_output, 'production_batch', p_batch_id, 'Batch ' || v_number || ' completed', auth.uid());
  end if;
end;
$$;
