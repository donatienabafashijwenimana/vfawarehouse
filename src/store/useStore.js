import { create } from 'zustand';
import { supabaseConfigured } from '../services/supabase';
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
        state.pushToast(`Database save failed: ${error.message}`, 'error');
        syncPending = true;
      }).finally(() => {
        syncing = false;
        if (syncPending) state.refreshDatabaseSync();
      });
    }, 200);
  },
}));
