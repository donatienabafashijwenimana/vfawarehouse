-- PostgREST cannot resolve `product:products(name)` on production_batches any more.
--
-- 20260927000007 added output_product_id, so the table now has two foreign keys to
-- products: the planted one and the one the batch actually produced. An embed
-- that does not say which it means is ambiguous, and PostgREST refuses the whole
-- query rather than guessing — which takes loadWorkspace down with it, so the app
-- stops loading rather than just losing a column.
--
-- The fix is to disambiguate the embed with the foreign key's name
-- (`product:products!<constraint>(name)`). This migration gives both constraints
-- explicit, stable names so that hint cannot depend on PostgreSQL's automatic
-- naming and break silently.
--
-- The lookup finds each constraint by the column it sits on rather than by its
-- current name, so it is correct however the constraint was created.

do $$
declare
  v_table regclass := 'production_batches'::regclass;
  v_name text;
  v_column text;
  v_target text;
begin
  foreach v_column in array array['product_id', 'output_product_id'] loop
    if v_column = 'product_id' then
      v_target := 'batches_planted_product_fkey';
    else
      v_target := 'batches_output_product_fkey';
    end if;

    select conname into v_name
    from pg_constraint
    where conrelid = v_table
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = v_table and attname = v_column)
      ];

    if v_name is null then
      raise exception 'no foreign key found on production_batches.%, so % cannot be named', v_column, v_target;
    end if;

    if v_name <> v_target then
      execute format('alter table production_batches rename constraint %I to %I', v_name, v_target);
      raise notice 'renamed production_batches % (%) to %', v_name, v_column, v_target;
    end if;
  end loop;
end $$;

-- Both names must now resolve, or every batch query 400s. Saying so here turns a
-- runtime failure into a visible deploy-time one.
do $$
declare
  v_missing text;
begin
  select string_agg(expected.name, ', ')
  into v_missing
  from (values ('batches_planted_product_fkey'), ('batches_output_product_fkey')) as expected(name)
  where not exists (
    select 1 from pg_constraint
    where conrelid = 'production_batches'::regclass and conname = expected.name
  );

  if v_missing is not null then
    raise exception 'production_batches is missing the foreign key(s) the batch embeds rely on: %', v_missing;
  end if;

  raise notice 'production_batches: both product foreign keys are named and ready for disambiguated embeds';
end $$;
