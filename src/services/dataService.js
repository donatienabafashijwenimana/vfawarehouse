// Supabase CRUD for application tables. The Zustand store is hydrated from
// these queries after authentication and is not a persistent data store.
import { getSupabase } from './supabase';

async function list(table, select = '*', order = { column: 'created_at', ascending: false }) {
  const supabase = await getSupabase();
  let q = supabase.from(table).select(select);
  if (order) q = q.order(order.column, { ascending: order.ascending });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function insert(table, row) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function update(table, id, fields) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(table).update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function remove(table, id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Catalog -------------------------------------------------------------
export const categoriesApi = {
  list: () => list('categories', '*', { column: 'name' }),
  create: (row) => insert('categories', row),
  update: (id, f) => update('categories', id, f),
  remove: (id) => remove('categories', id),
};

export const seedClassesApi = {
  list: () => list('seed_classes', '*', { column: 'name' }),
  create: (row) => insert('seed_classes', row),
  update: (id, f) => update('seed_classes', id, f),
  remove: (id) => remove('seed_classes', id),
};

export const varietiesApi = {
  list: () => list('varieties', '*', { column: 'name' }),
  create: (row) => insert('varieties', row),
  update: (id, f) => update('varieties', id, f),
  remove: (id) => remove('varieties', id),
};

export const productsApi = {
  list: () =>
    list(
      'products',
      '*, variety:varieties(name), seed_class:seed_classes(name)',
      { column: 'created_at', ascending: false }
    ),
  create: (row) => insert('products', row),
  update: (id, f) => update('products', id, f),
  remove: (id) => remove('products', id),
};

// Production ------------------------------------------------------------
export const batchesApi = {
  list: () =>
    list(
      'production_batches',
      '*, product:products(name), variety:varieties(name), seed_class:seed_classes(name), created_by_profile:profiles(full_name)',
      { column: 'created_at', ascending: false }
    ),
  get: async (id) => {
    const supabase = await getSupabase();
    return supabase
      .from('production_batches')
      .select(
        '*, product:products(name), variety:varieties(name), seed_class:seed_classes(name), created_by_profile:profiles(full_name), stages:production_stages(*), quality_checks(*)'
      )
      .eq('id', id)
      .single();
  },
  create: (row) => insert('production_batches', row),
  update: (id, f) => update('production_batches', id, f),
  remove: (id) => remove('production_batches', id),
  completeBatch: async (batchId) => {
    const supabase = await getSupabase();
    return supabase.rpc('complete_production_batch', { p_batch_id: batchId });
  },
  createQualityCheck: (row) => insert('quality_checks', row),
};

export const stagesApi = {
  list: () => list('production_stages', '*', { column: 'created_at', ascending: false }),
  create: (row) => insert('production_stages', row),
  update: (id, f) => update('production_stages', id, f),
};

// Warehouse -------------------------------------------------------------
export const warehousesApi = {
  list: () => list('warehouses', '*', { column: 'name' }),
  create: (row) => insert('warehouses', row),
  update: (id, f) => update('warehouses', id, f),
};

export const inventoryApi = {
  list: () =>
    list(
      'inventory',
      '*, product:products(name), batch:production_batches(batch_number), warehouse:warehouses(name)',
      { column: 'updated_at', ascending: false }
    ),
  adjust: async (payload) => {
    const supabase = await getSupabase();
    return supabase.rpc('adjust_inventory', payload);
  },
};

export const movementsApi = {
  list: () =>
    list(
      'stock_movements',
      '*, product:products(name), batch:production_batches(batch_number), warehouse:warehouses(name), created_by_profile:profiles(full_name)',
      { column: 'created_at', ascending: false }
    ),
};

// Sales -----------------------------------------------------------------
export const customersApi = {
  list: () => list('customers', '*', { column: 'name' }),
  create: (row) => insert('customers', row),
  update: (id, f) => update('customers', id, f),
  remove: (id) => remove('customers', id),
};

export const ordersApi = {
  list: () =>
    list(
      'orders',
      '*, customer:customers(name), items:order_items(*, product:products(name))',
      { column: 'created_at', ascending: false }
    ),
  create: (row) => insert('orders', row),
  update: (id, f) => update('orders', id, f),
  cancel: async (id) => {
    const supabase = await getSupabase();
    return supabase.rpc('cancel_order', { p_order_id: id });
  },
};

export const salesApi = {
  list: () =>
    list(
      'sales',
      '*, customer:customers(name), order:orders(order_number), items:sale_items(*, product:products(name)), created_by_profile:profiles(full_name)',
      { column: 'created_at', ascending: false }
    ),
  create: async (payload) => {
    const supabase = await getSupabase();
    return supabase.rpc('create_sale', payload);
  },
  update: (id, f) => update('sales', id, f),
};

export const paymentsApi = {
  list: () =>
    list(
      'payments',
      '*, customer:customers(name), sale:sales(invoice_number), order:orders(order_number)',
      { column: 'created_at', ascending: false }
    ),
  create: (row) => insert('payments', row),
  update: (id, f) => update('payments', id, f),
};

// Finance ---------------------------------------------------------------
export const expenseCategoriesApi = {
  list: () => list('expense_categories', '*', { column: 'name' }),
  create: (row) => insert('expense_categories', row),
};

export const expensesApi = {
  list: () =>
    list(
      'expenses',
      '*, recorded_by_profile:profiles(full_name)',
      { column: 'expense_date', ascending: false }
    ),
  create: (row) => insert('expenses', row),
  update: (id, f) => update('expenses', id, f),
  remove: (id) => remove('expenses', id),
};

// System ----------------------------------------------------------------
export const usersApi = {
  list: () => list('profiles', '*', { column: 'created_at', ascending: false }),
  get: (id) => (async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  })(),
  update: (id, f) => update('profiles', id, f),
};

export const qualityChecksApi = {
  list: () => list('quality_checks', '*, inspector_profile:profiles(full_name)', { column: 'created_at', ascending: false }),
  create: (row) => insert('quality_checks', row),
  update: (id, f) => update('quality_checks', id, f),
};

export const rolesApi = {
  list: () =>
    list('roles', '*, role_permissions:role_permissions(permissions(code))', { column: 'name' }),
  updatePermissions: async (roleId, codes) => {
    const supabase = await getSupabase();
    return supabase.rpc('set_role_permissions', { p_role_id: roleId, p_permission_codes: codes });
  },
};

export const notificationsApi = {
  list: () => list('notifications', '*', { column: 'created_at', ascending: false }),
  markRead: (id) => update('notifications', id, { read: true }),
  markAllRead: async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getUser();
    return supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', data.user.id)
      .eq('read', false);
  },
};

export const auditLogsApi = {
  list: () =>
    list(
      'audit_logs',
      '*, user_profile:profiles(full_name)',
      { column: 'created_at', ascending: false }
    ),
};

export const settingsApi = {
  get: async () => {
    const supabase = await getSupabase();
    return supabase
      .from('settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  },
  update: async (fields) => {
    const supabase = await getSupabase();
    return supabase.rpc('update_settings', { p_settings: fields });
  },
};
