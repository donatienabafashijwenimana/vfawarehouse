-- A staff profile is created with an empty permission list, and the row-level
-- security policies on production_batches and inventory are written in terms of
-- has_perm('production.update') / has_perm('inventory.adjust'). That combination
-- left staff unable to record a batch: production_batches is readable
-- (is_staff_or_manager) but every write matched zero rows, and a zero-row update
-- raises no error, so the application reported success while nothing changed.
--
-- This grants the operational permissions a staff user needs, matching the
-- `staff` entry in src/lib/permissions.js. Only profiles that are still on the
-- empty default are touched, so anybody who has already been given a deliberate
-- set of permissions keeps it.

update profiles
set permissions = array[
      'dashboard.view',
      'products.view',
      'categories.view',
      'varieties.view',
      'customers.view',
      'customers.create',
      'customers.update',
      'production.view',
      'production.create',
      'production.update',
      'quality.view',
      'quality.create',
      'quality.update',
      'inventory.view',
      'inventory.update',
      'inventory.adjust',
      'orders.view',
      'orders.create',
      'orders.update',
      'sales.view',
      'sales.create',
      'payments.view',
      'payments.create',
      'reports.view'
    ],
    updated_at = now()
where role = 'staff'
  and status = 'ACTIVE'
  and coalesce(array_length(permissions, 1), 0) = 0;
