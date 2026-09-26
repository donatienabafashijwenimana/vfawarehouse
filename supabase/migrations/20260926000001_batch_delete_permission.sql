drop policy if exists batches_delete on production_batches;
create policy batches_delete on production_batches for delete using (
  is_manager() or has_perm('production.delete')
);
