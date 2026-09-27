-- Stock produced by a batch cannot be sold until a quality check on that batch
-- is APPROVED.
--
-- Where the gate lives and why it is a trigger on sale_items rather than a check
-- inside rpc_create_sale: the application does not call that function. Every sale
-- is assembled in the browser by salesSlice.createSale and pushed by the workspace
-- sync. A guard placed only in the RPC would never run.
--
-- sale_items rather than stock_movements, because of the order the workspace sync
-- writes tables in (src/services/workspaceSync.js): sales, sale_items, inventory,
-- movements — each as its own transaction. A trigger on stock_movements would
-- fire after the invoice line and the stock decrement had already been committed,
-- leaving a sale with no movement against it. sale_items is written first, so
-- refusing there stops the write before any stock moves.
--
-- Only invoicing is gated. Reserving stock does not move it out of the warehouse,
-- so an order can still be confirmed; salesSlice.confirmOrder allocates only
-- batches that are approved, so it reserves stock it can actually invoice.
--
-- Stock with no batch (batch_id null) is not traceable to a batch and so has no
-- quality check to wait for. It stays sellable.

create or replace function enforce_approved_batch_before_sale()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_number text;
  v_status quality_status;
begin
  if new.batch_id is null then
    return new;
  end if;

  select b.batch_number, b.quality_status
  into v_number, v_status
  from production_batches b
  where b.id = new.batch_id;

  -- The foreign key would catch a missing batch, but naming it here means the
  -- refusal reads as a traceability problem rather than a constraint violation.
  if v_status is null then
    raise exception 'This sale refers to batch % which does not exist', new.batch_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_status <> 'APPROVED' then
    raise exception 'Batch % is % and cannot be sold until a quality check approves it',
      coalesce(v_number, new.batch_id::text), v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists sale_items_require_approved_batch on sale_items;

create trigger sale_items_require_approved_batch
  before insert on sale_items
  for each row
  execute function enforce_approved_batch_before_sale();

-- Sells that already happened against a batch that was never checked are left
-- alone. Rewriting history is not this migration's job, but the count is
-- reported so it is not a silent surprise.
do $$
declare
  n bigint;
begin
  select count(*) into n
  from stock_movements m
  join production_batches b on b.id = m.batch_id
  where m.movement_type = 'SALE' and b.quality_status <> 'APPROVED';
  raise notice 'quality gate: % existing SALE movement(s) reference a batch that is not APPROVED (left as they are)', n;
end $$;
