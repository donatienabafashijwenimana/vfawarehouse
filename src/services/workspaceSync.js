import { getSupabase } from './supabase';

const TABLES = [
  ['categories', 'categories', (row) => pick(row, ['id', 'name', 'description', 'status'])],
  ['seedClasses', 'seed_classes', (row) => pick(row, ['id', 'name', 'description', 'status'])],
  ['varieties', 'varieties', (row) => pick(row, ['id', 'name', 'description', 'recommended_use', 'status'])],
  ['warehouses', 'warehouses', (row) => pick(row, ['id', 'name', 'location', 'description', 'manager', 'status'])],
  ['products', 'products', (row) => pick(row, ['id', 'name', 'sku', 'category_id', 'variety_id', 'seed_class_id', 'description', 'unit', 'selling_price', 'minimum_stock', 'status'])],
  ['customers', 'customers', (row) => pick(row, ['id', 'name', 'phone', 'email', 'address', 'customer_type', 'status', 'user_id'])],
  ['batches', 'production_batches', (row) => pick(row, ['id', 'batch_number', 'product_id', 'variety_id', 'seed_class_id', 'input_qty', 'output_qty', 'rejected_qty', 'start_date', 'end_date', 'status', 'quality_status', 'approved', 'notes', 'created_by', 'created_at'])],
  ['orders', 'orders', orderRow],
  ['sales', 'sales', (row, state) => ({ ...pick(row, ['id', 'invoice_number', 'customer_id', 'order_id', 'subtotal', 'discount', 'total', 'paid_amount', 'payment_status', 'notes', 'sale_date', 'created_at']), created_by: row.created_by_id ?? userId(state, row.created_by) })],
  ['inventory', 'inventory', (row) => pick(row, ['id', 'product_id', 'batch_id', 'warehouse_id', 'quantity', 'reserved_qty', 'quarantined_qty', 'damaged_qty', 'updated_at'])],
  ['movements', 'stock_movements', movementRow],
  ['stages', 'production_stages', (row) => pick(row, ['id', 'batch_id', 'name', 'sequence', 'status', 'started_at', 'completed_at', 'notes', 'created_at'])],
  ['qualityChecks', 'quality_checks', qualityRow],
  ['payments', 'payments', paymentRow],
  ['expenses', 'expenses', expenseRow],
  ['notifications', 'notifications', notificationRow],
  ['auditLogs', 'audit_logs', auditRow],
];

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function userId(state, value) {
  if (!value) return state.profile?.id ?? null;
  if (state.users.some((user) => user.id === value)) return value;
  return state.users.find((user) => user.fullName === value || user.full_name === value)?.id ?? state.profile?.id ?? null;
}

function orderRow(row, state) {
  return {
    ...pick(row, ['id', 'order_number', 'customer_id', 'status', 'expected_amount', 'paid_amount', 'remaining_amount', 'payment_status', 'notes', 'created_at']),
    created_by: row.created_by ?? state.profile?.id ?? null,
  };
}

function movementRow(row, state) {
  return {
    ...pick(row, ['id', 'product_id', 'batch_id', 'warehouse_id', 'movement_type', 'quantity', 'reference_type', 'reference_id', 'notes', 'created_at']),
    created_by: row.created_by_id ?? userId(state, row.created_by),
  };
}

function qualityRow(row, state) {
  return {
    ...pick(row, ['id', 'batch_id', 'inspection_date', 'status', 'grade', 'accepted_qty', 'rejected_qty', 'comments', 'created_at']),
    inspector: row.inspector_id ?? userId(state, row.inspector),
  };
}

function paymentRow(row, state) {
  return {
    ...pick(row, ['id', 'sale_id', 'order_id', 'order_number', 'customer_id', 'amount', 'method', 'reference', 'payment_date', 'status', 'confirmed_at', 'created_at']),
    evidence_url: typeof row.evidence === 'string' ? row.evidence : row.evidence?.data ?? null,
    evidence_name: row.evidence?.name ?? null,
    evidence_type: row.evidence?.type ?? null,
    confirmed_by: row.confirmed_by_id ?? userId(state, row.confirmed_by),
    recorded_by: row.recorded_by_id ?? userId(state, row.recorded_by),
  };
}

function expenseRow(row, state) {
  return {
    ...pick(row, ['id', 'category', 'description', 'amount', 'expense_date', 'payment_method', 'created_at']),
    recorded_by: row.recorded_by_id ?? userId(state, row.recorded_by),
  };
}

function notificationRow(row, state) {
  return { ...pick(row, ['id', 'type', 'title', 'message', 'read', 'created_at']), user_id: row.user_id ?? state.profile?.id };
}

function auditRow(row, state) {
  return { ...pick(row, ['id', 'action', 'module', 'created_at']), user_id: row.user_id ?? userId(state, row.user) };
}

function flattenItems(state, key, foreignKey) {
  return state[key].flatMap((parent) => (parent.items ?? []).map((item) => ({ ...item, [foreignKey]: parent.id })));
}

function normalizeChild(item, parentKey) {
  return {
    id: item.id,
    [parentKey]: item[parentKey],
    product_id: item.product_id,
    batch_id: item.batch_id ?? null,
    warehouse_id: item.warehouse_id ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price ?? 0,
    ...(parentKey === 'sale_id' ? { subtotal: item.subtotal ?? Number(item.quantity) * Number(item.unit_price ?? 0) } : {}),
  };
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function notifyOperation(supabase, body) {
  const { error } = await supabase.functions.invoke('notify-operation', { body });
  if (error) console.error('Email notification failed:', error.message);
}

async function syncRows(supabase, table, oldRows, nextRows, map, state, { mode = 'both' } = {}) {
  const oldById = new Map(oldRows.map((row) => [row.id, row]));
  const nextById = new Map(nextRows.map((row) => [row.id, row]));
  const removed = [...oldById.keys()].filter((id) => !nextById.has(id));
  if (mode !== 'upsert' && removed.length) {
    const { error } = await supabase.from(table).delete().in('id', removed);
    if (error) throw error;
  }
  if (mode === 'delete') return;
  for (const row of nextRows) {
    const old = oldById.get(row.id);
    const mapped = map(row, state);
    if (old && same(map(old, state), mapped)) continue;
    const { error } = await supabase.from(table).upsert(mapped, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function syncWorkspaceChanges(previous, next) {
  const supabase = await getSupabase();
  const changed = new Set(TABLES.filter(([key]) => !same(previous[key] ?? [], next[key] ?? [])).map(([key]) => key));
  if (!same(previous.users ?? [], next.users ?? [])) changed.add('users');
  const settingsChanged = !same(previous.settings, next.settings);
  if (settingsChanged) {
    const { error } = await supabase.from('settings').upsert({ id: next.settings.id, data: next.settings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  }

  const itemRows = {
    order_items: { old: flattenItems(previous, 'orders', 'order_id'), next: flattenItems(next, 'orders', 'order_id'), parent: 'orders', key: 'order_id' },
    sale_items: { old: flattenItems(previous, 'sales', 'sale_id'), next: flattenItems(next, 'sales', 'sale_id'), parent: 'sales', key: 'sale_id' },
  };
  const maps = new Map(TABLES.map(([key, table, map]) => [table, { key, table, map }]));
  maps.set('order_items', { key: 'orders', table: 'order_items', map: (row) => normalizeChild(row, 'order_id') });
  maps.set('sale_items', { key: 'sales', table: 'sale_items', map: (row) => normalizeChild(row, 'sale_id') });
  maps.set('notifications', { key: 'notifications', table: 'notifications', map: notificationRow });
  maps.set('audit_logs', { key: 'auditLogs', table: 'audit_logs', map: auditRow });

  const deleteOrder = ['payments', 'sale_items', 'sales', 'order_items', 'orders', 'movements', 'inventory', 'quality_checks', 'stages', 'batches', 'products', 'customers', 'warehouses', 'varieties', 'seed_classes', 'categories', 'expenses', 'notifications', 'audit_logs'];
  for (const table of deleteOrder) {
    const item = maps.get(table);
    if (!item || !changed.has(item.key)) continue;
    const rows = itemRows[table];
    await syncRows(supabase, table, rows?.old ?? previous[item.key] ?? [], rows?.next ?? next[item.key] ?? [], item.map, next, { mode: 'delete' });
  }

  const upsertOrder = ['categories', 'seed_classes', 'varieties', 'warehouses', 'products', 'customers', 'batches', 'orders', 'order_items', 'sales', 'sale_items', 'inventory', 'movements', 'stages', 'quality_checks', 'payments', 'expenses', 'notifications', 'audit_logs'];
  for (const table of upsertOrder) {
    const item = maps.get(table);
    if (!item || !changed.has(item.key)) continue;
    const rows = itemRows[table];
    await syncRows(supabase, table, rows?.old ?? previous[item.key] ?? [], rows?.next ?? next[item.key] ?? [], item.map, next, { mode: 'upsert' });
  }

  if (changed.has('users')) {
    const oldUsers = previous.users ?? [];
    const nextUsers = next.users ?? [];
    const oldById = new Map(oldUsers.map((user) => [user.id, user]));
    for (const user of nextUsers) {
      const old = oldById.get(user.id);
      if (old && same(old, user)) continue;
      if (!old) throw new Error('Create user accounts through Supabase Auth before adding their profile.');
      const updatedAt = new Date().toISOString();
      const { error } = await supabase.from('profiles').update({ full_name: user.fullName, role: user.role, status: user.status, permissions: user.permissions ?? [], updated_at: updatedAt }).eq('id', user.id);
      if (error) throw error;
      await notifyOperation(supabase, { type: 'user_updated', id: user.id, updatedAt });
    }
  }

  const oldOrders = new Map((previous.orders ?? []).map((order) => [order.id, order]));
  for (const order of next.orders ?? []) {
    const old = oldOrders.get(order.id);
    if (!old) await notifyOperation(supabase, { type: 'order_created', id: order.id });
    else if (old.status !== order.status) await notifyOperation(supabase, { type: 'order_status', id: order.id, status: order.status });
  }

  const oldPayments = new Map((previous.payments ?? []).map((payment) => [payment.id, payment]));
  for (const payment of next.payments ?? []) {
    const old = oldPayments.get(payment.id);
    if (!old) await notifyOperation(supabase, { type: 'payment_created', id: payment.id });
    else if (old.status !== payment.status) await notifyOperation(supabase, { type: 'payment_status', id: payment.id, status: payment.status });
  }
}
