import { availableQty } from '../../lib/calc';
import { notificationCooldownsApi } from '../../services/dataService';

const nowISO = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

/** A rolling seven days, measured from when the last digest was raised. */
const LOW_STOCK_INTERVAL_HOURS = 7 * 24;

/**
 * System slice (spec §28, §29, §41): audit logs, notifications, settings.
 */
export const systemSlice = (set, get) => ({
  auditLogs: [],
  notifications: [],
  settings: {},

  // ---- Audit logs (§28) ----
  logAction(description, module) {
    set((s) => ({
      auditLogs: [
        {
          id: uid(),
          user_id: get().profile?.id,
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
        { id: uid(), user_id: get().profile?.id, type, title, message, read: false, created_at: nowISO() },
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

  /**
   * Whether the signed-in user may remove this notification, matching the notif_delete
   * policy: your own, or any broadcast if you are a manager.
   *
   * Checked here as well as in the database so a refused delete never reaches the
   * diff-sync. The row would come back from the database on the next flush, leaving
   * the store holding a notification it has already been told to forget, and the
   * pending delete retried on every subsequent sync for as long as the tab is open.
   */
  canDeleteNotification(n) {
    if (n.user_id === get().profile?.id) return true;
    return n.user_id == null && get().profile?.role === 'manager';
  },

  deleteNotification(id) {
    const n = get().notifications.find((x) => x.id === id);
    if (!n) return;
    if (!get().canDeleteNotification(n)) {
      throw new Error(
        n.user_id == null
          ? 'This is a notification for everyone, so only a manager can remove it. Mark it read instead.'
          : 'You can only remove your own notifications.'
      );
    }
    set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) }));
  },

  /** Clear the read ones, which is the pile that has served its purpose. */
  deleteReadNotifications() {
    const removable = get().notifications.filter((n) => n.read && get().canDeleteNotification(n));
    if (!removable.length) return 0;
    const ids = new Set(removable.map((n) => n.id));
    set((s) => ({ notifications: s.notifications.filter((n) => !ids.has(n.id)) }));
    return removable.length;
  },

  // ---- Settings ----
  updateSettings(fields) {
    set((s) => ({ settings: { ...s.settings, id: s.settings.id ?? uid(), ...fields } }));
    get().logAction('Updated system settings', 'Settings');
  },

  /**
   * Raise the low-stock alert as a single digest, at most once a week.
   *
   * This used to raise one notification per product, deduped only against the
   * notifications still in the store, so it fired on every page load and after every
   * sale, damage, adjustment or transfer — and once notifications became deletable,
   * deleting the alert brought it back on the next stock movement.
   *
   * Now the products are collected into one row, and the week is tracked in the
   * database rather than in this list, so clearing the alert does not reset the
   * interval. A product that was already low when the digest was raised is not
   * re-warned about for seven days; one that drops below its minimum during that
   * week joins the next digest.
   */
  async checkLowStock() {
    const { products, inventory } = get();
    const totals = new Map();
    for (const inv of inventory) {
      totals.set(inv.product_id, (totals.get(inv.product_id) ?? 0) + availableQty(inv));
    }

    const low = products
      .map((p) => ({ name: p.name, total: totals.get(p.id) ?? 0, min: Number(p.minimum_stock) || 0 }))
      .filter((p) => p.min > 0 && p.total <= p.min)
      // Worst first, so if the list is truncated the products that are furthest
      // below their minimum are the ones still shown.
      .sort((a, b) => a.total / a.min - b.total / b.min);

    if (!low.length) return false;

    // A failure here must not break the caller: this runs after every stock
    // movement, and an alert that could not be rate-limited is better than an
    // action that threw. The weekly digest is the point, so skip rather than
    // risk spamming every load.
    let allowed;
    try {
      allowed = await notificationCooldownsApi.claim('low_stock', LOW_STOCK_INTERVAL_HOURS);
    } catch {
      return false;
    }
    if (!allowed) return false;

    const shown = low.slice(0, 8);
    const rest = low.length - shown.length;
    const list = shown.map((p) => `${p.name} at ${p.total} (min ${p.min})`).join(', ');
    get().pushNotification(
      'warning',
      'Low stock',
      `${low.length} product${low.length === 1 ? '' : 's'} at or below minimum: ${list}${rest > 0 ? `, and ${rest} more` : ''}.`
    );
    return true;
  },
});
