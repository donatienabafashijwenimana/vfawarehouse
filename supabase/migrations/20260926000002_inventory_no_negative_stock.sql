-- §37: stock may never go negative, and on-hand quantity must always cover the
-- quantity reserved, quarantined or written off against the row.
--
-- The application already rejects these writes (warehouseSlice.assertStockLevels),
-- but the workspace sync and any direct PostgREST/SQL write bypass the store, so
-- the database is the backstop that makes negative stock impossible.
--
-- NOT VALID is deliberate: the constraint is enforced for every new insert and
-- update, but existing rows are not scanned, so legacy over-committed rows cannot
-- block the deploy. The notice below reports how many rows still need review.

do $$
declare
  offenders integer;
begin
  select count(*) into offenders
  from inventory
  where quantity < 0
     or reserved_qty < 0
     or quarantined_qty < 0
     or damaged_qty < 0
     or quantity < reserved_qty + quarantined_qty + damaged_qty;

  if offenders > 0 then
    raise notice 'inventory: % existing row(s) hold negative or over-committed stock and still need correcting', offenders;
  end if;
end $$;

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
