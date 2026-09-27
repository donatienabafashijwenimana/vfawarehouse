// Permission codes — mirror of the `permissions` table in supabase/schema.sql.
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  VARIETIES_VIEW: 'varieties.view',
  VARIETIES_CREATE: 'varieties.create',
  VARIETIES_UPDATE: 'varieties.update',
  VARIETIES_DELETE: 'varieties.delete',
  PRODUCTION_VIEW: 'production.view',
  PRODUCTION_CREATE: 'production.create',
  PRODUCTION_UPDATE: 'production.update',
  PRODUCTION_DELETE: 'production.delete',
  QUALITY_VIEW: 'quality.view',
  QUALITY_CREATE: 'quality.create',
  QUALITY_UPDATE: 'quality.update',
  WAREHOUSES_VIEW: 'warehouses.view',
  WAREHOUSES_MANAGE: 'warehouses.manage',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_ADJUST: 'inventory.adjust',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CANCEL: 'orders.cancel',
  SALES_VIEW: 'sales.view',
  SALES_CREATE: 'sales.create',
  SALES_UPDATE: 'sales.update',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_UPDATE: 'payments.update',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_UPDATE: 'expenses.update',
  EXPENSES_DELETE: 'expenses.delete',
  REPORTS_VIEW: 'reports.view',
  ARCHIVE_VIEW: 'archive.view',
  ARCHIVE_MANAGE: 'archive.manage',
  AUDIT_LOGS_VIEW: 'audit_logs.view',
  SETTINGS_MANAGE: 'settings.manage',
};

export const ALL_PERMISSION_CODES = Object.values(PERMISSIONS);

export const ROLES = {
  MANAGER: 'manager',
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

// Permissions granted implicitly by role (manager gets everything).
export const ROLE_PERMISSIONS = {
  manager: ALL_PERMISSION_CODES,
  customer: [],
  // A staff user runs the day-to-day production and warehouse workflow, so they
  // need the operational reads and writes for it. Completing a batch writes an
  // inventory row as well as the batch, so inventory.adjust belongs here too:
  // production_batches is gated on production.*, but the stock that completion
  // books in is gated separately on inventory.* (see supabase/schema.sql).
  // Anything that moves money, deletes records or manages people is left to a
  // manager.
  staff: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.VARIETIES_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.PRODUCTION_CREATE,
    PERMISSIONS.PRODUCTION_UPDATE,
    PERMISSIONS.QUALITY_VIEW,
    PERMISSIONS.QUALITY_CREATE,
    PERMISSIONS.QUALITY_UPDATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.REPORTS_VIEW,
  ],
};

export function hasPermission(perms = [], code) {
  return perms.includes(code);
}

export function hasAnyPermission(perms = [], codes = []) {
  return codes.some((c) => perms.includes(c));
}
