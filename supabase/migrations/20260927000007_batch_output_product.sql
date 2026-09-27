-- A farmer plants one product and can finish with another: the batch is sown as
-- seed maize (kg) and comes off as something else entirely, counted in that
-- product's own unit. There is no conversion between the two, because they are
-- different products with different units, not two units of one product.
--
-- output_product_id records what the batch actually produced. The planted product
-- stays on product_id, so both remain readable and nothing is lost by completing
-- a batch as a different product.
--
-- This replaces the completion_unit / completion_unit_factor pair from
-- 20260927000005: a factor between a product and its own unit was the wrong model
-- for a farmer whose output is not the product he planted. Those columns are
-- dropped and their data is preserved in the products it referred to.

alter table production_batches
  add column if not exists output_product_id uuid references products(id);

-- Every existing batch produced what it planted, which is the meaning the old
-- completion_unit had for all of them.
update production_batches
set output_product_id = product_id
where output_product_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'production_batches_output_product_matches_plant'
  ) then
    -- A null output product would leave completion unable to book stock, so it is
    -- only tolerated on a batch that has not been completed yet.
    alter table production_batches
      add constraint production_batches_output_product_matches_plant
      check (status <> 'COMPLETED' or output_product_id is not null);
  end if;
end;
$$;

alter table production_batches
  drop column if exists completion_unit,
  drop column if exists completion_unit_factor;

drop function if exists public.convert_production_qty(numeric, numeric);

-- The old signatures are dropped first: adding defaulted parameters would
-- register a second overload instead of replacing this function.
drop function if exists public.rpc_complete_production_batch(uuid, numeric, numeric, uuid, text, numeric);
drop function if exists public.rpc_complete_production_batch(uuid, numeric, numeric, uuid);

-- p_output_product defaults to whatever the batch already records, so a caller
-- that has not been updated completes the batch as the product it planted.
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
      output_product_id = v_product
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
