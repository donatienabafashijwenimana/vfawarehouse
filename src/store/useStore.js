import { create } from 'zustand';
import { supabaseConfigured, getSupabase } from '../services/supabase';
import { loadWorkspaceData } from '../services/workspaceService';
import { syncWorkspaceChanges } from '../services/workspaceSync';
import { authSlice } from './slices/authSlice';
import { usersSlice } from './slices/usersSlice';
import { catalogSlice } from './slices/catalogSlice';
import { productionSlice } from './slices/productionSlice';
import { warehouseSlice } from './slices/warehouseSlice';
import { salesSlice } from './slices/salesSlice';
import { financeSlice } from './slices/financeSlice';
import { systemSlice } from './slices/systemSlice';

const DATA_KEYS = [
  'users', 'categories', 'seedClasses', 'varieties', 'products', 'warehouses', 'inventory', 'movements',
  'batches', 'stages', 'qualityChecks', 'customers', 'orders', 'sales', 'payments', 'expenses',
  'notifications', 'auditLogs', 'settings',
];

let baseline = null;
let initialized = false;
let syncTimer = null;
let syncing = false;
let syncPending = false;
let syncBound = false;

function snapshot(state) {
  return Object.fromEntries(DATA_KEYS.map((key) => [key, state[key]]));
}

/**
 * Commit a sync's progress even when some tables failed: keys that saved fine
 * advance to the current snapshot, keys that failed keep their old baseline so
 * their rows are retried (and re-saved) on the next sync instead of being lost.
 */
function mergeBaseline(current, failedKeys) {
  if (!baseline || !Array.isArray(failedKeys)) return baseline;
  const failed = new Set(failedKeys);
  return Object.fromEntries(DATA_KEYS.map((key) => [key, failed.has(key) ? baseline[key] : current[key]]));
}

function bindDatabaseSync(get) {
  if (!supabaseConfigured || syncBound) return;
  syncBound = true;
  useStore.subscribe((state) => {
    if (!state.dbReady || !state.profile) return;
    syncPending = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      if (syncing || !syncPending || !baseline) return;
      syncing = true;
      syncPending = false;
      const current = snapshot(get());
      try {
        await syncWorkspaceChanges(baseline, current);
        baseline = current;
      } catch (error) {
        baseline = mergeBaseline(current, error.failedKeys) ?? baseline;
        get().pushToast(`Database save failed: ${error.message}`, 'error');
        syncPending = true;
      } finally {
        syncing = false;
        if (syncPending) syncTimer = setTimeout(() => useStore.getState().refreshDatabaseSync(), 200);
      }
    }, 350);
  });
}

export const useStore = create((set, get) => ({
  ...authSlice(set, get),
  ...usersSlice(set, get),
  ...catalogSlice(set, get),
  ...productionSlice(set, get),
  ...warehouseSlice(set, get),
  ...salesSlice(set, get),
  ...financeSlice(set, get),
  ...systemSlice(set, get),

  toasts: [],
  pushToast(message, type = 'success') {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 3500);
  },
  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  ready: false,
  dbReady: false,

  async init() {
    if (initialized) return;
    initialized = true;
    try {
      await get().initAuth();
    } catch (error) {
      get().pushToast(`Database connection failed: ${error.message}`, 'error');
    } finally {
      set({ ready: true });
    }
  },

  async loadWorkspace() {
    const rows = await loadWorkspaceData();
    const profile = get().profile;
    const customer = rows.customers.find((item) => item.user_id === profile?.id);
    const settings = {
      id: rows.settings.id,
      organizationName: rows.settings.organizationName ?? '',
      enableCustomerOrders: rows.settings.enableCustomerOrders ?? false,
      lowStockThresholdDefault: rows.settings.lowStockThresholdDefault ?? 0,
      currency: rows.settings.currency ?? 'RWF',
      ...rows.settings,
    };
    set({ ...rows, settings, profile: { ...profile, customer_id: customer?.id ?? null } });
    baseline = snapshot(get());
    set({ dbReady: true });
    bindDatabaseSync(get);
    get().checkLowStock();
  },

  clearWorkspace() {
    baseline = null;
    set({
      users: [], categories: [], seedClasses: [], varieties: [], products: [], warehouses: [], inventory: [], movements: [],
      batches: [], stages: [], qualityChecks: [], customers: [], orders: [], sales: [], payments: [], expenses: [],
      notifications: [], auditLogs: [], settings: {}, dbReady: false,
    });
  },

  /**
   * Save pending changes to the database right now (used after form submits)
   * and resolve with { ok, message } so the caller can tell the user whether
   * the record actually reached the database instead of waiting on the
   * debounced background sync. Pass { table, id } to read the row back and
   * only report success once the database confirms it exists.
   */
  async flushDatabaseSync(verify) {
    const state = get();
    if (!state.dbReady || !state.profile || !baseline) return { ok: false, message: 'Not connected to the database' };
    // Wait for any in-flight sync instead of reporting a "queued" success: its
    // snapshot may predate this change, and the retry that would have saved it
    // gets cancelled below, so the record could silently never reach the DB.
    const deadline = Date.now() + 10_000;
    while (syncing && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (syncing) return { ok: false, message: 'Another database save is still in progress — try again in a moment' };
    clearTimeout(syncTimer);
    syncPending = false;
    syncing = true;
    const current = snapshot(get());
    try {
      await syncWorkspaceChanges(baseline, current);
      baseline = current;
      if (verify?.table && verify?.id) {
        const supabase = await getSupabase();
        const { data, error } = await supabase.from(verify.table).select('id').eq('id', verify.id).maybeSingle();
        if (error) return { ok: false, message: `Saved, but verification failed: ${error.message}` };
        if (!data) return { ok: false, message: 'The database has no record of this save — it was likely blocked by row-level security. Check your account is ACTIVE with a verified email.' };
      }
      return { ok: true };
    } catch (error) {
      baseline = mergeBaseline(current, error.failedKeys) ?? baseline;
      return { ok: false, message: error.message };
    } finally {
      syncing = false;
      if (syncPending) syncTimer = setTimeout(() => useStore.getState().refreshDatabaseSync(), 200);
    }
  },

  /**
   * Mark data slices as already persisted (used after direct API writes) so
   * the background diff-sync does not re-write rows the database just confirmed.
   * Accepts one key or several.
   */
  markSynced(...keys) {
    if (!baseline) return;
    const current = snapshot(get());
    const named = keys.flat();
    const next = {};
    let found = false;
    for (const key of named) {
      if (!(key in current)) continue;
      next[key] = current[key];
      found = true;
    }
    if (found) baseline = { ...baseline, ...next };
  },

  /**
   * Put the baseline back for the slices a refused write touched, so it still
   * describes the database.
   *
   * Without this, rolling a write back in the store desynchronises it from the
   * baseline: mergeBaseline has already advanced the slices that did save, so the
   * store goes back to holding fewer rows than the baseline records as saved. The
   * next sync reads that difference as a deletion and removes rows the database
   * is quite happy with — which is how a completed batch's stock vanished on the
   * following reload.
   */
  revertBaseline(rows) {
    if (!baseline || !rows) return;
    // A list of key names, not entries. Object.fromEntries needs [key, value] pairs
    // and throws "Iterator value batches is not an entry object" on a bare string,
    // which is what this used to be handed — so every rollback of a refused write
    // died here, before the rows were put back, leaving the store showing the change
    // the database had just refused.
    const keys = Object.keys(rows).filter((key) => key in baseline && key !== 'settings');
    if (!keys.length) return;
    const restored = { ...baseline };
    for (const key of keys) restored[key] = rows[key];
    baseline = restored;
  },

  refreshDatabaseSync() {
    if (!syncPending || syncing || !baseline) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const state = get();
      if (!state.dbReady || !state.profile) return;
      syncing = true;
      syncPending = false;
      const current = snapshot(state);
      syncWorkspaceChanges(baseline, current).then(() => { baseline = current; }).catch((error) => {
        baseline = mergeBaseline(current, error.failedKeys) ?? baseline;
        state.pushToast(`Database save failed: ${error.message}`, 'error');
        syncPending = true;
      }).finally(() => {
        syncing = false;
        if (syncPending) state.refreshDatabaseSync();
      });
    }, 200);
  },
}));
