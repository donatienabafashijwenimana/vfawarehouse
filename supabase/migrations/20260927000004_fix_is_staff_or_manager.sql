-- is_staff_or_manager() used current_role_name(), which through PostgREST is
-- the connection role ('authenticated') and can never be 'manager' or 'staff',
-- so the helper was always false for API requests and batches_select silently
-- depended on has_perm('production.view') alone. Derive the caller's role from
-- their profile instead, mirroring how has_perm() resolves the user.

create or replace function is_staff_or_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('manager', 'staff') from profiles where id = auth.uid() and status = 'ACTIVE' and email_verified),
    false
  );
$$;
