/** Profile management. New identities are created through Supabase Auth. */
export const usersSlice = (set, get) => ({
  users: [],

  updateUser(id, fields) {
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...fields } : u)) }));
    get().logAction(`Updated user "${fields.fullName ?? id}"`, 'Users');
  },
});
