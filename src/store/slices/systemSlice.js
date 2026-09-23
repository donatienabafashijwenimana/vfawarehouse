import { availableQty } from '../../lib/calc';

const nowISO = () => new Date().toISOString();

/**
 * System slice (spec §28, §29, §41): audit logs, notifications, settings.
 */
export const systemSlice = (set, get) => ({
  auditLogs: [],
  notifications: [],
  settings: {
    organizationName: 'VFA Greenhouse Seeds Hub Ltd',
    enableCustomerOrders: true,
    lowStockThresholdDefault: 100,
    currency: 'RWF',
  },

  // ---- Audit logs (§28) ----
  logAction(description, module) {
    set((s) => ({
      auditLogs: [
        {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          user: get().profile?.fullName ?? 'system',
          role: get().profile?.role ?? '—',
          action: description,
          module,
          created_at: nowISO(),
        },
        ...s.auditLogs,
      ],
    }));
  },

  // ---- Notifications (§29) ----
  pushNotification(type, title, message) {
    set((s) => ({
      notifications: [
        { id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, title, message, read: false, created_at: nowISO() },
        ...s.notifications,
      ],
    }));
  },
  markNotificationRead(id) {
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  },
  markAllNotificationsRead() {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  },

  // ---- Settings ----
  updateSettings(fields) {
    set((s) => ({ settings: { ...s.settings, ...fields } }));
    get().logAction('Updated system settings', 'Settings');
  },

  /** Auto-generate low-stock notifications for products at/below minimum. */
  checkLowStock() {
    const { products, inventory } = get();
    const totals = new Map();
    for (const inv of inventory) {
      totals.set(inv.product_id, (totals.get(inv.product_id) ?? 0) + availableQty(inv));
    }
    for (const p of products) {
      const total = totals.get(p.id) ?? 0;
      const min = Number(p.minimum_stock) || 0;
      if (min > 0 && total <= min) {
        const already = get().notifications.some(
          (n) => n.type === 'warning' && n.title === 'Low stock' && n.message.startsWith(p.name)
        );
        if (!already) {
          get().pushNotification('warning', 'Low stock', `${p.name} at ${total} (min ${min}).`);
        }
      }
    }
  },
});

