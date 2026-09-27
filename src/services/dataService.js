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

// Select strings shared by the list queries and by the read-back that follows a
// direct write, so a row mirrored into the store after a write is shaped exactly
// like a row the app hydrates on load. A different shape reads as a change to
// the next diff-sync and gets written straight back.
//
// production_batches has two foreign keys to products — the planted one and the
// one the batch actually produced (output_product_id, added by
// 20260927000007). An embed that does not name the constraint is ambiguous and
// PostgREST rejects the whole query, so both are spelled out. The constraint names
// are set by 20260927000010.
const BATCH_SELECT =
  '*, product:products!batches_planted_product_fkey(name), output_product:products!batches_output_product_fkey(name), variety:varieties(name), seed_class:seed_classes(name), warehouse:warehouses(name), created_by_profile:profiles(full_name)';
// The same read for a database that has not had 20260927000016 applied yet.
const BATCH_SELECT_NO_STORAGE = BATCH_SELECT.replace(', warehouse:warehouses(name)', '');
const INVENTORY_SELECT = '*, product:products(name), batch:production_batches(batch_number), warehouse:warehouses(name)';
const MOVEMENT_SELECT =
  '*, product:products(name), batch:production_batches(batch_number), warehouse:warehouses(name), created_by_profile:profiles(full_name)';

// The storage warehouse is an additive change (20260927000016), and the client is
// deployed separately from the database, so the app can legitimately be running
// against a database that predates it. The batch read asks for the column and the
// embed optimistically, and on the two errors that mean exactly that, retries once
// without them.
//
// Without this the app does not merely lose a column: batches are part of the
// workspace load, so one unrecognised column 400s the whole load and the app stops
// starting — for a feature that is merely not switched on yet. Falling back loses
// the storage column and nothing else, so every other part of the workspace loads
// and the batches themselves are all still there.
//
// Only those two errors are treated this way. Any other failure is rethrown: a real
// permissions problem or a dropped table must not be reported as "no storage
// column", or the cause would be hidden behind a fallback that cannot fix it.
const BATCH_STORAGE_MIGRATION = '20260927000016_batch_storage_warehouse.sql';
const batchStorage = { known: false };

function isMissingBatchStorage(error) {
  if (!error) return false;
  const text = `${error.message || ''}`;
  if (error.code === 'PGRST200') return text.includes('warehouses') && text.includes('production_batches');
  if (error.code === '42703') return text.includes('warehouse_id');
  return false;
}

/** Whether the storage column was found to be absent from this database. */
export function batchStorageMissing() {
  return batchStorage.known && !batchStorage.present;
}

/**
 * Runs a production_batches query, retrying without the storage column if this
 * database does not have it. `probe` re-tests the column even after a miss, so a
 * database that is migrated while the tab is open starts using it on the next
 * workspace load rather than staying on the fallback until the page is reloaded.
 */
async function selectBatches(probe, run) {
  const supabase = await getSupabase();
  const wants = probe || !batchStorage.known || batchStorage.present;
  let result = await run(supabase, wants ? BATCH_SELECT : BATCH_SELECT_NO_STORAGE);

  if (!result.error) {
    batchStorage.known = true;
    batchStorage.present = wants;
    return result.data;
  }

  if (!isMissingBatchStorage(result.error)) throw result.error;
  if (!wants) throw result.error;

  batchStorage.known = true;
  batchStorage.present = false;
  console.warn(
    `[dataService] production_batches has no storage warehouse column, so the Storage column and batch storage editing are unavailable. `
      + `Apply supabase/migrations/${BATCH_STORAGE_MIGRATION} to this database to enable them. The rest of the workspace loads without it.`
  );
  result = await run(supabase, BATCH_SELECT_NO_STORAGE);
  if (result.error) throw result.error;
  return result.data;
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

/**
 * Whether the database does not have the named function, in any of the ways it
 * says so.
 *
 * A missing function is a deployment problem rather than bad input, and neither
 * wording says what to do about it. PostgREST reports a function absent from the
 * schema it published as PGRST202 "Could not find the function ... in the schema
 * cache", while Postgres reports a signature it does not have as 42883
 * "... does not exist". Matching only the second leaves the raw PostgREST message
 * on screen, which names no migration and no remedy.
 */
function isMissingFunction(error, name) {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`;
  if (!text.includes(name)) return false;
  return (
    error.code === 'PGRST202'
    || error.code === '42883'
    || /does not exist/i.test(text)
    || /could not find the function/i.test(text)
    || /function .* not found/i.test(text)
  );
}

// Production ------------------------------------------------------------
export const batchesApi = {
  // Probed: this is the workspace load, so it is where a database that has since
  // been migrated is noticed.
  list: () =>
    selectBatches(true, (supabase, select) =>
      supabase.from('production_batches').select(select).order('created_at', { ascending: false })
    ),
  get: async (id) =>
    selectBatches(false, (supabase, select) =>
      supabase
        .from('production_batches')
        .select(`${select}, stages:production_stages(*), quality_checks(*)`)
        .eq('id', id)
        .single()
    ),
  create: (row) => {
    // On a database without the column, sending the key fails the whole insert with
    // a Postgres error rather than ignoring it, so the key is dropped instead. That
    // leaves a batch created during this window with no storage warehouse, which is
    // exactly what every existing batch on that database has, and what the storage
    // backfill then fills in.
    if (batchStorageMissing()) {
      const rest = { ...row };
      delete rest.warehouse_id;
      return insert('production_batches', rest);
    }
    return insert('production_batches', row);
  },
  update: (id, f) => update('production_batches', id, f),
  remove: (id) => remove('production_batches', id),

  /**
   * Complete a batch through rpc_complete_production_batch, which marks the
   * batch COMPLETED, books the output into stock and writes the PRODUCTION
   * movement in one transaction.
   *
   * This deliberately does not reassemble the three writes in the browser. Done
   * that way they are three separate statements, so a refusal on any one of them
   * leaves stock booked for a completion the database never recorded — and the
   * retry books it a second time. The function returns void, so the confirmed
   * rows are read back here for the caller to mirror.
   */
  completeBatch: async ({ batchId, outputQty, rejectedQty, warehouseId, outputProductId }) => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('rpc_complete_production_batch', {
      p_batch_id: batchId,
      p_output: outputQty,
      p_rejected: rejectedQty,
      p_warehouse: warehouseId,
      p_output_product: outputProductId,
    });
    if (error) {
      if (isMissingFunction(error, 'rpc_complete_production_batch')) {
        throw new Error(
          `The database is missing rpc_complete_production_batch. Apply supabase/migrations/${BATCH_STORAGE_MIGRATION} before completing a batch.`
        );
      }
      throw error;
    }

    const [batchResult, inventoryResult, movementResult] = await Promise.all([
      selectBatches(false, (b, select) => b.from('production_batches').select(select).eq('id', batchId).single()),
      supabase.from('inventory').select(INVENTORY_SELECT).eq('batch_id', batchId).eq('warehouse_id', warehouseId).maybeSingle(),
      supabase
        .from('stock_movements')
        .select(MOVEMENT_SELECT)
        .eq('reference_type', 'production_batch')
        .eq('reference_id', batchId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (inventoryResult.error) throw inventoryResult.error;
    if (movementResult.error) throw movementResult.error;

    // workspaceService adds created_by_name to these two on load, so the mirrored
    // rows carry it too. Without it the completed batch is the only row in the
    // store shaped differently from its neighbours.
    return {
      batch: { ...batchResult, created_by_name: batchResult.created_by_profile?.full_name ?? '' },
      // Both are null when the output was zero: nothing was booked, and the store
      // must not gain a row the database does not have.
      inventory: inventoryResult.data,
      movement: movementResult.data && { ...movementResult.data, created_by_name: movementResult.data.created_by_profile?.full_name ?? '' },
    };
  },
  /**
   * Edit a batch, letting the database carry the stock that completion booked
   * along with it. The batch row is never written directly: rpc_update_production_batch
   * decides whether the change is allowed, rewrites the stock row and the
   * PRODUCTION movement to match, relocates the stock when the storage warehouse
   * changes, and raises if any of the stock has been sold, reserved or quality
   * approved.
   */
  updateBatch: async (batchId, fields) => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('rpc_update_production_batch', {
      p_batch_id: batchId,
      p_batch_number: fields.batch_number,
      p_product_id: fields.product_id,
      p_variety_id: fields.variety_id,
      p_seed_class_id: fields.seed_class_id,
      p_input_qty: fields.input_qty,
      p_output_qty: fields.output_qty,
      p_rejected_qty: fields.rejected_qty,
      p_output_product_id: fields.output_product_id,
      p_start_date: fields.start_date,
      p_end_date: fields.end_date,
      p_status: fields.status,
      p_quality_status: fields.quality_status,
      p_notes: fields.notes,
      p_warehouse_id: fields.warehouse_id || null,
    });
    if (error) {
      // The function refuses by raising, and those messages are written for the
      // operator, so they are passed through as-is. A missing function is the one
      // deployment error worth translating.
      if (isMissingFunction(error, 'rpc_update_production_batch')) {
        throw new Error(
          `The database is missing rpc_update_production_batch. Apply supabase/migrations/${BATCH_STORAGE_MIGRATION} before editing a batch.`
        );
      }
      throw error;
    }

    // The whole set for this batch, not a targeted row: correcting the output
    // product re-points the stock row, and when the new product already holds this
    // batch's output the two rows are merged and one of them is deleted. A read of
    // only the row the batch had would leave the store holding a row the database
    // no longer has, and the next diff-sync would put it back.
    //
    // The movements are matched on the batch reference rather than on movement
    // type, so the TRANSFER pair a warehouse change writes comes back with them:
    // the store has to hold those rows too, or the history on screen would stop
    // where the edit began.
    const [batchResult, inventoryResult, movementResult] = await Promise.all([
      selectBatches(false, (b, select) => b.from('production_batches').select(select).eq('id', batchId).single()),
      supabase.from('inventory').select(INVENTORY_SELECT).eq('batch_id', batchId),
      supabase
        .from('stock_movements')
        .select(MOVEMENT_SELECT)
        .eq('reference_type', 'production_batch')
        .eq('reference_id', batchId)
        .order('created_at', { ascending: false }),
    ]);
    if (inventoryResult.error) throw inventoryResult.error;
    if (movementResult.error) throw movementResult.error;

    // workspaceService adds created_by_name to the batch and the movement on load,
    // so the mirrored rows carry it too, or these are the only rows in the store
    // shaped unlike their neighbours. Inventory has no such column, so it is left
    // as the database returned it.
    const named = (row) => ({ ...row, created_by_name: row.created_by_profile?.full_name ?? '' });
    return {
      batch: named(batchResult),
      inventoryRows: inventoryResult.data ?? [],
      movementRows: (movementResult.data ?? []).map(named),
    };
  },
  createQualityCheck: (row) => insert('quality_checks', row),
};

/**
 * Alerts that repeat on their own — unlike an order confirmation or a payment
 * receipt, which happen once because somebody did something.
 *
 * Returns true when the alert should be raised now, and records that it was. The
 * timestamp lives in the database rather than in the notification list on purpose:
 * the operator is able to delete the alert, and a cooldown derived from a deleted
 * row would let the next stock movement raise it again immediately.
 */
export const notificationCooldownsApi = {
  claim: async (key, intervalHours) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('rpc_notification_cooldown', {
      p_key: key,
      p_interval_hours: intervalHours,
    });
    if (error) {
      if (isMissingFunction(error, 'rpc_notification_cooldown')) {
        throw new Error(
          'The database is missing rpc_notification_cooldown. Apply supabase/migrations/20260927000015_notification_cooldowns.sql.'
        );
      }
      throw error;
    }
    return data === true;
  },
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
  list: () => list('inventory', INVENTORY_SELECT, { column: 'updated_at', ascending: false }),
  adjust: async (payload) => {
    const supabase = await getSupabase();
    return supabase.rpc('adjust_inventory', payload);
  },
};

export const movementsApi = {
  list: () => list('stock_movements', MOVEMENT_SELECT, { column: 'created_at', ascending: false }),
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
