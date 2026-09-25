create unique index if not exists customers_email_unique_idx
  on public.customers (lower(btrim(email)))
  where email is not null and btrim(email) <> '';
