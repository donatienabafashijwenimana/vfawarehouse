import { getSupabase } from './supabase';
import { batchStorageMissing } from './dataService';

/** Drops the storage warehouse key when the database has no such column. */
function withoutStorage(row) {
  if (!batchStorageMissing()) return row;
  const rest = { ...row };
  delete rest.warehouse_id;
  return rest;
}

const TABLES = [
  ['categories', 'categories', (row) => pick(row, ['id', 'name', 'description', 'status'])],
  ['seedClasses', 'seed_classes', (row) => pick(row, ['id', 'name', 'description', 'status'])],
  ['varieties', 'varieties', (row) => pick(row, ['id', 'name', 'description', 'recommended_use', 'status'])],
  ['warehouses', 'warehouses', (row) => pick(row, ['id', 'name', 'location', 'description', 'manager', 'status'])],
  ['products', 'products', (row) => pick(row, ['id', 'name', 'sku', 'category_id', 'variety_id', 'seed_class_id', 'description', 'unit', 'selling_price', 'minimum_stock', 'status'])],
  ['customers', 'customers', (row) => pick(row, ['id', 'name', 'phone', 'email', 'address', 'customer_type', 'status', 'user_id'])],
  // warehouse_id is dropped while the database has no such column. The store keeps
  // the key on every batch, so pick() cannot leave it out on its own; sending it as
  // a null would fail the whole batch table — and with it the sync of every other
  // table in this loop — on a Postgres error about a column the app already knows
  // is not there. Nothing is lost: the column holds null for those batches anyway.
  ['batches', 'production_batches', (row) => withoutStorage(pick(row, ['id', 'batch_number', 'product_id', 'output_product_id', 'variety_id', 'seed_class_id', 'input_qty', 'output_qty', 'rejected_qty', 'start_date', 'end_date', 'status', 'quality_status', 'approved', 'warehouse_id', 'notes', 'created_by', 'created_at']))],
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

// Declared without the state argument the other mappers take, because it is no
// longer read. It is still called as map(row, state), which is harmless.
function notificationRow(row) {
  // user_id is carried through as it is stored, and a null is left null. Defaulting
  // it to the signed-in user made every broadcast — the admin notice with no
  // addressee, which is the same row for everybody — indistinguishable from a
  // personal one, and the next flush wrote that back and turned the broadcast into
  // this user's private notification. It also hid the difference the delete policy
  // turns on: a user may delete their own, but not a broadcast they merely read.
  return { ...pick(row, ['id', 'user_id', 'type', 'title', 'message', 'read', 'created_at']) };
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

/**
 * Insert-or-update every changed row (upsert on id). A row that the database
 * rejects is collected instead of aborting the loop, so one bad record can no
 * longer block the rest of its table (e.g. batches) from being saved.
 */
async function syncRows(supabase, table, oldRows, nextRows, map, state, { mode = 'both' } = {}) {
  const oldById = new Map(oldRows.map((row) => [row.id, row]));
  const nextById = new Map(nextRows.map((row) => [row.id, row]));
  const removed = [...oldById.keys()].filter((id) => !nextById.has(id));
  const errors = [];
  if (mode !== 'upsert' && removed.length) {
    const { error } = await supabase.from(table).delete().in('id', removed);
    if (error) errors.push(error.message);
  }
  if (mode !== 'delete') {
    for (const row of nextRows) {
      const old = oldById.get(row.id);
      const mapped = map(row, state);
      if (old && same(map(old, state), mapped)) continue;
      const { error } = await supabase.from(table).upsert(mapped, { onConflict: 'id' });
      if (error) errors.push(error.message);
    }
  }
  if (errors.length) throw new Error(errors.join(' · '));
}

async function ensureInventoryBatchReferences(supabase, inventory, batches, state) {
  const batchIds = [...new Set(inventory.map((row) => row.batch_id).filter(Boolean))];
  if (!batchIds.length) return;

  const { data: existing, error: lookupError } = await supabase
    .from('production_batches')
    .select('id')
    .in('id', batchIds);
  if (lookupError) throw lookupError;

  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const localBatches = new Map(batches.map((batch) => [batch.id, batch]));
  const missingIds = batchIds.filter((id) => !existingIds.has(id));
  if (!missingIds.length) return;

  const missingRows = missingIds.map((id) => localBatches.get(id));
  const missingLocal = missingIds.filter((_, index) => !missingRows[index]);
  if (missingLocal.length) {
    throw new Error(`Inventory refers to missing production batch ${missingLocal.join(', ')}. Restore or correct the batch reference before saving.`);
  }

  const batchMapper = TABLES.find(([key]) => key === 'batches')[2];
  const { error: insertError } = await supabase
    .from('production_batches')
    .upsert(missingRows.map((row) => batchMapper(row, state)), { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) throw insertError;
}

export async function syncWorkspaceChanges(previous, next) {
  const supabase = await getSupabase();
  const changed = new Set(TABLES.filter(([key]) => !same(previous[key] ?? [], next[key] ?? [])).map(([key]) => key));
  if (!same(previous.users ?? [], next.users ?? [])) changed.add('users');
  const failures = [];
  const settingsChanged = !same(previous.settings, next.settings);
  if (settingsChanged) {
    const { error } = await supabase.from('settings').upsert({ id: next.settings.id, data: next.settings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) failures.push({ key: 'settings', message: `settings: ${error.message}` });
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
    try {
      await syncRows(supabase, table, rows?.old ?? previous[item.key] ?? [], rows?.next ?? next[item.key] ?? [], item.map, next, { mode: 'delete' });
    } catch (error) {
      failures.push({ key: item.key, message: `${table}: ${error.message}` });
    }
  }

  // Stock first, then the records that depend on it. Each table syncs in its own
  // try/catch and the failure is retried on the next flush, so the order decides
  // what an interrupted sync leaves behind. With inventory written after the sale,
  // an interruption in between commits the sale and loses the decrement: the
  // warehouse then permanently overstates that stock by the amount sold, and the
  // next sale against it takes quantity below what is really there. Reordering
  // means the worst case is stock moved without its paperwork — visible, and the
  // flush retries it — rather than paperwork without the stock.
  const upsertOrder = ['categories', 'seed_classes', 'varieties', 'warehouses', 'products', 'customers', 'batches', 'inventory', 'movements', 'orders', 'order_items', 'sales', 'sale_items', 'stages', 'quality_checks', 'payments', 'expenses', 'notifications', 'audit_logs'];
  for (const table of upsertOrder) {
    const item = maps.get(table);
    if (!item || !changed.has(item.key)) continue;
    try {
      if (table === 'inventory') await ensureInventoryBatchReferences(supabase, next.inventory ?? [], next.batches ?? [], next);
      const rows = itemRows[table];
      await syncRows(supabase, table, rows?.old ?? previous[item.key] ?? [], rows?.next ?? next[item.key] ?? [], item.map, next, { mode: 'upsert' });
    } catch (error) {
      failures.push({ key: item.key, message: `${table}: ${error.message}` });
    }
  }

  if (changed.has('users')) {
    const oldUsers = previous.users ?? [];
    const nextUsers = next.users ?? [];
    const oldById = new Map(oldUsers.map((user) => [user.id, user]));
    for (const user of nextUsers) {
      const old = oldById.get(user.id);
      if (old && same(old, user)) continue;
      if (!old) throw new Error('Create user accounts through Supabase Auth before adding their profile.');
      try {
        const updatedAt = new Date().toISOString();
        const { error } = await supabase.from('profiles').update({ full_name: user.fullName, role: user.role, status: user.status, permissions: user.permissions ?? [], updated_at: updatedAt }).eq('id', user.id);
        if (error) throw error;
        await notifyOperation(supabase, { type: 'user_updated', id: user.id, updatedAt });
      } catch (error) {
        failures.push({ key: 'users', message: `profiles: ${error.message}` });
      }
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

  // Report every failed table at once, and tell the caller which store keys to
  // keep dirty so the failed rows are retried while the saved ones are not.
  if (failures.length) {
    const error = new Error(failures.map((f) => f.message).join(' · '));
    error.failedKeys = [...new Set(failures.map((f) => f.key))];
    throw error;
  }
}
