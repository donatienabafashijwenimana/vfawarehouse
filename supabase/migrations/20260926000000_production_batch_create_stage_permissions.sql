drop policy if exists stages_write on production_stages;
drop policy if exists stages_insert on production_stages;
drop policy if exists stages_update on production_stages;
drop policy if exists stages_delete on production_stages;

create policy stages_insert on production_stages for insert with check (
  has_perm('production.create') or has_perm('production.update')
);

create policy stages_update on production_stages for update using (
  has_perm('production.update')
) with check (has_perm('production.update'));

create policy stages_delete on production_stages for delete using (
  has_perm('production.update')
);
