import {
  ensureDemoUsers,
  getSession,
  signIn as svcSignIn,
  registerUser as svcRegister,
  signOut as svcSignOut,
  updateOwnProfile,
  updatePassword as svcUpdatePassword,
} from '../../services/authService';
import { ROLES } from '../../lib/permissions';

function readDemoUsers() {
  try {
    return JSON.parse(localStorage.getItem('vfa_demo_users') || 'null') ?? [];
  } catch {
    return [];
  }
}

/**
 * Auth slice — manages session + profile.
 * Demo mode: profile comes from the localStorage demo users list.
 * Live mode: profile comes from the `profiles` table.
 */
export const authSlice = (set, get) => ({
  session: null,
  profile: null,
  authReady: false,

  async initAuth(seedUsers) {
    ensureDemoUsers(seedUsers);
    const session = await getSession();
    if (session?.user) {
      get().loadProfile(session.user);
    }
    set({ authReady: true });
  },

  loadProfile(user) {
    const users = readDemoUsers();
    const match =
      users.find((u) => u.id === user.id) ||
      users.find((u) => u.email === user.email) ||
      // Live mode minimal profile — full profile loads via dataService
      {
        id: user.id,
        email: user.email,
        fullName: user.email?.split('@')[0] ?? 'User',
        role: ROLES.STAFF,
        status: 'ACTIVE',
      };
    set({ profile: match, session: { user } });
  },

  async signIn(email, password) {
    const { user, session } = await svcSignIn(email, password);
    get().loadProfile(user);
    set({ session });
  },

  async registerUser(payload) {
    const { user } = await svcRegister(payload);
    get().loadProfile(user);
  },

  async signOutUser() {
    await svcSignOut();
    set({ session: null, profile: null });
  },

  async updateUserProfile(fields) {
    await updateOwnProfile(fields);
    set((s) => ({ profile: { ...s.profile, ...fields } }));
  },

  async changePassword(newPassword) {
    await svcUpdatePassword(newPassword);
  },
});
