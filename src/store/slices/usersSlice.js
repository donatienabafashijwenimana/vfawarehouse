import { ROLES } from '../../lib/permissions';

/**
 * User management slice (spec §4): create/update/activate/deactivate users.
 * Demo mode only — live mode maps to the `profiles` table via dataService.
 */
export const usersSlice = (set, get) => ({
  users: [],

  addUser(row) {
    const user = {
      ...row,
      role: ROLES[row.role?.toUpperCase?.()] ?? row.role ?? ROLES.STAFF,
      registered: new Date().toISOString().slice(0, 10),
    };
    set((s) => ({ users: [...s.users, user] }));
    // Keep demo auth list in sync so the new user can log in (demo mode)
    try {
      const key = 'vfa_demo_users';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(user);
      localStorage.setItem(key, JSON.stringify(list));
    } catch { /* ignore */ }
    get().logAction(`Created user "${row.fullName}" (${user.role})`, 'Users');
  },

  updateUser(id, fields) {
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...fields } : u)) }));
    try {
      const key = 'vfa_demo_users';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = list.findIndex((u) => u.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...fields };
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch { /* ignore */ }
    get().logAction(`Updated user "${fields.fullName ?? id}"`, 'Users');
  },
});
