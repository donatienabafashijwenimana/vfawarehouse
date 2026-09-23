import { create } from 'zustand';
import { demoData } from './demoData';
import { authSlice } from './slices/authSlice';
import { usersSlice } from './slices/usersSlice';
import { catalogSlice } from './slices/catalogSlice';
import { productionSlice } from './slices/productionSlice';
import { warehouseSlice } from './slices/warehouseSlice';
import { salesSlice } from './slices/salesSlice';
import { financeSlice } from './slices/financeSlice';
import { systemSlice } from './slices/systemSlice';

/**
 * Root store: one Zustand store composed of domain slices.
 * Demo mode starts hydrated with demoData; live mode loads from Supabase.
 */

/** Keys persisted on every mutation so demo-mode input survives a reload. */
const PERSISTED_KEYS = [
  'users',
  'categories',
  'seedClasses',
  'varieties',
  'products',
  'warehouses',
  'inventory',
  'movements',
  'batches',
  'stages',
  'qualityChecks',
  'customers',
  'orders',
  'sales',
  'payments',
  'expenses',
  'notifications',
  'auditLogs',
  'settings',
];

const STORAGE_KEY = 'vfa_demo_store_v1';

let persistBound = false;

function loadSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.data?.products)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function dumpSnapshot(state) {
  const data = {};
  for (const key of PERSISTED_KEYS) data[key] = state[key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data }));
  } catch { /* storage full / unavailable — demo data stays in memory */ }
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
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  ready: false,

  /** Hydrate demo data + restore session. Call once from <App />. */
  init() {
    const snapshot = loadSnapshot();
    set((s) => ({
      ...demoData,
      ...(snapshot ? snapshot : {}), // persisted demo data wins over seed data
      toasts: s.toasts,
    }));
    get().initAuth(demoData.demoUsers);
    get().checkLowStock();
    get().persist();
    set({ ready: true });
  },

  /** Persist domain slices (debounced) after every state change. */
  persist() {
    if (persistBound) return;
    persistBound = true;
    let pending = false;
    const flush = () => {
      pending = false;
      if (!get().ready) return;
      dumpSnapshot(get());
    };
    useStore.subscribe(() => {
      if (pending) return;
      pending = true;
      setTimeout(flush, 300);
    });
  },
}));